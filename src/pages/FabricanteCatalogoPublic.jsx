import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getAllProducts } from "@/functions/getAllProducts";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Globe,
  Package,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const PLACEFIT_LOGO = "https://media.base44.com/images/public/68c9d5dd3cf0f8fd8a834875/574e5a0a6-logo-ico-removebg-preview1.png";

export default function FabricanteCatalogoPublic() {
  const { id } = useParams();
  const [fabricante, setFabricante] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getAllProducts({}).then(r => r.data).catch(() => ({ products: [], fabricantes: [], supplierProducts: [] }));

      const allFabricantes = result.fabricantes || [];
      const fab = allFabricantes.find(f => f.id === id);

      if (!fab) {
        setFabricante(null);
        setLoading(false);
        return;
      }

      const supplierProds = (result.supplierProducts || []).filter(
        sp => sp.supplier_id === id || sp.fabricante_id === id
      );
      const tplIds = new Set(supplierProds.map(sp => sp.product_id));
      const fabProducts = (result.products || []).filter(p => tplIds.has(p.id));

      // attach price
      const withPrice = fabProducts.map(p => {
        const sp = supplierProds.find(s => s.product_id === p.id);
        return { ...p, preco: sp?.preco };
      });

      setFabricante(fab);
      setProducts(withPrice);
    } catch (error) {
      console.error("Erro ao carregar catálogo do fabricante:", error);
    }
    setLoading(false);
  };

  const nome = fabricante?.empresa || fabricante?.full_name || "Fabricante";

  const categorias = ["Todas", ...Array.from(new Set(products.map(p => p.categoria).filter(Boolean)))];

  const filtered = products.filter(p => {
    const matchCat = categoriaFiltro === "Todas" || p.categoria === categoriaFiltro;
    const matchSearch = !searchTerm ||
      (p.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.cod || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <img src={PLACEFIT_LOGO} alt="PlaceFit" className="w-16 h-16 mx-auto object-contain animate-pulse" />
          <div className="animate-pulse text-gray-600">Carregando catálogo...</div>
        </div>
      </div>
    );
  }

  if (!fabricante) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <img src={PLACEFIT_LOGO} alt="PlaceFit" className="w-16 h-16 mx-auto object-contain" />
          <h2 className="text-2xl font-bold text-gray-900">Fabricante não encontrado</h2>
          <Link to="/Marketplace">
            <Button className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Marketplace
            </Button>
          </Link>
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
            <Link to="/Marketplace" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={PLACEFIT_LOGO} alt="PlaceFit" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  PlaceFit
                </h1>
                <p className="text-sm text-gray-600">Catálogo do Fabricante</p>
              </div>
            </Link>
            <Link to="/Marketplace">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Fabricante info */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-24 h-24 flex items-center justify-center bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
              {fabricante.logomarca ? (
                <img src={fabricante.logomarca} alt={nome} className="w-full h-full object-contain p-2" />
              ) : (
                <span className="text-4xl font-bold text-blue-600">{nome[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900">{nome}</h2>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
                {(fabricante.cidade || fabricante.estado) && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {[fabricante.cidade, fabricante.estado].filter(Boolean).join(' - ')}
                  </div>
                )}
                {fabricante.whatsapp && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {fabricante.whatsapp}
                  </div>
                )}
                {fabricante.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {fabricante.email}
                  </div>
                )}
                {fabricante.site && (
                  <a href={fabricante.site} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                    <Globe className="w-4 h-4" />
                    {fabricante.site.replace(/https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{products.length}</p>
              <p className="text-sm text-gray-500">produtos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros + Lista */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-300 flex flex-col">
                <div className="w-full h-40 bg-gray-50 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                  {p.foto ? (
                    <img src={p.foto} alt={p.nome} className="w-full h-full object-contain" />
                  ) : (
                    <Package className="w-12 h-12 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight mb-2">{p.nome}</h3>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {p.cod && <Badge variant="outline" className="text-xs">{p.cod}</Badge>}
                    {p.categoria && <Badge variant="secondary" className="text-xs">{p.categoria}</Badge>}
                    {p.peso && <Badge variant="outline" className="text-xs">{p.peso} kg</Badge>}
                  </div>
                </div>
                {p.preco != null && parseFloat(p.preco) > 0 && (
                  <p className="text-xl font-bold text-gray-900">
                    R$ {parseFloat(p.preco).toFixed(2)}
                    <span className="text-xs font-normal text-gray-500"> / {p.und}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-600">
          <p className="text-sm">© 2026 PlaceFit - Marketplace de Equipamentos Fitness</p>
        </div>
      </div>
    </div>
  );
}