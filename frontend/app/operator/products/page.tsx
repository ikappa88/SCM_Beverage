"use client";
import { useEffect, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import CsvUploadModal from "@/components/common/CsvUploadModal";
import Toast from "@/components/common/Toast";

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

const CSV_COLUMNS = [
  { label: "商品コード",     value: (r: Product) => r.code },
  { label: "商品名",         value: (r: Product) => r.name },
  { label: "カテゴリ",       value: (r: Product) => r.category },
  { label: "容量",           value: (r: Product) => r.unit_size ?? "" },
  { label: "最小発注単位",   value: (r: Product) => r.min_order_qty },
  { label: "重量(kg)",       value: (r: Product) => r.weight_kg ?? "" },
  { label: "状態",           value: (r: Product) => r.is_active ? "有効" : "無効" },
];

export default function OperatorProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const fetchData = async () => {
    const res = await apiFetch("/api/products/");
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = products.filter((p) =>
    !search || p.name.includes(search) || p.code.includes(search) || p.category.includes(search)
  );

  return (
    <OperatorLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">商品マスタ</h1>
          <p className="text-sm text-gray-400 mt-0.5">取り扱い商品の一覧</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-teal-700 hover:bg-teal-600 rounded-lg transition-colors"
          >
            ⬆ CSVアップロード
          </button>
          <button
            onClick={() => { const d = new Date().toISOString().slice(0, 10); downloadCsv(`products_${d}.csv`, filtered, CSV_COLUMNS); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
          >
            ⬇ CSV
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="商品名・コード・カテゴリで検索..."
          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal-500 w-64"
        />
        <span className="text-xs text-gray-500 self-center">{filtered.length}件</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品コード</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品名</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">カテゴリ</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">容量</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">最小発注単位</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">重量(kg)</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-500 text-xs">データがありません</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 text-gray-400 text-xs font-mono">{p.code}</td>
                <td className="py-2.5 px-4 text-gray-200">{p.name}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{p.category}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{p.unit_size ?? "-"}</td>
                <td className="py-2.5 px-4 text-right text-gray-300 text-xs">{p.min_order_qty}</td>
                <td className="py-2.5 px-4 text-right text-gray-400 text-xs">{p.weight_kg ?? "-"}</td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"}`}>
                    {p.is_active ? "有効" : "無効"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <CsvUploadModal
          title="商品マスタCSVアップロード"
          commitPath="/api/upload/products"
          formatHint={
            <div className="space-y-1">
              <div className="font-mono text-gray-200">code,name,category[,unit_size,min_order_qty,weight_kg]</div>
              <div className="text-gray-400 mt-1">・ code：商品コード（例：PRD-001）— 既存コードは上書き更新</div>
              <div className="text-gray-400">・ name：商品名（必須）</div>
              <div className="text-gray-400">・ category：カテゴリ（必須）</div>
              <div className="text-gray-400">・ unit_size / min_order_qty / weight_kg：任意</div>
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
