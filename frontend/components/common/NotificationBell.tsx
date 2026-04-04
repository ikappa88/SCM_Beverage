"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface AlertPreview {
  id: number;
  title: string;
  severity: string;
  location_name: string;
}

interface BadgeData {
  count: number;
  preview: AlertPreview[];
}

interface Props {
  alertsHref: string; // /admin/alerts or /operator/alerts
}

const POLL_INTERVAL = 30_000; // 30秒

const SEVERITY_COLOR: Record<string, string> = {
  danger:  "text-red-400",
  warning: "text-amber-400",
  info:    "text-blue-400",
};
const SEVERITY_DOT: Record<string, string> = {
  danger:  "bg-red-500",
  warning: "bg-amber-400",
  info:    "bg-blue-400",
};

export default function NotificationBell({ alertsHref }: Props) {
  const router = useRouter();
  const [data, setData] = useState<BadgeData>({ count: 0, preview: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await apiFetch("/api/alerts/badge");
      if (!res.ok) return;
      const json = await res.json();
      setData({
        count: typeof json.count === "number" ? json.count : 0,
        preview: Array.isArray(json.preview) ? json.preview : [],
      });
    } catch {
      // ネットワークエラーは無視
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchCount]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={data.count > 0 ? `未対応アラート ${data.count}件` : "アラートなし"}
        className="relative p-1.5 text-gray-400 hover:text-white transition-colors"
      >
        <span className="text-lg leading-none">🔔</span>
        {data.count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {data.count > 99 ? "99+" : data.count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">
              未対応アラート
              {data.count > 0 && (
                <span className="ml-1.5 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {data.count}
                </span>
              )}
            </span>
          </div>

          {data.count === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 text-center">
              アラートはありません
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-800/50">
                {data.preview.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 px-3 py-2.5">
                    <span
                      className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${SEVERITY_DOT[a.severity] ?? "bg-gray-400"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${SEVERITY_COLOR[a.severity] ?? "text-gray-300"}`}>
                        {a.title}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{a.location_name}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-gray-800">
                <button
                  onClick={() => { setOpen(false); router.push(alertsHref); }}
                  className="w-full text-xs text-teal-400 hover:text-teal-300 text-center transition-colors"
                >
                  {data.count > 5 ? `他 ${data.count - 5} 件を含むすべてを見る →` : "アラート一覧を見る →"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
