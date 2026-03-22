"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiFetch } from "@/lib/auth";

interface Stats {
  locations: number;
  products: number;
  routes: number;
  users: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ locations: 0, products: 0, routes: 0, users: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [locs, prods, routes, users] = await Promise.all([
        apiFetch("/api/locations/").then((r) => r.json()),
        apiFetch("/api/products/").then((r) => r.json()),
        apiFetch("/api/routes/").then((r) => r.json()),
        apiFetch("/api/users/").then((r) => r.json()),
      ]);
      setStats({
        locations: locs.length,
        products: prods.length,
        routes: routes.length,
        users: users.length,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { label: "拠点数", value: stats.locations, icon: "🏭", href: "/admin/master/locations" },
    { label: "商品数", value: stats.products, icon: "🥤", href: "/admin/master/products" },
    { label: "ルート数", value: stats.routes, icon: "🚚", href: "/admin/master/routes" },
    { label: "ユーザー数", value: stats.users, icon: "👤", href: "/admin/users" },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">管理者ダッシュボード</h1>
        <p className="text-sm text-gray-400 mt-0.5">システム全体の管理・監視</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <a key={card.label} href={card.href}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="text-2xl font-semibold">{card.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
          </a>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">クイックアクセス</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "拠点マスタ管理", href: "/admin/master/locations", desc: "拠点の登録・編集・無効化" },
            { label: "商品マスタ管理", href: "/admin/master/products", desc: "商品の登録・編集・無効化" },
            { label: "ルートマスタ管理", href: "/admin/master/routes", desc: "輸送ルートの管理" },
            { label: "ユーザー管理", href: "/admin/users", desc: "アカウント・権限の管理" },
          ].map((item) => (
            <a key={item.href} href={item.href}
              className="border border-gray-800 rounded-lg p-3 hover:border-gray-600 transition-colors">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
