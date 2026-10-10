import React from "react";

export function Cartao({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Vazio({ children }) {
  return <p className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{children}</p>;
}

export function Abas({ abas, ativa, onTrocar }) {
  return (
    <div className="mb-4 flex gap-1 rounded-xl bg-slate-200 p-1">
      {abas.map(([id, rotulo]) => (
        <button
          key={id}
          onClick={() => onTrocar(id)}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${ativa === id ? "bg-white text-slate-900 shadow" : "text-slate-600"}`}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export function Erro({ texto }) {
  return texto ? <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{texto}</p> : null;
}
