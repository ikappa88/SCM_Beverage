/**
 * CSV ダウンロードユーティリティ
 * BOM付きUTF-8で出力するためExcelでも文字化けしない
 */

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escape(c.value(row))).join(","))
    .join("\n");

  const csv = "\uFEFF" + header + "\n" + body; // BOM for Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
