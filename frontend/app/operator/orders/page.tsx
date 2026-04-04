"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import OperatorLayout from "@/components/operator/OperatorLayout";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiFetch, getAuthUser } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";

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
interface InventoryInfo {
  id: number; quantity: number; safety_stock: number; max_stock: number;
  location: { name: string }; product: { name: string };
  is_readonly: boolean;
}
interface ATPInfo {
  current: number; allocated: number; atp: int; inbound: number; atp_with_inbound: number;
  location_name: string; product_name: string;
}

// TypeScript で int を使う際の型エイリアス（実際は number）
type int = number;

const TABS = [
  { label: "すべて",       value: "" },
  { label: "処理中",       value: "confirmed,in_transit" },
  { label: "完了",         value: "delivered" },
  { label: "キャンセル",   value: "cancelled" },
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
  const searchParams = useSearchParams();
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

  // 在庫情報・ATP（発注フォーム内インライン表示）
  const [fromInv, setFromInv] = useState<InventoryInfo | null>(null);
  const [toInv, setToInv] = useState<InventoryInfo | null>(null);
  const [atpInfo, setAtpInfo] = useState<ATPInfo | null>(null);
  const [routeLeadTime, setRouteLeadTime] = useState<{ days: number; arrival: string } | null>(null);
  const [invLoading, setInvLoading] = useState(false);

  // ステータス更新
  const [confirm, setConfirm] = useState<{ order: Order; newStatus: string } | null>(null);

  // ログインユーザーの担当拠点IDリスト（operator の補充先絞り込みに使用）
  const [assignedLocationIds, setAssignedLocationIds] = useState<number[]>([]);

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
    const locs: Location[] = await locRes.json();
    setLocations(locs);
    setProducts(await prodRes.json());

    // ログインユーザーの担当拠点IDを取得して絞り込み
    // localStorage に保存済みであればそれを使い、なければ /api/auth/me で補完
    const user = getAuthUser();
    let rawIds = user?.assigned_location_ids ?? "";
    if (!rawIds) {
      try {
        const meRes = await apiFetch("/api/auth/me");
        if (meRes.ok) {
          const me = await meRes.json();
          rawIds = me.assigned_location_ids ?? "";
          if (rawIds) localStorage.setItem("assigned_location_ids", rawIds);
        }
      } catch { /* ignore */ }
    }
    const ids = rawIds
      ? rawIds.split(",").map((s: string) => Number(s.trim())).filter(Boolean)
      : [];
    setAssignedLocationIds(ids);

    // 担当拠点が1件だけなら補充先を自動選択
    if (ids.length === 1) {
      setForm((f) => ({ ...f, to_location_id: String(ids[0]) }));
    }
  };
  useEffect(() => { fetchOrders(); fetchMasters(); }, []);

  // URLパラメータからフォーム初期値をセット（アラートクイックリンクから遷移時）
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const toLocId = searchParams.get("to_location_id") ?? "";
      const prodId  = searchParams.get("from_product_id") ?? "";
      setForm((f) => ({ ...f, to_location_id: toLocId, product_id: prodId }));
      setStep("input");
    }
  }, [searchParams]);

  // 補充元 or 商品が変わったとき → 在庫情報・ATP を自動取得
  const fetchInventoryInfo = useCallback(async (
    fromLocId: string,
    toLocId: string,
    prodId: string,
  ) => {
    setFromInv(null);
    setToInv(null);
    setAtpInfo(null);
    if (!prodId) return;

    setInvLoading(true);
    try {
      const requests: Promise<void>[] = [];

      // 補充元在庫（存在する場合）
      if (fromLocId) {
        requests.push(
          apiFetch(`/api/inventory/?location_id=${fromLocId}&include_upstream=true`)
            .then((r) => r.json())
            .then((data: InventoryInfo[]) => {
              const found = Array.isArray(data)
                ? data.find((inv) => String(inv.product?.id ?? inv.product_id) === prodId || String((inv as unknown as {product_id: number}).product_id) === prodId)
                : null;
              if (found) setFromInv({ ...found, is_readonly: found.is_readonly ?? false });
            })
            .catch(() => {})
        );

        // ATP取得
        requests.push(
          apiFetch(`/api/inventory/atp?location_id=${fromLocId}&product_id=${prodId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data) setAtpInfo(data); })
            .catch(() => {})
        );
      }

      // 補充先在庫（自拠点）
      if (toLocId) {
        requests.push(
          apiFetch(`/api/inventory/?location_id=${toLocId}`)
            .then((r) => r.json())
            .then((data: InventoryInfo[]) => {
              const found = Array.isArray(data)
                ? data.find((inv) => {
                    const pid = (inv as unknown as { product_id: number }).product_id;
                    return String(pid) === prodId;
                  })
                : null;
              if (found) setToInv(found);
            })
            .catch(() => {})
        );
      }

      await Promise.all(requests);
    } finally {
      setInvLoading(false);
    }
  }, []);

  // 補充元・補充先・商品のいずれかが変わったらプレビューで lead time を取得
  const fetchRouteInfo = useCallback(async (fromLocId: string, toLocId: string, prodId: string, requestedDate: string) => {
    setRouteLeadTime(null);
    if (!fromLocId || !toLocId || !prodId) return;
    try {
      const body = {
        order_type: "replenishment",
        from_location_id: Number(fromLocId),
        to_location_id: Number(toLocId),
        product_id: Number(prodId),
        quantity: 1,
        requested_date: requestedDate,
      };
      const res = await apiFetch("/api/orders/preview", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.route_lead_time_days != null) {
        setRouteLeadTime({
          days: data.route_lead_time_days,
          arrival: data.expected_delivery_date ?? "",
        });
      }
    } catch { /* ignore */ }
  }, []);

  const handleFormChange = (patch: Partial<typeof form>) => {
    const next = { ...form, ...patch };
    setForm(next);
    fetchInventoryInfo(next.from_location_id, next.to_location_id, next.product_id);
    if ("from_location_id" in patch || "to_location_id" in patch || "product_id" in patch) {
      fetchRouteInfo(next.from_location_id, next.to_location_id, next.product_id, next.requested_date);
    }
  };

  // 推奨発注数（自拠点の安全在庫 - 現在庫、ATPが足りなければ警告）
  const recommendedQty = toInv
    ? Math.max(0, toInv.safety_stock - toInv.quantity)
    : null;

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
      setFromInv(null); setToInv(null); setAtpInfo(null); setRouteLeadTime(null);
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
        <div className="flex gap-2">
          <button
            onClick={() => { const d = new Date().toISOString().slice(0,10); downloadCsv(`orders_${d}.csv`, orders, [
              { label: "発注コード",     value: (r: Order) => r.order_code },
              { label: "種別",           value: (r: Order) => ORDER_TYPE_LABELS[r.order_type] ?? r.order_type },
              { label: "補充元",         value: (r: Order) => r.from_location.name },
              { label: "補充先",         value: (r: Order) => r.to_location.name },
              { label: "商品",           value: (r: Order) => r.product.name },
              { label: "数量",           value: (r: Order) => r.quantity },
              { label: "ステータス",     value: (r: Order) => r.status },
              { label: "依頼日",         value: (r: Order) => r.requested_date },
              { label: "納品予定日",     value: (r: Order) => r.expected_delivery_date ?? "" },
              { label: "実際納品日",     value: (r: Order) => r.actual_delivery_date ?? "" },
            ]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
          >
            ⬇ CSV
          </button>
          <button
            onClick={() => { setStep("input"); setError(""); }}
            className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 text-gray-950 rounded-lg transition-colors"
          >
            + 新規発注
          </button>
        </div>
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
                <td className="py-2.5 px-4 text-gray-400 text-xs">{o.expected_delivery_date ?? "-"}</td>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4">新規発注</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 左カラム: 入力フォーム */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">発注種別</label>
                  <select value={form.order_type} onChange={(e) => handleFormChange({ order_type: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="replenishment">補充</option>
                    <option value="transfer">移管</option>
                    <option value="emergency">緊急補充</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">補充元拠点</label>
                  <select value={form.from_location_id} onChange={(e) => handleFormChange({ from_location_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="">選択...</option>
                    {locations.filter(l => l.is_active).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">補充先拠点</label>
                  {assignedLocationIds.length > 0 ? (
                    <select value={form.to_location_id} onChange={(e) => handleFormChange({ to_location_id: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                      <option value="">選択...</option>
                      {locations.filter(l => l.is_active && assignedLocationIds.includes(l.id)).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  ) : (
                    // 管理者など assigned_location_ids が空の場合は全拠点表示
                    <select value={form.to_location_id} onChange={(e) => handleFormChange({ to_location_id: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                      <option value="">選択...</option>
                      {locations.filter(l => l.is_active).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">商品</label>
                  <select value={form.product_id} onChange={(e) => handleFormChange({ product_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500">
                    <option value="">選択...</option>
                    {products.filter(p => p.is_active).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}（最小単位: {p.min_order_qty}）</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      数量
                      {recommendedQty != null && recommendedQty > 0 && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, quantity: String(recommendedQty) }))}
                          className="ml-2 text-teal-400 hover:text-teal-300 underline"
                        >
                          推奨: {recommendedQty.toLocaleString()}
                        </button>
                      )}
                    </label>
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

              {/* 右カラム: 在庫情報パネル */}
              <div className="space-y-3">
                {/* リードタイム即時表示 */}
                {routeLeadTime && (
                  <div className="bg-teal-950/40 border border-teal-800/50 rounded-lg p-3">
                    <p className="text-xs text-teal-400 font-medium mb-1">ルート情報</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">リードタイム</span>
                      <span className="text-white font-medium">{routeLeadTime.days}日</span>
                    </div>
                    {routeLeadTime.arrival && (
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-gray-400">到着予定</span>
                        <span className="text-teal-300">{routeLeadTime.arrival}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 補充元在庫 & ATP */}
                {invLoading ? (
                  <div className="text-xs text-gray-500 py-2">在庫情報を取得中...</div>
                ) : (
                  <>
                    {atpInfo && (
                      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-400 font-medium mb-2">
                          補充元在庫 — {atpInfo.location_name}
                          <span className="ml-1 text-gray-600 text-[10px]">（閲覧専用）</span>
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">現在庫</span>
                            <span className="text-gray-200">{atpInfo.current.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">引当済み</span>
                            <span className="text-red-400">-{atpInfo.allocated.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                            <span className="text-gray-400 font-medium">利用可能在庫 (ATP)</span>
                            <span className={`font-bold ${atpInfo.atp <= 0 ? "text-red-400" : "text-teal-400"}`}>
                              {atpInfo.atp.toLocaleString()}
                            </span>
                          </div>
                          {atpInfo.inbound > 0 && (
                            <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                              <span>入荷予定込み</span>
                              <span className="text-teal-600">+{atpInfo.inbound.toLocaleString()} → {atpInfo.atp_with_inbound.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        {atpInfo.atp <= 0 && (
                          <p className="text-[11px] text-red-400 mt-2">
                            ⚠ 現在補充元の利用可能在庫がありません
                            {atpInfo.atp_with_inbound > 0 && `（入荷予定後は ${atpInfo.atp_with_inbound.toLocaleString()} になる予定）`}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 補充先（自拠点）在庫 */}
                    {toInv && (
                      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                        <p className="text-xs text-gray-400 font-medium mb-2">補充先在庫 — {toInv.location.name}</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">現在庫</span>
                            <span className={`${toInv.quantity <= 0 ? "text-red-400" : toInv.quantity < toInv.safety_stock ? "text-amber-400" : "text-gray-200"}`}>
                              {toInv.quantity.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">安全在庫</span>
                            <span className="text-gray-400">{toInv.safety_stock.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">最大在庫</span>
                            <span className="text-gray-400">{toInv.max_stock.toLocaleString()}</span>
                          </div>
                          {recommendedQty != null && recommendedQty > 0 && (
                            <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                              <span className="text-gray-400 font-medium">推奨発注数</span>
                              <span className="text-teal-400 font-bold">{recommendedQty.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                        {/* 在庫ゲージ */}
                        <div className="mt-2">
                          <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${toInv.quantity < toInv.safety_stock ? "bg-red-500" : "bg-teal-500"}`}
                              style={{ width: `${Math.min(100, Math.round((toInv.quantity / Math.max(toInv.max_stock, 1)) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {!atpInfo && !toInv && form.product_id && (
                      <div className="text-xs text-gray-600 py-2">
                        補充元・補充先を選択すると在庫情報が表示されます
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => { setStep("idle"); setError(""); setFromInv(null); setToInv(null); setAtpInfo(null); setRouteLeadTime(null); }}
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
              {atpInfo && atpInfo.atp < preview.quantity && (
                <div className="border-t border-gray-700 pt-2 mt-2">
                  <p className="text-xs text-amber-400">
                    ⚠ 補充元の利用可能在庫（{atpInfo.atp.toLocaleString()}）が発注数量を下回っています
                  </p>
                </div>
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
