import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search, RefreshCw, TrendingUp, TrendingDown, Minus, Calculator,
  ShoppingCart, Package, Clock, Ship, Globe, Info, CheckCircle, AlertTriangle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";

// ─── Constantes de tributação ────────────────────────────────────────────────
const ALIQUOTAS = {
  II: 0.20,      // Imposto de Importação 20%
  IPI: 0.05,     // IPI 5%
  PIS: 0.0865,   // PIS-Importação 8,65%
  COFINS: 0.074, // COFINS-Importação 7,4%
  ICMS: 0.18,    // ICMS 18% (SP base)
};
const FRETE_LCL_USD_POR_CBM = 85;
const TAXA_PLACEFIT = 0.08;
// Prazo composto: lead_time + 35 (mar) + 10 (aduana) + 7 (nacional)
const PRAZO_MAR = 35;
const PRAZO_ADUANA = 10;
const PRAZO_NACIONAL = 7;

function calcularImpostos(valorCIF_BRL) {
  const II = valorCIF_BRL * ALIQUOTAS.II;
  const IPI = (valorCIF_BRL + II) * ALIQUOTAS.IPI;
  const baseICMS = (valorCIF_BRL + II + IPI) / (1 - ALIQUOTAS.ICMS);
  const ICMS = baseICMS * ALIQUOTAS.ICMS;
  const PIS = valorCIF_BRL * ALIQUOTAS.PIS;
  const COFINS = valorCIF_BRL * ALIQUOTAS.COFINS;
  return { II, IPI, PIS, COFINS, ICMS, total: II + IPI + PIS + COFINS + ICMS };
}

function calcularDDP(produto, taxaCambio) {
  const taxaRMB = taxaCambio.RMB || 0.77;
  const taxaUSD = taxaCambio.USD || 5.8;
  const fabricaBRL = (produto.preco_rmb || 0) * taxaRMB;
  const freteBRL = (produto.cbm_unitario || 0.05) * FRETE_LCL_USD_POR_CBM * taxaUSD;
  const cif = fabricaBRL + freteBRL;
  const impostos = calcularImpostos(cif);
  const taxaSvc = fabricaBRL * TAXA_PLACEFIT;
  const ddp = cif + impostos.total + taxaSvc;
  return { fabricaBRL, freteBRL, cif, impostos, taxaSvc, ddp };
}

