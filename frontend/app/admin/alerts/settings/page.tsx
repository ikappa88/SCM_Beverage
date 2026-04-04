"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiFetch } from "@/lib/auth";

interface AlertSetting {
  id: number;
  setting_key: string;
  label: string;
  value: number;
  description: string | null;
  updated_at: string;
}

export default function AlertSettingsPage() {
  const [settings, setSettings] = useState<AlertSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/alerts/settings");
      if (!res.ok) { setError("設定の取得に失敗しました"); return; }
      const data: AlertSetting[] = await res.json();
      setSettings(data);
      // 編集値を初期化
      const init: Record<string, number> = {};
      data.forEach((s) => { init[s.setting_key] = s.value; });
      setEditing(init);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (setting: AlertSetting) => {
    const newValue = editing[setting.setting_key];
    if (newValue === setting.value) return;
    setSaving(setting.setting_key);
    setError("");
    try {
      const res = await apiFetch(`/api/alerts/settings/${setting.setting_key}`, {
        method: "PATCH",
        body: JSON.stringify({ value: newValue }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "更新に失敗しました");
        return;
      }
      setSaved(setting.setting_key);
      setTimeout(() => setSaved(null), 2000);
      await fetchSettings();
    } finally {
      setSaving(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">アラートしきい値設定</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          アラートが自動生成される条件を管理します。
        </p>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">読み込み中...</div>
      ) : settings.length === 0 ? (
        <div className="py-16 text-center text-gray-500 text-sm">
          設定データがありません。マイグレーションを実行してください。
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {settings.map((s) => (
            <div
              key={s.setting_key}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-200">{s.label}</div>
                  {s.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    最終更新: {new Date(s.updated_at).toLocaleString("ja-JP")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={editing[s.setting_key] ?? s.value}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [s.setting_key]: Number(e.target.value),
                      }))
                    }
                    className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-center text-gray-200 focus:outline-none focus:border-teal-600"
                  />
                  <span className="text-xs text-gray-500">日</span>
                  <button
                    onClick={() => handleSave(s)}
                    disabled={
                      saving === s.setting_key ||
                      editing[s.setting_key] === s.value
                    }
                    className="px-3 py-1.5 text-xs rounded-lg transition-colors bg-teal-900 text-teal-300 hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving === s.setting_key
                      ? "保存中..."
                      : saved === s.setting_key
                      ? "✓ 保存済"
                      : "保存"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 説明カード */}
      <div className="mt-8 max-w-2xl bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
        <p className="font-medium text-gray-400">しきい値の説明</p>
        <p>
          <span className="text-amber-400">賞味期限警告（日前）</span>：
          設定した日数以内に賞味期限を迎える在庫に「警告」アラートを発生させます。
        </p>
        <p>
          <span className="text-red-400">賞味期限緊急（日前）</span>：
          さらにこの日数以内になると「緊急」に昇格します。警告日数より小さい値を設定してください。
        </p>
        <p className="text-gray-600">
          アラートは5分間隔で自動評価されます。在庫の賞味期限日は在庫照会画面から更新できます。
        </p>
      </div>
    </AdminLayout>
  );
}
