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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Catálogo Padronizado</h1>
            <p className="text-gray-600">Gerencie os templates de produtos da PlaceFit</p>
          </div>
          <Button
            onClick={handleNew}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Template
          </Button>
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