"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch, getAuthUser } from "@/lib/auth";

interface Alert {
  inventory_id: number;
  location_name: string;
  product_name: string;
  quantity: number;
  safety_stock: number;
  alert_level: string;
}

interface Inventory {
  id: number;
  location_id: number;
  product_id: number;
  quantity: number;
  safety_stock: number;
  max_stock: number;
  location: { id: number; code: string; name: string; location_type: string };
  product: { id: number; code: string; name: string; category: string };
}

export default function OperatorDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const user = getAuthUser();
    if (user) setUserName(user.full_name);

    const fetchData = async () => {
      const [alertRes, invRes] = await Promise.all([
        apiFetch("/api/inventory/alerts"),
        apiFetch("/api/inventory/"),
      ]);
      const alertData = await alertRes.json();
      const invData = await invRes.json();
      setAlerts(Array.isArray(alertData) ? alertData : []);
      setInventories(Array.isArray(invData) ? invData : []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalStock = inventories.reduce((s, i) => s + i.quantity, 0);
  const dangerCount = alerts.filter((a) => a.alert_level === "danger").length;
  const warningCount = alerts.filter((a) => a.alert_level === "warning").length;

  const stockByLocation = inventories.reduce((acc, inv) => {
    const key = inv.location.name;
    if (!acc[key]) acc[key] = { name: key, type: inv.location.location_type, total: 0, max: 0 };
    acc[key].total += inv.quantity;
    acc[key].max += inv.max_stock;
    return acc;
  }, {} as Record<string, { name: string; type: string; total: number; max: number }>);

  return (
    <OperatorLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">実務者ダッシュボード</h1>
        <p className="text-sm text-gray-400 mt-0.5">担当拠点の在庫・アラート状況</p>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">総在庫量</div>
          <div className="text-2xl font-semibold text-teal-400">{totalStock.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-0.5">担当拠点合計</div>
        </div>
        <Link href="/operator/alerts?status=open&severity=danger" className={`bg-gray-900 border rounded-xl p-4 block hover:border-red-700 transition-colors ${dangerCount > 0 ? "border-red-800" : "border-gray-800"}`}>
          <div className="text-xs text-gray-400 mb-1">緊急アラート</div>
          <div className={`text-2xl font-semibold ${dangerCount > 0 ? "text-red-400" : "text-gray-400"}`}>{dangerCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">クリックして確認 →</div>
        </Link>
        <Link href="/operator/alerts?status=open&severity=warning" className={`bg-gray-900 border rounded-xl p-4 block hover:border-amber-700 transition-colors ${warningCount > 0 ? "border-amber-800" : "border-gray-800"}`}>
          <div className="text-xs text-gray-400 mb-1">警告アラート</div>
          <div className={`text-2xl font-semibold ${warningCount > 0 ? "text-amber-400" : "text-gray-400"}`}>{warningCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">クリックして確認 →</div>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* アラート一覧 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium mb-3">要対応アラート</h2>
          {loading ? (
            <p className="text-gray-400 text-xs">読み込み中...</p>
          ) : alerts.length === 0 ? (
            <p className="text-gray-500 text-xs">アラートはありません</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div key={alert.inventory_id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    alert.alert_level === "danger"
                      ? "border-red-900 bg-red-950/30"
                      : "border-amber-900 bg-amber-950/30"
                  }`}>
                  <div>
                    <div className="text-xs font-medium">{alert.product_name}</div>
                    <div className="text-xs text-gray-400">{alert.location_name}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${alert.alert_level === "danger" ? "text-red-400" : "text-amber-400"}`}>
                      {alert.quantity.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">安全在庫: {alert.safety_stock.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 拠点別在庫状況 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium mb-3">拠点別在庫状況</h2>
          {loading ? (
            <p className="text-gray-400 text-xs">読み込み中...</p>
          ) : (
            <div className="space-y-3">
              {Object.values(stockByLocation).map((loc) => {
                const pct = Math.round((loc.total / loc.max) * 100);
                const color = pct < 20 ? "bg-red-500" : pct < 40 ? "bg-amber-500" : "bg-teal-500";
                return (
                  <div key={loc.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{loc.name}</span>
                      <span className="text-gray-400">{loc.total.toLocaleString()} / {loc.max.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
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
