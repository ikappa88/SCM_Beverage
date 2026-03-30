"use client";

import { useEffect, useRef, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import Toast from "@/components/common/Toast";
import { API_BASE, apiFetch, getAuthUser } from "@/lib/auth";

interface Template {
  id: string;
  name: string;
  filename: string;
  version: string;
  description: string;
  updated_at: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchTemplates = async () => {
    const res = await apiFetch("/api/templates/");
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleDownload = async (tmpl: Template) => {
    const user = getAuthUser();
    const res = await fetch(`${API_BASE}/api/templates/${tmpl.id}/download`, {
      headers: { Authorization: `Bearer ${user?.access_token}` },
    });
    if (!res.ok) { setToast({ msg: "ダウンロードに失敗しました", type: "error" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tmpl.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (tmpl: Template, file: File) => {
    setUploading(tmpl.id);
    const user = getAuthUser();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/templates/${tmpl.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${user?.access_token}` },
      body: formData,
    });
    setUploading(null);
    if (res.ok) {
      setToast({ msg: `「${tmpl.name}」を更新しました`, type: "success" });
      fetchTemplates();
    } else {
      setToast({ msg: "テンプレートの更新に失敗しました", type: "error" });
    }
    // inputをリセット
    if (fileRefs.current[tmpl.id]) fileRefs.current[tmpl.id]!.value = "";
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">テンプレート管理</h1>
        <p className="text-sm text-gray-400 mt-0.5">CSVアップロード用テンプレートのバージョン管理</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">読み込み中...</p>
      ) : (
        <div className="space-y-4">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-sm font-semibold text-white">{tmpl.name}</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900 text-teal-300 font-mono">
                      v{tmpl.version}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{tmpl.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>ファイル名: <span className="font-mono text-gray-400">{tmpl.filename}</span></span>
                    <span>最終更新: {tmpl.updated_at}</span>
                  </div>
                </div>

                {/* ダウンロードボタン */}
                <button
                  onClick={() => handleDownload(tmpl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-teal-400 border border-teal-800 rounded-lg hover:bg-teal-950 transition-colors whitespace-nowrap"
                >
                  ⬇ ダウンロード
                </button>
              </div>

              {/* 新バージョンアップロード */}
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">新バージョンをアップロード（現在のファイルを上書きします）</p>
                <div className="flex items-center gap-3">
                  <input
                    ref={(el) => { fileRefs.current[tmpl.id] = el; }}
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(tmpl, file);
                    }}
                    className="block text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600 cursor-pointer"
                  />
                  {uploading === tmpl.id && (
                    <span className="text-xs text-gray-400">アップロード中...</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}
