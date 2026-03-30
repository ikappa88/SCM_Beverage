"use client";
import { useEffect, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";

interface Location { id: number; name: string }
interface Product  { id: number; name: string }
interface Order {
  id: number; order_code: string; status: string;
  to_location: Location; product: Product;
  quantity: number; expected_delivery_date: string | null;
}
interface Delivery {
  id: number; delivery_code: string; status: string;
  to_location: Location; product: Product;
  quantity: number; expected_arrival_date: string;
}
interface WeekCol { label: string; start: Date; end: Date }

function getWeekCols(weeks = 4): WeekCol[] {
  const cols: WeekCol[] = [];
  const today = new Date();
  for (let i = 0; i < weeks; i++) {
    const start = new Date(today);
    start.setDate(today.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const m1 = start.getMonth() + 1, d1 = start.getDate();
    const m2 = end.getMonth() + 1,   d2 = end.getDate();
    cols.push({ label: `${m1}/${d1}〜${m2}/${d2}`, start, end });
  }
  return cols;
}

function inWeek(dateStr: string | null, col: WeekCol): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= col.start && d <= col.end;
}

export default function PlanningPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(4);

  useEffect(() => {
    Promise.all([apiFetch("/api/orders/"), apiFetch("/api/deliveries/")])
      .then(async ([ordRes, delRes]) => {
        const ordData = await ordRes.json();
        const delData = await delRes.json();
        setOrders(Array.isArray(ordData) ? ordData : []);
        setDeliveries(Array.isArray(delData) ? delData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const cols = getWeekCols(weeks);

  // 拠点×商品 の一意キーを収集
  const keys = new Map<string, { location: Location; product: Product }>();
  [...orders, ...deliveries].forEach((item) => {
    const k = `${item.to_location.id}-${item.product.id}`;
    if (!keys.has(k)) keys.set(k, { location: item.to_location, product: item.product });
  });

  const activeOrders   = orders.filter((o) => ["confirmed","in_transit"].includes(o.status));
  const activeDeliveries = deliveries.filter((d) => !["arrived","cancelled"].includes(d.status));

  return (
    <OperatorLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">計画ビュー</h1>
          <p className="text-sm text-gray-400 mt-0.5">担当拠点の今後の発注・配送スケジュール</p>
        </div>
        <div className="flex gap-1">
          {[2, 4].map((w) => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                weeks === w ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              {w}週間
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">読み込み中...</div>
      ) : keys.size === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">計画データがありません</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium w-40">商品</th>
                <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium w-32">拠点</th>
                {cols.map((c) => (
                  <th key={c.label} className="text-center py-2.5 px-3 text-xs text-gray-400 font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...keys.entries()].map(([key, { location, product }]) => (
                <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-gray-200">{product.name}</td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">{location.name}</td>
                  {cols.map((col) => {
                    const orderQty = activeOrders
                      .filter((o) => o.to_location.id === location.id && o.product.id === product.id && inWeek(o.expected_delivery_date, col))
                      .reduce((s, o) => s + o.quantity, 0);
                    const deliveryQty = activeDeliveries
                      .filter((d) => d.to_location.id === location.id && d.product.id === product.id && inWeek(d.expected_arrival_date, col))
                      .reduce((s, d) => s + d.quantity, 0);
                    const hasActivity = orderQty > 0 || deliveryQty > 0;
                    return (
                      <td key={col.label} className={`py-2.5 px-3 text-center ${hasActivity ? "bg-teal-950/30" : ""}`}>
                        {orderQty > 0 && (
                          <div className="text-xs text-blue-400 leading-tight">
                            発注 {orderQty.toLocaleString()}
                          </div>
                        )}
                        {deliveryQty > 0 && (
                          <div className="text-xs text-teal-400 leading-tight">
                            配送 {deliveryQty.toLocaleString()}
                          </div>
                        )}
                        {!hasActivity && <span className="text-gray-700">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span><span className="text-blue-400">■</span> 発注（到着予定）</span>
        <span><span className="text-teal-400">■</span> 配送（到着予定）</span>
      </div>
    </OperatorLayout>
  );
}
