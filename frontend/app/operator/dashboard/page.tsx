"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch, getAuthUser } from "@/lib/auth";

interface Alert {
  id: number;
  severity: string;
  title: string;
  status: string;
  location: { id: number; name: string };
  product: { id: number; name: string } | null;
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

interface Delivery {
  id: number;
  delivery_code: string;
  status: string;
  expected_arrival_date: string;
  quantity: number;
  product: { name: string };
  to_location: { name: string };
}

interface TaskItem {
  priority: "high" | "medium" | "low";
  icon: string;
  label: string;
  href: string;
}

export default function OperatorDashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const user = getAuthUser();
    if (user) setUserName(user.full_name);

    const fetchData = async () => {
      const [alertRes, invRes, dlvRes] = await Promise.all([
        apiFetch("/api/alerts/?status=open"),
        apiFetch("/api/inventory/"),
        apiFetch("/api/deliveries/?status=in_transit&limit=20"),
      ]);
      const alertData = await alertRes.json();
      const invData = await invRes.json();
      const dlvData = await dlvRes.json();
      setAlerts(Array.isArray(alertData) ? alertData : []);
      setInventories(Array.isArray(invData) ? invData : []);
      const dlvItems = Array.isArray(dlvData) ? dlvData : (dlvData.items ?? []);
      setDeliveries(dlvItems);
      setLoading(false);
    };
    fetchData();
  }, []);

  const totalStock = inventories.reduce((s, i) => s + i.quantity, 0);
  const dangerCount = alerts.filter((a) => a.severity === "danger").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  // 今日到着予定の配送
  const today = new Date().toISOString().slice(0, 10);
  const arrivingToday = deliveries.filter((d) => d.expected_arrival_date === today);

  // 今日のタスクリスト生成
  const taskList: TaskItem[] = [];
  if (dangerCount > 0) {
    taskList.push({ priority: "high", icon: "🚨", label: `緊急アラート ${dangerCount}件 に対応する`, href: "/operator/alerts?status=open&severity=danger" });
  }
  if (arrivingToday.length > 0) {
    taskList.push({ priority: "high", icon: "🚚", label: `本日到着予定の配送 ${arrivingToday.length}件 を確認する`, href: "/operator/delivery" });
  }
  if (warningCount > 0) {
    taskList.push({ priority: "medium", icon: "⚠️", label: `警告アラート ${warningCount}件 を確認する`, href: "/operator/alerts?status=open&severity=warning" });
  }
  const lowStockItems = inventories.filter((i) => i.quantity > 0 && i.quantity < i.safety_stock * 0.5 && !i.location.location_type.includes("dc"));
  if (lowStockItems.length > 0) {
    taskList.push({ priority: "medium", icon: "📦", label: `安全在庫50%割れ ${lowStockItems.length}品目 の発注を検討する`, href: "/operator/orders" });
  }

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

      <div className="grid grid-cols-3 gap-4">
        {/* 今日のタスクリスト */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium mb-3">今日のタスク</h2>
          {loading ? (
            <p className="text-gray-400 text-xs">読み込み中...</p>
          ) : taskList.length === 0 ? (
            <p className="text-gray-500 text-xs">対応が必要なタスクはありません ✓</p>
          ) : (
            <div className="space-y-2">
              {taskList.map((task, i) => (
                <Link key={i} href={task.href}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs hover:opacity-80 transition-opacity ${
                    task.priority === "high"   ? "border-red-900 bg-red-950/30" :
                    task.priority === "medium" ? "border-amber-900 bg-amber-950/30" :
                    "border-gray-800 bg-gray-800/30"
                  }`}>
                  <span className="text-base leading-none mt-0.5">{task.icon}</span>
                  <span className="text-gray-200 leading-snug">{task.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 要対応アラート */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">要対応アラート</h2>
            <Link href="/operator/alerts?status=open" className="text-xs text-teal-400 hover:text-teal-300">すべて →</Link>
          </div>
          {loading ? (
            <p className="text-gray-400 text-xs">読み込み中...</p>
          ) : alerts.length === 0 ? (
            <p className="text-gray-500 text-xs">アラートはありません</p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    alert.severity === "danger"
                      ? "border-red-900 bg-red-950/30"
                      : "border-amber-900 bg-amber-950/30"
                  }`}>
                  <div>
                    <div className="text-xs font-medium">{alert.product?.name ?? alert.title}</div>
                    <div className="text-xs text-gray-400">{alert.location.name}</div>
                  </div>
                  <div className={`text-xs font-semibold ${alert.severity === "danger" ? "text-red-400" : "text-amber-400"}`}>
                    {alert.severity === "danger" ? "緊急" : "警告"}
                  </div>
                </div>
              ))}
              {alerts.length > 5 && (
                <Link href="/operator/alerts?status=open" className="block text-center text-xs text-gray-500 hover:text-gray-300 py-1">
                  +{alerts.length - 5}件
                </Link>
              )}
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
