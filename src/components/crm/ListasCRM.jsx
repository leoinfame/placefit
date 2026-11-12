import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ListPlus, Plus, Tags } from "lucide-react";

// Listas do CRM (CRMLista). Uma conversa pode estar em várias listas ao mesmo tempo
// (CRMConversa.listas guarda os ids). A etapa do funil continua separada.

const COR_PADRAO = "#475569";

export const corDaLista = (lista) => (/^#[0-9a-f]{6}$/i.test(lista?.cor || "") ? lista.cor : COR_PADRAO);

export function ChipLista({ lista, ativo = true, compacto = false, onClick }) {
  const cor = corDaLista(lista);
  const estilo = ativo
    ? { backgroundColor: cor + "1A", color: cor, borderColor: cor + "55" }
    : { backgroundColor: "#fff", color: "#64748b", borderColor: "#e2e8f0" };
  const classe = "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium " +
    (compacto ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-1 text-xs") +
    (onClick ? " cursor-pointer transition hover:opacity-80" : "");
  const conteudo = (
    <>
      <span className={"rounded-full " + (compacto ? "h-1.5 w-1.5" : "h-2 w-2")} style={{ backgroundColor: cor }} />
      {lista.nome}
    </>
  );
  return onClick
    ? <button type="button" className={classe} style={estilo} onClick={onClick}>{conteudo}</button>
    : <span className={classe} style={estilo}>{conteudo}</span>;
}

// Faixa de filtro acima da lista de conversas: Todas, cada lista com contagem e "Sem lista".
export function FiltroListas({ listas, conversas, valor, onChange }) {
  if (!listas.length) return null;
  const contar = (id) => conversas.filter((c) => (c.listas || []).includes(id)).length;
  const semLista = conversas.filter((c) => !(c.listas || []).some((id) => listas.some((l) => l.id === id))).length;
  const botao = (chave, rotulo, qtd) => (
    <button
      key={chave}
      type="button"
      onClick={() => onChange(chave)}
      className={"inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition " +
        (valor === chave ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
    >
      {rotulo}<span className={valor === chave ? "text-emerald-100" : "text-slate-400"}>{qtd}</span>
    </button>
  );
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 pt-3 [scrollbar-width:thin]">
      {botao("todas", "Todas", conversas.length)}
      {listas.map((lista) => {
        const ativo = valor === lista.id;
        const cor = corDaLista(lista);
        return (
          <button
            key={lista.id}
            type="button"
            onClick={() => onChange(ativo ? "todas" : lista.id)}
            title={lista.descricao || lista.nome}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:opacity-90"
            style={ativo
              ? { backgroundColor: cor, borderColor: cor, color: "#fff" }
              : { backgroundColor: cor + "14", borderColor: cor + "40", color: cor }}
          >
            {lista.nome}<span style={{ opacity: 0.7 }}>{contar(lista.id)}</span>
          </button>
        );
      })}
      {botao("sem_lista", "Sem lista", semLista)}
    </div>
  );
}

// Na conversa aberta: mostra as listas dela e um botão para marcar/desmarcar ou criar lista.
export function ListasDaConversa({ conversa, listas, onToggle, onCriar }) {
  const [aberto, setAberto] = useState(false);
  const [novaLista, setNovaLista] = useState("");
  const [salvando, setSalvando] = useState(false);
  const atuais = conversa?.listas || [];
  const marcadas = listas.filter((l) => atuais.includes(l.id));

  async function criar() {
    const nome = novaLista.trim();
    if (!nome) return;
    setSalvando(true);
    try {
      await onCriar(nome);
      setNovaLista("");
    } finally {
      setSalvando(false);
    }
  }

  const segmentos = listas.filter((l) => l.tipo !== "acao");
  const acoes = listas.filter((l) => l.tipo === "acao");
  const grupo = (titulo, itens) => itens.length > 0 && (
    <div className="space-y-0.5">
      <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      {itens.map((lista) => {
        const marcada = atuais.includes(lista.id);
        return (
          <button
            key={lista.id}
            type="button"
            onClick={() => onToggle(conversa, lista.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
          >
            <span className={"flex h-4 w-4 items-center justify-center rounded border " + (marcada ? "border-emerald-600 bg-emerald-600" : "border-slate-300")}>
              {marcada && <Check className="h-3 w-3 text-white" />}
            </span>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corDaLista(lista) }} />
            <span className="flex-1 truncate text-slate-700">{lista.nome}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {marcadas.map((lista) => <ChipLista key={lista.id} lista={lista} />)}
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-xs">
            {marcadas.length ? <Tags className="h-3.5 w-3.5" /> : <ListPlus className="h-3.5 w-3.5" />}
            {marcadas.length ? "Listas" : "Adicionar a uma lista"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="max-h-72 overflow-y-auto">
            {listas.length === 0 && <p className="px-2 py-3 text-xs text-slate-500">Nenhuma lista ainda. Crie a primeira abaixo.</p>}
            {grupo("Quem é", segmentos)}
            {grupo("O que fazer", acoes)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
            <Input
              value={novaLista}
              onChange={(e) => setNovaLista(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); criar(); } }}
              placeholder="Nova lista..."
              className="h-8 text-xs"
            />
            <Button size="icon" className="h-8 w-8 shrink-0 bg-emerald-600 hover:bg-emerald-700" disabled={salvando || !novaLista.trim()} onClick={criar} title="Criar lista">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
