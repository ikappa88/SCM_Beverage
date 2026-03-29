"use client";
import { useEffect, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiFetch } from "@/lib/auth";

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
  location: { id: number; name: string };
  product: { id: number; name: string } | null;
  created_at: string;
}

const TABS = [
  { label: "すべて",  value: "" },
  { label: "未対応",  value: "open" },
  { label: "対応中",  value: "in_progress" },
  { label: "解決済",  value: "resolved" },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState("");

  const fetchData = async () => {
    const params = tab ? `?status=${tab}` : "";
    const res = await apiFetch(`/api/alerts/${params}`);
    const data = await res.json();
    setAlerts(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { setLoading(true); fetchData(); }, [tab]);

  const updateStatus = async (alert: Alert, newStatus: string) => {
    setUpdating(alert.id);
    setError("");
    try {
      const res = await apiFetch(`/api/alerts/${alert.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "更新に失敗しました");
        return;
      }
      fetchData();
    } finally {
      setUpdating(null);
    }
  };

  const severityLabel = (s: string) =>
    s === "danger" ? "危険" : "警告";
  const severityColor = (s: string) =>
    s === "danger" ? "text-red-400" : "text-amber-400";
  const typeLabel: Record<string, string> = {
    stockout: "在庫切れ",
    low_stock: "安全在庫割れ",
    overstock: "過剰在庫",
    delay: "配送遅延",
    custom: "手動",
  };

  return (
    <OperatorLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">アラート管理</h1>
        <p className="text-sm text-gray-400 mt-0.5">担当拠点のアラートと対応状況</p>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-1 mb-4">
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

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">深刻度</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">種別</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">タイトル</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">拠点</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">発生日時</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : alerts.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-500 text-xs">アラートはありません</td></tr>
            ) : alerts.map((a) => (
              <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-medium ${severityColor(a.severity)}`}>
                    {severityLabel(a.severity)}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{typeLabel[a.alert_type] ?? a.alert_type}</td>
                <td className="py-2.5 px-4">
                  <div className="text-gray-200">{a.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{a.message}</div>
                </td>
                <td className="py-2.5 px-4 text-gray-300 text-xs">{a.location.name}</td>
                <td className="py-2.5 px-4"><StatusBadge status={a.status} /></td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">
                  {new Date(a.created_at).toLocaleString("ja-JP")}
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex gap-2">
                    {a.status === "open" && (
                      <button
                        onClick={() => updateStatus(a, "in_progress")}
                        disabled={updating === a.id}
                        className="text-xs text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors"
                      >
                        対応中に
                      </button>
                    )}
                    {(a.status === "open" || a.status === "in_progress") && (
                      <button
                        onClick={() => updateStatus(a, "resolved")}
                        disabled={updating === a.id}
                        className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50 transition-colors"
                      >
                        解決済に
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OperatorLayout>
  );
}
