"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";

interface Alert {
  id: number;
  alert_type: string;
  severity: string;
  location_id: number;
  product_id: number | null;
  title: string;
  message: string;
  status: string;
  resolved_by: number | null;
  resolved_at: string | null;
  auto_generated: boolean;
  snoozed_until: string | null;
  snooze_reason: string | null;
  location: { id: number; name: string };
  product: { id: number; name: string } | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  stockout:       "在庫切れ",
  low_stock:      "安全在庫割れ",
  overstock:      "過剰在庫",
  expiry_expired: "賞味期限切れ",
  expiry_near:    "賞味期限間近",
  delay:          "配送遅延",
  custom:         "手動",
};

const GROUPS = [
  {
    key: "danger",
    label: "緊急",
    badge: "bg-red-500/20 text-red-400 border-red-800",
    header: "border-red-900/50 bg-red-950/20",
    dot: "bg-red-500",
    ring: "border-red-800/40",
  },
  {
    key: "warning",
    label: "警告",
    badge: "bg-amber-500/20 text-amber-400 border-amber-800",
    header: "border-amber-900/50 bg-amber-950/20",
    dot: "bg-amber-400",
    ring: "border-amber-800/40",
  },
  {
    key: "info",
    label: "注意",
    badge: "bg-blue-500/20 text-blue-400 border-blue-800",
    header: "border-blue-900/50 bg-blue-950/20",
    dot: "bg-blue-400",
    ring: "border-blue-800/40",
  },
] as const;

const TABS = [
  { label: "未対応", value: "open" },
  { label: "対応中", value: "in_progress" },
  { label: "解決済", value: "resolved" },
  { label: "すべて", value: "" },
];

const SNOOZE_OPTIONS = [
  { label: "本日中", hours: 0, eod: true },
  { label: "1日",   hours: 24 },
  { label: "3日",   hours: 72 },
  { label: "7日",   hours: 168 },
];

const POLL_INTERVAL_MS = 5 * 60 * 1000;

function snoozeUntilDate(hours: number, eod?: boolean): string {
  const d = new Date();
  if (eod) {
    d.setHours(23, 59, 59, 0);
  } else {
    d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  }
  return d.toISOString();
}

function isSnoozed(alert: Alert): boolean {
  if (!alert.snoozed_until) return false;
  return new Date(alert.snoozed_until) > new Date();
}

