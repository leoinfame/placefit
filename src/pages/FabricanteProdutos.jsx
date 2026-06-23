import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Search, Pencil, CheckCircle, Upload, Download } from "lucide-react";
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
import UploadTabela from "@/components/catalogo-fabricante/UploadTabela";

const CATEGORIAS = [
  "Anilhas",
  "Halteres",
  "Dumbells",
  "Barras Montadas",
  "Tijolinhos",
  "Pisos",
  "Kettlebells",
  "Suportes",
];

export default function FabricanteProdutos() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser.role !== "admin" && currentUser.tipo_usuario !== "fabricante") {
        window.location.href = "/Dashboard";
        return;
      }
      setUser(currentUser);

      const [allTemplates, myPrices] = await Promise.all([
        base44.entities.ProductTemplate.filter({ ativo: true }),
        base44.entities.SupplierProduct.filter({ supplier_id: currentUser.id }),
      ]);

      setTemplates(allTemplates);
      setSupplierProducts(myPrices);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const getPriceForProduct = (productId) =>
    supplierProducts.find((sp) => sp.product_id === productId);

  const filteredProducts = templates.filter((p) => {
    if (categoria !== "all" && p.categoria !== categoria) return false;
    if (search) {
      const term = search.toLowerCase();
      return (
        p.nome?.toLowerCase().includes(term) ||
        p.cod?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const productsWithPrice = filteredProducts.filter((p) =>
    getPriceForProduct(p.id)
  ).length;

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
      const sp = getPriceForProduct(p.id);
      return {
        "Código": p.cod || "",
        "Nome": p.nome || "",
        "Categoria": p.categoria || "",
        "Detalhes": renderTemplateDetails(p),
        "Preço (R$)": sp?.preco ? parseFloat(sp.preco).toFixed(2) : "",
        "Disponível": sp ? (sp.disponivel !== false ? "SIM" : "NÃO") : "NÃO",
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
    link.download = `meus_produtos_${new Date().toISOString().split("T")[0]}.csv`;
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
          <h1 className="text-2xl font-bold text-gray-900">Meus Produtos</h1>
          <p className="text-sm text-gray-500">
            Selecione produtos do catálogo padronizado e defina seus preços
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExport}
            variant="outline"
            className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Exportar</span>
          </Button>
          <Button
            onClick={() => setUploadOpen(true)}
            variant="outline"
            className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden md:inline">Upload de Tabela</span>
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
        <p className="text-sm text-gray-700">
          <span className="text-2xl font-bold text-blue-700">
            {productsWithPrice}
          </span>
          <span className="text-gray-500"> de </span>
          <span className="text-lg font-semibold text-gray-700">
            {filteredProducts.length}
          </span>
          <span className="text-gray-500"> produtos com preço cadastrado</span>
        </p>
      </Card>

      <div className="flex flex-col md:flex-row gap-4">
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="md:w-64">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2" />
          <p>Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const sp = getPriceForProduct(product.id);
            const hasPrice = !!sp;
            return (
              <Card
                key={product.id}
                className={`p-4 ${
                  hasPrice
                    ? "border-green-300 bg-green-50/30"
                    : "border-gray-200"
                }`}
              >
                <div className="flex gap-3">
                  {product.foto ? (
                    <img
                      src={product.foto}
                      alt={product.nome}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {product.nome}
                      </h3>
                      {hasPrice && (
                        <Badge className="bg-green-100 text-green-700 border-green-300 flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle className="w-3 h-3" /> {formatBRL(sp.preco)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">SKU: {product.cod}</p>
                    <p className="text-xs text-gray-500">
                      {renderTemplateDetails(product)}
                    </p>
                  </div>
                </div>
                <Button
                  variant={hasPrice ? "outline" : "default"}
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => handleOpenModal(product)}
                >
                  {hasPrice ? (
                    <>
                      <Pencil className="w-3 h-3 mr-1" /> Editar preço
                    </>
                  ) : (
                    <>Adicionar meu preço</>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
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

      <UploadTabela
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={loadData}
      />
    </div>
  );
}