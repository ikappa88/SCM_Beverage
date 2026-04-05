"use client";

import { useEffect, useState } from "react";
import { fetchEvents, eventLabel, formatVirtualDate, SimulationEventRecord } from "@/lib/simulation";

const EVENT_COLORS: Record<string, string> = {
  inventory_consumed:      "text-blue-400",
  stockout:                "text-red-400",
  delivery_arrived:        "text-teal-400",
  delivery_status_changed: "text-cyan-400",
  order_status_changed:    "text-purple-400",
  alert_fired:             "text-yellow-400",
};

const EVENT_ICONS: Record<string, string> = {
  inventory_consumed:      "📦",
  stockout:                "🚨",
  delivery_arrived:        "✅",
  delivery_status_changed: "🚚",
  order_status_changed:    "📋",
  alert_fired:             "🔔",
};

function eventSummary(event: SimulationEventRecord): string {
  const p = event.payload;
  switch (event.event_type) {
    case "inventory_consumed":
      return `拠点${p.location_id} / 商品${p.product_id}: ${p.consumed}本消費 (残${p.remaining_stock})`;
    case "stockout":
      return `欠品: ${p.label ?? `拠点${p.location_id}`} (不足${p.shortage})`;
    case "delivery_arrived":
      return `${p.delivery_code} 到着 → 拠点${p.to_location_id} +${p.quantity}`;
    case "delivery_status_changed":
      return `${p.delivery_code}: ${p.from} → ${p.to}`;
    case "order_status_changed":
      return `${p.order_code}: ${p.from} → ${p.to}`;
    case "alert_fired":
      return `[${p.alert_type}] ${p.title} (拠点${p.location_id})`;
    default:
      return JSON.stringify(p).slice(0, 60);
  }
}

interface Props {
  onClose: () => void;
  refreshTrigger: number;
}

export default function SimulationEventLog({ onClose, refreshTrigger }: Props) {
  const [events, setEvents] = useState<SimulationEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchEvents(80)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="text-sm font-semibold text-white">シミュレーション イベントログ</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {loading && (
          <div className="text-center text-gray-500 py-8 text-sm">読み込み中...</div>
        )}
        {!loading && events.length === 0 && (
          <div className="text-center text-gray-500 py-8 text-sm">
            まだイベントはありません。「半日進める」を押してください。
          </div>
        )}
        {events.map((ev) => (
          <div
            key={ev.id}
            className="bg-gray-800 rounded-lg px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span>{EVENT_ICONS[ev.event_type] ?? "•"}</span>
              <span className={`font-semibold ${EVENT_COLORS[ev.event_type] ?? "text-gray-300"}`}>
                {eventLabel(ev.event_type)}
              </span>
              <span className="ml-auto text-gray-500">
                {formatVirtualDate(ev.virtual_time)} {ev.half_day}
              </span>
            </div>
            <div className="text-gray-300 leading-snug">{eventSummary(ev)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
