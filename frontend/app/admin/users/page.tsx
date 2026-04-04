"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: "operator" | "administrator";
  is_active: boolean;
  assigned_location_ids: string | null;
  assigned_category_ids: string | null;
}

interface Location {
  id: number;
  code: string;
  name: string;
  location_type: string;
}

const EMPTY_FORM = {
  username: "",
  email: "",
  full_name: "",
  role: "operator" as "operator" | "administrator",
  password: "",
  assigned_location_ids: "",
  assigned_category_ids: "",
};

const ROLE_LABELS = { operator: "実務者", administrator: "管理者" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirm, setConfirm] = useState<{ target: User } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [usersRes, locsRes] = await Promise.all([
      apiFetch("/api/users/"),
      apiFetch("/api/locations/"),
    ]);
    setUsers(await usersRes.json());
    setLocations(await locsRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setForm({
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      password: "",
      assigned_location_ids: u.assigned_location_ids ?? "",
      assigned_category_ids: u.assigned_category_ids ?? "",
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        username: form.username,
        email: form.email,
        full_name: form.full_name,
        role: form.role,
        assigned_location_ids: form.assigned_location_ids || null,
        assigned_category_ids: form.assigned_category_ids || null,
      };
      if (!editTarget) {
        body.password = form.password;
      }
      const res = editTarget
        ? await apiFetch(`/api/users/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/api/users/", { method: "POST", body: JSON.stringify(body) });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "保存に失敗しました");
        return;
      }
      setShowForm(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (u: User) => {
    await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
    setConfirm(null);
    fetchData();
  };

  const getLocationName = (ids: string | null) => {
    if (!ids) return "-";
    return ids.split(",").map((id) => {
      const loc = locations.find((l) => String(l.id) === id.trim());
      return loc ? loc.name : id;
    }).join(", ");
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">ユーザー管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">アカウント・権限・担当範囲の管理</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { const d = new Date().toISOString().slice(0,10); downloadCsv(`users_${d}.csv`, users, [
              { label: "ユーザー名", value: (r: User) => r.username },
              { label: "氏名",       value: (r: User) => r.full_name },
              { label: "メール",     value: (r: User) => r.email },
              { label: "ロール",     value: (r: User) => r.role === "administrator" ? "管理者" : "実務者" },
              { label: "状態",       value: (r: User) => r.is_active ? "有効" : "無効" },
              { label: "担当拠点ID", value: (r: User) => r.assigned_location_ids ?? "" },
              { label: "担当カテゴリ", value: (r: User) => r.assigned_category_ids ?? "" },
            ]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
          >
            ⬇ CSV
          </button>
          <button onClick={openCreate}
          className="bg-teal-500 hover:bg-teal-400 text-gray-950 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + 新規作成
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">氏名</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">ユーザー名</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">メール</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">ロール</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">担当拠点</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 text-gray-300 font-medium">{u.full_name}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs font-mono">{u.username}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{u.email}</td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.role === "administrator"
                      ? "bg-purple-900 text-purple-300"
                      : "bg-blue-900 text-blue-300"
                  }`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">
                  {u.role === "administrator" ? "全拠点" : getLocationName(u.assigned_location_ids)}
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"
                  }`}>
                    {u.is_active ? "有効" : "無効"}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex gap-2">
                    {u.is_active && (
                      <button onClick={() => openEdit(u)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        編集
                      </button>
                    )}
                    {u.is_active && (
                      <button onClick={() => setConfirm({ target: u })}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors">
                        無効化
                      </button>
                    )}
                    {!u.is_active && (
                      <span className="text-xs text-gray-600">無効</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h3 className="text-base font-semibold mb-4">
              {editTarget ? "ユーザー情報の編集" : "ユーザーの新規作成"}
            </h3>
            {error && (
              <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">ユーザー名</label>
                  <input value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    disabled={!!editTarget}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">ロール</label>
                  <select value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as "operator" | "administrator" })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="operator">実務者</option>
                    <option value="administrator">管理者</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">氏名</label>
                <input value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">メールアドレス</label>
                <input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              {!editTarget && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">パスワード</label>
                  <input type="password" value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
              )}
              {form.role === "operator" && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">担当拠点</label>
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        const current = form.assigned_location_ids ? form.assigned_location_ids.split(",").map(s => s.trim()) : [];
                        if (!current.includes(val)) {
                          setForm({ ...form, assigned_location_ids: [...current, val].filter(Boolean).join(",") });
                        }
                      }}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                      <option value="">拠点を追加...</option>
                      {locations.filter(l => l.location_type !== "retail").map((loc) => (
                        <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                      ))}
                    </select>
                    {form.assigned_location_ids && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {form.assigned_location_ids.split(",").filter(Boolean).map((id) => {
                          const loc = locations.find(l => String(l.id) === id.trim());
                          return (
                            <span key={id} className="flex items-center gap-1 text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                              {loc ? loc.name : id}
                              <button onClick={() => {
                                const updated = form.assigned_location_ids.split(",").filter(i => i.trim() !== id.trim());
                                setForm({ ...form, assigned_location_ids: updated.join(",") });
                              }} className="text-gray-500 hover:text-red-400">×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">担当商品カテゴリ（カンマ区切り）</label>
                    <input value={form.assigned_category_ids}
                      onChange={(e) => setForm({ ...form, assigned_category_ids: e.target.value })}
                      placeholder="cola,tea,sports"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
                キャンセル
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="ユーザーを無効化しますか？"
          message={`「${confirm.target.full_name}」を無効化します。このユーザーはログインできなくなります。`}
          confirmLabel="無効化する"
          danger
          onConfirm={() => handleDeactivate(confirm.target)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AdminLayout>
  );
}
