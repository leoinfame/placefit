import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Package, 
  Store, 
  Truck, 
  ShoppingCart,
  ArrowRight,
  CheckCircle,
  Building2,
  Users,
  TrendingUp,
  Copy,
  MessageCircle,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PLACEFIT_LOGO = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c9d5dd3cf0f8fd8a834875/b1ab9fc90_WhatsAppImage2025-10-16at023605.jpeg";

export default function Convite() {
  const conviteLink = `${window.location.origin}/Convite`;

  const copyLink = () => {
    navigator.clipboard.writeText(conviteLink);
    alert("Link copiado!");
  };

  const shareWhatsApp = () => {
    const text = `Cadastre-se na PlaceFit - O Ecossistema Digital que Conecta Toda a Cadeia de Suprimentos do Fitness! ${conviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareTelegram = () => {
    const text = `Cadastre-se na PlaceFit - O Ecossistema Digital que Conecta Toda a Cadeia de Suprimentos do Fitness`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(conviteLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };
  const userTypes = [
    {
      title: "Fabricante",
      icon: Package,
      description: "Gerencie produtos e tabelas de preços. Receba pedidos automatizados. Otimize logística com visibilidade total.",
      color: "from-purple-500 to-purple-600",
      hoverColor: "hover:from-purple-600 hover:to-purple-700",
      bgColor: "bg-purple-50",
      link: "/PublicRegisterFabricante",
      buttonText: "PROGRAMA PILOTO",
      buttonSubtext: "Junte-se ao programa piloto e seja parte da transformação desde o início",
      benefits: [
        "Maior Visualização dos produtos",
        "Aumento de Vendas qualificado",
        "Visibilidade Total do ciclo",
        "Gestão Logística integrada"
      ]
    },
    {
      title: "Revendedor",
      icon: Store,
      description: "Acesse catálogos multi-fabricante. Crie orçamentos profissionais. Gerencie clientes e negocie fretes.",
      color: "from-blue-500 to-blue-600",
      hoverColor: "hover:from-blue-600 hover:to-blue-700",
      bgColor: "bg-blue-50",
      link: "/PublicRegister",
      buttonText: "CADASTRO GRÁTIS",
      buttonSubtext: "Cadastre-se gratuitamente e comece a vender com mais inteligência",
      benefits: [
        "Catálogos Completos em um lugar",
        "Orçamentos Rápidos e profissionais",
        "Gestão Centralizada de clientes",
        "Ofertas de Frete otimizadas"
      ]
    },
    {
      title: "Transportador",
      icon: Truck,
      description: "Encontre ofertas de frete compatíveis. Otimize rotas e ocupação de carga. Divulgue rotas futuras.",
      color: "from-orange-500 to-orange-600",
      hoverColor: "hover:from-orange-600 hover:to-orange-700",
      bgColor: "bg-orange-50",
      link: "/PublicRegisterTransportador",
      buttonText: "ACESSAR OFERTAS",
      buttonSubtext: "Acesse ofertas de frete e otimize suas rotas agora mesmo",
      benefits: [
        "Ofertas Compatíveis com rotas",
        "Maior Ocupação dos veículos",
        "Negociação Direta com embarcadores",
        "Redução de Ociosidade"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <div className="flex items-center gap-2">
              <Button
                onClick={copyLink}
                variant="outline"
                size="sm"
                className="text-gray-700 hover:bg-gray-100"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Link
              </Button>
              <Button
                onClick={shareWhatsApp}
                variant="outline"
                size="sm"
                className="text-green-600 hover:bg-green-50"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                onClick={shareTelegram}
                variant="outline"
                size="sm"
                className="text-blue-600 hover:bg-blue-50"
              >
                <Send className="w-4 h-4 mr-2" />
                Telegram
              </Button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <img
              src={PLACEFIT_LOGO}
              alt="PlaceFit"
              className="w-20 h-20 object-contain"
            />
            <div className="text-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">
                Bem-vindo ao PlaceFit
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                O Ecossistema Digital que Conecta Toda a Cadeia de Suprimentos do Fitness
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Call to Action Principal */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Escolha o perfil ideal para você
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Seja você um fabricante querendo expandir sua distribuição, um revendedor buscando os melhores preços, 
            ou um transportador otimizando suas rotas - temos a solução perfeita para você!
          </p>
        </div>

        {/* Cards de Tipos de Usuário */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {userTypes.map((type, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-2xl transition-all duration-300 border-0 bg-white overflow-hidden transform hover:-translate-y-2"
            >
              <CardHeader className={`${type.bgColor} border-b`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-4 rounded-xl bg-gradient-to-r ${type.color} shadow-lg`}>
                    <type.icon className="w-8 h-8 text-white" />
                  </div>
                  <Badge variant="secondary" className="bg-white text-gray-700">
                    Gratuito
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  {type.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="p-6">
                <p className="text-gray-600 mb-6 min-h-[80px]">
                  {type.description}
                </p>

                <div className="space-y-3 mb-6">
                  {type.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 text-center mb-2">
                    {type.buttonSubtext}
                  </p>
                </div>
                
                <a href={type.link}>
                  <Button 
                    className={`w-full bg-gradient-to-r ${type.color} ${type.hoverColor} text-white font-semibold py-6 text-lg group-hover:scale-105 transition-transform`}
                  >
                    {type.buttonText}
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Banner do Marketplace */}
        <Card className="bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 border-0 overflow-hidden relative">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          
          <CardContent className="p-8 md:p-12 relative z-10">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <ShoppingCart className="w-10 h-10 text-white" />
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-3xl font-bold text-white mb-3">
                  Explore o Marketplace
                </h3>
                <p className="text-white/90 text-lg mb-6">
                  Navegue por milhares de produtos fitness, compare preços de diferentes revendedores e fabricantes, 
                  tudo em um só lugar. Sem cadastro necessário!
                </p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <div className="flex items-center gap-2 text-white">
                    <TrendingUp className="w-5 h-5" />
                    <span>Compare preços</span>
                  </div>
                  <div className="flex items-center gap-2 text-white">
                    <Users className="w-5 h-5" />
                    <span>Múltiplos revendedores</span>
                  </div>
                  <div className="flex items-center gap-2 text-white">
                    <Building2 className="w-5 h-5" />
                    <span>Fabricantes diretos</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-shrink-0">
                <Link to={createPageUrl("Marketplace")}>
                  <Button 
                    size="lg"
                    className="bg-white text-blue-600 hover:bg-gray-100 font-bold text-xl px-10 py-7 rounded-xl shadow-2xl hover:scale-105 transition-transform"
                  >
                    Acessar Marketplace
                    <ArrowRight className="w-6 h-6 ml-3" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-2">
                1000+
              </div>
              <p className="text-sm text-gray-600">Produtos Disponíveis</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-2">
                50+
              </div>
              <p className="text-sm text-gray-600">Fabricantes Parceiros</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent mb-2">
                200+
              </div>
              <p className="text-sm text-gray-600">Revendedores Ativos</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent mb-2">
                100%
              </div>
              <p className="text-sm text-gray-600">Gratuito</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-600">
          <p className="text-sm mb-2">
            © 2024 PlaceFit - Conectando o mercado fitness
          </p>
          <p className="text-xs">
            Cadastro gratuito • Suporte dedicado • Resultados garantidos
          </p>
        </div>
      </div>
    </div>
  );
}