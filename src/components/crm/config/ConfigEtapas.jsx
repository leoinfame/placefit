import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, ListOrdered, Pencil, Plus, Trash2 } from "lucide-react";
import { CORES, visualDaEtapa } from "@/lib/crmEtapas";

/** Configuração das etapas do funil: criar, renomear, recolorir, reordenar e excluir. */
export default function ConfigEtapas({ etapas = [], onCriar, onEditar, onExcluir, onMover }) {
  const [aberto, setAberto] = useState(false);
  const [edicao, setEdicao] = useState(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("slate");
  const [salvando, setSalvando] = useState(false);

  function abrirNova() {
    setEdicao(null);
    setNome("");
    setCor("slate");
    setAberto(true);
  }

  function abrirEdicao(etapa) {
    setEdicao(etapa);
    setNome(etapa.nome || "");
    setCor(etapa.cor || "slate");
    setAberto(true);
  }

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      if (edicao) await onEditar(edicao, { nome: nome.trim(), cor });
      else await onCriar({ nome: nome.trim(), cor });
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="border-slate-200 shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><ListOrdered className="h-4 w-4" /></div>
            <div>
              <h2 className="font-semibold text-slate-900">Etapas do funil</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                As colunas do funil comercial são suas: crie novas etapas, renomeie, troque a cor e a ordem.
                As sete etapas padrão não podem ser excluídas porque a automação do funil usa essas chaves.
              </p>
            </div>
          </div>
          <Button onClick={abrirNova} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" />Nova etapa</Button>
        </div>

        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {etapas.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhuma etapa cadastrada.</p>}
          {etapas.map((etapa, indice) => {
            const visual = visualDaEtapa(etapa.cor);
            return (
              <div key={etapa.id || etapa.chave} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + visual.dot} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{etapa.nome}</span>
                {etapa.sistema && <Badge variant="secondary" className="text-[10px] font-normal">Padrão</Badge>}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={indice === 0} title="Subir" onClick={() => onMover(etapa, -1)}>
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={indice === etapas.length - 1} title="Descer" onClick={() => onMover(etapa, 1)}>
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar nome e cor" onClick={() => abrirEdicao(etapa)}>
                    <Pencil className="h-4 w-4 text-slate-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={etapa.sistema}
                    title={etapa.sistema ? "Etapa padrão do funil automático: só é possível renomear" : "Excluir etapa"}
                    onClick={() => onExcluir(etapa)}
                  >
                    <Trash2 className={"h-4 w-4 " + (etapa.sistema ? "text-slate-300" : "text-slate-400")} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{edicao ? "Editar etapa" : "Nova etapa"}</DialogTitle>
            <DialogDescription>O nome aparece na coluna do funil e no seletor da conversa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Nome da etapa</Label>
              <Input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Ex.: Retorno marcado" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    title={item.label}
                    onClick={() => setCor(item.valor)}
                    className={"h-8 w-8 rounded-full border-2 transition " + visualDaEtapa(item.valor).dot + (cor === item.valor ? " border-slate-900" : " border-transparent")}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={salvar} disabled={salvando || !nome.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}