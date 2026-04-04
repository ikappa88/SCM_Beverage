"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import Toast from "@/components/common/Toast";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";

interface Scenario {
  id: number;
  code: string;
  name: string;
  description: string | null;
  demand_factor: number;
  cost_factor: number;
  is_active: boolean;
  created_at: string;
}

const EMPTY_FORM = {
  code: "", name: "", description: "",
  demand_factor: "1.00", cost_factor: "1.00",
};

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Scenario | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirm, setConfirm] = useState<{ target: Scenario } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fetchScenarios = async () => {
    const res = await apiFetch("/api/scenarios/");
    const data = await res.json();
    setScenarios(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchScenarios(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (s: Scenario) => {
    setEditTarget(s);
    setForm({
      code: s.code, name: s.name,
      description: s.description ?? "",
      demand_factor: String(s.demand_factor),
      cost_factor: String(s.cost_factor),
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        demand_factor: parseFloat(form.demand_factor),
        cost_factor: parseFloat(form.cost_factor),
        description: form.description || null,
      };
      const res = editTarget
        ? await apiFetch(`/api/scenarios/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/api/scenarios/", { method: "POST", body: JSON.stringify(body) });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "保存に失敗しました");
        return;
      }
      setShowForm(false);
      setToast({ msg: editTarget ? "シナリオを更新しました" : "シナリオを登録しました", type: "success" });
      fetchScenarios();
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (s: Scenario) => {
    const res = await apiFetch(`/api/scenarios/${s.id}`, { method: "DELETE" });
    setConfirm(null);
    if (res.ok) {
      setToast({ msg: `「${s.name}」を無効化しました`, type: "success" });
      fetchScenarios();
    } else {
      setToast({ msg: "無効化に失敗しました", type: "error" });
    }
  };

  const fmtFactor = (v: number) => {
    const pct = ((v - 1) * 100).toFixed(0);
    const sign = v >= 1 ? "+" : "";
    return `×${Number(v).toFixed(2)} (${sign}${pct}%)`;
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">シナリオ管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">需要変動・コスト変動シナリオの登録・管理</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { const d = new Date().toISOString().slice(0,10); downloadCsv(`scenarios_${d}.csv`, scenarios, [
            { label: "コード",       value: (r: Scenario) => r.code },
            { label: "名称",         value: (r: Scenario) => r.name },
            { label: "需要係数",     value: (r: Scenario) => r.demand_factor },
            { label: "コスト係数",   value: (r: Scenario) => r.cost_factor },
            { label: "状態",         value: (r: Scenario) => r.is_active ? "有効" : "無効" },
            { label: "説明",         value: (r: Scenario) => r.description ?? "" },
          ]); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors">
            ⬇ CSV
          </button>
          <button onClick={openCreate} className="bg-teal-500 hover:bg-teal-400 text-gray-950 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + 新規登録
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">コード</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">シナリオ名</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">説明</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">需要係数</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">コスト係数</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : scenarios.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-500 text-xs">シナリオがありません</td></tr>
            ) : scenarios.map((s) => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 text-gray-200 text-xs font-mono">{s.code}</td>
                <td className="py-2.5 px-4 text-gray-200 text-sm font-medium">{s.name}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs max-w-xs truncate">{s.description ?? "-"}</td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-mono ${s.demand_factor > 1 ? "text-amber-400" : s.demand_factor < 1 ? "text-blue-400" : "text-gray-400"}`}>
                    {fmtFactor(s.demand_factor)}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs font-mono ${s.cost_factor > 1 ? "text-red-400" : s.cost_factor < 1 ? "text-teal-400" : "text-gray-400"}`}>
                    {fmtFactor(s.cost_factor)}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"}`}>
                    {s.is_active ? "有効" : "無効"}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex gap-2">
                    {s.is_active && (
                      <>
                        <button onClick={() => openEdit(s)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">編集</button>
                        <button onClick={() => setConfirm({ target: s })} className="text-xs text-red-400 hover:text-red-300 transition-colors">無効化</button>
                      </>
                    )}
                    {!s.is_active && <span className="text-xs text-gray-600">無効</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 登録・編集フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-base font-semibold mb-4">
              {editTarget ? "シナリオの編集" : "シナリオの新規登録"}
            </h3>
            {error && <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">シナリオコード</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={!!editTarget}
                    placeholder="例: SCN-HIGH-DEMAND"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">シナリオ名</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="例: 需要20%増シナリオ"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">説明（任意）</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">需要係数 <span className="text-gray-600">（1.20 = 需要20%増）</span></label>
                  <input
                    type="number" step="0.01" min="0.01" max="9.99"
                    value={form.demand_factor}
                    onChange={(e) => setForm({ ...form, demand_factor: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">コスト係数 <span className="text-gray-600">（0.90 = コスト10%減）</span></label>
                  <input
                    type="number" step="0.01" min="0.01" max="9.99"
                    value={form.cost_factor}
                    onChange={(e) => setForm({ ...form, cost_factor: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 無効化確認 */}
      {confirm && (
        <ConfirmDialog
          title="シナリオを無効化しますか？"
          message={`「${confirm.target.name}」を無効化します。このシナリオを使用中の計画に影響が出る場合があります。`}
          confirmLabel="無効化する"
          danger
          onConfirm={() => handleDeactivate(confirm.target)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}
