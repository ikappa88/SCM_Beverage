"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import MasterTable from "@/components/admin/MasterTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { apiFetch } from "@/lib/auth";
interface Loc { id: number; code: string; name: string; }
interface Route { id: number; code: string; origin_id: number; destination_id: number; origin: Loc; destination: Loc; lead_time_days: number; cost_per_unit: number | null; is_active: boolean; }
const EMPTY = { code: "", origin_id: "", destination_id: "", lead_time_days: "1", cost_per_unit: "" };
export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Route | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState<{ target: Route } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fetchData = async () => {
    const [rr, lr] = await Promise.all([apiFetch("/api/routes/"), apiFetch("/api/locations/")]);
    setRoutes(await rr.json());
    setLocations(await lr.json());
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);
  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setError(""); setShowForm(true); };
  const openEdit = (r: Route) => {
    setEditTarget(r);
    setForm({ code: r.code, origin_id: String(r.origin_id), destination_id: String(r.destination_id), lead_time_days: String(r.lead_time_days), cost_per_unit: r.cost_per_unit ? String(r.cost_per_unit) : "" });
    setError(""); setShowForm(true);
  };
  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const body = { code: form.code, origin_id: Number(form.origin_id), destination_id: Number(form.destination_id), lead_time_days: Number(form.lead_time_days), cost_per_unit: form.cost_per_unit ? Number(form.cost_per_unit) : null };
      const res = editTarget ? await apiFetch(`/api/routes/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(body) }) : await apiFetch("/api/routes/", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setError(d.detail || "保存に失敗しました"); return; }
      setShowForm(false); fetchData();
    } finally { setSaving(false); }
  };
  const handleDeactivate = async (r: Route) => { await apiFetch(`/api/routes/${r.id}`, { method: "DELETE" }); setConfirm(null); fetchData(); };
  const columns = [
    { key: "code", label: "ルートコード" },
    { key: "origin", label: "出発拠点", render: (r: Route) => r.origin?.name ?? "-" },
    { key: "destination", label: "到着拠点", render: (r: Route) => r.destination?.name ?? "-" },
    { key: "lead_time_days", label: "リードタイム(日)" },
    { key: "cost_per_unit", label: "コスト原単位", render: (r: Route) => r.cost_per_unit ? "¥" + r.cost_per_unit : "-" },
    { key: "is_active", label: "状態", render: (r: Route) => <span className={"text-xs px-2 py-0.5 rounded-full " + (r.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500")}>{r.is_active ? "有効" : "無効"}</span> },
  ];
  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold">ルートマスタ</h1><p className="text-sm text-gray-400 mt-0.5">拠点間の輸送ルート管理</p></div>
        <button onClick={openCreate} className="bg-teal-500 hover:bg-teal-400 text-gray-950 text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ 新規登録</button>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        {loading ? <p className="text-gray-400 text-sm">読み込み中...</p> : <MasterTable columns={columns} data={routes} onEdit={openEdit} onDeactivate={(r) => setConfirm({ target: r })} />}
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-base font-semibold mb-4">{editTarget ? "ルート情報の編集" : "ルートの新規登録"}</h3>
            {error && <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
            <div className="space-y-3">
              <div><label className="block text-xs text-gray-400 mb-1">ルートコード</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editTarget} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">出発拠点</label><select value={form.origin_id} onChange={(e) => setForm({ ...form, origin_id: e.target.value })} disabled={!!editTarget} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"><option value="">選択してください</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div><label className="block text-xs text-gray-400 mb-1">到着拠点</label><select value={form.destination_id} onChange={(e) => setForm({ ...form, destination_id: e.target.value })} disabled={!!editTarget} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"><option value="">選択してください</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">リードタイム（日）</label><input type="number" value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">コスト原単位（¥）</label><input type="number" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" /></div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">{saving ? "保存中..." : "保存する"}</button>
            </div>
          </div>
        </div>
      )}
      {confirm && <ConfirmDialog title="ルートを無効化しますか？" message={"「" + confirm.target.code + "」を無効化します。"} confirmLabel="無効化する" danger onConfirm={() => handleDeactivate(confirm.target)} onCancel={() => setConfirm(null)} />}
    </AdminLayout>
  );
}
