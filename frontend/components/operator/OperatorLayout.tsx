"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch, getAuthUser, logout } from "@/lib/auth";
import Link from "next/link";
import NotificationBell from "@/components/common/NotificationBell";
import SimulationClock from "@/components/common/SimulationClock";

const NAV_ITEMS = [
  { label: "ダッシュボード",   href: "/operator/dashboard", icon: "📊" },
  { label: "在庫照会",         href: "/operator/inventory", icon: "📦" },
  { label: "アラート管理",     href: "/operator/alerts",    icon: "🔔" },
  { label: "発注・補充指示",   href: "/operator/orders",    icon: "📋" },
  { label: "配送管理",         href: "/operator/delivery",  icon: "🚚" },
  { label: "荷動き計画",       href: "/operator/movement-plan", icon: "📈" },
  { label: "計画ビュー",       href: "/operator/planning",  icon: "📅" },
  { label: "商品マスタ",       href: "/operator/products",  icon: "🥤" },
  { label: "ルートマスタ",     href: "/operator/routes",    icon: "🗺️" },
  { label: "操作履歴",         href: "/operator/history",   icon: "🕐" },
];

const ALERT_POLL_MS = 5 * 60 * 1000;

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [alertBadge, setAlertBadge] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const user = getAuthUser();
    if (!user) { router.push("/login"); return; }
    if (user.role === "administrator") { router.push("/admin/dashboard"); return; }
    setUserName(user.full_name);
  }, [router]);

  // ページ遷移時にモバイルメニューを閉じる
  useEffect(() => { setMobileOpen(false); }, [pathname]);

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

  const NavContent = () => (
    <>
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥤</span>
            <div>
              <div className="text-sm font-semibold">SCM Beverage</div>
              <div className="text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded mt-0.5 inline-block">実務者</div>
            </div>
          </div>
          <NotificationBell alertsHref="/operator/alerts" />
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const isAlerts = item.href === "/operator/alerts";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {isAlerts && alertBadge > 0 && (
                <span className="min-w-[18px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {alertBadge > 99 ? "99+" : alertBadge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-400 mb-1 truncate">{userName}</div>
        <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-white transition-colors">
          ログアウト
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* デスクトップ固定サイドバー */}
      <aside className="hidden md:flex w-56 bg-gray-900 border-r border-gray-800 flex-col fixed h-full z-30">
        <NavContent />
      </aside>

      {/* モバイル: オーバーレイサイドバー */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-gray-900 flex flex-col h-full shadow-2xl">
            <NavContent />
          </aside>
        </div>
      )}

      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 bg-gray-950 border-b border-gray-800 px-4 md:px-6 py-2 flex items-center gap-3">
          {/* モバイル: ハンバーガーボタン */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="メニューを開く"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1" />
          <SimulationClock />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
