import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Loader2, Edit3, Trash2, ExternalLink, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, CheckCircle, Undo2, Wallet } from "lucide-react";
import { MOEDAS, DIAS_ALERTA, fmtValor, fmtData, fmtCompetencia, competenciaDe, hojeISO, situacaoDoMes, alertasCustos } from "@/lib/custos";

// Custos do sistema — SÓ ADMIN (entidades CustoSistema/CustoPagamento têm RLS admin nas 4 operações).
// Gestão manual: cadastro dos custos recorrentes, visão do mês, baixa com valor real e histórico.

const SITUACAO = {
  pago: { label: "Pago", cls: "bg-green-100 text-green-800" },
  vencido: { label: "Vencido", cls: "bg-red-100 text-red-800" },
  proximo: { label: "Vence em breve", cls: "bg-amber-100 text-amber-800" },
  a_vencer: { label: "A vencer", cls: "bg-gray-100 text-gray-700" },
  antes_cadastro: { label: "Antes do cadastro", cls: "bg-gray-100 text-gray-500" },
};
const CUSTO_VAZIO = { nome: "", categoria: "", valor_mensal: "", moeda: "BRL", valor_variavel: false, dia_vencimento: "", forma_pagamento: "", status: "ativo", link_painel: "", observacoes: "" };
const linkSeguro = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : null);
const fmtDataISO = (iso) => { const [a, m, d] = String(iso || "").split("-"); return d ? `${d}/${m}/${a}` : iso; };
const quando = (dias) => (dias === 0 ? "hoje" : dias === 1 ? "amanhã" : dias > 0 ? `em ${dias} dias` : dias === -1 ? "ontem" : `há ${-dias} dias`);

