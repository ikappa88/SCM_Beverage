"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAuthUser, logout } from "@/lib/auth";
import Link from "next/link";
import NotificationBell from "@/components/common/NotificationBell";

const NAV_ITEMS = [
  { label: "ダッシュボード",   href: "/operator/dashboard", icon: "📊" },
  { label: "在庫照会",         href: "/operator/inventory", icon: "📦" },
  { label: "アラート管理",     href: "/operator/alerts",    icon: "🔔" },
  { label: "発注・補充指示",   href: "/operator/orders",    icon: "📋" },
  { label: "配送管理",         href: "/operator/delivery",  icon: "🚚" },
  { label: "計画ビュー",       href: "/operator/planning",  icon: "📅" },
  { label: "データアップロード", href: "/operator/upload",  icon: "📤" },
  { label: "操作履歴",         href: "/operator/history",   icon: "🕐" },
];

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [locationIds, setLocationIds] = useState("");

  useEffect(() => {
    const user = getAuthUser();
    if (!user) { router.push("/login"); return; }
    if (user.role === "administrator") { router.push("/admin/dashboard"); return; }
    setUserName(user.full_name);
    setLocationIds(localStorage.getItem("assigned_location_ids") ?? "");
  }, [router]);

  const handleLogout = () => { logout(); router.push("/login"); };

  const navItems = NAV_ITEMS.map((item) => {
    const isActive = pathname === item.href;
    const cls = "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors " +
      (isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800");
    return (
      <Link key={item.href} href={item.href} className={cls}>
        <span className="text-base">{item.icon}</span>
        {item.label}
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
                <div className="text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded mt-0.5 inline-block">実務者</div>
              </div>
            </div>
            <NotificationBell alertsHref="/operator/alerts" />
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">{navItems}</nav>
        <div className="p-4 border-t border-gray-800">
          <div className="text-xs text-gray-400 mb-1 truncate">{userName}</div>
          <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-white transition-colors">
            ログアウト
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-56 p-6">{children}</main>
    </div>
  );
}
