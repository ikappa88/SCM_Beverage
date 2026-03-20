"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "ログインに失敗しました");
        return;
      }

      const data = await res.json();

      // トークンとロールをlocalStorageに保存
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("full_name", data.full_name);
      localStorage.setItem("user_id", String(data.user_id));

      // ロールに応じてリダイレクト
      if (data.role === "administrator") {
        router.push("/admin/dashboard");
      } else {
        router.push("/operator/dashboard");
      }
    } catch {
      setError("サーバーに接続できません。しばらく経ってから再試行してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-500 rounded-2xl mb-4">
            <span className="text-2xl">🥤</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SCM Beverage</h1>
          <p className="text-gray-400 text-sm mt-1">飲料メーカー 物流管理システム</p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6">ログイン</h2>

          <form onSubmit={handleLogin} className="space-y-4">

            {/* エラーメッセージ */}
            {error && (
              <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* ユーザー名 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                ユーザー名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                placeholder="username"
              />
            </div>

            {/* パスワード */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* ログインボタン */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 disabled:text-teal-600 text-gray-950 font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors mt-2"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        </div>

        {/* ロール説明 */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-500">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="text-gray-300 font-medium mb-1">実務者</div>
            <div>担当拠点の在庫・配送状況の確認と指示</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="text-gray-300 font-medium mb-1">管理者</div>
            <div>マスタ管理・ユーザー管理・全拠点監視</div>
          </div>
        </div>

      </div>
    </div>
  );
}
