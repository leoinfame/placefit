import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit3, Trash2, Tag, ChevronDown, ChevronUp } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";

export default function Categories() {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [formData, setFormData] = useState({
    nome: "",
    subcategorias: [],
    ativo: true,
    ordem: 0
  });
  const [newSubcategory, setNewSubcategory] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const data = await base44.entities.Category.list();
      setCategories(data.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await base44.entities.Category.update(editingCategory.id, formData);
        toast({
          title: "Categoria atualizada!",
          description: "Categoria atualizada com sucesso.",
        });
      } else {
        await base44.entities.Category.create(formData);
        toast({
          title: "Categoria criada!",
          description: "Categoria criada com sucesso.",
        });
      }
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar categoria:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar categoria. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (category) => {
    if (confirm(`Tem certeza que deseja excluir a categoria "${category.nome}"?`)) {
      try {
        await base44.entities.Category.delete(category.id);
        loadData();
        toast({
          title: "Categoria excluída",
          description: "Categoria removida com sucesso.",
        });
      } catch (error) {
        console.error("Erro ao excluir categoria:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir categoria. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      nome: category.nome,
      subcategorias: category.subcategorias || [],
      ativo: category.ativo,
      ordem: category.ordem || 0
    });
    setShowDialog(true);
  };

  const handleToggleActive = async (category) => {
    try {
      await base44.entities.Category.update(category.id, {
        ...category,
        ativo: !category.ativo
      });
      loadData();
      toast({
        title: "Status atualizado",
        description: `Categoria ${category.ativo ? 'desativada' : 'ativada'} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const addSubcategory = () => {
    if (newSubcategory.trim()) {
      setFormData({
        ...formData,
        subcategorias: [...formData.subcategorias, newSubcategory.trim()]
      });
      setNewSubcategory("");
    }
  };

  const removeSubcategory = (index) => {
    setFormData({
      ...formData,
      subcategorias: formData.subcategorias.filter((_, i) => i !== index)
    });
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      subcategorias: [],
      ativo: true,
      ordem: 0
    });
    setEditingCategory(null);
    setNewSubcategory("");
  };

  const toggleExpanded = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Categorias</h1>
            <p className="text-gray-600">Gerencie categorias e subcategorias de produtos</p>
          </div>
          <Button 
            onClick={() => setShowDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Categoria
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Tag className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{categories.length}</div>
              <p className="text-sm text-blue-700">Total de Categorias</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <Tag className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">
                {categories.filter(c => c.ativo).length}
              </div>
              <p className="text-sm text-green-700">Ativas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Tag className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">
                {categories.reduce((sum, c) => sum + (c.subcategorias?.length || 0), 0)}
              </div>
              <p className="text-sm text-purple-700">Subcategorias</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Categorias */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6">
            {categories.length > 0 ? (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(category.id)}
                          disabled={!category.subcategorias || category.subcategorias.length === 0}
                        >
                          {category.subcategorias && category.subcategorias.length > 0 ? (
                            expandedCategories[category.id] ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )
                          ) : (
                            <Tag className="w-4 h-4 text-gray-300" />
                          )}
                        </Button>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{category.nome}</h3>
                          {category.subcategorias && category.subcategorias.length > 0 && (
                            <p className="text-sm text-gray-500">
                              {category.subcategorias.length} subcategoria(s)
                            </p>
                          )}
                        </div>
                        <Badge variant={category.ativo ? "success" : "secondary"}>
                          {category.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={category.ativo}
                          onCheckedChange={() => handleToggleActive(category)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(category)}
                          className="hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(category)}
                          className="hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {expandedCategories[category.id] && category.subcategorias && category.subcategorias.length > 0 && (
                      <div className="p-4 bg-white border-t">
                        <div className="flex flex-wrap gap-2">
                          {category.subcategorias.map((sub, index) => (
                            <Badge key={index} variant="outline" className="text-sm">
                              {sub}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma categoria cadastrada</h3>
                <p className="text-gray-600 mb-4">Comece criando sua primeira categoria.</p>
                <Button onClick={() => setShowDialog(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Categoria
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Categoria */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Editar Categoria" : "Nova Categoria"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome da Categoria *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    placeholder="Ex: Cardiovascular"
                  />
                </div>
                
                <div>
                  <Label htmlFor="ordem">Ordem de Exibição</Label>
                  <Input
                    id="ordem"
                    type="number"
                    value={formData.ordem}
                    onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <Label>Subcategorias</Label>
                <div className="mt-2 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={newSubcategory}
                      onChange={(e) => setNewSubcategory(e.target.value)}
                      placeholder="Digite uma subcategoria"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSubcategory();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={addSubcategory}
                      variant="outline"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {formData.subcategorias.length > 0 && (
                    <div className="border rounded-lg p-3 space-y-2">
                      {formData.subcategorias.map((sub, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{sub}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSubcategory(index)}
                            className="hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label>Categoria ativa</Label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
                >
                  {editingCategory ? "Salvar Alterações" : "Criar Categoria"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}