import io
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.inventory import Inventory
from app.models.location import Location
from app.models.product import Product
from app.models.user import User, UserRole
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/upload", tags=["データアップロード"])

REQUIRED_COLUMNS = {"location_code", "product_code", "quantity"}


def _check_operator_access(user: User, location_id: int) -> bool:
    if user.role == UserRole.ADMINISTRATOR:
        return True
    if not user.assigned_location_ids:
        return False
    allowed = [s.strip() for s in user.assigned_location_ids.split(",")]
    return str(location_id) in allowed


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

    errors = []
    previews = []

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # ヘッダー行を含むため+2
        location_code = str(row.get("location_code", "")).strip()
        product_code = str(row.get("product_code", "")).strip()
        quantity_str = str(row.get("quantity", "")).strip()

        # 空チェック
        if not location_code or not product_code or not quantity_str:
            errors.append(
                {
                    "row": row_num,
                    "reason": "location_code・product_code・quantityは必須です",
                }
            )
            continue

        # 数値チェック
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

        # 拠点チェック
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

        # 権限チェック
        if not _check_operator_access(current_user, location.id):
            errors.append(
                {
                    "row": row_num,
                    "reason": f"拠点 '{location_code}' へのアクセス権限がありません",
                }
            )
            continue

        # 商品チェック
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

        # 現在の在庫を取得
        inv = (
            db.query(Inventory)
            .filter(
                Inventory.location_id == location.id,
                Inventory.product_id == product.id,
            )
            .first()
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
    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str)
    except Exception:
        raise HTTPException(
            status_code=400, detail="CSVファイルの読み込みに失敗しました"
        )

    df.columns = df.columns.str.strip().str.lower()

    updated = 0
    try:
        for _, row in df.iterrows():
            location_code = str(row.get("location_code", "")).strip()
            product_code = str(row.get("product_code", "")).strip()
            quantity = int(str(row.get("quantity", "0")).strip())

            location = db.query(Location).filter(Location.code == location_code).first()
            product = db.query(Product).filter(Product.code == product_code).first()
            if not location or not product:
                continue
            if not _check_operator_access(current_user, location.id):
                continue

            inv = (
                db.query(Inventory)
                .filter(
                    Inventory.location_id == location.id,
                    Inventory.product_id == product.id,
                )
                .first()
            )
            if inv:
                inv.quantity = quantity
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
