import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit3, Trash2, Package, ImageIcon, Download, Users, SlidersHorizontal, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import TemplateForm from "@/components/admin/TemplateForm";

const CATEGORIAS = [
  "Anilhas",
  "Halteres",
  "Dumbells",
  "Barras Montadas",
  "Tijolinhos",
  "Pisos",
  "Kettlebells",
  "Suportes",
  "Outros",
];

const ATTRIBUTE_FIELDS = [
  { field: "subcategoria", label: "Subcategoria" },
  { field: "acabamento", label: "Acabamento" },
  { field: "tipo_furo", label: "Tipo de Furo" },
  { field: "peso_kg", label: "Peso (kg)" },
  { field: "barra_tipo", label: "Tipo de Barra" },
  { field: "barra_acabamento", label: "Acabamento da Barra" },
  { field: "bojo_formato", label: "Formato do Bojo" },
  { field: "dumbell_tipo", label: "Tipo de Dumbell" },
  { field: "piso_espessura_mm", label: "Espessura (mm)" },
  { field: "piso_formato", label: "Formato do Piso" },
  { field: "tijolinho_tipo", label: "Tipo de Tijolinho" },
  { field: "tijolinho_torre", label: "Torre Compatível" },
  { field: "suporte_capacidade_pares", label: "Capacidade (pares)" },
  { field: "suporte_capacidade_unidades", label: "Capacidade (unid.)" },
  { field: "suporte_modelo", label: "Modelo" },
  { field: "suporte_estrutura", label: "Estrutura" },
  { field: "suporte_degraus", label: "Degraus" },
  { field: "suporte_torre_capacidade", label: "Capacidade Torre" },
  { field: "suporte_torre_tipo", label: "Tipo de Torre" },
  { field: "und", label: "Unidade" },
];

