"""
Movement plan service: projects future inventory levels for a TC location.

For each (TC, product) pair over the next N days:
  projected_stock[day] = current_stock
                         + scheduled_inbound[day]
                         - estimated_demand[day]

Stockout prediction: first day where projected_stock <= 0
"""

from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.delivery_record import DeliveryRecord, DeliveryStatus
from app.models.inventory import Inventory
from app.models.location import Location, LocationType
from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.models.wide_dc_inventory import WideDcInventory
from app.services.demand_model import calculate_demand
from app.services.parameter_service import get_all_params


def _daily_demand_estimate(
    base_daily: int,
    target_date: date,
    params: dict[str, Any],
) -> float:
    """Estimate full-day demand (AM + PM) for a given date."""
    # Use noon as representative time, ignore AM/PM split for planning
    dt_am = datetime(target_date.year, target_date.month, target_date.day, 9, 0)
    dt_pm = datetime(target_date.year, target_date.month, target_date.day, 21, 0)
    am = calculate_demand(base_daily, dt_am, "AM", params, seed=None)
    pm = calculate_demand(base_daily, dt_pm, "PM", params, seed=None)
    return am + pm


def build_movement_plan(
    db: Session,
    tc_location_id: int,
    product_id: int,
    virtual_time: datetime,
    forecast_days: int = 14,
) -> dict[str, Any]:
    """
    Build a day-by-day movement plan for one (TC, product) pair.

    Returns:
        {
          "tc_location_id": int,
          "product_id": int,
          "current_stock": int,
          "safety_stock": int,
          "atp": int,
          "stockout_date": str | None,
          "days": [
            {
              "date": "2026-04-06",
              "inbound": int,         # confirmed deliveries arriving this day
              "demand_estimate": int, # demand model estimate
              "projected_stock": int, # end-of-day stock
              "is_stockout": bool
            }, ...
          ],
          "wide_dc_quantity": int,  # current DC stock for reference
        }
    """
    params = get_all_params(db)
    base_daily = int(
        params.get(f"demand.base_daily_{tc_location_id}_{product_id}")
        or params.get("demand.base_daily_default", 100)
    )

    # Current TC stock (sum across lots)
    current_stock: int = (
        db.query(Inventory)
        .filter_by(location_id=tc_location_id, product_id=product_id)
        .with_entities(Inventory.quantity)
        .all()
    )
    current_stock_total = sum(r.quantity for r in current_stock)

    # Safety stock
    inv_row = (
        db.query(Inventory)
        .filter_by(location_id=tc_location_id, product_id=product_id)
        .first()
    )
    safety_stock = inv_row.safety_stock if inv_row else 0

    # Confirmed inbound (SCHEDULED / DEPARTED / IN_TRANSIT deliveries to TC)
    inbound_deliveries = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.to_location_id == tc_location_id,
            DeliveryRecord.product_id == product_id,
            DeliveryRecord.status.in_([
                DeliveryStatus.SCHEDULED,
                DeliveryStatus.DEPARTED,
                DeliveryStatus.IN_TRANSIT,
            ]),
        )
        .all()
    )
    # Build inbound map: date → quantity
    inbound_by_date: dict[date, int] = {}
    for d in inbound_deliveries:
        inbound_by_date[d.expected_arrival_date] = (
            inbound_by_date.get(d.expected_arrival_date, 0) + d.quantity
        )

    # Confirmed orders (IN_TRANSIT status = DC already shipped, just not yet delivered)
    # These are already captured in inbound_deliveries above.
    # Additionally, CONFIRMED orders (not yet shipped from DC): estimate arrival
    confirmed_orders = (
        db.query(Order)
        .filter(
            Order.to_location_id == tc_location_id,
            Order.product_id == product_id,
            Order.status == OrderStatus.CONFIRMED,
        )
        .all()
    )
    lead_half_days = int(params.get("wide_dc.lead_time_to_tc_half_days", 4))
    for order in confirmed_orders:
        estimated_arrival = (virtual_time + timedelta(hours=lead_half_days * 12)).date()
        inbound_by_date[estimated_arrival] = (
            inbound_by_date.get(estimated_arrival, 0) + order.quantity
        )

    # ATP calculation
    total_inbound = sum(inbound_by_date.values())
    confirmed_outbound = 0  # TC doesn't manage explicit outbound orders in this model
    atp = current_stock_total + total_inbound - confirmed_outbound

    # Wide DC stock (first DC, for reference)
    dc_location = (
        db.query(Location)
        .filter(Location.location_type == LocationType.DC, Location.is_active == True)
        .first()
    )
    wide_dc_qty = 0
    if dc_location:
        dc_inv = (
            db.query(WideDcInventory)
            .filter_by(location_id=dc_location.id, product_id=product_id)
            .first()
        )
        wide_dc_qty = dc_inv.quantity if dc_inv else 0

    # Day-by-day projection
    days: list[dict[str, Any]] = []
    running_stock = current_stock_total
    stockout_date: str | None = None
    start_date = virtual_time.date()

    for i in range(forecast_days):
        target_date = start_date + timedelta(days=i)
        inbound_today = inbound_by_date.get(target_date, 0)
        demand_today = round(_daily_demand_estimate(base_daily, target_date, params))

        running_stock = running_stock + inbound_today - demand_today
        is_stockout = running_stock <= 0
        if is_stockout:
            running_stock = 0
            if stockout_date is None:
                stockout_date = target_date.isoformat()

        days.append({
            "date": target_date.isoformat(),
            "inbound": inbound_today,
            "demand_estimate": demand_today,
            "projected_stock": running_stock,
            "is_stockout": is_stockout,
        })

    return {
        "tc_location_id": tc_location_id,
        "product_id": product_id,
        "current_stock": current_stock_total,
        "safety_stock": safety_stock,
        "atp": atp,
        "stockout_date": stockout_date,
        "days": days,
        "wide_dc_quantity": wide_dc_qty,
    }


def build_wide_dc_status(db: Session) -> list[dict[str, Any]]:
    """Return current wide_dc_inventory summary grouped by DC location."""
    rows = (
        db.query(WideDcInventory)
        .all()
    )
    params = get_all_params(db)
    safety_stock = int(params.get("wide_dc.safety_stock_per_product", 3000))

    result: list[dict[str, Any]] = []
    for row in rows:
        level = (
            "sufficient" if row.quantity >= safety_stock
            else "warning" if row.quantity > 0
            else "stockout"
        )
        result.append({
            "dc_location_id": row.location_id,
            "product_id": row.product_id,
            "quantity": row.quantity,
            "safety_stock": safety_stock,
            "level": level,
        })
    return result
