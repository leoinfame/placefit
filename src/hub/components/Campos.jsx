import React from "react";

export function Campo({ rotulo, children, className = "" }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-semibold text-slate-600">{rotulo}</span>
      {children}
    </label>
  );
}

export function Selecao({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 w-full rounded-md border border-input bg-white px-3 text-sm ${className}`}
    >
      {children}
    </select>
  );
}
