import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal } from "lucide-react";

const CAMPOS = [
  ["limite_orcamento_dias", "Dias parados em Orçamento"],
  ["limite_negociacao_dias", "Dias parados em Negociação"],
  ["limite_atendimento_dias", "Dias parados em Atendimento"],
  ["valor_alto", "Valor alto (R$)"],
  ["valor_alto_pontos", "Pontos do valor alto"],
  ["valor_medio", "Valor médio (R$)"],
  ["valor_medio_pontos", "Pontos do valor médio"],
  ["contato_recente_pontos", "Pontos: contato nas últimas 24h"],
  ["contato_tres_dias_pontos", "Pontos: contato nos últimos 3 dias"],
  ["penalidade_dia_sem_retorno", "Pontos perdidos por dia sem retorno"]
];

/** Item 024B/A: limites e pesos fáceis de trocar, por conta. */
export default function ConfigGamificacao({ config, onSalvar }) {
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState({});
  const [salvando, setSalvando] = useState(false);

  function abrir() {
    setValores(Object.fromEntries(CAMPOS.map(([campo]) => [campo, String(config?.[campo] ?? "")])));
    setAberto(true);
  }

  async function salvar() {
    setSalvando(true);
    try {
      const limpos = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, Number(v) || 0]));
      await onSalvar(limpos);
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={abrir}>
        <SlidersHorizontal className="mr-2 h-3.5 w-3.5" /> Ajustar regras
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Regras do placar e do semáforo</DialogTitle>
            <DialogDescription>
              Proposta inicial: Orçamento 2 dias, Negociação 5 dias. O semáforo conta da última atividade da conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto py-1 sm:grid-cols-2">
            {CAMPOS.map(([campo, rotulo]) => (
              <div key={campo} className="space-y-1">
                <Label className="text-xs text-slate-600">{rotulo}</Label>
                <Input
                  type="number"
                  min={0}
                  value={valores[campo] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={salvar} disabled={salvando}>Salvar regras</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}