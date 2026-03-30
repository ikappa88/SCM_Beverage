# 機能ギャップ分析・追加機能設計書

**文書番号**: BevChain-DESIGN-001
**版数**: 1.0
**作成日**: 2026年3月29日
**ベース要件書**: BevChain-REQ-001 (requirements_v1.md)
**ステータス**: 設計案

---

## 目次

1. ギャップ分析サマリー
2. 未実装機能の設計仕様
   - 2.1 OP-02: アラート管理
   - 2.2 OP-04: 発注・補充指示
   - 2.3 OP-05: 配送計画確認・調整
   - 2.4 OP-06: 中期計画ビュー
   - 2.5 OP-08: 操作履歴確認（実務者）
   - 2.6 AD-05: 安全在庫設定（専用画面）
   - 2.7 AD-08: シナリオ管理
   - 2.8 AD-09: 変更履歴参照（専用ビュー）
   - 2.9 AD-10: テンプレート管理
   - 2.10 CM-03: 通知機能
3. 追加データモデル設計
4. 追加APIエンドポイント設計
5. フロントエンドページ設計
6. 実装優先度・フェーズ計画
7. マイグレーション計画

---

## 1. ギャップ分析サマリー

### 1.1 要件定義書との照合表

#### 実務者向け機能 (5.1)

| 機能ID | 機能名 | 実装状況 | 不足内容 |
|--------|--------|----------|----------|
| OP-01 | ダッシュボード（実務者） | ▲ 部分実装 | フロー状況（工場→DC→TC→小売の輸送中数量）が未表示。アラートは在庫API頼み |
| OP-02 | アラート管理 | ▲ 部分実装 | アラートの対応ステータス管理（未対応/対応中/完了）が未実装。アラートは計算値のみで永続化されていない |
| OP-03 | 在庫照会・修正 | ✅ 実装済 | — |
| OP-04 | 発注・補充指示 | ❌ 未実装 | 発注モデル・API・画面すべて未実装 |
| OP-05 | 配送計画確認・調整 | ❌ 未実装 | 配送記録モデル・API・画面すべて未実装 |
| OP-06 | 中期計画ビュー | ❌ 未実装 | 1〜4週間先の計画表示が未実装 |
| OP-07 | データアップロード | ✅ 実装済 | — |
| OP-08 | 操作履歴確認 | ▲ 部分実装 | 監査ログAPIは管理者のみ参照可能。実務者が自身の履歴を見る機能が未実装 |

#### 管理者向け機能 (5.2)

| 機能ID | 機能名 | 実装状況 | 不足内容 |
|--------|--------|----------|----------|
| AD-01 | ダッシュボード（管理者） | ▲ 部分実装 | KPI集計（欠品率・在庫回転率等）のビジュアライズが未実装 |
| AD-02 | 拠点マスタ管理 | ✅ 実装済 | — |
| AD-03 | 商品マスタ管理 | ✅ 実装済 | — |
| AD-04 | ルートマスタ管理 | ✅ 実装済 | — |
| AD-05 | 安全在庫設定 | ▲ 部分実装 | 安全在庫はInventoryモデルに含まれるが、拠点×商品ごとの一括設定専用画面がない |
| AD-06 | ユーザー管理 | ✅ 実装済 | — |
| AD-07 | KPI閾値設定 | ✅ 実装済 | — |
| AD-08 | シナリオ管理 | ❌ 未実装 | シナリオモデル・API・画面すべて未実装 |
| AD-09 | 変更履歴参照 | ▲ 部分実装 | 監査ログとして記録はあるが、マスタ変更に特化したビューがない。変更前後の値比較画面が未実装 |
| AD-10 | テンプレート管理 | ❌ 未実装 | CSVテンプレートの配布・バージョン管理機能が未実装 |

#### 共通機能 (5.3)

