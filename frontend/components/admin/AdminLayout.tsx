"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAuthUser, logout } from "@/lib/auth";

const NAV_ITEMS = [
  { label: "ダッシュボード", href: "/admin/dashboard", icon: "📊" },
  { label: "拠点マスタ", href: "/admin/master/locations", icon: "🏭" },
  { label: "商品マスタ", href: "/admin/master/products", icon: "🥤" },
  { label: "ルートマスタ", href: "/admin/master/routes", icon: "🚚" },
  { label: "ユーザー管理", href: "/admin/users", icon: "👤" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const user = getAuthUser();
    if (!user) { router.push("/login"); return; }
    if (user.role !== "administrator") { router.push("/operator/dashboard"); return; }
    setUserName(user.full_name);
  }, [router]);

  const handleLogout = () => { logout(); router.push("/login"); };

  const navItems = NAV_ITEMS.map((item) => {
    const isActive = pathname === item.href;
    const baseClass = "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ";
    const activeClass = isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800";
    return (
      <a key={item.href} href={item.href} className={baseClass + activeClass}>
        <span className="text-base">{item.icon}</span>
        {item.label}
      </a>
    );
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥤</span>
            <div>
              <div className="text-sm font-semibold">SCM Beverage</div>
              <div className="text-xs bg-purple-900 text-purple-300 px-1.5 py-0.5 rounded mt-0.5 inline-block">管理者</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">{navItems}</nav>
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
