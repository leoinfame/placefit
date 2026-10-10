import React, { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, CheckCircle2, Paperclip } from "lucide-react";
import { brl, dataHora } from "../lib/hubApi";
import { useHub } from "../components/HubContexto";
import { Cartao, Vazio, Erro } from "../components/Cartao";
import { Campo, Selecao } from "../components/Campos";

const ROTULO_TIPO = {
  pagamento_coleta: "Coleta",
  pagamento_frete: "Frete",
  taxa_falsa_coleta: "Falsa coleta",
  ajuste: "Ajuste",
};

// Financeiro manual: a PlaceFit intermedia — recebe do devedor (quando aplica) e repassa ao favorecido.
export default function AdminFinanceiro() {
  const ctx = useHub();
  const [lancs, setLancs] = useState(null);
  const [filtro, setFiltro] = useState("abertos");
  const [erro, setErro] = useState("");
  const [baixa, setBaixa] = useState(null);
  const [novo, setNovo] = useState(false);

  const carregar = useCallback(() => base44.entities.HubLancamento.list("-created_date", 500).then(setLancs).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const lista = useMemo(() => (lancs || []).filter((l) => {
    if (filtro === "abertos") return l.status_pagamento === "pendente" || l.status_recebimento === "pendente";
    if (filtro === "todos") return true;
    return l.tipo === filtro;
  }), [lancs, filtro]);

  const aPagar = useMemo(() => {
    const m = {};
    for (const l of lancs || []) if (l.status_pagamento === "pendente") {
      const k = l.favorecido_nome || "—";
      m[k] = (m[k] || 0) + (l.valor || 0);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [lancs]);
  const aReceber = useMemo(() => {
    const m = {};
    for (const l of lancs || []) if (l.status_recebimento === "pendente") {
      const k = l.devedor_nome || "—";
      m[k] = (m[k] || 0) + (l.valor || 0);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [lancs]);

  const atualizar = async (id, dados) => {
    setErro("");
    try { await base44.entities.HubLancamento.update(id, { ...dados, registrado_por: ctx.usuario.nome }); await carregar(); } catch (e) { setErro(e.message); }
  };

  if (!lancs) return <div className="flex justify-center py-10">{erro ? <Erro texto={erro} /> : <Loader2 className="h-6 w-6 animate-spin" />}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-xl font-bold">Financeiro do Hub</h1>
        <Button onClick={() => setNovo(true)}><Plus className="mr-1 h-4 w-4" />Lançamento manual</Button>
      </div>
      <Erro texto={erro} />

      <div className="grid gap-3 md:grid-cols-2">
        <Resumo titulo="A pagar (PlaceFit → coletores/fretistas)" linhas={aPagar} cor="text-red-700" />
        <Resumo titulo="A receber (fabricantes → PlaceFit)" linhas={aReceber} cor="text-emerald-700" />
      </div>

      <Selecao value={filtro} onChange={setFiltro} className="w-56">
        <option value="abertos">Em aberto</option>
        <option value="todos">Todos</option>
        {Object.entries(ROTULO_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </Selecao>

      {lista.length === 0 ? <Vazio>Nenhum lançamento.</Vazio> : (
        <div className="space-y-2">
          {lista.map((l) => (
            <Cartao key={l.id} className="text-sm">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400">{ROTULO_TIPO[l.tipo]} · {dataHora(l.created_date)} · {l.referencia}</p>
                  <p className="font-semibold">{l.descricao}</p>
                  <p className="text-slate-600">{l.devedor_nome || "—"} → {l.favorecido_nome || "—"}</p>
                </div>
                <p className="text-lg font-extrabold">{brl(l.valor)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {l.status_recebimento !== "nao_aplica" && (
                  l.status_recebimento === "pendente"
                    ? <Button size="sm" variant="outline" onClick={() => setBaixa({ l, modo: "recebimento" })}>Registrar recebimento de {l.devedor_nome}</Button>
                    : <span className="text-xs text-emerald-700">Recebido {dataHora(l.recebido_em)}</span>
                )}
                {l.status_pagamento === "pendente"
                  ? <Button size="sm" onClick={() => setBaixa({ l, modo: "pagamento" })}>Registrar pagamento a {l.favorecido_nome}</Button>
                  : <span className={`text-xs ${l.status_pagamento === "pago" ? "text-emerald-700" : "text-slate-400"}`}>
                      {l.status_pagamento === "pago" ? `Pago ${dataHora(l.pago_em)}${l.forma_pagamento ? ` · ${l.forma_pagamento}` : ""}` : "Cancelado"}
                    </span>}
                {l.comprovante_url && <a href={l.comprovante_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700"><Paperclip className="h-3 w-3" />comprovante</a>}
                {l.status_pagamento === "pendente" && (
                  <Button size="sm" variant="ghost" className="ml-auto text-red-600" onClick={() => confirm("Cancelar este lançamento?") && atualizar(l.id, {
                    status_pagamento: "cancelado",
                    ...(l.status_recebimento === "pendente" ? { status_recebimento: "cancelado" } : {}),
                  })}>Cancelar</Button>
                )}
              </div>
            </Cartao>
          ))}
        </div>
      )}

      {baixa && <BaixaDialog {...baixa} onFechar={() => setBaixa(null)} onSalvar={async (dados) => { await atualizar(baixa.l.id, dados); setBaixa(null); }} />}
      {novo && <NovoDialog onFechar={() => setNovo(false)} onFeito={() => { setNovo(false); carregar(); }} autor={ctx.usuario.nome} />}
    </div>
  );
}

function Resumo({ titulo, linhas, cor }) {
  const total = linhas.reduce((s, [, v]) => s + v, 0);
  return (
    <Cartao>
      <p className="text-sm font-semibold text-slate-500">{titulo}</p>
      <p className={`text-2xl font-extrabold ${cor}`}>{brl(total)}</p>
      <div className="mt-2 space-y-1 text-sm">
        {linhas.map(([nome, v]) => <div key={nome} className="flex justify-between"><span>{nome}</span><b>{brl(v)}</b></div>)}
      </div>
    </Cartao>
  );
}

function BaixaDialog({ l, modo, onFechar, onSalvar }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [forma, setForma] = useState("PIX");
  const [arquivo, setArquivo] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setSalvando(true);
    let comprovante_url;
    if (arquivo) comprovante_url = (await base44.integrations.Core.UploadFile({ file: arquivo })).file_url;
    const quando = new Date(`${data}T12:00:00`).toISOString();
    await onSalvar(modo === "pagamento"
      ? { status_pagamento: "pago", pago_em: quando, forma_pagamento: forma, ...(comprovante_url ? { comprovante_url } : {}) }
      : { status_recebimento: "recebido", recebido_em: quando });
    setSalvando(false);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modo === "pagamento" ? `Pagamento a ${l.favorecido_nome}` : `Recebimento de ${l.devedor_nome}`}</DialogTitle>
          <DialogDescription>{l.descricao} · {brl(l.valor)}</DialogDescription>
        </DialogHeader>
        <Campo rotulo="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        {modo === "pagamento" && (
          <>
            <Campo rotulo="Forma">
              <Selecao value={forma} onChange={setForma}>
                {["PIX", "Transferência", "Dinheiro", "Boleto", "Outro"].map((f) => <option key={f}>{f}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="Comprovante (opcional)"><Input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] || null)} /></Campo>
          </>
        )}
        <Button className="h-11" disabled={salvando} onClick={salvar}>
          {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Confirmar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function NovoDialog({ onFechar, onFeito, autor }) {
  const [f, setF] = useState({ descricao: "", valor: "", devedor_tipo: "placefit", devedor_nome: "PlaceFit", favorecido_tipo: "coletor", favorecido_nome: "", referencia: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const salvar = async () => {
    setSalvando(true);
    try {
      await base44.entities.HubLancamento.create({
        tipo: "ajuste", ...f, valor: Number(f.valor),
        status_recebimento: f.devedor_tipo === "placefit" ? "nao_aplica" : "pendente",
        status_pagamento: f.favorecido_tipo === "placefit" ? "pago" : "pendente",
        registrado_por: autor,
      });
      onFeito();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  const tipos = ["placefit", "fabricante", "revenda", "coletor", "fretista"];
  return (
    <Dialog open onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Lançamento manual</DialogTitle><DialogDescription>Ajustes, bônus, reembolsos.</DialogDescription></DialogHeader>
        <Campo rotulo="Descrição"><Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Campo>
        <Campo rotulo="Valor (R$)"><Input type="number" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Devedor"><Selecao value={f.devedor_tipo} onChange={(v) => setF({ ...f, devedor_tipo: v, devedor_nome: v === "placefit" ? "PlaceFit" : "" })}>{tipos.map((t) => <option key={t}>{t}</option>)}</Selecao></Campo>
          <Campo rotulo="Nome do devedor"><Input value={f.devedor_nome} onChange={(e) => setF({ ...f, devedor_nome: e.target.value })} /></Campo>
          <Campo rotulo="Favorecido"><Selecao value={f.favorecido_tipo} onChange={(v) => setF({ ...f, favorecido_tipo: v, favorecido_nome: v === "placefit" ? "PlaceFit" : "" })}>{tipos.map((t) => <option key={t}>{t}</option>)}</Selecao></Campo>
          <Campo rotulo="Nome do favorecido"><Input value={f.favorecido_nome} onChange={(e) => setF({ ...f, favorecido_nome: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Referência (COL-/FRT-)"><Input value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value.toUpperCase() })} /></Campo>
        <Erro texto={erro} />
        <Button className="h-11" disabled={salvando || !f.descricao || !(Number(f.valor) > 0)} onClick={salvar}>Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}
