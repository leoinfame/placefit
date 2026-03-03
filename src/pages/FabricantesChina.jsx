import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, Star, Package, Truck, Globe, ExternalLink, Edit, Trash2, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import ProdutosChinaForm from "@/components/china/ProdutosChinaForm";

const HUBS = ["Shandong", "Ningbo", "Shenzhen", "Guangzhou"];
const STATUS_COLORS = {
  em_producao: "bg-yellow-100 text-yellow-800",
  pronto_embarque: "bg-blue-100 text-blue-800",
  em_transito: "bg-purple-100 text-purple-800",
  chegou_brasil: "bg-orange-100 text-orange-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};
const STATUS_LABELS = {
  em_producao: "Em Produção",
  pronto_embarque: "Pronto p/ Embarque",
  em_transito: "Em Trânsito",
  chegou_brasil: "Chegou ao Brasil",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const EMPTY_FORM = {
  nome_fabrica: "", id_integracao: "", hub: "Shandong", moeda: "RMB",
  lead_time_min: "", lead_time_max: "", rating_exportacao: 3,
  ncm: "9506.91.00", notas_verificacao: "", taxa_consolidacao: 8,
  contato_nome: "", contato_wechat: "", contato_email: "", ativo: true
};

export default function FabricantesChina() {
  const [fabricantes, setFabricantes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [taxaCambio, setTaxaCambio] = useState({ RMB: null, USD: null });
  const [loadingCambio, setLoadingCambio] = useState(false);

  useEffect(() => {
    loadData();
    fetchCambio();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [f, p] = await Promise.all([
      base44.entities.FabricanteChina.list("-created_date"),
      base44.entities.PedidoChina.list("-created_date"),
    ]);
    setFabricantes(f);
    setPedidos(p);
    setLoading(false);
  };

  const fetchCambio = async () => {
    setLoadingCambio(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: "Qual é a cotação atual do Yuan Chinês (RMB/CNY) para BRL e do Dólar Americano (USD) para BRL? Retorne apenas os valores numéricos.",
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            RMB_to_BRL: { type: "number" },
            USD_to_BRL: { type: "number" }
          }
        }
      });
      setTaxaCambio({ RMB: res.RMB_to_BRL, USD: res.USD_to_BRL });
    } catch {
      setTaxaCambio({ RMB: 0.77, USD: 5.8 });
    }
    setLoadingCambio(false);
  };

  const handleSave = async () => {
    const data = { ...form };
    if (editItem) {
      await base44.entities.FabricanteChina.update(editItem.id, data);
    } else {
      await base44.entities.FabricanteChina.create(data);
    }
    setShowForm(false);
    setEditItem(null);
    setForm(EMPTY_FORM);
    loadData();
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setForm({ ...EMPTY_FORM, ...item });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Remover este fabricante?")) return;
    await base44.entities.FabricanteChina.delete(id);
    loadData();
  };

  const filtered = fabricantes.filter(f =>
    f.nome_fabrica?.toLowerCase().includes(search.toLowerCase()) ||
    f.hub?.toLowerCase().includes(search.toLowerCase())
  );

  const pedidosAtivos = pedidos.filter(p => !["entregue", "cancelado"].includes(p.status));
  const cbmTotal = pedidosAtivos.reduce((sum, p) => sum + (p.cbm_total || 0), 0);

  const getPedidosFabricante = (id) => pedidos.filter(p => p.fabricante_china_id === id && !["entregue","cancelado"].includes(p.status));

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🇨🇳 Fabricantes China</h1>
            <p className="text-gray-500 mt-1">Gestão de fábricas chinesas · NCM 9506.91.00</p>
          </div>
          <Button onClick={() => { setEditItem(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Nova Fábrica
          </Button>
        </div>

        {/* Câmbio */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1.5 border-red-200 text-red-700 bg-red-50">
              💱 RMB → BRL: {taxaCambio.RMB ? `R$ ${taxaCambio.RMB.toFixed(2)}` : "—"}
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1.5 border-green-200 text-green-700 bg-green-50">
              💵 USD → BRL: {taxaCambio.USD ? `R$ ${taxaCambio.USD.toFixed(2)}` : "—"}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchCambio} disabled={loadingCambio}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingCambio ? "animate-spin" : ""}`} />
            Atualizar câmbio
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{fabricantes.length}</div>
              <p className="text-xs text-gray-500 mt-1">Fábricas Cadastradas</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-700">{pedidosAtivos.length}</div>
              <p className="text-xs text-gray-500 mt-1">Pedidos em Trânsito</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-700">{cbmTotal.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">CBM Total Ativo (m³)</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-700">
                {fabricantes.filter(f => f.ativo).length}
              </div>
              <p className="text-xs text-gray-500 mt-1">Fábricas Ativas</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="fabricantes">
          <TabsList>
            <TabsTrigger value="fabricantes">Fabricantes</TabsTrigger>
            <TabsTrigger value="transito">Pedidos em Trânsito</TabsTrigger>
          </TabsList>

          <TabsContent value="fabricantes" className="mt-4">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Buscar por fábrica ou hub..." className="pl-9"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4">
                {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Globe className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Nenhuma fábrica cadastrada</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filtered.map(fab => {
                  const pedidosFab = getPedidosFabricante(fab.id);
                  return (
                    <Card key={fab.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="font-bold text-gray-900 text-lg">{fab.nome_fabrica}</h3>
                              <Badge className="bg-blue-100 text-blue-800 border-0">{fab.hub}</Badge>
                              <Badge className={fab.ativo ? "bg-green-100 text-green-800 border-0" : "bg-gray-100 text-gray-600 border-0"}>
                                {fab.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                              <Badge variant="outline" className="border-red-200 text-red-700">{fab.moeda || "RMB"}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                              <span>⏱ Lead time: {fab.lead_time_min}–{fab.lead_time_max} dias</span>
                              <span>📦 Taxa consol.: {fab.taxa_consolidacao || 0}%</span>
                              {fab.ncm && <span>🔖 NCM: {fab.ncm}</span>}
                              {fab.id_integracao && (
                                <a href={fab.id_integracao.startsWith("http") ? fab.id_integracao : `https://detail.1688.com/offer/${fab.id_integracao}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-600 hover:underline">
                                  <ExternalLink className="w-3.5 h-3.5" /> 1688
                                </a>
                              )}
                            </div>
                            {/* Rating */}
                            <div className="flex items-center gap-1 mt-1">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={`w-4 h-4 ${s <= (fab.rating_exportacao || 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                              ))}
                              <span className="text-xs text-gray-500 ml-1">exportação</span>
                            </div>
                          </div>

                          {/* Pedidos em trânsito */}
                          <div className="flex items-center gap-3">
                            {pedidosFab.length > 0 && (
                              <Badge className="bg-purple-100 text-purple-800 border-0">
                                <Truck className="w-3.5 h-3.5 mr-1" />
                                {pedidosFab.length} pedido{pedidosFab.length > 1 ? "s" : ""} ativo{pedidosFab.length > 1 ? "s" : ""}
                              </Badge>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(fab)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(fab.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {fab.notas_verificacao && (
                          <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-800">
                            📋 {fab.notas_verificacao}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transito" className="mt-4">
            {pedidos.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Nenhum pedido cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl shadow-md">
                <table className="w-full bg-white text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Pedido</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Fabricante</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left p-3 font-semibold text-gray-600">CBM</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Embarque Previsto</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Valor (BRL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map(p => (
                      <tr key={p.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3 font-mono text-xs text-gray-700">{p.numero_pedido || p.id.slice(-8).toUpperCase()}</td>
                        <td className="p-3">{p.fabricante_nome || "—"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-700"}`}>
                            {STATUS_LABELS[p.status] || p.status}
                          </span>
                        </td>
                        <td className="p-3">{p.cbm_total ? `${p.cbm_total.toFixed(3)} m³` : "—"}</td>
                        <td className="p-3">{p.data_embarque_prevista || "—"}</td>
                        <td className="p-3 font-medium text-green-700">
                          {p.valor_total_brl ? `R$ ${p.valor_total_brl.toLocaleString("pt-BR", {minimumFractionDigits:2})}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Fábrica" : "Nova Fábrica Chinesa"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Nome da Fábrica / Razão Social</Label>
              <Input value={form.nome_fabrica} onChange={e => setForm({...form, nome_fabrica: e.target.value})}
                placeholder="Ex: Rizhao Fitness Equipment Co." className="mt-1" />
            </div>

            <div>
              <Label>Hub (Localização)</Label>
              <Select value={form.hub} onValueChange={v => setForm({...form, hub: v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HUBS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Moeda Padrão</Label>
              <div className="flex gap-2 mt-1">
                {["RMB","USD"].map(m => (
                  <button key={m} onClick={() => setForm({...form, moeda: m})}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-all ${form.moeda === m ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"}`}>
                    {m === "RMB" ? "¥ RMB" : "$ USD"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Lead Time Mínimo (dias)</Label>
              <Input type="number" value={form.lead_time_min} onChange={e => setForm({...form, lead_time_min: e.target.value})}
                placeholder="15" className="mt-1" />
            </div>

            <div>
              <Label>Lead Time Máximo (dias)</Label>
              <Input type="number" value={form.lead_time_max} onChange={e => setForm({...form, lead_time_max: e.target.value})}
                placeholder="20" className="mt-1" />
            </div>

            <div>
              <Label>Taxa de Consolidação Logística (%)</Label>
              <Input type="number" value={form.taxa_consolidacao} onChange={e => setForm({...form, taxa_consolidacao: e.target.value})}
                placeholder="8" className="mt-1" />
            </div>

            <div>
              <Label>NCM</Label>
              <Input value={form.ncm} onChange={e => setForm({...form, ncm: e.target.value})}
                placeholder="9506.91.00" className="mt-1" />
            </div>

            <div>
              <Label>Rating de Exportação (1–5)</Label>
              <div className="flex gap-1 mt-2">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setForm({...form, rating_exportacao: s})}>
                    <Star className={`w-7 h-7 transition-colors ${s <= form.rating_exportacao ? "fill-yellow-400 text-yellow-400" : "text-gray-200 hover:text-yellow-300"}`} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>ID / Link 1688 ou Alibaba</Label>
              <Input value={form.id_integracao} onChange={e => setForm({...form, id_integracao: e.target.value})}
                placeholder="https://detail.1688.com/..." className="mt-1" />
            </div>

            <div>
              <Label>Contato (Nome)</Label>
              <Input value={form.contato_nome} onChange={e => setForm({...form, contato_nome: e.target.value})}
                placeholder="Jack Li" className="mt-1" />
            </div>

            <div>
              <Label>WeChat / WhatsApp</Label>
              <Input value={form.contato_wechat} onChange={e => setForm({...form, contato_wechat: e.target.value})}
                placeholder="@jackli1688" className="mt-1" />
            </div>

            <div>
              <Label>Email</Label>
              <Input value={form.contato_email} onChange={e => setForm({...form, contato_email: e.target.value})}
                placeholder="contact@factory.com" className="mt-1" />
            </div>

            <div className="md:col-span-2">
              <Label>Notas de Verificação / Certificados</Label>
              <Textarea value={form.notas_verificacao} onChange={e => setForm({...form, notas_verificacao: e.target.value})}
                placeholder="Certificados de carga, qualidade do ferro/borracha, auditorias..." rows={3} className="mt-1" />
            </div>

            <div className="md:col-span-2 flex items-center gap-3">
              <Label>Ativo</Label>
              <button onClick={() => setForm({...form, ativo: !form.ativo})}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.ativo ? "bg-green-500" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.ativo ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-blue-600 text-white hover:bg-blue-700">
              {editItem ? "Salvar Alterações" : "Cadastrar Fábrica"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}