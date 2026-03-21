"use client";
import { useEffect, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";

interface Inventory {
  id: number; location_id: number; product_id: number; quantity: number;
  safety_stock: number; max_stock: number; note: string | null;
  location: { id: number; code: string; name: string; location_type: string };
  product: { id: number; code: string; name: string; category: string };
}

export default function InventoryPage() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Inventory | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchData = async () => {
    const res = await apiFetch("/api/inventory/");
    setInventories(await res.json());
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = inventories.filter((inv) =>
    inv.product.name.includes(search) || inv.location.name.includes(search) || inv.product.category.includes(search)
  );
  const openEdit = (inv: Inventory) => {
    setEditTarget(inv); setEditQty(String(inv.quantity));
    setEditNote(inv.note ?? ""); setShowConfirm(false);
  };
  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiFetch("/api/inventory/" + editTarget.id, {
        method: "PATCH",
        body: JSON.stringify({ quantity: Number(editQty), note: editNote || null }),
      });
      setEditTarget(null); fetchData();
    } finally { setSaving(false); }
  };
  const getStatus = (inv: Inventory) => {
    if (inv.quantity <= 0) return { label: "在庫切れ", color: "text-red-400 bg-red-950" };
    if (inv.quantity < inv.safety_stock) return { label: "安全在庫割れ", color: "text-amber-400 bg-amber-950" };
    return { label: "正常", color: "text-green-400 bg-green-950" };
  };

  return (
    <OperatorLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">在庫照会</h1>
          <p className="text-sm text-gray-400 mt-0.5">担当拠点の在庫状況と在庫修正</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名・拠点名で検索..."
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 w-60" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">拠点</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">カテゴリ</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">現在庫</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">安全在庫</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : filtered.map((inv) => {
              const pct = Math.min(100, Math.round((inv.quantity / inv.max_stock) * 100));
              const status = getStatus(inv);
              return (
                <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-gray-300 text-xs">{inv.location.name}</td>
                  <td className="py-2.5 px-4 text-gray-300">{inv.product.name}</td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">{inv.product.category}</td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="font-medium">{inv.quantity.toLocaleString()}</div>
                    <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden ml-auto mt-1">
                      <div className={"h-full rounded-full " + (inv.quantity < inv.safety_stock ? "bg-red-500" : "bg-teal-500")} style={{ width: pct + "%" }} />
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{inv.safety_stock.toLocaleString()}</td>
                  <td className="py-2.5 px-4">
                    <span className={"text-xs px-2 py-0.5 rounded-full " + status.color}>{status.label}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <button onClick={() => openEdit(inv)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">在庫修正</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editTarget && !showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-1">在庫修正</h3>
            <p className="text-xs text-gray-400 mb-4">{editTarget.location.name} / {editTarget.product.name}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  現在庫数　<span className="text-gray-600">（修正前: {editTarget.quantity.toLocaleString()}）</span>
                </label>
                <input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">備考（任意）</label>
                <input value={editNote} onChange={(e) => setEditNote(e.target.value)}
                  placeholder="修正理由など"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">キャンセル</button>
              <button onClick={() => setShowConfirm(true)} className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 text-gray-950 rounded-lg transition-colors">内容を確認する →</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">修正内容の確認</h3>
            <div className="bg-gray-800 rounded-lg p-4 space-y-2 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">拠点</span><span>{editTarget.location.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">商品</span><span>{editTarget.product.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">修正前</span><span className="text-gray-400">{editTarget.quantity.toLocaleString()}</span></div>
              <div className="flex justify-between font-medium"><span className="text-gray-400">修正後</span><span className="text-teal-400">{Number(editQty).toLocaleString()}</span></div>
              {editNote && <div className="flex justify-between"><span className="text-gray-400">備考</span><span className="text-xs">{editNote}</span></div>}
            </div>
            <p className="text-xs text-gray-500 mb-4">この内容で在庫を更新します。よろしいですか？</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">← 戻る</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">
                {saving ? "更新中..." : "確定する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </OperatorLayout>
  );
}