export default function Products() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedFabricante, setSelectedFabricante] = useState("all");
  const [attributeFilters, setAttributeFilters] = useState({});
  const [onlyWithPrices, setOnlyWithPrices] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { toast } = useToast();

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const loadData = async () => {
    try {
      const [templatesData, spData, fabricantesRes] = await Promise.all([
        base44.entities.ProductTemplate.list("-updated_date"),
        base44.entities.SupplierProduct.list(),
        base44.functions.invoke("getFabricanteNames", {}),
      ]);
      setTemplates(templatesData);
      setSupplierProducts(spData);
      const supplierIds = [...new Set(spData.map((sp) => sp.supplier_id))];
      const allFabricantes = (fabricantesRes?.data?.fabricantes || []).filter((f) =>
        supplierIds.includes(f.id)
      );
      setFabricantes(allFabricantes);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const getSupplierCount = (templateId) =>
    supplierProducts.filter((sp) => sp.product_id === templateId).length;

  const getSupplierIdsForTemplate = (templateId) =>
    supplierProducts.filter((sp) => sp.product_id === templateId).map((sp) => sp.supplier_id);

  const availableAttributes = useMemo(() => {
    if (selectedCategory === "all") return [];
    const categoryTemplates = templates.filter((t) => t.categoria === selectedCategory);
    return ATTRIBUTE_FIELDS.filter((attr) => {
      const values = categoryTemplates
        .map((t) => t[attr.field])
        .filter((v) => v !== undefined && v !== null && v !== "" && v !== "N/A");
      return values.length > 0;
    }).map((attr) => {
      const values = [...new Set(
        categoryTemplates
          .map((t) => t[attr.field])
          .filter((v) => v !== undefined && v !== null && v !== "" && v !== "N/A")
          .map((v) => String(v))
      )].sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
      return { ...attr, values };
    });
  }, [templates, selectedCategory]);

  const filterTemplates = useCallback(() => {
    let filtered = templates;
    if (selectedCategory !== "all") {
      filtered = filtered.filter((t) => t.categoria === selectedCategory);
    }
    if (selectedFabricante !== "all") {
      filtered = filtered.filter((t) =>
        getSupplierIdsForTemplate(t.id).includes(selectedFabricante)
      );
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.nome?.toLowerCase().includes(term) ||
          t.cod?.toLowerCase().includes(term)
      );
    }
    for (const [field, value] of Object.entries(attributeFilters)) {
      if (value) {
        filtered = filtered.filter((t) => String(t[field]) === value);
      }
    }
    if (onlyWithPrices) {
      filtered = filtered.filter((t) => getSupplierCount(t.id) > 0);
    }
    setFilteredTemplates(filtered);
  }, [templates, searchTerm, selectedCategory, selectedFabricante, attributeFilters, onlyWithPrices, supplierProducts]);

  useEffect(() => {
    filterTemplates();
  }, [filterTemplates]);

  const handleAttributeFilterChange = (field, value) => {
    setAttributeFilters((prev) => {
      const next = { ...prev };
      if (value && value !== "all") {
        next[field] = value;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const clearAttributeFilters = () => {
    setAttributeFilters({});
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setShowDialog(true);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setShowDialog(true);
  };

  const handleDelete = async (template) => {
    if (confirm(`Tem certeza que deseja excluir "${template.nome}"?`)) {
      try {
        await base44.entities.ProductTemplate.delete(template.id);
        loadData();
        toast({ title: "Template excluído", description: `${template.nome} foi removido.` });
      } catch (error) {
        toast({ title: "Erro", description: "Erro ao excluir template.", variant: "destructive" });
      }
    }
  };

  const handleSave = async (data) => {
    if (editingTemplate) {
      await base44.entities.ProductTemplate.update(editingTemplate.id, data);
      toast({ title: "Template atualizado!", description: "Alterações salvas com sucesso." });
    } else {
      await base44.entities.ProductTemplate.create(data);
      toast({ title: "Template criado!", description: "Novo template adicionado ao catálogo." });
    }
    setShowDialog(false);
    setEditingTemplate(null);
    loadData();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      toast({ title: "Foto enviada!" });
      return file_url;
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao enviar foto.", variant: "destructive" });
    }
    setUploadingPhoto(false);
  };

  const handleExport = () => {
    if (filteredTemplates.length === 0) {
      toast({ title: "Nenhum produto", description: "Não há produtos para exportar.", variant: "destructive" });
      return;
    }
    const rows = filteredTemplates.map((t) => {
      const sps = supplierProducts.filter((sp) => sp.product_id === t.id);
      const prices = sps.map((sp) => sp.preco).filter(Boolean);
      const minPrice = prices.length > 0 ? Math.min(...prices).toFixed(2) : "";
      const maxPrice = prices.length > 0 ? Math.max(...prices).toFixed(2) : "";

      const atributos = [];
      if (t.subcategoria) atributos.push(`Sub: ${t.subcategoria}`);
      if (t.acabamento && t.acabamento !== "N/A") atributos.push(`Acab: ${t.acabamento}`);
      if (t.peso_kg) atributos.push(`${t.peso_kg}kg`);
      if (t.tipo_furo && t.tipo_furo !== "N/A") atributos.push(`Furo: ${t.tipo_furo}`);
      if (t.bojo_formato && t.bojo_formato !== "N/A") atributos.push(`Bojo: ${t.bojo_formato}`);
      if (t.barra_tipo && t.barra_tipo !== "N/A") atributos.push(`Barra: ${t.barra_tipo}`);
      if (t.dumbell_tipo && t.dumbell_tipo !== "N/A") atributos.push(`Dumbell: ${t.dumbell_tipo}`);
      if (t.piso_espessura_mm) atributos.push(`Esp: ${t.piso_espessura_mm}mm`);

      return {
        "Código": t.cod || "",
        "Nome": t.nome || "",
        "Categoria": t.categoria || "",
        "Atributos": atributos.join("; "),
        "Unidade": t.und || "",
        "Fornecedores": sps.length,
        "Preço Mín (R$)": minPrice,
        "Preço Máx (R$)": maxPrice,
      };
    });

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) =>
        headers.map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `catalogo_placefit_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast({ title: "Lista exportada!", description: `${rows.length} produtos exportados.` });
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("all");
    setSelectedFabricante("all");
    setAttributeFilters({});
    setOnlyWithPrices(false);
  };

  const hasActiveFilters =
    searchTerm || selectedCategory !== "all" || selectedFabricante !== "all" ||
    Object.keys(attributeFilters).length > 0 || onlyWithPrices;

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categoryStats = {};
  CATEGORIAS.forEach((cat) => {
    categoryStats[cat] = templates.filter((t) => t.categoria === cat).length;
  });
  const totalSuppliers = new Set(supplierProducts.map((sp) => sp.supplier_id)).size;

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Catálogo Padronizado</h1>
            <p className="text-gray-600">
              {isAdmin ? "Gerencie os templates de produtos da PlaceFit" : "Consulte o catálogo de produtos e fornecedores"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Lista
            </Button>
            {isAdmin && (
              <Button
                onClick={handleNew}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{templates.length}</div>
              <p className="text-sm text-blue-700">Templates</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{totalSuppliers}</div>
              <p className="text-sm text-green-700">Fornecedores</p>
            </CardContent>
          </Card>
          <Card
            className={`bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border cursor-pointer transition-all ${onlyWithPrices ? "ring-2 ring-purple-400" : ""}`}
            onClick={() => setOnlyWithPrices(!onlyWithPrices)}
          >
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{supplierProducts.length}</div>
              <p className="text-sm text-purple-700">
                Preços Vinculados {onlyWithPrices ? "✓" : "(clique p/ filtrar)"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-amber-900">{CATEGORIAS.length}</div>
              <p className="text-sm text-amber-700">Categorias</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros principais */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setAttributeFilters({}); }}>
            <SelectTrigger className="w-full md:w-56 bg-white/80">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIAS.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat} ({categoryStats[cat] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedFabricante} onValueChange={setSelectedFabricante}>
            <SelectTrigger className="w-full md:w-56 bg-white/80">
              <SelectValue placeholder="Todos os fabricantes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fabricantes</SelectItem>
              {fabricantes.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableAttributes.length > 0 && (
            <Button
              variant={showAdvancedFilters ? "default" : "outline"}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="whitespace-nowrap"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Atributos {Object.keys(attributeFilters).length > 0 && `(${Object.keys(attributeFilters).length})`}
            </Button>
          )}
        </div>

        {/* Filtros de atributos inteligentes */}
        {showAdvancedFilters && availableAttributes.length > 0 && (
          <Card className="bg-white/80 border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">
                  Atributos de {selectedCategory}
                </p>
                {Object.keys(attributeFilters).length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAttributeFilters} className="text-xs h-7">
                    <X className="w-3 h-3 mr-1" /> Limpar atributos
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {availableAttributes.map((attr) => (
                  <Select
                    key={attr.field}
                    value={attributeFilters[attr.field] || "all"}
                    onValueChange={(v) => handleAttributeFilterChange(attr.field, v)}
                  >
                    <SelectTrigger className="bg-white text-sm">
                      <SelectValue placeholder={attr.label} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{attr.label}: Todos</SelectItem>
                      {attr.values.map((val) => (
                        <SelectItem key={val} value={val}>{val}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumo de filtros ativos */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{filteredTemplates.length} produto(s) encontrado(s)</span>
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs text-gray-500 h-7">
              Limpar filtros
            </Button>
          </div>
        )}

        {/* Tabela - Desktop */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-800">
                    <TableHead className="text-white font-semibold">Foto</TableHead>
                    <TableHead className="text-white font-semibold">Código</TableHead>
                    <TableHead className="text-white font-semibold">Nome</TableHead>
                    <TableHead className="text-white font-semibold">Categoria</TableHead>
                    <TableHead className="text-white font-semibold">Atributos</TableHead>
                    <TableHead className="text-white font-semibold text-center">Fornecedores</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ativo</TableHead>
                    {isAdmin && <TableHead className="text-white font-semibold text-center">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map((template, index) => {
                    const supplierCount = getSupplierCount(template.id);
                    const atributos = [];
                    if (template.subcategoria) atributos.push(template.subcategoria);
                    if (template.acabamento && template.acabamento !== "N/A") atributos.push(template.acabamento);
                    if (template.peso_kg) atributos.push(`${template.peso_kg}kg`);
                    if (template.tipo_furo && template.tipo_furo !== "N/A") atributos.push(template.tipo_furo);
                    if (template.bojo_formato && template.bojo_formato !== "N/A") atributos.push(template.bojo_formato);
                    return (
                      <TableRow key={template.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <TableCell>
                          <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden">
                            {template.foto ? (
                              <img src={template.foto} alt={template.nome} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex items-center justify-center w-full h-full text-gray-400">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">{template.cod}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[250px] truncate">{template.nome}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{template.categoria}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">
                          {atributos.join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={supplierCount > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                            {supplierCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={template.ativo !== false} disabled className="scale-75" />
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(template)} className="h-7 w-7 p-0">
                                <Edit3 className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(template)} className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-700">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum template encontrado</h3>
                <p className="text-gray-600">Tente ajustar os filtros ou crie um novo template.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cards - Mobile */}
        <div className="md:hidden space-y-2">
          {filteredTemplates.map((template) => {
            const supplierCount = getSupplierCount(template.id);
            return (
              <Card key={template.id} className="bg-white shadow-sm">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                      {template.foto ? (
                        <img src={template.foto} alt={template.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-gray-400">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{template.nome}</h3>
                      <p className="text-xs text-gray-500 font-mono">{template.cod}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="secondary" className="text-xs">{template.categoria}</Badge>
                        <Badge className={supplierCount > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                          {supplierCount} forn.
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)} className="flex-1 h-7 text-xs">
                        <Edit3 className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(template)} className="flex-1 h-7 text-xs text-red-600">
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingTemplate(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <TemplateForm
            open={showDialog}
            editingTemplate={editingTemplate}
            onSave={handleSave}
            onClose={() => { setShowDialog(false); setEditingTemplate(null); }}
            uploadingPhoto={uploadingPhoto}
            onPhotoUpload={handlePhotoUpload}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}