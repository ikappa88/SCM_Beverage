"""
初期データ投入スクリプト
管理者・実務者のテストユーザーを作成する

実行方法:
  cd backend
  python scripts/init_data.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole


def create_initial_users():
    db = SessionLocal()
    try:
        # 既存チェック
        if db.query(User).count() > 0:
            print("ユーザーデータが既に存在します。スキップします。")
            return

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
                assigned_location_ids="tc_tokyo",
                assigned_category_ids="cola,tea,sports",
            ),
            User(
                username="operator2",
                email="operator2@scm-beverage.local",
                full_name="鈴木 花子（大阪TC担当）",
                hashed_password=get_password_hash("operator1234"),
                role=UserRole.OPERATOR,
                is_active=True,
                assigned_location_ids="tc_osaka",
                assigned_category_ids="cola,tea,coffee",
            ),
        ]

        for user in users:
            db.add(user)
        db.commit()

        print("初期ユーザーを作成しました：")
        print("  管理者:  username=admin        password=admin1234")
        print("  実務者1: username=operator1    password=operator1234")
        print("  実務者2: username=operator2    password=operator1234")

    except Exception as e:
        db.rollback()
        print(f"エラーが発生しました: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_initial_users()
