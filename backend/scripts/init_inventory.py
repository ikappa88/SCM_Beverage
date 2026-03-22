"""
在庫初期データ投入スクリプト

実行方法:
  cd backend
  python scripts/init_inventory.py
"""

import sys, os, random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.inventory import Inventory
from app.models.location import Location, LocationType
from app.models.product import Product

SAFETY_STOCK_MAP = {
    LocationType.FACTORY: 1000,
    LocationType.DC: 500,
    LocationType.TC: 200,
    LocationType.RETAIL: 50,
}
MAX_STOCK_MAP = {
    LocationType.FACTORY: 5000,
    LocationType.DC: 3000,
    LocationType.TC: 1000,
    LocationType.RETAIL: 300,
}


def main():
    db = SessionLocal()
    try:
        if db.query(Inventory).count() > 0:
            print("在庫データが既に存在します。スキップします。")
            return

        locations = db.query(Location).filter(Location.is_active == True).all()
        products = db.query(Product).filter(Product.is_active == True).all()

        count = 0
        for loc in locations:
            safety = SAFETY_STOCK_MAP.get(loc.location_type, 100)
            max_s = MAX_STOCK_MAP.get(loc.location_type, 1000)
            for prod in products:
                qty = random.randint(int(safety * 0.5), max_s)
                inv = Inventory(
                    location_id=loc.id,
                    product_id=prod.id,
                    quantity=qty,
                    safety_stock=safety,
                    max_stock=max_s,
                )
                db.add(inv)
                count += 1

        db.commit()
        print(f"在庫データを{count}件作成しました。")

    except Exception as e:
        db.rollback()
        print(f"エラー: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
