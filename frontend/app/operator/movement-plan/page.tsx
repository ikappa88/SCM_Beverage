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

interface Location { id: number; name: string; code: string; location_type: string }
interface Product  { id: number; name: string; code: string }

export default function MovementPlanPage() {
  const [tcLocations, setTcLocations] = useState<Location[]>([]);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTcId, setSelectedTcId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [plan, setPlan] = useState<MovementPlan | null>(null);
  const [dcStatus, setDcStatus] = useState<WideDcStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 今日の日付（YYYY-MM-DD）
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/locations").then((r) => r.json()),
      apiFetch("/api/products").then((r) => r.json()),
      fetchWideDcStatus(),
    ]).then(([locs, prods, dc]) => {
      const allLocs: Location[] = Array.isArray(locs) ? locs : (locs.items ?? []);
      const tcLocs = allLocs.filter((l) => l.location_type === "tc");
      setAllLocations(allLocs);
      setTcLocations(tcLocs);
      setProducts(Array.isArray(prods) ? prods : (prods.items ?? []));
      setDcStatus(dc);
      if (tcLocs.length > 0) setSelectedTcId(tcLocs[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (products.length > 0 && selectedProductId === null) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

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
    if (selectedTcId && selectedProductId) loadPlan();
  }, [loadPlan, selectedTcId, selectedProductId]);

  // 名前解決ヘルパー
  const locationName = (id: number) =>
    allLocations.find((l) => l.id === id)?.name ?? `DC #${id}`;
  const productName = (id: number) =>
    products.find((p) => p.id === id)?.name ?? `商品 #${id}`;

  // 選択商品でフィルタした広域DC一覧
  const filteredDcStatus = selectedProductId
    ? dcStatus.filter((r) => r.product_id === selectedProductId)
    : dcStatus;

  // 在庫比率（安全在庫に対する割合）
  const stockRatio = (qty: number, safety: number) =>
    safety > 0 ? Math.min(100, Math.round((qty / safety) * 100)) : 100;

  const levelConfig = {
    sufficient: { label: "十分",   bar: "bg-teal-500",  badge: "bg-teal-900/60 text-teal-300 border-teal-700" },
    warning:    { label: "警告",   bar: "bg-amber-500", badge: "bg-amber-900/60 text-amber-300 border-amber-700" },
    stockout:   { label: "欠品",   bar: "bg-red-500",   badge: "bg-red-900/60 text-red-300 border-red-700" },
  } as const;

  return (
    <OperatorLayout>
      <div className="space-y-5">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">荷動き計画</h1>
            <p className="text-sm text-gray-400 mt-0.5">14日間の在庫推移と広域DC供給状況</p>
          </div>
          <button
            onClick={loadPlan}
            disabled={!selectedTcId || !selectedProductId || loading}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-sm text-white transition-colors"
          >
            {loading ? "更新中..." : "更新"}
          </button>
        </div>

        {/* セレクター */}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">地域TC</label>
            <select
              value={selectedTcId ?? ""}
              onChange={(e) => setSelectedTcId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 min-w-[180px] focus:outline-none focus:border-teal-500"
            >
              {tcLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">商品</label>
            <select
              value={selectedProductId ?? ""}
              onChange={(e) => setSelectedProductId(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 min-w-[180px] focus:outline-none focus:border-teal-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        {/* サマリーカード */}
        {plan && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard label="現在庫" value={plan.current_stock.toLocaleString()} unit="本" />
            <SummaryCard label="安全在庫" value={plan.safety_stock.toLocaleString()} unit="本" />
            <SummaryCard
              label="利用可能在庫 ATP"
              value={plan.atp.toLocaleString()}
              unit="本"
              warn={plan.atp < plan.safety_stock}
              sub="確定発注控除後"
            />
            <SummaryCard
              label="欠品予測日"
              value={plan.stockout_date ?? "予測なし"}
              unit=""
              warn={plan.stockout_date !== null}
              good={plan.stockout_date === null}
            />
            <SummaryCard
              label="広域DC在庫（合計）"
              value={plan.wide_dc_quantity.toLocaleString()}
              unit="本"
              sub="選択商品の全DC合算"
            />
          </div>
        )}

        {/* 14日間推移テーブル */}
        {plan && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">14日間 在庫推移</span>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />正常</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />警告</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />欠品</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-400 text-xs">
                    <th className="text-left px-4 py-2.5 font-medium">日付</th>
                    <th className="text-right px-4 py-2.5 font-medium">入荷予定</th>
                    <th className="text-right px-4 py-2.5 font-medium">需要予測</th>
                    <th className="text-right px-4 py-2.5 font-medium">推計在庫</th>
                    <th className="text-left px-4 py-2.5 font-medium w-32">在庫比率</th>
                    <th className="text-center px-4 py-2.5 font-medium">状態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {plan.days.map((day) => {
                    const isToday = day.date === today;
                    const isLow = !day.is_stockout && day.projected_stock < plan.safety_stock;
                    const ratio = stockRatio(day.projected_stock, plan.safety_stock);
                    return (
                      <tr
                        key={day.date}
                        className={
                          isToday
                            ? "bg-teal-950/30 border-l-2 border-l-teal-500"
                            : day.is_stockout
                            ? "bg-red-950/30"
                            : "hover:bg-gray-800/40"
                        }
                      >
                        <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">
                          {day.date}
                          {isToday && <span className="ml-1.5 text-teal-400 text-[10px] font-semibold">TODAY</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {day.inbound > 0 ? (
                            <span className="text-green-400 font-medium">+{day.inbound.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-blue-400 text-xs">
                          {day.demand_estimate.toLocaleString()}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${
                          day.is_stockout ? "text-red-400" : isLow ? "text-amber-400" : "text-white"
                        }`}>
                          {day.projected_stock.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  day.is_stockout ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-teal-500"
                                }`}
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{ratio}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {day.is_stockout ? (
                            <span className="inline-block bg-red-900/60 text-red-300 border border-red-700 text-xs px-2 py-0.5 rounded-full">欠品</span>
                          ) : isLow ? (
                            <span className="inline-block bg-amber-900/60 text-amber-300 border border-amber-700 text-xs px-2 py-0.5 rounded-full">警告</span>
                          ) : (
                            <span className="inline-block bg-teal-900/60 text-teal-300 border border-teal-700 text-xs px-2 py-0.5 rounded-full">正常</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 広域DC在庫状況 */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-white">広域DC 在庫状況</span>
              {selectedProductId && (
                <span className="ml-2 text-xs text-gray-400">
                  — {productName(selectedProductId)}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">安全在庫に対する充足率を表示</span>
          </div>

          {filteredDcStatus.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              {selectedProductId ? "この商品の広域DC在庫データがありません" : "商品を選択してください"}
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredDcStatus.map((row, i) => {
                const cfg = levelConfig[row.level] ?? levelConfig.stockout;
                const ratio = stockRatio(row.quantity, row.safety_stock);
                const dcName = locationName(row.dc_location_id);
                const pName = productName(row.product_id);
                const shortage = row.quantity - row.safety_stock;

                return (
                  <div key={i} className="px-5 py-4 hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-100">{dcName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{pName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{row.quantity.toLocaleString()}<span className="text-xs text-gray-400 ml-1">本</span></p>
                        <p className="text-xs text-gray-500">安全在庫: {row.safety_stock.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* 在庫充足ゲージ */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${cfg.bar}`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-400 w-12 text-right">{ratio}%</span>
                    </div>

                    {/* 過不足メッセージ */}
                    <div className="mt-1.5 text-xs">
                      {shortage >= 0 ? (
                        <span className="text-gray-500">安全在庫に対して <span className="text-teal-400 font-medium">+{shortage.toLocaleString()}</span> の余裕</span>
                      ) : (
                        <span className="text-red-400 font-medium">安全在庫まで {Math.abs(shortage).toLocaleString()} 不足</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </OperatorLayout>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  warn = false,
  good = false,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  warn?: boolean;
  good?: boolean;
  sub?: string;
}) {
  const valueColor = warn ? "text-red-400" : good ? "text-teal-400" : "text-white";
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
      <div className="text-xs text-gray-400 mb-1 leading-tight">{label}</div>
      <div className={`text-lg font-bold ${valueColor}`}>
        {value}
        {unit && <span className="text-xs text-gray-400 ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}
