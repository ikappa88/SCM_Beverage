"use client";
import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import CsvUploadModal from "@/components/common/CsvUploadModal";
import Toast from "@/components/common/Toast";

interface Inventory {
  id: number; location_id: number; product_id: number;
  quantity: number; safety_stock: number; max_stock: number;
  expiry_date: string | null; note: string | null;
  location: { id: number; code: string; name: string; location_type: string };
  product: { id: number; code: string; name: string; category: string };
}

function expiryStatus(expiry_date: string | null): { label: string; color: string } | null {
  if (!expiry_date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry_date);
  const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0)  return { label: "期限切れ",       color: "text-red-400" };
  if (days <= 3) return { label: `残${days}日(緊急)`, color: "text-red-400" };
  if (days <= 7) return { label: `残${days}日`,       color: "text-amber-400" };
  return { label: expiry_date, color: "text-gray-500" };
}

const TYPE_LABELS: Record<string, string> = {
  factory: "工場", dc: "広域DC", tc: "地域TC", retail: "小売",
};

const CSV_COLUMNS = [
  { label: "location_code", value: (r: Inventory) => r.location.code },
  { label: "product_code",  value: (r: Inventory) => r.product.code },
  { label: "quantity",      value: (r: Inventory) => r.quantity },
  { label: "location_name", value: (r: Inventory) => r.location.name },
  { label: "location_type", value: (r: Inventory) => TYPE_LABELS[r.location.location_type] ?? r.location.location_type },
  { label: "product_name",  value: (r: Inventory) => r.product.name },
  { label: "category",      value: (r: Inventory) => r.product.category },
  { label: "safety_stock",  value: (r: Inventory) => r.safety_stock },
  { label: "max_stock",     value: (r: Inventory) => r.max_stock },
  { label: "status",        value: (r: Inventory) => r.quantity <= 0 ? "stockout" : r.quantity < r.safety_stock ? "low_stock" : "ok" },
  { label: "note",          value: (r: Inventory) => r.note ?? "" },
];

export default function AdminInventoryPage() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [editTarget, setEditTarget] = useState<Inventory | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fetchData = async () => {
    const res = await apiFetch("/api/inventory/");
    const data = await res.json();
    setInventories(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const getStatus = (inv: Inventory) => {
    if (inv.quantity <= 0) return { label: "在庫切れ", color: "text-red-400 bg-red-950", key: "danger" };
    if (inv.quantity < inv.safety_stock) return { label: "安全在庫割れ", color: "text-amber-400 bg-amber-950", key: "warning" };
    return { label: "正常", color: "text-green-400 bg-green-950", key: "ok" };
  };

  const filtered = inventories.filter((inv) => {
    const matchSearch = !search || inv.product.name.includes(search) || inv.location.name.includes(search) || inv.product.code.includes(search);
    const status = getStatus(inv);
    const matchStatus = !filterStatus || status.key === filterStatus;
    return matchSearch && matchStatus;
  });

  const openEdit = (inv: Inventory) => {
    setEditTarget(inv);
    setEditQty(String(inv.quantity));
    setEditExpiry(inv.expiry_date ?? "");
    setEditNote(inv.note ?? "");
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/inventory/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: Number(editQty),
          expiry_date: editExpiry || null,
          note: editNote || null,
        }),
      });
      setEditTarget(null);
      fetchData();
    } finally { setSaving(false); }
  };

  const handleDownload = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`inventory_${date}.csv`, filtered, CSV_COLUMNS);
  };

  return (
    <AdminLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">在庫管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">全拠点・全商品の在庫状況を確認・修正</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-teal-700 hover:bg-teal-600 rounded-lg transition-colors"
          >
            ⬆ CSVアップロード
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
          >
            ⬇ CSVダウンロード
          </button>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名・拠点名・商品コードで検索..."
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500 w-72"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500"
        >
          <option value="">すべての状態</option>
          <option value="danger">在庫切れ</option>
          <option value="warning">安全在庫割れ</option>
          <option value="ok">正常</option>
        </select>
        <span className="text-xs text-gray-500 self-center">{filtered.length}件</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">拠点</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">種別</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">カテゴリ</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">現在庫</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">安全在庫</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">最大在庫</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">賞味期限</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="py-8 text-center text-gray-500 text-xs">データがありません</td></tr>
            ) : filtered.map((inv) => {
              const status = getStatus(inv);
              const pct = inv.max_stock > 0 ? Math.min(100, Math.round((inv.quantity / inv.max_stock) * 100)) : 0;
              return (
                <tr key={inv.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-gray-300 text-xs">{inv.location.name}</td>
                  <td className="py-2.5 px-4 text-gray-500 text-xs">{TYPE_LABELS[inv.location.location_type] ?? inv.location.location_type}</td>
                  <td className="py-2.5 px-4 text-gray-300">{inv.product.name}</td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">{inv.product.category}</td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="font-medium">{inv.quantity.toLocaleString()}</div>
                    <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden ml-auto mt-1">
                      <div
                        className={"h-full rounded-full " + (inv.quantity < inv.safety_stock ? "bg-red-500" : "bg-teal-500")}
                        style={{ width: pct + "%" }}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{inv.safety_stock.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{inv.max_stock.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-xs">
                    {(() => {
                      const es = expiryStatus(inv.expiry_date);
                      return es
                        ? <span className={es.color}>{es.label}</span>
                        : <span className="text-gray-600">—</span>;
                    })()}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={"text-xs px-2 py-0.5 rounded-full " + status.color}>{status.label}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <button
                      onClick={() => openEdit(inv)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      在庫修正
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 在庫修正モーダル */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-1">在庫修正</h3>
            <p className="text-xs text-gray-400 mb-4">{editTarget.location.name} / {editTarget.product.name}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  現在庫数　<span className="text-gray-600">（修正前: {editTarget.quantity.toLocaleString()}）</span>
                </label>
                <input
                  type="number" value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  賞味期限　<span className="text-gray-600">（設定すると期限アラートが自動生成されます）</span>
                </label>
                <input
                  type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">備考（任意）</label>
                <input
                  value={editNote} onChange={(e) => setEditNote(e.target.value)}
                  placeholder="修正理由など"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors"
              >
                {saving ? "更新中..." : "確定する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <CsvUploadModal
          title="在庫CSVアップロード"
          previewPath="/api/upload/inventory/preview"
          commitPath="/api/upload/inventory/commit"
          formatHint={
            <div className="space-y-1">
              <div className="font-mono text-gray-200">location_code,product_code,quantity</div>
              <div className="text-gray-400 mt-1">・ location_code：拠点コード（例：TC-01）</div>
              <div className="text-gray-400">・ product_code：商品コード（例：PRD-001）</div>
              <div className="text-gray-400">・ quantity：在庫数量（0以上の整数）</div>
            </div>
          }
          onSuccess={(msg) => { setToast({ msg, type: "success" }); fetchData(); }}
          onClose={() => setShowUpload(false)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}
