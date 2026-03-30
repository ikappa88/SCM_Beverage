"""
初期データ投入スクリプト
管理者・実務者のテストユーザーを作成する

実行方法:
  cd backend
  python scripts/init_data.py

注意: マスタデータ（locations）投入後に実行すること
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.location import Location
from app.models.user import User, UserRole


def create_initial_users():
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("ユーザーデータが既に存在します。スキップします。")
            return

        # 拠点IDを動的取得（init_master_data.py 実行済み前提）
        tc_tokyo = db.query(Location).filter(Location.code == "TC-01").first()
        tc_osaka = db.query(Location).filter(Location.code == "TC-02").first()

        tc_tokyo_id = str(tc_tokyo.id) if tc_tokyo else ""
        tc_osaka_id = str(tc_osaka.id) if tc_osaka else ""

        if not tc_tokyo_id or not tc_osaka_id:
            print("警告: 拠点データが見つかりません。先に init_master_data.py を実行してください。")

        users = [
            User(
                username="admin",
                email="admin@scm-beverage.local",
                full_name="システム管理者",
                hashed_password=get_password_hash("admin1234"),
                role=UserRole.ADMINISTRATOR,
                is_active=True,
            ),
            User(
                username="operator1",
                email="operator1@scm-beverage.local",
                full_name="田中 一郎（東京TC担当）",
                hashed_password=get_password_hash("operator1234"),
                role=UserRole.OPERATOR,
                is_active=True,
                assigned_location_ids=tc_tokyo_id,
                assigned_category_ids="cola,tea,sports",
            ),
            User(
                username="operator2",
                email="operator2@scm-beverage.local",
                full_name="鈴木 花子（大阪TC担当）",
                hashed_password=get_password_hash("operator1234"),
                role=UserRole.OPERATOR,
                is_active=True,
                assigned_location_ids=tc_osaka_id,
                assigned_category_ids="cola,tea,coffee",
            ),
        ]

        for user in users:
            db.add(user)
        db.commit()

        print("初期ユーザーを作成しました：")
        print("  管理者:  username=admin        password=admin1234")
        print(f"  実務者1: username=operator1    password=operator1234  assigned_location_ids={tc_tokyo_id}")
        print(f"  実務者2: username=operator2    password=operator1234  assigned_location_ids={tc_osaka_id}")

    except Exception as e:
        db.rollback()
        print(f"エラーが発生しました: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_initial_users()
