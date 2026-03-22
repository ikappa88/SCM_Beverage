"""
マスタ初期データ投入スクリプト
拠点・商品・ルートの初期データを作成する

実行方法:
  cd backend
  python scripts/init_master_data.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.location import Location, LocationType
from app.models.product import Product
from app.models.route import Route


def create_locations(db):
    if db.query(Location).count() > 0:
        print("拠点データが既に存在します。スキップします。")
        return

    locations = [
        Location(
            code="FAC-01",
            name="東京工場",
            location_type=LocationType.FACTORY,
            area="関東",
            address="東京都江東区",
            capacity=50000,
        ),
        Location(
            code="FAC-02",
            name="大阪工場",
            location_type=LocationType.FACTORY,
            area="関西",
            address="大阪府堺市",
            capacity=40000,
        ),
        Location(
            code="DC-01",
            name="広域DC（東日本）",
            location_type=LocationType.DC,
            area="東日本",
            address="埼玉県川口市",
            capacity=30000,
        ),
        Location(
            code="DC-02",
            name="広域DC（西日本）",
            location_type=LocationType.DC,
            area="西日本",
            address="大阪府摂津市",
            capacity=25000,
        ),
        Location(
            code="TC-01",
            name="地域TC（東京）",
            location_type=LocationType.TC,
            area="東京都",
            address="東京都足立区",
            capacity=10000,
        ),
        Location(
            code="TC-02",
            name="地域TC（大阪）",
            location_type=LocationType.TC,
            area="大阪府",
            address="大阪府大阪市",
            capacity=8000,
        ),
        Location(
            code="TC-03",
            name="地域TC（名古屋）",
            location_type=LocationType.TC,
            area="愛知県",
            address="愛知県名古屋市",
            capacity=6000,
        ),
        Location(
            code="RT-01",
            name="スーパー（関東）",
            location_type=LocationType.RETAIL,
            area="関東",
            capacity=2000,
        ),
        Location(
            code="RT-02",
            name="CVS（関東）",
            location_type=LocationType.RETAIL,
            area="関東",
            capacity=1000,
        ),
        Location(
            code="RT-03",
            name="自販機・外食（中部）",
            location_type=LocationType.RETAIL,
            area="中部",
            capacity=1500,
        ),
    ]
    for loc in locations:
        db.add(loc)
    db.commit()
    print(f"拠点データを{len(locations)}件作成しました。")


def create_products(db):
    if db.query(Product).count() > 0:
        print("商品データが既に存在します。スキップします。")
        return

    products = [
        Product(
            code="PRD-001",
            name="コーラ 500ml",
            category="cola",
            unit_size="500ml",
            min_order_qty=24,
            weight_kg=0.5,
        ),
        Product(
            code="PRD-002",
            name="コーラ 1.5L",
            category="cola",
            unit_size="1500ml",
            min_order_qty=8,
            weight_kg=1.5,
        ),
        Product(
            code="PRD-003",
            name="緑茶 500ml",
            category="tea",
            unit_size="500ml",
            min_order_qty=24,
            weight_kg=0.5,
        ),
        Product(
            code="PRD-004",
            name="麦茶 2L",
            category="tea",
            unit_size="2000ml",
            min_order_qty=6,
            weight_kg=2.0,
        ),
        Product(
            code="PRD-005",
            name="スポーツドリンク 500ml",
            category="sports",
            unit_size="500ml",
            min_order_qty=24,
            weight_kg=0.5,
        ),
        Product(
            code="PRD-006",
            name="缶コーヒー 185g",
            category="coffee",
            unit_size="185ml",
            min_order_qty=30,
            weight_kg=0.2,
        ),
        Product(
            code="PRD-007",
            name="缶コーヒー 275ml",
            category="coffee",
            unit_size="275ml",
            min_order_qty=24,
            weight_kg=0.3,
        ),
    ]
    for prod in products:
        db.add(prod)
    db.commit()
    print(f"商品データを{len(products)}件作成しました。")


def create_routes(db):
    if db.query(Route).count() > 0:
        print("ルートデータが既に存在します。スキップします。")
        return

    # 拠点コード→IDのマッピング
    loc_map = {loc.code: loc.id for loc in db.query(Location).all()}

    routes = [
        Route(
            code="RT-F1-DC1",
            origin_id=loc_map["FAC-01"],
            destination_id=loc_map["DC-01"],
            lead_time_days=1,
            cost_per_unit=50.0,
        ),
        Route(
            code="RT-F1-DC2",
            origin_id=loc_map["FAC-01"],
            destination_id=loc_map["DC-02"],
            lead_time_days=2,
            cost_per_unit=80.0,
        ),
        Route(
            code="RT-F2-DC1",
            origin_id=loc_map["FAC-02"],
            destination_id=loc_map["DC-01"],
            lead_time_days=2,
            cost_per_unit=80.0,
        ),
        Route(
            code="RT-F2-DC2",
            origin_id=loc_map["FAC-02"],
            destination_id=loc_map["DC-02"],
            lead_time_days=1,
            cost_per_unit=50.0,
        ),
        Route(
            code="RT-DC1-TC1",
            origin_id=loc_map["DC-01"],
            destination_id=loc_map["TC-01"],
            lead_time_days=1,
            cost_per_unit=30.0,
        ),
        Route(
            code="RT-DC1-TC3",
            origin_id=loc_map["DC-01"],
            destination_id=loc_map["TC-03"],
            lead_time_days=1,
            cost_per_unit=40.0,
        ),
        Route(
            code="RT-DC2-TC2",
            origin_id=loc_map["DC-02"],
            destination_id=loc_map["TC-02"],
            lead_time_days=1,
            cost_per_unit=30.0,
        ),
        Route(
            code="RT-TC1-RT1",
            origin_id=loc_map["TC-01"],
            destination_id=loc_map["RT-01"],
            lead_time_days=1,
            cost_per_unit=20.0,
        ),
        Route(
            code="RT-TC1-RT2",
            origin_id=loc_map["TC-01"],
            destination_id=loc_map["RT-02"],
            lead_time_days=1,
            cost_per_unit=15.0,
        ),
        Route(
            code="RT-TC3-RT3",
            origin_id=loc_map["TC-03"],
            destination_id=loc_map["RT-03"],
            lead_time_days=1,
            cost_per_unit=18.0,
        ),
    ]
    for route in routes:
        db.add(route)
    db.commit()
    print(f"ルートデータを{len(routes)}件作成しました。")


def main():
    db = SessionLocal()
    try:
        create_locations(db)
        create_products(db)
        create_routes(db)
        print("\n初期マスタデータの投入が完了しました。")
    except Exception as e:
        db.rollback()
        print(f"エラーが発生しました: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
