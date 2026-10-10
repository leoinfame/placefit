import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, MapPin, MessageCircle, Package, Clock, XCircle, Warehouse, RefreshCw } from "lucide-react";
import { hub, brl, dataHora, linkWhats, linkMapa, textoPeso } from "../lib/hubApi";
import { enviarFoto, pegarLocalizacao } from "../lib/captura";
import { Cartao, Vazio, Abas, Erro } from "../components/Cartao";
import Status from "../components/Status";
import FotoCampo from "../components/FotoCampo";
import RegistrarCustodia from "../components/RegistrarCustodia";

export default function Coletor() {
  const [aba, setAba] = useState("fila");
  const [fila, setFila] = useState(null);
  const [minhas, setMinhas] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [custodia, setCustodia] = useState(null);
  const [janela, setJanela] = useState(null);
  const [falsa, setFalsa] = useState(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const [f, m] = await Promise.all([hub("fila_coletor").catch((e) => ({ erro: e.message })), hub("minhas_coletas")]);
      if (f.erro) setErro(f.erro); else setFila(f.coletas);
      setMinhas(m);
    } catch (e) { setErro(e.message); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const agir = async (pickup, acao_pickup, extra = {}) => {
    setOcupado(pickup.id + acao_pickup);
    setErro("");
    try {
      await hub("acao_pickup", { pickup_id: pickup.id, acao_pickup, ...extra });
      if (acao_pickup === "aceitar") setAba("minhas");
      await carregar();
    } catch (e) { setErro(e.message); await carregar(); }
    setOcupado(null);
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Coletas</h1>
        <Button variant="ghost" size="icon" onClick={carregar}><RefreshCw className="h-5 w-5" /></Button>
      </div>
      <Abas abas={[["fila", `Fila${fila ? ` (${fila.length})` : ""}`], ["minhas", `Minhas${minhas ? ` (${minhas.ativas.length})` : ""}`]]} ativa={aba} onTrocar={setAba} />
      <Erro texto={erro} />

      {aba === "fila" && (
        !fila ? <Carregando /> : fila.length === 0 ? <Vazio>Nenhuma coleta pronta na sua região agora.</Vazio> : (
          <div className="space-y-3">
            {fila.map((p) => (
              <Cartao key={p.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">{p.numero}</p>
                    <p className="text-lg font-bold text-slate-900">{p.fabricante_nome}</p>
                    <p className="flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4" />{p.fabricante_cidade || "Cidade não informada"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Você recebe</p>
                    <p className="text-2xl font-extrabold text-emerald-600">{brl(p.valor_coleta)}</p>
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                  <Package className="h-4 w-4" />{[p.volumes && `${p.volumes} vol.`, textoPeso(p) || "peso a confirmar"].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.itens_resumo}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-12" disabled={!!ocupado} onClick={() => agir(p, "recusar")}>Recusar</Button>
                  <Button className="col-span-2 h-12 bg-emerald-600 text-base hover:bg-emerald-700" disabled={!!ocupado} onClick={() => agir(p, "aceitar")}>
                    {ocupado === p.id + "aceitar" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Aceitar coleta"}
                  </Button>
                </div>
              </Cartao>
            ))}
          </div>
        )
      )}

      {aba === "minhas" && (
        !minhas ? <Carregando /> : (
          <div className="space-y-3">
            {minhas.ativas.length === 0 && <Vazio>Você não tem coletas em andamento.</Vazio>}
            {minhas.ativas.map((p) => (
              <Cartao key={p.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">{p.numero} · {brl(p.valor_coleta)}</p>
                    <p className="text-lg font-bold">{p.fabricante_nome}</p>
                  </div>
                  <Status status={p.status} />
                </div>
                {p.fabricante_endereco && (
                  <a href={linkMapa(`${p.fabricante_endereco} ${p.fabricante_cidade || ""}`)} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-sm text-blue-700">
                    <MapPin className="h-4 w-4" />{p.fabricante_endereco}
                  </a>
                )}
                {p.janela_inicio && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><Clock className="h-4 w-4" />Janela: {dataHora(p.janela_inicio)}{p.janela_fim ? ` – ${dataHora(p.janela_fim)}` : ""}</p>
                )}
                <p className="mt-1 text-xs text-slate-500">{p.itens_resumo}</p>
                {p.status !== "coletada" && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Leve a etiqueta impressa pela base e cole no volume antes de escanear.</p>}

                <div className="mt-3 grid gap-2">
                  {p.status === "aceita" && (
                    <Button className="h-12" onClick={() => setJanela(p)}><Clock className="mr-2 h-5 w-5" />Confirmar janela antes de sair</Button>
                  )}
                  {["aceita", "janela_confirmada"].includes(p.status) && (
                    <>
                      <Button className="h-14 bg-emerald-600 text-base hover:bg-emerald-700" onClick={() => setCustodia({ tipo: "coletado_no_fabricante", p })}>
                        <Package className="mr-2 h-5 w-5" />Coletei: escanear e fotografar
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-11 border-red-200 text-red-700" onClick={() => setFalsa(p)}><XCircle className="mr-1 h-4 w-4" />Não estava pronto</Button>
                        <Button variant="ghost" className="h-11" disabled={!!ocupado} onClick={() => confirm("Devolver esta coleta para a fila?") && agir(p, "desistir")}>Desistir</Button>
                      </div>
                    </>
                  )}
                  {p.status === "coletada" && (
                    <Button className="h-14 text-base" onClick={() => setCustodia({ tipo: "entregue_na_base", p })}>
                      <Warehouse className="mr-2 h-5 w-5" />Entreguei na base
                    </Button>
                  )}
                  {linkWhats(p.fabricante_whatsapp) && (
                    <a href={linkWhats(p.fabricante_whatsapp, `Olá! Sou o coletor do Hub PlaceFit, coleta ${p.numero}.`)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-emerald-700">
                      <MessageCircle className="h-4 w-4" />WhatsApp do fabricante
                    </a>
                  )}
                </div>
              </Cartao>
            ))}
            {minhas.historico.length > 0 && (
              <div className="pt-3">
                <p className="mb-2 text-sm font-semibold text-slate-500">Histórico</p>
                {minhas.historico.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border-b border-slate-200 py-2 text-sm">
                    <span>{p.numero} · {p.fabricante_nome}</span><Status status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {custodia && (
        <RegistrarCustodia
          aberto
          tipo={custodia.tipo}
          papel="coletor"
          pickupId={custodia.p.id}
          referencia={custodia.p.numero}
          onFechar={() => setCustodia(null)}
          onFeito={carregar}
        />
      )}
      {janela && <JanelaDialog pickup={janela} onFechar={() => setJanela(null)} onSalvar={(dados) => agir(janela, "confirmar_janela", dados).then(() => setJanela(null))} />}
      {falsa && <FalsaColetaDialog pickup={falsa} onFechar={() => setFalsa(null)} onFeito={() => { setFalsa(null); carregar(); }} />}
    </div>
  );
}

function Carregando() {
  return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
}

function paraLocal(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}

function JanelaDialog({ pickup, onFechar, onSalvar }) {
  const daqui = new Date(Date.now() + 60 * 60000);
  const [inicio, setInicio] = useState(paraLocal(daqui));
  const [fim, setFim] = useState(paraLocal(new Date(daqui.getTime() + 2 * 60 * 60000)));
  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar janela</DialogTitle>
          <DialogDescription>Combine com {pickup.fabricante_nome} antes de sair. O horário fica registrado na coleta.</DialogDescription>
        </DialogHeader>
        <label className="text-sm font-medium">Chego a partir de</label>
        <Input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-12" />
        <label className="text-sm font-medium">Até</label>
        <Input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className="h-12" />
        <Button className="h-12" disabled={!inicio} onClick={() => onSalvar({ janela_inicio: new Date(inicio).toISOString(), janela_fim: fim ? new Date(fim).toISOString() : undefined })}>
          Confirmar janela
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function FalsaColetaDialog({ pickup, onFechar, onFeito }) {
  const [foto, setFoto] = useState(null);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const [geo, foto_url] = await Promise.all([pegarLocalizacao(), enviarFoto(foto)]);
      await hub("falsa_coleta", { pickup_id: pickup.id, foto_url, observacao: obs, ...geo, hora_dispositivo: new Date().toISOString() });
      onFeito();
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Falsa coleta</DialogTitle>
          <DialogDescription>Você chegou em {pickup.fabricante_nome} e o pedido não estava pronto. Fotografe o local; a taxa é lançada no financeiro.</DialogDescription>
        </DialogHeader>
        <FotoCampo arquivo={foto} onArquivo={setFoto} rotulo="Foto no fabricante" />
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="O que aconteceu? (ex.: falou com Fulano, faltava pintura)" />
        <Erro texto={erro} />
        <Button className="h-12 bg-red-600 hover:bg-red-700" disabled={!foto || !obs.trim() || enviando} onClick={enviar}>
          {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrar falsa coleta
        </Button>
      </DialogContent>
    </Dialog>
  );
}
