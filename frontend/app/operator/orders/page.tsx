"use client";
import { useEffect, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiFetch } from "@/lib/auth";

interface Location { id: number; name: string; code: string; location_type: string; is_active: boolean }
interface Product  { id: number; name: string; code: string; min_order_qty: number; is_active: boolean }
interface Order {
  id: number; order_code: string; order_type: string; status: string;
  from_location: Location; to_location: Location; product: Product;
  quantity: number; unit_price: number | null;
  requested_date: string; expected_delivery_date: string | null;
  actual_delivery_date: string | null; note: string | null;
  created_at: string;
}
interface Preview {
  is_valid: boolean; errors: string[];
  order_type: string; from_location_id: number; to_location_id: number;
  product_id: number; quantity: number; requested_date: string;
  expected_delivery_date: string | null; estimated_cost: number | null;
  route_lead_time_days: number | null; note: string | null;
}

const TABS = [
  { label: "すべて", value: "" },
  { label: "処理中", value: "confirmed,in_transit" },
  { label: "完了",   value: "delivered" },
  { label: "キャンセル", value: "cancelled" },
];

const ORDER_TYPE_LABELS: Record<string, string> = {
  replenishment: "補充", transfer: "移管", emergency: "緊急補充",
};

const EMPTY_FORM = {
  order_type: "replenishment",
  from_location_id: "",
  to_location_id: "",
  product_id: "",
  quantity: "",
  requested_date: new Date().toISOString().split("T")[0],
  expected_delivery_date: "",
  note: "",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [error, setError] = useState("");

  // 新規発注フロー
  const [step, setStep] = useState<"idle" | "input" | "preview">("idle");
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ステータス更新
  const [confirm, setConfirm] = useState<{ order: Order; newStatus: string } | null>(null);

  const fetchOrders = async () => {
    const res = await apiFetch("/api/orders/");
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  const fetchMasters = async () => {
    const [locRes, prodRes] = await Promise.all([
      apiFetch("/api/locations/"),
      apiFetch("/api/products/"),
    ]);
    setLocations(await locRes.json());
    setProducts(await prodRes.json());
  };
  useEffect(() => { fetchOrders(); fetchMasters(); }, []);

  const filtered = orders.filter((o) => {
    if (!tab) return true;
    return tab.split(",").includes(o.status);
  });

  const handlePreview = async () => {
    setError("");
    setSubmitting(true);
    try {
      const body = {
        ...form,
        from_location_id: Number(form.from_location_id),
        to_location_id: Number(form.to_location_id),
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        expected_delivery_date: form.expected_delivery_date || null,
        note: form.note || null,
      };
      const res = await apiFetch("/api/orders/preview", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "プレビューに失敗しました"); return; }
      setPreview(data);
      setStep("preview");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview) return;
    setError("");
    setSubmitting(true);
    try {
      const body = {
        order_type: form.order_type,
        from_location_id: Number(form.from_location_id),
        to_location_id: Number(form.to_location_id),
        product_id: Number(form.product_id),
        quantity: Number(form.quantity),
        requested_date: form.requested_date,
        expected_delivery_date: preview.expected_delivery_date || null,
        note: form.note || null,
      };
      const res = await apiFetch("/api/orders/", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "発注に失敗しました"); return; }
      setStep("idle");
      setForm(EMPTY_FORM);
      setPreview(null);
      fetchOrders();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (order: Order, newStatus: string) => {
    const res = await apiFetch(`/api/orders/${order.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.detail || "ステータス更新に失敗しました");
      return;
    }
    setConfirm(null);
    fetchOrders();
  };

  const locationName = (id: number | string) =>
    locations.find((l) => l.id === Number(id))?.name ?? `ID:${id}`;
  const productName = (id: number | string) =>
    products.find((p) => p.id === Number(id))?.name ?? `ID:${id}`;

  return (
    <OperatorLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">発注・補充指示</h1>
          <p className="text-sm text-gray-400 mt-0.5">担当拠点への補充発注と進捗管理</p>
        </div>
        <button
          onClick={() => { setStep("input"); setError(""); }}
          className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 text-gray-950 rounded-lg transition-colors"
        >
          + 新規発注
        </button>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              tab === t.value ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">発注コード</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">種別</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">発注先</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">数量</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">希望納期</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-xs">発注データがありません</td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-gray-300">{o.order_code}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{ORDER_TYPE_LABELS[o.order_type] ?? o.order_type}</td>
                <td className="py-2.5 px-4 text-gray-200">{o.product.name}</td>
                <td className="py-2.5 px-4 text-gray-300 text-xs">{o.to_location.name}</td>
                <td className="py-2.5 px-4 text-right font-medium">{o.quantity.toLocaleString()}</td>
                <td className="py-2.5 px-4"><StatusBadge status={o.status} /></td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">
                  {o.expected_delivery_date ?? "-"}
                </td>
                <td className="py-2.5 px-4">
                  {o.status === "in_transit" && (
                    <button
                      onClick={() => setConfirm({ order: o, newStatus: "delivered" })}
                      className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      入荷確認
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* STEP1: 入力モーダル */}
      {step === "input" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-base font-semibold mb-4">新規発注</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">発注種別</label>
                <select value={form.order_type} onChange={(e) => setForm({ ...form, order_type: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="replenishment">補充</option>
                  <option value="transfer">移管</option>
                  <option value="emergency">緊急補充</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">補充元拠点</label>
                  <select value={form.from_location_id} onChange={(e) => setForm({ ...form, from_location_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="">選択...</option>
                    {locations.filter(l => l.is_active).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">補充先拠点</label>
                  <select value={form.to_location_id} onChange={(e) => setForm({ ...form, to_location_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="">選択...</option>
                    {locations.filter(l => l.is_active).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">商品</label>
                <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                  <option value="">選択...</option>
                  {products.filter(p => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}（最小単位: {p.min_order_qty}）</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">数量</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">発注日</label>
                  <input type="date" value={form.requested_date} onChange={(e) => setForm({ ...form, requested_date: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">備考（任意）</label>
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
            </div>
            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => { setStep("idle"); setError(""); }}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
                キャンセル
              </button>
              <button onClick={handlePreview} disabled={submitting}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">
                {submitting ? "確認中..." : "内容を確認する →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP2: プレビューモーダル */}
      {step === "preview" && preview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">発注内容の確認</h3>
            {!preview.is_valid && (
              <div className="bg-red-950 border border-red-800 rounded-lg p-3 mb-4">
                {preview.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">{e}</p>
                ))}
              </div>
            )}
            <div className="bg-gray-800 rounded-lg p-4 space-y-2 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">発注種別</span><span>{ORDER_TYPE_LABELS[preview.order_type]}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">補充元</span><span>{locationName(preview.from_location_id)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">補充先</span><span>{locationName(preview.to_location_id)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">商品</span><span>{productName(preview.product_id)}</span></div>
              <div className="flex justify-between font-medium"><span className="text-gray-400">数量</span><span className="text-teal-400">{preview.quantity.toLocaleString()}</span></div>
              {preview.route_lead_time_days != null && (
                <div className="flex justify-between"><span className="text-gray-400">リードタイム</span><span>{preview.route_lead_time_days}日</span></div>
              )}
              {preview.expected_delivery_date && (
                <div className="flex justify-between"><span className="text-gray-400">到着予定日</span><span>{preview.expected_delivery_date}</span></div>
              )}
              {preview.estimated_cost != null && (
                <div className="flex justify-between"><span className="text-gray-400">推定コスト</span><span>¥{preview.estimated_cost.toLocaleString()}</span></div>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">この内容で発注を確定します。よろしいですか？</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setStep("input")}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
                ← 戻る
              </button>
              <button onClick={handleSubmit} disabled={submitting || !preview.is_valid}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 disabled:text-gray-500 text-gray-950 rounded-lg transition-colors">
                {submitting ? "発注中..." : "発注を確定する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="入荷確認"
          message={`発注「${confirm.order.order_code}」の入荷を確認します。ステータスを「完了」に更新します。`}
          confirmLabel="入荷確認する"
          onConfirm={() => handleStatusUpdate(confirm.order, confirm.newStatus)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </OperatorLayout>
  );
}
