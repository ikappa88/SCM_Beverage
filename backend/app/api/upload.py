import io
from datetime import date
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.inventory import Inventory
from app.models.location import Location
from app.models.product import Product
from app.models.user import User, UserRole
from app.services.auth import get_current_user
from app.api.inventory import check_location_access

router = APIRouter(prefix="/api/upload", tags=["データアップロード"])

REQUIRED_COLUMNS = {"location_code", "product_code", "quantity"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_ROWS = 10000


def _check_operator_access(user: User, location_id: int) -> bool:
    """inventory.pyと同一ロジック（循環インポート回避のため複製）"""
    if user.role == UserRole.ADMINISTRATOR:
        return True
    if not user.assigned_location_ids or not user.assigned_location_ids.strip():
        return False
    allowed = [
        s.strip() for s in user.assigned_location_ids.split(",") if s.strip().isdigit()
    ]
    return str(location_id) in allowed


def _validate_and_build_rows(df: pd.DataFrame, db: Session, current_user: User):
    """
    共通バリデーション。
    errors: list[dict]  エラー行
    rows:   list[dict]  正常行（コミット用データ付き）
    previews: list[dict] プレビュー表示用
    """
    errors = []
    rows = []
    previews = []

    if len(df) > MAX_ROWS:
        raise HTTPException(
            status_code=400,
            detail=f"行数が上限（{MAX_ROWS}行）を超えています（{len(df)}行）",
        )

    has_mfg_col = "manufacture_date" in df.columns
    has_expiry_col = "expiry_date" in df.columns

    for idx, row in df.iterrows():
        row_num = int(idx) + 2

        location_code = str(row.get("location_code", "")).strip()
        product_code = str(row.get("product_code", "")).strip()
        quantity_str = str(row.get("quantity", "")).strip()

        if not location_code or not product_code or not quantity_str:
            errors.append(
                {
                    "row": row_num,
                    "reason": "location_code・product_code・quantityは必須です",
                }
            )
            continue

        try:
            quantity = int(quantity_str)
            if quantity < 0:
                raise ValueError
        except ValueError:
            errors.append(
                {
                    "row": row_num,
                    "reason": f"quantity '{quantity_str}' は0以上の整数である必要があります",
                }
            )
            continue

        # manufacture_date のパース（列がある場合のみ）
        manufacture_date: Optional[date] = None
        if has_mfg_col:
            mfg_str = str(row.get("manufacture_date", "")).strip()
            if mfg_str and mfg_str.lower() not in ("nan", "none", ""):
                try:
                    manufacture_date = date.fromisoformat(mfg_str)
                except ValueError:
                    errors.append(
                        {
                            "row": row_num,
                            "reason": f"manufacture_date '{mfg_str}' はYYYY-MM-DD形式で入力してください",
                        }
                    )
                    continue

        if has_mfg_col and manufacture_date is None:
            errors.append(
                {
                    "row": row_num,
                    "reason": "manufacture_date列が存在する場合、値は必須です（YYYY-MM-DD形式）",
                }
            )
            continue

        # expiry_date のパース（任意）
        expiry_date: Optional[date] = None
        if has_expiry_col:
            exp_str = str(row.get("expiry_date", "")).strip()
            if exp_str and exp_str.lower() not in ("nan", "none", ""):
                try:
                    expiry_date = date.fromisoformat(exp_str)
                except ValueError:
                    errors.append(
                        {
                            "row": row_num,
                            "reason": f"expiry_date '{exp_str}' はYYYY-MM-DD形式で入力してください",
                        }
                    )
                    continue

        location = (
            db.query(Location)
            .filter(Location.code == location_code, Location.is_active == True)
            .first()
        )
        if not location:
            errors.append(
                {
                    "row": row_num,
                    "reason": f"拠点コード '{location_code}' が見つかりません",
                }
            )
            continue

        if not _check_operator_access(current_user, location.id):
            errors.append(
                {
                    "row": row_num,
                    "reason": f"拠点 '{location_code}' へのアクセス権限がありません",
                }
            )
            continue

        product = (
            db.query(Product)
            .filter(Product.code == product_code, Product.is_active == True)
            .first()
        )
        if not product:
            errors.append(
                {
                    "row": row_num,
                    "reason": f"商品コード '{product_code}' が見つかりません",
                }
            )
            continue

        # manufacture_date ありの場合: ロット一致で検索（なければ新規作成）
        # manufacture_date なし（列自体がない）の場合: 先頭ロットを更新
        if manufacture_date is not None:
            inv = (
                db.query(Inventory)
                .filter(
                    Inventory.location_id == location.id,
                    Inventory.product_id == product.id,
                    Inventory.manufacture_date == manufacture_date,
                )
                .first()
            )
            action = "update" if inv else "create"
        else:
            inv = (
                db.query(Inventory)
                .filter(
                    Inventory.location_id == location.id,
                    Inventory.product_id == product.id,
                )
                .first()
            )
            action = "update" if inv else None

        if action is None:
            errors.append(
                {
                    "row": row_num,
                    "reason": (
                        f"拠点 '{location_code}' × 商品 '{product_code}' の在庫ロットが存在しません。"
                        "manufacture_date列を追加して新規ロットを作成してください。"
                    ),
                }
            )
            continue

        rows.append(
            {
                "inventory_id": inv.id if inv else None,
                "quantity": quantity,
                "action": action,
                "location_id": location.id,
                "product_id": product.id,
                "manufacture_date": manufacture_date,
                "expiry_date": expiry_date,
            }
        )
        previews.append(
            {
                "row": row_num,
                "location_code": location_code,
                "location_name": location.name,
                "product_code": product_code,
                "product_name": product.name,
                "manufacture_date": manufacture_date.isoformat() if manufacture_date else None,
                "expiry_date": expiry_date.isoformat() if expiry_date else None,
                "action": action,
                "current_quantity": inv.quantity if inv else None,
                "new_quantity": quantity,
                "inventory_id": inv.id if inv else None,
            }
        )

    return errors, rows, previews


def _read_csv(content: bytes) -> pd.DataFrame:
    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str)
    except Exception:
        raise HTTPException(
            status_code=400, detail="CSVファイルの読み込みに失敗しました"
        )
    df.columns = df.columns.str.strip().str.lower()
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"必須列が不足しています: {', '.join(sorted(missing))}",
        )
    return df


