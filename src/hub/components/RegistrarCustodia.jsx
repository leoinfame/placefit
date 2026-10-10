import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, QrCode, CheckCircle2 } from "lucide-react";
import Scanner from "./Scanner";
import FotoCampo from "./FotoCampo";
import ChecklistItens from "./ChecklistItens";
import { hub, ROTULO_EVENTO } from "../lib/hubApi";
import { enviarFoto, pegarLocalizacao } from "../lib/captura";

// Fluxo de custodia: 1) escanear QR  2) foto do volume (+ dados do evento)  3) enviar com hora e local.
// pickupId/freightLegId sao opcionais: quando vem, o servidor recusa QR de outro servico.
export default function RegistrarCustodia({ aberto, onFechar, tipo, papel, pickupId, freightLegId, referencia, onFeito }) {
  const [qr, setQr] = useState(null);
  const [foto, setFoto] = useState(null);
  const [obs, setObs] = useState("");
  const [divergencia, setDivergencia] = useState("");
  const [recebedor, setRecebedor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [conferencia, setConferencia] = useState(null); // { coleta, itens }
  const [marcados, setMarcados] = useState([]);
  const [lendo, setLendo] = useState(false);

  // Conferencia: le a etiqueta no servidor para montar o checklist do subpedido.
  useEffect(() => {
    if (tipo !== "conferido" || !qr) return;
    let vivo = true;
    setLendo(true);
    setErro("");
    hub("ler_etiqueta", { qr: qr.texto, papel })
      .then((r) => {
        if (!vivo) return;
        if (pickupId && r.coleta.id !== pickupId) throw new Error(`Etiqueta errada: este QR é da ${r.coleta.numero}.`);
        setConferencia(r);
        setMarcados(r.itens.map(() => ({ ok: false, quantidade_recebida: 0 })));
      })
      .catch((e) => { if (vivo) { setErro(e.message); setQr(null); } })
      .finally(() => vivo && setLendo(false));
    return () => { vivo = false; };
  }, [tipo, qr, papel, pickupId]);

  const limpar = () => { setQr(null); setFoto(null); setObs(""); setDivergencia(""); setRecebedor(""); setErro(""); setConferencia(null); setMarcados([]); };
  const fechar = () => { if (!enviando) { limpar(); onFechar(); } };
  const aoLer = useCallback((texto, digitado) => setQr({ texto, digitado }), []);

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const [geo, foto_url] = await Promise.all([pegarLocalizacao(), enviarFoto(foto)]);
      const r = await hub("custodia", {
        tipo, papel,
        pickup_id: pickupId, freight_leg_id: freightLegId,
        qr: qr.texto, qr_digitado: qr.digitado,
        foto_url, ...geo, hora_dispositivo: new Date().toISOString(),
        observacao: obs || undefined,
        divergencia: divergencia || undefined,
        checklist: tipo === "conferido" && conferencia?.itens.length ? marcados : undefined,
        recebedor_nome: recebedor || undefined,
      });
      limpar();
      onFeito?.(r);
      onFechar();
    } catch (e) {
      setErro(e.message);
      if (/QR|etiqueta|Etiqueta/.test(e.message)) setQr(null);
    }
    setEnviando(false);
  };

  const pronto = qr && foto && (tipo !== "entregue_ao_cliente" || recebedor.trim()) && (tipo !== "conferido" || conferencia);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ROTULO_EVENTO[tipo]}</DialogTitle>
          <DialogDescription>{referencia ? `Serviço ${referencia}. ` : ""}Escaneie a etiqueta e fotografe o volume.</DialogDescription>
        </DialogHeader>

        {!qr ? (
          <Scanner onLer={aoLer} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              <span className="flex-1 break-all">QR lido{qr.digitado ? " (digitado)" : ""}</span>
              <Button size="sm" variant="ghost" onClick={() => setQr(null)}><QrCode className="mr-1 h-4 w-4" />Ler de novo</Button>
            </div>
            <FotoCampo arquivo={foto} onArquivo={setFoto} />
            {tipo === "conferido" && lendo && (
              <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Buscando os itens do subpedido…</p>
            )}
            {tipo === "conferido" && conferencia && (
              <>
                <p className="text-sm"><b>{conferencia.coleta.numero}</b> · {conferencia.coleta.fabricante_nome}</p>
                {conferencia.itens.length > 0
                  ? <ChecklistItens itens={conferencia.itens} marcados={marcados} onChange={setMarcados} />
                  : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Este subpedido não tem lista de itens. Descreva abaixo o que chegou se houver divergência.</p>}
                <Textarea value={divergencia} onChange={(e) => setDivergencia(e.target.value)} placeholder="Outra observação da conferência (avaria, embalagem…)" rows={2} />
              </>
            )}
            {tipo === "entregue_ao_cliente" && (
              <Input value={recebedor} onChange={(e) => setRecebedor(e.target.value)} placeholder="Nome de quem recebeu" className="h-12" />
            )}
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" rows={2} />
            <Button className="h-14 w-full text-base" disabled={!pronto || enviando} onClick={enviar}>
              {enviando ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
              Confirmar {ROTULO_EVENTO[tipo]?.toLowerCase()}
            </Button>
          </div>
        )}
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      </DialogContent>
    </Dialog>
  );
}
