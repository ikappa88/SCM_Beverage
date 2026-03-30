"use client";
import { useEffect, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";

interface AuditLog {
  id: number; username: string; action: string;
  resource: string; resource_id: string | null;
  detail: string | null; ip_address: string | null;
  location_id: number | null; created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login:  { label: "ログイン",       color: "bg-blue-900 text-blue-300" },
  create: { label: "作成",           color: "bg-green-900 text-green-300" },
  update: { label: "更新",           color: "bg-amber-900 text-amber-300" },
  delete: { label: "削除",           color: "bg-red-900 text-red-300" },
  upload: { label: "アップロード",   color: "bg-purple-900 text-purple-300" },
};

export default function HistoryPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterAction) params.append("action", filterAction);
    if (dateFrom)     params.append("date_from", dateFrom);
    if (dateTo)       params.append("date_to", dateTo);
    params.append("sort_order", sortOrder);
    params.append("limit", "100");
    const res = await apiFetch(`/api/audit-logs/me?${params.toString()}`);
    const data = await res.json();
    setLogs(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { fetchLogs(); }, [sortOrder]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

  return (
    <OperatorLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">操作履歴</h1>
          <p className="text-sm text-gray-400 mt-0.5">自身の操作履歴</p>
        </div>
        <button
          onClick={() => setSortOrder((s) => s === "desc" ? "asc" : "desc")}
          className="px-3 py-1.5 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
        >
          {sortOrder === "desc" ? "▼ 新しい順" : "▲ 古い順"}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
        >
          <option value="">全アクション</option>
          <option value="login">ログイン</option>
          <option value="create">作成</option>
          <option value="update">更新</option>
          <option value="delete">削除</option>
          <option value="upload">アップロード</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
        />
        <span className="self-center text-gray-500 text-sm">〜</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
        />
        <button onClick={fetchLogs}
          className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 text-gray-950 rounded-lg transition-colors">
          検索
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">日時</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">ユーザー</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">アクション</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">リソース</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">詳細</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500 text-xs">ログがありません</td></tr>
            ) : logs.map((log) => {
              const action = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-gray-800 text-gray-400" };
              return (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-gray-400 text-xs font-mono">{formatDate(log.created_at)}</td>
                  <td className="py-2.5 px-4 text-gray-300 text-xs font-mono">{log.username}</td>
                  <td className="py-2.5 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${action.color}`}>{action.label}</span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">
                    {log.resource}{log.resource_id ? ` #${log.resource_id}` : ""}
                  </td>
                  <td className="py-2.5 px-4 text-gray-500 text-xs max-w-xs truncate">{log.detail ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </OperatorLayout>
  );
}
