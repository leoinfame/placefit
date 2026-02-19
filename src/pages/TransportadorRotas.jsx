import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Truck, Plus, Edit2, Trash2, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function TransportadorRotas() {
  const [user, setUser] = useState(null);
  const [rotas, setRotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRota, setEditingRota] = useState(null);
  const [formData, setFormData] = useState({
    cidade: "",
    estado: "",
    peso_total: "",
    valor_ofertado: "",
    observacoes: "",
    ativo: true
  });

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role === 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      if (currentUser.tipo_usuario !== 'transportador') {
        window.location.href = '/Dashboard';
        return;
      }

      const freightOffers = await base44.entities.FreightOffer.filter({
        supplier_id: currentUser.id
      });
      setRotas(freightOffers);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        supplier_id: user.id,
        peso_total: parseFloat(formData.peso_total) || 0,
        valor_ofertado: parseFloat(formData.valor_ofertado) || 0
      };

      if (editingRota) {
        await base44.entities.FreightOffer.update(editingRota.id, data);
        toast({
          title: "Rota atualizada!",
          description: "A rota foi atualizada com sucesso.",
        });
      } else {
        await base44.entities.FreightOffer.create(data);
        toast({
          title: "Rota criada!",
          description: "Nova rota adicionada com sucesso.",
        });
      }

      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar rota:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar rota. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (rota) => {
    setEditingRota(rota);
    setFormData({
      cidade: rota.cidade,
      estado: rota.estado,
      peso_total: rota.peso_total.toString(),
      valor_ofertado: rota.valor_ofertado.toString(),
      observacoes: rota.observacoes || "",
      ativo: rota.ativo !== false
    });
    setShowDialog(true);
  };

  const handleDelete = async (rota) => {
    if (confirm(`Tem certeza que deseja excluir a rota para ${rota.cidade}/${rota.estado}?`)) {
      try {
        await base44.entities.FreightOffer.delete(rota.id);
        loadData();
        toast({
          title: "Rota excluída",
          description: "Rota removida com sucesso.",
        });
      } catch (error) {
        console.error("Erro ao excluir rota:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir rota. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      cidade: "",
      estado: "",
      peso_total: "",
      valor_ofertado: "",
      observacoes: "",
      ativo: true
    });
    setEditingRota(null);
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

  const activeRotas = rotas.filter(r => r.ativo !== false);
  const uniqueEstados = [...new Set(rotas.map(r => r.estado))];

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-8 h-8 text-orange-600" />
              Minhas Rotas
            </h1>
            <p className="text-gray-600">Gerencie suas rotas e ofertas de frete</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Rota
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-4 text-center">
              <Truck className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">{rotas.length}</div>
              <p className="text-sm text-orange-700">Total de Rotas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <MapPin className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{activeRotas.length}</div>
              <p className="text-sm text-green-700">Rotas Ativas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{uniqueEstados.length}</div>
              <p className="text-sm text-blue-700">Estados Atendidos</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Rotas */}
        <Card className="bg-white shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-500 hover:to-red-500">
                    <TableHead className="text-white font-semibold">Destino</TableHead>
                    <TableHead className="text-white font-semibold">Capacidade</TableHead>
                    <TableHead className="text-white font-semibold">Valor</TableHead>
                    <TableHead className="text-white font-semibold">Status</TableHead>
                    <TableHead className="text-white font-semibold">Observações</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rotas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Nenhuma rota cadastrada
                        </h3>
                        <p className="text-gray-600 mb-4">
                          Comece cadastrando sua primeira rota disponível
                        </p>
                        <Button
                          onClick={() => setShowDialog(true)}
                          variant="outline"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Cadastrar Primeira Rota
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rotas.map((rota, index) => (
                      <TableRow
                        key={rota.id}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-orange-600" />
                            <span>{rota.cidade}/{rota.estado}</span>
                          </div>
                        </TableCell>
                        <TableCell>{rota.peso_total} kg</TableCell>
                        <TableCell className="font-semibold text-green-700">
                          R$ {parseFloat(rota.valor_ofertado).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={rota.ativo !== false ? "success" : "secondary"}
                            className={
                              rota.ativo !== false
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }
                          >
                            {rota.ativo !== false ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {rota.observacoes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(rota)}
                              className="hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(rota)}
                              className="hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRota ? "Editar Rota" : "Nova Rota"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="cidade">Cidade de Destino *</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  required
                  placeholder="Ex: São Paulo"
                />
              </div>

              <div>
                <Label htmlFor="estado">Estado *</Label>
                <Select
                  value={formData.estado}
                  onValueChange={(value) => setFormData({ ...formData, estado: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="peso_total">Capacidade (kg) *</Label>
                <Input
                  id="peso_total"
                  type="number"
                  step="0.01"
                  value={formData.peso_total}
                  onChange={(e) => setFormData({ ...formData, peso_total: e.target.value })}
                  required
                  placeholder="Ex: 5000"
                />
              </div>

              <div>
                <Label htmlFor="valor_ofertado">Valor do Frete (R$) *</Label>
                <Input
                  id="valor_ofertado"
                  type="number"
                  step="0.01"
                  value={formData.valor_ofertado}
                  onChange={(e) => setFormData({ ...formData, valor_ofertado: e.target.value })}
                  required
                  placeholder="Ex: 2500.00"
                />
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais sobre a rota..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                >
                  {editingRota ? "Salvar Alterações" : "Criar Rota"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}