import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { alertasCustos, fmtValor, fmtData } from "@/lib/custos";

// Aviso no Dashboard do ADMIN: custos vencidos sem baixa e o que vence nos próximos 7 dias.
// Só renderiza para admin (e as entidades têm RLS admin, então revenda não lê nada mesmo).
export default function AlertaCustos({ user }) {
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    (async () => {
      try {
        const [c, p] = await Promise.all([
          base44.entities.CustoSistema.list("nome", 500),
          base44.entities.CustoPagamento.list("-data_pagamento", 2000),
        ]);
        setAlertas(alertasCustos(c || [], p || []));
      } catch (e) {
        console.error("AlertaCustos:", e);
      }
    })();
  }, [user?.role]);

  if (user?.role !== "admin" || !alertas.length) return null;
  const vencidos = alertas.filter((a) => a.tipo === "vencido");
  const proximos = alertas.filter((a) => a.tipo === "proximo");

  return (
    <Link to={createPageUrl("CustosSistema")} className="block">
      <div className={`rounded-xl border p-4 text-sm ${vencidos.length ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
        <p className="font-semibold flex items-center gap-2 mb-1">
          {vencidos.length ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          Custos do sistema: {vencidos.length ? `${vencidos.length} vencido(s) sem baixa` : ""}{vencidos.length && proximos.length ? " • " : ""}{proximos.length ? `${proximos.length} vencendo em até 7 dias` : ""}
        </p>
        <ul className="space-y-0.5">
          {alertas.slice(0, 5).map((a, i) => (
            <li key={i}>
              {a.custo.nome} — {fmtValor(a.custo.valor_mensal, a.custo.moeda)} • {a.tipo === "vencido" ? "venceu" : "vence"} {fmtData(a.vencimento)}
            </li>
          ))}
          {alertas.length > 5 && <li>e mais {alertas.length - 5}…</li>}
        </ul>
      </div>
    </Link>
  );
}
