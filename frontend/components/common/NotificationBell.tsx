"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth";

interface Props {
  alertsHref: string; // /admin/alerts or /operator/alerts
}

const POLL_INTERVAL = 30_000; // 30秒

export default function NotificationBell({ alertsHref }: Props) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await apiFetch("/api/alerts/?status=open&limit=100");
      if (!res.ok) return;
      const data = await res.json();
      setCount(Array.isArray(data) ? data.length : 0);
    } catch {
      // ネットワークエラーは無視
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchCount]);

  return (
    <button
      onClick={() => router.push(alertsHref)}
      title={count > 0 ? `未対応アラート ${count}件` : "アラートなし"}
      className="relative p-1.5 text-gray-400 hover:text-white transition-colors"
    >
      <span className="text-lg leading-none">🔔</span>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