| 機能ID | 機能名 | 実装状況 | 不足内容 |
|--------|--------|----------|----------|
| CM-01 | 認証・ログイン | ✅ 実装済 | — |
| CM-02 | 権限制御 | ✅ 実装済 | — |
| CM-03 | 通知機能 | ❌ 未実装 | 画面内通知（アラート・承認待ち等）が未実装 |
| CM-04 | 監査ログ | ✅ 実装済 | — |
| CM-05 | レスポンシブ対応 | ▲ 部分実装 | Tailwind CSS使用だが、モバイル専用レイアウト調整が未実施 |

### 1.2 未実装データモデル

要件定義書 §7.2（トランザクションデータ）で要求されているが未実装のモデル：

| モデル名 | 対応要件 | 概要 |
|---------|----------|------|
| Order（発注データ） | OP-04, §7.2 | 発注元・先拠点、商品、数量、ステータス管理 |
| DeliveryRecord（配送実績データ） | OP-05, §7.2 | 輸送中数量・到着予定・実到着日時 |
| Alert（アラートログ） | OP-02, §7.2 | 発生したアラートの永続化・対応ステータス管理 |
| Scenario（シナリオマスタ） | AD-08, §7.1 | シミュレーションシナリオ（需要係数・コスト係数） |

---

## 2. 未実装機能の設計仕様

### 2.1 OP-02: アラート管理

#### 概要
現状のアラートはAPIリクエスト時に在庫データから動的計算されるのみで、発生記録・対応状況の追跡ができない。アラートを永続化し、実務者が対応ステータスを管理できる機能を追加する。

#### データモデル: `alerts` テーブル

```
id              INTEGER PRIMARY KEY
alert_type      ENUM('STOCKOUT', 'LOW_STOCK', 'OVERSTOCK', 'DELAY', 'CUSTOM')
severity        ENUM('WARNING', 'DANGER')
location_id     INTEGER FK → locations.id
product_id      INTEGER FK → products.id (nullable)
title           VARCHAR(200)
message         TEXT
status          ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED')  DEFAULT 'OPEN'
resolved_by     INTEGER FK → users.id (nullable)
resolved_at     TIMESTAMP (nullable)
auto_generated  BOOLEAN DEFAULT TRUE
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### APIエンドポイント

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /api/alerts/ | アラート一覧（status/severity/location_idでフィルタ） | 実務者（担当拠点のみ）、管理者（全件） |
| GET | /api/alerts/{alert_id} | アラート詳細 | 同上 |
| PATCH | /api/alerts/{alert_id}/status | 対応ステータス更新 | 実務者（担当拠点のみ）、管理者 |
| POST | /api/alerts/generate | 現在の在庫状況からアラートを一括生成（バックグラウンドジョブ想定） | 管理者のみ |

#### フロントエンドページ

- **実務者**: `/operator/alerts`
  - アラート一覧テーブル（severity別バッジ、status別フィルタ）
  - 各アラートの対応ステータス更新ボタン（IN_PROGRESS → RESOLVED）
  - 未対応件数をダッシュボードのバッジに表示

#### 設計上の注意
- アラート生成は定期的なバックグラウンド処理（APSchedulerまたはCelery）で実行する想定
- MVP段階では `/api/alerts/generate` を管理者が手動実行する形でもよい
- KpiThresholdモデルの閾値と連携して発火条件を判定する

---

### 2.2 OP-04: 発注・補充指示

#### 概要
実務者が担当拠点の在庫補充を発注できる機能。2ステップ確認（プレビュー→確定）を必須とする。

#### データモデル: `orders` テーブル

```
id              INTEGER PRIMARY KEY
order_code      VARCHAR(20) UNIQUE  (例: ORD-20260329-001)
order_type      ENUM('REPLENISHMENT', 'TRANSFER', 'EMERGENCY')
from_location_id  INTEGER FK → locations.id (補充元)
to_location_id    INTEGER FK → locations.id (補充先)
product_id      INTEGER FK → products.id
quantity        INTEGER NOT NULL CHECK (quantity > 0)
unit_price      DECIMAL(10,2) nullable
status          ENUM('DRAFT', 'CONFIRMED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED') DEFAULT 'DRAFT'
requested_date  DATE NOT NULL
expected_delivery_date DATE
actual_delivery_date   DATE nullable
note            TEXT nullable
created_by      INTEGER FK → users.id
updated_by      INTEGER FK → users.id nullable
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### APIエンドポイント

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /api/orders/ | 発注一覧（to_location_id/status/product_idでフィルタ） | 実務者（担当拠点）、管理者（全件） |
| GET | /api/orders/{order_id} | 発注詳細 | 同上 |
| POST | /api/orders/preview | 発注プレビュー（バリデーションのみ、DBには保存しない） | 実務者（担当拠点）、管理者 |
| POST | /api/orders/ | 発注確定（status=CONFIRMED） | 実務者（担当拠点）、管理者 |
| PATCH | /api/orders/{order_id}/status | ステータス更新（IN_TRANSIT/DELIVERED/CANCELLED） | 実務者（担当拠点）、管理者 |
| DELETE | /api/orders/{order_id} | 発注キャンセル（DRAFT状態のみ） | 実務者（担当拠点）、管理者 |

