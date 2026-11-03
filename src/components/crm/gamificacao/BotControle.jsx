import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Hand, Loader2, UserRound } from "lucide-react";

const formatar = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Item 024C: assumir a conversa silencia o bot só neste contato; devolver reativa. */
export default function BotControle({ dados, onAssumir, onDevolver }) {
  const [salvando, setSalvando] = useState(false);
  const pausa = dados?.pausa;
  const manual = Boolean(pausa?.silenciado);

  async function executar(acao) {
    setSalvando(true);
    try { await acao(dados.conversa); } finally { setSalvando(false); }
  }

  if (manual) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="gap-1 border-0 bg-orange-100 text-orange-800">
          <UserRound className="h-3 w-3" /> Atendimento manual
        </Badge>
        <span className="text-[11px] text-slate-500">
          bot silenciado desde {formatar(pausa?.assumido_em)}
          {pausa?.assumido_por ? ` · ${pausa.assumido_por}` : ""}
        </span>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" disabled={salvando} onClick={() => executar(onDevolver)}>
          {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />} Devolver ao bot
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className="gap-1 border-0 bg-emerald-100 text-emerald-700"><Bot className="h-3 w-3" /> Bot ativo</Badge>
      {pausa?.devolvido_em && <span className="text-[11px] text-slate-500">devolvido em {formatar(pausa.devolvido_em)}</span>}
      <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" disabled={salvando} onClick={() => executar(onAssumir)}>
        {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hand className="h-3 w-3" />} Assumir conversa
      </Button>
    </div>
  );
}