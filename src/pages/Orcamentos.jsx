import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getProdutosData } from "@/functions/getProdutosData";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Users,
  Package,
  Check,
  X,
  Search,
  UserPlus
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import ProductAutoComplete from "@/components/ProductAutoComplete";
import ClienteAutoComplete from "@/components/ClienteAutoComplete";
import { generateProfessionalPDF } from "@/components/ProfessionalPDF";
import { expandTemplates } from "@/utils/expandTemplates";

export default function Orcamentos() {
  const [user, setUser] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [products, setProducts] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFornecedor, setSelectedFornecedor] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState(null);
  const [editingOrcamento, setEditingOrcamento] = useState(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  
  // Novo orçamento
  const [newOrcamento, setNewOrcamento] = useState({
    cliente_id: "",
    itens: [{ product_id: "", cod: "", nome: "", quantidade: 1, preco_unitario: 0, subtotal: 0, _key: Date.now() }],
    frete: 0,
    desconto: 0,
    observacoes: ""
  });
  const [newDescontoPct, setNewDescontoPct] = useState(0);
  const [editDescontoPct, setEditDescontoPct] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orcamentos = [] } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: async () => {
      const all = await base44.entities.Pedido.list('-created_date');
      return user?.role === 'admin'
        ? all.filter(p => p.tipo === 'orcamento')
        : all.filter(p => p.tipo === 'orcamento' && p.fornecedor_id === user?.id);
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

      const viewMode = localStorage.getItem('admin_view_mode') || 'admin';
      const isFabricante = currentUser.tipo_usuario === 'fabricante' || viewMode === 'fabricante';

      const res = await getProdutosData({ mode: "meus", isFabricante });
      const data = res.data || res;
      const supplierProducts = data.mySupplierProducts || [];
      const allTemplates = expandTemplates(data.templates || [], data.fieldMap);

      const tmplMap = new Map(allTemplates.map(t => [t.id, t]));

      let productsData;
      if (isFabricante) {
        productsData = supplierProducts
          .map(sp => {
            const template = tmplMap.get(sp.product_id);
            if (!template) return null;
            return {
              ...template,
              preco_fornecedor: sp.preco || 0,
              preco_fabricante: sp.preco || 0,
              fabricante_nome: sp.fabricante_nome || '',
              supplier_product_id: sp.id
            };
          })
          .filter(Boolean);
      } else {
        productsData = supplierProducts
          .map(sp => {
            const template = tmplMap.get(sp.product_id);
            if (!template) return null;
            return {
              ...template,
              preco_fornecedor: sp.preco || 0,
              fabricante_nome: sp.fabricante_nome || '',
              supplier_product_id: sp.id
            };
          })
          .filter(Boolean);
      }

      setProducts(productsData);

      const clientesData = currentUser.role === 'admin'
        ? await base44.entities.Cliente.filter({ ativo: true })
        : await base44.entities.Cliente.filter({ fornecedor_id: currentUser.id, ativo: true });
      setClientes(clientesData);

      // Buscar fornecedores para exibir nome
      if (currentUser.role === 'admin') {
        const allUsers = await base44.entities.User.list();
        const fornecedoresData = allUsers
          .filter(u => u.role === 'user' || u.tipo_usuario === 'fabricante')
          .map(u => ({ id: u.id, nome: u.empresa || u.full_name }));
        setFornecedores(fornecedoresData);
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const addItemToOrcamento = () => {
    setNewOrcamento(prev => ({
      ...prev,
      itens: [
        ...prev.itens,
        { product_id: "", cod: "", nome: "", quantidade: 1, preco_unitario: 0, subtotal: 0, _key: Date.now() }
      ]
    }));
  };

  const removeItemFromOrcamento = (index) => {
    setNewOrcamento(prev => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index)
    }));
  };

  const handleProductSelect = (index, product) => {
    const isFabricante = user.tipo_usuario === 'fabricante';
    const preco = isFabricante ? parseFloat(product.preco_fabricante) : parseFloat(product.preco_fornecedor);

    setNewOrcamento(prev => {
      const updatedItens = [...prev.itens];
      const existing = updatedItens[index];
      const qtd = product._override ? (existing?.quantidade ?? 1) : 1;
      updatedItens[index] = {
        ...(existing || {}),
        product_id: product.id,
        cod: product.cod,
        nome: product.nome,
        quantidade: qtd,
        preco_unitario: preco,
        subtotal: preco * qtd
      };
      return { ...prev, itens: updatedItens };
    });

    // Adicionar novo campo vazio apenas na seleção inicial, não em edições de nome/preço
    if (!product._override) {
      setTimeout(() => addItemToOrcamento(), 100);
    }
  };

  const updateItemQuantidade = (index, quantidade) => {
    setNewOrcamento(prev => {
      const updatedItens = [...prev.itens];
      updatedItens[index].quantidade = parseFloat(quantidade) || 0;
      updatedItens[index].subtotal = updatedItens[index].preco_unitario * updatedItens[index].quantidade;
      return { ...prev, itens: updatedItens };
    });
  };

  const calculateTotals = (orcamento) => {
    const subtotal = orcamento.itens.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const frete = parseFloat(orcamento.frete) || 0;
    const desconto = parseFloat(orcamento.desconto) || 0;
    const total = subtotal + frete - desconto;
    return { subtotal, total };
  };

  const createOrcamentoMutation = useMutation({
    mutationFn: async (data) => {
      const { subtotal, total } = calculateTotals(data);
      const cliente = clientes.find(c => c.id === data.cliente_id);
      
      return base44.entities.Pedido.create({
        ...data,
        fornecedor_id: user.id,
        cliente_nome: cliente?.nome || "",
        numero_pedido: `ORC-${Date.now()}`,
        data_pedido: new Date().toISOString().split('T')[0],
        tipo: 'orcamento',
        subtotal,
        total,
        status: 'pendente'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      setShowNewDialog(false);
      setNewOrcamento({ 
        cliente_id: "", 
        itens: [{ product_id: "", cod: "", nome: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }], 
        frete: 0, 
        desconto: 0, 
        observacoes: "" 
      });
      toast({ title: "Orçamento criado!", description: "O orçamento foi criado com sucesso." });
    },
  });

  const handleCreateOrcamento = () => {
    const itensValidos = newOrcamento.itens.filter(i => i.product_id);
    if (!newOrcamento.cliente_id || itensValidos.length === 0) {
      toast({ title: "Erro", description: "Selecione um cliente e adicione produtos.", variant: "destructive" });
      return;
    }
    createOrcamentoMutation.mutate({...newOrcamento, itens: itensValidos});
  };

  const handleViewOrcamento = (orcamento) => {
    setSelectedOrcamento(orcamento);
    setShowViewDialog(true);
  };

  const handleEditOrcamento = (orcamento) => {
    setEditingOrcamento({ ...orcamento });
    setShowEditDialog(true);
  };

  const updateOrcamentoMutation = useMutation({
    mutationFn: async (data) => {
      const { id, ...updateData } = data;
      const { subtotal, total } = calculateTotals(updateData);
      return base44.entities.Pedido.update(id, { ...updateData, subtotal, total });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      setShowEditDialog(false);
      setEditingOrcamento(null);
      toast({ title: "Orçamento atualizado!", description: "As alterações foram salvas." });
    },
  });

  const handleSaveEdit = () => {
    if (editingOrcamento.itens.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um produto.", variant: "destructive" });
      return;
    }
    updateOrcamentoMutation.mutate(editingOrcamento);
  };

  const deleteOrcamentoMutation = useMutation({
    mutationFn: (id) => base44.entities.Pedido.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({ title: "Orçamento excluído", description: "O orçamento foi removido." });
    },
  });

  const handleDeleteOrcamento = (id) => {
    if (confirm("Tem certeza que deseja excluir este orçamento?")) {
      deleteOrcamentoMutation.mutate(id);
    }
  };

  const converterParaVendaMutation = useMutation({
    mutationFn: async (orcamento) => {
      // Atualizar orçamento para venda
      await base44.entities.Pedido.update(orcamento.id, {
        tipo: 'venda',
        status: 'confirmado'
      });

      // Obter dados do cliente
      const cliente = clientes.find(c => c.id === orcamento.cliente_id);

      // Calcular peso total dos produtos
      let pesoTotal = 0;
      for (const item of orcamento.itens) {
        const produto = products.find(p => p.id === item.product_id);
        if (produto && produto.peso_kg) {
          pesoTotal += parseFloat(produto.peso_kg) * item.quantidade;
        }
      }

      // Criar oferta de frete inativa (precisa aprovação)
      if (cliente && orcamento.frete > 0) {
        await base44.entities.FreightOffer.create({
          supplier_id: user.id,
          cidade: cliente.cidade || '',
          estado: cliente.estado || '',
          peso_total: pesoTotal || 0,
          valor_ofertado: parseFloat(orcamento.frete),
          observacoes: `Oferta de frete do orçamento ${orcamento.numero_pedido} - Cliente: ${cliente.nome}. Revendedor: ${user.empresa || user.full_name}. Email: ${user.email}. WhatsApp: ${user.whatsapp || 'Não informado'}`,
          ativo: false  // Inativo até aprovação do revendedor
        });
      }

      // Agrupar produtos por fabricante para criar lista de pedidos pendentes
      // No novo modelo, o fabricante é identificado pelo fabricante_nome no SupplierProduct
      const produtosPorFabricante = {};
      
      for (const item of orcamento.itens) {
        const produto = products.find(p => p.id === item.product_id);
        if (!produto) continue;
        
        // Usar fabricante_nome do SupplierProduct; se vazio, agrupar sob "Sem fabricante"
        const fabricanteNome = produto.fabricante_nome || 'Sem fabricante';
        
        if (!produtosPorFabricante[fabricanteNome]) {
          produtosPorFabricante[fabricanteNome] = {
            fabricante_nome: fabricanteNome,
            itens: []
          };
        }
        
        const itemParaFabricante = { ...item };
        produtosPorFabricante[fabricanteNome].itens.push(itemParaFabricante);
      }

      // Criar pedidos de compra em estado "rascunho" (pendentes de envio)
      for (const fabricanteNome in produtosPorFabricante) {
        const dadosFabricante = produtosPorFabricante[fabricanteNome];
        const totalPedido = dadosFabricante.itens.reduce((sum, item) => sum + item.subtotal, 0);
        const numeroPedido = `PC-${Date.now()}-${fabricanteNome.slice(0, 6)}`;
        
        await base44.entities.PedidoCompra.create({
          revendedor_id: user.id,
          revendedor_nome: user.empresa || user.full_name,
          fabricante_id: 'pendente',
          fabricante_nome: fabricanteNome,
          venda_id: orcamento.id,
          numero_pedido: numeroPedido,
          data_pedido: new Date().toISOString().split('T')[0],
          itens: dadosFabricante.itens,
          total: totalPedido,
          status: 'rascunho'  // Status rascunho até o revendedor enviar
        });
      }

      return orcamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast({ 
        title: "Venda concluída!", 
        description: "O orçamento foi convertido em venda. Acesse 'Pedidos de Compra' para revisar e enviar os pedidos aos fabricantes." 
      });
    },
  });

  const handleConverterParaVenda = (orcamento) => {
    if (confirm("Converter este orçamento em venda concluída?")) {
      converterParaVendaMutation.mutate(orcamento);
    }
  };

  const generatePDF = async (orcamento) => {
    await generateProfessionalPDF(orcamento, user, clientes, 'orcamento', products);
  };

  const calcPesoTotal = (itens) => {
    return itens.reduce((sum, item) => {
      const prod = products.find(p => p.id === item.product_id);
      const peso = prod?.peso_kg ? parseFloat(prod.peso_kg) : 0;
      return sum + peso * (item.quantidade || 1);
    }, 0);
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

  const { subtotal: newSubtotal, total: newTotal } = calculateTotals(newOrcamento);

  const filteredOrcamentos = orcamentos.filter(orc => {
    const matchSearch = searchTerm === "" || 
      orc.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orc.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchFornecedor = selectedFornecedor === "all" || orc.fornecedor_id === selectedFornecedor;
    
    return matchSearch && matchFornecedor;
  });

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Orçamentos</h1>
            <p className="text-gray-600">Crie orçamentos para seus clientes</p>
          </div>
          <Button
            onClick={() => setShowNewDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Orçamento
          </Button>
        </div>

        {/* Busca e Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por número ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200"
            />
          </div>
          {user?.role === 'admin' && (
            <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
              <SelectTrigger className="w-full md:w-64 bg-white/80">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Fornecedores</SelectItem>
                {fornecedores.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{orcamentos.length}</div>
              <p className="text-sm text-blue-700">Total de Orçamentos</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{products.length}</div>
              <p className="text-sm text-purple-700">Produtos Disponíveis</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{clientes.length}</div>
              <p className="text-sm text-green-700">Clientes Ativos</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Orçamentos - Desktop */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
          <CardHeader>
            <CardTitle>Lista de Orçamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrcamentos.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum orçamento</h3>
                <p className="text-gray-600">Crie seu primeiro orçamento para um cliente</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-white font-semibold">Número</TableHead>
                      <TableHead className="text-white font-semibold">Cliente</TableHead>
                      {user?.role === 'admin' && <TableHead className="text-white font-semibold">Fornecedor</TableHead>}
                      <TableHead className="text-white font-semibold">Data</TableHead>
                      <TableHead className="text-white font-semibold text-right">Total</TableHead>
                      <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrcamentos.map((orc, index) => (
                      <TableRow key={orc.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <TableCell className="font-mono text-sm">{orc.numero_pedido}</TableCell>
                        <TableCell>{orc.cliente_nome}</TableCell>
                        {user?.role === 'admin' && (
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {fornecedores.find(f => f.id === orc.fornecedor_id)?.nome || 'N/A'}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell>{new Date(orc.data_pedido).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right font-bold text-green-700">
                          R$ {orc.total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewOrcamento(orc)}
                              className="h-8 px-2 hover:bg-blue-50"
                              title="Visualizar"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generatePDF(orc)}
                              className="h-8 px-2 hover:bg-purple-50"
                              title="Gerar PDF"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditOrcamento(orc)}
                              className="h-8 px-2 hover:bg-amber-50"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConverterParaVenda(orc)}
                              className="h-8 px-2 hover:bg-green-50 hover:text-green-700"
                              title="Converter em Venda"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteOrcamento(orc.id)}
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
            )}
          </CardContent>
        </Card>

        {/* Cards de Orçamentos - Mobile */}
        <div className="md:hidden space-y-3 w-full">
          {filteredOrcamentos.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum orçamento</h3>
                <p className="text-gray-600 text-sm">Crie seu primeiro orçamento</p>
              </CardContent>
            </Card>
          ) : (
            filteredOrcamentos.map((orc) => (
              <Card key={orc.id} className="bg-white shadow w-full">
                <CardContent className="p-3 w-full">
                  <div className="space-y-2 w-full">
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="font-mono text-xs text-gray-500 break-all">{orc.numero_pedido}</p>
                        <h3 className="font-semibold text-sm text-gray-900 break-words">{orc.cliente_nome}</h3>
                        {user?.role === 'admin' && (
                          <p className="text-xs text-purple-600 font-medium">
                            {fornecedores.find(f => f.id === orc.fornecedor_id)?.nome || 'N/A'}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">{new Date(orc.data_pedido).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="font-bold text-green-700 text-sm">R$ {orc.total.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 w-full pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewOrcamento(orc)}
                        className="flex-1 h-8 text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generatePDF(orc)}
                        className="flex-1 h-8 text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditOrcamento(orc)}
                        className="flex-1 h-8 text-xs"
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                    <div className="flex gap-1 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConverterParaVenda(orc)}
                        className="flex-1 h-8 text-xs bg-green-50 hover:bg-green-100"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Venda
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteOrcamento(orc.id)}
                        className="h-8 px-2 text-xs bg-red-50 hover:bg-red-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Dialog Novo Orçamento */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Orçamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Cliente *</Label>
                  <Link
                    to={createPageUrl("Clientes")}
                    target="_blank"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Novo cliente
                  </Link>
                </div>
                <ClienteAutoComplete
                  clientes={clientes}
                  value={newOrcamento.cliente_id}
                  onSelect={(id) => setNewOrcamento({...newOrcamento, cliente_id: id})}
                />
              </div>

              <div>
                <Label className="mb-3 block">Produtos *</Label>
                <div className="space-y-3">
                  {newOrcamento.itens.map((item, idx) => (
                    <ProductAutoComplete
                      key={item._key || idx}
                      products={products}
                      selectedProductData={item.product_id ? item : null}
                      onSelect={(product) => handleProductSelect(idx, product)}
                      onRemove={() => removeItemFromOrcamento(idx)}
                      quantidade={item.quantidade}
                      onQuantidadeChange={(qtd) => updateItemQuantidade(idx, qtd)}
                      subtotal={item.subtotal}
                      userType={user?.tipo_usuario}
                      autoFocus={idx === newOrcamento.itens.length - 1}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                 <div>
                   <Label>Frete (R$)</Label>
                   <Input
                     type="number"
                     step="0.01"
                     value={newOrcamento.frete}
                     onFocus={(e) => {
                       if (parseFloat(e.target.value) === 0) e.target.select();
                     }}
                     onChange={(e) => setNewOrcamento({...newOrcamento, frete: parseFloat(e.target.value) || 0})}
                   />
                 </div>
                 <div>
                   <Label>Desconto (%)</Label>
                   <Input
                     type="number"
                     step="0.1"
                     min="0"
                     max="100"
                     value={newDescontoPct}
                     onFocus={(e) => { if (parseFloat(e.target.value) === 0) e.target.select(); }}
                     onChange={(e) => {
                       const pct = parseFloat(e.target.value) || 0;
                       setNewDescontoPct(pct);
                       const descontoValor = (newSubtotal * pct) / 100;
                       setNewOrcamento(prev => ({ ...prev, desconto: descontoValor }));
                     }}
                   />
                 </div>
                 <div>
                   <Label>Desconto (R$)</Label>
                   <Input
                     type="number"
                     step="0.01"
                     value={newOrcamento.desconto}
                     onFocus={(e) => {
                       if (parseFloat(e.target.value) === 0) e.target.select();
                     }}
                     onChange={(e) => {
                       const val = parseFloat(e.target.value) || 0;
                       setNewOrcamento({...newOrcamento, desconto: val});
                       setNewDescontoPct(newSubtotal > 0 ? parseFloat(((val / newSubtotal) * 100).toFixed(2)) : 0);
                     }}
                   />
                 </div>
               </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={newOrcamento.observacoes}
                  onChange={(e) => setNewOrcamento({...newOrcamento, observacoes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <div className="flex justify-between mb-1">
                  <span>Subtotal:</span>
                  <span className="font-semibold">R$ {newSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Frete:</span>
                  <span>R$ {newOrcamento.frete.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Desconto:</span>
                  <span>R$ {newOrcamento.desconto.toFixed(2)}</span>
                </div>
                {calcPesoTotal(newOrcamento.itens) > 0 && (
                  <div className="flex justify-between mb-1 text-gray-600">
                    <span>Peso Total:</span>
                    <span>{calcPesoTotal(newOrcamento.itens).toFixed(2)} kg</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span className="text-green-700">R$ {newTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
                <Button onClick={handleCreateOrcamento} className="bg-green-600 hover:bg-green-700">
                  Criar Orçamento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Editar */}
        {editingOrcamento && (
          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Orçamento {editingOrcamento.numero_pedido}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Cliente *</Label>
                  <ClienteAutoComplete
                    clientes={clientes}
                    value={editingOrcamento.cliente_id}
                    onSelect={(id) => setEditingOrcamento({...editingOrcamento, cliente_id: id})}
                  />
                </div>

                <div>
                  <Label className="mb-3 block">Produtos *</Label>
                  <div className="space-y-3">
                    {editingOrcamento.itens.map((item, idx) => (
                      <ProductAutoComplete
                        key={idx}
                        products={products}
                        selectedProductData={item.product_id ? item : null}
                        onSelect={(product) => {
                          const isFabricante = user.tipo_usuario === 'fabricante';
                          const preco = isFabricante ? parseFloat(product.preco_fabricante) : parseFloat(product.preco_fornecedor);
                          setEditingOrcamento(prev => {
                            const updatedItens = [...prev.itens];
                            const existing = updatedItens[idx];
                            const qtd = product._override ? (existing?.quantidade ?? 1) : 1;
                            updatedItens[idx] = {
                              ...(existing || {}),
                              product_id: product.id,
                              cod: product.cod,
                              nome: product.nome,
                              quantidade: qtd,
                              preco_unitario: preco,
                              subtotal: preco * qtd
                            };
                            return { ...prev, itens: updatedItens };
                          });
                        }}
                        onRemove={() => {
                          setEditingOrcamento(prev => ({
                            ...prev,
                            itens: prev.itens.filter((_, i) => i !== idx)
                          }));
                        }}
                        quantidade={item.quantidade}
                        onQuantidadeChange={(qtd) => {
                          setEditingOrcamento(prev => {
                            const updatedItens = [...prev.itens];
                            updatedItens[idx].quantidade = parseFloat(qtd) || 0;
                            updatedItens[idx].subtotal = updatedItens[idx].preco_unitario * updatedItens[idx].quantidade;
                            return { ...prev, itens: updatedItens };
                          });
                        }}
                        subtotal={item.subtotal}
                        userType={user?.tipo_usuario}
                      />
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingOrcamento(prev => ({
                          ...prev,
                          itens: [...prev.itens, { product_id: "", cod: "", nome: "", quantidade: 1, preco_unitario: 0, subtotal: 0 }]
                        }));
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Produto
                    </Button>
                  </div>
                </div>

                {(() => {
                  const editSubtotal = editingOrcamento.itens.reduce((sum, item) => sum + (item.subtotal || 0), 0);
                  return (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Frete (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingOrcamento.frete}
                          onFocus={(e) => {
                            if (parseFloat(e.target.value) === 0) e.target.select();
                          }}
                          onChange={(e) => setEditingOrcamento({...editingOrcamento, frete: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div>
                        <Label>Desconto (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={editDescontoPct}
                          onFocus={(e) => { if (parseFloat(e.target.value) === 0) e.target.select(); }}
                          onChange={(e) => {
                            const pct = parseFloat(e.target.value) || 0;
                            setEditDescontoPct(pct);
                            const descontoValor = (editSubtotal * pct) / 100;
                            setEditingOrcamento(prev => ({ ...prev, desconto: descontoValor }));
                          }}
                        />
                      </div>
                      <div>
                        <Label>Desconto (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editingOrcamento.desconto}
                          onFocus={(e) => {
                            if (parseFloat(e.target.value) === 0) e.target.select();
                          }}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditingOrcamento({...editingOrcamento, desconto: val});
                            setEditDescontoPct(editSubtotal > 0 ? parseFloat(((val / editSubtotal) * 100).toFixed(2)) : 0);
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={editingOrcamento.observacoes || ""}
                    onChange={(e) => setEditingOrcamento({...editingOrcamento, observacoes: e.target.value})}
                    rows={3}
                  />
                </div>

                {(() => {
                  const { subtotal, total } = calculateTotals(editingOrcamento);
                  return (
                    <div className="bg-gray-50 p-4 rounded">
                      <div className="flex justify-between mb-1">
                        <span>Subtotal:</span>
                        <span className="font-semibold">R$ {subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>Frete:</span>
                        <span>R$ {editingOrcamento.frete.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>Desconto:</span>
                        <span>R$ {editingOrcamento.desconto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span className="text-green-700">R$ {total.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
                  <Button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Dialog Visualizar */}
        {selectedOrcamento && (
          <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Orçamento {selectedOrcamento.numero_pedido}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded">
                  <p><strong>Cliente:</strong> {selectedOrcamento.cliente_nome}</p>
                  <p><strong>Data:</strong> {new Date(selectedOrcamento.data_pedido).toLocaleDateString('pt-BR')}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Itens:</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrcamento.itens.map((item, idx) => (
                        <TableRow key={idx}>
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
                  <div className="flex justify-between mb-1">
                    <span>Subtotal:</span>
                    <span className="font-semibold">R$ {selectedOrcamento.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Frete:</span>
                    <span>R$ {selectedOrcamento.frete.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span>Desconto:</span>
                    <span>R$ {selectedOrcamento.desconto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span className="text-green-700">R$ {selectedOrcamento.total.toFixed(2)}</span>
                  </div>
                </div>

                {selectedOrcamento.observacoes && (
                  <div>
                    <h3 className="font-semibold mb-2">Observações:</h3>
                    <p className="text-gray-700">{selectedOrcamento.observacoes}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowViewDialog(false)}>Fechar</Button>
                  <Button onClick={() => generatePDF(selectedOrcamento)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar PDF
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}