#### フロントエンドページ

- **実務者**: `/operator/orders`
  - 発注一覧（status別タブ: 処理中/完了/キャンセル）
  - 新規発注ボタン → 発注入力フォーム（商品・数量・希望納期）
  - **2ステップ確認**: 入力 → プレビュー（発注内容サマリー表示）→ 確定
  - ステータス更新（入荷確認）ボタン

#### ビジネスロジック
- DRAFT状態の発注はキャンセル可能
- CONFIRMED以降のキャンセルは管理者のみ可能
- 最小発注単位（`products.min_order_qty`）のバリデーションを実施
- 発注確定時に監査ログ記録（action='ORDER_CREATED'）

---

### 2.3 OP-05: 配送計画確認・調整

#### 概要
OrderをベースにDeliveryRecordを生成し、輸送中の状況を可視化する。到着予定・実到着・遅延状況を管理する。

#### データモデル: `delivery_records` テーブル

```
id              INTEGER PRIMARY KEY
delivery_code   VARCHAR(20) UNIQUE  (例: DLV-20260329-001)
order_id        INTEGER FK → orders.id nullable (手動作成の場合はNULL可)
route_id        INTEGER FK → routes.id
from_location_id  INTEGER FK → locations.id
to_location_id    INTEGER FK → locations.id
product_id      INTEGER FK → products.id
quantity        INTEGER NOT NULL
status          ENUM('SCHEDULED', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'DELAYED', 'CANCELLED')
scheduled_departure_date  DATE
actual_departure_date     DATE nullable
expected_arrival_date     DATE
actual_arrival_date       DATE nullable
delay_reason    TEXT nullable
note            TEXT nullable
created_by      INTEGER FK → users.id
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### APIエンドポイント

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /api/deliveries/ | 配送一覧（location_id/status/date rangeでフィルタ） | 実務者（担当拠点）、管理者（全件） |
| GET | /api/deliveries/{delivery_id} | 配送詳細 | 同上 |
| POST | /api/deliveries/ | 配送記録作成 | 実務者（担当拠点）、管理者 |
| PATCH | /api/deliveries/{delivery_id}/status | ステータス更新（出発/到着確認等） | 同上 |

#### フロントエンドページ

- **実務者**: `/operator/delivery`
  - カレンダービュー or タイムライン表示（週単位）
  - 輸送中一覧（遅延フラグを赤バッジで表示）
  - 到着確認ボタン（status=ARRIVEDに更新し、在庫数量を自動加算するオプション）
  - 遅延マーク付与と遅延理由入力

---

### 2.4 OP-06: 中期計画ビュー

#### 概要
1〜4週間先の需要予測・発注計画・配送スケジュールを一覧で確認できるビュー。このフェーズでは「計画の確認」に限定し、自動需要予測は将来対応とする。

#### 実装方針
- 新規モデル不要（Order・DeliveryRecordデータを集計して表示）
- 週単位グリッド表示（行: 商品、列: 週）
- 各セルに予定発注数・予定入荷数・推定在庫を表示

#### フロントエンドページ

- **実務者**: `/operator/planning`
  - 週別計画グリッド（Tailwind Table）
  - 表示期間切り替え（1週/2週/4週）
  - 在庫水準が安全在庫を下回る週をハイライト表示

---

### 2.5 OP-08: 操作履歴確認（実務者）

#### 概要
監査ログAPIを実務者が自身の操作履歴を参照できるよう拡張する。

#### 実装変更

**backend/app/api/audit_log.py の変更:**
```python
# 現状: 管理者のみ参照可能
# 変更: 実務者はuser_id=current_user.idのみ参照可能（フィルタ強制）
```

#### APIエンドポイント変更

| メソッド | パス | 変更内容 |
|---------|------|----------|
| GET | /api/audit-logs/ | 実務者が呼び出した場合、自動的にuser_id=自分のIDでフィルタ |
| GET | /api/audit-logs/me | 新規追加。実務者向けの自己履歴取得ショートカット |

#### フロントエンドページ

- **実務者**: `/operator/history`
  - 自身の操作履歴一覧（日時・操作種別・対象データ）
  - 日付範囲フィルタ
  - AdminLayoutの監査ログ画面からUIを流用して実装

---

### 2.6 AD-05: 安全在庫設定（専用画面）

#### 概要
現状、安全在庫はInventoryレコードのフィールドとして存在するが、管理者が拠点×商品の組み合わせを一覧で確認・一括設定できる専用画面がない。

#### APIエンドポイント追加

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /api/inventory/safety-stocks | 全拠点×商品の安全在庫一覧 | 管理者のみ |
| PATCH | /api/inventory/{inventory_id}/safety-stock | 安全在庫・最大在庫を個別更新 | 管理者のみ |
| POST | /api/inventory/safety-stocks/bulk | CSV形式で安全在庫を一括更新 | 管理者のみ |

#### フロントエンドページ

- **管理者**: `/admin/safety-stock`
  - 拠点×商品のマトリクステーブル
  - インライン編集（安全在庫量・最大在庫量を直接入力）
  - 保存ボタンで一括更新（確認ダイアログあり）

---

### 2.7 AD-08: シナリオ管理

#### 概要
需要変動シナリオをマスタとして登録し、シミュレーション時に適用できる機能。

#### データモデル: `scenarios` テーブル

```
id              INTEGER PRIMARY KEY
code            VARCHAR(20) UNIQUE
name            VARCHAR(100)
description     TEXT nullable
demand_factor   DECIMAL(4,2)  (例: 1.20 = 需要20%増)
cost_factor     DECIMAL(4,2)  (例: 0.90 = コスト10%減)
is_active       BOOLEAN DEFAULT TRUE
created_by      INTEGER FK → users.id
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

