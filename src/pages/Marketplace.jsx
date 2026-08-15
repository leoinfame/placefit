import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getAllProducts } from "@/functions/getAllProducts";
import {
  Search,
  Trash2,
  Package,
  Phone,
  Mail,
  MapPin,
  Globe,
  ShoppingCart,
  X,
  TrendingDown,
  Award,
  Copy,
  MessageCircle,
  Facebook,
  Send,
  Linkedin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";




import { useToast } from "@/components/ui/use-toast";
import MarketplaceSearch from "@/components/marketplace/MarketplaceSearch";
import FabricantesTrust from "@/components/marketplace/FabricantesTrust";

// Logo da PlaceFit
const PLACEFIT_LOGO = "https://media.base44.com/images/public/68c9d5dd3cf0f8fd8a834875/574e5a0a6_logo-ico-removebg-preview1.png";

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    registerMarketplaceVisit();
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const currentUser = await base44.auth.me();
        setAuthUser(currentUser);
      }
    } catch (error) {
      // Not authenticated — that's fine, stay on marketplace
    }
    setCheckingAuth(false);
  };

  const handleEntrarNoApp = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        // Already logged in — go straight to the app
        window.location.href = '/app';
      } else {
        // Not logged in — redirect to login, come back to /app
        base44.auth.redirectToLogin('/app');
      }
    } catch (error) {
      base44.auth.redirectToLogin('/app');
    }
  };

  const registerMarketplaceVisit = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const currentUser = await base44.auth.me();
        // Registrar visita ao marketplace
        await base44.auth.updateMe({
          ultima_visita_marketplace: new Date().toISOString()
        });
        console.log("Visita registrada para:", currentUser.email);
      }
    } catch (error) {
      console.log("Visitante não autenticado ou erro:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Usar backend function que não exige autenticação
      const result = await getAllProducts({}).then(r => r.data).catch(() => ({ products: [], fabricantes: [], supplierProducts: [] }));

      const activeProducts = result.products || [];
      const fabricantesData = result.fabricantes || [];
      const supplierProds = result.supplierProducts || [];

      setProducts(activeProducts);
      setFabricantes(fabricantesData);
      setSupplierProducts(supplierProds);

      if (activeProducts.length === 0) {
        setError("Nenhum produto disponível no momento.");
      }
    } catch (error) {
      console.error("Erro ao carregar dados do marketplace:", error);
      setError("Erro ao carregar dados. Por favor, tente novamente mais tarde.");
    }
    setLoading(false);
  };

  const getBaseName = (p) => (p.nome || '').replace(/\s+\d+([.,]\d+)?\s*kg$/i, '').trim();

  const getGroupKey = (p) => [
    getBaseName(p), p.categoria, p.subcategoria, p.tipo_anilha, p.tipo_furo,
    p.acabamento, p.pegada, p.barra_acabamento, p.bojo_formato, p.dumbell_tipo,
    p.piso_formato, p.tijolinho_tipo
  ].map(v => v ?? '').join('|');

  // Agrupa variações de peso do mesmo produto em um único item (nome + preço por kg),
  // igual ao catálogo — evita listar cada peso separadamente na busca.
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const key = getGroupKey(p);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nome: getBaseName(p),
          cod: p.cod,
          categoria: p.categoria,
          subcategoria: p.subcategoria,
          tipo_anilha: p.tipo_anilha,
          tipo_furo: p.tipo_furo,
          acabamento: p.acabamento,
          pegada: p.pegada,
          barra_acabamento: p.barra_acabamento,
          bojo_formato: p.bojo_formato,
          dumbell_tipo: p.dumbell_tipo,
          piso_formato: p.piso_formato,
          tijolinho_tipo: p.tijolinho_tipo,
          foto: p.foto,
          und: p.und,
          templates: [],
        });
      }
      map.get(key).templates.push(p);
    }
    for (const g of map.values()) g.templates.sort((a, b) => (a.peso || 0) - (b.peso || 0));
    return [...map.values()];
  }, [products]);

  const handleSelectGroup = (group) => {
    if (!selectedGroups.find(g => g.id === group.id)) {
      setSelectedGroups([...selectedGroups, group]);
    }
  };

  const handleRemoveGroup = (groupId) => {
    setSelectedGroups(selectedGroups.filter(g => g.id !== groupId));
  };

  // Preços por fabricante para um grupo: preço/kg quando há variações de peso,
  // preço unitário caso contrário.
  const getGroupPrices = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return [];
    const WEIGHT_CATEGORIES = ["Anilhas", "Halteres", "Dumbells", "Kettlebells"];
    const hasWeights = WEIGHT_CATEGORIES.includes(group.categoria) && group.templates.some(t => t.peso != null && t.peso > 0);
    const fabData = {};
    for (const tmpl of group.templates) {
      const sps = (supplierProducts || []).filter(sp => sp.product_id === tmpl.id);
      for (const sp of sps) {
        const fabricante = fabricantes.find(f => f.id === sp.fabricante_id_display || f.id === sp.supplier_id || f.id === sp.fabricante_id);
        if (!fabricante) continue;
        const price = sp.preco && parseFloat(sp.preco) > 0 ? parseFloat(sp.preco) : null;
        if (price == null) continue;
        if (!fabData[fabricante.id]) fabData[fabricante.id] = { supplier: fabricante, sum: 0, count: 0, preco: null, observacoes: sp.observacoes };
        if (hasWeights && tmpl.peso) {
          fabData[fabricante.id].sum += price / tmpl.peso;
          fabData[fabricante.id].count++;
        } else {
          fabData[fabricante.id].preco = price;
        }
      }
    }
    return Object.values(fabData).map(d => ({
      supplier: d.supplier,
      price: hasWeights ? (d.count > 0 ? d.sum / d.count : null) : d.preco,
      perKg: hasWeights,
      observacoes: d.observacoes,
    })).filter(d => d.price != null).sort((a, b) => a.price - b.price);
  };

  const copyMarketplaceLink = () => {
    const link = `${window.location.origin}/Marketplace`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Link do marketplace copiado para a área de transferência.",
    });
  };

  const shareWhatsApp = () => {
    const link = `${window.location.origin}/Marketplace`;
    const text = `Confira os melhores preços de equipamentos fitness no PlaceFit: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareFacebook = () => {
    const link = `${window.location.origin}/Marketplace`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank');
  };

  const shareTelegram = () => {
    const link = `${window.location.origin}/Marketplace`;
    const text = `Confira os melhores preços de equipamentos fitness no PlaceFit`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareLinkedIn = () => {
    const link = `${window.location.origin}/Marketplace`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <img
            src={PLACEFIT_LOGO}
            alt="PlaceFit"
            className="w-16 h-16 mx-auto object-contain animate-pulse"
          />
          <div className="animate-pulse text-gray-600">Carregando marketplace...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <img
            src={PLACEFIT_LOGO}
            alt="PlaceFit"
            className="w-16 h-16 mx-auto object-contain"
          />
          <h2 className="text-2xl font-bold text-gray-900">PlaceFit Marketplace</h2>
          <p className="text-red-600">{error}</p>
          <Button onClick={loadData} className="bg-gradient-to-r from-blue-600 to-green-600">
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={PLACEFIT_LOGO}
                alt="PlaceFit"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  PlaceFit
                </h1>
                <p className="text-sm text-gray-600">Observatório de Preços Fitness</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedGroups.length > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 px-4 py-2">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {selectedGroups.length} {selectedGroups.length === 1 ? 'produto' : 'produtos'}
                </Badge>
              )}
              <Button
                onClick={handleEntrarNoApp}
                disabled={checkingAuth}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
                size="sm"
              >
                {checkingAuth ? "..." : authUser ? "Ir para o Painel" : "Entrar no App"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Bar - Busca moderna */}
        <MarketplaceSearch
          products={groups}
          onSelectProduct={handleSelectGroup}
          getProductPrices={getGroupPrices}
        />

        {/* Compartilhar Marketplace - Ícones apenas */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button
            onClick={copyMarketplaceLink}
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-blue-50"
            title="Copiar link"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            onClick={shareWhatsApp}
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-green-50"
            title="WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button
            onClick={shareFacebook}
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-blue-50"
            title="Facebook"
          >
            <Facebook className="w-4 h-4" />
          </Button>
          <Button
            onClick={shareTelegram}
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-sky-50"
            title="Telegram"
          >
            <Send className="w-4 h-4" />
          </Button>
          <Button
            onClick={shareLinkedIn}
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-indigo-50"
            title="LinkedIn"
          >
            <Linkedin className="w-4 h-4" />
          </Button>
        </div>


        {/* Selected Products */}
        {selectedGroups.length === 0 ? (
          <>
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Sem atravessador!
            </h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Os maiores fabricantes do Brasil estão aqui!
            </p>
          </div>
          <FabricantesTrust fabricantes={fabricantes} />
          </>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Comparação de Preços
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedGroups([])}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Todos
              </Button>
            </div>

            {selectedGroups.map((group) => {
              const prices = getGroupPrices(group.id);
              const lowestPrice = prices.length > 0 ? prices[0].price : null;

              return (
                <Card key={group.id} className="bg-white shadow-xl border-0">
                  <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-green-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{group.nome}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{group.categoria}</Badge>
                          <Badge variant="outline">{group.und}</Badge>
                          {group.templates.length > 1 && (
                            <Badge variant="outline">{group.templates.length} pesos</Badge>
                          )}
                          {prices[0]?.perKg && (
                            <Badge variant="outline" className="text-blue-700">preço por kg</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveGroup(group.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {prices.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 p-6">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Nenhum fornecedor disponível para este produto no momento.</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop View - Tabela */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Fornecedor</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Preço</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Contato</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {prices.map((item, index) => (
                                <tr
                                  key={item.supplier.id}
                                  className={`hover:bg-blue-50 transition-colors ${
                                    index === 0 ? 'bg-green-50' : ''
                                  }`}
                                >
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      {item.supplier.logomarca && (
                                        <div className="w-12 h-12 bg-white rounded border flex-shrink-0">
                                          <img
                                            src={item.supplier.logomarca}
                                            alt={item.supplier.empresa}
                                            className="w-full h-full object-contain p-1"
                                          />
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-semibold text-gray-900">
                                          {item.supplier.empresa || item.supplier.full_name}
                                        </p>
                                        {index === 0 && (
                                          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs mt-1">
                                            <Award className="w-3 h-3 mr-1" />
                                            Melhor Preço
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div>
                                      {item.price !== null ? (
                                        <>
                                          <p className="text-2xl font-bold text-gray-900">
                                            R$ {item.price.toFixed(2)}{item.perKg && <span className="text-base font-medium text-gray-500">/kg</span>}
                                          </p>
                                          {lowestPrice && item.price > lowestPrice && (
                                            <div className="flex items-center justify-end gap-1 text-xs text-red-600 mt-1">
                                              <TrendingDown className="w-3 h-3" />
                                              +R$ {(item.price - lowestPrice).toFixed(2)}{item.perKg && '/kg'}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <p className="text-sm font-medium text-blue-600">
                                          Consulte o fornecedor
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="space-y-1 text-sm text-gray-600">
                                      {item.supplier.whatsapp && (
                                        <div className="flex items-center gap-1">
                                          <Phone className="w-3 h-3" />
                                          <span>{item.supplier.whatsapp}</span>
                                        </div>
                                      )}
                                      {item.supplier.email && (
                                        <div className="flex items-center gap-1">
                                          <Mail className="w-3 h-3" />
                                          <span className="truncate max-w-[200px]">{item.supplier.email}</span>
                                        </div>
                                      )}
                                      {item.supplier.site && (
                                        <div className="flex items-center gap-1">
                                          <Globe className="w-3 h-3" />
                                          <a
                                            href={item.supplier.site}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline truncate max-w-[200px]"
                                          >
                                            {item.supplier.site.replace(/https?:\/\//, '')}
                                          </a>
                                        </div>
                                      )}
                                      {item.supplier.endereco && (
                                        <div className="flex items-start gap-1 text-sm text-gray-600">
                                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                          <span className="line-clamp-2">{item.supplier.endereco}</span>
                                        </div>
                                      )}
                                      {item.observacoes && (
                                        <p className="text-sm text-gray-600 line-clamp-2">
                                          <span className="font-semibold">Obs:</span> {item.observacoes}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile View - Cards */}
                        <div className="md:hidden divide-y divide-gray-200">
                          {prices.map((item, index) => (
                            <div
                              key={item.supplier.id}
                              className={`p-4 ${index === 0 ? 'bg-green-50' : ''}`}
                            >
                              {/* Fornecedor */}
                              <div className="flex items-center gap-3 mb-3">
                                {item.supplier.logomarca && (
                                  <div className="w-12 h-12 bg-white rounded border flex-shrink-0">
                                    <img
                                      src={item.supplier.logomarca}
                                      alt={item.supplier.empresa}
                                      className="w-full h-full object-contain p-1"
                                    />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">
                                    {item.supplier.empresa || item.supplier.full_name}
                                  </p>
                                  {index === 0 && (
                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs mt-1">
                                      <Award className="w-3 h-3 mr-1" />
                                      Melhor Preço
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Preço */}
                              <div className="mb-3">
                                {item.price !== null ? (
                                  <>
                                    <p className="text-2xl font-bold text-gray-900">
                                      R$ {item.price.toFixed(2)}{item.perKg && <span className="text-base font-medium text-gray-500">/kg</span>}
                                    </p>
                                    {lowestPrice && item.price > lowestPrice && (
                                      <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                        <TrendingDown className="w-3 h-3" />
                                        +R$ {(item.price - lowestPrice).toFixed(2)}{item.perKg && '/kg'}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-sm font-medium text-blue-600">
                                    Consulte o fornecedor
                                  </p>
                                )}
                              </div>

                              {/* Contato */}
                              <div className="space-y-1 text-sm text-gray-600">
                                {item.supplier.whatsapp && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    <span>{item.supplier.whatsapp}</span>
                                  </div>
                                )}
                                {item.supplier.email && (
                                  <div className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    <span className="truncate">{item.supplier.email}</span>
                                  </div>
                                )}
                                {item.supplier.site && (
                                  <div className="flex items-center gap-1">
                                    <Globe className="w-3 h-3" />
                                    <a
                                      href={item.supplier.site}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline truncate"
                                    >
                                      {item.supplier.site.replace(/https?:\/\//, '')}
                                    </a>
                                  </div>
                                )}
                                {item.supplier.endereco && (
                                  <div className="flex items-start gap-1 text-sm text-gray-600">
                                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2">{item.supplier.endereco}</span>
                                  </div>
                                )}
                                {item.observacoes && (
                                  <p className="text-sm text-gray-600 line-clamp-2">
                                    <span className="font-semibold">Obs:</span> {item.observacoes}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-600">
          <p className="text-sm">
            © 2026 PlaceFit - Marketplace de Equipamentos Fitness
          </p>
          <p className="text-xs mt-2">
            Compare preços e encontre os melhores fornecedores
          </p>
        </div>
      </div>
    </div>
  );
}