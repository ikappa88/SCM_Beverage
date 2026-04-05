"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchClock,
  advanceHalfDay,
  formatVirtualDate,
  ClockData,
  AdvanceResult,
} from "@/lib/simulation";
import SimulationEventLog from "@/components/common/SimulationEventLog";
import Toast from "@/components/common/Toast";

interface Props {
  isAdmin?: boolean;
}

export default function SimulationClock({ isAdmin = false }: Props) {
  const [clock, setClock] = useState<ClockData | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logRefresh, setLogRefresh] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "warning" | "error" } | null>(null);

  const loadClock = useCallback(async () => {
    try {
      const data = await fetchClock();
      setClock(data);
    } catch {
      // silently ignore on initial load
    }
  }, []);

  useEffect(() => {
    loadClock();
  }, [loadClock]);

  const handleAdvance = async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      const result: AdvanceResult = await advanceHalfDay();
      setClock({
        virtual_time: result.new_virtual_time,
        half_day: result.half_day,
        initial_time: clock?.initial_time ?? result.new_virtual_time,
        updated_at: new Date().toISOString(),
      });
      setLogRefresh((n) => n + 1);

      const stockoutNote =
        result.stockouts.length > 0 ? ` 欠品${result.stockouts.length}件。` : "";
      const alertNote =
        result.alerts_fired > 0 ? ` アラート${result.alerts_fired}件発火。` : "";
      const type = result.stockouts.length > 0 || result.alerts_fired > 0 ? "warning" : "success";

      setToast({
        message: `${result.half_day} に進みました。イベント ${result.event_count} 件。${stockoutNote}${alertNote}`,
        type,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "時間進行に失敗しました";
      setToast({ message: msg, type: "error" });
    } finally {
      setAdvancing(false);
    }
  };

  if (!clock) return null;

  const badgeClass =
    clock.half_day === "AM"
      ? "bg-sky-800 text-sky-200"
      : "bg-orange-800 text-orange-200";

  return (
    <>
      <div className="flex items-center gap-2 text-xs">
        {/* Date + half-day badge */}
        <div className="flex items-center gap-1.5 bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-700">
          <span className="text-gray-400">仮想時刻</span>
          <span className="font-mono text-white">{formatVirtualDate(clock.virtual_time)}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
            {clock.half_day}
          </span>
        </div>

        {/* Advance button */}
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="flex items-center gap-1 bg-indigo-700 hover:bg-indigo-600 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white px-2.5 py-1 rounded-lg transition-colors font-medium"
        >
          {advancing ? (
            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>▶</span>
          )}
          半日進める
        </button>

        {/* Event log toggle */}
        <button
          onClick={() => setShowLog((v) => !v)}
          className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
          title="イベントログ"
        >
          📋
        </button>
      </div>

      {showLog && (
        <SimulationEventLog
          onClose={() => setShowLog(false)}
          refreshTrigger={logRefresh}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
