"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth";

interface AuditLog {
  id: number;
  username: string;
  action: string;
  resource: string;
  detail: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: "作成", color: "bg-green-900 text-green-300" },
  UPDATE: { label: "更新", color: "bg-blue-900 text-blue-300" },
  DELETE: { label: "無効化", color: "bg-red-900 text-red-300" },
  UPLOAD: { label: "アップロード", color: "bg-purple-900 text-purple-300" },
  LOGIN:  { label: "ログイン", color: "bg-gray-800 text-gray-400" },
};

interface Props {
  resource: string;
  resourceId: number;
  title: string;
  onClose: () => void;
}

export default function HistoryPanel({ resource, resourceId, title, onClose }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      resource,
      resource_id: String(resourceId),
      limit: "50",
      sort_order: "desc",
    });
    apiFetch(`/api/audit-logs/?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [resource, resourceId]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <>
      {/* オーバーレイ */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* サイドパネル */}
      <div className="fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">変更履歴</p>
            <h3 className="text-sm font-semibold text-white truncate max-w-[280px]">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none">
            ✕
          </button>
        </div>

        {/* ログ一覧 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-xs text-gray-500 text-center mt-8">読み込み中...</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-gray-600 text-center mt-8">変更履歴がありません</p>
          ) : (
            <ol className="relative border-l border-gray-800 ml-2 space-y-5">
              {logs.map((log) => {
                const meta = ACTION_LABELS[log.action] ?? { label: log.action, color: "bg-gray-800 text-gray-400" };
                return (
                  <li key={log.id} className="ml-4">
                    {/* タイムラインドット */}
                    <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-gray-700 border border-gray-600" />

                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-500">{log.username}</span>
                    </div>

                    <p className="text-xs text-gray-400 font-mono">{fmt(log.created_at)}</p>

                    {log.detail && (
                      <p className="mt-1 text-xs text-gray-500 break-all leading-relaxed">
                        {log.detail}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
