import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Eye, Edit, Trash2, FileText, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PedidosVenda() {
  const [user, setUser] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  
  const [formData, setFormData] = useState({
    cliente_id: "",
    data_pedido: new Date().toISOString().split('T')[0],
    status: "Em negociação",
    itens: [],
    forma_pagamento: "PIX",
    status_pagamento: "Pendente",
    observacoes: ""
  });

  const [itemForm, setItemForm] = useState({
    product_id: "",
    quantidade: 1,
    valor_unitario: 0,
    desconto: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [pedidosData, clientesData, produtosData] = await Promise.all([
        base44.entities.PedidoVenda.filter({ user_id: currentUser.id }, "-created_date"),
        base44.entities.ClienteFiscal.filter({ user_id: currentUser.id }),
        base44.entities.SupplierProduct.filter({ supplier_id: currentUser.id })
      ]);

      setPedidos(pedidosData || []);
      setClientes(clientesData || []);

      // Os SupplierProduct do revendedor apontam para ProductTemplate.
      // Juntamos aqui para exibir nome/cod/ncm reais no seletor e na NF-e.
      const _sps = produtosData || [];
      const _tplIds = [...new Set(_sps.map(sp => sp.product_id).filter(Boolean))];
      const _tplMap = {};
      for (let _i = 0; _i < _tplIds.length; _i += 100) {
        const _chunk = _tplIds.slice(_i, _i + 100);
        const _tpls = await base44.entities.ProductTemplate.filter({ id: { $in: _chunk } });
        for (const _t of _tpls) _tplMap[_t.id] = _t;
      }
      const _produtosEnriquecidos = _sps
        .map(sp => {
          const t = _tplMap[sp.product_id];
          if (!t) return null;
          return { ...sp, product_name: t.nome, product_cod: t.cod, product_ncm: t.ncm };
        })
        .filter(Boolean);
      setProdutos(_produtosEnriquecidos);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const produto = produtos.find(p => p.id === itemForm.product_id);
    if (!produto) {
      toast.error("Selecione um produto");
      return;
    }

    const valorTotal = (itemForm.quantidade * itemForm.valor_unitario) - itemForm.desconto;

    const novoItem = {
      product_id: produto.id,
      codigo: produto.product_cod || "SEM COD",
      descricao: produto.product_name,
      ncm: produto.product_ncm || "00000000",
      quantidade: itemForm.quantidade,
      valor_unitario: itemForm.valor_unitario,
      desconto: itemForm.desconto,
      valor_total: valorTotal
    };

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem]
    });

    setItemForm({
      product_id: "",
      quantidade: 1,
      valor_unitario: 0,
      desconto: 0
    });

    toast.success("Produto adicionado");
  };

  const handleRemoveItem = (index) => {
    const novosItens = formData.itens.filter((_, i) => i !== index);
    setFormData({ ...formData, itens: novosItens });
  };

  const calcularTotais = () => {
    const subtotal = formData.itens.reduce((sum, item) => sum + item.valor_total, 0);
    return {
      subtotal,
      valor_total: subtotal + (formData.valor_frete || 0) - (formData.desconto || 0)
    };
  };

  const handleSavePedido = async () => {
    if (!formData.cliente_id) {
      toast.error("Selecione um cliente");
      return;
    }

    if (formData.itens.length === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    try {
      const cliente = clientes.find(c => c.id === formData.cliente_id);
      const totais = calcularTotais();
      
      const numeroPedido = `PV-${Date.now()}`;

      const pedidoData = {
        user_id: user.id,
        numero_pedido: numeroPedido,
        cliente_id: formData.cliente_id,
        cliente_nome: cliente.nome_razao_social,
        cliente_cpf_cnpj: cliente.cpf_cnpj,
        data_pedido: formData.data_pedido,
        status: formData.status,
        itens: formData.itens,
        subtotal: totais.subtotal,
        desconto: formData.desconto || 0,
        valor_frete: formData.valor_frete || 0,
        valor_total: totais.valor_total,
        forma_pagamento: formData.forma_pagamento,
        status_pagamento: formData.status_pagamento,
        observacoes: formData.observacoes
      };

      await base44.entities.PedidoVenda.create(pedidoData);
      
      toast.success("Pedido criado com sucesso!");
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar pedido:", error);
      toast.error("Erro ao salvar pedido");
    }
  };

  const resetForm = () => {
    setFormData({
      cliente_id: "",
      data_pedido: new Date().toISOString().split('T')[0],
      status: "Em negociação",
      itens: [],
      forma_pagamento: "PIX",
      status_pagamento: "Pendente",
      observacoes: ""
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      "Em negociação": "bg-yellow-100 text-yellow-800",
      "Confirmado": "bg-blue-100 text-blue-800",
      "Faturado": "bg-purple-100 text-purple-800",
      "Enviado": "bg-indigo-100 text-indigo-800",
      "Entregue": "bg-green-100 text-green-800",
      "Cancelado": "bg-red-100 text-red-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const filteredPedidos = pedidos.filter(p => {
    const matchesSearch = p.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totais = calcularTotais();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pedidos de Venda</h1>
              <p className="text-gray-600">Gerenciar pedidos e orçamentos</p>
            </div>
          </div>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Pedido de Venda</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Cliente */}
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.cliente_id} onValueChange={(value) => setFormData({...formData, cliente_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(cliente => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome_razao_social} - {cliente.cpf_cnpj}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data e Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data do Pedido</Label>
                    <Input
                      type="date"
                      value={formData.data_pedido}
                      onChange={(e) => setFormData({...formData, data_pedido: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Em negociação">Em negociação</SelectItem>
                        <SelectItem value="Confirmado">Confirmado</SelectItem>
                        <SelectItem value="Faturado">Faturado</SelectItem>
                        <SelectItem value="Enviado">Enviado</SelectItem>
                        <SelectItem value="Entregue">Entregue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Adicionar Produtos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Adicionar Produtos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-2 space-y-2">
                        <Label>Produto</Label>
                        <Select value={itemForm.product_id} onValueChange={(value) => {
                          const prod = produtos.find(p => p.id === value);
                          setItemForm({
                            ...itemForm,
                            product_id: value,
                            valor_unitario: prod?.preco || 0
                          });
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos.map(prod => (
                              <SelectItem key={prod.id} value={prod.id}>
                                {prod.product_name} - R$ {prod.preco}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          min="1"
                          value={itemForm.quantidade}
                          onChange={(e) => setItemForm({...itemForm, quantidade: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Unit.</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={itemForm.valor_unitario}
                          onChange={(e) => setItemForm({...itemForm, valor_unitario: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                    <Button onClick={handleAddItem} variant="outline" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Item
                    </Button>
                  </CardContent>
                </Card>

                {/* Lista de Itens */}
                {formData.itens.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Itens do Pedido</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {formData.itens.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{item.descricao}</p>
                              <p className="text-sm text-gray-600">
                                {item.quantidade}x R$ {item.valor_unitario.toFixed(2)} = R$ {item.valor_total.toFixed(2)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-4 border-t space-y-2">
                        <div className="flex justify-between text-lg font-semibold">
                          <span>Subtotal:</span>
                          <span>R$ {totais.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-blue-600">
                          <span>Total:</span>
                          <span>R$ {totais.valor_total.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pagamento */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={formData.forma_pagamento} onValueChange={(value) => setFormData({...formData, forma_pagamento: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="À vista">À vista</SelectItem>
                        <SelectItem value="Boleto">Boleto</SelectItem>
                        <SelectItem value="Cartão">Cartão</SelectItem>
                        <SelectItem value="Parcelado">Parcelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status Pagamento</Label>
                    <Select value={formData.status_pagamento} onValueChange={(value) => setFormData({...formData, status_pagamento: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Pago">Pago</SelectItem>
                        <SelectItem value="Atrasado">Atrasado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSavePedido} className="bg-gradient-to-r from-blue-600 to-green-600">
                    Salvar Pedido
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por número ou cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Em negociação">Em negociação</SelectItem>
                  <SelectItem value="Confirmado">Confirmado</SelectItem>
                  <SelectItem value="Faturado">Faturado</SelectItem>
                  <SelectItem value="Enviado">Enviado</SelectItem>
                  <SelectItem value="Entregue">Entregue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Pedidos List */}
        <div className="grid gap-4">
          {filteredPedidos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhum pedido encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredPedidos.map((pedido) => (
              <Card key={pedido.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold">{pedido.numero_pedido}</h3>
                        <Badge className={getStatusColor(pedido.status)}>
                          {pedido.status}
                        </Badge>
                      </div>
                      <p className="text-gray-600">
                        Cliente: <span className="font-medium">{pedido.cliente_nome}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        Data: {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-lg font-semibold text-blue-600">
                        R$ {pedido.valor_total?.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {pedido.status === "Confirmado" && !pedido.nfe_id && (
                        <Button className="bg-green-600 hover:bg-green-700">
                          <FileText className="w-4 h-4 mr-2" />
                          Emitir NF-e
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}