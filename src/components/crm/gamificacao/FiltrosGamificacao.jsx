import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Filter, Search, X } from "lucide-react";
import {
  ETAPAS_GAMIFICACAO, ORDENACOES, SEMAFOROS_GAMIFICACAO, contarFiltrosAtivos
} from "@/lib/gamificacaoFiltros";

const Campo = ({ rotulo, children }) => (
  <div className="space-y-1">
    <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</Label>
    {children}
  </div>
);

const FiltroSelect = ({ valor, onChange, opcoes, placeholder }) => (
  <Select value={valor} onValueChange={onChange}>
    <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      {opcoes.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

/** Item 024: busca completa da gamificação — todo índice tem filtro e ordenação. */
export default function FiltrosGamificacao({ filtros, onChange, total = 0, visiveis = 0, onLimpar }) {
  const [aberto, setAberto] = useState(false);
  const ativos = contarFiltrosAtivos(filtros);
  const alterar = (patch) => onChange({ ...filtros, ...patch });
  const crescente = filtros.direcao === "asc";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={filtros.busca}
            onChange={(e) => alterar({ busca: e.target.value })}
            placeholder="Nome, telefone, número do orçamento, item ou próximo passo"
            className="h-9 pl-8"
          />
        </div>
        <Select value={filtros.ordenarPor} onValueChange={(v) => alterar({ ordenarPor: v })}>
          <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ORDENACOES.map((o) => <SelectItem key={o.value} value={o.value}>Ordenar por {o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-9"
          onClick={() => alterar({ direcao: crescente ? "desc" : "asc" })}
          title={crescente ? "Crescente" : "Decrescente"}
        >
          {crescente ? <ArrowUpWideNarrow className="mr-1 h-3.5 w-3.5" /> : <ArrowDownWideNarrow className="mr-1 h-3.5 w-3.5" />}
          {crescente ? "Crescente" : "Decrescente"}
        </Button>
        <Button size="sm" variant={aberto ? "default" : "outline"} className={"h-9 " + (aberto ? "bg-slate-900 hover:bg-slate-800" : "")} onClick={() => setAberto((v) => !v)}>
          <Filter className="mr-1 h-3.5 w-3.5" /> Filtros
          {ativos > 0 && <Badge className="ml-1.5 border-0 bg-white/20 text-[10px] text-inherit">{ativos}</Badge>}
        </Button>
        {ativos > 0 && (
          <Button size="sm" variant="ghost" className="h-9 text-slate-600" onClick={onLimpar}>
            <X className="mr-1 h-3.5 w-3.5" /> Limpar
          </Button>
        )}
        <span className="text-xs text-slate-500">{visiveis} de {total}</span>
      </div>

      {aberto && (
        <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Valor mínimo (R$)">
            <Input type="number" min="0" value={filtros.valorMin} onChange={(e) => alterar({ valorMin: e.target.value })} placeholder="0" className="h-9" />
          </Campo>
          <Campo rotulo="Valor máximo (R$)">
            <Input type="number" min="0" value={filtros.valorMax} onChange={(e) => alterar({ valorMax: e.target.value })} placeholder="Sem limite" className="h-9" />
          </Campo>
          <Campo rotulo="Dias sem retorno (mín.)">
            <Input type="number" min="0" value={filtros.diasMin} onChange={(e) => alterar({ diasMin: e.target.value })} placeholder="0" className="h-9" />
          </Campo>
          <Campo rotulo="Dias sem retorno (máx.)">
            <Input type="number" min="0" value={filtros.diasMax} onChange={(e) => alterar({ diasMax: e.target.value })} placeholder="Sem limite" className="h-9" />
          </Campo>
          <Campo rotulo="Orçamento de">
            <Input type="date" value={filtros.criadoDe} onChange={(e) => alterar({ criadoDe: e.target.value })} className="h-9" />
          </Campo>
          <Campo rotulo="Orçamento até">
            <Input type="date" value={filtros.criadoAte} onChange={(e) => alterar({ criadoAte: e.target.value })} className="h-9" />
          </Campo>
          <Campo rotulo="Última resposta do cliente de">
            <Input type="date" value={filtros.contatoDe} onChange={(e) => alterar({ contatoDe: e.target.value })} className="h-9" />
          </Campo>
          <Campo rotulo="Última resposta do cliente até">
            <Input type="date" value={filtros.contatoAte} onChange={(e) => alterar({ contatoAte: e.target.value })} className="h-9" />
          </Campo>
          <Campo rotulo="Etapa do funil">
            <FiltroSelect
              valor={filtros.etapa}
              onChange={(v) => alterar({ etapa: v })}
              opcoes={[{ value: "todas", label: "Todas as etapas" }, ...ETAPAS_GAMIFICACAO]}
            />
          </Campo>
          <Campo rotulo="Semáforo">
            <FiltroSelect
              valor={filtros.semaforo}
              onChange={(v) => alterar({ semaforo: v })}
              opcoes={[{ value: "todos", label: "Todos os semáforos" }, ...SEMAFOROS_GAMIFICACAO]}
            />
          </Campo>
          <Campo rotulo="Próximo passo">
            <FiltroSelect
              valor={filtros.passo}
              onChange={(v) => alterar({ passo: v })}
              opcoes={[
                { value: "todos", label: "Com e sem registro" },
                { value: "com", label: "Com próximo passo" },
                { value: "sem", label: "Sem próximo passo" }
              ]}
            />
          </Campo>
          <Campo rotulo="Atendimento do bot">
            <FiltroSelect
              valor={filtros.bot}
              onChange={(v) => alterar({ bot: v })}
              opcoes={[
                { value: "todos", label: "Bot e dono" },
                { value: "pausado", label: "Dono assumiu (bot pausado)" },
                { value: "automatico", label: "Bot respondendo" }
              ]}
            />
          </Campo>
        </div>
      )}
    </div>
  );
}