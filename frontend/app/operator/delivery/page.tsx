"use client";
import { useEffect, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiFetch } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";

interface Location { id: number; name: string }
interface Product  { id: number; name: string }
interface DeliveryRecord {
  id: number; delivery_code: string; order_id: number | null; status: string;
  from_location: Location; to_location: Location; product: Product;
  quantity: number; scheduled_departure_date: string;
  actual_departure_date: string | null; expected_arrival_date: string;
  actual_arrival_date: string | null; delay_reason: string | null;
  note: string | null; created_at: string;
}

const STATUS_TRANSITIONS: Record<string, { label: string; next: string }[]> = {
  scheduled:  [{ label: "出発確認", next: "departed" }],
  departed:   [{ label: "輸送中に", next: "in_transit" }],
  in_transit: [{ label: "到着確認", next: "arrived" }, { label: "遅延マーク", next: "delayed" }],
  delayed:    [{ label: "到着確認", next: "arrived" }],
  arrived:    [],
  cancelled:  [],
};

const TABS = [
  { label: "すべて",   value: "" },
  { label: "未出発",   value: "scheduled" },
  { label: "輸送中",   value: "departed,in_transit" },
  { label: "遅延",     value: "delayed" },
  { label: "完了",     value: "arrived" },
];

export default function DeliveryPage() {
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [error, setError] = useState("");

  // ステータス更新モーダル
  const [updateTarget, setUpdateTarget] = useState<{ record: DeliveryRecord; next: string } | null>(null);
  const [delayReason, setDelayReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const res = await apiFetch("/api/deliveries/");
    const data = await res.json();
    setRecords(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = records.filter((r) => {
    if (!tab) return true;
    return tab.split(",").includes(r.status);
  });

  const openUpdate = (record: DeliveryRecord, next: string) => {
    setUpdateTarget({ record, next });
    setDelayReason("");
    setError("");
  };

  const handleUpdate = async () => {
    if (!updateTarget) return;
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { status: updateTarget.next };
      const today = new Date().toISOString().split("T")[0];
      if (updateTarget.next === "departed")   body.actual_departure_date = today;
      if (updateTarget.next === "arrived")    body.actual_arrival_date = today;
      if (updateTarget.next === "delayed")    body.delay_reason = delayReason;

      const res = await apiFetch(
        `/api/deliveries/${updateTarget.record.id}/status`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "更新に失敗しました");
        return;
      }
      setUpdateTarget(null);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  return (
    <OperatorLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">配送管理</h1>
          <p className="text-sm text-gray-400 mt-0.5">担当拠点の配送状況と進捗管理</p>
        </div>
        <button
          onClick={() => { const d = new Date().toISOString().slice(0,10); downloadCsv(`delivery_${d}.csv`, records, [
            { label: "配送コード",     value: (r: DeliveryRecord) => r.delivery_code },
            { label: "出発拠点",       value: (r: DeliveryRecord) => r.from_location.name },
            { label: "到着拠点",       value: (r: DeliveryRecord) => r.to_location.name },
            { label: "商品",           value: (r: DeliveryRecord) => r.product.name },
            { label: "数量",           value: (r: DeliveryRecord) => r.quantity },
            { label: "ステータス",     value: (r: DeliveryRecord) => r.status },
            { label: "出発予定日",     value: (r: DeliveryRecord) => r.scheduled_departure_date },
            { label: "到着予定日",     value: (r: DeliveryRecord) => r.expected_arrival_date },
            { label: "実際到着日",     value: (r: DeliveryRecord) => r.actual_arrival_date ?? "" },
          ]); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
        >
          ⬇ CSV
        </button>
      </div>

      {error && !updateTarget && (
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

      {/* モバイル: カードビュー */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="py-8 text-center text-gray-400 text-sm">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-gray-500 text-sm">配送データがありません</p>
        ) : filtered.map((r) => (
          <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-mono text-xs text-gray-400">{r.delivery_code}</p>
                <p className="text-sm font-medium text-gray-100 mt-0.5">{r.product.name}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={r.status} />
                {r.delay_reason && <span className="text-xs text-red-400" title={r.delay_reason}>⚠</span>}
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-1 mb-3">
              <p>{r.from_location.name} → {r.to_location.name}</p>
              <p>数量: <span className="text-gray-300 font-medium">{r.quantity.toLocaleString()}</span>　到着予定: <span className={r.status === "delayed" ? "text-red-400 font-medium" : "text-gray-300"}>{r.expected_arrival_date}</span></p>
            </div>
            <div className="flex gap-2">
              {(STATUS_TRANSITIONS[r.status] ?? []).map((t) => (
                <button key={t.next} onClick={() => openUpdate(r, t.next)}
                  className="flex-1 py-2 text-xs text-center bg-gray-800 hover:bg-gray-700 text-teal-400 rounded-lg transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* デスクトップ: テーブルビュー */}
      <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">配送コード</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">商品</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">出発</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">到着</th>
              <th className="text-right py-2.5 px-4 text-xs text-gray-400 font-medium">数量</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">状態</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">到着予定</th>
              <th className="text-left py-2.5 px-4 text-xs text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-xs">読み込み中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-xs">配送データがありません</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-gray-300">{r.delivery_code}</td>
                <td className="py-2.5 px-4 text-gray-200">{r.product.name}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{r.from_location.name}</td>
                <td className="py-2.5 px-4 text-gray-400 text-xs">{r.to_location.name}</td>
                <td className="py-2.5 px-4 text-right font-medium">{r.quantity.toLocaleString()}</td>
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={r.status} />
                    {r.delay_reason && (
                      <span className="text-xs text-red-400" title={r.delay_reason}>⚠</span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-4 text-xs">
                  <span className={
                    r.status === "delayed"
                      ? "text-red-400 font-medium"
                      : "text-gray-400"
                  }>
                    {r.expected_arrival_date}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex gap-2">
                    {(STATUS_TRANSITIONS[r.status] ?? []).map((t) => (
                      <button key={t.next} onClick={() => openUpdate(r, t.next)}
                        className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ステータス更新モーダル */}
      {updateTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold mb-4">ステータス更新</h3>
            <div className="bg-gray-800 rounded-lg p-4 space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">配送</span>
                <span className="font-mono text-xs">{updateTarget.record.delivery_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">商品</span>
                <span>{updateTarget.record.product.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">更新後ステータス</span>
                <StatusBadge status={updateTarget.next} />
              </div>
            </div>

            {updateTarget.next === "delayed" && (
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">遅延理由</label>
                <textarea
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500 resize-none"
                  placeholder="遅延の理由を入力してください"
                />
              </div>
            )}

            {updateTarget.next === "arrived" && (
              <div className="flex items-start gap-2 mb-4 bg-teal-950 border border-teal-800 rounded-lg px-3 py-2">
                <span className="text-teal-400 mt-0.5">ℹ</span>
                <span className="text-sm text-teal-300">到着確認時に、到着先拠点の在庫が自動加算されます</span>
              </div>
            )}

            {error && (
              <div className="bg-red-950 border border-red-800 text-red-400 text-xs rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setUpdateTarget(null)}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
                キャンセル
              </button>
              <button onClick={handleUpdate} disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">
                {saving ? "更新中..." : "更新する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </OperatorLayout>
  );
}
