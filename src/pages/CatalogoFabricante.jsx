import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Search, Pencil, CheckCircle, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PrecoModal from "@/components/catalogo-fabricante/PrecoModal";

export default function CatalogoFabricante() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("all");
  const [subcategoria, setSubcategoria] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [allTemplates, myPrices, categoryData] = await Promise.all([
        base44.entities.ProductTemplate.filter({ ativo: true }),
        base44.entities.SupplierProduct.filter({ supplier_id: currentUser.id }),
        base44.entities.Category.filter({ ativo: true }),
      ]);

      const sortedCats = categoryData
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map((c) => c.nome);
      setCategorias(sortedCats);
      setTemplates(allTemplates);
      setSupplierProducts(myPrices);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const getPriceForProduct = (productId) => {
    return supplierProducts.find((sp) => sp.product_id === productId);
  };

  const getSubcategoryField = (cat) => {
    const fieldMap = {
      Anilhas: "acabamento",
      Halteres: "acabamento",
      Dumbells: "dumbell_tipo",
      "Barras Montadas": "barra_tipo",
      Tijolinhos: "tijolinho_tipo",
      Pisos: "piso_formato",
      Kettlebells: "acabamento",
      Suportes: "subcategoria",
    };
    return fieldMap[cat] || "subcategoria";
  };

  const getSubcategories = (cat) => {
    if (!cat || cat === "all") return [];
    const field = getSubcategoryField(cat);
    const subs = [
      ...new Set(
        templates
          .filter((t) => t.categoria === cat && getPriceForProduct(t.id)) // Filtrar por produtos configurados
          .map((t) => t[field])
          .filter(Boolean)
      ),
    ];
    return subs.sort();
  };

  const subcategories = getSubcategories(categoria);
  const subField = getSubcategoryField(categoria);

  const filteredProducts = templates
    .filter((p) => getPriceForProduct(p.id)) // Mostrar APENAS produtos já configurados
    .filter((p) => {
      if (categoria !== "all" && p.categoria !== categoria) return false;
      if (subcategoria !== "all" && p[subField] !== subcategoria) return false;
      if (search) {
        const term = search.toLowerCase();
        return (
          p.nome?.toLowerCase().includes(term) ||
          p.cod?.toLowerCase().includes(term)
        );
      }
      return true;
    });

  const productsWithPrice = filteredProducts.length;
  const totalProducts = filteredProducts.length;

  const formatBRL = (val) =>
    parseFloat(val).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const handleOpenModal = (product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const handleSave = async ({ preco, observacoes, disponivel }) => {
    const existing = getPriceForProduct(selectedProduct.id);
    try {
      if (existing) {
        await base44.entities.SupplierProduct.update(existing.id, {
          preco,
          observacoes,
          disponivel,
        });
      } else {
        await base44.entities.SupplierProduct.create({
          supplier_id: user.id,
          product_id: selectedProduct.id,
          preco,
          observacoes,
          disponivel,
        });
      }
      await loadData();
      setModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar preço: " + error.message);
    }
  };

  const handleExport = () => {
    const rows = filteredProducts.map((p) => {
      const sp = getPriceForProduct(p.id); // Sempre vai ter, pois filteredProducts só tem configurados
      return {
        "Código": p.cod || "",
        "Nome": p.nome || "",
        "Categoria": p.categoria || "",
        "Detalhes": renderTemplateDetails(p),
        "Preço (R$)": sp?.preco ? parseFloat(sp.preco).toFixed(2) : "",
        "Disponível": sp ? (sp.disponivel !== false ? "SIM" : "NÃO") : "SIM",
      };
    });
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `catalogo_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const renderTemplateDetails = (p) => {
    const details = [];
    details.push(p.categoria);
    if (p.subcategoria) details.push(p.subcategoria);
    if (p.acabamento && p.acabamento !== "N/A") details.push(p.acabamento);
    if (p.peso_kg) details.push(`${p.peso_kg}kg`);
    if (p.tipo_furo && p.tipo_furo !== "N/A") details.push(p.tipo_furo);
    if (p.bojo_formato && p.bojo_formato !== "N/A") details.push(p.bojo_formato);
    if (p.und) details.push(p.und);
    return details.join(" · ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus Produtos / Catálogo</h1>
          <p className="text-sm text-gray-500">
            Vincule seus preços aos produtos do catálogo padronizado
          </p>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50"
        >
          <Download className="w-4 h-4" />
          <span className="hidden md:inline">Exportar</span>
        </Button>
      </div>

      {/* Counter */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
        <p className="text-sm text-gray-700">
          <span className="text-2xl font-bold text-blue-700">
            {productsWithPrice}
          </span>
          <span className="text-gray-500"> de </span>
          <span className="text-lg font-semibold text-gray-700">
            {totalProducts}
          </span>
          <span className="text-gray-500"> produtos com preço cadastrado</span>
        </p>
      </Card>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select
          value={categoria}
          onValueChange={(v) => {
            setCategoria(v);
            setSubcategoria("all");
          }}
        >
          <SelectTrigger className="md:w-56">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {subcategories.length > 0 && (
          <Select value={subcategoria} onValueChange={setSubcategoria}>
            <SelectTrigger className="md:w-56">
              <SelectValue placeholder="Subcategoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as subcategorias</SelectItem>
              {subcategories.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Product list */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2" />
          <p>Nenhum produto encontrado</p>
        </div>
      ) : (
        <Card className="overflow-hidden border border-gray-200">
          <div className="hidden md:grid grid-cols-[48px_90px_1fr_200px_120px_140px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase">
            <span></span>
            <span>Código</span>
            <span>Produto</span>
            <span>Detalhes</span>
            <span className="text-right">Preço</span>
            <span className="text-center">Ação</span>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredProducts.map((product) => {
              const sp = getPriceForProduct(product.id);
              const hasPrice = !!sp;
              return (
                <div
                  key={product.id}
                  className={`grid grid-cols-1 md:grid-cols-[48px_90px_1fr_200px_120px_140px] gap-3 px-4 py-3 items-center transition-colors hover:bg-blue-50/30 ${
                    hasPrice ? "bg-green-50/20" : ""
                  }`}
                >
                  <div className="hidden md:block">
                    {product.foto ? (
                      <img
                        src={product.foto}
                        alt={product.nome}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="md:text-xs text-sm font-mono text-gray-500 break-all">
                      {product.cod}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="md:hidden">
                      {product.foto ? (
                        <img
                          src={product.foto}
                          alt={product.nome}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm text-gray-900 truncate">
                        {product.nome}
                      </h3>
                      <p className="md:hidden text-xs text-gray-400">
                        {renderTemplateDetails(product)}
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs text-gray-500 truncate">
                      {renderTemplateDetails(product)}
                    </p>
                  </div>
                  <div className="md:text-right">
                    {hasPrice ? (
                      <Badge className="bg-green-100 text-green-700 border-green-300 inline-flex items-center gap-1 whitespace-nowrap">
                        <CheckCircle className="w-3 h-3" /> {formatBRL(sp.preco)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                  <div className="md:text-center">
                    <Button
                      variant={hasPrice ? "outline" : "default"}
                      size="sm"
                      className="w-full md:w-auto"
                      onClick={() => handleOpenModal(product)}
                    >
                      {hasPrice ? (
                        <>
                          <Pencil className="w-3 h-3 mr-1" /> Editar
                        </>
                      ) : (
                        <>+ Preço</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <PrecoModal
        open={modalOpen}
        product={selectedProduct}
        existingPrice={
          selectedProduct ? getPriceForProduct(selectedProduct.id) : null
        }
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}