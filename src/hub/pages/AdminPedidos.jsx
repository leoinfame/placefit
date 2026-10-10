import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Printer, RefreshCw, ChevronDown, ChevronUp, Save } from "lucide-react";
import { hub, brl, dataHora, textoPeso } from "../lib/hubApi";
import { Cartao, Vazio, Erro } from "../components/Cartao";
import { Campo, Selecao } from "../components/Campos";
import Status from "../components/Status";
import { ProntoDialog } from "./Base";

// Pedidos das revendas com o Hub ligado: incluir no Hub, definir valores, atribuir, marcar pronto, cancelar.
export default function AdminPedidos() {
  const [dados, setDados] = useState(null);
  const [perfis, setPerfis] = useState([]);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [incluir, setIncluir] = useState(null);
  const [aberto, setAberto] = useState({});
  const [pronto, setPronto] = useState(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const [d, p] = await Promise.all([hub("admin_pedidos"), base44.entities.TransportProfile.list("nome", 500)]);
      setDados(d);
      setPerfis(p.filter((x) => x.ativo !== false));
    } catch (e) { setErro(e.message); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const agir = async (acao, extra) => {
    setErro("");
    try { await hub(acao, { papel: "admin", ...extra }); await carregar(); return true; } catch (e) { setErro(e.message); return false; }
  };

  if (!dados) return <div className="flex justify-center py-10">{erro ? <Erro texto={erro} /> : <Loader2 className="h-6 w-6 animate-spin" />}</div>;

  const lista = dados.pedidos.filter((p) => filtro === "todos" || (filtro === "fora" ? !p.no_hub : p.no_hub));
  const coletores = perfis.filter((p) => p.tipo === "coletor");
  const fretistas = perfis.filter((p) => p.tipo === "fretista");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-xl font-bold">Pedidos</h1>
        <Selecao value={filtro} onChange={setFiltro} className="w-44">
          <option value="todos">Todos</option>
          <option value="hub">No Hub</option>
          <option value="fora">Fora do Hub</option>
        </Selecao>
        <Button variant="outline" size="icon" onClick={carregar}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <Erro texto={erro} />
      {dados.pedidos.length === 0 && <Vazio>Nenhum pedido de revenda com o Hub ligado. Ligue a revenda em Cadastros → Revendas.</Vazio>}

      {lista.map((ped) => {
        const f = ped.frete;
        const exp = aberto[ped.venda_id] ?? (f && !["entregue", "cancelado"].includes(f.status));
        return (
          <Cartao key={ped.venda_id}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">{ped.revendedor_nome} · {dataHora(ped.data)} {ped.numero_pedido ? `· ${ped.numero_pedido}` : ""}</p>
                <p className="font-bold">{ped.cliente_nome || "Cliente não informado"} · {brl(ped.total)}</p>
                <p className="text-xs text-slate-500">{ped.subpedidos.length} fabricante(s): {ped.subpedidos.map((s) => s.fabricante_nome).join(", ")}</p>
              </div>
              {f ? <Status status={f.status} /> : (
                <Button size="sm" onClick={() => setIncluir(ped)}><Plus className="mr-1 h-4 w-4" />Incluir no Hub</Button>
              )}
              {f && (
                <Button size="icon" variant="ghost" onClick={() => setAberto({ ...aberto, [ped.venda_id]: !exp })}>
                  {exp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              )}
            </div>

            {f && exp && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <b>Frete {f.numero}</b>
                    <span className="text-slate-500">{f.destino_cidade}/{f.destino_uf}</span>
                    {f.fretista_nome && <span className="text-slate-500">· {f.fretista_nome}</span>}
                    <Status status={f.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <ValorEditavel rotulo="Valor do frete" valor={f.valor_frete} bloqueado={["retirado", "entregue", "cancelado"].includes(f.status)}
                      onSalvar={(v) => agir("definir_valores", { freight_leg_id: f.id, valor_frete: v })} />
                    {["consolidado", "disponivel", "aceito"].includes(f.status) && (
                      <Atribuir perfis={fretistas} rotulo="Atribuir fretista" onEscolher={(id) => agir("acao_frete", { freight_leg_id: f.id, acao_frete: "atribuir", profile_id: id })} />
                    )}
                    {f.status === "consolidado" && f.valor_frete > 0 && (
                      <Button size="sm" variant="outline" onClick={() => agir("acao_frete", { freight_leg_id: f.id, acao_frete: "liberar" })}>Liberar para a fila</Button>
                    )}
                    {f.qr && <Button size="sm" variant="ghost" asChild><a href={`/hub/etiquetas?frete=${f.id}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />QR mestre</a></Button>}
                    {!["retirado", "entregue", "cancelado"].includes(f.status) && (
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => {
                        const motivo = prompt("Motivo do cancelamento do frete?");
                        if (motivo) agir("acao_frete", { freight_leg_id: f.id, acao_frete: "cancelar", motivo });
                      }}>Cancelar frete</Button>
                    )}
                  </div>
                  {!f.destino_cidade && <p className="mt-2 text-xs text-amber-700">Pedido sem cidade de destino: o fretista não vê a cidade na fila.</p>}
                </div>

                {ped.subpedidos.map((s) => {
                  const p = s.pickup;
                  if (!p) return <p key={s.pedido_compra_id} className="text-sm text-slate-400">{s.fabricante_nome}: fora do Hub</p>;
                  const antesDaColeta = ["aguardando_pronto", "falsa_coleta", "disponivel", "aceita", "janela_confirmada"].includes(p.status);
                  return (
                    <div key={p.id} className="rounded-xl border p-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <b>{p.numero}</b>
                        <span>{p.fabricante_nome}</span>
                        <span className="text-slate-500">{p.fabricante_cidade}</span>
                        {p.coletor_nome && <span className="text-slate-500">· {p.coletor_nome}</span>}
                        {p.falsas_coletas > 0 && <span className="text-xs text-red-600">{p.falsas_coletas} falsa(s)</span>}
                        <span className="text-xs text-slate-500">{textoPeso(p) || "sem peso"}</span>
                        <span className="ml-auto"><Status status={p.status} /></span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{p.itens_resumo}</p>
                      {p.pronto_confirmacao && <p className="text-xs text-slate-500">Pronto: {p.pronto_confirmacao} ({p.pronto_por_nome})</p>}
                      {p.divergencia && <p className="text-xs font-semibold text-red-700">Divergência: {p.divergencia}</p>}
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <ValorEditavel rotulo="Valor da coleta" valor={p.valor_coleta} bloqueado={!antesDaColeta}
                          onSalvar={(v) => agir("definir_valores", { pickup_id: p.id, valor_coleta: v })} />
                        <ValorEditavel rotulo="Peso (kg)" valor={p.peso_kg} bloqueado={!antesDaColeta} placeholder="kg" passo="0.1"
                          onSalvar={(v) => agir("definir_valores", { pickup_id: p.id, peso_kg: v })} />
                        {!p.fabricante_cidade && antesDaColeta && (
                          <Campo rotulo="Fabricante (cadastro)">
                            <Selecao value="" onChange={(id) => id && agir("definir_valores", { pickup_id: p.id, fabricante_id: id })} className="w-48">
                              <option value="">Vincular…</option>
                              {dados.fabricantes.map((fb) => <option key={fb.id} value={fb.id}>{fb.nome} {fb.cidade ? `(${fb.cidade})` : ""}</option>)}
                            </Selecao>
                          </Campo>
                        )}
                        {["aguardando_pronto", "falsa_coleta"].includes(p.status) && (
                          <Button size="sm" disabled={!(p.valor_coleta > 0)} onClick={() => setPronto(p)}>Marcar pronto</Button>
                        )}
                        {["disponivel", "aceita", "janela_confirmada"].includes(p.status) && (
                          <Atribuir perfis={coletores} rotulo="Atribuir coletor" onEscolher={(id) => agir("acao_pickup", { pickup_id: p.id, acao_pickup: "atribuir", profile_id: id })} />
                        )}
                        <Button size="sm" variant="ghost" asChild><a href={`/hub/etiquetas?ids=${p.id}`} target="_blank" rel="noreferrer"><Printer className="mr-1 h-4 w-4" />Etiqueta</a></Button>
                        {antesDaColeta && (
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => {
                            const motivo = prompt("Motivo do cancelamento da coleta?");
                            if (motivo) agir("acao_pickup", { pickup_id: p.id, acao_pickup: "cancelar", motivo });
                          }}>Cancelar</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Cartao>
        );
      })}

      {incluir && <IncluirDialog pedido={incluir} fabricantes={dados.fabricantes} onFechar={() => setIncluir(null)} onFeito={() => { setIncluir(null); carregar(); }} />}
      {pronto && (
        <ProntoDialog pickup={pronto} onFechar={() => setPronto(null)}
          onConfirmar={async (confirmacao) => { await agir("marcar_pronto", { pickup_id: pronto.id, confirmacao }); setPronto(null); }} />
      )}
    </div>
  );
}

function ValorEditavel({ rotulo, valor, bloqueado, onSalvar, placeholder = "R$", passo = "0.01" }) {
  const [v, setV] = useState(valor ?? "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => setV(valor ?? ""), [valor]);
  const mudou = String(v) !== String(valor ?? "");
  return (
    <Campo rotulo={rotulo}>
      <div className="flex gap-1">
        <Input type="number" min="0" step={passo} value={v} disabled={bloqueado} onChange={(e) => setV(e.target.value)} className="h-9 w-28" placeholder={placeholder} />
        {mudou && !bloqueado && (
          <Button size="icon" className="h-9 w-9" disabled={salvando || !(Number(v) > 0)} onClick={async () => { setSalvando(true); await onSalvar(Number(v)); setSalvando(false); }}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </Campo>
  );
}

function Atribuir({ perfis, rotulo, onEscolher }) {
  return (
    <Campo rotulo={rotulo}>
      <Selecao value="" onChange={(id) => id && confirm("Atribuir este serviço?") && onEscolher(id)} className="w-48">
        <option value="">Escolher…</option>
        {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.verificacao !== "verificado" ? " (não verificado)" : ""}</option>)}
      </Selecao>
    </Campo>
  );
}

function IncluirDialog({ pedido, fabricantes, onFechar, onFeito }) {
  const [subs, setSubs] = useState(() => Object.fromEntries(pedido.subpedidos.map((s) => [s.pedido_compra_id, { fabricante_id: s.fabricante_sugerido || "", valor_coleta: "", volumes: "", peso_kg: "" }])));
  const sug = pedido.destino_sugerido || {};
  const [frete, setFrete] = useState({ valor_frete: "", destino_endereco: sug.endereco || "", destino_cidade: sug.cidade || "", destino_uf: sug.uf || "" });
  const ORIGEM = { pedido_vitrine: "endereço de entrega do pedido da vitrine", cadastro_cliente: "cadastro do cliente" };
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const muda = (id, campo, valor) => setSubs({ ...subs, [id]: { ...subs[id], [campo]: valor } });

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      // So manda o destino que o admin mudou; o resto o servidor le da vitrine/cadastro (e registra a origem certa).
      const mudou = (campo, chave) => (String(frete[campo] || "").trim() !== String(sug[chave] || "").trim() ? frete[campo] : undefined);
      await hub("incluir_pedido", {
        papel: "admin", venda_id: pedido.venda_id, subpedidos: subs, valor_frete: frete.valor_frete,
        destino_endereco: mudou("destino_endereco", "endereco"), destino_cidade: mudou("destino_cidade", "cidade"), destino_uf: mudou("destino_uf", "uf"),
      });
      onFeito();
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Incluir pedido no Hub</DialogTitle>
          <DialogDescription>{pedido.cliente_nome} · {pedido.revendedor_nome}. Cada fabricante vira uma coleta; os valores podem ser definidos agora ou depois.</DialogDescription>
        </DialogHeader>
        {pedido.subpedidos.map((s) => (
          <div key={s.pedido_compra_id} className="space-y-2 rounded-xl border p-3">
            <p className="text-sm font-semibold">{s.fabricante_nome} · {brl(s.total)}</p>
            <p className="text-xs text-slate-500">{s.itens}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Campo rotulo="Fabricante (endereço de coleta)" className="col-span-2">
                <Selecao value={subs[s.pedido_compra_id].fabricante_id} onChange={(v) => muda(s.pedido_compra_id, "fabricante_id", v)}>
                  <option value="">Sem vínculo (sem endereço)</option>
                  {fabricantes.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.cidade ? ` — ${f.cidade}` : ""}</option>)}
                </Selecao>
              </Campo>
              <Campo rotulo="Valor coleta (R$)"><Input type="number" value={subs[s.pedido_compra_id].valor_coleta} onChange={(e) => muda(s.pedido_compra_id, "valor_coleta", e.target.value)} /></Campo>
              <Campo rotulo="Volumes"><Input type="number" value={subs[s.pedido_compra_id].volumes} onChange={(e) => muda(s.pedido_compra_id, "volumes", e.target.value)} /></Campo>
              <Campo rotulo="Peso (kg) — o coletor vê antes de aceitar" className="col-span-2">
                <Input type="number" step="0.1" value={subs[s.pedido_compra_id].peso_kg} onChange={(e) => muda(s.pedido_compra_id, "peso_kg", e.target.value)}
                  placeholder={s.peso_estimado?.peso_kg ? `catálogo: ${s.peso_estimado.peso_kg} kg` : "sem peso no catálogo"} />
              </Campo>
              <p className="col-span-2 self-end text-xs text-slate-500">
                {!s.peso_estimado?.peso_kg
                  ? "Nenhum item tem peso no catálogo: informe o peso, senão o coletor vê \"peso a confirmar\"."
                  : s.peso_estimado.completo
                    ? "Em branco = usa a estimativa do catálogo (≈)."
                    : `Em branco = estimativa parcial (≥): ${s.peso_estimado.sem_peso} item(ns) sem peso no catálogo.`}
              </p>
            </div>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3">
          <p className="col-span-3 text-xs text-slate-600">
            {ORIGEM[sug.origem] ? `Destino lido do ${ORIGEM[sug.origem]}. Corrija se precisar.` : "Pedido sem endereço de destino: preencha à mão."}
          </p>
          <Campo rotulo="Endereço de entrega" className="col-span-3"><Input value={frete.destino_endereco} onChange={(e) => setFrete({ ...frete, destino_endereco: e.target.value })} /></Campo>
          <Campo rotulo="Cidade destino"><Input value={frete.destino_cidade} onChange={(e) => setFrete({ ...frete, destino_cidade: e.target.value })} /></Campo>
          <Campo rotulo="UF"><Input maxLength={2} value={frete.destino_uf} onChange={(e) => setFrete({ ...frete, destino_uf: e.target.value.toUpperCase() })} /></Campo>
          <Campo rotulo="Valor do frete (R$)"><Input type="number" value={frete.valor_frete} onChange={(e) => setFrete({ ...frete, valor_frete: e.target.value })} /></Campo>
        </div>
        <Erro texto={erro} />
        <Button className="h-12" disabled={enviando} onClick={enviar}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Incluir no Hub
        </Button>
      </DialogContent>
    </Dialog>
  );
}
