import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Package, 
  Users, 
  ShoppingCart, 
  TrendingUp,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalSuppliers: 0,
    myProducts: 0,
    activeProducts: 0,
    totalOrcamentos: 0,
    totalVendas: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      // Verificar se há dados de registro de fabricante no localStorage
      const fabricanteData = localStorage.getItem('fabricante_registration_data');
      // Verificar se há dados de registro de transportador no localStorage
      const transportadorData = localStorage.getItem('transportador_registration_data');
      if (transportadorData) {
        try {
          const data = JSON.parse(transportadorData);
          await base44.entities.User.update(currentUser.id, {
            empresa: data.empresa,
            cnpj: data.cnpj,
            endereco: data.endereco,
            whatsapp: data.whatsapp,
            site: data.site,
            tipo_usuario: 'transportador',
            aprovado: false
          });
          localStorage.removeItem('transportador_registration_data');
          window.location.reload();
          return;
        } catch (error) {
          console.error("Erro ao aplicar dados do transportador:", error);
          localStorage.removeItem('transportador_registration_data');
          toast({
            title: "Erro no cadastro",
            description: "Erro ao completar cadastro. Tente novamente pelo perfil.",
            variant: "destructive"
          });
        }
      }

      if (fabricanteData) {
        try {
          const data = JSON.parse(fabricanteData);
          // Atualizar o perfil do usuário com os dados do fabricante
          await base44.entities.User.update(currentUser.id, {
            empresa: data.empresa,
            cnpj: data.cnpj,
            endereco: data.endereco,
            whatsapp: data.whatsapp,
            site: data.site,
            logomarca: data.logomarca,
            historia_empresa: data.historia_empresa,
            tipo_usuario: 'fabricante',
            aprovado: false
          });
          // Limpar localStorage
          localStorage.removeItem('fabricante_registration_data');
          // Recarregar página para pegar dados atualizados
          window.location.reload();
          return;
        } catch (error) {
          console.error("Erro ao aplicar dados do fabricante:", error);
          localStorage.removeItem('fabricante_registration_data');
          toast({
            title: "Erro no cadastro",
            description: "Erro ao completar cadastro. Tente novamente pelo perfil.",
            variant: "destructive"
          });
        }
      }
      
      setUser(currentUser);

      const products = await base44.entities.Product.list();
      const suppliers = await base44.entities.User.filter({ role: 'user' });

      let myProductsCount = 0;
      let activeProductsCount = 0;
      let totalOrcamentos = 0;
      let totalVendas = 0;

      if (currentUser.role === 'user' || currentUser.tipo_usuario === 'fabricante') {
        const mySupplierProducts = await base44.entities.SupplierProduct.filter({ supplier_id: currentUser.id });
        myProductsCount = mySupplierProducts.length;
        activeProductsCount = mySupplierProducts.filter(sp => sp.disponivel && sp.preco > 0).length;

        // Buscar orçamentos e vendas
        const orcamentos = await base44.entities.Pedido.filter({ 
          fornecedor_id: currentUser.id,
          tipo: 'orcamento'
        });
        const vendas = await base44.entities.Pedido.filter({ 
          fornecedor_id: currentUser.id,
          tipo: 'venda'
        });

        totalOrcamentos = orcamentos.length;
        totalVendas = vendas.length;
      }

      setStats({
        totalProducts: products.length,
        totalSuppliers: suppliers.length,
        myProducts: myProductsCount,
        activeProducts: activeProductsCount,
        totalOrcamentos: totalOrcamentos,
        totalVendas: totalVendas
      });

      // Simular atividade recente
      setRecentActivity([
        { action: "Produto adicionado", item: "Esteira Profissional X1", time: "2 horas atrás", type: "success" },
        { action: "Preço atualizado", item: "Halteres 10kg", time: "1 dia atrás", type: "info" },
        { action: "Novo fornecedor", item: "FitTech Equipamentos", time: "2 dias atrás", type: "success" }
      ]);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const getWelcomeMessage = () => {
    if (user?.role === 'admin') {
      return {
        title: "Bem-vindo, Administrador!",
        subtitle: "Gerencie o catálogo e fornecedores da PlaceFit"
      };
    }
    if (user?.tipo_usuario === 'fabricante') {
      return {
        title: `Olá, ${user?.empresa || user?.full_name}!`,
        subtitle: "Cadastre e gerencie seus produtos fabricados"
      };
    }
    if (user?.tipo_usuario === 'transportador') {
      return {
        title: `Olá, ${user?.empresa || user?.full_name}!`,
        subtitle: "Gerencie suas rotas e ofertas de frete"
      };
    }
    return {
      title: `Olá, ${user?.empresa || user?.full_name}!`,
      subtitle: "Configure seus produtos e gere tabelas personalizadas"
    };
  };

  const getActionCards = () => {
    if (user?.role === 'admin') {
      return [
        {
          title: "Gerenciar Produtos",
          description: "Adicione, edite ou remova produtos do catálogo mestre",
          icon: Package,
          href: createPageUrl("Products"),
          color: "from-blue-500 to-blue-600",
          count: stats.totalProducts
        },
        {
          title: "Fornecedores",
          description: "Visualize e gerencie todos os fornecedores cadastrados",
          icon: Users,
          href: createPageUrl("Suppliers"),
          color: "from-green-500 to-green-600",
          count: stats.totalSuppliers
        },
        {
          title: "Fabricantes",
          description: "Gerencie fabricantes e seus produtos cadastrados",
          icon: Package,
          href: createPageUrl("Fabricantes"),
          color: "from-purple-500 to-purple-600",
          count: 0
        },
        {
          title: "Transportadoras",
          description: "Gerencie transportadoras e suas rotas de frete",
          icon: TrendingUp,
          href: createPageUrl("Transportadores"),
          color: "from-orange-500 to-red-600",
          count: 0
        }
      ];
    }

    return [
      {
        title: "Meus Produtos",
        description: "Selecione produtos e defina preços e disponibilidade",
        icon: ShoppingCart,
        href: createPageUrl("MyProducts"),
        color: "from-blue-500 to-blue-600",
        count: stats.myProducts
      },
      {
        title: "Orçamentos",
        description: "Crie e gerencie orçamentos para seus clientes",
        icon: Package,
        href: createPageUrl("Orcamentos"),
        color: "from-amber-500 to-orange-600",
        count: 0
      },
      {
        title: "Vendas",
        description: "Gerencie seus pedidos de venda e histórico",
        icon: ShoppingCart,
        href: createPageUrl("Vendas"),
        color: "from-green-500 to-emerald-600",
        count: 0
      },
      {
        title: "Sua Tabela",
        description: "Gere, exporte e compartilhe sua tabela personalizada de preços",
        icon: TrendingUp,
        href: createPageUrl("Export"),
        color: "from-purple-500 to-purple-600",
        count: stats.activeProducts
      }
    ];
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { title, subtitle } = getWelcomeMessage();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">
            {title}
          </h1>
          <p className="text-gray-600 text-lg">{subtitle}</p>
        </div>

        {/* Aprovação do fornecedor/fabricante/transportador */}
        {((user?.role === 'user' || user?.tipo_usuario === 'fabricante' || user?.tipo_usuario === 'transportador') && !user?.aprovado) && (
          <Alert className="border-amber-200 bg-amber-50">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Sua conta está aguardando aprovação. Em breve você poderá acessar todos os recursos da plataforma.
            </AlertDescription>
          </Alert>
        )}

        {/* Banner Especial de Frete - Apenas para Fornecedores */}
        {user?.role === 'user' && user?.aprovado && (
          <Link to={createPageUrl("Frete")}>
            <Card className="group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 border-0 overflow-hidden relative">
              <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
              <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
              
              <CardContent className="p-8 relative z-10">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                      <h3 className="text-2xl font-bold text-white">
                        🚚 Publique suas Ofertas de Frete
                      </h3>
                      <Badge className="bg-yellow-400 text-yellow-900 font-bold animate-pulse">
                        NOVO!
                      </Badge>
                    </div>
                    <p className="text-white/90 text-lg mb-4">
                      Conecte-se com caminhoneiros e otimize sua logística! Publique suas demandas de frete e encontre rotas de complemento rapidamente.
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-white/80">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Redução de custos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Mais agilidade</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Conexão direta</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <Button 
                      className="bg-white text-red-600 hover:bg-gray-100 font-bold text-lg px-8 py-6 rounded-xl shadow-xl group-hover:scale-105 transition-transform duration-300"
                    >
                      Começar Agora
                      <TrendingUp className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Cards de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {getActionCards().map((card, index) => (
            <Link key={index} to={card.href}>
              <Card className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${card.color} shadow-lg`}>
                      <card.icon className="w-6 h-6 text-white" />
                    </div>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 font-semibold">
                      {card.count}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">{card.description}</p>
                  <Button 
                    variant="ghost" 
                    className="group-hover:bg-gradient-to-r group-hover:from-blue-50 group-hover:to-green-50 group-hover:text-blue-700 transition-all duration-300 w-full justify-center"
                  >
                    Acessar
                    <Plus className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Estatísticas Rápidas */}
        {user?.role === 'admin' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-900">{stats.totalSuppliers}</div>
                <p className="text-sm text-green-700">Fornecedores</p>
              </CardContent>
            </Card>
          </div>
        )}

        {(user?.role === 'user' || user?.tipo_usuario === 'fabricante') && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
              <CardContent className="p-4 text-center">
                <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-900">{stats.activeProducts}</div>
                <p className="text-sm text-blue-700">Produtos Ativos</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 border">
              <CardContent className="p-4 text-center">
                <ShoppingCart className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-900">{stats.totalOrcamentos}</div>
                <p className="text-sm text-amber-700">Orçamentos</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-900">{stats.totalVendas}</div>
                <p className="text-sm text-green-700">Pedidos</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Atividade Recente */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`p-2 rounded-full ${
                    activity.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {activity.type === 'success' ? 
                      <CheckCircle className="w-4 h-4" /> : 
                      <AlertCircle className="w-4 h-4" />
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activity.action}</p>
                    <p className="text-sm text-gray-600">{activity.item}</p>
                  </div>
                  <span className="text-sm text-gray-500">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}