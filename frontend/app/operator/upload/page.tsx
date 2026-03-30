"use client";

import { useRef, useState } from "react";
import OperatorLayout from "@/components/operator/OperatorLayout";
import { API_BASE, getAuthUser } from "@/lib/auth";

interface PreviewRow {
  row: number;
  location_code: string;
  location_name: string;
  product_code: string;
  product_name: string;
  current_quantity: number | null;
  new_quantity: number;
  inventory_id: number | null;
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

export default function UploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"select" | "preview" | "done">("select");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(""); setPreview(null); setStep("select"); }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const user = getAuthUser();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/upload/inventory/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user?.access_token}` },
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        const msg = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
        setError(msg || "プレビューの取得に失敗しました");
        return;
      }
      const data = await res.json();
      setPreview(data);
      setStep("preview");
    } catch {
      setError("サーバーに接続できません。しばらく経ってから再試行してください。");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview || preview.error_rows > 0) return;
    setLoading(true);
    setError("");
    try {
      const user = getAuthUser();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/upload/inventory/commit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${user?.access_token}` },
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json();
        const msg = typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
        setError(msg || "取り込みに失敗しました");
        return;
      }
      const data = await res.json();
      setResult(data.message);
      setStep("done");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("サーバーに接続できません。しばらく経ってから再試行してください。");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("select");
    setFile(null);
    setPreview(null);
    setError("");
    setResult("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <OperatorLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">データアップロード</h1>
          <p className="text-sm text-gray-400 mt-0.5">CSVファイルによる在庫データの一括更新</p>
        </div>
        <a
          href={`${API_BASE}/api/templates/inventory/download`}
          download="inventory_template.csv"
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors"
          onClick={(e) => {
            // 認証ヘッダーが必要なため apiFetch で取得してからダウンロード
            e.preventDefault();
            const user = getAuthUser();
            fetch(`${API_BASE}/api/templates/inventory/download`, {
              headers: { Authorization: `Bearer ${user?.access_token}` },
            })
              .then((r) => r.blob())
              .then((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "inventory_template.csv";
                a.click();
                URL.revokeObjectURL(url);
              });
          }}
        >
          ⬇ テンプレートをダウンロード
        </a>
      </div>

      <div className="flex items-center gap-2 mb-6 text-xs">
        {["ファイル選択", "内容確認", "完了"].map((label, i) => {
          const stepKeys = ["select", "preview", "done"];
          const isActive = stepKeys[i] === step;
          const isPast = stepKeys.indexOf(step) > i;
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                isActive ? "bg-teal-500 text-gray-950" :
                isPast ? "bg-teal-900 text-teal-300" :
                "bg-gray-800 text-gray-500"
              }`}>{i + 1}</div>
              <span className={isActive ? "text-white" : "text-gray-500"}>{label}</span>
              {i < 2 && <span className="text-gray-700 mx-1">→</span>}
            </div>
          );
        })}
      </div>

      {step === "select" && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-medium mb-4">CSVフォーマット</h2>
            <div className="bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-300 mb-4">
              location_code,product_code,quantity<br />
              TC-01,PRD-001,500<br />
              TC-01,PRD-002,300
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <div>・ <span className="text-gray-300">location_code</span>：拠点コード（例：TC-01）</div>
              <div>・ <span className="text-gray-300">product_code</span>：商品コード（例：PRD-001）</div>
              <div>・ <span className="text-gray-300">quantity</span>：在庫数量（0以上の整数）</div>
              <div className="text-amber-400 mt-2">・ バリデーションエラーがある場合は全件中断されます</div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-sm font-medium mb-4">ファイルを選択</h2>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange}
              aria-label="CSVファイルを選択"
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-500 file:text-gray-950 hover:file:bg-teal-400 cursor-pointer" />
            {file && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <span className="text-green-400">✓</span>
                <span>{file.name}</span>
                <span className="text-gray-600">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
            {error && (
              <div role="alert" className="mt-3 bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button type="button" onClick={handlePreview} disabled={!file || loading}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 rounded-lg transition-colors">
                {loading ? "確認中..." : "内容を確認する →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">総行数</div>
              <div className="text-2xl font-semibold">{preview.total_rows}</div>
            </div>
            <div className={`bg-gray-900 border rounded-xl p-4 ${preview.valid_rows > 0 ? "border-green-800" : "border-gray-800"}`}>
              <div className="text-xs text-gray-400 mb-1">正常行数</div>
              <div className={`text-2xl font-semibold ${preview.valid_rows > 0 ? "text-green-400" : "text-gray-400"}`}>{preview.valid_rows}</div>
            </div>
            <div className={`bg-gray-900 border rounded-xl p-4 ${preview.error_rows > 0 ? "border-red-800" : "border-gray-800"}`}>
              <div className="text-xs text-gray-400 mb-1">エラー行数</div>
              <div className={`text-2xl font-semibold ${preview.error_rows > 0 ? "text-red-400" : "text-gray-400"}`}>{preview.error_rows}</div>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="bg-gray-900 border border-red-900 rounded-xl p-4">
              <h2 className="text-sm font-medium text-red-400 mb-3">エラー内容（全件中断）</h2>
              <div className="space-y-1">
                {preview.errors.map((e, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-gray-500 min-w-12">{e.row}行目</span>
                    <span className="text-red-300">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.previews.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-medium">変更内容プレビュー</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-2 px-4 text-xs text-gray-400 font-medium">行</th>
                      <th className="text-left py-2 px-4 text-xs text-gray-400 font-medium">拠点</th>
                      <th className="text-left py-2 px-4 text-xs text-gray-400 font-medium">商品</th>
                      <th className="text-right py-2 px-4 text-xs text-gray-400 font-medium">修正前</th>
                      <th className="text-right py-2 px-4 text-xs text-gray-400 font-medium">修正後</th>
                      <th className="text-right py-2 px-4 text-xs text-gray-400 font-medium">差分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previews.map((p) => {
                      const diff = p.current_quantity !== null ? p.new_quantity - p.current_quantity : null;
                      return (
                        <tr key={p.row} className="border-b border-gray-800/50">
                          <td className="py-2 px-4 text-gray-500 text-xs">{p.row}</td>
                          <td className="py-2 px-4 text-gray-300 text-xs">{p.location_name}</td>
                          <td className="py-2 px-4 text-gray-300 text-xs">{p.product_name}</td>
                          <td className="py-2 px-4 text-right text-gray-400 text-xs">
                            {p.current_quantity !== null ? p.current_quantity.toLocaleString() : "-"}
                          </td>
                          <td className="py-2 px-4 text-right text-teal-400 text-xs font-medium">
                            {p.new_quantity.toLocaleString()}
                          </td>
                          <td className="py-2 px-4 text-right text-xs">
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

          <div className="flex justify-between">
            <button type="button" onClick={handleReset}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
              ← ファイル選択に戻る
            </button>
            {preview.error_rows === 0 && preview.valid_rows > 0 && (
              <button type="button" onClick={handleCommit} disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 text-gray-950 rounded-lg transition-colors">
                {loading ? "取り込み中..." : `${preview.valid_rows}件を確定する`}
              </button>
            )}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="bg-gray-900 border border-green-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-green-400 mb-2">取り込み完了</h2>
          <p className="text-sm text-gray-400 mb-6">{result}</p>
          <button type="button" onClick={handleReset}
            className="px-4 py-2 text-sm font-medium bg-teal-500 hover:bg-teal-400 text-gray-950 rounded-lg transition-colors">
            続けてアップロードする
          </button>
        </div>
      )}
    </OperatorLayout>
  );
}
