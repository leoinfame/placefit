import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Plus, Edit3, Trash2, ToggleRight } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Units() {
  const [user, setUser] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [formData, setFormData] = useState({
    nome: "",
    ativo: true,
    ordem: 0
  });

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

      const unitsData = await base44.entities.Unit.list();
      setUnits(unitsData.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
    } catch (error) {
      console.error("Erro ao carregar unidades:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUnit) {
        await base44.entities.Unit.update(editingUnit.id, formData);
        toast({
          title: "Unidade atualizada!",
          description: "A unidade foi atualizada com sucesso.",
        });
      } else {
        await base44.entities.Unit.create(formData);
        toast({
          title: "Unidade criada!",
          description: "A unidade foi adicionada ao sistema.",
        });
      }
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar unidade:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar unidade. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (unit) => {
    setEditingUnit(unit);
    setFormData({
      nome: unit.nome,
      ativo: unit.ativo,
      ordem: unit.ordem || 0
    });
    setShowDialog(true);
  };

  const handleDelete = async (unit) => {
    if (confirm(`Tem certeza que deseja excluir "${unit.nome}"?`)) {
      try {
        await base44.entities.Unit.delete(unit.id);
        loadData();
        toast({
          title: "Unidade excluída",
          description: `${unit.nome} foi removida do sistema.`,
        });
      } catch (error) {
        console.error("Erro ao excluir unidade:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir unidade. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const handleToggleActive = async (unit) => {
    try {
      await base44.entities.Unit.update(unit.id, { ativo: !unit.ativo });
      loadData();
      toast({
        title: "Status atualizado",
        description: `Unidade ${unit.ativo ? 'desativada' : 'ativada'} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      ativo: true,
      ordem: 0
    });
    setEditingUnit(null);
  };

  const getStats = () => {
    const total = units.length;
    const active = units.filter(u => u.ativo).length;
    
    return { total, active };
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

  const stats = getStats();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Unidades</h1>
            <p className="text-gray-600">Gerencie as unidades de medida disponíveis</p>
          </div>
          <Button 
            onClick={() => setShowDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Unidade
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
              <p className="text-sm text-blue-700">Total de Unidades</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <ToggleRight className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{stats.active}</div>
              <p className="text-sm text-green-700">Unidades Ativas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Unidades */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                    <TableHead className="text-white font-semibold">Ordem</TableHead>
                    <TableHead className="text-white font-semibold">Nome</TableHead>
                    <TableHead className="text-white font-semibold">Status</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit, index) => (
                    <TableRow 
                      key={unit.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                    >
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="text-xs">
                          {unit.ordem || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {unit.nome}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(unit)}
                            className="p-0 h-auto"
                          >
                            {unit.ativo ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                                Ativa
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                Inativa
                              </Badge>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(unit)}
                            className="hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(unit)}
                            className="hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {units.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma unidade cadastrada</h3>
                <p className="text-gray-600 mb-4">Adicione a primeira unidade ao sistema.</p>
                <Button
                  onClick={() => setShowDialog(true)}
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Unidade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Unidade */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUnit ? "Editar Unidade" : "Nova Unidade"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome da Unidade *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  placeholder="Ex: peça, litro, kg"
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

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label>Unidade Ativa</Label>
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
                  {editingUnit ? "Salvar Alterações" : "Criar Unidade"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}