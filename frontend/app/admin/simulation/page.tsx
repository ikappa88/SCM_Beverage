"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import {
  fetchParameters,
  updateParameter,
  resetClock,
  fetchClock,
  formatVirtualDate,
  SimulationParameter,
  ClockData,
} from "@/lib/simulation";
import Toast from "@/components/common/Toast";

export default function SimulationSettingsPage() {
  const [params, setParams] = useState<SimulationParameter[]>([]);
  const [clock, setClock] = useState<ClockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    Promise.all([fetchParameters(), fetchClock()])
      .then(([p, c]) => {
        setParams(p);
        setClock(c);
      })
      .catch(() => setToast({ message: "データの取得に失敗しました", type: "error" }))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (param: SimulationParameter) => {
    setEditingId(param.id);
    setEditValue(JSON.stringify(param.value, null, 2));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (param: SimulationParameter) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(editValue);
    } catch {
      setToast({ message: "JSON形式が正しくありません", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateParameter(param.category, param.key, parsed);
      setParams((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingId(null);
      setToast({ message: "パラメータを更新しました", type: "success" });
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : "更新に失敗しました", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const c = await resetClock();
      setClock(c);
      setShowResetConfirm(false);
      setToast({ message: `仮想時刻を ${formatVirtualDate(c.virtual_time)} にリセットしました`, type: "success" });
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : "リセットに失敗しました", type: "error" });
    } finally {
      setResetting(false);
    }
  };

  const grouped = params.reduce<Record<string, SimulationParameter[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">シミュレーション設定</h1>
            {clock && (
              <p className="text-sm text-gray-400 mt-0.5">
                現在の仮想時刻: {formatVirtualDate(clock.virtual_time)} ({clock.half_day})
                　初期時刻: {formatVirtualDate(clock.initial_time)}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="bg-red-800 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            仮想時刻をリセット
          </button>
        </div>

        {loading && <div className="text-gray-400 text-sm">読み込み中...</div>}

        {Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="mb-8">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              {category}
            </h2>
            <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
              {items.map((param) => (
                <div key={param.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-indigo-300">{param.key}</span>
                      </div>
                      {param.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{param.description}</p>
                      )}
                      {editingId === param.id ? (
                        <div className="mt-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-gray-800 text-white text-xs font-mono border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 resize-y"
                            rows={Math.min(10, editValue.split("\n").length + 1)}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => saveEdit(param)}
                              disabled={saving}
                              className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:bg-indigo-900 text-white px-3 py-1 rounded-lg transition-colors"
                            >
                              {saving ? "保存中..." : "保存"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <pre className="mt-1 text-xs text-gray-300 bg-gray-800 rounded px-2 py-1 overflow-x-auto">
                          {JSON.stringify(param.value, null, 2)}
                        </pre>
                      )}
                    </div>
                    {editingId !== param.id && (
                      <button
                        onClick={() => startEdit(param)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors flex-shrink-0"
                      >
                        編集
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Reset confirm dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-2">仮想時刻のリセット</h3>
            <p className="text-sm text-gray-400 mb-4">
              仮想時刻を初期値（{clock ? formatVirtualDate(clock.initial_time) : "—"}）に戻します。
              この操作はイベントログには影響しません。よろしいですか？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="text-sm bg-red-700 hover:bg-red-600 disabled:bg-red-900 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {resetting ? "リセット中..." : "リセット実行"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AdminLayout>
  );
}
