import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Search, ShoppingCart, Package, Truck, Globe, Calculator,
  CheckCircle, Clock, Ship, AlertCircle, RefreshCw, Plus, Minus,
  DollarSign, Info, TrendingDown, Box, FileText, ChevronRight
} from "lucide-react";

// Alíquotas de importação NCM 9506.91.00
const ALIQUOTAS = {
  II: 0.20,       // Imposto de Importação 20%
  IPI: 0.05,      // IPI 5%
  PIS: 0.0865,    // PIS-Importação 8,65%
  COFINS: 0.074,  // COFINS-Importação 7,4%
  ICMS: 0.18,     // ICMS base (SP 18%)
};

// Custo de frete LCL estimado (USD/CBM)
const FRETE_LCL_USD_POR_CBM = 85;
// CBM de um container completo 20'
const CBM_CONTAINER_20 = 25;

const STATUS_TIMELINE = [
  { key: "pedido_pago", label: "Pedido Pago", icon: CheckCircle, color: "text-green-600" },
  { key: "em_producao", label: "Produção na China", icon: Package, color: "text-yellow-600" },
  { key: "consolidacao", label: "Consolidação no HUB", icon: Box, color: "text-blue-600" },
  { key: "em_transito", label: "Em Mar", icon: Ship, color: "text-purple-600" },
  { key: "aduana", label: "Aduana BR", icon: FileText, color: "text-orange-600" },
  { key: "entregue", label: "Entrega Final", icon: Truck, color: "text-green-700" },
];

const STATUS_INDEX = {
  pedido_pago: 0, em_producao: 1, consolidacao: 2,
  em_transito: 3, aduana: 4, entregue: 5,
};

function calcularImpostos(valorCIF_BRL) {
  const II = valorCIF_BRL * ALIQUOTAS.II;
  const IPI = (valorCIF_BRL + II) * ALIQUOTAS.IPI;
  const baseICMS = (valorCIF_BRL + II + IPI) / (1 - ALIQUOTAS.ICMS);
  const ICMS = baseICMS * ALIQUOTAS.ICMS;
  const PIS = valorCIF_BRL * ALIQUOTAS.PIS;
  const COFINS = valorCIF_BRL * ALIQUOTAS.COFINS;
  return { II, IPI, PIS, COFINS, ICMS, total: II + IPI + PIS + COFINS + ICMS };
}

function CbmMeter({ cbmAtual, cbmMax = CBM_CONTAINER_20 }) {
  const pct = Math.min((cbmAtual / cbmMax) * 100, 100);
  const falta = cbmMax - cbmAtual;
  const economiaPercent = falta <= 0 ? 0 : Math.round((falta / cbmMax) * 20);
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
          <Box className="w-4 h-4" /> Ocupação do Container LCL
        </div>
        <span className="text-blue-900 font-bold text-sm">{cbmAtual.toFixed(2)} / {cbmMax} m³</span>
      </div>
      <div className="w-full bg-blue-100 rounded-full h-3 mb-2">
        <div
          className="h-3 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct > 80 ? "#16a34a" : pct > 50 ? "#2563eb" : "#f59e0b"
          }}
        />
      </div>
      {falta > 0 && (
        <p className="text-xs text-blue-600">
          💡 Faltam <strong>{falta.toFixed(2)} m³</strong> para otimizar o frete. Adicionar mais itens pode reduzir o custo em até <strong>{economiaPercent}%</strong>.
        </p>
      )}
      {falta <= 0 && (
        <p className="text-xs text-green-700 font-semibold">✅ Container otimizado! Excelente aproveitamento de frete.</p>
      )}
    </div>
  );
}

