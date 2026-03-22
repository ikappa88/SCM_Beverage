# SCM_Beverage

飲料メーカー向け物流管理システム（Supply Chain Management）

## 概要

実務者・管理者の二層ロール構造を持つ物流管理システム。
在庫管理・発注指示・配送計画・マスタ管理を一元化する。

## 主な機能

### 実務者向け
- ダッシュボード（在庫状況・アラート・拠点別在庫）
- 在庫照会・在庫修正（2ステップ確認）
- CSVによる在庫データ一括アップロード

### 管理者向け
- 拠点・商品・ルートマスタ管理
- ユーザー管理（ロール・担当範囲設定）
- 監査ログ閲覧
- KPI閾値設定

## 技術スタック

| レイヤー | 技術 |
|--------|------|
| フロントエンド | Next.js 16 / TypeScript / Tailwind CSS |
| バックエンド | FastAPI / Python 3.14 |
| データベース | PostgreSQL 15 |
| 開発環境 | Docker / docker-compose |

## セットアップ

### 前提条件
- Docker Desktop
- Python 3.11以上
- Node.js 18以上

### 1. DBの起動
```bash
docker compose up -d db
```

### 2. バックエンドのセットアップ
```bash
cd backend
pip install -r requirements.txt --only-binary=:all:
alembic upgrade head
python scripts/init_data.py
python scripts/init_master_data.py
python scripts/init_inventory.py
```

### 3. バックエンドの起動
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 4. フロントエンドの起動
```bash
cd frontend
npm install
npm run dev
```

### 5. アクセス

- フロントエンド: http://localhost:3000
- API ドキュメント: http://localhost:8000/docs

## テストアカウント

| ユーザー名 | パスワード | ロール | 担当拠点 |
|-----------|-----------|--------|---------|
| admin | admin1234 | 管理者 | 全拠点 |
| operator1 | operator1234 | 実務者 | 地域TC（東京） |
| operator2 | operator1234 | 実務者 | 地域TC（大阪） |

## ブランチ戦略
```
main      本番リリース済み
develop   開発統合ブランチ
feature/* 機能開発ブランチ
```

## ドキュメント

- `docs/requirements_v1.md` - 業務・システム要件定義書 v1.0
- `docs/tech_stack.md` - 技術スタック定義
