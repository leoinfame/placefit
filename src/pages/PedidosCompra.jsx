import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Eye,
  FileText,
  Package,
  Search,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function PedidosCompra() {
  const [user, setUser] = useState(null);
  const [fabricantes, setFabricantes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVenda, setSelectedVenda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: vendas = [] } = useQuery({
    queryKey: ['vendas-pedidos-compra'],
    queryFn: async () => {
      const all = await base44.entities.Pedido.list('-created_date');
      return all.filter(p => p.tipo === 'venda' && p.fornecedor_id === user?.id);
    },
    enabled: !!user,
  });

  const { data: pedidosCompra = [] } = useQuery({
    queryKey: ['pedidos-compra'],
    queryFn: async () => {
      const all = await base44.entities.PedidoCompra.list('-created_date');
      return all.filter(p => p.revendedor_id === user?.id);
    },
    enabled: !!user,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const allUsers = await base44.entities.User.list();
      const fabricantesData = allUsers
        .filter(u => u.tipo_usuario === 'fabricante')
        .map(u => ({ id: u.id, nome: u.empresa || u.full_name, email: u.email, whatsapp: u.whatsapp }));
      setFabricantes(fabricantesData);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.PedidoCompra.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
      toast({ title: "Status atualizado!", description: "O status do pedido foi atualizado." });
    },
  });

  const handleViewPedido = (pedido) => {
    setSelectedPedido(pedido);
    setShowViewDialog(true);
  };

  const generatePDF = (pedido) => {
    const fabricante = fabricantes.find(f => f.id === pedido.fabricante_id);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pedido de Compra ${pedido.numero_pedido}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; padding: 20px; border-bottom: 2px solid #333; }
          .logo { max-width: 120px; margin-bottom: 10px; }
          .company-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
          .company-info { font-size: 11px; line-height: 1.5; color: #666; }
          .title { font-size: 16px; font-weight: bold; text-align: center; margin: 20px 0; }
          .section { margin: 20px 0; }
          .section-title { font-size: 13px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 11px; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          ${user?.logomarca ? `<img src="${user.logomarca}" class="logo" alt="Logo">` : ''}
          <div class="company-name">${user?.empresa || user?.full_name}</div>
          <div class="company-info">
            ${user?.whatsapp ? `Tel: ${user.whatsapp} | ` : ''}
            ${user?.email ? `E-mail: ${user.email}` : ''}<br>
            ${user?.endereco ? `${user.endereco}<br>` : ''}
            ${user?.site ? user.site : ''}
          </div>
        </div>

        <div class="title">PEDIDO DE COMPRA - ${pedido.numero_pedido}</div>
        <div style="text-align: center; font-size: 11px; color: #666; margin-bottom: 20px;">
          Data: ${new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
        </div>

        <div class="section">
          <div class="section-title">FORNECEDOR</div>
          <div style="font-size: 11px;">
            <strong>${fabricante?.nome || pedido.fabricante_nome}</strong><br>
            ${fabricante?.email ? `E-mail: ${fabricante.email}<br>` : ''}
            ${fabricante?.whatsapp ? `WhatsApp: ${fabricante.whatsapp}<br>` : ''}
          </div>
        </div>

        <div class="section">
          <div class="section-title">PRODUTOS SOLICITADOS</div>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Produto</th>
                <th class="text-right">Quantidade</th>
                <th class="text-right">Preço Unit.</th>
                <th class="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${pedido.itens.map(item => `
                <tr>
                  <td>${item.cod}</td>
                  <td>${item.nome}</td>
                  <td class="text-right">${item.quantidade}</td>
                  <td class="text-right">R$ ${item.preco_unitario.toFixed(2)}</td>
                  <td class="text-right">R$ ${item.subtotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <table>
            <tr style="background-color: #e0e0e0; font-weight: bold; font-size: 13px;">
              <td>TOTAL DO PEDIDO</td>
              <td class="text-right">R$ ${pedido.total.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        ${pedido.observacoes ? `
          <div class="section">
            <div class="section-title">OBSERVAÇÕES</div>
            <div style="font-size: 11px;">${pedido.observacoes}</div>
          </div>
        ` : ''}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 500);
    };
  };

  const enviarEmailFabricante = async (pedido) => {
    const fabricante = fabricantes.find(f => f.id === pedido.fabricante_id);
    
    if (!fabricante?.email) {
      toast({
        title: "Erro",
        description: "Fabricante não possui e-mail cadastrado.",
        variant: "destructive"
      });
      return;
    }

    try {
      const itensHTML = pedido.itens.map(item => `
        <tr>
          <td>${item.cod}</td>
          <td>${item.nome}</td>
          <td style="text-align: right;">${item.quantidade}</td>
          <td style="text-align: right;">R$ ${item.preco_unitario.toFixed(2)}</td>
          <td style="text-align: right;">R$ ${item.subtotal.toFixed(2)}</td>
        </tr>
      `).join('');

      const emailBody = `
        <h2>Pedido de Compra - ${pedido.numero_pedido}</h2>
        <p><strong>De:</strong> ${user.empresa || user.full_name}</p>
        <p><strong>Data:</strong> ${new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}</p>
        <p><strong>Contato:</strong> ${user.whatsapp || user.email}</p>
        
        <h3 style="margin-top: 20px;">Produtos Solicitados:</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th>Código</th>
              <th>Produto</th>
              <th>Quantidade</th>
              <th>Preço Unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itensHTML}
          </tbody>
        </table>
        
        <h3 style="margin-top: 20px;">Total: R$ ${pedido.total.toFixed(2)}</h3>
        
        ${pedido.observacoes ? `<p><strong>Observações:</strong> ${pedido.observacoes}</p>` : ''}
      `;

      await base44.integrations.Core.SendEmail({
        to: fabricante.email,
        subject: `Pedido de Compra ${pedido.numero_pedido} - ${user.empresa || user.full_name}`,
        body: emailBody
      });

      await updateStatusMutation.mutateAsync({ id: pedido.id, status: 'enviado' });

      toast({
        title: "E-mail enviado!",
        description: "O pedido de compra foi enviado ao fabricante.",
      });
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o e-mail.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const filteredVendas = vendas.filter(v => {
    const matchSearch = searchTerm === "" || 
      v.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchSearch;
  });

  const getPedidosCompraByVenda = (vendaId) => {
    return pedidosCompra.filter(pc => pc.venda_id === vendaId);
  };

  const statusColors = {
    pendente: "bg-yellow-100 text-yellow-800",
    enviado: "bg-blue-100 text-blue-800",
    confirmado: "bg-green-100 text-green-800",
    em_producao: "bg-purple-100 text-purple-800",
    despachado: "bg-indigo-100 text-indigo-800",
    recebido: "bg-green-100 text-green-800",
    cancelado: "bg-red-100 text-red-800"
  };

  const statusLabels = {
    pendente: "Pendente",
    enviado: "Enviado",
    confirmado: "Confirmado",
    em_producao: "Em Produção",
    despachado: "Despachado",
    recebido: "Recebido",
    cancelado: "Cancelado"
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            {!selectedVenda ? (
              <>
                <h1 className="text-3xl font-bold text-gray-900">Pedidos de Compra</h1>
                <p className="text-gray-600">Selecione uma venda para ver os pedidos de compra por fabricante</p>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900">Pedidos de Compra - Venda {selectedVenda.numero_pedido}</h1>
                <p className="text-gray-600">Cliente: {selectedVenda.cliente_nome}</p>
              </>
            )}
          </div>
          {selectedVenda && (
            <Button onClick={() => setSelectedVenda(null)} variant="outline">
              ← Voltar para Vendas
            </Button>
          )}
        </div>

        {/* Busca */}
        {!selectedVenda && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar venda por número ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200"
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {!selectedVenda ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4 text-center">
                <ShoppingCart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-900">{vendas.length}</div>
                <p className="text-sm text-blue-700">Total de Vendas</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-900">{pedidosCompra.length}</div>
                <p className="text-sm text-purple-700">Pedidos de Compra</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-900">
                  {new Set(pedidosCompra.map(p => p.fabricante_id)).size}
                </div>
                <p className="text-sm text-green-700">Fabricantes</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4 text-center">
                <ShoppingCart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-900">{getPedidosCompraByVenda(selectedVenda.id).length}</div>
                <p className="text-sm text-blue-700">Total de Pedidos</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-yellow-900">
                  {getPedidosCompraByVenda(selectedVenda.id).filter(p => p.status === 'pendente').length}
                </div>
                <p className="text-sm text-yellow-700">Pendentes</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-900">
                  {getPedidosCompraByVenda(selectedVenda.id).filter(p => p.status === 'em_producao').length}
                </div>
                <p className="text-sm text-purple-700">Em Produção</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-900">
                  {getPedidosCompraByVenda(selectedVenda.id).filter(p => p.status === 'recebido').length}
                </div>
                <p className="text-sm text-green-700">Recebidos</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de Vendas ou Pedidos - Desktop */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
          <CardHeader>
            <CardTitle>{!selectedVenda ? 'Vendas com Pedidos de Compra' : 'Pedidos de Compra por Fabricante'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedVenda ? (
              // Lista de Vendas
              filteredVendas.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma venda</h3>
                  <p className="text-gray-600">As vendas concluídas aparecerão aqui</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                        <TableHead className="text-white font-semibold">Número</TableHead>
                        <TableHead className="text-white font-semibold">Cliente</TableHead>
                        <TableHead className="text-white font-semibold">Data</TableHead>
                        <TableHead className="text-white font-semibold text-right">Total</TableHead>
                        <TableHead className="text-white font-semibold text-center">Pedidos de Compra</TableHead>
                        <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVendas.map((venda, index) => {
                        const pedidos = getPedidosCompraByVenda(venda.id);
                        return (
                          <TableRow key={venda.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <TableCell className="font-mono text-sm">{venda.numero_pedido}</TableCell>
                            <TableCell>{venda.cliente_nome}</TableCell>
                            <TableCell>{new Date(venda.data_pedido).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-right font-bold text-green-700">
                              R$ {venda.total.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-purple-50">
                                {pedidos.length} pedido(s)
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => setSelectedVenda(venda)}
                                  className="h-8 bg-blue-600 hover:bg-blue-700"
                                >
                                  Ver Pedidos
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              // Lista de Pedidos de Compra da venda selecionada
              getPedidosCompraByVenda(selectedVenda.id).length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum pedido de compra</h3>
                  <p className="text-gray-600">Esta venda não possui pedidos de compra</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                        <TableHead className="text-white font-semibold">Número</TableHead>
                        <TableHead className="text-white font-semibold">Fabricante</TableHead>
                        <TableHead className="text-white font-semibold">Itens</TableHead>
                        <TableHead className="text-white font-semibold text-right">Total</TableHead>
                        <TableHead className="text-white font-semibold">Status</TableHead>
                        <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPedidosCompraByVenda(selectedVenda.id).map((pc, index) => (
                        <TableRow key={pc.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <TableCell className="font-mono text-sm">{pc.numero_pedido}</TableCell>
                          <TableCell>{pc.fabricante_nome}</TableCell>
                          <TableCell>{pc.itens.length} produto(s)</TableCell>
                          <TableCell className="text-right font-bold text-green-700">
                            R$ {pc.total.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={pc.status}
                              onValueChange={(newStatus) => updateStatusMutation.mutate({ id: pc.id, status: newStatus })}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="enviado">Enviado</SelectItem>
                                <SelectItem value="confirmado">Confirmado</SelectItem>
                                <SelectItem value="em_producao">Em Produção</SelectItem>
                                <SelectItem value="despachado">Despachado</SelectItem>
                                <SelectItem value="recebido">Recebido</SelectItem>
                                <SelectItem value="cancelado">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewPedido(pc)}
                                className="h-8 px-2 hover:bg-blue-50"
                                title="Visualizar"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => generatePDF(pc)}
                                className="h-8 px-2 hover:bg-purple-50"
                                title="Gerar PDF"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => enviarEmailFabricante(pc)}
                                className="h-8 px-2 hover:bg-green-50"
                                title="Enviar Email"
                                disabled={pc.status !== 'pendente'}
                              >
                                <Mail className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Cards - Mobile */}
        <div className="md:hidden space-y-3 w-full">
          {!selectedVenda ? (
            // Cards de Vendas
            filteredVendas.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma venda</h3>
                  <p className="text-gray-600 text-sm">Vendas aparecerão aqui</p>
                </CardContent>
              </Card>
            ) : (
              filteredVendas.map((venda) => {
                const pedidos = getPedidosCompraByVenda(venda.id);
                return (
                  <Card key={venda.id} className="bg-white shadow w-full">
                    <CardContent className="p-3 w-full">
                      <div className="space-y-2 w-full">
                        <div className="flex items-start justify-between gap-2 w-full">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="font-mono text-xs text-gray-500 break-all">{venda.numero_pedido}</p>
                            <h3 className="font-semibold text-sm text-gray-900 break-words">{venda.cliente_nome}</h3>
                            <p className="text-xs text-gray-500">{new Date(venda.data_pedido).toLocaleDateString('pt-BR')}</p>
                            <Badge className="mt-1 bg-purple-100 text-purple-800">
                              {pedidos.length} pedido(s) de compra
                            </Badge>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="font-bold text-green-700 text-sm">R$ {venda.total.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 w-full pt-2 border-t">
                          <Button
                            size="sm"
                            onClick={() => setSelectedVenda(venda)}
                            className="flex-1 h-8 text-xs bg-blue-600"
                          >
                            Ver Pedidos de Compra
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )
          ) : (
            // Cards de Pedidos de Compra
            getPedidosCompraByVenda(selectedVenda.id).length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum pedido</h3>
                  <p className="text-gray-600 text-sm">Esta venda não possui pedidos</p>
                </CardContent>
              </Card>
            ) : (
              getPedidosCompraByVenda(selectedVenda.id).map((pc) => (
                <Card key={pc.id} className="bg-white shadow w-full">
                  <CardContent className="p-3 w-full">
                    <div className="space-y-2 w-full">
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="font-mono text-xs text-gray-500 break-all">{pc.numero_pedido}</p>
                          <h3 className="font-semibold text-sm text-gray-900 break-words">{pc.fabricante_nome}</h3>
                          <p className="text-xs text-gray-500">{new Date(pc.data_pedido).toLocaleDateString('pt-BR')}</p>
                          <Badge className={`mt-1 ${statusColors[pc.status]}`}>
                            {statusLabels[pc.status]}
                          </Badge>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="font-bold text-green-700 text-sm">R$ {pc.total.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{pc.itens.length} itens</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 w-full pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPedido(pc)}
                          className="flex-1 h-8 text-xs"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generatePDF(pc)}
                          className="flex-1 h-8 text-xs"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => enviarEmailFabricante(pc)}
                          className="flex-1 h-8 text-xs"
                          disabled={pc.status !== 'pendente'}
                        >
                          <Mail className="w-3 h-3 mr-1" />
                          Email
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )
          )}
        </div>

        {/* Dialog Visualizar */}
        {selectedPedido && (
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Pedido de Compra {selectedPedido.numero_pedido}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded">
                  <p><strong>Fabricante:</strong> {selectedPedido.fabricante_nome}</p>
                  <p><strong>Data:</strong> {new Date(selectedPedido.data_pedido).toLocaleDateString('pt-BR')}</p>
                  <p><strong>Status:</strong> <Badge className={statusColors[selectedPedido.status]}>{statusLabels[selectedPedido.status]}</Badge></p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Produtos:</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPedido.itens.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.cod}</TableCell>
                          <TableCell>{item.nome}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">R$ {item.preco_unitario.toFixed(2)}</TableCell>
                          <TableCell className="text-right">R$ {item.subtotal.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="bg-gray-50 p-4 rounded">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-green-700">R$ {selectedPedido.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowViewDialog(false)}>Fechar</Button>
                  <Button onClick={() => generatePDF(selectedPedido)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar PDF
                  </Button>
                  {selectedPedido.status === 'pendente' && (
                    <Button onClick={() => enviarEmailFabricante(selectedPedido)} className="bg-green-600 hover:bg-green-700">
                      <Mail className="w-4 h-4 mr-2" />
                      Enviar Email
                    </Button>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}