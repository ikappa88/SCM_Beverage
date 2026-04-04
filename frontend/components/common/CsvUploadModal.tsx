"use client";
import { useRef, useState } from "react";
import { API_BASE, getAuthUser } from "@/lib/auth";

interface PreviewRow {
  row: number;
  location_code: string;
  location_name: string;
  product_code: string;
  product_name: string;
  current_quantity: number | null;
  new_quantity: number;
}

interface ErrorRow {
  row: number;
  reason: string;
}

interface PreviewResult {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  errors: ErrorRow[];
  previews: PreviewRow[];
}

interface Props {
  title: string;
  /** プレビューAPIパス（省略時はプレビューなしで直接コミット） */
  previewPath?: string;
  /** コミットAPIパス */
  commitPath: string;
  /** フォーマット説明（省略可） */
  formatHint?: React.ReactNode;
  onSuccess: (message: string) => void;
  onClose: () => void;
}

export default function CsvUploadModal({
  title, previewPath, commitPath, formatHint, onSuccess, onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"select" | "preview">("select");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authHeader = () => {
    const user = getAuthUser();
    return { Authorization: `Bearer ${user?.access_token}` };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(""); setPreview(null); setStep("select"); }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}${previewPath}`, {
        method: "POST", headers: authHeader(), body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        return;
      }
      setPreview(data);
      setStep("preview");
    } catch {
      setError("サーバーに接続できません");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    if (previewPath && preview && preview.error_rows > 0) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}${commitPath}`, {
        method: "POST", headers: authHeader(), body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        return;
      }
      onSuccess(data.message ?? `${data.updated ?? ""}件を更新しました`);
      onClose();
    } catch {
      setError("サーバーに接続できません");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* ステップインジケーター（プレビューあり時のみ） */}
          {previewPath && (
            <div className="flex items-center gap-2 text-xs mb-2">
              {["ファイル選択", "内容確認"].map((label, i) => {
                const isActive = (i === 0 && step === "select") || (i === 1 && step === "preview");
                const isPast = i === 0 && step === "preview";
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isActive ? "bg-teal-500 text-gray-950" : isPast ? "bg-teal-900 text-teal-300" : "bg-gray-800 text-gray-500"
                    }`}>{i + 1}</div>
                    <span className={isActive ? "text-white" : "text-gray-500"}>{label}</span>
                    {i < 1 && <span className="text-gray-700">→</span>}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* ファイル選択ステップ */}
          {step === "select" && (
            <>
              {formatHint && (
                <div className="bg-gray-800 rounded-lg p-4 text-xs text-gray-300 space-y-1">
                  {formatHint}
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-400 mb-2">CSVファイルを選択</label>
                <input
                  ref={fileRef} type="file" accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-600 file:text-white hover:file:bg-teal-500 cursor-pointer"
                />
                {file && (
                  <div className="mt-2 text-xs text-gray-400">
                    <span className="text-green-400">✓</span> {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </>
          )}

          {/* プレビューステップ */}
          {step === "preview" && preview && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "総行数", value: preview.total_rows, color: "" },
                  { label: "正常", value: preview.valid_rows, color: preview.valid_rows > 0 ? "text-green-400" : "" },
                  { label: "エラー", value: preview.error_rows, color: preview.error_rows > 0 ? "text-red-400" : "" },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                    <div className={`text-xl font-semibold ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {preview.errors.length > 0 && (
                <div className="bg-gray-900 border border-red-900 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-400 mb-2">エラー内容（全件中断）</p>
                  <div className="space-y-1">
                    {preview.errors.map((e, i) => (
                      <div key={i} className="flex gap-3 text-xs">
                        <span className="text-gray-500 min-w-10">{e.row}行</span>
                        <span className="text-red-300">{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.previews.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                  <p className="text-xs font-medium px-4 py-2 border-b border-gray-800">変更プレビュー</p>
                  <div className="overflow-x-auto max-h-52">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left py-1.5 px-3 text-gray-400 font-medium">拠点</th>
                          <th className="text-left py-1.5 px-3 text-gray-400 font-medium">商品</th>
                          <th className="text-right py-1.5 px-3 text-gray-400 font-medium">修正前</th>
                          <th className="text-right py-1.5 px-3 text-gray-400 font-medium">修正後</th>
                          <th className="text-right py-1.5 px-3 text-gray-400 font-medium">差分</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.previews.map((p) => {
                          const diff = p.current_quantity !== null ? p.new_quantity - p.current_quantity : null;
                          return (
                            <tr key={p.row} className="border-b border-gray-800/50">
                              <td className="py-1.5 px-3 text-gray-300">{p.location_name}</td>
                              <td className="py-1.5 px-3 text-gray-300">{p.product_name}</td>
                              <td className="py-1.5 px-3 text-right text-gray-400">{p.current_quantity?.toLocaleString() ?? "-"}</td>
                              <td className="py-1.5 px-3 text-right text-teal-400 font-medium">{p.new_quantity.toLocaleString()}</td>
                              <td className="py-1.5 px-3 text-right">
                                {diff !== null ? (
                                  <span className={diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-500"}>
                                    {diff > 0 ? "+" : ""}{diff.toLocaleString()}
                                  </span>
                                ) : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* フッターボタン */}
        <div className="flex justify-between px-6 py-4 border-t border-gray-800">
          {step === "preview" ? (
            <>
              <button
                onClick={() => { setStep("select"); setPreview(null); setError(""); }}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
              >
                ← 戻る
              </button>
              {preview && preview.error_rows === 0 && preview.valid_rows > 0 && (
                <button
                  onClick={handleCommit} disabled={loading}
                  className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors"
                >
                  {loading ? "取り込み中..." : `${preview.valid_rows}件を確定する`}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
                キャンセル
              </button>
              {previewPath ? (
                <button
                  onClick={handlePreview} disabled={!file || loading}
                  className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 rounded-lg transition-colors"
                >
                  {loading ? "確認中..." : "内容を確認する →"}
                </button>
              ) : (
                <button
                  onClick={handleCommit} disabled={!file || loading}
                  className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 rounded-lg transition-colors"
                >
                  {loading ? "アップロード中..." : "アップロードする"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
