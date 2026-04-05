"""
Simulation service: orchestrates each half-day advance.

Processing order per advance():
  1. Lock & update SimulationClock
  2. Advance delivery statuses
  3. Consume inventory (demand model)
  4. Advance order statuses
  5. Re-evaluate alerts
  6. Record events to simulation_events
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alert import Alert, AlertSeverity, AlertStatus, AlertType
from app.models.delivery_record import DeliveryRecord, DeliveryStatus
from app.models.inventory import Inventory
from app.models.order import Order, OrderStatus
from app.models.simulation import SimulationClock, SimulationEvent
from app.services.demand_model import calculate_demand
from app.services.parameter_service import get_all_params, get_param

# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class AdvanceResult:
    previous_virtual_time: datetime
    new_virtual_time: datetime
    half_day: str
    events: list[dict[str, Any]] = field(default_factory=list)

    @property
    def event_count(self) -> int:
        return len(self.events)

    @property
    def alerts_fired(self) -> int:
        return sum(1 for e in self.events if e["event_type"] == "alert_fired")

    @property
    def stockouts(self) -> list[str]:
        return [
            e["payload"].get("label", "")
            for e in self.events
            if e["event_type"] == "stockout"
        ]


# ---------------------------------------------------------------------------
# Clock helpers
# ---------------------------------------------------------------------------

CLOCK_ID = 1


def get_clock(db: Session) -> SimulationClock:
    clock = db.get(SimulationClock, CLOCK_ID)
    if clock is None:
        raise RuntimeError("simulation_clock row not found. Run migration 015.")
    return clock


def _lock_clock(db: Session) -> SimulationClock:
    """Lock the clock row for the duration of the transaction."""
    stmt = (
        select(SimulationClock)
        .where(SimulationClock.id == CLOCK_ID)
        .with_for_update()
    )
    clock = db.execute(stmt).scalar_one()
    return clock


def _half_day(dt: datetime) -> str:
    return "AM" if dt.hour < 12 else "PM"


# ---------------------------------------------------------------------------
# Main advance
# ---------------------------------------------------------------------------

def advance(db: Session, actor_user_id: int | None = None) -> AdvanceResult:
    """
    Advance virtual time by 12 hours and process all resulting events.
    Uses SELECT FOR UPDATE on simulation_clock to prevent concurrent advances.
    """
    clock = _lock_clock(db)
    prev_time = clock.virtual_time
    new_time = prev_time + timedelta(hours=12)
    clock.virtual_time = new_time
    clock.updated_at = datetime.utcnow()

    hd = _half_day(new_time)
    params = get_all_params(db)
    collected_events: list[dict[str, Any]] = []

    # Step 2: delivery status transitions
    collected_events.extend(_advance_deliveries(db, new_time, params))

    # Step 3: inventory consumption
    collected_events.extend(_consume_demand(db, new_time, hd, params))

    # Step 4: order status transitions
    collected_events.extend(_advance_orders(db, new_time, params))

    # Step 5: alert evaluation (pass session-local dedup set)
    fired_alert_keys: set[tuple[str, int, int | None]] = set()
    collected_events.extend(_evaluate_alerts(db, new_time, fired_alert_keys))

    # Step 6: persist events
    _record_events(db, new_time, hd, collected_events)

    db.commit()

    return AdvanceResult(
        previous_virtual_time=prev_time,
        new_virtual_time=new_time,
        half_day=hd,
        events=[{"event_type": e["event_type"], "payload": e["payload"]} for e in collected_events],
    )


def reset(db: Session) -> SimulationClock:
    """Reset virtual time to initial_time (admin only)."""
    clock = _lock_clock(db)
    clock.virtual_time = clock.initial_time
    clock.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(clock)
    return clock


# ---------------------------------------------------------------------------
# Step 2: Delivery status transitions
# ---------------------------------------------------------------------------

# Lead time in half-days per status transition
_STATUS_LEAD_HALF_DAYS: dict[DeliveryStatus, DeliveryStatus] = {
    DeliveryStatus.SCHEDULED: DeliveryStatus.DEPARTED,
    DeliveryStatus.DEPARTED: DeliveryStatus.IN_TRANSIT,
    DeliveryStatus.IN_TRANSIT: DeliveryStatus.ARRIVED,
}


def _advance_deliveries(
    db: Session, new_time: datetime, params: dict[str, Any]
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    lead_half_days: int = int(params.get("delivery.default_lead_time_half_days", 4))
    jitter: dict[str, Any] = params.get(
        "delivery.lead_time_jitter_half_days", {"min": -1, "max": 2}
    )
    jitter_min: int = int(jitter.get("min", -1))
    jitter_max: int = int(jitter.get("max", 2))

    active_statuses = list(_STATUS_LEAD_HALF_DAYS.keys())
    deliveries = (
        db.query(DeliveryRecord)
        .filter(DeliveryRecord.status.in_(active_statuses))
        .all()
    )

    for delivery in deliveries:
        next_status = _STATUS_LEAD_HALF_DAYS[delivery.status]

        # Estimate elapsed half-days since scheduled_departure_date
        reference_date: date = delivery.scheduled_departure_date
        reference_dt = datetime(reference_date.year, reference_date.month, reference_date.day, 9, 0)
        elapsed_hours = (new_time - reference_dt).total_seconds() / 3600.0
        elapsed_half_days = math.floor(elapsed_hours / 12)

        # Each transition requires lead_time half-days (+ deterministic jitter seeded by delivery id)
        import random
        rng = random.Random(delivery.id)
        effective_lead = lead_half_days + rng.randint(jitter_min, jitter_max)
        # Weekend crossing penalty
        extra: int = int(params.get("delivery.weekend_extra_half_days", 2))
        weekday = new_time.weekday()
        if weekday >= 5:  # Saturday or Sunday
            effective_lead += extra

        transition_threshold = {
            DeliveryStatus.SCHEDULED: 1,
            DeliveryStatus.DEPARTED: 2,
            DeliveryStatus.IN_TRANSIT: max(1, effective_lead),
        }.get(delivery.status, effective_lead)

        if elapsed_half_days >= transition_threshold:
            old_status = delivery.status
            delivery.status = next_status

            # When ARRIVED: credit inventory to destination
            if next_status == DeliveryStatus.ARRIVED:
                delivery.actual_arrival_date = new_time.date()
                _credit_inventory(db, delivery)
                events.append({
                    "event_type": "delivery_arrived",
                    "payload": {
                        "delivery_code": delivery.delivery_code,
                        "to_location_id": delivery.to_location_id,
                        "product_id": delivery.product_id,
                        "quantity": delivery.quantity,
                    },
                })
            else:
                events.append({
                    "event_type": "delivery_status_changed",
                    "payload": {
                        "delivery_code": delivery.delivery_code,
                        "from": old_status.value,
                        "to": next_status.value,
                    },
                })

    return events


def _credit_inventory(db: Session, delivery: DeliveryRecord) -> None:
    """Add delivered quantity to the destination location's inventory."""
    inv = (
        db.query(Inventory)
        .filter_by(
            location_id=delivery.to_location_id,
            product_id=delivery.product_id,
        )
        .first()
    )
    if inv:
        inv.quantity += delivery.quantity
    # If no inventory row exists, we don't auto-create one (requires lot info).


