# SCM_Beverage

飲料メーカー向け物流管理システム（Supply Chain Management）

## 概要

実務者・管理者の二層ロール構造を持つ物流管理システム。
在庫管理・発注指示・配送計画・マスタ管理・KPIモニタリングを一元化する。

## ステータス

現在：実装フェーズ（requirements v3 対応済み）

## 技術スタック

| 層 | 技術 |
|----|------|
| フロントエンド | Next.js (App Router), TypeScript, Tailwind CSS |
| バックエンド | FastAPI, SQLAlchemy, Alembic |
| データベース | PostgreSQL 15 |
| インフラ | Docker / Docker Compose |

## 主な機能

- **実務者（Operator）**: 在庫確認・発注作成・配送追跡・アラート対応・CSVアップロード
- **管理者（Admin）**: 拠点横断ダッシュボード・KPI閾値管理・シナリオ管理・ユーザー/マスタ管理
- 上流在庫参照（ATP: Available to Promise）
- アラートスヌーズ・優先度管理
- 安全在庫計算・発注テンプレート

## 起動方法

```bash
cp docker-compose.example.env backend/.env  # 環境変数を設定
docker compose up -d
```

- バックエンド API: http://localhost:8000
- API ドキュメント: http://localhost:8000/docs
- フロントエンド（開発）: `cd frontend && npm install && npm run dev` → http://localhost:3000

## ドキュメント

- `docs/requirements_v1.md` — 業務・システム要件定義書 v1.0
- `docs/requirements_v2.md` — 要件定義書 v2
- `docs/requirements_v3.md` — 要件定義書 v3（実務者UXレビュー版）
- `docs/gap_analysis_and_design.md` — ギャップ分析・設計メモ
- `docs/security_notes.md` — セキュリティ設計メモ