#### APIエンドポイント

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /api/scenarios/ | シナリオ一覧 | 実務者（参照のみ）、管理者 |
| POST | /api/scenarios/ | シナリオ作成 | 管理者のみ |
| PATCH | /api/scenarios/{scenario_id} | シナリオ更新 | 管理者のみ |
| DELETE | /api/scenarios/{scenario_id} | シナリオ無効化（論理削除） | 管理者のみ |

#### フロントエンドページ

- **管理者**: `/admin/scenarios`
  - シナリオ一覧テーブル（需要係数・コスト係数表示）
  - 登録・編集・無効化フォーム
  - 実務者の計画ビューからシナリオを選択して計画値を調整する機能は将来対応

---

### 2.8 AD-09: 変更履歴参照（専用ビュー）

#### 概要
監査ログのうち、マスタデータ変更（locations/products/routes/users）に絞った変更履歴ビューを管理者向けに提供する。変更前後の値をJSONで比較できる画面を追加する。

#### 実装方針
- 新規モデル不要（AuditLogを活用）
- AuditLog.detailフィールドに変更前後のJSON（`{"before": {...}, "after": {...}}`）を格納するよう記録仕様を改善
- マスタ管理各ページに「変更履歴」タブまたはリンクを追加

#### フロントエンドページ

- **管理者**: 既存マスタページ（/admin/master/locations 等）に「変更履歴」サイドパネルを追加
  - 対象レコードの変更履歴一覧
  - Before/After差分表示（変更フィールドをハイライト）

