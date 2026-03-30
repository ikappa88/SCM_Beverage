import io
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

        inv = (
            db.query(Inventory)
            .filter(
                Inventory.location_id == location.id,
                Inventory.product_id == product.id,
            )
            .first()
        )

        if inv is None:
            errors.append(
                {
                    "row": row_num,
                    "reason": f"拠点 '{location_code}' × 商品 '{product_code}' の在庫レコードが存在しません",
                }
            )
            continue

        rows.append(
            {
                "inventory_id": inv.id,
                "quantity": quantity,
            }
        )
        previews.append(
            {
                "row": row_num,
                "location_code": location_code,
                "location_name": location.name,
                "product_code": product_code,
                "product_name": product.name,
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
        for row in rows:
            if row["inventory_id"] is None:
                continue
            inv = (
                db.query(Inventory).filter(Inventory.id == row["inventory_id"]).first()
            )
            if inv:
                inv.quantity = row["quantity"]
                updated += 1
        db.commit()

        from app.models.audit_log import AuditAction
        from app.services.audit import record

        record(
            db,
            username=current_user.username,
            action=AuditAction.UPLOAD,
            resource="inventory",
            detail=f"CSVアップロード: {updated}件更新",
            user_id=current_user.id,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"取り込み中にエラーが発生しました: {str(e)}"
        )

    return {"message": f"{updated}件の在庫データを更新しました", "updated": updated}