function TimelineOrder({ pedido }) {
  const currentIdx = STATUS_INDEX[pedido.status] ?? 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STATUS_TIMELINE.map((step, idx) => {
          const Icon = step.icon;
          const done = idx <= currentIdx;
          const active = idx === currentIdx;
          return (
            <React.Fragment key={step.key}>
              <div className={`flex flex-col items-center min-w-[72px] ${done ? "" : "opacity-30"}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  active ? "border-blue-500 bg-blue-50 shadow-md scale-110" :
                  done ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"
                }`}>
                  <Icon className={`w-4 h-4 ${done ? step.color : "text-gray-400"}`} />
                </div>
                <span className={`text-[10px] text-center mt-1 font-medium leading-tight ${active ? "text-blue-700" : done ? "text-gray-700" : "text-gray-400"}`}>
                  {step.label}
                </span>
              </div>
              {idx < STATUS_TIMELINE.length - 1 && (
                <div className={`h-0.5 flex-1 min-w-[12px] rounded ${idx < currentIdx ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function CheckoutDecomposicao({ item, taxaCambio, onClose, onConfirmar }) {
  const taxaRMB = taxaCambio.RMB || 0.77;
  const taxaUSD = taxaCambio.USD || 5.8;
  const qty = item.quantidade || 1;

  const precoFabrica_RMB = (item.preco_rmb || 0) * qty;
  const precoFabrica_BRL = precoFabrica_RMB * taxaRMB;
  const cbmItem = (item.cbm_unitario || 0.05) * qty;
  const frete_USD = cbmItem * FRETE_LCL_USD_POR_CBM;
  const frete_BRL = frete_USD * taxaUSD;
  const taxaPlaceFit = precoFabrica_BRL * 0.08;
  const valorCIF = precoFabrica_BRL + frete_BRL;
  const impostos = calcularImpostos(valorCIF);
  const totalFinal = valorCIF + impostos.total + taxaPlaceFit;

  const rows = [
    { label: "Preço de Fábrica (RMB → BRL)", valor: precoFabrica_BRL, detail: `¥ ${precoFabrica_RMB.toFixed(2)} × R$ ${taxaRMB.toFixed(4)}`, color: "text-gray-800" },
    { label: "Frete Internacional LCL (via Qingdao)", valor: frete_BRL, detail: `${cbmItem.toFixed(3)} m³ × USD ${FRETE_LCL_USD_POR_CBM}/CBM`, color: "text-blue-700" },
    { label: "II — Imposto de Importação (20%)", valor: impostos.II, color: "text-orange-600" },
    { label: "IPI (5%)", valor: impostos.IPI, color: "text-orange-600" },
    { label: "PIS-Importação (8,65%)", valor: impostos.PIS, color: "text-orange-600" },
    { label: "COFINS-Importação (7,4%)", valor: impostos.COFINS, color: "text-orange-600" },
    { label: "ICMS (18%)", valor: impostos.ICMS, color: "text-orange-600" },
    { label: "Taxa de Serviço PlaceFit (8%)", valor: taxaPlaceFit, color: "text-purple-700" },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            Decomposição de Custo — {item.nome || "Produto"}
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-4">
          NCM 9506.91.00 · LCL via Porto de Qingdao · Câmbio: R$ {taxaRMB.toFixed(4)}/RMB · R$ {taxaUSD.toFixed(2)}/USD
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <div>
                <span className="text-sm text-gray-700">{r.label}</span>
                {r.detail && <p className="text-[10px] text-gray-400">{r.detail}</p>}
              </div>
              <span className={`text-sm font-semibold ${r.color}`}>
                R$ {r.valor.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Preço Desembarcado (DDP Est.)</p>
            <p className="text-2xl font-bold text-gray-900">R$ {totalFinal.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Por {qty} unidade{qty > 1 ? "s" : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Por unidade</p>
            <p className="text-xl font-bold text-blue-700">R$ {(totalFinal / qty).toFixed(2)}</p>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirmar(totalFinal, cbmItem)}
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
            <ShoppingCart className="w-4 h-4 mr-2" /> Confirmar Pré-Ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ComprasInternacionais() {
  const [user, setUser] = useState(null);
  const [fabricantes, setFabricantes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [taxaCambio, setTaxaCambio] = useState({ RMB: 0.77, USD: 5.8 });
  const [loadingCambio, setLoadingCambio] = useState(false);
  const [search, setSearch] = useState("");
  const [carrinho, setCarrinho] = useState([]);
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrando, setMostrando] = useState("catalogo");

  useEffect(() => {
    loadAll();
    fetchCambio();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    const [fabs, peds] = await Promise.all([
      base44.entities.FabricanteChina.list(),
      base44.entities.PedidoChina.filter({ revendedor_id: currentUser.id }),
    ]);
    setFabricantes(fabs.filter(f => f.ativo));
    setPedidos(peds);
    setLoading(false);
  };

  const fetchCambio = async () => {
    setLoadingCambio(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: "Qual é a cotação comercial atual do Yuan Chinês (CNY/RMB) para BRL e do USD para BRL? Adicione 2% de spread sobre cada valor.",
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: { RMB_to_BRL: { type: "number" }, USD_to_BRL: { type: "number" } }
        }
      });
      setTaxaCambio({ RMB: res.RMB_to_BRL, USD: res.USD_to_BRL });
    } catch {
      setTaxaCambio({ RMB: 0.79, USD: 5.92 }); // fallback com 2% spread
    }
    setLoadingCambio(false);
  };

  // Produtos sintéticos a partir dos fabricantes (em produção real viria de uma entidade de produtos)
  const catalogoProdutos = fabricantes.flatMap(fab => [
    {
      id: `${fab.id}_1`, fabricante_id: fab.id, fabricante_nome: fab.nome_fabrica, hub: fab.hub,
      nome: `Bumper Plate 20kg — ${fab.nome_fabrica}`, preco_rmb: 280, cbm_unitario: 0.08,
      peso_kg: 20, ncm: "9506.91.00", especialidade: fab.notas_verificacao
    },
    {
      id: `${fab.id}_2`, fabricante_id: fab.id, fabricante_nome: fab.nome_fabrica, hub: fab.hub,
      nome: `Kettlebell 16kg — ${fab.nome_fabrica}`, preco_rmb: 120, cbm_unitario: 0.04,
      peso_kg: 16, ncm: "9506.91.00", especialidade: fab.notas_verificacao
    },
  ]);

  const produtosFiltrados = catalogoProdutos.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.fabricante_nome.toLowerCase().includes(search.toLowerCase())
  );

  const cbmCarrinho = carrinho.reduce((sum, i) => sum + (i.cbm_unitario || 0.05) * (i.quantidade || 1), 0);

  const handleAddToCarrinho = (produto, totalBRL, cbm) => {
    setCarrinho(prev => {
      const existe = prev.find(i => i.id === produto.id);
      if (existe) return prev.map(i => i.id === produto.id ? { ...i, quantidade: (i.quantidade || 1) + 1 } : i);
      return [...prev, { ...produto, quantidade: 1, preco_ddp_brl: totalBRL / (produto.quantidade || 1), cbm_unitario: cbm / (produto.quantidade || 1) }];
    });
    setCheckoutItem(null);
  };

  const gerarInstrucaoConsolidacao = () => {
    const hubs = [...new Set(carrinho.map(i => i.hub || "Shandong"))];
    const multiHub = hubs.length > 1;
    const fabs = [...new Set(carrinho.map(i => i.fabricante_nome))];
    return { hubs, multiHub, fabs };
  };

  const consolidacao = gerarInstrucaoConsolidacao();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🌐 Compras Internacionais</h1>
            <p className="text-gray-500 mt-1">Produtos direto da China · Preço DDP desembarcado no Brasil</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm px-3 py-1.5 border-red-200 text-red-700 bg-red-50 gap-1.5">
              ¥ RMB: <span className="font-bold">{taxaCambio.RMB ? `R$ ${taxaCambio.RMB.toFixed(4)}` : "—"}</span>
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1.5 border-green-200 text-green-700 bg-green-50 gap-1.5">
              $ USD: <span className="font-bold">{taxaCambio.USD ? `R$ ${taxaCambio.USD.toFixed(2)}` : "—"}</span>
            </Badge>
            <Button variant="ghost" size="sm" onClick={fetchCambio} disabled={loadingCambio}>
              <RefreshCw className={`w-4 h-4 ${loadingCambio ? "animate-spin" : ""}`} />
            </Button>
            {carrinho.length > 0 && (
              <Button
                onClick={() => setMostrando("carrinho")}
                className="relative bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Carrinho
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {carrinho.length}
                </span>
              </Button>
            )}
          </div>
        </div>

        <Tabs value={mostrando} onValueChange={setMostrando}>
          <TabsList className="mb-4">
            <TabsTrigger value="catalogo">📦 Catálogo</TabsTrigger>
            <TabsTrigger value="carrinho">
              🛒 Pré-Ordem {carrinho.length > 0 && `(${carrinho.length})`}
            </TabsTrigger>
            <TabsTrigger value="pedidos">🚢 Meus Pedidos</TabsTrigger>
          </TabsList>

          {/* === CATÁLOGO === */}
          <TabsContent value="catalogo">
            {cbmCarrinho > 0 && (
              <div className="mb-4">
                <CbmMeter cbmAtual={cbmCarrinho} />
              </div>
            )}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar produto ou fabricante..." className="pl-9"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-44 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {produtosFiltrados.map(produto => {
                  const precoFab_BRL = produto.preco_rmb * (taxaCambio.RMB || 0.77);
                  const frete_BRL = produto.cbm_unitario * FRETE_LCL_USD_POR_CBM * (taxaCambio.USD || 5.8);
                  const cif = precoFab_BRL + frete_BRL;
                  const impostos = calcularImpostos(cif);
                  const taxa = precoFab_BRL * 0.08;
                  const ddp = cif + impostos.total + taxa;
                  const noCarrinho = carrinho.find(i => i.id === produto.id);

                  return (
                    <Card key={produto.id} className="border-0 shadow-md hover:shadow-xl transition-all">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">{produto.nome}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{produto.fabricante_nome}</p>
                          </div>
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] shrink-0 ml-2">
                            🇨🇳 {produto.hub}
                          </Badge>
                        </div>

                        <div className="space-y-1 my-3">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Preço fábrica</span>
                            <span>¥ {produto.preco_rmb} · R$ {precoFab_BRL.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Frete LCL est.</span>
                            <span>R$ {frete_BRL.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-orange-600">
                            <span>Impostos est.</span>
                            <span>R$ {impostos.total.toFixed(2)}</span>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Preço DDP Est.</p>
                            <p className="text-xl font-bold text-blue-700">R$ {ddp.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-400">{produto.cbm_unitario} m³ · {produto.peso_kg}kg</p>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Button size="sm" variant="outline" className="text-xs"
                              onClick={() => setCheckoutItem({ ...produto, quantidade: 1 })}>
                              <Calculator className="w-3 h-3 mr-1" /> Detalhar
                            </Button>
                            {noCarrinho ? (
                              <Badge className="bg-green-100 text-green-700 text-xs px-2 py-1">✓ No carrinho</Badge>
                            ) : (
                              <Button size="sm" className="bg-blue-600 text-white text-xs"
                                onClick={() => setCheckoutItem({ ...produto, quantidade: 1 })}>
                                <Plus className="w-3 h-3 mr-1" /> Adicionar
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* === CARRINHO / PRÉ-ORDEM === */}
          <TabsContent value="carrinho">
            {carrinho.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <ShoppingCart className="w-14 h-14 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Carrinho vazio</p>
                <p className="text-sm mt-1">Adicione produtos do catálogo para criar sua pré-ordem.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <CbmMeter cbmAtual={cbmCarrinho} />

                {/* Alerta de multi-HUB */}
                {consolidacao.multiHub && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">Atenção: Consolidação Multi-HUB</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Itens de diferentes HUBs ({consolidacao.hubs.join(", ")}) precisam de consolidação no armazém antes do embarque.
                        Uma "Instrução de Consolidação" será gerada automaticamente ao confirmar o pedido.
                      </p>
                    </div>
                  </div>
                )}

                {/* Instrução de Consolidação */}
                <Card className="border border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm text-blue-800 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Instrução de Consolidação Automática
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-4 text-xs text-blue-700 space-y-1">
                    <p>📍 Porto de Saída: <strong>Qingdao, China</strong></p>
                    <p>🏭 Fabricantes: <strong>{consolidacao.fabs.join(" · ")}</strong></p>
                    <p>📦 Volume Total: <strong>{cbmCarrinho.toFixed(3)} m³</strong></p>
                    <p>🚢 Tipo de Envio: <strong>LCL — Carga Fracionada</strong></p>
                    <p className="text-blue-500 pt-1">
                      ⚡ O pedido será disparado para o fabricante após a confirmação de pagamento.
                    </p>
                  </CardContent>
                </Card>

                {/* Itens */}
                <div className="space-y-3">
                  {carrinho.map(item => (
                    <Card key={item.id} className="border-0 shadow-sm">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{item.nome}</p>
                          <p className="text-xs text-gray-400">{item.fabricante_nome} · {item.hub}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-7 w-7"
                            onClick={() => setCarrinho(p => p.map(i => i.id === item.id && i.quantidade > 1 ? { ...i, quantidade: i.quantidade - 1 } : i))}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-bold">{item.quantidade}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7"
                            onClick={() => setCarrinho(p => p.map(i => i.id === item.id ? { ...i, quantidade: i.quantidade + 1 } : i))}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-right min-w-[90px]">
                          <p className="font-bold text-blue-700 text-sm">
                            R$ {((item.preco_ddp_brl || 0) * item.quantidade).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-gray-400">DDP Est.</p>
                        </div>
                        <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-600 h-7 w-7"
                          onClick={() => setCarrinho(p => p.filter(i => i.id !== item.id))}>
                          <Minus className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-xl p-5 text-white flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">Total DDP Estimado</p>
                    <p className="text-2xl font-bold">
                      R$ {carrinho.reduce((sum, i) => sum + (i.preco_ddp_brl || 0) * i.quantidade, 0).toFixed(2)}
                    </p>
                    <p className="text-xs opacity-70 mt-0.5">Todos os impostos e frete incluídos</p>
                  </div>
                  <Button className="bg-white text-blue-700 hover:bg-gray-100 font-bold px-6">
                    Confirmar Pré-Ordem
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* === MEUS PEDIDOS === */}
          <TabsContent value="pedidos">
            {pedidos.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Ship className="w-14 h-14 mx-auto mb-3 opacity-30" />
                <p className="text-lg">Nenhum pedido ainda</p>
                <p className="text-sm mt-1">Seus pedidos de importação aparecerão aqui.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pedidos.map(pedido => (
                  <Card key={pedido.id} className="border-0 shadow-md">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-bold text-gray-900">Pedido #{pedido.numero_pedido || pedido.id.slice(-8).toUpperCase()}</p>
                          <p className="text-xs text-gray-400">{pedido.fabricante_nome} · {pedido.data_pedido}</p>
                        </div>
                        <Badge className={`text-xs ${
                          pedido.status === "em_transito" ? "bg-purple-100 text-purple-800" :
                          pedido.status === "entregue" ? "bg-green-100 text-green-800" :
                          pedido.status === "em_producao" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {pedido.status?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <TimelineOrder pedido={pedido} />
                      <div className="flex gap-4 text-sm text-gray-500 pt-1">
                        <span>📦 {pedido.cbm_total?.toFixed(3)} m³</span>
                        <span>⚖️ {pedido.peso_total_kg} kg</span>
                        {pedido.valor_total_brl && (
                          <span className="text-green-700 font-semibold">
                            R$ {pedido.valor_total_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de decomposição de custo */}
      {checkoutItem && (
        <CheckoutDecomposicao
          item={checkoutItem}
          taxaCambio={taxaCambio}
          onClose={() => setCheckoutItem(null)}
          onConfirmar={(totalBRL, cbm) => handleAddToCarrinho(checkoutItem, totalBRL, cbm)}
        />
      )}
    </div>
  );
}