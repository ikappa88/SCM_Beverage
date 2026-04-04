"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { StatusBadge } from "@/components/common/StatusBadge";
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

const typeLabel: Record<string, string> = {
  stockout:       "在庫切れ",
  low_stock:      "安全在庫割れ",
  overstock:      "過剰在庫",
  expiry_expired: "賞味期限切れ",
  expiry_near:    "賞味期限間近",
  delay:          "配送遅延",
  custom:         "手動",
};

const SEVERITY_MAP: Record<string, { label: string; cls: string }> = {
  danger:  { label: "緊急", cls: "text-red-400" },
  warning: { label: "警告", cls: "text-amber-400" },
  info:    { label: "注意", cls: "text-blue-400" },
};

export default function AdminAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");

  const fetchAlerts = async () => {
    const params = tab ? `?status=${tab}` : "";
    const res = await apiFetch(`/api/alerts/${params}`);
    const data = await res.json();
    setAlerts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { setLoading(true); fetchAlerts(); }, [tab]);

  const severityColor = (s: string) => SEVERITY_MAP[s]?.cls ?? "text-gray-400";
  const severityLabel = (s: string) => SEVERITY_MAP[s]?.label ?? s;

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">アラート管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            在庫データ更新時に自動生成されます。担当者が対応状況を更新します。
          </p>
        </div>
        <button
          onClick={() => { const d = new Date().toISOString().slice(0,10); downloadCsv(`alerts_${d}.csv`, alerts, [
            { label: "深刻度",   value: (r: Alert) => r.severity === "danger" ? "危険" : "警告" },
            { label: "種別",     value: (r: Alert) => typeLabel[r.alert_type] ?? r.alert_type },
            { label: "タイトル", value: (r: Alert) => r.title },
            { label: "拠点",     value: (r: Alert) => r.location.name },
            { label: "商品",     value: (r: Alert) => r.product?.name ?? "" },
            { label: "状態",     value: (r: Alert) => r.status },
            { label: "発生日時", value: (r: Alert) => new Date(r.created_at).toLocaleString("ja-JP") },
          ]); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
        >
          ⬇ CSV
        </button>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center">
                  <p className="text-gray-500 text-sm">アラートはありません</p>
                  <p className="text-gray-600 text-xs mt-1">
                    在庫データをアップロードすると自動的にアラートが生成されます
                  </p>
                </td>
              </tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
