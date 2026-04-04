"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import CsvUploadModal from "@/components/common/CsvUploadModal";
import Toast from "@/components/common/Toast";

interface Inventory {
  id: number; location_id: number; product_id: number; quantity: number;
  safety_stock: number; max_stock: number; expiry_date: string | null; note: string | null;
  is_readonly: boolean;
  location: { id: number; code: string; name: string; location_type: string };
  product: { id: number; code: string; name: string; category: string };
}

function expiryStatus(expiry_date: string | null): { label: string; color: string } | null {
  if (!expiry_date) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry_date);
  const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0)  return { label: "期限切れ",        color: "text-red-400" };
  if (days <= 3) return { label: `残${days}日(緊急)`, color: "text-red-400" };
  if (days <= 7) return { label: `残${days}日`,       color: "text-amber-400" };
  return { label: expiry_date, color: "text-gray-500" };
}

export default function InventoryPage() {
  const searchParams = useSearchParams();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Inventory | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showUpstream, setShowUpstream] = useState(false);

  const fetchData = async () => {
    const res = await apiFetch("/api/inventory/?include_upstream=true");
    const data = await res.json();
    setInventories(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  // URLパラメータによるフィルタ初期値（アラートクイックリンクから遷移時）
  useEffect(() => {
    const locId = searchParams.get("location_id");
    const prodId = searchParams.get("product_id");
    if (locId || prodId) {
      const loc = inventories.find((inv) => String(inv.location_id) === locId);
      const prod = inventories.find((inv) => String((inv as unknown as {product_id: number}).product_id) === prodId);
      const terms: string[] = [];
      if (loc) terms.push(loc.location.name);
      if (prod) terms.push(prod.product.name);
      if (terms.length > 0) setSearch(terms[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, inventories]);

  const ownInventories = inventories.filter((inv) => !inv.is_readonly);
  const upstreamInventories = inventories.filter((inv) => inv.is_readonly);

  const filtered = ownInventories.filter((inv) =>
    inv.product.name.includes(search) || inv.location.name.includes(search) || inv.product.category.includes(search)
  );
  const filteredUpstream = upstreamInventories.filter((inv) =>
    inv.product.name.includes(search) || inv.location.name.includes(search) || inv.product.category.includes(search)
  );

  const openEdit = (inv: Inventory) => {
    setEditTarget(inv);
    setEditQty(String(inv.quantity));
    setEditExpiry(inv.expiry_date ?? "");
    setEditNote(inv.note ?? "");
    setShowConfirm(false);
  };
  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiFetch("/api/inventory/" + editTarget.id, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: Number(editQty),
          expiry_date: editExpiry || null,
          note: editNote || null,
        }),
      });
      setEditTarget(null); fetchData();
    } finally { setSaving(false); }
  };
  const getStatus = (inv: Inventory) => {
    if (inv.quantity <= 0) return { label: "在庫切れ", color: "text-red-400 bg-red-950" };
    if (inv.quantity < inv.safety_stock) return { label: "安全在庫割れ", color: "text-amber-400 bg-amber-950" };
    return { label: "正常", color: "text-green-400 bg-green-950" };
  };

  const InventoryTable = ({ rows, readonly }: { rows: Inventory[]; readonly?: boolean }) => (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden ${readonly ? "border-gray-700/50" : "border-gray-800"}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">拠点</th>
            <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品</th>
            <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">カテゴリ</th>
            <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">現在庫</th>
            <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">安全在庫</th>
            <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">賞味期限</th>
            <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
            {!readonly && <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={readonly ? 7 : 8} className="py-6 text-center text-gray-500 text-xs">データがありません</td></tr>
          ) : rows.map((inv) => {
            const pct = Math.min(100, Math.round((inv.quantity / Math.max(inv.max_stock, 1)) * 100));
            const status = getStatus(inv);
            return (
              <tr key={inv.id} className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${readonly ? "opacity-70" : ""}`}>
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
                <td className="py-2.5 px-4 text-xs">
                  {(() => {
                    const es = expiryStatus(inv.expiry_date);
                    return es ? <span className={es.color}>{es.label}</span> : <span className="text-gray-600">—</span>;
                  })()}
                </td>
                <td className="py-2.5 px-4">
                  <span className={"text-xs px-2 py-0.5 rounded-full " + status.color}>{status.label}</span>
                </td>
                {!readonly && (
                  <td className="py-2.5 px-4">
                    <button onClick={() => openEdit(inv)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">在庫修正</button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <OperatorLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">在庫照会</h1>
          <p className="text-sm text-gray-400 mt-0.5">担当拠点の在庫状況と在庫修正</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-teal-700 hover:bg-teal-600 rounded-lg transition-colors"
          >
            ⬆ CSVアップロード
          </button>
          <button
            onClick={() => { const d = new Date().toISOString().slice(0,10); downloadCsv(`inventory_${d}.csv`, filtered, [
              { label: "location_code", value: (r: Inventory) => r.location.code },
              { label: "product_code",  value: (r: Inventory) => r.product.code },
              { label: "quantity",      value: (r: Inventory) => r.quantity },
              { label: "location_name", value: (r: Inventory) => r.location.name },
              { label: "product_name",  value: (r: Inventory) => r.product.name },
              { label: "category",      value: (r: Inventory) => r.product.category },
              { label: "safety_stock",  value: (r: Inventory) => r.safety_stock },
              { label: "max_stock",     value: (r: Inventory) => r.max_stock },
              { label: "status",        value: (r: Inventory) => r.quantity <= 0 ? "stockout" : r.quantity < r.safety_stock ? "low_stock" : "ok" },
            ]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
          >
            ⬇ CSV
          </button>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="商品名・拠点名で検索..."
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 w-60" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">読み込み中...</div>
      ) : (
        <>
          {/* 自拠点在庫テーブル */}
          <InventoryTable rows={filtered} />

          {/* 補充元（上流）拠点の在庫 */}
          {upstreamInventories.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowUpstream((v) => !v)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-3 transition-colors"
              >
                <span>{showUpstream ? "▼" : "▶"}</span>
                補充元拠点の在庫
                <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700 ml-1">
                  閲覧専用
                </span>
                <span className="text-xs text-gray-600">
                  （{upstreamInventories.length}件 / {[...new Set(upstreamInventories.map((i) => i.location.name))].join("、")}）
                </span>
              </button>
              {showUpstream && (
                <InventoryTable rows={filteredUpstream} readonly />
              )}
            </div>
          )}
        </>
      )}

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
                <label className="block text-xs text-gray-400 mb-1">
                  賞味期限　<span className="text-gray-600">（設定すると期限アラートが自動生成されます）</span>
                </label>
                <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)}
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
              <div className="flex justify-between"><span className="text-gray-400">賞味期限</span><span className="text-xs">{editExpiry || "—"}</span></div>
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
    </OperatorLayout>
  );
}