// ─── Modal decomposição + add ao catálogo ────────────────────────────────────
function ModalAdicionarCatalogo({ produto, taxaCambio, fabricante, onClose, onConfirm }) {
  const [precoVenda, setPrecoVenda] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const c = calcularDDP(produto, taxaCambio);
  const leadTimeMin = (fabricante?.lead_time_min || 20) + PRAZO_MAR + PRAZO_ADUANA + PRAZO_NACIONAL;
  const leadTimeMax = (fabricante?.lead_time_max || 30) + PRAZO_MAR + PRAZO_ADUANA + PRAZO_NACIONAL;

  const margemSugerida = precoVenda ? (((parseFloat(precoVenda) - c.ddp) / c.ddp) * 100).toFixed(1) : null;

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(produto, c.ddp, parseFloat(precoVenda) || 0);
    setSaving(false);
  };

  const rows = [
    { label: "Preço de Fábrica (¥ → R$)", valor: c.fabricaBRL, detail: `¥${produto.preco_rmb} × R$${(taxaCambio.RMB||0.77).toFixed(4)}`, color: "text-gray-800" },
    { label: "Frete LCL Internacional", valor: c.freteBRL, detail: `${produto.cbm_unitario || 0.05} m³ × USD ${FRETE_LCL_USD_POR_CBM}/CBM`, color: "text-blue-700" },
    { label: "II — Imposto de Importação (20%)", valor: c.impostos.II, color: "text-orange-600" },
    { label: "IPI (5%)", valor: c.impostos.IPI, color: "text-orange-600" },
    { label: "PIS-Importação (8,65%)", valor: c.impostos.PIS, color: "text-orange-600" },
    { label: "COFINS-Importação (7,4%)", valor: c.impostos.COFINS, color: "text-orange-600" },
    { label: "ICMS (18%)", valor: c.impostos.ICMS, color: "text-orange-600" },
    { label: "Taxa de Serviço PlaceFit (8%)", valor: c.taxaSvc, color: "text-purple-700" },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-5 h-5 text-blue-600" />
            Importar para Meu Catálogo
          </DialogTitle>
        </DialogHeader>

        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-1">
          <strong>{produto.nome}</strong> · {fabricante?.nome_fabrica} · NCM {produto.ncm || "9506.91.00"}
        </div>

        {/* Decomposição */}
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <div>
                <span className="text-sm text-gray-700">{r.label}</span>
                {r.detail && <p className="text-[10px] text-gray-400">{r.detail}</p>}
              </div>
              <span className={`text-sm font-semibold ${r.color}`}>R$ {r.valor.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 flex items-center justify-between mt-2">
          <div>
            <p className="text-xs text-gray-500">Custo Final para Você (DDP)</p>
            <p className="text-2xl font-bold text-gray-900">R$ {c.ddp.toFixed(2)}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div className="flex items-center gap-1 justify-end text-purple-700 font-medium">
              <Clock className="w-3.5 h-3.5" />
              Prazo Est.: {leadTimeMin}–{leadTimeMax} dias
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              Fábrica + {PRAZO_MAR}d Mar + {PRAZO_ADUANA}d Aduana + {PRAZO_NACIONAL}d Nacional
            </p>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Configurar preço de venda */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Defina seu Preço de Venda (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={`Sugerido: R$ ${(c.ddp * 1.5).toFixed(2)} (margem 50%)`}
            value={precoVenda}
            onChange={e => setPrecoVenda(e.target.value)}
          />
          {margemSugerida !== null && (
            <p className={`text-xs font-medium ${parseFloat(margemSugerida) > 0 ? "text-green-600" : "text-red-600"}`}>
              Margem: {margemSugerida}%
              {parseFloat(margemSugerida) < 20 && " ⚠️ Margem baixa"}
              {parseFloat(margemSugerida) >= 20 && " ✓"}
            </p>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving}
            onClick={handleConfirm}
            className="bg-gradient-to-r from-blue-600 to-green-600 text-white"
          >
            {saving ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> Adicionando...</>
            ) : (
              <><ShoppingCart className="w-4 h-4 mr-2" /> Importar para Meu Catálogo</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Indicador de variação de preço ──────────────────────────────────────────
function PriceStatus({ produto, taxaCambio, previousRMB }) {
  if (!previousRMB || previousRMB === taxaCambio.RMB) {
    return <Badge className="bg-gray-100 text-gray-600 text-[10px]"><Minus className="w-3 h-3 mr-0.5" /> Sem alteração</Badge>;
  }
  const diff = ((taxaCambio.RMB - previousRMB) / previousRMB) * 100;
  if (diff > 0) {
    return (
      <Badge className="bg-red-100 text-red-700 text-[10px]">
        <TrendingUp className="w-3 h-3 mr-0.5" /> +{diff.toFixed(2)}% RMB
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-700 text-[10px]">
      <TrendingDown className="w-3 h-3 mr-0.5" /> {diff.toFixed(2)}% RMB
    </Badge>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AtualizacoesMercadoChina() {
  const [user, setUser] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [taxaCambio, setTaxaCambio] = useState({ RMB: null, USD: null });
  const [previousRMB, setPreviousRMB] = useState(null);
  const [loadingCambio, setLoadingCambio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFab, setSelectedFab] = useState("all");
  const [modalProduto, setModalProduto] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAll();
    fetchCambio();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    const [allProds, fabs, sp] = await Promise.all([
      base44.entities.Product.list(),
      base44.entities.FabricanteChina.list(),
      base44.entities.SupplierProduct.filter({ supplier_id: currentUser.id }),
    ]);
    // Filtrar produtos chineses no client-side (mais confiável que filter por enum)
    const prods = allProds.filter(p => p.origem === "china" && p.ativo !== false);
    setProdutos(prods);
    setFabricantes(fabs);
    setSupplierProducts(sp);
    setLoading(false);
  };

  const fetchCambio = async () => {
    setLoadingCambio(true);
    const prev = taxaCambio.RMB;
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: "Qual é a cotação comercial atual do Yuan Chinês (CNY/RMB) para BRL e do Dólar Americano (USD) para BRL? Adicione 2% de spread bancário em cada valor.",
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: { RMB_to_BRL: { type: "number" }, USD_to_BRL: { type: "number" } }
        }
      });
      if (prev) setPreviousRMB(prev);
      setTaxaCambio({ RMB: res.RMB_to_BRL, USD: res.USD_to_BRL });
      setLastUpdated(new Date());
    } catch {
      setTaxaCambio({ RMB: 0.79, USD: 5.92 });
      setLastUpdated(new Date());
    }
    setLoadingCambio(false);
  };

  const isInCatalog = (productId) => supplierProducts.some(sp => sp.product_id === productId);

  const handleAddToCatalog = async (produto, ddpBRL, precoVenda) => {
    // Atualizar preco_fabricante do produto com o DDP calculado
    await base44.entities.Product.update(produto.id, { preco_fabricante: ddpBRL });

    // Criar ou atualizar SupplierProduct
    const existing = supplierProducts.find(sp => sp.product_id === produto.id);
    if (existing) {
      await base44.entities.SupplierProduct.update(existing.id, {
        preco: precoVenda || ddpBRL * 1.5,
        disponivel: true,
      });
    } else {
      await base44.entities.SupplierProduct.create({
        supplier_id: user.id,
        product_id: produto.id,
        preco: precoVenda || ddpBRL * 1.5,
        disponivel: true,
      });
    }
    toast({ title: "✓ Produto importado para seu catálogo!", description: "Você pode editar o preço em Meus Produtos." });
    setModalProduto(null);
    loadAll();
  };

  const produtosFiltrados = produtos.filter(p => {
    const matchSearch = p.nome?.toLowerCase().includes(search.toLowerCase()) ||
      p.fabricante_china_nome?.toLowerCase().includes(search.toLowerCase()) ||
      p.cod?.toLowerCase().includes(search.toLowerCase());
    const matchFab = selectedFab === "all" || p.fabricante_china_id === selectedFab;
    return matchSearch && matchFab;
  });

  const fabricanteMap = Object.fromEntries(fabricantes.map(f => [f.id, f]));

  const statsRMB = taxaCambio.RMB && previousRMB
    ? ((taxaCambio.RMB - previousRMB) / previousRMB * 100)
    : 0;

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📊 Atualizações de Mercado</h1>
            <p className="text-gray-500 mt-1">Monitor de preços · Produtos chineses · Importar para seu catálogo</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCambio} disabled={loadingCambio} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loadingCambio ? "animate-spin" : ""}`} />
            Atualizar Câmbio
          </Button>
        </div>

        {/* Câmbio + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className={`border-0 shadow-md ${statsRMB > 0.5 ? "bg-red-50" : statsRMB < -0.5 ? "bg-green-50" : "bg-white"}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">¥ Yuan (RMB) → BRL</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {taxaCambio.RMB ? `R$ ${taxaCambio.RMB.toFixed(4)}` : "—"}
                  </p>
                  {statsRMB !== 0 && (
                    <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${statsRMB > 0 ? "text-red-600" : "text-green-600"}`}>
                      {statsRMB > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {statsRMB > 0 ? "+" : ""}{statsRMB.toFixed(2)}% nas últimas 24h
                    </p>
                  )}
                </div>
                <Globe className="w-8 h-8 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">$ Dólar (USD) → BRL</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {taxaCambio.USD ? `R$ ${taxaCambio.USD.toFixed(2)}` : "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Spread bancário 2% incluído</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Produtos Monitorados</p>
                  <p className="text-2xl font-bold text-gray-900">{produtos.length}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {supplierProducts.filter(sp => produtos.some(p => p.id === sp.product_id)).length} já no seu catálogo
                  </p>
                </div>
                <Package className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {lastUpdated && (
          <p className="text-xs text-gray-400 -mt-2">
            Última atualização: {lastUpdated.toLocaleTimeString("pt-BR")}
          </p>
        )}

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Como funciona a transparência de preços</p>
            <p>O preço exibido é o <strong>custo DDP (Delivered Duty Paid)</strong> — já inclui câmbio, frete LCL, todos os impostos (II 20%, IPI 5%, PIS/COFINS 9,25%, ICMS 18%) e a taxa de serviço PlaceFit (8%). Você define quanto quer cobrar ao cliente.</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar produto, SKU ou fabricante..." className="pl-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select
            value={selectedFab}
            onChange={e => setSelectedFab(e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="all">Todos os Fabricantes</option>
            {fabricantes.map(f => (
              <option key={f.id} value={f.id}>{f.nome_fabrica}</option>
            ))}
          </select>
        </div>

        {/* Tabela / Lista de produtos */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Package className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum produto chinês cadastrado ainda</p>
            <p className="text-sm mt-1">Cadastre produtos em Fabricantes → China para monitorá-los aqui.</p>
            <Button className="mt-4" variant="outline" onClick={() => window.location.href = createPageUrl("FabricantesChina")}>
              Ir para Fabricantes China
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {produtosFiltrados.map(produto => {
              const fab = fabricanteMap[produto.fabricante_china_id];
              const c = taxaCambio.RMB ? calcularDDP(produto, taxaCambio) : null;
              const inCatalog = isInCatalog(produto.id);
              const leadMin = (fab?.lead_time_min || 20) + PRAZO_MAR + PRAZO_ADUANA + PRAZO_NACIONAL;
              const leadMax = (fab?.lead_time_max || 30) + PRAZO_MAR + PRAZO_ADUANA + PRAZO_NACIONAL;

              return (
                <Card key={produto.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">

                      {/* Foto + Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {produto.foto ? (
                          <img src={produto.foto} alt={produto.nome}
                            className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-100" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 leading-tight">{produto.nome}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{fab?.nome_fabrica || produto.fabricante_china_nome} · {fab?.hub}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">🇨🇳 {produto.cod}</Badge>
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">{produto.categoria}</Badge>
                            {produto.cbm_unitario && (
                              <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px]">{produto.cbm_unitario} m³</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Painel de preços */}
                      <div className="flex flex-wrap gap-4 items-center">
                        {/* Preço fábrica */}
                        <div className="text-center min-w-[80px]">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Fábrica</p>
                          <p className="text-base font-bold text-red-700">¥ {produto.preco_rmb || "—"}</p>
                          {taxaCambio.RMB && produto.preco_rmb && (
                            <p className="text-xs text-gray-500">
                              R$ {(produto.preco_rmb * taxaCambio.RMB).toFixed(2)}
                            </p>
                          )}
                        </div>

                        {/* Status de preço */}
                        <div className="text-center min-w-[100px]">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Status RMB</p>
                          <PriceStatus produto={produto} taxaCambio={taxaCambio} previousRMB={previousRMB} />
                        </div>

                        {/* DDP */}
                        {c && (
                          <div className="text-center min-w-[90px]">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">DDP Est.</p>
                            <p className="text-lg font-bold text-blue-700">R$ {c.ddp.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5">
                              <Clock className="w-3 h-3" /> {leadMin}–{leadMax}d
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="text-xs gap-1"
                          onClick={() => setModalProduto(produto)}>
                          <Calculator className="w-3.5 h-3.5" /> Detalhar
                        </Button>
                        {inCatalog ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1 px-3 py-1.5 text-xs">
                            <CheckCircle className="w-3.5 h-3.5" /> No Catálogo
                          </Badge>
                        ) : (
                          <Button size="sm"
                            className="bg-gradient-to-r from-blue-600 to-green-600 text-white text-xs gap-1"
                            onClick={() => setModalProduto(produto)}>
                            <ShoppingCart className="w-3.5 h-3.5" /> Importar
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
      </div>

      {/* Modal */}
      {modalProduto && taxaCambio.RMB && (
        <ModalAdicionarCatalogo
          produto={modalProduto}
          taxaCambio={taxaCambio}
          fabricante={fabricanteMap[modalProduto.fabricante_china_id]}
          onClose={() => setModalProduto(null)}
          onConfirm={handleAddToCatalog}
        />
      )}
    </div>
  );
}