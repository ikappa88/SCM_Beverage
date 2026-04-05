"""
Wide-area DC simulation service.

Responsibilities:
1. process_factory_inbound  : credit wide_dc_inventory when factory→DC deliveries arrive.
2. advance_tc_replenishment : when TC orders are confirmed, ship from DC to TC
                               (checking DC stock first).
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.delivery_record import DeliveryRecord, DeliveryStatus
from app.models.location import Location, LocationType
from app.models.order import Order, OrderStatus
from app.models.wide_dc_inventory import WideDcInventory


# ---------------------------------------------------------------------------
# Step 1: credit wide_dc_inventory from factory arrivals
# ---------------------------------------------------------------------------

def process_factory_inbound(
    db: Session,
    new_time: datetime,
    params: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Find factory→DC deliveries whose expected_arrival_date <= virtual date
    and status is DEPARTED/IN_TRANSIT. Mark ARRIVED and credit wide_dc_inventory.
    """
    events: list[dict[str, Any]] = []

    dc_ids = {
        loc.id
        for loc in db.query(Location)
        .filter(Location.location_type == LocationType.DC, Location.is_active == True)
        .all()
    }
    factory_ids = {
        loc.id
        for loc in db.query(Location)
        .filter(Location.location_type == LocationType.FACTORY, Location.is_active == True)
        .all()
    }
    if not dc_ids or not factory_ids:
        return events

    arriving = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.from_location_id.in_(factory_ids),
            DeliveryRecord.to_location_id.in_(dc_ids),
            DeliveryRecord.status.in_([DeliveryStatus.DEPARTED, DeliveryStatus.IN_TRANSIT]),
            DeliveryRecord.expected_arrival_date <= new_time.date(),
        )
        .all()
    )

    for delivery in arriving:
        delivery.status = DeliveryStatus.ARRIVED
        delivery.actual_arrival_date = new_time.date()

        inv = (
            db.query(WideDcInventory)
            .filter_by(location_id=delivery.to_location_id, product_id=delivery.product_id)
            .first()
        )
        if inv:
            inv.quantity += delivery.quantity
            inv.updated_at = datetime.utcnow()
        else:
            db.add(
                WideDcInventory(
                    location_id=delivery.to_location_id,
                    product_id=delivery.product_id,
                    quantity=delivery.quantity,
                )
            )

        events.append({
            "event_type": "wide_dc_received",
            "payload": {
                "dc_id": delivery.to_location_id,
                "product_id": delivery.product_id,
                "quantity": delivery.quantity,
                "delivery_code": delivery.delivery_code,
            },
        })

    return events


# ---------------------------------------------------------------------------
# Step 2: ship from DC to TC for confirmed TC orders
# ---------------------------------------------------------------------------

def _next_delivery_code(db: Session, prefix: str) -> str:
    from sqlalchemy import func as sqlfunc
    count = db.query(sqlfunc.count(DeliveryRecord.id)).scalar() or 0
    return f"{prefix}-{count + 1:05d}"


def advance_tc_replenishment(
    db: Session,
    new_time: datetime,
    params: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Process TC replenishment orders:
    - CONFIRMED → try to ship from DC (check DC stock)
    - IN_TRANSIT deliveries that have arrived → credit TC inventory (handled by existing advance_deliveries)

    Returns list of event dicts.
    """
    events: list[dict[str, Any]] = []

    lead_half_days = int(params.get("wide_dc.lead_time_to_tc_half_days", 4))
    jitter_cfg: dict[str, Any] = params.get(
        "wide_dc.lead_time_jitter_half_days", {"min": -1, "max": 2}
    )
    jitter_min = int(jitter_cfg.get("min", -1))
    jitter_max = int(jitter_cfg.get("max", 2))
    weekend_extra = int(params.get("wide_dc.weekend_extra_half_days", 2))

    dc_ids = {
        loc.id
        for loc in db.query(Location)
        .filter(Location.location_type == LocationType.DC, Location.is_active == True)
        .all()
    }

    # Only process orders where from_location is a DC (TC replenishment orders)
    confirmed_orders = (
        db.query(Order)
        .filter(
            Order.status == OrderStatus.CONFIRMED,
            Order.from_location_id.in_(dc_ids),
        )
        .all()
    )

    for order in confirmed_orders:
        # Check DC stock
        dc_inv = (
            db.query(WideDcInventory)
            .filter_by(location_id=order.from_location_id, product_id=order.product_id)
            .first()
        )

        if dc_inv is None or dc_inv.quantity < order.quantity:
            available = dc_inv.quantity if dc_inv else 0
            events.append({
                "event_type": "wide_dc_shortage",
                "payload": {
                    "order_code": order.order_code,
                    "dc_id": order.from_location_id,
                    "product_id": order.product_id,
                    "requested": order.quantity,
                    "available": available,
                },
            })
            continue

        # Deduct from DC inventory
        dc_inv.quantity -= order.quantity
        dc_inv.updated_at = datetime.utcnow()

        # Calculate effective lead time
        rng = random.Random(order.id)
        effective_lead = lead_half_days + rng.randint(jitter_min, jitter_max)
        if new_time.weekday() >= 5:
            effective_lead += weekend_extra

        expected_arrival = (
            new_time + timedelta(hours=effective_lead * 12)
        ).date()

        # Create DeliveryRecord DC→TC
        delivery = DeliveryRecord(
            delivery_code=_next_delivery_code(db, "DLV"),
            order_id=order.id,
            from_location_id=order.from_location_id,
            to_location_id=order.to_location_id,
            product_id=order.product_id,
            quantity=order.quantity,
            status=DeliveryStatus.SCHEDULED,
            scheduled_departure_date=new_time.date(),
            expected_arrival_date=expected_arrival,
            created_by=1,  # system user
        )
        db.add(delivery)
        db.flush()

        order.status = OrderStatus.IN_TRANSIT

        events.append({
            "event_type": "wide_dc_shipped",
            "payload": {
                "order_code": order.order_code,
                "dc_id": order.from_location_id,
                "tc_id": order.to_location_id,
                "product_id": order.product_id,
                "quantity": order.quantity,
                "delivery_code": delivery.delivery_code,
                "expected_arrival_date": expected_arrival.isoformat(),
            },
        })

    return events
