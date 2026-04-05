"""
Demand model for simulation: calculates half-day consumption per location/product.

Formula:
  demand = base_daily_demand
           * 0.5 (half-day factor)
           * weekday_coefficient
           * season_coefficient
           * temperature_coefficient (AM/PM)
           * random_noise
"""

import random
from datetime import datetime
from typing import Any

# ---------------------------------------------------------------------------
# Default coefficient tables (overridable via simulation_parameters)
# ---------------------------------------------------------------------------

# Mon=0 … Sun=6
DEFAULT_WEEKDAY_COEFFICIENTS: list[float] = [
    0.9,  # Monday
    0.9,  # Tuesday
    1.0,  # Wednesday
    1.0,  # Thursday
    1.1,  # Friday
    1.3,  # Saturday
    1.2,  # Sunday
]

# Month 1-12
DEFAULT_SEASON_COEFFICIENTS: list[float] = [
    0.7,  # Jan
    0.7,  # Feb
    0.9,  # Mar
    1.0,  # Apr
    1.1,  # May
    1.2,  # Jun
    1.5,  # Jul
    1.6,  # Aug
    1.2,  # Sep
    1.0,  # Oct
    0.8,  # Nov
    0.8,  # Dec
]

# Temperature demand coefficients keyed by (month, half_day)
# Based on Tokyo monthly average temperatures (Japan Meteorological Agency)
DEFAULT_TEMPERATURE_COEFFICIENTS: dict[tuple[int, str], float] = {
    (1, "AM"): 0.8,  (1, "PM"): 0.8,
    (2, "AM"): 0.8,  (2, "PM"): 0.8,
    (3, "AM"): 0.9,  (3, "PM"): 1.0,
    (4, "AM"): 0.9,  (4, "PM"): 1.0,
    (5, "AM"): 1.0,  (5, "PM"): 1.2,
    (6, "AM"): 1.0,  (6, "PM"): 1.2,
    (7, "AM"): 1.1,  (7, "PM"): 1.5,
    (8, "AM"): 1.1,  (8, "PM"): 1.5,
    (9, "AM"): 1.0,  (9, "PM"): 1.2,
    (10, "AM"): 0.9, (10, "PM"): 1.0,
    (11, "AM"): 0.9, (11, "PM"): 0.9,
    (12, "AM"): 0.8, (12, "PM"): 0.8,
}

# Noise range: ±NOISE_RANGE_PERCENT %
DEFAULT_NOISE_RANGE_PERCENT: float = 20.0


def _load_weekday_coeff(params: dict[str, Any]) -> list[float]:
    v = params.get("demand.weekday_coefficients")
    if isinstance(v, list) and len(v) == 7:
        return [float(x) for x in v]
    return DEFAULT_WEEKDAY_COEFFICIENTS


def _load_season_coeff(params: dict[str, Any]) -> list[float]:
    v = params.get("demand.season_coefficients")
    if isinstance(v, list) and len(v) == 12:
        return [float(x) for x in v]
    return DEFAULT_SEASON_COEFFICIENTS


def _load_temperature_coeff(
    params: dict[str, Any],
) -> dict[tuple[int, str], float]:
    v = params.get("demand.temperature_coefficients")
    if isinstance(v, dict):
        result: dict[tuple[int, str], float] = {}
        for raw_key, val in v.items():
            # Stored as "7_PM" or [7, "PM"]
            if isinstance(raw_key, str) and "_" in raw_key:
                month_str, hd = raw_key.split("_", 1)
                result[(int(month_str), hd)] = float(val)
        if result:
            return result
    return DEFAULT_TEMPERATURE_COEFFICIENTS


def _load_noise_range(params: dict[str, Any]) -> float:
    v = params.get("demand.noise_range_percent")
    if v is not None:
        return float(v)
    return DEFAULT_NOISE_RANGE_PERCENT


def calculate_demand(
    base_daily_demand: int,
    virtual_time: datetime,
    half_day: str,
    params: dict[str, Any],
    seed: int | None = None,
) -> int:
    """
    Calculate demand (units consumed in this half-day period).

    Args:
        base_daily_demand: Daily baseline demand for this location/product pair.
        virtual_time: Current virtual datetime.
        half_day: "AM" or "PM"
        params: Flattened parameter dict {"{category}.{key}": value}.
        seed: Optional RNG seed for reproducibility.

    Returns:
        Integer demand quantity (>= 0).
    """
    weekday_coeff = _load_weekday_coeff(params)[virtual_time.weekday()]
    season_coeff = _load_season_coeff(params)[virtual_time.month - 1]
    temp_coeff = _load_temperature_coeff(params).get(
        (virtual_time.month, half_day), 1.0
    )
    noise_range = _load_noise_range(params) / 100.0

    rng = random.Random(seed)
    noise = 1.0 + rng.uniform(-noise_range, noise_range)

    raw = base_daily_demand * 0.5 * weekday_coeff * season_coeff * temp_coeff * noise
    return max(0, round(raw))
