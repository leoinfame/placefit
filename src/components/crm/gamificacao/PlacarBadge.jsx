import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/crmGamificacao";

const corDoPlacar = (pontos) =>
  pontos >= 30 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : pontos >= 10 ? "border-sky-200 bg-sky-50 text-sky-700"
      : pontos >= 0 ? "border-slate-200 bg-slate-50 text-slate-600"
        : "border-rose-200 bg-rose-50 text-rose-700";

/** Item 024A: placar com motivo visível em cada ponto. */
export default function PlacarBadge({ dados, compacto = false }) {
  const [aberto, setAberto] = useState(false);
  if (!dados?.placar) return null;
  const { placar, orcamento } = dados;
  const pontos = placar.pontos;

  // Na lista de contatos o placar é só uma etiqueta (sem diálogo dentro de botão da lista).
  if (compacto) {
    const resumo = placar.motivos.map((m) => `${m.pontos > 0 ? "+" : ""}${m.pontos} · ${m.motivo}`).join("\n");
    return (
      <span className={"shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold " + corDoPlacar(pontos)} title={resumo}>
        {pontos > 0 ? "+" : ""}{pontos}
      </span>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setAberto(true); }}
        className={"h-7 gap-1 rounded-full px-2.5 text-[11px] font-semibold " + corDoPlacar(pontos)}
        title="Ver os pontos e o motivo de cada um"
      >
        {`Placar ${pontos > 0 ? "+" : ""}${pontos}`}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Placar do cliente: {pontos > 0 ? "+" : ""}{pontos} pontos</DialogTitle>
            <DialogDescription>
              {orcamento
                ? `Orçamento ${orcamento.numero_pedido || ""} · ${brl(orcamento.total)} · cada ponto tem motivo abaixo.`
                : "Este contato ainda não tem orçamento em aberto."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {placar.motivos.map((m, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-sm text-slate-700">{m.motivo}</p>
                <span className={"shrink-0 text-sm font-semibold " + (m.pontos > 0 ? "text-emerald-700" : m.pontos < 0 ? "text-rose-700" : "text-slate-400")}>
                  {m.pontos > 0 ? "+" : ""}{m.pontos}
                </span>
              </div>
            ))}
          </div>
          <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            Como é calculado: pontos pelo valor do orçamento, pontos pela recência do último contato
            e menos pontos por dia sem retorno do cliente. Nenhuma fórmula escondida: tudo aparece nesta lista.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}