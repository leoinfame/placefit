import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, AlertTriangle, Radio } from "lucide-react";
import { ROTULO_EVENTO, ROTULO_STATUS, dataHora } from "../lib/hubApi";
import { Cartao, Vazio } from "../components/Cartao";
import { Selecao } from "../components/Campos";

const COR_EVENTO = {
  coletado_no_fabricante: "border-amber-400",
  entregue_na_base: "border-orange-400",
  conferido: "border-emerald-500",
  pedido_consolidado: "border-teal-500",
  retirado_pelo_fretista: "border-blue-500",
  entregue_ao_cliente: "border-emerald-700",
  falsa_coleta: "border-red-500",
};

// Linha do tempo de custodia em tempo real + contagem de servicos por status.
export default function AdminAoVivo() {
  const [eventos, setEventos] = useState(null);
  const [pickups, setPickups] = useState([]);
  const [fretes, setFretes] = useState([]);
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [foto, setFoto] = useState(null);

  useEffect(() => {
    const carregarServicos = () => Promise.all([
      base44.entities.Pickup.list("-updated_date", 500),
      base44.entities.FreightLeg.list("-updated_date", 300),
    ]).then(([p, f]) => { setPickups(p); setFretes(f); }).catch(() => null);
    base44.entities.CustodyEvent.list("-registrado_em", 200).then(setEventos).catch(() => setEventos([]));
    carregarServicos();
    const s1 = base44.entities.CustodyEvent.subscribe((ev) => {
      if (ev.type === "create") setEventos((atual) => [ev.data, ...(atual || [])]);
      carregarServicos();
    });
    return () => s1?.();
  }, []);

  const contagem = (lista) => lista.reduce((m, x) => ({ ...m, [x.status]: (m[x.status] || 0) + 1 }), {});
  const cp = contagem(pickups), cf = contagem(fretes);

  const filtrados = useMemo(() => (eventos || []).filter((e) =>
    (!tipo || e.tipo === tipo) &&
    (!busca || `${e.referencia} ${e.ator_nome}`.toLowerCase().includes(busca.toLowerCase()))), [eventos, tipo, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 animate-pulse text-red-500" />
        <h1 className="text-xl font-bold">Ao vivo</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Aguardando fabricante" valor={(cp.aguardando_pronto || 0) + (cp.falsa_coleta || 0)} />
        <Indicador rotulo="Coletas na rua" valor={(cp.disponivel || 0) + (cp.aceita || 0) + (cp.janela_confirmada || 0) + (cp.coletada || 0)} />
        <Indicador rotulo="Na base p/ conferir" valor={cp.entregue_base || 0} destaque={cp.entregue_base > 0} />
        <Indicador rotulo="Fretes em rota" valor={(cf.aceito || 0) + (cf.retirado || 0)} />
      </div>

      <Cartao>
        <p className="mb-2 text-sm font-semibold text-slate-500">Pedidos (frete)</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(cf).map(([s, n]) => <span key={s} className="rounded-full bg-slate-100 px-3 py-1">{ROTULO_STATUS[s] || s}: <b>{n}</b></span>)}
          {!fretes.length && <span className="text-slate-400">Nenhum pedido no Hub ainda.</span>}
        </div>
      </Cartao>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Selecao value={tipo} onChange={setTipo} className="sm:w-64">
          <option value="">Todos os eventos</option>
          {Object.entries(ROTULO_EVENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selecao>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código ou pessoa" />
      </div>

      {!eventos ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : filtrados.length === 0 ? <Vazio>Nenhum evento de custódia ainda.</Vazio> : (
          <div className="space-y-2">
            {filtrados.map((e) => (
              <div key={e.id} className={`flex gap-3 rounded-xl border-l-4 bg-white p-3 shadow-sm ${COR_EVENTO[e.tipo] || "border-slate-300"}`}>
                {e.foto_url && (
                  <button onClick={() => setFoto(e.foto_url)} className="shrink-0">
                    <img src={e.foto_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  </button>
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <b>{ROTULO_EVENTO[e.tipo]}</b>
                    <span className="text-slate-500">{e.referencia}</span>
                    <span className="ml-auto text-xs text-slate-400">{dataHora(e.registrado_em)}</span>
                  </div>
                  <p className="text-slate-600">{e.ator_nome} <span className="text-xs text-slate-400">({e.ator_papel}{e.qr_digitado ? ", código digitado" : ""})</span></p>
                  {e.divergencia && <p className="flex items-center gap-1 text-red-700"><AlertTriangle className="h-4 w-4" />{e.divergencia}</p>}
                  {e.recebedor_nome && <p className="text-slate-600">Recebido por {e.recebedor_nome}</p>}
                  {e.observacao && <p className="text-slate-500">{e.observacao}</p>}
                  {e.geo_status === "ok" ? (
                    <a href={`https://www.google.com/maps?q=${e.lat},${e.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700">
                      <MapPin className="h-3 w-3" />ver local{e.precisao_m ? ` (±${e.precisao_m} m)` : ""}
                    </a>
                  ) : <span className="text-xs text-amber-700">sem localização ({e.geo_status})</span>}
                </div>
              </div>
            ))}
          </div>
        )}

      {foto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setFoto(null)}>
          <img src={foto} alt="Foto do volume" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

function Indicador({ rotulo, valor, destaque }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${destaque ? "bg-orange-50" : "bg-white"}`}>
      <p className="text-3xl font-extrabold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-500">{rotulo}</p>
    </div>
  );
}
