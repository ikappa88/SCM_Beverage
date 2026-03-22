from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate
from app.services.auth import get_current_user, require_administrator

router = APIRouter(prefix="/api/products", tags=["商品マスタ"])


@router.get("/", response_model=list[ProductResponse])
def list_products(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """商品一覧（全ロール参照可）"""
    return db.query(Product).all()


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """商品詳細（全ロール参照可）"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")
    return product


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """商品新規作成（管理者のみ）"""
    if db.query(Product).filter(Product.code == payload.code).first():
        raise HTTPException(
            status_code=400, detail="この商品コードはすでに使用されています"
        )
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """商品更新（管理者のみ）"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_product(
    product_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_administrator),
):
    """商品無効化・論理削除（管理者のみ）"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="商品が見つかりません")
    product.is_active = False
    db.commit()
