import { apiFetch } from "@/lib/auth";

export interface ClockData {
  virtual_time: string; // ISO datetime
  half_day: "AM" | "PM";
  initial_time: string;
  updated_at: string;
}

export interface SimulationEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

export interface AdvanceResult {
  previous_virtual_time: string;
  new_virtual_time: string;
  half_day: "AM" | "PM";
  event_count: number;
  events: SimulationEvent[];
  alerts_fired: number;
  stockouts: string[];
}

export interface SimulationEventRecord {
  id: number;
  virtual_time: string;
  half_day: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface SimulationParameter {
  id: number;
  category: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_by: number | null;
  updated_at: string;
}

export async function fetchClock(): Promise<ClockData> {
  const res = await apiFetch("/api/simulation/clock");
  if (!res.ok) throw new Error("仮想時刻の取得に失敗しました");
  return res.json();
}

export async function advanceHalfDay(): Promise<AdvanceResult> {
  const res = await apiFetch("/api/simulation/advance", { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "時間進行に失敗しました");
  }
  return res.json();
}

export async function resetClock(): Promise<ClockData> {
  const res = await apiFetch("/api/simulation/reset", { method: "POST" });
  if (!res.ok) throw new Error("リセットに失敗しました");
  return res.json();
}

export async function fetchEvents(limit = 50): Promise<SimulationEventRecord[]> {
  const res = await apiFetch(`/api/simulation/events?limit=${limit}`);
  if (!res.ok) throw new Error("イベントログの取得に失敗しました");
  return res.json();
}

export async function fetchParameters(): Promise<SimulationParameter[]> {
  const res = await apiFetch("/api/simulation/parameters");
  if (!res.ok) throw new Error("パラメータの取得に失敗しました");
  return res.json();
}

export async function updateParameter(
  category: string,
  key: string,
  value: unknown
): Promise<SimulationParameter> {
  const res = await apiFetch("/api/simulation/parameters", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, key, value }),
  });
  if (!res.ok) throw new Error("パラメータの更新に失敗しました");
  return res.json();
}

/** Format virtual_time ISO string to "YYYY-MM-DD" */
export function formatVirtualDate(iso: string): string {
  return iso.slice(0, 10);
}

const EVENT_LABELS: Record<string, string> = {
  inventory_consumed: "在庫消費",
  stockout: "欠品発生",
  delivery_arrived: "配送到着",
  delivery_status_changed: "配送状況変化",
  order_status_changed: "注文状況変化",
  alert_fired: "アラート発火",
};

export function eventLabel(event_type: string): string {
  return EVENT_LABELS[event_type] ?? event_type;
}
