"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";

interface Location { id: number; name: string }
interface Product  { id: number; name: string }
interface DeliveryRecord {
  id: number; delivery_code: string; order_id: number | null; status: string;
  from_location: Location; to_location: Location; product: Product;
  quantity: number; scheduled_departure_date: string;
  actual_departure_date: string | null; expected_arrival_date: string;
  actual_arrival_date: string | null; delay_reason: string | null;
  note: string | null; created_at: string;
}

const TABS = [
  { label: "すべて",   value: "" },
  { label: "未出発",   value: "scheduled" },
  { label: "輸送中",   value: "departed,in_transit" },
  { label: "遅延",     value: "delayed" },
  { label: "完了",     value: "arrived" },
];

export default function AdminDeliveryPage() {
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => {
    Promise.all([apiFetch("/api/deliveries/"), apiFetch("/api/locations/")])
      .then(async ([delRes, locRes]) => {
        const delData = await delRes.json();
        const locData = await locRes.json();
        setRecords(Array.isArray(delData) ? delData : []);
        setLocations(Array.isArray(locData) ? locData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = records.filter((r) => {
    if (tab && !tab.split(",").includes(r.status)) return false;
    if (locationFilter && r.to_location.id !== Number(locationFilter)) return false;
    return true;
  });

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">配送照会</h1>
          <p className="text-sm text-gray-400 mt-0.5">全拠点の配送状況（参照のみ）</p>
        </div>
        <button
          onClick={() => {
            const d = new Date().toISOString().slice(0, 10);
            downloadCsv(`delivery_${d}.csv`, filtered, [
              { label: "配送コード",   value: (r: DeliveryRecord) => r.delivery_code },
              { label: "出発拠点",     value: (r: DeliveryRecord) => r.from_location.name },
              { label: "到着拠点",     value: (r: DeliveryRecord) => r.to_location.name },
              { label: "商品",         value: (r: DeliveryRecord) => r.product.name },
              { label: "数量",         value: (r: DeliveryRecord) => r.quantity },
              { label: "ステータス",   value: (r: DeliveryRecord) => r.status },
              { label: "出発予定日",   value: (r: DeliveryRecord) => r.scheduled_departure_date },
              { label: "到着予定日",   value: (r: DeliveryRecord) => r.expected_arrival_date },
              { label: "実際到着日",   value: (r: DeliveryRecord) => r.actual_arrival_date ?? "" },
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
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">配送コード</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">出発</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">到着</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">数量</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">到着予定</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-500 text-xs">配送データがありません</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-gray-300">{r.delivery_code}</td>
                <td className="py-2.5 px-4 text-gray-200">{r.product.name}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{r.from_location.name}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{r.to_location.name}</td>
                <td className="py-2.5 px-4 text-right font-medium">{r.quantity.toLocaleString()}</td>
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={r.status} />
                    {r.delay_reason && (
                      <span className="text-xs text-red-400" title={r.delay_reason}>⚠</span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-4 text-xs">
                  <span className={r.status === "delayed" ? "text-red-400 font-medium" : "text-gray-400"}>
                    {r.expected_arrival_date}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
