"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthUser, logout } from "@/lib/auth";

export default function OperatorDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const user = getAuthUser();
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role === "administrator") {
      router.push("/admin/dashboard");
      return;
    }
    setUserName(user.full_name);
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ヘッダー */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🥤</span>
          <span className="font-semibold">SCM Beverage</span>
          <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">実務者</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{userName}</span>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-white transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* メインコンテンツ（今後実装） */}
      <main className="p-6">
        <h1 className="text-xl font-semibold mb-2">実務者ダッシュボード</h1>
        <p className="text-gray-400 text-sm">在庫・配送状況の管理画面をここに実装します。</p>
      </main>
    </div>
  );
}