---

### 2.9 AD-10: テンプレート管理

#### 概要
CSVアップロード用テンプレートファイルをサーバーサイドで管理し、最新版をダウンロードできる機能。

#### 実装方針
- テンプレートファイルは `backend/static/templates/` に配置
- バージョン情報を静的JSON（`template_versions.json`）で管理

#### APIエンドポイント

| メソッド | パス | 説明 | 権限 |
|---------|------|------|------|
| GET | /api/templates/ | テンプレート一覧（名前・バージョン・最終更新日） | 全ユーザー |
| GET | /api/templates/{template_id}/download | テンプレートファイルダウンロード | 全ユーザー |
| PUT | /api/templates/{template_id} | テンプレートファイル更新（multipart） | 管理者のみ |

#### フロントエンドページ

- **実務者アップロードページ** (`/operator/upload`) にテンプレートダウンロードリンクを追加
- **管理者**: `/admin/templates`
  - テンプレート一覧・バージョン表示
  - 新バージョンのアップロードフォーム

---

### 2.10 CM-03: 通知機能

#### 概要
アラート発生・発注ステータス変更・処理完了などを画面上のバッジ/トースト通知で知らせる機能。

#### 実装方針（段階的アプローチ）

**Phase 1 (MVP)**: APIポーリング方式
- 既存の `/api/alerts/` と `/api/orders/` をフロントエンドが定期ポーリング（30秒間隔）
- 未対応アラート数をナビゲーションバーのベルアイコンにバッジ表示
- 新着件数変化時にトースト表示

**Phase 2 (将来対応)**: WebSocket / SSE方式
- リアルタイムプッシュ通知
- 要件定義書 §6.1「最大5分以内の更新反映」に対応

#### フロントエンド実装

- `AdminLayout.tsx` / `OperatorLayout.tsx` にNotificationBellコンポーネントを追加
- `frontend/components/common/NotificationBell.tsx` として共通化
- `frontend/components/common/Toast.tsx` としてトースト通知コンポーネント追加

---

## 3. 追加データモデル設計

### 3.1 モデル一覧

```
backend/app/models/
├── alert.py          # NEW: アラートログ
├── order.py          # NEW: 発注データ
├── delivery_record.py # NEW: 配送実績データ
└── scenario.py        # NEW: シナリオマスタ
```

### 3.2 ERDの主要リレーション（追加分）

```
Location ←──── Alert ────→ Product
Location ←──── Order ────→ Product
Route    ←──── DeliveryRecord ────→ Order
User     ←──── Order (created_by)
User     ←──── Alert (resolved_by)
```

### 3.3 マイグレーション番号計画

| マイグレーション番号 | 内容 |
|-------------------|------|
| 006 | `alerts` テーブル作成 |
| 007 | `orders` テーブル作成 |
| 008 | `delivery_records` テーブル作成 |
| 009 | `scenarios` テーブル作成 |

---

## 4. 追加APIエンドポイント設計

### 4.1 新規ルーターファイル

```
backend/app/api/
├── alerts.py         # NEW: GET/PATCH
├── orders.py         # NEW: GET/POST/PATCH/DELETE
├── deliveries.py     # NEW: GET/POST/PATCH
└── scenarios.py      # NEW: GET/POST/PATCH/DELETE
```

### 4.2 既存ファイルの変更

| ファイル | 変更内容 |
|---------|----------|
| `audit_log.py` | 実務者の自己参照を許可（/me エンドポイント追加） |
| `inventory.py` | 安全在庫設定専用エンドポイント追加 |
| `main.py` | 新規ルーターの登録 |

---

## 5. フロントエンドページ設計

### 5.1 新規ページ一覧

```
frontend/app/
├── operator/
│   ├── alerts/page.tsx      # NEW: OP-02 アラート管理
│   ├── orders/page.tsx      # NEW: OP-04 発注・補充指示
│   ├── delivery/page.tsx    # NEW: OP-05 配送計画確認
│   ├── planning/page.tsx    # NEW: OP-06 中期計画ビュー
│   └── history/page.tsx     # NEW: OP-08 操作履歴確認
└── admin/
    ├── safety-stock/page.tsx  # NEW: AD-05 安全在庫設定
    ├── scenarios/page.tsx     # NEW: AD-08 シナリオ管理
    └── templates/page.tsx     # NEW: AD-10 テンプレート管理
```

