"""
Factory simulation service.

Each half-day advance:
1. Each factory produces goods (base_daily × 0.5 × season × noise).
   Random line-stop events may set production to zero.
2. Produced quantity is shipped to the nearest wide-area DC via a DeliveryRecord.
3. Factory→DC deliveries that have completed their lead time are credited to
   wide_dc_inventory (handled by wide_dc_service.process_factory_inbound).
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.delivery_record import DeliveryRecord, DeliveryStatus
from app.models.location import Location, LocationType
from app.models.product import Product
from app.services.demand_model import _load_season_coeff


def _production_quantity(
    base_daily: int,
    virtual_time: datetime,
    params: dict[str, Any],
    seed: int | None,
) -> int:
    """Calculate half-day production quantity for one factory/product pair."""
    season_coeffs = _load_season_coeff(params)
    season = season_coeffs[virtual_time.month - 1]
    noise_range = float(params.get("factory.production_noise_range_percent", 10.0)) / 100.0
    rng = random.Random(seed)
    noise = 1.0 + rng.uniform(-noise_range, noise_range)
    return max(0, round(base_daily * 0.5 * season * noise))


def _next_delivery_code(db: Session, prefix: str) -> str:
    from sqlalchemy import func as sqlfunc
    count = db.query(sqlfunc.count(DeliveryRecord.id)).scalar() or 0
    return f"{prefix}-{count + 1:05d}"


def produce_and_ship(
    db: Session,
    new_time: datetime,
    half_day: str,
    params: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Simulate factory production and create DeliveryRecords to wide-area DCs.
    Returns list of event dicts.
    """
    events: list[dict[str, Any]] = []

    line_stop_prob = float(
        params.get("factory.line_stop_probability_per_half_day", 0.03)
    )
    lead_half_days = int(params.get("factory.lead_time_to_dc_half_days", 2))
    base_daily = int(params.get("factory.base_daily_production", 2000))
    seed_val = params.get("clock.rng_seed")

    factories = (
        db.query(Location)
        .filter(
            Location.location_type == LocationType.FACTORY,
            Location.is_active == True,
        )
        .all()
    )
    dc_locations = (
        db.query(Location)
        .filter(
            Location.location_type == LocationType.DC,
            Location.is_active == True,
        )
        .all()
    )
    if not dc_locations:
        return events

    products = db.query(Product).filter(Product.is_active == True).all()

    for factory in factories:
        # Assign this factory to the first DC (simplified: round-robin by factory index)
        dc = dc_locations[factories.index(factory) % len(dc_locations)]

        for product in products:
            # Line stop check
            stop_seed = (
                (int(seed_val) ^ (factory.id * 997 + product.id) ^ int(new_time.timestamp()))
                if seed_val is not None
                else None
            )
            rng_stop = random.Random(stop_seed)
            if rng_stop.random() < line_stop_prob:
                events.append({
                    "event_type": "factory_line_stopped",
                    "payload": {
                        "factory_id": factory.id,
                        "factory_name": factory.name,
                        "product_id": product.id,
                    },
                })
                continue

            # Production quantity
            prod_seed = (
                (int(seed_val) ^ (factory.id * 1009 + product.id) ^ int(new_time.timestamp()))
                if seed_val is not None
                else None
            )
            qty = _production_quantity(base_daily, new_time, params, prod_seed)
            if qty <= 0:
                continue

            # Expected arrival = new_time + lead_half_days * 12h
            expected_arrival = (new_time + timedelta(hours=lead_half_days * 12)).date()

            delivery = DeliveryRecord(
                delivery_code=_next_delivery_code(db, "FAC"),
                from_location_id=factory.id,
                to_location_id=dc.id,
                product_id=product.id,
                quantity=qty,
                status=DeliveryStatus.DEPARTED,
                scheduled_departure_date=new_time.date(),
                actual_departure_date=new_time.date(),
                expected_arrival_date=expected_arrival,
                created_by=1,  # system user
            )
            db.add(delivery)
            db.flush()  # get the id

            events.append({
                "event_type": "factory_produced",
                "payload": {
                    "factory_id": factory.id,
                    "factory_name": factory.name,
                    "dc_id": dc.id,
                    "dc_name": dc.name,
                    "product_id": product.id,
                    "quantity": qty,
                    "expected_arrival_date": expected_arrival.isoformat(),
                },
            })

    return events