@router.post("/inventory/preview")
async def preview_inventory_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """CSVアップロードのプレビュー（バリデーション・変更前後の確認）"""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400, detail="CSVファイルをアップロードしてください"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail=f"ファイルサイズが上限（10MB）を超えています"
        )

    df = _read_csv(content)
    errors, _, previews = _validate_and_build_rows(df, db, current_user)

    return {
        "total_rows": len(df),
        "valid_rows": len(previews),
        "error_rows": len(errors),
        "errors": errors,
        "previews": previews,
    }


@router.post("/inventory/commit")
async def commit_inventory_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """CSVアップロードの確定（全件成功または全件中断）"""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400, detail="CSVファイルをアップロードしてください"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail=f"ファイルサイズが上限（10MB）を超えています"
        )

    df = _read_csv(content)

    # プレビューと同じ検証を実行
    errors, rows, _ = _validate_and_build_rows(df, db, current_user)

    # 1行でもエラーがあれば全件中断
    if errors:
        raise HTTPException(
            status_code=400,
            detail=f"バリデーションエラーが{len(errors)}件あります。取り込みを中断しました。プレビューで内容を確認してください。",
        )

    # 全件正常 → トランザクションでコミット
    try:
        updated = 0
        created = 0
        upserted_ids: list[int] = []

        for row in rows:
            if row["action"] == "update" and row["inventory_id"] is not None:
                inv = (
                    db.query(Inventory)
                    .filter(Inventory.id == row["inventory_id"])
                    .first()
                )
                if inv:
                    inv.quantity = row["quantity"]
                    upserted_ids.append(inv.id)
                    updated += 1
            elif row["action"] == "create":
                # safety_stock / max_stock を同一拠点×商品の既存ロットからコピー
                existing = (
                    db.query(Inventory)
                    .filter(
                        Inventory.location_id == row["location_id"],
                        Inventory.product_id == row["product_id"],
                    )
                    .first()
                )
                safety_stock = existing.safety_stock if existing else 0
                max_stock = existing.max_stock if existing else 9999

                new_inv = Inventory(
                    location_id=row["location_id"],
                    product_id=row["product_id"],
                    quantity=row["quantity"],
                    manufacture_date=row["manufacture_date"],
                    expiry_date=row["expiry_date"],
                    safety_stock=safety_stock,
                    max_stock=max_stock,
                )
                db.add(new_inv)
                db.flush()
                upserted_ids.append(new_inv.id)
                created += 1

        db.commit()

        from app.models.audit_log import AuditAction
        from app.services.audit import record
        from app.services.alert_service import evaluate_inventory_alerts_bulk

        record(
            db,
            username=current_user.username,
            action=AuditAction.UPLOAD,
            resource="inventory",
            detail=f"CSVアップロード: {updated}件更新, {created}件新規ロット作成",
            user_id=current_user.id,
        )

        evaluate_inventory_alerts_bulk(db, upserted_ids)
        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"取り込み中にエラーが発生しました: {str(e)}"
        )

    return {
        "message": f"{updated}件更新、{created}件新規ロット作成しました",
        "updated": updated,
        "created": created,
    }


# ─────────────────────────────────────────────────────────────────
# 商品マスタ CSV アップロード
# ─────────────────────────────────────────────────────────────────

