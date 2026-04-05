"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";

interface TimelineEvent {
  type: "order" | "delivery" | "audit";
  date: string | null;
  label: string;
  detail: Record<string, unknown>;
}

interface TimelineData {
  location_id: number;
  location_name: string;
  product_id: number;
  product_name: string;
  current_stock: number;
  safety_stock: number;
  events: TimelineEvent[];
}

const EVENT_ICONS: Record<string, string> = {
  order:    "📋",
  delivery: "🚚",
  audit:    "📝",
};

const EVENT_COLORS: Record<string, string> = {
  order:    "border-purple-800 bg-purple-950/30",
  delivery: "border-teal-800 bg-teal-950/30",
  audit:    "border-gray-700 bg-gray-800/30",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export default function TimelinePage() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get("location_id");
  const productId = searchParams.get("product_id");

  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId || !productId) {
      setError("location_id と product_id が必要です");
      setLoading(false);
      return;
    }
    apiFetch(`/api/inventory/timeline?location_id=${locationId}&product_id=${productId}`)
      .then((r) => {
        if (!r.ok) throw new Error("タイムラインの取得に失敗しました");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [locationId, productId]);

  return (
    <OperatorLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-3">
          <Link
            href={`/operator/inventory?location_id=${locationId}&product_id=${productId}`}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            ← 在庫一覧に戻る
          </Link>
        </div>

        {loading && (
          <div className="text-center text-gray-500 py-12">読み込み中...</div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        {data && (
          <>
            <div>
              <h1 className="text-xl font-bold text-white">
                {data.location_name} / {data.product_name}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">統合タイムライン（発注・配送・在庫変動）</p>
            </div>

            {/* サマリーカード */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
                <div className="text-xs text-gray-400 mb-1">現在在庫</div>
                <div className={`text-2xl font-bold ${data.current_stock <= 0 ? "text-red-400" : data.current_stock < data.safety_stock ? "text-yellow-400" : "text-white"}`}>
                  {data.current_stock.toLocaleString()}
                  <span className="text-sm text-gray-400 ml-1">本</span>
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
                <div className="text-xs text-gray-400 mb-1">安全在庫</div>
                <div className="text-2xl font-bold text-gray-300">
                  {data.safety_stock.toLocaleString()}
                  <span className="text-sm text-gray-400 ml-1">本</span>
                </div>
              </div>
            </div>

            {/* タイムライン */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <span className="text-sm font-semibold text-white">イベント履歴</span>
                <span className="text-xs text-gray-500 ml-2">{data.events.length}件</span>
              </div>

              {data.events.length === 0 ? (
                <div className="text-center text-gray-500 py-12 text-sm">
                  まだイベントはありません
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {data.events.map((ev, i) => (
                    <div key={i} className={`flex gap-3 rounded-lg border p-3 ${EVENT_COLORS[ev.type]}`}>
                      <span className="text-lg leading-none mt-0.5">{EVENT_ICONS[ev.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-medium text-gray-200 truncate">{ev.label}</span>
                          <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(ev.date)}</span>
                        </div>
                        {ev.type === "delivery" && (
                          <div className="text-xs text-gray-400">
                            到着予定: {ev.detail.expected_arrival_date as string ?? "—"} / ステータス: {ev.detail.status as string}
                          </div>
                        )}
                        {ev.type === "order" && (
                          <div className="text-xs text-gray-400">
                            {ev.detail.order_code as string} — {ev.detail.status as string}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </OperatorLayout>
  );
}
