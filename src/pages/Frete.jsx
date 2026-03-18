import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Truck, MapPin, Package, Edit3, Trash2, Save, X, CheckCircle, Share2 } from "lucide-react";
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
  const [transportadores, setTransportadores] = useState([]);
  const [rotasTransportadores, setRotasTransportadores] = useState([]);
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
  const [selectedEstado, setSelectedEstado] = useState("all");

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

      // Carregar transportadores e suas rotas
      const allUsers = await base44.entities.User.list();
      const transportadoresAprovados = allUsers.filter(u => 
        u.tipo_usuario === 'transportador' && u.aprovado === true
      );
      setTransportadores(transportadoresAprovados);

      if (transportadoresAprovados.length > 0) {
        const rotas = await base44.entities.TransportadorRota.filter({ ativo: true });
        setRotasTransportadores(rotas);
      }
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-yellow-900">
                {freightOffers.filter(o => !o.ativo).length}
              </div>
              <p className="text-sm text-yellow-700">Pendente Aprovação</p>
            </CardContent>
          </Card>


        </div>

        {/* Transportadores e Rotas Disponíveis */}
        {transportadores.length > 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Truck className="w-6 h-6" />
                  Transportadores Disponíveis
                </h2>
                <Select value={selectedEstado} onValueChange={setSelectedEstado}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Estados</SelectItem>
                    {ESTADOS.map(estado => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {transportadores.map(transportador => {
                  const rotasDoTransportador = rotasTransportadores.filter(r => 
                    r.transportador_id === transportador.id &&
                    (selectedEstado === "all" || r.estado === selectedEstado)
                  );

                  if (rotasDoTransportador.length === 0 && selectedEstado !== "all") return null;

                  return (
                    <div key={transportador.id} className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200">
                      <div className="flex items-start gap-4">
                        {transportador.logomarca && (
                          <img 
                            src={transportador.logomarca} 
                            alt={transportador.empresa}
                            className="w-16 h-16 object-contain rounded-lg bg-white p-2"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900">{transportador.empresa}</h3>
                          {transportador.whatsapp && (
                            <p className="text-sm text-gray-600">📞 {transportador.whatsapp}</p>
                          )}
                          
                          {rotasDoTransportador.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              <p className="text-sm font-semibold text-gray-700">Rotas Periódicas:</p>
                              {rotasDoTransportador.map(rota => (
                                <div key={rota.id} className="p-3 bg-white rounded border">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge className="bg-blue-600 text-white">{rota.estado}</Badge>
                                    <span className="font-medium text-sm">{rota.cidades}</span>
                                  </div>
                                  {rota.periodicidade && (
                                    <p className="text-xs text-gray-600">
                                      🔄 Periodicidade: {rota.periodicidade}
                                    </p>
                                  )}
                                  {rota.dias_carregamento && (
                                    <p className="text-xs text-gray-600">
                                      📅 Dias de carregamento: {rota.dias_carregamento}
                                    </p>
                                  )}
                                  {rota.observacoes && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      💬 {rota.observacoes}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 mt-2">Nenhuma rota cadastrada ainda</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {transportadores.filter(t => {
                const rotas = rotasTransportadores.filter(r => 
                  r.transportador_id === t.id &&
                  (selectedEstado === "all" || r.estado === selectedEstado)
                );
                return selectedEstado === "all" || rotas.length > 0;
              }).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-600">Nenhum transportador encontrado para este filtro.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                              Pendente Aprovação
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
                            {!offer.ativo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await base44.entities.FreightOffer.update(offer.id, { ativo: true });
                                    loadData();
                                    toast({
                                      title: "Oferta aprovada!",
                                      description: "A oferta foi ativada e aparecerá no portal de complementos.",
                                    });
                                  } catch (error) {
                                    toast({
                                      title: "Erro",
                                      description: "Erro ao aprovar oferta.",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                                className="h-8 px-2 hover:bg-green-50 hover:text-green-700"
                                title="Aprovar e ativar"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {offer.ativo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsDispatched(offer)}
                                className="h-8 px-2 hover:bg-yellow-50 hover:text-yellow-700"
                                title="Marcar como despachado"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const texto = `🚚 *Oferta de Frete*\n📍 Destino: ${offer.cidade}/${offer.estado}\n⚖️ Peso: ${offer.peso_total} kg\n💰 Valor: R$ ${offer.valor_ofertado.toFixed(2)}\n${offer.observacoes ? `📝 ${offer.observacoes}` : ''}\n\nInteressados entre em contato!`;
                                if (navigator.share) {
                                  navigator.share({ title: 'Oferta de Frete', text: texto });
                                } else {
                                  navigator.clipboard.writeText(texto);
                                  toast({ title: "Copiado!", description: "Texto da oferta copiado para a área de transferência." });
                                }
                              }}
                              className="h-8 px-2 hover:bg-green-50 hover:text-green-700"
                              title="Compartilhar oferta"
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
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