@router.post("/products")
async def upload_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """商品マスタCSVの一括登録・更新（コードが存在すれば更新、なければ新規作成）
    CSVフォーマット: code, name, category[, unit_size, min_order_qty, weight_kg]
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSVファイルをアップロードしてください")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="ファイルサイズが上限（10MB）を超えています")

    try:
        df = _read_csv_generic(content, {"code", "name", "category"})
    except HTTPException:
        raise

    errors = []
    upserted = 0
    for idx, row in df.iterrows():
        row_num = int(idx) + 2
        code = str(row.get("code", "")).strip()
        name = str(row.get("name", "")).strip()
        category = str(row.get("category", "")).strip()

        if not code or not name or not category:
            errors.append({"row": row_num, "reason": "code・name・categoryは必須です"})
            continue

        product = db.query(Product).filter(Product.code == code).first()
        if product:
            product.name = name
            product.category = category
            if "unit_size" in df.columns:
                product.unit_size = str(row["unit_size"]).strip() or None
            if "min_order_qty" in df.columns:
                try:
                    product.min_order_qty = int(row["min_order_qty"])
                except (ValueError, TypeError):
                    pass
            if "weight_kg" in df.columns:
                try:
                    product.weight_kg = float(row["weight_kg"])
                except (ValueError, TypeError):
                    product.weight_kg = None
        else:
            kwargs: dict = {"code": code, "name": name, "category": category}
            if "unit_size" in df.columns:
                kwargs["unit_size"] = str(row["unit_size"]).strip() or None
            if "min_order_qty" in df.columns:
                try:
                    kwargs["min_order_qty"] = int(row["min_order_qty"])
                except (ValueError, TypeError):
                    pass
            if "weight_kg" in df.columns:
                try:
                    kwargs["weight_kg"] = float(row["weight_kg"])
                except (ValueError, TypeError):
                    pass
            db.add(Product(**kwargs))
        upserted += 1

    if errors:
        db.rollback()
        raise HTTPException(status_code=400, detail={"errors": errors})

    db.commit()

    from app.models.audit_log import AuditAction
    from app.services.audit import record
    record(db, username=current_user.username, action=AuditAction.UPLOAD,
           resource="product", detail=f"商品マスタCSV: {upserted}件登録・更新",
           user_id=current_user.id)

    return {"message": f"{upserted}件の商品データを登録・更新しました", "updated": upserted}


# ─────────────────────────────────────────────────────────────────
# ルートマスタ CSV アップロード
# ─────────────────────────────────────────────────────────────────

@router.post("/routes")
async def upload_routes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """ルートマスタCSVの一括登録・更新（コードが存在すれば更新、なければ新規作成）
    CSVフォーマット: code, origin_code, destination_code, lead_time_days[, cost_per_unit]
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSVファイルをアップロードしてください")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="ファイルサイズが上限（10MB）を超えています")

    try:
        df = _read_csv_generic(content, {"code", "origin_code", "destination_code", "lead_time_days"})
    except HTTPException:
        raise

    # 拠点コード→ID マップ（全件キャッシュ）
    loc_map = {loc.code: loc.id for loc in db.query(Location).filter(Location.is_active == True).all()}

    errors = []
    upserted = 0
    for idx, row in df.iterrows():
        row_num = int(idx) + 2
        code = str(row.get("code", "")).strip()
        origin_code = str(row.get("origin_code", "")).strip()
        dest_code = str(row.get("destination_code", "")).strip()

        if not code or not origin_code or not dest_code:
            errors.append({"row": row_num, "reason": "code・origin_code・destination_codeは必須です"})
            continue

        try:
            lead_time = int(row["lead_time_days"])
        except (ValueError, TypeError):
            errors.append({"row": row_num, "reason": "lead_time_daysは整数で入力してください"})
            continue

        if origin_code not in loc_map:
            errors.append({"row": row_num, "reason": f"出発拠点コード '{origin_code}' が見つかりません"})
            continue
        if dest_code not in loc_map:
            errors.append({"row": row_num, "reason": f"到着拠点コード '{dest_code}' が見つかりません"})
            continue

        cost: Optional[float] = None
        if "cost_per_unit" in df.columns:
            try:
                cost = float(row["cost_per_unit"])
            except (ValueError, TypeError):
                cost = None

        from app.models.route import Route
        route = db.query(Route).filter(Route.code == code).first()
        if route:
            route.origin_id = loc_map[origin_code]
            route.destination_id = loc_map[dest_code]
            route.lead_time_days = lead_time
            if cost is not None:
                route.cost_per_unit = cost
        else:
            db.add(Route(
                code=code,
                origin_id=loc_map[origin_code],
                destination_id=loc_map[dest_code],
                lead_time_days=lead_time,
                cost_per_unit=cost,
            ))
        upserted += 1

    if errors:
        db.rollback()
        raise HTTPException(status_code=400, detail={"errors": errors})

    db.commit()

    from app.models.audit_log import AuditAction
    from app.services.audit import record
    record(db, username=current_user.username, action=AuditAction.UPLOAD,
           resource="route", detail=f"ルートマスタCSV: {upserted}件登録・更新",
           user_id=current_user.id)

    return {"message": f"{upserted}件のルートデータを登録・更新しました", "updated": upserted}


def _read_csv_generic(content: bytes, required: set) -> "pd.DataFrame":
    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str)
    except Exception:
        raise HTTPException(status_code=400, detail="CSVファイルの読み込みに失敗しました")
    df.columns = df.columns.str.strip().str.lower()
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"必須列が不足しています: {', '.join(sorted(missing))}",
        )
    if len(df) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"行数が上限（{MAX_ROWS}行）を超えています")
    return df
