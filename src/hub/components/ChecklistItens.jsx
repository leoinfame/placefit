import React from "react";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { previaDivergencia } from "../lib/hubApi";

// Conferencia item a item. Toque no item = veio tudo. Item nao marcado pede quantos vieram (0 = faltou).
export default function ChecklistItens({ itens, marcados, onChange }) {
  const muda = (i, dados) => onChange(marcados.map((m, j) => (j === i ? { ...m, ...dados } : m)));
  const problemas = previaDivergencia(itens, marcados);
  const feitos = marcados.filter((m) => m.ok).length;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">Itens do subpedido ({feitos}/{itens.length} completos)</p>
      {itens.map((it, i) => {
        const m = marcados[i];
        return (
          <div key={i} className={`rounded-xl border-2 p-3 ${m.ok ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
            <button type="button" className="flex w-full items-center gap-3 text-left" onClick={() => muda(i, { ok: !m.ok })}>
              {m.ok ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" /> : <Circle className="h-7 w-7 shrink-0 text-slate-300" />}
              <span className="flex-1">
                <span className="block font-semibold">{it.quantidade}x {it.nome || it.cod}</span>
                {it.cod && <span className="text-xs text-slate-500">{it.cod}</span>}
              </span>
            </button>
            {!m.ok && (
              <label className="mt-2 flex items-center gap-2 pl-10 text-sm text-slate-600">
                Quantos vieram?
                <Input
                  type="number" inputMode="numeric" min="0" max={it.quantidade}
                  value={m.quantidade_recebida ?? 0}
                  onChange={(e) => muda(i, { quantidade_recebida: e.target.value })}
                  className="h-10 w-20"
                />
                de {it.quantidade}
              </label>
            )}
          </div>
        );
      })}
      {problemas.length > 0 && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-4 w-4" />Vai registrar divergência:</p>
          <ul className="mt-1 list-disc pl-5">{problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
