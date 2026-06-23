import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit3, Trash2, Package, ImageIcon, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

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

const UNIDADES = ["peça", "par", "kg", "m²", "kit"];

const TIPOS_FURO = ["Normal (Furo Pequeno)", "Olímpico (Furo 50mm)", "N/A"];
const ACABAMENTOS = ["Bruto", "Pintado", "Emborrachado", "Injetado", "Bâmper", "Cromado", "N/A"];
const BOJO_FORMATOS = ["Sextavado (Hexagonal)", "Bola", "Redondo", "N/A"];
const BARRA_TIPOS = ["Reta", "W (Curvada)", "N/A"];
const BARRA_ACABAMENTOS = ["Cromado Recartilhado", "Pintado", "Injetado", "N/A"];
const DUMBELL_TIPOS = ["Monobloco", "Anilhas Montadas", "N/A"];

export default function Products() {
  const [user, setUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cod: "",
    categoria: "",
    und: "",
    subcategoria: "",
    acabamento: "N/A",
    peso_kg: "",
    tipo_furo: "N/A",
    bojo_formato: "N/A",
    barra_tipo: "N/A",
    barra_acabamento: "N/A",
    dumbell_tipo: "N/A",
    peso_fracionado: false,
    piso_espessura_mm: "",
    piso_formato: "N/A",
    tijolinho_tipo: "N/A",
    tijolinho_torre: "N/A",
    suporte_capacidade_pares: "",
    suporte_capacidade_unidades: "",
    suporte_modelo: "N/A",
    suporte_estrutura: "N/A",
    suporte_degraus: "",
    suporte_torre_capacidade: "N/A",
    suporte_torre_tipo: "N/A",
    foto: "",
    google_category: "Sporting Goods > Exercise & Fitness",
    ncm: "9506.91.00",
    gtin: "",
    descricao_padrao: "",
    ativo: true,
  });

  const { toast } = useToast();

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const filterTemplates = useCallback(() => {
    let filtered = templates;
    if (selectedCategory !== "all") {
      filtered = filtered.filter((t) => t.categoria === selectedCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.nome?.toLowerCase().includes(term) ||
          t.cod?.toLowerCase().includes(term)
      );
    }
    setFilteredTemplates(filtered);
  }, [templates, searchTerm, selectedCategory]);

  useEffect(() => {
    filterTemplates();
  }, [filterTemplates]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser.role !== "admin") {
        window.location.href = "/Dashboard";
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const loadData = async () => {
    try {
      const [templatesData, spData] = await Promise.all([
        base44.entities.ProductTemplate.list("-updated_date"),
        base44.entities.SupplierProduct.list(),
      ]);
      setTemplates(templatesData);
      setSupplierProducts(spData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const getSupplierCount = (templateId) =>
    supplierProducts.filter((sp) => sp.product_id === templateId).length;

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      nome: template.nome || "",
      cod: template.cod || "",
      categoria: template.categoria || "",
      und: template.und || "",
      subcategoria: template.subcategoria || "",
      acabamento: template.acabamento || "N/A",
      peso_kg: template.peso_kg || "",
      tipo_furo: template.tipo_furo || "N/A",
      bojo_formato: template.bojo_formato || "N/A",
      barra_tipo: template.barra_tipo || "N/A",
      barra_acabamento: template.barra_acabamento || "N/A",
      dumbell_tipo: template.dumbell_tipo || "N/A",
      peso_fracionado: template.peso_fracionado || false,
      piso_espessura_mm: template.piso_espessura_mm || "",
      piso_formato: template.piso_formato || "N/A",
      tijolinho_tipo: template.tijolinho_tipo || "N/A",
      tijolinho_torre: template.tijolinho_torre || "N/A",
      suporte_capacidade_pares: template.suporte_capacidade_pares || "",
      suporte_capacidade_unidades: template.suporte_capacidade_unidades || "",
      suporte_modelo: template.suporte_modelo || "N/A",
      suporte_estrutura: template.suporte_estrutura || "N/A",
      suporte_degraus: template.suporte_degraus || "",
      suporte_torre_capacidade: template.suporte_torre_capacidade || "N/A",
      suporte_torre_tipo: template.suporte_torre_tipo || "N/A",
      foto: template.foto || "",
      google_category: template.google_category || "Sporting Goods > Exercise & Fitness",
      ncm: template.ncm || "9506.91.00",
      gtin: template.gtin || "",
      descricao_padrao: template.descricao_padrao || "",
      ativo: template.ativo !== false,
    });
    setShowDialog(true);
  };

  const handleDelete = async (template) => {
    if (confirm(`Tem certeza que deseja excluir "${template.nome}"?`)) {
      try {
        await base44.entities.ProductTemplate.delete(template.id);
        loadData();
        toast({ title: "Template excluído", description: `${template.nome} foi removido.` });
      } catch (error) {
        console.error("Erro ao excluir:", error);
        toast({ title: "Erro", description: "Erro ao excluir template.", variant: "destructive" });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      // Converter campos numéricos vazios para null
      ["peso_kg", "piso_espessura_mm", "suporte_capacidade_pares", "suporte_capacidade_unidades", "suporte_degraus"].forEach(
        (field) => {
          if (data[field] === "" || data[field] === null) {
            data[field] = null;
          } else {
            data[field] = parseFloat(data[field]);
          }
        }
      );

      if (editingTemplate) {
        await base44.entities.ProductTemplate.update(editingTemplate.id, data);
        toast({ title: "Template atualizado!", description: "Alterações salvas com sucesso." });
      } else {
        await base44.entities.ProductTemplate.create(data);
        toast({ title: "Template criado!", description: "Novo template adicionado ao catálogo." });
      }
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({ title: "Erro", description: "Erro ao salvar template.", variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, foto: file_url });
      toast({ title: "Foto enviada!" });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao enviar foto.", variant: "destructive" });
    }
    setUploadingPhoto(false);
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      cod: "",
      categoria: "",
      und: "",
      subcategoria: "",
      acabamento: "N/A",
      peso_kg: "",
      tipo_furo: "N/A",
      bojo_formato: "N/A",
      barra_tipo: "N/A",
      barra_acabamento: "N/A",
      dumbell_tipo: "N/A",
      peso_fracionado: false,
      piso_espessura_mm: "",
      piso_formato: "N/A",
      tijolinho_tipo: "N/A",
      tijolinho_torre: "N/A",
      suporte_capacidade_pares: "",
      suporte_capacidade_unidades: "",
      suporte_modelo: "N/A",
      suporte_estrutura: "N/A",
      suporte_degraus: "",
      suporte_torre_capacidade: "N/A",
      suporte_torre_tipo: "N/A",
      foto: "",
      google_category: "Sporting Goods > Exercise & Fitness",
      ncm: "9506.91.00",
      gtin: "",
      descricao_padrao: "",
      ativo: true,
    });
    setEditingTemplate(null);
  };

  const getCategoryStats = () => {
    const stats = {};
    CATEGORIAS.forEach((cat) => {
      stats[cat] = templates.filter((t) => t.categoria === cat).length;
    });
    return stats;
  };

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

  const categoryStats = getCategoryStats();
  const totalSuppliers = new Set(supplierProducts.map((sp) => sp.supplier_id)).size;

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Catálogo Padronizado</h1>
            <p className="text-gray-600">Gerencie os templates de produtos da PlaceFit</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
        </div>

        {/* Stats */}
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
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{supplierProducts.length}</div>
              <p className="text-sm text-purple-700">Preços Vinculados</p>
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

        {/* Filtros */}
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
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
        </div>

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
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
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
                  <div className="flex gap-2 mt-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(template)} className="flex-1 h-7 text-xs">
                      <Edit3 className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(template)} className="flex-1 h-7 text-xs text-red-600">
                      <Trash2 className="w-3 h-3 mr-1" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Dialog de Template */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
              </div>
              <div>
                <Label>Código (SKU) *</Label>
                <Input value={formData.cod} onChange={(e) => setFormData({ ...formData, cod: e.target.value })} required placeholder="ex: ANI-OLI-EMB-010" />
              </div>
              <div>
                <Label>Categoria *</Label>
                <Select value={formData.categoria} onValueChange={(v) => setFormData({ ...formData, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade *</Label>
                <Select value={formData.und} onValueChange={(v) => setFormData({ ...formData, und: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subcategoria</Label>
                <Input value={formData.subcategoria} onChange={(e) => setFormData({ ...formData, subcategoria: e.target.value })} placeholder="ex: Suporte para Halteres" />
              </div>
              <div>
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.01" value={formData.peso_kg || ""} onChange={(e) => setFormData({ ...formData, peso_kg: e.target.value })} />
              </div>
              <div>
                <Label>Acabamento</Label>
                <Select value={formData.acabamento} onValueChange={(v) => setFormData({ ...formData, acabamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACABAMENTOS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Furo (Anilhas)</Label>
                <Select value={formData.tipo_furo} onValueChange={(v) => setFormData({ ...formData, tipo_furo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_FURO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bojo (Halteres/Dumbells)</Label>
                <Select value={formData.bojo_formato} onValueChange={(v) => setFormData({ ...formData, bojo_formato: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOJO_FORMATOS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Barra</Label>
                <Select value={formData.barra_tipo} onValueChange={(v) => setFormData({ ...formData, barra_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BARRA_TIPOS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Acabamento da Barra</Label>
                <Select value={formData.barra_acabamento} onValueChange={(v) => setFormData({ ...formData, barra_acabamento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BARRA_ACABAMENTOS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Dumbell</Label>
                <Select value={formData.dumbell_tipo} onValueChange={(v) => setFormData({ ...formData, dumbell_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DUMBELL_TIPOS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Espessura do Piso (mm)</Label>
                <Input type="number" value={formData.piso_espessura_mm || ""} onChange={(e) => setFormData({ ...formData, piso_espessura_mm: e.target.value })} />
              </div>
              <div>
                <Label>Formato do Piso</Label>
                <Select value={formData.piso_formato} onValueChange={(v) => setFormData({ ...formData, piso_formato: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1x1m (Peça única)">1x1m (Peça única)</SelectItem>
                    <SelectItem value="4x 50x50cm (Modular)">4x 50x50cm (Modular)</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Capacidade Pares (Suporte)</Label>
                <Input type="number" value={formData.suporte_capacidade_pares || ""} onChange={(e) => setFormData({ ...formData, suporte_capacidade_pares: e.target.value })} />
              </div>
              <div>
                <Label>Capacidade Unidades (Suporte)</Label>
                <Input type="number" value={formData.suporte_capacidade_unidades || ""} onChange={(e) => setFormData({ ...formData, suporte_capacidade_unidades: e.target.value })} />
              </div>
              <div>
                <Label>Degraus (Suporte)</Label>
                <Input type="number" value={formData.suporte_degraus || ""} onChange={(e) => setFormData({ ...formData, suporte_degraus: e.target.value })} placeholder="2 ou 3" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="peso_fracionado" checked={formData.peso_fracionado} onCheckedChange={(v) => setFormData({ ...formData, peso_fracionado: v })} />
                <Label htmlFor="peso_fracionado">Peso fracionado (1.5kg, 2.5kg)</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch id="ativo" checked={formData.ativo} onCheckedChange={(v) => setFormData({ ...formData, ativo: v })} />
                <Label htmlFor="ativo">Ativo no catálogo</Label>
              </div>
            </div>

            <div>
              <Label>Descrição Padrão</Label>
              <Textarea value={formData.descricao_padrao} onChange={(e) => setFormData({ ...formData, descricao_padrao: e.target.value })} rows={2} placeholder="Descrição para Google Shopping e orçamentos" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Google Category</Label>
                <Input value={formData.google_category} onChange={(e) => setFormData({ ...formData, google_category: e.target.value })} />
              </div>
              <div>
                <Label>NCM</Label>
                <Input value={formData.ncm} onChange={(e) => setFormData({ ...formData, ncm: e.target.value })} />
              </div>
              <div>
                <Label>GTIN (Código de barras)</Label>
                <Input value={formData.gtin} onChange={(e) => setFormData({ ...formData, gtin: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Foto do Template</Label>
              <div className="mt-2 space-y-3">
                {formData.foto && (
                  <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
                    <img src={formData.foto} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex gap-2">
                  <input id="foto-upload" type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  <Button type="button" variant="outline" onClick={() => document.getElementById("foto-upload")?.click()} disabled={uploadingPhoto}>
                    {uploadingPhoto ? "Enviando..." : <><Upload className="w-4 h-4 mr-2" /> Upload de Foto</>}
                  </Button>
                </div>
                <Input type="url" value={formData.foto} onChange={(e) => setFormData({ ...formData, foto: e.target.value })} placeholder="Ou insira a URL da foto" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white">
                {editingTemplate ? "Salvar Alterações" : "Criar Template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}