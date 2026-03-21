"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import MasterTable from "@/components/admin/MasterTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { apiFetch } from "@/lib/auth";

interface Location {
  id: number;
  code: string;
  name: string;
  location_type: string;
  area: string | null;
  address: string | null;
  capacity: number | null;
  is_active: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  factory: "工場", dc: "広域DC", tc: "地域TC", retail: "小売",
};

const EMPTY_FORM = {
  code: "", name: "", location_type: "tc", area: "", address: "", capacity: "",
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirm, setConfirm] = useState<{ target: Location } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchLocations = async () => {
    const res = await apiFetch("/api/locations/");
    const data = await res.json();
    setLocations(data);
    setLoading(false);
  };

  useEffect(() => { fetchLocations(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (loc: Location) => {
    setEditTarget(loc);
    setForm({
      code: loc.code, name: loc.name, location_type: loc.location_type,
      area: loc.area ?? "", address: loc.address ?? "",
      capacity: loc.capacity ? String(loc.capacity) : "",
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
        capacity: form.capacity ? Number(form.capacity) : null,
      };
      const res = editTarget
        ? await apiFetch(`/api/locations/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/api/locations/", { method: "POST", body: JSON.stringify(body) });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "保存に失敗しました");
        return;
      }
      setShowForm(false);
      fetchLocations();
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (loc: Location) => {
    await apiFetch(`/api/locations/${loc.id}`, { method: "DELETE" });
    setConfirm(null);
    fetchLocations();
  };

  const columns = [
    { key: "code", label: "拠点コード" },
    { key: "name", label: "拠点名" },
    { key: "location_type", label: "種別", render: (row: Location) => TYPE_LABELS[row.location_type] ?? row.location_type },
    { key: "area", label: "エリア", render: (row: Location) => row.area ?? "-" },
    { key: "capacity", label: "キャパシティ", render: (row: Location) => row.capacity?.toLocaleString() ?? "-" },
    { key: "is_active", label: "状態", render: (row: Location) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${row.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"}`}>
        {row.is_active ? "有効" : "無効"}
      </span>
    )},
  ];

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">拠点マスタ</h1>
          <p className="text-sm text-gray-400 mt-0.5">工場・DC・TC・小売拠点の管理</p>
        </div>
        <button onClick={openCreate} className="bg-teal-500 hover:bg-teal-400 text-gray-950 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + 新規登録
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        {loading ? (
          <p className="text-gray-400 text-sm">読み込み中...</p>
        ) : (
          <MasterTable
            columns={columns}
            data={locations}
            onEdit={openEdit}
            onDeactivate={(loc) => setConfirm({ target: loc })}
          />
        )}
      </div>

      {/* 登録・編集フォーム */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-base font-semibold mb-4">
              {editTarget ? "拠点情報の編集" : "拠点の新規登録"}
            </h3>
            {error && <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">拠点コード</label>
                  <input
                    value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={!!editTarget}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">種別</label>
                  <select
                    value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })}
                    disabled={!!editTarget}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
                  >
                    <option value="factory">工場</option>
                    <option value="dc">広域DC</option>
                    <option value="tc">地域TC</option>
                    <option value="retail">小売</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">拠点名</label>
                <input
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">エリア</label>
                  <input
                    value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">キャパシティ</label>
                  <input
                    type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">所在地</label>
                <input
                  value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
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

      {/* 無効化確認ダイアログ */}
      {confirm && (
        <ConfirmDialog
          title="拠点を無効化しますか？"
          message={`「${confirm.target.name}」を無効化します。過去データは保持されますが、新規操作には使用できなくなります。`}
          confirmLabel="無効化する"
          danger
          onConfirm={() => handleDeactivate(confirm.target)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AdminLayout>
  );
}