# ---------------------------------------------------------------------------
# Step 3: Inventory consumption (demand)
# ---------------------------------------------------------------------------

def _consume_demand(
    db: Session,
    new_time: datetime,
    half_day: str,
    params: dict[str, Any],
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    seed_val = params.get("clock.rng_seed")
    seed: int | None = int(seed_val) if seed_val is not None else None

    inventories = db.query(Inventory).all()

    for inv in inventories:
        base_demand_key = f"demand.base_daily_{inv.location_id}_{inv.product_id}"
        base_daily = params.get(base_demand_key)
        if base_daily is None:
            # Fall back to global default
            base_daily = params.get("demand.base_daily_default", 100)
        base_daily = int(base_daily)

        # Seed per (location, product, virtual_time) for reproducibility
        item_seed = (
            (seed ^ (inv.location_id * 1000 + inv.product_id) ^ int(new_time.timestamp()))
            if seed is not None
            else None
        )

        demand = calculate_demand(
            base_daily_demand=base_daily,
            virtual_time=new_time,
            half_day=half_day,
            params=params,
            seed=item_seed,
        )

        actual_consumed = min(demand, inv.quantity)
        shortage = demand - actual_consumed
        inv.quantity -= actual_consumed

        events.append({
            "event_type": "inventory_consumed",
            "payload": {
                "location_id": inv.location_id,
                "product_id": inv.product_id,
                "demanded": demand,
                "consumed": actual_consumed,
                "remaining_stock": inv.quantity,
            },
        })

        if shortage > 0:
            events.append({
                "event_type": "stockout",
                "payload": {
                    "location_id": inv.location_id,
                    "product_id": inv.product_id,
                    "shortage": shortage,
                    "label": f"location={inv.location_id} / product={inv.product_id}",
                },
            })

    return events


# ---------------------------------------------------------------------------
# Step 4: Order status transitions
# ---------------------------------------------------------------------------

def _advance_orders(
    db: Session, new_time: datetime, params: dict[str, Any]
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []

    # CONFIRMED → IN_TRANSIT (one transition per advance, only during AM)
    if _half_day(new_time) == "AM":
        confirmed_orders = (
            db.query(Order)
            .filter(Order.status == OrderStatus.CONFIRMED)
            .all()
        )
        for order in confirmed_orders:
            order.status = OrderStatus.IN_TRANSIT
            events.append({
                "event_type": "order_status_changed",
                "payload": {
                    "order_code": order.order_code,
                    "from": OrderStatus.CONFIRMED.value,
                    "to": OrderStatus.IN_TRANSIT.value,
                },
            })

    # IN_TRANSIT → DELIVERED (when expected_delivery_date <= virtual date)
    in_transit_orders = (
        db.query(Order)
        .filter(Order.status == OrderStatus.IN_TRANSIT)
        .all()
    )
    for order in in_transit_orders:
        expected = order.expected_delivery_date
        if expected is not None and expected <= new_time.date():
            order.status = OrderStatus.DELIVERED
            order.actual_delivery_date = new_time.date()
            events.append({
                "event_type": "order_status_changed",
                "payload": {
                    "order_code": order.order_code,
                    "from": OrderStatus.IN_TRANSIT.value,
                    "to": OrderStatus.DELIVERED.value,
                },
            })

    return events


# ---------------------------------------------------------------------------
# Step 5: Alert evaluation
# ---------------------------------------------------------------------------

def _evaluate_alerts(
    db: Session,
    new_time: datetime,
    fired_keys: set[tuple[str, int, int | None]] | None = None,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    if fired_keys is None:
        fired_keys = set()
    expiry_warning_days: int = int(
        get_param(db, "stock", "expiry_warning_days") or 30
    )

    inventories = (
        db.query(Inventory)
        .all()
    )

    for inv in inventories:
        # --- Stockout ---
        if inv.quantity == 0:
            _maybe_fire_alert(
                db=db,
                events=events,
                fired_keys=fired_keys,
                alert_type=AlertType.STOCKOUT,
                severity=AlertSeverity.DANGER,
                location_id=inv.location_id,
                product_id=inv.product_id,
                title="在庫切れ",
                message="在庫がゼロになりました。",
            )

        # --- Low stock (below safety_stock) ---
        elif inv.safety_stock > 0 and inv.quantity <= inv.safety_stock:
            _maybe_fire_alert(
                db=db,
                events=events,
                fired_keys=fired_keys,
                alert_type=AlertType.LOW_STOCK,
                severity=AlertSeverity.WARNING,
                location_id=inv.location_id,
                product_id=inv.product_id,
                title="在庫低下（安全在庫割れ）",
                message=f"現在庫 {inv.quantity} が安全在庫 {inv.safety_stock} 以下です。",
            )

        # --- Expiry ---
        if inv.expiry_date is not None:
            virtual_date = new_time.date()
            days_left = (inv.expiry_date - virtual_date).days

            if days_left < 0:
                _maybe_fire_alert(
                    db=db,
                    events=events,
                    fired_keys=fired_keys,
                    alert_type=AlertType.EXPIRY_EXPIRED,
                    severity=AlertSeverity.DANGER,
                    location_id=inv.location_id,
                    product_id=inv.product_id,
                    title="賞味期限切れ",
                    message=f"賞味期限（{inv.expiry_date}）を過ぎています。",
                )
            elif days_left <= expiry_warning_days:
                _maybe_fire_alert(
                    db=db,
                    events=events,
                    fired_keys=fired_keys,
                    alert_type=AlertType.EXPIRY_NEAR,
                    severity=AlertSeverity.WARNING,
                    location_id=inv.location_id,
                    product_id=inv.product_id,
                    title="賞味期限間近",
                    message=f"賞味期限まであと {days_left} 日です（{inv.expiry_date}）。",
                )

    # --- Delivery delay ---
    delayed_deliveries = (
        db.query(DeliveryRecord)
        .filter(
            DeliveryRecord.status.in_([
                DeliveryStatus.SCHEDULED,
                DeliveryStatus.DEPARTED,
                DeliveryStatus.IN_TRANSIT,
            ]),
            DeliveryRecord.expected_arrival_date < new_time.date(),
        )
        .all()
    )
    for delivery in delayed_deliveries:
        _maybe_fire_alert(
            db=db,
            events=events,
            fired_keys=fired_keys,
            alert_type=AlertType.DELAY,
            severity=AlertSeverity.WARNING,
            location_id=delivery.to_location_id,
            product_id=delivery.product_id,
            title="配送遅延",
            message=f"配送 {delivery.delivery_code} が到着予定日を過ぎています。",
        )

    return events


def _maybe_fire_alert(
    db: Session,
    events: list[dict[str, Any]],
    fired_keys: set[tuple[str, int, int | None]],
    alert_type: AlertType,
    severity: AlertSeverity,
    location_id: int,
    product_id: int | None,
    title: str,
    message: str,
) -> None:
    """Fire an alert only if no open alert of the same type/location/product exists.

    Uses fired_keys to deduplicate within a single advance() transaction
    (before db.commit() makes new rows visible to queries).
    """
    dedup_key = (alert_type.value, location_id, product_id)
    if dedup_key in fired_keys:
        return  # Already queued in this advance session

    existing = (
        db.query(Alert)
        .filter(
            Alert.alert_type == alert_type,
            Alert.location_id == location_id,
            Alert.product_id == product_id,
            Alert.status == AlertStatus.OPEN,
        )
        .first()
    )
    if existing is not None:
        fired_keys.add(dedup_key)  # Track as already handled
        return  # Already open in DB, skip duplicate

    fired_keys.add(dedup_key)
    alert = Alert(
        alert_type=alert_type,
        severity=severity,
        location_id=location_id,
        product_id=product_id,
        title=title,
        message=message,
        status=AlertStatus.OPEN,
        auto_generated=True,
    )
    db.add(alert)

    events.append({
        "event_type": "alert_fired",
        "payload": {
            "alert_type": alert_type.value,
            "severity": severity.value,
            "location_id": location_id,
            "product_id": product_id,
            "title": title,
        },
    })


# ---------------------------------------------------------------------------
# Step 6: Record events
# ---------------------------------------------------------------------------

def _record_events(
    db: Session,
    virtual_time: datetime,
    half_day: str,
    collected: list[dict[str, Any]],
) -> None:
    for item in collected:
        db.add(
            SimulationEvent(
                virtual_time=virtual_time,
                half_day=half_day,
                event_type=item["event_type"],
                payload=item["payload"],
            )
        )