export default function AlertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const initTab = searchParams.get("status") ?? "open";
  const initSeverity = searchParams.get("severity") ?? "";
  const [tab, setTab] = useState(initTab);
  const [severityFilter, setSeverityFilter] = useState(initSeverity);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // スヌーズモーダル
  const [snoozeTarget, setSnoozeTarget] = useState<Alert | null>(null);
  const [snoozeReason, setSnoozeReason] = useState("");
  const [snoozeSubmitting, setSnoozeSubmitting] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (tab) qs.set("status", tab);
      if (severityFilter) qs.set("severity", severityFilter);
      const params = qs.toString() ? `?${qs}` : "";
      const res = await apiFetch(`/api/alerts/${params}`);
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, severityFilter]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, severityFilter]);

  const updateStatus = async (id: number, newStatus: string) => {
    setUpdating(id);
    setError("");
    try {
      const res = await apiFetch(`/api/alerts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "更新に失敗しました");
        return;
      }
      fetchData(true);
    } finally {
      setUpdating(null);
    }
  };

  const handleSnooze = async (hours: number, eod?: boolean) => {
    if (!snoozeTarget) return;
    setSnoozeSubmitting(true);
    try {
      const res = await apiFetch(`/api/alerts/${snoozeTarget.id}/snooze`, {
        method: "PATCH",
        body: JSON.stringify({
          snoozed_until: snoozeUntilDate(hours, eod),
          snooze_reason: snoozeReason || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "スヌーズの設定に失敗しました");
        return;
      }
      setSnoozeTarget(null);
      setSnoozeReason("");
      fetchData(true);
    } finally {
      setSnoozeSubmitting(false);
    }
  };

  // アラート種別ごとのクイックアクションリンク
  const quickActions = (a: Alert) => {
    const locParam = `?location_id=${a.location_id}`;
    const prodParam = a.product_id ? `&product_id=${a.product_id}` : "";
    switch (a.alert_type) {
      case "stockout":
      case "low_stock":
        return [
          { label: "在庫確認",   path: `/operator/inventory${locParam}${prodParam}` },
          { label: "発注を作成", path: `/operator/orders?new=1&from_product_id=${a.product_id ?? ""}&to_location_id=${a.location_id}` },
        ];
      case "overstock":
        return [{ label: "在庫確認", path: `/operator/inventory${locParam}${prodParam}` }];
      case "expiry_expired":
      case "expiry_near":
        return [{ label: "在庫確認（期限）", path: `/operator/inventory${locParam}${prodParam}` }];
      case "delay":
        return [{ label: "配送追跡", path: `/operator/delivery${locParam}` }];
      default:
        return [];
    }
  };

  const grouped = GROUPS.map((g) => ({
    ...g,
    items: alerts.filter((a) => a.severity === g.key),
  })).filter((g) => g.items.length > 0);

  const activeCount = alerts.filter(
    (a) => (a.status === "open" || a.status === "in_progress") && !isSnoozed(a)
  ).length;

  return (
    <OperatorLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            アラート管理
            {activeCount > 0 && tab !== "resolved" && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">担当拠点のアラートと対応状況</p>
        </div>
        <button
          onClick={() => {
            const d = new Date().toISOString().slice(0, 10);
            downloadCsv(`alerts_${d}.csv`, alerts, [
              { label: "重要度",   value: (r: Alert) => GROUPS.find((g) => g.key === r.severity)?.label ?? r.severity },
              { label: "種別",     value: (r: Alert) => TYPE_LABEL[r.alert_type] ?? r.alert_type },
              { label: "タイトル", value: (r: Alert) => r.title },
              { label: "拠点",     value: (r: Alert) => r.location.name },
              { label: "状態",     value: (r: Alert) => r.status },
              { label: "発生日時", value: (r: Alert) => new Date(r.created_at).toLocaleString("ja-JP") },
            ]);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
        >
          ⬇ CSV
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-1 mb-5">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              tab === t.value
                ? "bg-gray-700 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">読み込み中...</div>
      ) : alerts.length === 0 ? (
        <div className="py-16 text-center text-gray-500 text-sm">アラートはありません</div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.key} className={`border rounded-xl overflow-hidden ${group.ring}`}>
              <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${group.header}`}>
                <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                <span className="text-sm font-semibold text-gray-200">{group.label}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${group.badge}`}>
                  {group.items.length}件
                </span>
              </div>

              <div className="divide-y divide-gray-800/50">
                {group.items.map((a) => {
                  const actions = quickActions(a);
                  const isActive = a.status !== "resolved";
                  const snoozed = isSnoozed(a);
                  return (
                    <div
                      key={a.id}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-800/20 transition-colors ${snoozed ? "opacity-50" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                            {TYPE_LABEL[a.alert_type] ?? a.alert_type}
                          </span>
                          <span className="text-sm text-gray-200 font-medium">{a.title}</span>
                          {snoozed && (
                            <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-1.5 py-0.5 rounded">
                              💤 {new Date(a.snoozed_until!).toLocaleDateString("ja-JP")}まで
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{a.message}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-600">
                          <span>{a.location.name}</span>
                          {a.product && <span>{a.product.name}</span>}
                          <span>{new Date(a.created_at).toLocaleString("ja-JP")}</span>
                          {a.status === "in_progress" && <span className="text-amber-500">対応中</span>}
                          {a.status === "resolved" && <span className="text-green-600">解決済</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5 flex-wrap justify-end">
                        {/* クイックアクションボタン（在庫確認・発注作成・配送追跡） */}
                        {isActive && !snoozed && actions.map((action) => (
                          <button
                            key={action.label}
                            onClick={() => router.push(action.path)}
                            className="text-xs text-teal-400 hover:text-teal-300 border border-teal-800/60 px-2 py-1 rounded transition-colors"
                          >
                            {action.label} →
                          </button>
                        ))}

                        {isActive && !snoozed && a.status === "open" && (
                          <button
                            onClick={() => updateStatus(a.id, "in_progress")}
                            disabled={updating === a.id}
                            className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
                          >
                            対応中
                          </button>
                        )}
                        {isActive && !snoozed && (
                          <button
                            onClick={() => updateStatus(a.id, "resolved")}
                            disabled={updating === a.id}
                            className="text-xs text-gray-400 hover:text-green-400 disabled:opacity-50 transition-colors"
                          >
                            クローズ
                          </button>
                        )}

                        {/* スヌーズボタン */}
                        {isActive && (
                          <button
                            onClick={() => { setSnoozeTarget(a); setSnoozeReason(a.snooze_reason ?? ""); }}
                            title="スヌーズ（一時的に通知を停止）"
                            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1"
                          >
                            💤
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* スヌーズモーダル */}
      {snoozeTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold mb-1">スヌーズ設定</h3>
            <p className="text-xs text-gray-400 mb-4">{snoozeTarget.title}</p>
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">理由（任意）</label>
              <input
                value={snoozeReason}
                onChange={(e) => setSnoozeReason(e.target.value)}
                placeholder="例：明日入荷予定のため"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SNOOZE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleSnooze(opt.hours, opt.eod)}
                  disabled={snoozeSubmitting}
                  className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { setSnoozeTarget(null); setSnoozeReason(""); }}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </OperatorLayout>
  );
}
