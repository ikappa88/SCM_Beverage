"""
Parameter service: read/write simulation parameters from DB.

Parameters are stored in simulation_parameters table as (category, key, value: JSONB).
A flattened dict {"{category}.{key}": value} is used internally.
"""

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.simulation import SimulationParameter

# ---------------------------------------------------------------------------
# Default parameter seed data
# ---------------------------------------------------------------------------

DEFAULT_PARAMETERS: list[dict[str, Any]] = [
    # --- demand ---
    {
        "category": "demand",
        "key": "weekday_coefficients",
        "value": [0.9, 0.9, 1.0, 1.0, 1.1, 1.3, 1.2],
        "description": "曜日係数 [月, 火, 水, 木, 金, 土, 日]",
    },
    {
        "category": "demand",
        "key": "season_coefficients",
        "value": [0.7, 0.7, 0.9, 1.0, 1.1, 1.2, 1.5, 1.6, 1.2, 1.0, 0.8, 0.8],
        "description": "季節係数 [1月〜12月]",
    },
    {
        "category": "demand",
        "key": "temperature_coefficients",
        "value": {
            "1_AM": 0.8, "1_PM": 0.8,
            "2_AM": 0.8, "2_PM": 0.8,
            "3_AM": 0.9, "3_PM": 1.0,
            "4_AM": 0.9, "4_PM": 1.0,
            "5_AM": 1.0, "5_PM": 1.2,
            "6_AM": 1.0, "6_PM": 1.2,
            "7_AM": 1.1, "7_PM": 1.5,
            "8_AM": 1.1, "8_PM": 1.5,
            "9_AM": 1.0, "9_PM": 1.2,
            "10_AM": 0.9, "10_PM": 1.0,
            "11_AM": 0.9, "11_PM": 0.9,
            "12_AM": 0.8, "12_PM": 0.8,
        },
        "description": "気温需要係数（月別AM/PM）。気象庁東京月別平均気温を参考に設定",
    },
    {
        "category": "demand",
        "key": "noise_range_percent",
        "value": 20.0,
        "description": "需要ランダムノイズ範囲（±%）",
    },
    # --- delivery ---
    {
        "category": "delivery",
        "key": "default_lead_time_half_days",
        "value": 4,
        "description": "デフォルトリードタイム（半日単位）",
    },
    {
        "category": "delivery",
        "key": "lead_time_jitter_half_days",
        "value": {"min": -1, "max": 2},
        "description": "リードタイムゆらぎ範囲（半日）",
    },
    {
        "category": "delivery",
        "key": "weekend_extra_half_days",
        "value": 2,
        "description": "週末を跨ぐ配送への追加遅延（半日）",
    },
    # --- stock ---
    {
        "category": "stock",
        "key": "expiry_warning_days",
        "value": 30,
        "description": "賞味期限警告を出す残日数",
    },
    # --- clock ---
    {
        "category": "clock",
        "key": "rng_seed",
        "value": None,
        "description": "需要計算のRNGシード（null=毎回ランダム、整数=再現固定）",
    },
]


def seed_default_parameters(db: Session) -> None:
    """Insert default parameters if the table is empty."""
    existing = db.query(SimulationParameter).count()
    if existing > 0:
        return

    for item in DEFAULT_PARAMETERS:
        db.add(
            SimulationParameter(
                category=item["category"],
                key=item["key"],
                value=item["value"],
                description=item.get("description"),
            )
        )
    db.commit()


def get_all_params(db: Session) -> dict[str, Any]:
    """Return all parameters as a flattened dict {"{category}.{key}": value}."""
    rows = db.query(SimulationParameter).all()
    return {f"{r.category}.{r.key}": r.value for r in rows}


def get_param(db: Session, category: str, key: str) -> Any:
    row = (
        db.query(SimulationParameter)
        .filter_by(category=category, key=key)
        .first()
    )
    return row.value if row else None


def set_param(
    db: Session,
    category: str,
    key: str,
    value: Any,
    user_id: int | None = None,
) -> SimulationParameter:
    row = (
        db.query(SimulationParameter)
        .filter_by(category=category, key=key)
        .first()
    )
    if row is None:
        row = SimulationParameter(category=category, key=key, value=value)
        db.add(row)
    else:
        row.value = value

    row.updated_by = user_id
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row
