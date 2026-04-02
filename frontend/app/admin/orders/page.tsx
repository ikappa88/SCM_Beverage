"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";

interface Location { id: number; name: string; code: string }
interface Product  { id: number; name: string; code: string }
interface Order {
  id: number; order_code: string; order_type: string; status: string;
  from_location: Location; to_location: Location; product: Product;
  quantity: number; unit_price: number | null;
  requested_date: string; expected_delivery_date: string | null;
  actual_delivery_date: string | null; note: string | null;
  created_at: string;
}

const TABS = [
  { label: "すべて",    value: "" },
  { label: "処理中",    value: "confirmed,in_transit" },
  { label: "完了",      value: "delivered" },
  { label: "キャンセル", value: "cancelled" },
];

const ORDER_TYPE_LABELS: Record<string, string> = {
  replenishment: "補充", transfer: "移管", emergency: "緊急補充",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/api/orders/"), apiFetch("/api/locations/")])
      .then(async ([ordRes, locRes]) => {
        const ordData = await ordRes.json();
        const locData = await locRes.json();
        setOrders(Array.isArray(ordData) ? ordData : []);
        setLocations(Array.isArray(locData) ? locData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = orders.filter((o) => {
    if (tab && !tab.split(",").includes(o.status)) return false;
    if (locationFilter && o.to_location.id !== Number(locationFilter)) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">発注照会</h1>
          <p className="text-sm text-gray-400 mt-0.5">全拠点の発注・補充状況（参照のみ）</p>
        </div>
        <button
          onClick={() => {
            const d = new Date().toISOString().slice(0, 10);
            downloadCsv(`orders_${d}.csv`, filtered, [
              { label: "発注コード",   value: (r: Order) => r.order_code },
              { label: "種別",         value: (r: Order) => ORDER_TYPE_LABELS[r.order_type] ?? r.order_type },
              { label: "補充元",       value: (r: Order) => r.from_location.name },
              { label: "補充先",       value: (r: Order) => r.to_location.name },
              { label: "商品",         value: (r: Order) => r.product.name },
              { label: "数量",         value: (r: Order) => r.quantity },
              { label: "ステータス",   value: (r: Order) => r.status },
              { label: "依頼日",       value: (r: Order) => r.requested_date },
              { label: "納品予定日",   value: (r: Order) => r.expected_delivery_date ?? "" },
              { label: "実際納品日",   value: (r: Order) => r.actual_delivery_date ?? "" },
            ]);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
        >
          ⬇ CSV
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                tab === t.value ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500"
        >
          <option value="">全拠点</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500 self-center">{filtered.length}件</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">発注コード</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">種別</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">補充元</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">補充先</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">数量</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">希望納期</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-xs">発注データがありません</td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-gray-300">{o.order_code}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{ORDER_TYPE_LABELS[o.order_type] ?? o.order_type}</td>
                <td className="py-2.5 px-4 text-gray-200">{o.product.name}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{o.from_location.name}</td>
                <td className="py-2.5 px-4 text-gray-300 text-xs">{o.to_location.name}</td>
                <td className="py-2.5 px-4 text-right font-medium">{o.quantity.toLocaleString()}</td>
                <td className="py-2.5 px-4"><StatusBadge status={o.status} /></td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{o.expected_delivery_date ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
