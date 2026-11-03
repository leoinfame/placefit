import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ClipboardList } from "lucide-react";
import { proximoPassoSugerido } from "@/lib/crmGamificacao";

/** Item 024B: o aviso só sai da fila quando existe próximo passo registrado. */
export default function ProximoPassoBotao({ dados, onSalvar, compacto = false }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const registrado = dados?.proximoPasso;

  function abrir() {
    setTexto(registrado?.descricao || proximoPassoSugerido(dados?.diasSemRetorno || 0));
    setAberto(true);
  }

  async function salvar() {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await onSalvar(dados.conversa, texto);
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => { e.stopPropagation(); abrir(); }}
        className={"gap-1 text-[11px] " + (registrado ? "border-emerald-200 text-emerald-700" : "")}
        title={registrado ? registrado.descricao : "Registrar o próximo passo desta conversa"}
      >
        {registrado ? <Check className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
        {compacto ? "" : registrado ? "Próximo passo registrado" : "Registrar próximo passo"}
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Próximo passo</DialogTitle>
            <DialogDescription>
              O aviso de semáforo sai da fila quando este passo está registrado. Nada é enviado ao cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label>O que vai ser feito</Label>
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: ligar amanhã confirmando frete"
            />
            <p className="text-xs text-slate-500">Sugestão: {proximoPassoSugerido(dados?.diasSemRetorno || 0)}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={salvar} disabled={salvando || !texto.trim()}>
              Salvar próximo passo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}