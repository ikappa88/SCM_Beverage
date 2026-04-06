"use client";
import { useEffect, useRef, useState } from "react";

interface Option {
  value: string | number;
  label: string;
  sublabel?: string;
}

interface Props {
  options: Option[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "検索または選択...",
  className = "",
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 選択済み値のラベルを表示用クエリに反映
  useEffect(() => {
    if (value === "" || value === undefined) {
      setQuery("");
      return;
    }
    const opt = options.find((o) => String(o.value) === String(value));
    if (opt) setQuery(opt.label);
  }, [value, options]);

  // 外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // フォーカスアウト時に選択値がなければクリア
        if (value === "" || value === undefined) setQuery("");
        else {
          const opt = options.find((o) => String(o.value) === String(value));
          if (opt) setQuery(opt.label);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value, options]);

  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.sublabel ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const handleSelect = (opt: Option) => {
    onChange(String(opt.value));
    setQuery(opt.label);
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (e.target.value === "") onChange("");
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
        />
        {value !== "" && value !== undefined && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                String(opt.value) === String(value) ? "bg-gray-700 text-teal-400" : "text-gray-200"
              }`}
            >
              <span>{opt.label}</span>
              {opt.sublabel && <span className="ml-2 text-xs text-gray-500">{opt.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-500">
          「{query}」に一致する候補がありません
        </div>
      )}
    </div>
  );
}
