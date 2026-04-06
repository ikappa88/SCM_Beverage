type StatusConfig = { label: string; colorClass: string };

const STATUS_MAP: Record<string, StatusConfig> = {
  open:        { label: "未対応",      colorClass: "text-red-400 bg-red-950" },
  in_progress: { label: "対応中",      colorClass: "text-amber-400 bg-amber-950" },
  resolved:    { label: "解決済",      colorClass: "text-green-400 bg-green-950" },
  draft:              { label: "下書き",      colorClass: "text-gray-400 bg-gray-800" },
  awaiting_approval:  { label: "承認待ち",    colorClass: "text-orange-400 bg-orange-950" },
  confirmed:          { label: "確定",        colorClass: "text-blue-400 bg-blue-950" },
  in_transit:  { label: "輸送中",      colorClass: "text-teal-400 bg-teal-950" },
  delivered:   { label: "完了",        colorClass: "text-green-400 bg-green-950" },
  cancelled:   { label: "キャンセル",  colorClass: "text-gray-500 bg-gray-900" },
  delayed:     { label: "遅延",        colorClass: "text-red-400 bg-red-950" },
  arrived:     { label: "到着",        colorClass: "text-green-400 bg-green-950" },
  scheduled:   { label: "予定",        colorClass: "text-gray-400 bg-gray-800" },
  departed:    { label: "出発済",      colorClass: "text-blue-400 bg-blue-950" },
  warning:     { label: "警告",        colorClass: "text-amber-400 bg-amber-950" },
  danger:      { label: "危険",        colorClass: "text-red-400 bg-red-950" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] ?? { label: status, colorClass: "text-gray-400 bg-gray-800" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${config.colorClass}`}>
      {config.label}
    </span>
  );
}
