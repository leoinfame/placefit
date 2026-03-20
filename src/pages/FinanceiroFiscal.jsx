import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, Package, TrendingUp, Settings, Truck, Receipt } from "lucide-react";
import { Link } from "react-router-dom";

export default function FinanceiroFiscal() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    pedidos: 0,
    notasFiscais: 0,
    clientes: 0,
    faturamento: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [pedidos, notas, clientes] = await Promise.all([
        base44.entities.PedidoVenda.filter({ user_id: currentUser.id }),
        base44.entities.NotaFiscal.filter({ user_id: currentUser.id }),
        base44.entities.ClienteFiscal.filter({ user_id: currentUser.id })
      ]);

      const faturamento = pedidos
        .filter(p => p.status_pagamento === "Pago")
        .reduce((sum, p) => sum + (p.valor_total || 0), 0);

      setStats({
        pedidos: pedidos.length,
        notasFiscais: notas.filter(n => n.status === "Autorizada").length,
        clientes: clientes.length,
        faturamento
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const menuItems = [
    {
      title: "Pedidos de Venda",
      description: "Criar e gerenciar pedidos",
      icon: Package,
      path: "/PedidosVenda",
      color: "from-blue-500 to-blue-600",
      stat: stats.pedidos
    },
    {
      title: "Notas Fiscais",
      description: "Emitir e gerenciar NF-e",
      icon: FileText,
      path: "/NotasFiscais",
      color: "from-green-500 to-green-600",
      stat: stats.notasFiscais
    },
    {
      title: "Clientes",
      description: "Cadastro e gestão de clientes",
      icon: Users,
      path: "/ClientesFiscais",
      color: "from-purple-500 to-purple-600",
      stat: stats.clientes
    },
    {
      title: "Financeiro",
      description: "Contas a receber e pagamentos",
      icon: TrendingUp,
      path: "/FinanceiroContas",
      color: "from-orange-500 to-orange-600",
      stat: `R$ ${stats.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    },
    {
      title: "Frete e Entrega",
      description: "Gerenciar entregas",
      icon: Truck,
      path: "/FreteEntrega",
      color: "from-indigo-500 to-indigo-600",
      stat: null
    },
    {
      title: "Configurações Fiscais",
      description: "Dados da empresa e certificado",
      icon: Settings,
      path: "/ConfiguracaoFiscal",
      color: "from-slate-500 to-slate-600",
      stat: null
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-green-600 rounded-2xl shadow-lg">
              <Receipt className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Financeiro & Fiscal
              </h1>
              <p className="text-gray-600">Central de vendas, faturamento e logística</p>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600">Total de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{stats.pedidos}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600">Notas Fiscais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.notasFiscais}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600">Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{stats.clientes}</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-600">Faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">
                R$ {stats.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}>
                <Card className="group hover:shadow-2xl transition-all duration-300 cursor-pointer bg-white/80 backdrop-blur-sm border-2 hover:border-blue-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-4 bg-gradient-to-br ${item.color} rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      {item.stat && (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{item.stat}</p>
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-xl mt-4">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{item.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
          <CardHeader>
            <CardTitle className="text-white">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Link to="/PedidosVenda?novo=true">
              <Button variant="secondary" className="gap-2">
                <Package className="w-4 h-4" />
                Novo Pedido
              </Button>
            </Link>
            <Link to="/ClientesFiscais?novo=true">
              <Button variant="secondary" className="gap-2">
                <Users className="w-4 h-4" />
                Novo Cliente
              </Button>
            </Link>
            <Link to="/NotasFiscais?emitir=true">
              <Button variant="secondary" className="gap-2">
                <FileText className="w-4 h-4" />
                Emitir NF-e
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}