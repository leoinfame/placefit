import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trophy } from "lucide-react";
import { brl } from "@/lib/crmGamificacao";
import SemaforoBadge from "@/components/crm/gamificacao/SemaforoBadge";
import PlacarBadge from "@/components/crm/gamificacao/PlacarBadge";
import ProximoPassoBotao from "@/components/crm/gamificacao/ProximoPassoBotao";
import RankingOrcamentos from "@/components/crm/gamificacao/RankingOrcamentos";
import ConfigGamificacao from "@/components/crm/gamificacao/ConfigGamificacao";

/** Item 024: aba de gamificação do CRM — placar, semáforo, ranking e sugestões. */
export default function GamificacaoTab({ gam, onAbrirConversa, nomeContato, nomeTelefone }) {
  const { config, fila, ranking, salvarConfig, registrarProximoPasso } = gam;

  return (
    <div className="space-y-5">
      <Card className="border-slate-200 shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-semibold text-slate-900">Gamificação do atendimento</h2>
            <p className="mt-1 text-sm text-slate-500">
              Placar com motivo visível, semáforo por etapa e ranking de orçamentos sem fechamento.
              Tudo aqui é leitura e registro: nenhuma mensagem é enviada.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Orçamento {config.limite_orcamento_dias}d · Negociação {config.limite_negociacao_dias}d</Badge>
            <ConfigGamificacao config={config} onSalvar={salvarConfig} />
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-slate-900">Fila de avisos</h3>
          <Badge variant="secondary">{fila.length}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          Só sai da fila quando existe próximo passo registrado na conversa.
        </p>
        {fila.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Nenhum lead esfriando sem próximo passo. Fila limpa.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {fila.slice(0, 12).map((dados) => (
              <Card key={dados.conversa.id} className="border-slate-200 shadow-none">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{nomeContato(dados.conversa)}</p>
                      <p className="text-xs text-slate-500">{nomeTelefone(dados.conversa)}{dados.orcamento ? ` · ${brl(dados.orcamento.total)}` : ""}</p>
                    </div>
                    <SemaforoBadge semaforo={dados.semaforo} proximoPasso={dados.proximoPasso} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PlacarBadge dados={dados} />
                    <ProximoPassoBotao dados={dados} onSalvar={registrarProximoPasso} />
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onAbrirConversa(dados.conversa.id)}>
                      Abrir conversa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {fila.length > 12 && (
          <p className="text-xs text-slate-500">Mostrando os 12 mais parados de {fila.length}. Os demais aparecem no funil comercial.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-slate-900">Orçamento sem fechamento</h3>
        </div>
        <RankingOrcamentos ranking={ranking} onAbrirConversa={onAbrirConversa} />
      </section>
    </div>
  );
}