import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, CheckCircle2, MessageCircle, X } from "lucide-react";

// Item 023: alertas do Monitor do CRM (o CRM avisando o revendedor sozinho).
const COR = {
  grave: "border-rose-200 bg-rose-50 text-rose-800",
  atencao: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-slate-200 bg-slate-50 text-slate-700"
};
const ROTULO = { grave: "Urgente", atencao: "Atenção", info: "Informação" };
const ORDEM = { grave: 0, atencao: 1, info: 2 };

const quando = (iso) => {
  if (!iso) return "";
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function AlertasCRM({ ownerId, onAbrirConversa }) {
  const [alertas, setAlertas] = useState([]);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    if (!ownerId) return;
    try {
      const rows = await base44.entities.CRMAlerta.filter({ owner_id: ownerId, status: "aberto" }, "-created_date", 100);
      setAlertas((rows || []).filter((a) => a.tipo !== "controle")
        .sort((a, b) => (ORDEM[a.gravidade] ?? 3) - (ORDEM[b.gravidade] ?? 3)));
    } catch {
      setAlertas([]);
    }
  }, [ownerId]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 120000);
    return () => clearInterval(t);
  }, [carregar]);

  const fechar = async (alerta, status) => {
    setAlertas((lista) => lista.filter((a) => a.id !== alerta.id));
    try {
      await base44.entities.CRMAlerta.update(alerta.id, { status, resolvido_em: new Date().toISOString() });
    } catch {
      carregar();
    }
  };

  const urgentes = alertas.filter((a) => a.gravidade === "grave").length;

  return (
    <>
      <Button variant="outline" className="relative bg-white" onClick={() => setAberto(true)} title="Alertas do Monitor do CRM">
        <Bell className="mr-2 h-4 w-4" />Alertas
        {alertas.length > 0 && (
          <span className={"ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white " + (urgentes ? "bg-rose-600" : "bg-amber-500")}>{alertas.length}</span>
        )}
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Monitor do CRM</DialogTitle>
            <DialogDescription>O CRM confere sozinho a resposta automática, a tabela, o funil e o WhatsApp. Urgentes também chegam pelo gerente no WhatsApp.</DialogDescription>
          </DialogHeader>
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center text-slate-500"><CheckCircle2 className="h-10 w-10 text-emerald-500" /><p className="mt-3 text-sm">Nada pendente. Está tudo em dia.</p></div>
          ) : (
            <div className="space-y-2">
              {alertas.map((a) => (
                <div key={a.id} className={"rounded-xl border p-3 " + (COR[a.gravidade] || COR.info)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{ROTULO[a.gravidade] || "Aviso"} · {quando(a.created_date)}</p>
                      <p className="mt-1 text-sm font-semibold">{a.titulo}</p>
                      {a.detalhe && <p className="mt-1 text-xs opacity-90">{a.detalhe}</p>}
                    </div>
                    <button className="shrink-0 rounded p-1 opacity-60 hover:opacity-100" title="Dispensar (não avisa de novo)" onClick={() => fechar(a, "dispensado")}><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.conversa_id && onAbrirConversa && (
                      <Button size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={() => { setAberto(false); onAbrirConversa(a.conversa_id); }}><MessageCircle className="mr-1 h-3 w-3" />Abrir conversa</Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={() => fechar(a, "resolvido")}><CheckCircle2 className="mr-1 h-3 w-3" />Resolvido</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
