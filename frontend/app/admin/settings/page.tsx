"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiFetch } from "@/lib/auth";

interface KpiThreshold {
  id: number;
  kpi_key: string;
  label: string;
  warning_value: number;
  danger_value: number;
  unit: string | null;
  description: string | null;
}

export default function SettingsPage() {
  const [thresholds, setThresholds] = useState<KpiThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<KpiThreshold | null>(null);
  const [form, setForm] = useState({ warning_value: "", danger_value: "" });
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    const res = await apiFetch("/api/kpi-thresholds/");
    const data = await res.json();
    setThresholds(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (t: KpiThreshold) => {
    setEditTarget(t);
    setForm({ warning_value: String(t.warning_value), danger_value: String(t.danger_value) });
    setError("");
    setShowConfirm(false);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/kpi-thresholds/${editTarget.kpi_key}`, {
        method: "PATCH",
        body: JSON.stringify({
          warning_value: Number(form.warning_value),
          danger_value: Number(form.danger_value),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "保存に失敗しました");
        return;
      }
      setEditTarget(null);
      setShowConfirm(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">KPI閾値設定</h1>
        <p className="text-sm text-gray-400 mt-0.5">アラート発火条件の管理（管理者のみ変更可）</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">KPI名</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">説明</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">警告閾値</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">危険閾値</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : thresholds.map((t) => (
              <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="text-gray-300 font-medium">{t.label}</div>
                  <div className="text-xs text-gray-500 font-mono">{t.kpi_key}</div>
                </td>
                <td className="py-3 px-4 text-gray-400 text-xs">{t.description ?? "-"}</td>
                <td className="py-3 px-4 text-right">
                  <span className="text-amber-400 font-medium">{t.warning_value}</span>
                  <span className="text-gray-500 text-xs ml-1">{t.unit}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-red-400 font-medium">{t.danger_value}</span>
                  <span className="text-gray-500 text-xs ml-1">{t.unit}</span>
                </td>
                <td className="py-3 px-4">
                  <button onClick={() => openEdit(t)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    編集
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 編集フォーム（2ステップ） */}
      {editTarget && !showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-1">KPI閾値の編集</h3>
            <p className="text-xs text-gray-400 mb-4">{editTarget.label}（{editTarget.unit}）</p>
            {error && (
              <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  警告閾値　<span className="text-amber-400">（現在: {editTarget.warning_value}{editTarget.unit}）</span>
                </label>
                <input type="number" value={form.warning_value}
                  onChange={(e) => setForm({ ...form, warning_value: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  危険閾値　<span className="text-red-400">（現在: {editTarget.danger_value}{editTarget.unit}）</span>
                </label>
                <input type="number" value={form.danger_value}
                  onChange={(e) => setForm({ ...form, danger_value: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
                キャンセル
              </button>
              <button onClick={() => setShowConfirm(true)}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 text-gray-950 rounded-lg transition-colors">
                内容を確認する →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認ダイアログ */}
      {editTarget && showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">変更内容の確認</h3>
            <div className="bg-gray-800 rounded-lg p-4 space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">KPI</span>
                <span>{editTarget.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">警告閾値</span>
                <span>
                  <span className="text-gray-400 line-through mr-2">{editTarget.warning_value}</span>
                  <span className="text-amber-400">{form.warning_value}{editTarget.unit}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">危険閾値</span>
                <span>
                  <span className="text-gray-400 line-through mr-2">{editTarget.danger_value}</span>
                  <span className="text-red-400">{form.danger_value}{editTarget.unit}</span>
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">この変更はシステム全体のアラート動作に影響します。</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
                ← 戻る
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">
                {saving ? "保存中..." : "確定する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
