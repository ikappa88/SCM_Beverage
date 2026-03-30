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
from app.models.kpi_threshold import KpiThreshold
from app.models.scenario import Scenario
from app.models.user import User


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


def create_kpi_thresholds(db):
    if db.query(KpiThreshold).count() > 0:
        print("KPI閾値データが既に存在します。スキップします。")
        return

    thresholds = [
        KpiThreshold(
            kpi_key="stockout_rate",
            label="欠品率",
            warning_value=5.0,
            danger_value=10.0,
            unit="%",
            description="全SKUのうち在庫ゼロとなった品目の割合。危険閾値超過時はアラートを発報する。",
        ),
        KpiThreshold(
            kpi_key="inventory_turnover",
            label="在庫回転率",
            warning_value=4.0,
            danger_value=2.0,
            unit="回/月",
            description="月次出荷量 ÷ 平均在庫量。低下すると過剰在庫・滞留リスクが高まる。",
        ),
        KpiThreshold(
            kpi_key="delivery_delay_rate",
            label="配送遅延率",
            warning_value=5.0,
            danger_value=15.0,
            unit="%",
            description="全配送のうち予定日を超過した件数の割合。",
        ),
        KpiThreshold(
            kpi_key="order_fulfillment_rate",
            label="発注充足率",
            warning_value=90.0,
            danger_value=80.0,
            unit="%",
            description="発注に対して期日通りに納品された数量の割合。低下時は供給力不足を示す。",
        ),
        KpiThreshold(
            kpi_key="safety_stock_coverage",
            label="安全在庫カバー率",
            warning_value=80.0,
            danger_value=60.0,
            unit="%",
            description="安全在庫水準を維持できているSKU数の割合。",
        ),
    ]
    for t in thresholds:
        db.add(t)
    db.commit()
    print(f"KPI閾値データを{len(thresholds)}件作成しました。")


def create_scenarios(db):
    if db.query(Scenario).count() > 0:
        print("シナリオデータが既に存在します。スキップします。")
        return

    # 管理者ユーザーIDを取得（作成者として設定）
    admin = db.query(User).filter(User.username == "admin").first()
    created_by = admin.id if admin else 1

    scenarios = [
        Scenario(
            code="SCN-BASE",
            name="基準シナリオ",
            description="現状の需要・コストを基準とした標準シナリオ。",
            demand_factor=1.00,
            cost_factor=1.00,
            is_active=True,
            created_by=created_by,
        ),
        Scenario(
            code="SCN-HI-DEM",
            name="需要増（+20%）シナリオ",
            description="夏季・キャンペーン期等の需要増加を想定。需要係数1.20。",
            demand_factor=1.20,
            cost_factor=1.00,
            is_active=True,
            created_by=created_by,
        ),
        Scenario(
            code="SCN-LO-DEM",
            name="需要減（-20%）シナリオ",
            description="オフシーズン・景気低迷期等の需要減退を想定。需要係数0.80。",
            demand_factor=0.80,
            cost_factor=1.00,
            is_active=True,
            created_by=created_by,
        ),
        Scenario(
            code="SCN-HI-COST",
            name="コスト増（+15%）シナリオ",
            description="燃料費・原材料費上昇等のコスト増加を想定。コスト係数1.15。",
            demand_factor=1.00,
            cost_factor=1.15,
            is_active=True,
            created_by=created_by,
        ),
        Scenario(
            code="SCN-STRESS",
            name="ストレステスト（需要増＋コスト増）",
            description="最悪ケースのシミュレーション用。需要1.30・コスト1.20。",
            demand_factor=1.30,
            cost_factor=1.20,
            is_active=True,
            created_by=created_by,
        ),
    ]
    for s in scenarios:
        db.add(s)
    db.commit()
    print(f"シナリオデータを{len(scenarios)}件作成しました。")


def main():
    db = SessionLocal()
    try:
        create_locations(db)
        create_products(db)
        create_routes(db)
        create_kpi_thresholds(db)
        create_scenarios(db)
        print("\n初期マスタデータの投入が完了しました。")
    except Exception as e:
        db.rollback()
        print(f"エラーが発生しました: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
