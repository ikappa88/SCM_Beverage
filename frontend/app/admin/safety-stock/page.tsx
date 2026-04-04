"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import CsvUploadModal from "@/components/common/CsvUploadModal";
import Toast from "@/components/common/Toast";

interface InventoryRecord {
  id: number;
  quantity: number;
  safety_stock: number;
  max_stock: number;
  location: { id: number; name: string; location_type: string };
  product: { id: number; name: string; code: string; category: string };
}

interface Edit {
  safety_stock: number;
  max_stock: number;
}

export default function SafetyStockPage() {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    apiFetch("/api/inventory/safety-stocks")
      .then((r) => r.json())
      .then((data) => {
        setRecords(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  const handleChange = (id: number, field: keyof Edit, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? getOriginal(id)), [field]: num },
    }));
  };

  const getOriginal = (id: number): Edit => {
    const r = records.find((r) => r.id === id)!;
    return { safety_stock: r.safety_stock, max_stock: r.max_stock };
  };

  const getValue = (id: number, field: keyof Edit): number =>
    edits[id]?.[field] ?? getOriginal(id)[field];

  const changedIds = Object.keys(edits).map(Number).filter((id) => {
    const orig = getOriginal(id);
    return edits[id].safety_stock !== orig.safety_stock || edits[id].max_stock !== orig.max_stock;
  });

  const handleSave = async () => {
    setSaving(true);
    setShowConfirm(false);
    let errorCount = 0;

    for (const id of changedIds) {
      const res = await apiFetch(`/api/inventory/${id}/safety-stock`, {
        method: "PATCH",
        body: JSON.stringify(edits[id]),
      });
      if (!res.ok) errorCount++;
    }

    if (errorCount === 0) {
      // ローカル状態を更新
      setRecords((prev) =>
        prev.map((r) =>
          edits[r.id]
            ? { ...r, safety_stock: edits[r.id].safety_stock, max_stock: edits[r.id].max_stock }
            : r
        )
      );
      setEdits({});
      setMessage({ type: "success", text: `${changedIds.length}件の安全在庫設定を保存しました` });
    } else {
      setMessage({ type: "error", text: `${errorCount}件の更新に失敗しました` });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">安全在庫設定</h1>
          <p className="text-sm text-gray-400 mt-0.5">拠点×商品ごとの安全在庫・最大在庫を設定します</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-teal-700 hover:bg-teal-600 rounded-lg transition-colors"
          >
            ⬆ CSV一括更新
          </button>
          <button
            onClick={() => { const d = new Date().toISOString().slice(0,10); downloadCsv(`safety_stock_${d}.csv`, records, [
              { label: "inventory_id",  value: (r: InventoryRecord) => r.id },
              { label: "safety_stock",  value: (r: InventoryRecord) => r.safety_stock },
              { label: "max_stock",     value: (r: InventoryRecord) => r.max_stock },
              { label: "location_name", value: (r: InventoryRecord) => r.location.name },
              { label: "product_code",  value: (r: InventoryRecord) => r.product.code },
              { label: "product_name",  value: (r: InventoryRecord) => r.product.name },
              { label: "quantity",      value: (r: InventoryRecord) => r.quantity },
            ]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
          >
            ⬇ CSV
          </button>
          <button
            onClick={() => changedIds.length > 0 && setShowConfirm(true)}
            disabled={changedIds.length === 0 || saving}
            className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 text-gray-950 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : `変更を保存${changedIds.length > 0 ? ` (${changedIds.length}件)` : ""}`}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${
          message.type === "success"
            ? "bg-teal-900/50 border border-teal-700 text-teal-300"
            : "bg-red-900/50 border border-red-700 text-red-300"
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">拠点</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">種別</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">現在庫</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium w-36">安全在庫</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium w-36">最大在庫</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-xs">データがありません</td></tr>
            ) : records.map((rec) => {
              const isChanged = !!edits[rec.id] && (
                edits[rec.id].safety_stock !== rec.safety_stock ||
                edits[rec.id].max_stock !== rec.max_stock
              );
              const safetyVal = getValue(rec.id, "safety_stock");
              const maxVal = getValue(rec.id, "max_stock");
              const isInvalid = safetyVal > maxVal;

              return (
                <tr key={rec.id} className={`border-b border-gray-800/50 transition-colors ${
                  isChanged ? "bg-teal-950/20" : "hover:bg-gray-800/30"
                }`}>
                  <td className="py-2 px-4 text-gray-200 text-xs">{rec.location.name}</td>
                  <td className="py-2 px-4 text-gray-400 text-xs">{rec.location.location_type}</td>
                  <td className="py-2 px-4 text-gray-200 text-xs">
                    <span className="font-mono text-gray-500 mr-1">{rec.product.code}</span>
                    {rec.product.name}
                  </td>
                  <td className="py-2 px-4 text-right text-gray-300 text-xs font-mono">
                    {rec.quantity.toLocaleString()}
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="number"
                      min={0}
                      value={safetyVal}
                      onChange={(e) => handleChange(rec.id, "safety_stock", e.target.value)}
                      className={`w-full text-right bg-gray-800 border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-teal-500 ${
                        isInvalid ? "border-red-600 text-red-400" : "border-gray-700 text-gray-200"
                      }`}
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="number"
                      min={0}
                      value={maxVal}
                      onChange={(e) => handleChange(rec.id, "max_stock", e.target.value)}
                      className={`w-full text-right bg-gray-800 border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-teal-500 ${
                        isInvalid ? "border-red-600 text-red-400" : "border-gray-700 text-gray-200"
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600 mt-3">
        * 変更行は緑でハイライトされます。安全在庫 &gt; 最大在庫の場合は赤で警告します。
      </p>

      {showConfirm && (
        <ConfirmDialog
          title="安全在庫設定の保存"
          message={`${changedIds.length}件の安全在庫設定を更新します。よろしいですか？`}
          confirmLabel="保存する"
          onConfirm={handleSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {showUpload && (
        <CsvUploadModal
          title="安全在庫CSV一括更新"
          commitPath="/api/inventory/safety-stocks/bulk"
          formatHint={
            <div className="space-y-1">
              <div className="font-mono text-gray-200">inventory_id,safety_stock,max_stock</div>
              <div className="text-gray-400 mt-1">・ inventory_id：在庫ID（CSVダウンロードで確認可）</div>
              <div className="text-gray-400">・ safety_stock：安全在庫数（0以上の整数）</div>
              <div className="text-gray-400">・ max_stock：最大在庫数（0以上の整数）</div>
            </div>
          }
          onSuccess={(msg) => { setToast({ msg, type: "success" }); }}
          onClose={() => setShowUpload(false)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}
