import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ArrowUpDown, Copy, MessageSquare } from "lucide-react";
import { brl } from "@/lib/crmGamificacao";

const dataCurta = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

/** Item 024D e 024E: ranking de orçamentos sem fechamento + sugestão para copiar. */
export default function RankingOrcamentos({ ranking = [], onAbrirConversa }) {
  const { toast } = useToast();
  const [ordem, setOrdem] = useState("dias");
  const [detalhe, setDetalhe] = useState(null);

  const linhas = useMemo(() => {
    const copia = [...ranking];
    copia.sort((a, b) => ordem === "valor" ? b.valor - a.valor : b.diasSemRetorno - a.diasSemRetorno);
    return copia;
  }, [ranking, ordem]);

  function copiar(texto) {
    navigator.clipboard.writeText(texto);
    toast({ title: "Sugestão copiada", description: "O envio é sempre manual, pelo seu WhatsApp." });
  }

  if (!ranking.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <MessageSquare className="mx-auto h-9 w-9 text-slate-300" />
        <p className="mt-3 font-medium text-slate-700">Nenhum orçamento em aberto.</p>
        <p className="mt-1 text-sm text-slate-500">Quando sair um orçamento pendente, ele aparece aqui com os dias sem retorno.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{ranking.length} orçamento(s) sem fechamento</p>
        <div className="flex gap-1">
          <Button size="sm" variant={ordem === "dias" ? "default" : "outline"} className={ordem === "dias" ? "bg-slate-900 hover:bg-slate-800" : ""} onClick={() => setOrdem("dias")}>
            <ArrowUpDown className="mr-1 h-3 w-3" /> Dias sem retorno
          </Button>
          <Button size="sm" variant={ordem === "valor" ? "default" : "outline"} className={ordem === "valor" ? "bg-slate-900 hover:bg-slate-800" : ""} onClick={() => setOrdem("valor")}>
            <ArrowUpDown className="mr-1 h-3 w-3" /> Valor
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_110px_100px_110px_minmax(0,1.6fr)] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <span>Cliente</span><span>Valor</span><span>Criado</span><span>Sem retorno</span><span>Próximo passo</span>
        </div>
        {linhas.map((linha) => (
          <button
            key={linha.id}
            onClick={() => setDetalhe(linha)}
            className="grid w-full grid-cols-1 gap-1 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 md:grid-cols-[minmax(0,1.4fr)_110px_100px_110px_minmax(0,1.6fr)] md:items-center md:gap-3"
          >
            <span className="truncate text-sm font-semibold text-slate-900">{linha.nome}</span>
            <span className="text-sm text-slate-700">{brl(linha.valor)}</span>
            <span className="text-xs text-slate-500">{dataCurta(linha.criado)}</span>
            <Badge className={"w-fit border-0 text-[11px] " + (linha.diasSemRetorno >= 10 ? "bg-rose-100 text-rose-700" : linha.diasSemRetorno >= 4 ? "bg-orange-100 text-orange-800" : "bg-amber-100 text-amber-800")}>
              {linha.diasSemRetorno} dia(s)
            </Badge>
            <span className="truncate text-xs text-slate-600">{linha.proximoPasso}</span>
          </button>
        ))}
      </div>

      <Dialog open={Boolean(detalhe)} onOpenChange={(v) => !v && setDetalhe(null)}>
        <DialogContent className="sm:max-w-2xl">
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle>{detalhe.nome} · {brl(detalhe.valor)}</DialogTitle>
                <DialogDescription>
                  Orçamento {detalhe.orcamento?.numero_pedido || "sem número"} criado em {dataCurta(detalhe.criado)} ·{" "}
                  {detalhe.diasSemRetorno} dia(s) sem retorno.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Último contato do cliente</p>
                  <p className="text-sm text-slate-800">{detalhe.ultimoContatoCliente ? dataCurta(detalhe.ultimoContatoCliente) : "Nenhum depois do orçamento"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Último contato nosso</p>
                  <p className="text-sm text-slate-800">{detalhe.ultimoContatoNosso ? dataCurta(detalhe.ultimoContatoNosso) : "—"}</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200">
                <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Itens do orçamento</p>
                <div className="max-h-48 overflow-y-auto">
                  {(detalhe.orcamento?.itens || []).length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Sem itens registrados neste orçamento.</p>}
                  {(detalhe.orcamento?.itens || []).map((item, i) => (
                    <div key={i} className="grid grid-cols-[70px_minmax(0,1fr)_50px_90px] items-center gap-2 border-b border-slate-50 px-3 py-1.5 last:border-b-0">
                      <span className="truncate text-[11px] text-slate-500">{item.cod || "—"}</span>
                      <span className="truncate text-xs text-slate-800">{item.nome || "—"}</span>
                      <span className="text-xs text-slate-600">{item.quantidade}×</span>
                      <span className="text-right text-xs text-slate-700">{brl(item.preco_unitario)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Sugestão de retomada · {detalhe.sugestao.motivo}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{detalhe.sugestao.texto}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => copiar(detalhe.sugestao.texto)}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
                  </Button>
                  {detalhe.conversa && (
                    <Button size="sm" variant="outline" onClick={() => { setDetalhe(null); onAbrirConversa?.(detalhe.conversa.id); }}>
                      Abrir conversa
                    </Button>
                  )}
                  <span className="text-[11px] text-emerald-800">Nada é enviado automaticamente.</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}