import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Eye,
  FileText,
  Package,
  Search,
  CheckCircle2,
  Download,
  Printer,
  Share2
} from "lucide-react";
import jsPDF from "jspdf";
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

export default function PedidosCompraFabricante() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: pedidosCompra = [] } = useQuery({
    queryKey: ['pedidos-compra-fabricante'],
    queryFn: async () => {
      const all = await base44.entities.PedidoCompra.list('-created_date');
      return all.filter(p => p.fabricante_id === user?.id);
    },
    enabled: !!user,
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
    setLoading(false);
  };

  const confirmarPedidoMutation = useMutation({
    mutationFn: async ({ pedidoId, revendedorId, numeroPedido }) => {
      const pedido = pedidosCompra.find(p => p.id === pedidoId);
      
      // Atualizar status do pedido de compra
      await base44.entities.PedidoCompra.update(pedidoId, { status: 'confirmado' });
      
      // Criar uma venda (Pedido tipo 'venda') para o fabricante
      if (pedido) {
        const numeroPedidoVenda = `VENDA-${Date.now()}`;
        await base44.entities.Pedido.create({
          fornecedor_id: user.id,
          cliente_id: pedido.revendedor_id,
          cliente_nome: pedido.revendedor_nome,
          numero_pedido: numeroPedidoVenda,
          data_pedido: new Date().toISOString().split('T')[0],
          tipo: 'venda',
          itens: pedido.itens,
          subtotal: pedido.total,
          frete: 0,
          desconto: 0,
          total: pedido.total,
          status: 'confirmado',
          observacoes: `Pedido de compra ${pedido.numero_pedido} confirmado`
        });
      }
      
      // Criar notificação para o revendedor
      await base44.entities.Notification.create({
        supplier_id: revendedorId,
        tipo: 'mensagem_placefit',
        mensagem: `Seu pedido de compra ${numeroPedido} foi confirmado pelo fabricante ${user.empresa || user.full_name}!`,
        lida: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra-fabricante'] });
      toast({ 
        title: "Pedido confirmado!", 
        description: "O pedido foi confirmado e registrado em suas vendas." 
      });
      setShowViewDialog(false);
    },
  });

  const handleConfirmarPedido = (pedido) => {
    if (confirm(`Confirmar o recebimento do pedido ${pedido.numero_pedido}?`)) {
      confirmarPedidoMutation.mutate({
        pedidoId: pedido.id,
        revendedorId: pedido.revendedor_id,
        numeroPedido: pedido.numero_pedido
      });
    }
  };

  const handleViewPedido = (pedido) => {
    setSelectedPedido(pedido);
    setShowViewDialog(true);
  };

  const atualizarStatusMutation = useMutation({
    mutationFn: async ({ pedidoId, novoStatus, revendedorId, numeroPedido }) => {
      const pedido = pedidosCompra.find(p => p.id === pedidoId);
      
      await base44.entities.PedidoCompra.update(pedidoId, { status: novoStatus });
      
      // Se o status for confirmado ou recebido, criar uma venda automaticamente
      if ((novoStatus === 'confirmado' || novoStatus === 'recebido') && pedido) {
        // Verificar se já existe uma venda para este pedido de compra
        const vendasExistentes = await base44.entities.Pedido.filter({ 
          fornecedor_id: user.id,
          observacoes: `Pedido de compra ${pedido.numero_pedido} confirmado`
        });
        
        // Criar venda apenas se ainda não existir
        if (vendasExistentes.length === 0) {
          const numeroPedidoVenda = `VENDA-${Date.now()}`;
          await base44.entities.Pedido.create({
            fornecedor_id: user.id,
            cliente_id: pedido.revendedor_id,
            cliente_nome: pedido.revendedor_nome,
            numero_pedido: numeroPedidoVenda,
            data_pedido: new Date().toISOString().split('T')[0],
            tipo: 'venda',
            itens: pedido.itens,
            subtotal: pedido.total,
            frete: 0,
            desconto: 0,
            total: pedido.total,
            status: 'confirmado',
            observacoes: `Pedido de compra ${pedido.numero_pedido} confirmado`
          });
        }
      }
      
      // Criar notificação para o revendedor
      await base44.entities.Notification.create({
        supplier_id: revendedorId,
        tipo: 'mensagem_placefit',
        mensagem: `Status do pedido ${numeroPedido} atualizado para: ${statusLabels[novoStatus]}`,
        lida: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra-fabricante'] });
      toast({ 
        title: "Status atualizado!", 
        description: "O pedido foi atualizado e registrado em suas vendas." 
      });
    },
  });

  const handleAtualizarStatus = (novoStatus) => {
    atualizarStatusMutation.mutate({
      pedidoId: selectedPedido.id,
      novoStatus,
      revendedorId: selectedPedido.revendedor_id,
      numeroPedido: selectedPedido.numero_pedido
    });
  };

  const gerarPDF = async (pedido) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    // Cabeçalho
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text("PEDIDO DE COMPRA", pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Logo do fabricante (se existir)
    if (user.logomarca) {
      try {
        const img = new Image();
        img.src = user.logomarca;
        await new Promise((resolve) => {
          img.onload = () => {
            doc.addImage(img, 'PNG', 15, yPos, 30, 30);
            resolve();
          };
          img.onerror = resolve;
        });
      } catch (error) {
        console.error("Erro ao carregar logo:", error);
      }
    }

    // Dados do fabricante
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text("FABRICANTE:", 50, yPos);
    doc.setFont(undefined, 'normal');
    yPos += 5;
    doc.text(user.empresa || user.full_name || '', 50, yPos);
    yPos += 4;
    if (user.cnpj) {
      doc.text(`CNPJ: ${user.cnpj}`, 50, yPos);
      yPos += 4;
    }
    if (user.telefone) {
      doc.text(`Tel: ${user.telefone}`, 50, yPos);
      yPos += 4;
    }
    if (user.email) {
      doc.text(`Email: ${user.email}`, 50, yPos);
      yPos += 4;
    }
    if (user.endereco) {
      doc.text(`End: ${user.endereco}`, 50, yPos);
      yPos += 6;
    }

    // Dados do revendedor comprador (abaixo do fabricante)
    doc.setFont(undefined, 'bold');
    doc.text("COMPRADOR:", 50, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    
    // Buscar dados completos do revendedor
    try {
      const revendedor = await base44.entities.User.filter({ id: pedido.revendedor_id });
      if (revendedor && revendedor[0]) {
        const rev = revendedor[0];
        doc.text(rev.empresa || rev.full_name || pedido.revendedor_nome, 50, yPos);
        yPos += 4;
        if (rev.cnpj) {
          doc.text(`CNPJ: ${rev.cnpj}`, 50, yPos);
          yPos += 4;
        }
        if (rev.telefone) {
          doc.text(`Tel: ${rev.telefone}`, 50, yPos);
          yPos += 4;
        }
        if (rev.whatsapp) {
          doc.text(`WhatsApp: ${rev.whatsapp}`, 50, yPos);
          yPos += 4;
        }
        if (rev.email) {
          doc.text(`Email: ${rev.email}`, 50, yPos);
          yPos += 4;
        }
        if (rev.endereco) {
          doc.text(`End: ${rev.endereco}`, 50, yPos);
          yPos += 4;
        }
        if (rev.cidade && rev.estado) {
          doc.text(`${rev.cidade} - ${rev.estado}`, 50, yPos);
          yPos += 4;
        }
        if (rev.cep) {
          doc.text(`CEP: ${rev.cep}`, 50, yPos);
          yPos += 4;
        }
      }
    } catch (error) {
      doc.text(pedido.revendedor_nome, 50, yPos);
      yPos += 4;
    }

    yPos += 5;
    doc.setDrawColor(200);
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 10;

    // Informações do pedido
    doc.setFont(undefined, 'bold');
    doc.text(`Pedido: ${pedido.numero_pedido}`, 15, yPos);
    doc.text(`Data: ${new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}`, 100, yPos);
    yPos += 5;
    doc.text(`Status: ${statusLabels[pedido.status]}`, 15, yPos);
    yPos += 10;

    // Tabela de produtos
    doc.setFont(undefined, 'bold');
    doc.text("Cód", 15, yPos);
    doc.text("Produto", 35, yPos);
    doc.text("Qtd", 120, yPos);
    doc.text("Preço Un.", 140, yPos);
    doc.text("Subtotal", 170, yPos);
    yPos += 2;
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 5;

    doc.setFont(undefined, 'normal');
    pedido.itens.forEach((item) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(item.cod.substring(0, 12), 15, yPos);
      const nomeTexto = item.nome.length > 40 ? item.nome.substring(0, 40) + '...' : item.nome;
      doc.text(nomeTexto, 35, yPos);
      doc.text(String(item.quantidade), 120, yPos);
      doc.text(`R$ ${item.preco_unitario.toFixed(2)}`, 140, yPos);
      doc.text(`R$ ${item.subtotal.toFixed(2)}`, 170, yPos);
      yPos += 6;
    });

    yPos += 5;
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 7;

    // Total
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text("TOTAL:", 140, yPos);
    doc.text(`R$ ${pedido.total.toFixed(2)}`, 170, yPos);

    // Observações
    if (pedido.observacoes) {
      yPos += 10;
      doc.setFontSize(10);
      doc.text("Observações:", 15, yPos);
      yPos += 5;
      doc.setFont(undefined, 'normal');
      const obsLines = doc.splitTextToSize(pedido.observacoes, pageWidth - 30);
      doc.text(obsLines, 15, yPos);
    }

    doc.save(`Pedido_${pedido.numero_pedido}.pdf`);
    toast({ title: "PDF gerado!", description: "Download iniciado." });
  };

  const imprimirPedido = () => {
    window.print();
    toast({ title: "Imprimindo...", description: "Prepare sua impressora." });
  };

  const compartilharPedido = (pedido) => {
    const texto = `Pedido de Compra ${pedido.numero_pedido}\nRevendedor: ${pedido.revendedor_nome}\nTotal: R$ ${pedido.total.toFixed(2)}`;
    
    if (navigator.share) {
      navigator.share({ 
        title: `Pedido ${pedido.numero_pedido}`,
        text: texto 
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(texto);
      toast({ title: "Copiado!", description: "Informações copiadas para área de transferência." });
    }
  };

  const filteredPedidos = pedidosCompra.filter(pc => {
    const matchSearch = searchTerm === "" || 
      pc.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pc.revendedor_nome.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = statusFilter === "all" || pc.status === statusFilter;
    
    return matchSearch && matchStatus;
  });

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

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
            <p className="text-gray-600">Pedidos recebidos dos revendedores</p>
          </div>
        </div>

        {/* Busca e Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por número ou revendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white/80">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="em_producao">Em Produção</SelectItem>
              <SelectItem value="despachado">Despachado</SelectItem>
              <SelectItem value="recebido">Recebido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <ShoppingCart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{pedidosCompra.length}</div>
              <p className="text-sm text-blue-700">Total de Pedidos</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-yellow-900">
                {pedidosCompra.filter(p => p.status === 'enviado' || p.status === 'pendente').length}
              </div>
              <p className="text-sm text-yellow-700">Aguardando Confirmação</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">
                {pedidosCompra.filter(p => p.status === 'confirmado' || p.status === 'em_producao').length}
              </div>
              <p className="text-sm text-purple-700">Em Andamento</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">
                {pedidosCompra.filter(p => p.status === 'despachado' || p.status === 'recebido').length}
              </div>
              <p className="text-sm text-green-700">Concluídos</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Pedidos - Desktop */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
          <CardHeader>
            <CardTitle>Lista de Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPedidos.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum pedido</h3>
                <p className="text-gray-600">Você ainda não recebeu pedidos de compra</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                      <TableHead className="text-white font-semibold">Número</TableHead>
                      <TableHead className="text-white font-semibold">Revendedor</TableHead>
                      <TableHead className="text-white font-semibold">Data</TableHead>
                      <TableHead className="text-white font-semibold">Itens</TableHead>
                      <TableHead className="text-white font-semibold text-right">Total</TableHead>
                      <TableHead className="text-white font-semibold">Status</TableHead>
                      <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPedidos.map((pc, index) => (
                      <TableRow key={pc.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <TableCell className="font-mono text-sm">{pc.numero_pedido}</TableCell>
                        <TableCell>{pc.revendedor_nome}</TableCell>
                        <TableCell>{new Date(pc.data_pedido).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{pc.itens.length} produto(s)</TableCell>
                        <TableCell className="text-right font-bold text-green-700">
                          R$ {pc.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[pc.status]}>
                            {statusLabels[pc.status]}
                          </Badge>
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
                            {(pc.status === 'pendente' || pc.status === 'enviado') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConfirmarPedido(pc)}
                                className="h-8 px-2 hover:bg-green-50 text-green-600"
                                title="Confirmar Recebimento"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cards de Pedidos - Mobile */}
        <div className="md:hidden space-y-3 w-full">
          {filteredPedidos.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum pedido</h3>
                <p className="text-gray-600 text-sm">Você ainda não recebeu pedidos</p>
              </CardContent>
            </Card>
          ) : (
            filteredPedidos.map((pc) => (
              <Card key={pc.id} className="bg-white shadow w-full">
                <CardContent className="p-3 w-full">
                  <div className="space-y-2 w-full">
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-mono text-xs text-gray-500 break-all">{pc.numero_pedido}</p>
                        <h3 className="font-semibold text-sm text-gray-900 break-words">{pc.revendedor_nome}</h3>
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
                      {(pc.status === 'pendente' || pc.status === 'enviado') && (
                        <Button
                          size="sm"
                          onClick={() => handleConfirmarPedido(pc)}
                          className="flex-1 h-8 text-xs bg-green-600"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Confirmar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
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
                {/* Ações do Pedido */}
                <div className="flex flex-wrap gap-2 border-b pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => gerarPDF(selectedPedido)}
                    className="flex-1 sm:flex-none"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={imprimirPedido}
                    className="flex-1 sm:flex-none"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => compartilharPedido(selectedPedido)}
                    className="flex-1 sm:flex-none"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Compartilhar
                  </Button>
                </div>

                <div className="bg-gray-50 p-4 rounded">
                  <p><strong>Revendedor:</strong> {selectedPedido.revendedor_nome}</p>
                  <p><strong>Data:</strong> {new Date(selectedPedido.data_pedido).toLocaleDateString('pt-BR')}</p>
                  <div className="mt-2">
                    <label className="block text-sm font-semibold mb-2">Status do Pedido:</label>
                    <Select 
                      value={selectedPedido.status} 
                      onValueChange={handleAtualizarStatus}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="confirmado">Confirmado</SelectItem>
                        <SelectItem value="em_producao">Em Produção</SelectItem>
                        <SelectItem value="despachado">Despachado</SelectItem>
                        <SelectItem value="recebido">Recebido</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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

                {selectedPedido.observacoes && (
                  <div className="bg-gray-50 p-4 rounded">
                    <p><strong>Observações:</strong></p>
                    <p className="text-sm text-gray-700 mt-1">{selectedPedido.observacoes}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowViewDialog(false)}>Fechar</Button>
                  {(selectedPedido.status === 'pendente' || selectedPedido.status === 'enviado') && (
                    <Button 
                      onClick={() => handleConfirmarPedido(selectedPedido)} 
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirmar Recebimento
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