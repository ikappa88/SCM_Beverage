"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch, getAuthUser, logout } from "@/lib/auth";
import Link from "next/link";
import NotificationBell from "@/components/common/NotificationBell";

const NAV_ITEMS = [
    { label: "ダッシュボード", href: "/admin/dashboard", icon: "📊" },
    { label: "在庫管理", href: "/admin/inventory", icon: "📦" },
    { label: "発注照会", href: "/admin/orders", icon: "📋" },
    { label: "配送照会", href: "/admin/delivery", icon: "🚛" },
    { label: "計画ビュー", href: "/admin/planning", icon: "📅" },
    { label: "拠点マスタ", href: "/admin/master/locations", icon: "🏭" },
    { label: "商品マスタ", href: "/admin/master/products", icon: "🥤" },
    { label: "ルートマスタ", href: "/admin/master/routes", icon: "🗺️" },
    { label: "ユーザー管理", href: "/admin/users", icon: "👤" },
    { label: "アラート管理", href: "/admin/alerts", icon: "🔔" },
    { label: "安全在庫設定", href: "/admin/safety-stock", icon: "🛡️" },
    { label: "シナリオ管理", href: "/admin/scenarios", icon: "🔬" },
    { label: "テンプレート管理", href: "/admin/templates", icon: "📄" },
    { label: "監査ログ", href: "/admin/audit", icon: "📋" },
    { label: "KPI閾値設定", href: "/admin/settings", icon: "⚙️" },
    { label: "アラート設定", href: "/admin/alerts/settings", icon: "🔧" },
  ];

const ALERT_POLL_MS = 5 * 60 * 1000;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [alertBadge, setAlertBadge] = useState(0);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) { router.push("/login"); return; }
    if (user.role !== "administrator") { router.push("/operator/dashboard"); return; }
    setUserName(user.full_name);
  }, [router]);

  const fetchBadge = useCallback(async () => {
    try {
      const res = await apiFetch("/api/alerts/badge");
      if (!res.ok) return;
      const data = await res.json();
      setAlertBadge(typeof data.count === "number" ? data.count : 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchBadge();
    const timer = setInterval(fetchBadge, ALERT_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchBadge]);

  const handleLogout = () => { logout(); router.push("/login"); };

  const navItems = NAV_ITEMS.map((item) => {
    const isActive = pathname === item.href;
    const cls = "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
      (isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800");
    const isAlerts = item.href === "/admin/alerts";
    return (
      <Link key={item.href} href={item.href} className={cls}>
        <span className="text-base">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {isAlerts && alertBadge > 0 && (
          <span className="min-w-[18px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {alertBadge > 99 ? "99+" : alertBadge}
          </span>
        )}
      </Link>
    );
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥤</span>
              <div>
                <div className="text-sm font-semibold">SCM Beverage</div>
                <div className="text-xs bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded mt-0.5 inline-block">管理者</div>
              </div>
            </div>
            <NotificationBell alertsHref="/admin/alerts" />
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">{navItems}</nav>
        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-400 mb-1">{userName}</div>
          <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-white transition-colors">
            ログアウト
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-56 p-6">{children}</main>
    </div>
  );
}
