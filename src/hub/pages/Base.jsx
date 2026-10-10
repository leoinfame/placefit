import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ClipboardCheck, Boxes, Truck, ArrowLeft, Printer, QrCode, CheckCircle2, Circle, BellRing, RefreshCw } from "lucide-react";
import { hub, brl, dataHora } from "../lib/hubApi";
import { useHub } from "../components/HubContexto";
import { Cartao, Vazio, Erro } from "../components/Cartao";
import Status from "../components/Status";
import RegistrarCustodia from "../components/RegistrarCustodia";

// Tela da base: tres botoes grandes. Admin sem perfil de base tambem opera aqui.
export default function Base() {
  const ctx = useHub();
  const papel = ctx.perfis.some((p) => p.tipo === "base") ? "base" : "admin";
  const [tela, setTela] = useState(null);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [custodia, setCustodia] = useState(null);
  const [pronto, setPronto] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const carregar = useCallback(async () => {
    setErro("");
    try { setDados(await hub("painel_base", { papel })); } catch (e) { setErro(e.message); }
  }, [papel]);
  useEffect(() => { carregar(); }, [carregar]);

  const chamar = async (id, acao, extra) => {
    setOcupado(id);
    setErro("");
    try { await hub(acao, { papel, ...extra }); await carregar(); } catch (e) { setErro(e.message); }
    setOcupado(null);
  };

  if (!dados) return <div className="flex justify-center py-16">{erro ? <Erro texto={erro} /> : <Loader2 className="h-8 w-8 animate-spin text-slate-400" />}</div>;

  const nConferir = dados.chegando.length + dados.para_conferir.length;
  const nConsolidar = dados.para_consolidar.filter((f) => f.pronto).length;

  const BOTOES = [
    { id: "conferir", titulo: "Conferir chegada", icone: ClipboardCheck, n: nConferir, cor: "bg-orange-500" },
    { id: "consolidar", titulo: "Consolidar pedido", icone: Boxes, n: nConsolidar, cor: "bg-teal-600" },
    { id: "liberar", titulo: "Liberar para frete", icone: Truck, n: dados.para_liberar.length, cor: "bg-blue-600" },
  ];

  if (!tela) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Base</h1>
          <Button variant="ghost" size="icon" onClick={carregar}><RefreshCw className="h-5 w-5" /></Button>
        </div>
        <Erro texto={erro} />
        {BOTOES.map(({ id, titulo, icone: Icone, n, cor }) => (
          <button key={id} onClick={() => setTela(id)} className={`flex w-full items-center gap-4 rounded-2xl ${cor} p-6 text-left text-white shadow-lg active:scale-[0.99]`}>
            <Icone className="h-12 w-12" />
            <span className="flex-1 text-2xl font-extrabold">{titulo}</span>
            {n > 0 && <span className="rounded-full bg-white px-3 py-1 text-lg font-bold text-slate-900">{n}</span>}
          </button>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="outline" className="h-14 bg-white" onClick={() => setTela("pronto")}>
            <BellRing className="mr-2 h-5 w-5" />Marcar pronto{dados.a_marcar_pronto.length ? ` (${dados.a_marcar_pronto.length})` : ""}
          </Button>
          <Button variant="outline" className="h-14 bg-white" asChild>
            <Link to="/hub/etiquetas" target="_blank"><Printer className="mr-2 h-5 w-5" />Etiquetas do dia</Link>
          </Button>
        </div>
        {dados.em_andamento.length > 0 && (
          <Cartao>
            <p className="mb-2 text-sm font-semibold text-slate-500">Coletas em andamento</p>
            {dados.em_andamento.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
                <span>{p.numero} · {p.fabricante_nome}{p.coletor_nome ? ` · ${p.coletor_nome}` : ""}</span><Status status={p.status} />
              </div>
            ))}
          </Cartao>
        )}
      </div>
    );
  }

  const voltar = (
    <button onClick={() => { setTela(null); carregar(); }} className="mb-3 flex items-center gap-1 text-sm font-medium text-slate-600">
      <ArrowLeft className="h-4 w-4" />Voltar
    </button>
  );

  return (
    <div className="mx-auto max-w-md">
      {voltar}
      <Erro texto={erro} />

      {tela === "conferir" && (
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Conferir chegada</h1>
          <Button className="h-16 w-full bg-orange-500 text-lg hover:bg-orange-600" onClick={() => setCustodia({ tipo: "conferido" })}>
            <QrCode className="mr-2 h-6 w-6" />Escanear volume para conferir
          </Button>
          {nConferir === 0 && <Vazio>Nada chegando agora.</Vazio>}
          {dados.para_conferir.map((p) => (
            <Cartao key={p.id}>
              <Linha p={p} />
              <Button className="mt-3 h-12 w-full" onClick={() => setCustodia({ tipo: "conferido", id: p.id, ref: p.numero })}>Conferir {p.numero}</Button>
            </Cartao>
          ))}
          {dados.chegando.map((p) => (
            <Cartao key={p.id}>
              <Linha p={p} />
              <p className="mt-1 text-xs text-slate-500">Coletor ainda não registrou a entrega. Se o volume já está aqui, receba primeiro.</p>
              <Button variant="outline" className="mt-3 h-12 w-full" onClick={() => setCustodia({ tipo: "entregue_na_base", id: p.id, ref: p.numero })}>Receber na base</Button>
            </Cartao>
          ))}
        </div>
      )}

      {tela === "consolidar" && (
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Consolidar pedido</h1>
          {dados.para_consolidar.length === 0 && <Vazio>Nenhum pedido aguardando consolidação.</Vazio>}
          {dados.para_consolidar.map((f) => (
            <Cartao key={f.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{f.numero}</p>
                  <p className="font-bold">{f.cliente_nome} — {f.destino_cidade}/{f.destino_uf}</p>
                  <p className="text-xs text-slate-500">{f.revendedor_nome}</p>
                </div>
                {f.pronto ? <span className="text-sm font-semibold text-emerald-600">Completo</span> : <span className="text-sm text-slate-500">faltam {f.faltam}</span>}
              </div>
              <ul className="mt-2 space-y-1">
                {f.subpedidos.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    {s.status === "conferida" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
                    <span className="flex-1">{s.fabricante_nome}</span><Status status={s.status} />
                  </li>
                ))}
              </ul>
              {f.pronto && (
                <div className="mt-3 grid gap-2">
                  <Button variant="outline" className="h-12" disabled={ocupado === f.id} onClick={async () => {
                    await chamar(f.id, "consolidar", { freight_leg_id: f.id });
                    window.open(`/hub/etiquetas?frete=${f.id}`, "_blank");
                  }}>
                    <Printer className="mr-2 h-5 w-5" />1. Imprimir etiqueta mestre
                  </Button>
                  <Button className="h-14 bg-teal-600 text-base hover:bg-teal-700" onClick={() => setCustodia({ tipo: "pedido_consolidado", freteId: f.id, ref: f.numero })}>
                    <QrCode className="mr-2 h-5 w-5" />2. Escanear QR mestre e fotografar
                  </Button>
                </div>
              )}
            </Cartao>
          ))}
        </div>
      )}

      {tela === "liberar" && (
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Liberar para frete</h1>
          {dados.para_liberar.length === 0 && <Vazio>Nenhum pedido consolidado esperando liberação.</Vazio>}
          {dados.para_liberar.map((f) => (
            <Cartao key={f.id}>
              <p className="text-xs font-semibold text-slate-400">{f.numero}</p>
              <p className="font-bold">{f.cliente_nome} — {f.destino_cidade}/{f.destino_uf}</p>
              <p className="text-sm text-slate-600">{[f.volumes && `${f.volumes} vol.`, f.peso_kg && `${f.peso_kg} kg`].filter(Boolean).join(" · ")} · Frete: {brl(f.valor_frete)}</p>
              {f.valor_frete > 0 ? (
                <Button className="mt-3 h-14 w-full bg-blue-600 text-base hover:bg-blue-700" disabled={ocupado === f.id} onClick={() => chamar(f.id, "acao_frete", { freight_leg_id: f.id, acao_frete: "liberar" })}>
                  {ocupado === f.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Truck className="mr-2 h-5 w-5" />Liberar para a fila de frete</>}
                </Button>
              ) : (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Aguardando o admin definir o valor do frete.</p>
              )}
            </Cartao>
          ))}
        </div>
      )}

      {tela === "pronto" && (
        <div className="space-y-3">
          <h1 className="text-xl font-bold">Marcar pedido pronto</h1>
          <p className="text-sm text-slate-600">Confirme com o fabricante pelo WhatsApp antes. A coleta entra na fila dos coletores da região.</p>
          {dados.a_marcar_pronto.length === 0 && <Vazio>Nenhum subpedido aguardando o fabricante.</Vazio>}
          {dados.a_marcar_pronto.map((p) => (
            <Cartao key={p.id}>
              <Linha p={p} />
              <p className="mt-1 text-sm">Coleta: {brl(p.valor_coleta)}{p.falsas_coletas ? ` · ${p.falsas_coletas} falsa(s) coleta(s)` : ""}</p>
              <Button className="mt-3 h-12 w-full" disabled={!(p.valor_coleta > 0)} onClick={() => setPronto(p)}>
                {p.valor_coleta > 0 ? "Fabricante confirmou: está pronto" : "Aguardando valor da coleta (admin)"}
              </Button>
            </Cartao>
          ))}
        </div>
      )}

      {custodia && (
        <RegistrarCustodia
          aberto
          tipo={custodia.tipo}
          papel={papel}
          pickupId={custodia.id}
          freightLegId={custodia.freteId}
          referencia={custodia.ref}
          onFechar={() => setCustodia(null)}
          onFeito={carregar}
        />
      )}
      {pronto && (
        <ProntoDialog
          pickup={pronto}
          onFechar={() => setPronto(null)}
          onConfirmar={async (confirmacao) => { await chamar(pronto.id, "marcar_pronto", { pickup_id: pronto.id, confirmacao }); setPronto(null); }}
        />
      )}
    </div>
  );
}

function Linha({ p }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-xs font-semibold text-slate-400">{p.numero}{p.coletor_nome ? ` · ${p.coletor_nome}` : ""}</p>
        <p className="font-bold">{p.fabricante_nome}</p>
        <p className="text-xs text-slate-500">{p.revendedor_nome} · {dataHora(p.updated_date)}</p>
      </div>
      <Status status={p.status} />
    </div>
  );
}

export function ProntoDialog({ pickup, onFechar, onConfirmar }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pickup.fabricante_nome} — pedido pronto</DialogTitle>
          <DialogDescription>Registre como o fabricante confirmou. Fica gravado na coleta.</DialogDescription>
        </DialogHeader>
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: WhatsApp com Lucas às 14h, 3 volumes separados" />
        <Button className="h-12" disabled={!texto.trim() || enviando} onClick={async () => { setEnviando(true); await onConfirmar(texto.trim()); setEnviando(false); }}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Liberar para os coletores
        </Button>
      </DialogContent>
    </Dialog>
  );
}