export default function CustosSistema() {
  const { toast } = useToast();
  const [autorizado, setAutorizado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [custos, setCustos] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [competencia, setCompetencia] = useState(competenciaDe(new Date()));
  const [tab, setTab] = useState("mes");
  const [filtroHist, setFiltroHist] = useState("todos");

  const [custoForm, setCustoForm] = useState(null); // {..., id?}
  const [pagForm, setPagForm] = useState(null); // {custo, competencia, valor_pago, data_pagamento, observacoes}
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { (async () => {
    try {
      const me = await base44.auth.me();
      if (me?.role !== "admin") { window.location.href = "/Dashboard"; return; }
      setAutorizado(true);
      await carregar();
    } catch (e) {
      console.error(e);
      window.location.href = "/Dashboard";
    }
  })(); }, []);

  const carregar = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        base44.entities.CustoSistema.list("nome", 500),
        base44.entities.CustoPagamento.list("-data_pagamento", 2000),
      ]);
      setCustos(c || []);
      setPagamentos(p || []);
    } catch (e) {
      toast({ title: "Erro ao carregar custos", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const mes = useMemo(() => situacaoDoMes(custos, pagamentos, competencia), [custos, pagamentos, competencia]);
  const alertas = useMemo(() => alertasCustos(custos, pagamentos), [custos, pagamentos]);
  const custoPorId = useMemo(() => Object.fromEntries(custos.map((c) => [c.id, c])), [custos]);

  const mudarMes = (k) => {
    const [a, m] = competencia.split("-").map(Number);
    setCompetencia(competenciaDe(new Date(a, m - 1 + k, 1)));
  };

  // ── Cadastro ──
  const salvarCusto = async () => {
    const f = custoForm;
    const valor = Number(String(f.valor_mensal).replace(",", "."));
    const dia = Number(f.dia_vencimento);
    if (!f.nome.trim()) return toast({ title: "Informe o nome", variant: "destructive" });
    if (!(valor >= 0)) return toast({ title: "Valor mensal inválido", variant: "destructive" });
    if (!(dia >= 1 && dia <= 31)) return toast({ title: "Dia de vencimento entre 1 e 31", variant: "destructive" });
    if (f.link_painel && !linkSeguro(f.link_painel)) return toast({ title: "O link precisa começar com https://", variant: "destructive" });
    const dados = {
      nome: f.nome.trim(), categoria: f.categoria.trim(), valor_mensal: valor, moeda: f.moeda, valor_variavel: !!f.valor_variavel,
      dia_vencimento: Math.round(dia), forma_pagamento: f.forma_pagamento.trim(), status: f.status, link_painel: f.link_painel.trim(), observacoes: f.observacoes.trim(),
    };
    setSalvando(true);
    try {
      if (f.id) await base44.entities.CustoSistema.update(f.id, dados);
      else await base44.entities.CustoSistema.create(dados);
      toast({ title: f.id ? "Custo atualizado" : "Custo cadastrado" });
      setCustoForm(null);
      await carregar();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSalvando(false);
  };

  const excluirCusto = async (c) => {
    if (pagamentos.some((p) => p.custo_id === c.id)) {
      return toast({ title: "Este custo tem pagamentos no histórico", description: "Para não perder o histórico, use Pausar em vez de excluir.", variant: "destructive" });
    }
    if (!window.confirm(`Excluir "${c.nome}"?`)) return;
    try {
      await base44.entities.CustoSistema.delete(c.id);
      await carregar();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const alternarStatus = async (c) => {
    try {
      await base44.entities.CustoSistema.update(c.id, { status: c.status === "pausado" ? "ativo" : "pausado" });
      await carregar();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  // ── Baixa ──
  const abrirBaixa = (custo, comp) => setPagForm({ custo, competencia: comp, valor_pago: String(custo.valor_mensal ?? ""), data_pagamento: hojeISO(), observacoes: "" });

  const salvarBaixa = async () => {
    const f = pagForm;
    const valor = Number(String(f.valor_pago).replace(",", "."));
    if (!(valor >= 0)) return toast({ title: "Valor pago inválido", variant: "destructive" });
    if (!/^\d{4}-\d{2}$/.test(f.competencia)) return toast({ title: "Mês de referência inválido", variant: "destructive" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data_pagamento)) return toast({ title: "Data de pagamento inválida", variant: "destructive" });
    if (pagamentos.some((p) => p.custo_id === f.custo.id && p.competencia === f.competencia)) {
      if (!window.confirm(`${f.custo.nome} já tem baixa em ${fmtCompetencia(f.competencia)}. Registrar outro pagamento no mesmo mês?`)) return;
    }
    setSalvando(true);
    try {
      await base44.entities.CustoPagamento.create({
        custo_id: f.custo.id, competencia: f.competencia, valor_pago: valor, moeda: f.custo.moeda || "BRL",
        data_pagamento: f.data_pagamento, observacoes: f.observacoes.trim(),
      });
      toast({ title: "Pagamento registrado" });
      setPagForm(null);
      await carregar();
    } catch (e) {
      toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" });
    }
    setSalvando(false);
  };

  const desfazerBaixa = async (p) => {
    const c = custoPorId[p.custo_id];
    if (!window.confirm(`Desfazer o pagamento de ${c?.nome || "custo"} (${fmtCompetencia(p.competencia)}, ${fmtValor(p.valor_pago, p.moeda)})?`)) return;
    try {
      await base44.entities.CustoPagamento.delete(p.id);
      await carregar();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  if (!autorizado || loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const historico = pagamentos.filter((p) => filtroHist === "todos" || p.custo_id === filtroHist);
  const proximos7 = mes.linhas.filter((l) => l.situacao === "proximo").length;
  const moedasTotais = Object.keys(mes.totais);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> Custos do sistema</h1>
          <p className="text-sm text-gray-500">Assinaturas e custos recorrentes da operação. Visível só para administradores.</p>
        </div>
        <Button onClick={() => setCustoForm({ ...CUSTO_VAZIO })}><Plus className="w-4 h-4 mr-1" /> Novo custo</Button>
      </div>

      {/* Alertas a partir de hoje */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-lg p-3 text-sm ${a.tipo === "vencido" ? "bg-red-50 text-red-800 border border-red-200" : "bg-amber-50 text-amber-900 border border-amber-200"}`}>
              {a.tipo === "vencido" ? <AlertCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span className="flex-1">
                <strong>{a.custo.nome}</strong> — {fmtValor(a.custo.valor_mensal, a.custo.moeda)}{a.custo.valor_variavel ? " (estimado)" : ""} •{" "}
                {a.tipo === "vencido" ? `venceu ${fmtData(a.vencimento)} (${quando(a.dias)}) sem baixa` : `vence ${fmtData(a.vencimento)} (${quando(a.dias)})`}
                {a.custo.forma_pagamento ? ` • ${a.custo.forma_pagamento}` : ""}
              </span>
              <Button size="sm" variant="outline" onClick={() => abrirBaixa(a.custo, a.competencia)}>Dar baixa</Button>
            </div>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mes">Visão do mês</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro ({custos.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({pagamentos.length})</TabsTrigger>
        </TabsList>

        {/* ── Visão do mês ── */}
        <TabsContent value="mes" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => mudarMes(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="font-semibold w-28 text-center">{fmtCompetencia(competencia)}</span>
            <Button size="icon" variant="outline" onClick={() => mudarMes(1)}><ChevronRight className="w-4 h-4" /></Button>
            {competencia !== competenciaDe(new Date()) && (
              <Button size="sm" variant="ghost" onClick={() => setCompetencia(competenciaDe(new Date()))}>Mês atual</Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(moedasTotais.length ? moedasTotais : ["BRL"]).map((m) => {
              const t = mes.totais[m] || { previsto: 0, pago: 0, aberto: 0 };
              return (
                <Card key={m}>
                  <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Total {MOEDAS[m] || m}</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Previsto: <strong>{fmtValor(t.previsto, m)}</strong></p>
                    <p className="text-green-700">Pago: <strong>{fmtValor(t.pago, m)}</strong></p>
                    <p className="text-gray-600">Em aberto: <strong>{fmtValor(t.aberto, m)}</strong></p>
                  </CardContent>
                </Card>
              );
            })}
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Próximos {DIAS_ALERTA} dias</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${proximos7 ? "text-amber-700" : ""}`}>{proximos7}</p>
                <p className="text-xs text-gray-500">a vencer neste mês sem baixa</p>
              </CardContent>
            </Card>
          </div>
          {moedasTotais.length > 1 && <p className="text-xs text-gray-500">Moedas diferentes são somadas separadamente (sem conversão).</p>}

          <div className="border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="text-left p-3">Custo</th>
                  <th className="text-left p-3">Vencimento</th>
                  <th className="text-right p-3">Previsto</th>
                  <th className="text-left p-3">Situação</th>
                  <th className="text-right p-3">Pago</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {mes.linhas.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhum custo ativo. Clique em "Novo custo".</td></tr>
                )}
                {mes.linhas.map((l) => {
                  const st = SITUACAO[l.situacao];
                  const link = linkSeguro(l.custo.link_painel);
                  return (
                    <tr key={l.custo.id} className="border-t">
                      <td className="p-3">
                        <div className="font-medium flex items-center gap-1">
                          {l.custo.nome}
                          {link && <a href={link} target="_blank" rel="noreferrer" className="text-blue-600" title="Abrir painel do serviço"><ExternalLink className="w-3.5 h-3.5" /></a>}
                        </div>
                        <div className="text-xs text-gray-500">{[l.custo.categoria, l.custo.forma_pagamento].filter(Boolean).join(" • ")}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">{fmtData(l.vencimento)}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {fmtValor(l.custo.valor_mensal, l.custo.moeda)}
                        {l.custo.valor_variavel && <div className="text-xs text-gray-500">por uso (estimado)</div>}
                      </td>
                      <td className="p-3"><Badge className={st.cls}>{st.label}</Badge>{(l.situacao === "vencido" || l.situacao === "proximo") && <div className="text-xs text-gray-500 mt-0.5">{quando(l.dias)}</div>}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {l.pagamentos.map((p) => (
                          <div key={p.id} className="flex items-center justify-end gap-1">
                            <span>{fmtValor(p.valor_pago, p.moeda)}</span>
                            <span className="text-xs text-gray-500">em {fmtDataISO(p.data_pagamento)}</span>
                            <button className="text-gray-400 hover:text-red-600" title="Desfazer baixa" onClick={() => desfazerBaixa(p)}><Undo2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </td>
                      <td className="p-3 text-right">
                        {l.situacao !== "pago" && <Button size="sm" onClick={() => abrirBaixa(l.custo, competencia)}><CheckCircle className="w-4 h-4 mr-1" /> Dar baixa</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Cadastro ── */}
        <TabsContent value="cadastro">
          <div className="border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="text-left p-3">Custo</th>
                  <th className="text-right p-3">Valor mensal</th>
                  <th className="text-left p-3">Vence dia</th>
                  <th className="text-left p-3">Pagamento</th>
                  <th className="text-left p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {custos.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhum custo cadastrado.</td></tr>}
                {custos.map((c) => {
                  const link = linkSeguro(c.link_painel);
                  return (
                    <tr key={c.id} className={`border-t ${c.status === "pausado" ? "opacity-60" : ""}`}>
                      <td className="p-3">
                        <div className="font-medium flex items-center gap-1">{c.nome}{link && <a href={link} target="_blank" rel="noreferrer" className="text-blue-600"><ExternalLink className="w-3.5 h-3.5" /></a>}</div>
                        {c.categoria && <div className="text-xs text-gray-500">{c.categoria}</div>}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">{fmtValor(c.valor_mensal, c.moeda)}{c.valor_variavel && <div className="text-xs text-gray-500">por uso</div>}</td>
                      <td className="p-3">{c.dia_vencimento}</td>
                      <td className="p-3">{c.forma_pagamento || "—"}</td>
                      <td className="p-3">
                        <button onClick={() => alternarStatus(c)} title="Alternar ativo/pausado">
                          <Badge className={c.status === "pausado" ? "bg-gray-200 text-gray-700" : "bg-green-100 text-green-800"}>{c.status === "pausado" ? "Pausado" : "Ativo"}</Badge>
                        </button>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => setCustoForm({ ...CUSTO_VAZIO, ...c, valor_mensal: String(c.valor_mensal ?? ""), dia_vencimento: String(c.dia_vencimento ?? ""), categoria: c.categoria || "", forma_pagamento: c.forma_pagamento || "", link_painel: c.link_painel || "", observacoes: c.observacoes || "" })}><Edit3 className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => excluirCusto(c)}><Trash2 className="w-4 h-4 text-red-600" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Histórico ── */}
        <TabsContent value="historico" className="space-y-3">
          <div className="w-64">
            <Select value={filtroHist} onValueChange={setFiltroHist}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os custos</SelectItem>
                {custos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="text-left p-3">Mês</th>
                  <th className="text-left p-3">Custo</th>
                  <th className="text-right p-3">Previsto</th>
                  <th className="text-right p-3">Pago</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Obs.</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhum pagamento registrado.</td></tr>}
                {historico.map((p) => {
                  const c = custoPorId[p.custo_id];
                  const dif = c && c.moeda === p.moeda ? Number(p.valor_pago) - Number(c.valor_mensal) : 0;
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="p-3 whitespace-nowrap">{fmtCompetencia(p.competencia)}</td>
                      <td className="p-3">{c?.nome || "(custo excluído)"}</td>
                      <td className="p-3 text-right whitespace-nowrap text-gray-500">{c ? fmtValor(c.valor_mensal, c.moeda) : "—"}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {fmtValor(p.valor_pago, p.moeda)}
                        {Math.abs(dif) >= 0.01 && <div className={`text-xs ${dif > 0 ? "text-red-600" : "text-green-700"}`}>{dif > 0 ? "+" : "−"}{fmtValor(Math.abs(dif), p.moeda)}</div>}
                      </td>
                      <td className="p-3 whitespace-nowrap">{fmtDataISO(p.data_pagamento)}</td>
                      <td className="p-3 text-xs text-gray-600">{p.observacoes}</td>
                      <td className="p-3 text-right"><Button size="icon" variant="ghost" title="Desfazer baixa" onClick={() => desfazerBaixa(p)}><Undo2 className="w-4 h-4" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogo: custo */}
      {custoForm && (
        <Dialog open onOpenChange={(v) => !v && setCustoForm(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{custoForm.id ? "Editar custo" : "Novo custo"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={custoForm.nome} onChange={(e) => setCustoForm({ ...custoForm, nome: e.target.value })} placeholder="Railway, OpenAI API, Base44, domínio..." /></div>
              <div><Label>Categoria (opcional)</Label><Input value={custoForm.categoria} onChange={(e) => setCustoForm({ ...custoForm, categoria: e.target.value })} placeholder="Infra, IA, Domínio..." /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><Label>Valor mensal</Label><Input inputMode="decimal" value={custoForm.valor_mensal} onChange={(e) => setCustoForm({ ...custoForm, valor_mensal: e.target.value })} placeholder="0,00" /></div>
                <div>
                  <Label>Moeda</Label>
                  <Select value={custoForm.moeda} onValueChange={(v) => setCustoForm({ ...custoForm, moeda: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(MOEDAS).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!custoForm.valor_variavel} onCheckedChange={(v) => setCustoForm({ ...custoForm, valor_variavel: v })} />
                <span className="text-sm">Cobrança por uso (o valor acima é estimativa)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={custoForm.dia_vencimento} onChange={(e) => setCustoForm({ ...custoForm, dia_vencimento: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={custoForm.status} onValueChange={(v) => setCustoForm({ ...custoForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="pausado">Pausado</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Forma de pagamento</Label><Input value={custoForm.forma_pagamento} onChange={(e) => setCustoForm({ ...custoForm, forma_pagamento: e.target.value })} placeholder="Cartão final 1234, boleto, Pix..." /></div>
              <div><Label>Link do painel do serviço</Label><Input value={custoForm.link_painel} onChange={(e) => setCustoForm({ ...custoForm, link_painel: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Observações</Label><Textarea rows={2} value={custoForm.observacoes} onChange={(e) => setCustoForm({ ...custoForm, observacoes: e.target.value })} /></div>
              <p className="text-xs text-gray-500">Não guarde senhas, número de cartão ou chaves aqui — só o necessário para identificar a cobrança.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCustoForm(null)}>Cancelar</Button>
                <Button onClick={salvarCusto} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Diálogo: baixa */}
      {pagForm && (
        <Dialog open onOpenChange={(v) => !v && setPagForm(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Dar baixa — {pagForm.custo.nome}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Mês de referência</Label><Input type="month" value={pagForm.competencia} onChange={(e) => setPagForm({ ...pagForm, competencia: e.target.value })} /></div>
              <div>
                <Label>Valor pago ({MOEDAS[pagForm.custo.moeda] || pagForm.custo.moeda})</Label>
                <Input inputMode="decimal" value={pagForm.valor_pago} onChange={(e) => setPagForm({ ...pagForm, valor_pago: e.target.value })} />
                <p className="text-xs text-gray-500 mt-1">Previsto: {fmtValor(pagForm.custo.valor_mensal, pagForm.custo.moeda)}{pagForm.custo.valor_variavel ? " (estimado — informe o valor real da fatura)" : ""}</p>
              </div>
              <div><Label>Data do pagamento</Label><Input type="date" value={pagForm.data_pagamento} onChange={(e) => setPagForm({ ...pagForm, data_pagamento: e.target.value })} /></div>
              <div><Label>Observações</Label><Input value={pagForm.observacoes} onChange={(e) => setPagForm({ ...pagForm, observacoes: e.target.value })} placeholder="Nº da fatura, cotação do dólar..." /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPagForm(null)}>Cancelar</Button>
                <Button onClick={salvarBaixa} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Registrar pagamento</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
