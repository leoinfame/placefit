import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Truck, Search, Phone, Eye, Trash2, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

export default function Transportadores() {
  const [user, setUser] = useState(null);
  const [transportadores, setTransportadores] = useState([]);
  const [filteredTransportadores, setFilteredTransportadores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTransportador, setSelectedTransportador] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [transportadorRotas, setTransportadorRotas] = useState([]);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterTransportadores();
  }, [transportadores, searchTerm]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const data = await base44.entities.User.filter({ tipo_usuario: 'transportador' });
      setTransportadores(data);
    } catch (error) {
      console.error("Erro ao carregar transportadores:", error);
    }
    setLoading(false);
  };

  const filterTransportadores = () => {
    let filtered = transportadores;
    
    if (searchTerm) {
      filtered = filtered.filter(transportador =>
        (transportador.empresa?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (transportador.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (transportador.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredTransportadores(filtered);
  };

  const handleApprovalToggle = async (transportador) => {
    try {
      await base44.entities.User.update(transportador.id, { 
        aprovado: !transportador.aprovado 
      });
      loadData();
      toast({
        title: "Status atualizado",
        description: `Transportador ${transportador.aprovado ? 'desaprovado' : 'aprovado'} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao alterar aprovação:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const viewTransportadorDetails = async (transportador) => {
    setSelectedTransportador(transportador);
    try {
      const rotas = await base44.entities.FreightOffer.filter({ supplier_id: transportador.id });
      setTransportadorRotas(rotas);
    } catch (error) {
      console.error("Erro ao carregar rotas do transportador:", error);
    }
    setShowDialog(true);
  };

  const handleDeleteTransportador = async (transportador) => {
    if (confirm(`Tem certeza que deseja excluir o transportador "${transportador.empresa || transportador.full_name}"? Esta ação não pode ser desfeita.`)) {
      try {
        await base44.entities.User.delete(transportador.id);
        loadData();
        toast({
          title: "Transportador excluído",
          description: "Transportador removido com sucesso.",
        });
      } catch (error) {
        console.error("Erro ao excluir transportador:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir transportador. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const copyRegistrationLink = () => {
    const link = `${window.location.origin}/PublicRegisterTransportador`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Link de cadastro de transportadores copiado.",
    });
  };

  const getStats = () => {
    const total = transportadores.length;
    const approved = transportadores.filter(t => t.aprovado).length;
    const pending = total - approved;
    
    return { total, approved, pending };
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transportadoras</h1>
          <p className="text-gray-600">Gerencie todas as transportadoras e suas rotas</p>
        </div>

        {/* Link de Cadastro */}
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 border">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Share2 className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Link de Cadastro de Transportadoras</h3>
                  <p className="text-sm text-gray-600">
                    Compartilhe este link para que novas transportadoras se cadastrem
                  </p>
                  <code className="text-xs bg-white px-2 py-1 rounded mt-2 inline-block border">
                    {window.location.origin}/PublicRegisterTransportador
                  </code>
                </div>
              </div>
              <Button
                onClick={copyRegistrationLink}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 whitespace-nowrap"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 border">
            <CardContent className="p-4 text-center">
              <Truck className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">{stats.total}</div>
              <p className="text-sm text-orange-700">Total de Transportadoras</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <Badge className="w-8 h-8 bg-green-600 mx-auto mb-2 flex items-center justify-center">✓</Badge>
              <div className="text-2xl font-bold text-green-900">{stats.approved}</div>
              <p className="text-sm text-green-700">Aprovadas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 border">
            <CardContent className="p-4 text-center">
              <Phone className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-amber-900">{stats.pending}</div>
              <p className="text-sm text-amber-700">Aguardando Aprovação</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtro */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar transportadoras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200"
            />
          </div>
        </div>

        {/* Tabela de Transportadores - Desktop */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-500 hover:to-red-500">
                    <TableHead className="text-white font-semibold">Empresa</TableHead>
                    <TableHead className="text-white font-semibold">Responsável</TableHead>
                    <TableHead className="text-white font-semibold">E-mail</TableHead>
                    <TableHead className="text-white font-semibold">Contato</TableHead>
                    <TableHead className="text-white font-semibold">Status</TableHead>
                    <TableHead className="text-white font-semibold text-center">Aprovar</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransportadores.map((transportador, index) => (
                    <TableRow 
                      key={transportador.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}
                    >
                      <TableCell className="font-medium">
                        {transportador.empresa || '-'}
                      </TableCell>
                      <TableCell>{transportador.full_name}</TableCell>
                      <TableCell className="text-sm">{transportador.email}</TableCell>
                      <TableCell className="text-sm">
                        {transportador.whatsapp || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={transportador.aprovado ? "success" : "secondary"}
                          className={transportador.aprovado 
                            ? "bg-green-100 text-green-700" 
                            : "bg-orange-100 text-orange-700"
                          }
                        >
                          {transportador.aprovado ? "Aprovado" : "Aguardando"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Switch
                            checked={transportador.aprovado}
                            onCheckedChange={() => handleApprovalToggle(transportador)}
                          />
                          <Label className="text-xs">Aprovado</Label>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewTransportadorDetails(transportador)}
                            className="hover:bg-orange-50 hover:text-orange-700"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTransportador(transportador)}
                            className="hover:bg-red-50 hover:text-red-700"
                            title="Excluir transportador"
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

            {filteredTransportadores.length === 0 && (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma transportadora encontrada</h3>
                <p className="text-gray-600">As transportadoras aparecerão aqui após se cadastrarem.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cards - Mobile */}
        <div className="md:hidden space-y-2 w-full">
          {filteredTransportadores.map((transportador) => (
            <Card key={transportador.id} className="bg-white shadow-sm w-full">
              <CardContent className="p-3 w-full">
                <div className="space-y-2 w-full">
                  {/* Linha 1: Nome e Status */}
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm break-words">
                        {transportador.empresa || transportador.full_name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">{transportador.full_name}</p>
                    </div>
                    <Badge 
                      className={transportador.aprovado 
                        ? "bg-green-100 text-green-700 text-xs flex-shrink-0" 
                        : "bg-orange-100 text-orange-700 text-xs flex-shrink-0"
                      }
                    >
                      {transportador.aprovado ? "Aprovado" : "Pendente"}
                    </Badge>
                  </div>

                  {/* Linha 2: Contato */}
                  <div className="space-y-0.5 text-xs text-gray-600">
                    <div className="flex items-center gap-1 truncate">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{transportador.email}</span>
                    </div>
                    {transportador.whatsapp && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{transportador.whatsapp}</span>
                      </div>
                    )}
                  </div>

                  {/* Linha 3: Aprovação */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-xs text-gray-600">Aprovar:</span>
                    <Switch
                      checked={transportador.aprovado}
                      onCheckedChange={() => handleApprovalToggle(transportador)}
                      className="scale-90"
                    />
                  </div>

                  {/* Linha 4: Ações */}
                  <div className="flex gap-2 w-full pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewTransportadorDetails(transportador)}
                      className="flex-1 h-7 text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTransportador(transportador)}
                      className="flex-1 h-7 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredTransportadores.length === 0 && (
            <div className="text-center py-12">
              <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-gray-900 mb-2">Nenhuma transportadora encontrada</h3>
              <p className="text-sm text-gray-600">As transportadoras aparecerão aqui após se cadastrarem.</p>
            </div>
          )}
        </div>

        {/* Dialog de Detalhes */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Detalhes: {selectedTransportador?.empresa || selectedTransportador?.full_name}
              </DialogTitle>
            </DialogHeader>
            
            {selectedTransportador && (
              <div className="space-y-6">
                {/* Informações do Transportador */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dados da Transportadora</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Empresa</Label>
                      <p className="font-medium">{selectedTransportador.empresa || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">CNPJ</Label>
                      <p className="font-medium">{selectedTransportador.cnpj || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Responsável</Label>
                      <p className="font-medium">{selectedTransportador.full_name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">E-mail</Label>
                      <p className="font-medium">{selectedTransportador.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">WhatsApp</Label>
                      <p className="font-medium">{selectedTransportador.whatsapp || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Endereço</Label>
                      <p className="font-medium">{selectedTransportador.endereco || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Status</Label>
                      <Badge 
                        variant={selectedTransportador.aprovado ? "success" : "secondary"}
                        className={selectedTransportador.aprovado 
                          ? "bg-green-100 text-green-700" 
                          : "bg-orange-100 text-orange-700"
                        }
                      >
                        {selectedTransportador.aprovado ? "Aprovado" : "Aguardando Aprovação"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Rotas Cadastradas */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rotas Cadastradas ({transportadorRotas.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {transportadorRotas.length > 0 ? (
                      <div className="space-y-3">
                        {transportadorRotas.map((rota) => (
                          <div key={rota.id} className="p-3 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {rota.cidade} - {rota.estado}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Peso total: {rota.peso_total} kg
                                </p>
                                {rota.observacoes && (
                                  <p className="text-sm text-gray-500 mt-1">{rota.observacoes}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg text-green-600">
                                  R$ {parseFloat(rota.valor_ofertado).toFixed(2)}
                                </p>
                                <Badge className={rota.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                                  {rota.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Truck className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Nenhuma rota cadastrada ainda</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}