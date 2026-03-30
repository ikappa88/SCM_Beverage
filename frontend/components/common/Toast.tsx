"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "warning";

interface Props {
  message: string;
  type?: ToastType;
  duration?: number; // ms, default 4000
  onClose: () => void;
}

const STYLES: Record<ToastType, string> = {
  success: "border-teal-700 bg-teal-950 text-teal-200",
  error:   "border-red-700 bg-red-950 text-red-200",
  warning: "border-yellow-700 bg-yellow-950 text-yellow-200",
};

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error:   "✕",
  warning: "⚠",
};

export default function Toast({ message, type = "success", duration = 4000, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // マウント後すぐにフェードイン
    const showTimer = setTimeout(() => setVisible(true), 10);
    // duration 後にフェードアウト → アンマウント
    const hideTimer = setTimeout(() => setVisible(false), duration - 300);
    const closeTimer = setTimeout(onClose, duration);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl text-sm max-w-sm transition-all duration-300 ${
        STYLES[type]
      } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <span className="font-bold">{ICONS[type]}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
        className="opacity-60 hover:opacity-100 transition-opacity leading-none ml-1"
      >
        ✕
      </button>
    </div>
  );
}
