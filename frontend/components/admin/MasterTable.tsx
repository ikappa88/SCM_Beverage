"use client";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (row: T) => void;
  onDeactivate?: (row: T) => void;
  onHistory?: (row: T) => void;
}

export default function MasterTable<T extends { id: number; is_active: boolean }>({
  columns, data, onEdit, onDeactivate, onHistory,
}: Props<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {columns.map((col) => (
              <th key={String(col.key)} className="text-left py-2 px-3 text-xs text-gray-400 font-medium">
                {col.label}
              </th>
            ))}
            {(onEdit || onDeactivate || onHistory) && (
              <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">操作</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
              {columns.map((col) => (
                <td key={String(col.key)} className="py-2.5 px-3 text-gray-300">
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[String(col.key)] ?? "-")}
                </td>
              ))}
              {(onEdit || onDeactivate || onHistory) && (
                <td className="py-2.5 px-3">
                  <div className="flex gap-2">
                    {onEdit && row.is_active && (
                      <button
                        onClick={() => onEdit(row)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        編集
                      </button>
                    )}
                    {onDeactivate && row.is_active && (
                      <button
                        onClick={() => onDeactivate(row)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        無効化
                      </button>
                    )}
                    {!row.is_active && (
                      <span className="text-xs text-gray-600">無効</span>
                    )}
                    {onHistory && (
                      <button
                        onClick={() => onHistory(row)}
                        className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        履歴
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
