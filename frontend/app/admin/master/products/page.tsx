"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import MasterTable from "@/components/admin/MasterTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { apiFetch } from "@/lib/auth";

interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  unit_size: string | null;
  min_order_qty: number;
  weight_kg: number | null;
  is_active: boolean;
}

const EMPTY_FORM = {
  code: "", name: "", category: "", unit_size: "", min_order_qty: "1", weight_kg: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirm, setConfirm] = useState<{ target: Product } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    const res = await apiFetch("/api/products/");
    setProducts(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditTarget(p);
    setForm({
      code: p.code, name: p.name, category: p.category,
      unit_size: p.unit_size ?? "", min_order_qty: String(p.min_order_qty),
      weight_kg: p.weight_kg ? String(p.weight_kg) : "",
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
        min_order_qty: Number(form.min_order_qty),
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      };
      const res = editTarget
        ? await apiFetch(`/api/products/${editTarget.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch("/api/products/", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "保存に失敗しました");
        return;
      }
      setShowForm(false);
      fetchProducts();
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (p: Product) => {
    await apiFetch(`/api/products/${p.id}`, { method: "DELETE" });
    setConfirm(null);
    fetchProducts();
  };

  const columns = [
    { key: "code", label: "商品コード" },
    { key: "name", label: "商品名" },
    { key: "category", label: "カテゴリ" },
    { key: "unit_size", label: "容量", render: (r: Product) => r.unit_size ?? "-" },
    { key: "min_order_qty", label: "最小発注単位" },
    { key: "is_active", label: "状態", render: (r: Product) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${r.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"}`}>
        {r.is_active ? "有効" : "無効"}
      </span>
    )},
  ];

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">商品マスタ</h1>
          <p className="text-sm text-gray-400 mt-0.5">取り扱い商品の管理</p>
        </div>
        <button onClick={openCreate} className="bg-teal-500 hover:bg-teal-400 text-gray-950 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + 新規登録
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        {loading ? <p className="text-gray-400 text-sm">読み込み中...</p> : (
          <MasterTable columns={columns} data={products} onEdit={openEdit} onDeactivate={(p) => setConfirm({ target: p })} />
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-base font-semibold mb-4">{editTarget ? "商品情報の編集" : "商品の新規登録"}</h3>
            {error && <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">商品コード</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={!!editTarget}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">カテゴリ</label>
                  <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">商品名</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">容量</label>
                  <input value={form.unit_size} onChange={(e) => setForm({ ...form, unit_size: e.target.value })}
                    placeholder="500ml"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">最小発注単位</label>
                  <input type="number" value={form.min_order_qty} onChange={(e) => setForm({ ...form, min_order_qty: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">重量(kg)</label>
                  <input type="number" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="商品を無効化しますか？"
          message={`「${confirm.target.name}」を無効化します。`}
          confirmLabel="無効化する" danger
          onConfirm={() => handleDeactivate(confirm.target)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AdminLayout>
  );
}