### 5.2 新規共通コンポーネント

```
frontend/components/
└── common/
    ├── NotificationBell.tsx  # NEW: CM-03 通知ベル
    ├── Toast.tsx             # NEW: CM-03 トースト通知
    └── StatusBadge.tsx       # NEW: ステータスバッジ共通化
```

### 5.3 ナビゲーション追加

**OperatorLayout.tsx に追加するナビゲーション項目:**
- アラート管理 (`/operator/alerts`)
- 発注・補充指示 (`/operator/orders`)
- 配送管理 (`/operator/delivery`)
- 計画ビュー (`/operator/planning`)
- 操作履歴 (`/operator/history`)

**AdminLayout.tsx に追加するナビゲーション項目:**
- 安全在庫設定 (`/admin/safety-stock`)
- シナリオ管理 (`/admin/scenarios`)
- テンプレート管理 (`/admin/templates`)

---

## 6. 実装優先度・フェーズ計画

### Phase 1 — コア業務フロー完成（最優先）

| # | 機能 | 工数見積 | 理由 |
|---|------|----------|------|
| 1 | OP-04 発注・補充指示 | M（中） | 物流業務の中心機能。発注なしでは在庫補充が画面上で完結しない |
| 2 | OP-05 配送計画確認 | M（中） | 発注と連動する配送追跡が必須。OP-04後に実装 |
| 3 | OP-02 アラート管理 | S（小） | 現状の動的計算から永続化・ステータス管理へ移行 |
| 4 | OP-08 操作履歴（実務者） | XS（極小） | 既存audit_log APIの権限変更のみ |

### Phase 2 — 管理機能・利便性向上

| # | 機能 | 工数見積 | 理由 |
|---|------|----------|------|
| 5 | AD-05 安全在庫設定専用画面 | S（小） | 既存データモデルの活用。設定作業の効率化 |
| 6 | AD-09 変更履歴専用ビュー | S（小） | 既存AuditLogの活用。管理者の変更管理に必要 |
| 7 | CM-03 通知機能（ポーリング方式） | M（中） | UX向上。ポーリング方式でMVP実装 |

### Phase 3 — 拡張機能

| # | 機能 | 工数見積 | 理由 |
|---|------|----------|------|
| 8 | OP-06 中期計画ビュー | M（中） | OP-04/05のデータが蓄積後に意味を持つ |
| 9 | AD-08 シナリオ管理 | M（中） | マスタデータとして整備。実活用は別途 |
| 10 | AD-10 テンプレート管理 | S（小） | 運用フェーズで重要 |

---

## 7. マイグレーション計画

### 7.1 現状のマイグレーション構成

```
alembic/versions/
├── 001_create_users.py
├── 002_create_locations.py
├── 003_create_products_routes_inventory.py
├── 004_create_audit_logs.py
└── 005_create_kpi_thresholds.py
```

### 7.2 追加マイグレーション計画

```
alembic/versions/
├── 006_create_alerts.py          # Phase 1
├── 007_create_orders.py          # Phase 1
├── 008_create_delivery_records.py # Phase 1
└── 009_create_scenarios.py       # Phase 3
```

### 7.3 既存マイグレーションへの影響

- 既存テーブルへの**カラム追加は不要**（今回の追加機能は新テーブルで完結）
- ただし、`audit_logs.detail` フィールドを `TEXT` から `JSONB` に変更することを推奨
  （AD-09の変更前後比較を実装する際に検討）

---

## 改訂履歴

| 版数 | 日付 | 変更内容 | 作成者 |
|------|------|----------|--------|
| 1.0 | 2026/03/29 | 初版作成（ギャップ分析・追加機能設計） | Claude Code |

---

*本文書はBevChain-REQ-001に基づくギャップ分析の結果であり、実装着手前に関係者の承認を得ること。*
