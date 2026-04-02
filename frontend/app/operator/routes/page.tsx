"use client";
import { useEffect, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";

interface Loc { id: number; name: string; }
interface Route {
  id: number;
  code: string;
  origin: Loc;
  destination: Loc;
  lead_time_days: number;
  cost_per_unit: number | null;
  is_active: boolean;
}

const CSV_COLUMNS = [
  { label: "ルートコード",     value: (r: Route) => r.code },
  { label: "出発拠点",         value: (r: Route) => r.origin.name },
  { label: "到着拠点",         value: (r: Route) => r.destination.name },
  { label: "リードタイム(日)", value: (r: Route) => r.lead_time_days },
  { label: "コスト原単位",     value: (r: Route) => r.cost_per_unit ?? "" },
  { label: "状態",             value: (r: Route) => r.is_active ? "有効" : "無効" },
];

export default function OperatorRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    const res = await apiFetch("/api/routes/");
    const data = await res.json();
    setRoutes(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = routes.filter((r) =>
    !search ||
    r.code.includes(search) ||
    r.origin.name.includes(search) ||
    r.destination.name.includes(search)
  );

  return (
    <OperatorLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">ルートマスタ</h1>
          <p className="text-sm text-gray-400 mt-0.5">拠点間の輸送ルート一覧</p>
        </div>
        <button
          onClick={() => { const d = new Date().toISOString().slice(0, 10); downloadCsv(`routes_${d}.csv`, filtered, CSV_COLUMNS); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
        >
          ⬇ CSV
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ルートコード・拠点名で検索..."
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500 w-64"
        />
        <span className="text-xs text-gray-500 self-center">{filtered.length}件</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">ルートコード</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">出発拠点</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">到着拠点</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">リードタイム</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">コスト原単位</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-xs">データがありません</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 text-gray-400 text-xs font-mono">{r.code}</td>
                <td className="py-2.5 px-4 text-gray-200 text-xs">{r.origin.name}</td>
                <td className="py-2.5 px-4 text-gray-200 text-xs">{r.destination.name}</td>
                <td className="py-2.5 px-4 text-right text-gray-300 text-xs">{r.lead_time_days}日</td>
                <td className="py-2.5 px-4 text-right text-gray-400 text-xs">
                  {r.cost_per_unit != null ? `¥${r.cost_per_unit}` : "-"}
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"}`}>
                    {r.is_active ? "有効" : "無効"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </OperatorLayout>
  );
}
