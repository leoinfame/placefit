import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Truck, MapPin, Package, Edit3, Trash2, Save, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function Frete() {
  const [user, setUser] = useState(null);
  const [freightOffers, setFreightOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
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

      const offers = await base44.entities.FreightOffer.filter({ supplier_id: currentUser.id });
      setFreightOffers(offers);
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
        peso_total: parseFloat(formData.peso_total),
        valor_ofertado: parseFloat(formData.valor_ofertado)
      };

      if (editingOffer) {
        await base44.entities.FreightOffer.update(editingOffer.id, data);
        toast({
          title: "Oferta atualizada!",
          description: "Sua oferta de frete foi atualizada com sucesso.",
        });
      } else {
        await base44.entities.FreightOffer.create(data);
        toast({
          title: "Oferta criada!",
          description: "Sua oferta de frete foi publicada.",
        });
      }

      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar oferta:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar oferta. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (offer) => {
    setEditingOffer(offer);
    setFormData({
      cidade: offer.cidade,
      estado: offer.estado,
      peso_total: offer.peso_total,
      valor_ofertado: offer.valor_ofertado,
      observacoes: offer.observacoes || "",
      ativo: offer.ativo
    });
    setShowDialog(true);
  };

  const handleMarkAsDispatched = async (offer) => {
    if (confirm(`Marcar oferta para ${offer.cidade}/${offer.estado} como despachada?`)) {
      try {
        await base44.entities.FreightOffer.update(offer.id, { ativo: false });
        loadData();
        toast({
          title: "Oferta marcada como despachada",
          description: "A oferta foi desativada e não aparecerá mais para os caminhoneiros.",
        });
      } catch (error) {
        console.error("Erro ao marcar como despachada:", error);
        toast({
          title: "Erro",
          description: "Erro ao marcar oferta como despachada. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const handleDelete = async (offer) => {
    if (confirm(`Tem certeza que deseja excluir a oferta para ${offer.cidade}/${offer.estado}?`)) {
      try {
        await base44.entities.FreightOffer.delete(offer.id);
        loadData();
        toast({
          title: "Oferta excluída",
          description: "A oferta de frete foi removida.",
        });
      } catch (error) {
        console.error("Erro ao excluir oferta:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir oferta. Tente novamente.",
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
    setEditingOffer(null);
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ofertas de Frete</h1>
            <p className="text-gray-600">Publique suas demandas de frete para caminhoneiros</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowDialog(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Oferta de Frete
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Truck className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{freightOffers.length}</div>
              <p className="text-sm text-blue-700">Total de Ofertas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <MapPin className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">
                {freightOffers.filter(o => o.ativo).length}
              </div>
              <p className="text-sm text-green-700">Ofertas Ativas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">
                {[...new Set(freightOffers.map(o => o.estado))].length}
              </div>
              <p className="text-sm text-purple-700">Estados Atendidos</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Ofertas */}
        {freightOffers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Truck className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma oferta de frete</h3>
            <p className="text-gray-600 mb-6">Comece publicando suas demandas de frete</p>
            <Button
              onClick={() => setShowDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Oferta
            </Button>
          </div>
        ) : (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                      <TableHead className="text-white font-semibold">Status</TableHead>
                      <TableHead className="text-white font-semibold">Destino</TableHead>
                      <TableHead className="text-white font-semibold">Estado</TableHead>
                      <TableHead className="text-white font-semibold">Peso (kg)</TableHead>
                      <TableHead className="text-white font-semibold">Valor (R$)</TableHead>
                      <TableHead className="text-white font-semibold">Observações</TableHead>
                      <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freightOffers.map((offer, index) => (
                      <TableRow 
                        key={offer.id}
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                      >
                        <TableCell>
                          {offer.ativo ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              Ativa
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                              Despachada
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{offer.cidade}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {offer.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>{offer.peso_total}</TableCell>
                        <TableCell className="font-bold text-green-600">
                          {offer.valor_ofertado.toFixed(2)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-gray-600">
                          {offer.observacoes || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {offer.ativo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsDispatched(offer)}
                                className="h-8 px-2 hover:bg-green-50 hover:text-green-700"
                                title="Marcar como despachado"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(offer)}
                              className="h-8 px-2 hover:bg-blue-50 hover:text-blue-700"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(offer)}
                              className="h-8 px-2 hover:bg-red-50 hover:text-red-700"
                              title="Excluir"
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
            </CardContent>
          </Card>
        )}

        {/* Dialog de Formulário */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingOffer ? "Editar Oferta de Frete" : "Nova Oferta de Frete"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cidade">Cidade de Destino *</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    placeholder="Ex: São Paulo"
                    required
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
                      {ESTADOS.map(estado => (
                        <SelectItem key={estado} value={estado}>
                          {estado}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="peso_total">Peso Total (kg) *</Label>
                  <Input
                    id="peso_total"
                    type="number"
                    step="0.01"
                    value={formData.peso_total}
                    onChange={(e) => setFormData({ ...formData, peso_total: e.target.value })}
                    placeholder="Ex: 500"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="valor_ofertado">Valor Ofertado (R$) *</Label>
                  <Input
                    id="valor_ofertado"
                    type="number"
                    step="0.01"
                    value={formData.valor_ofertado}
                    onChange={(e) => setFormData({ ...formData, valor_ofertado: e.target.value })}
                    placeholder="Ex: 1500.00"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais sobre o frete..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingOffer ? "Salvar Alterações" : "Criar Oferta"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}