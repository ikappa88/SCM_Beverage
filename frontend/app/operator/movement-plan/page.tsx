"use client";

import { useEffect, useState, useCallback } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";
import {
  fetchMovementPlan,
  fetchWideDcStatus,
  MovementPlan,
  WideDcStatusItem,
} from "@/lib/simulation";

interface Location { id: number; name: string; location_type: string }
interface Product  { id: number; name: string; sku_code: string }

export default function MovementPlanPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTcId, setSelectedTcId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [plan, setPlan] = useState<MovementPlan | null>(null);
  const [dcStatus, setDcStatus] = useState<WideDcStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/locations?location_type=tc").then((r) => r.json()),
      apiFetch("/api/products").then((r) => r.json()),
      fetchWideDcStatus(),
    ]).then(([locs, prods, dc]) => {
      const tcLocs: Location[] = Array.isArray(locs) ? locs : (locs.items ?? []);
      setLocations(tcLocs);
      setProducts(Array.isArray(prods) ? prods : (prods.items ?? []));
      setDcStatus(dc);
      if (tcLocs.length > 0) setSelectedTcId(tcLocs[0].id);
    }).catch(() => {});
  }, []);

  const loadPlan = useCallback(async () => {
    if (!selectedTcId || !selectedProductId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMovementPlan(selectedTcId, selectedProductId, 14);
      setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [selectedTcId, selectedProductId]);

  useEffect(() => {
    if (selectedTcId && selectedProductId) {
      loadPlan();
    }
  }, [loadPlan, selectedTcId, selectedProductId]);

  // Auto-select first product
  useEffect(() => {
    if (products.length > 0 && selectedProductId === null) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  const dcLevelColor = (level: string) => {
    if (level === "sufficient") return "text-green-400";
    if (level === "warning")    return "text-yellow-400";
    return "text-red-400";
  };

  const dcLevelLabel = (level: string) => {
    if (level === "sufficient") return "十分";
    if (level === "warning")    return "警告";
    return "欠品";
  };

  return (
    <OperatorLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">荷動き計画</h1>
          <button
            onClick={loadPlan}
            disabled={!selectedTcId || !selectedProductId || loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm text-white transition-colors"
          >
            {loading ? "取得中..." : "更新"}
          </button>
        </div>

        {/* Selector */}
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">地域TC</label>
            <select
              value={selectedTcId ?? ""}
              onChange={(e) => setSelectedTcId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 min-w-[160px]"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">製品</label>
            <select
              value={selectedProductId ?? ""}
              onChange={(e) => setSelectedProductId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 min-w-[160px]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        {/* Summary cards */}
        {plan && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SummaryCard label="現在在庫" value={plan.current_stock.toLocaleString()} unit="本" />
            <SummaryCard label="安全在庫" value={plan.safety_stock.toLocaleString()} unit="本" />
            <SummaryCard label="ATP" value={plan.atp.toLocaleString()} unit="本" />
            <SummaryCard
              label="欠品予測日"
              value={plan.stockout_date ?? "なし"}
              unit=""
              warn={plan.stockout_date !== null}
            />
            <SummaryCard label="広域DC在庫" value={plan.wide_dc_quantity.toLocaleString()} unit="本" />
          </div>
        )}

        {/* Day-by-day table */}
        {plan && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-semibold text-white">14日間 在庫推移</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-400 text-xs">
                    <th className="text-left px-4 py-2 font-medium">日付</th>
                    <th className="text-right px-4 py-2 font-medium">入荷予定</th>
                    <th className="text-right px-4 py-2 font-medium">需要予測</th>
                    <th className="text-right px-4 py-2 font-medium">推計在庫</th>
                    <th className="text-center px-4 py-2 font-medium">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {plan.days.map((day) => (
                    <tr
                      key={day.date}
                      className={day.is_stockout ? "bg-red-950/40" : "hover:bg-gray-800/50"}
                    >
                      <td className="px-4 py-2 text-gray-300 font-mono">{day.date}</td>
                      <td className="px-4 py-2 text-right text-green-400">
                        {day.inbound > 0 ? `+${day.inbound.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-blue-400">
                        {day.demand_estimate.toLocaleString()}
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${day.is_stockout ? "text-red-400" : "text-white"}`}>
                        {day.projected_stock.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {day.is_stockout ? (
                          <span className="inline-block bg-red-700/60 text-red-300 text-xs px-2 py-0.5 rounded-full">欠品</span>
                        ) : day.projected_stock < (plan.safety_stock ?? 0) ? (
                          <span className="inline-block bg-yellow-700/60 text-yellow-300 text-xs px-2 py-0.5 rounded-full">警告</span>
                        ) : (
                          <span className="inline-block bg-green-700/60 text-green-300 text-xs px-2 py-0.5 rounded-full">正常</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Wide DC status */}
        {dcStatus.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-semibold text-white">広域DC 在庫状況</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-xs">
                  <th className="text-left px-4 py-2 font-medium">DC ID</th>
                  <th className="text-left px-4 py-2 font-medium">製品 ID</th>
                  <th className="text-right px-4 py-2 font-medium">在庫</th>
                  <th className="text-right px-4 py-2 font-medium">安全在庫</th>
                  <th className="text-center px-4 py-2 font-medium">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {dcStatus.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-4 py-2 text-gray-300">{row.dc_location_id}</td>
                    <td className="px-4 py-2 text-gray-300">{row.product_id}</td>
                    <td className="px-4 py-2 text-right text-white">{row.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{row.safety_stock.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-center font-semibold ${dcLevelColor(row.level)}`}>
                      {dcLevelLabel(row.level)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </OperatorLayout>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  warn = false,
}: {
  label: string;
  value: string;
  unit: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${warn ? "text-red-400" : "text-white"}`}>
        {value}
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
