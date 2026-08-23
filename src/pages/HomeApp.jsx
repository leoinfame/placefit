import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import SignupDialog from "@/components/home/SignupDialog";
import {
  Building2,
  Package,
  TrendingUp,
  FileText,
  Globe,
  Users,
  ShoppingCart,
  ClipboardList,
  Truck,
  Calculator,
  ArrowRight,
  Check,
} from "lucide-react";

const PLACEFIT_LOGO =
  "https://media.base44.com/images/public/68c9d5dd3cf0f8fd8a834875/574e5a0a6_logo-ico-removebg-preview1.png";

const MODULES = [
  { icon: Building2, title: "Fornecedores e fabricantes", desc: "Rede de fornecedores nacionais e internacionais conectados diretamente." },
  { icon: Package, title: "Produtos e comparação de preços", desc: "Compare preços entre fabricantes sem intermediários." },
  { icon: TrendingUp, title: "Formação de preços e margens", desc: "Calcule margens, comissões e preços de revenda automaticamente." },
  { icon: FileText, title: "Tabela comercial e catálogo", desc: "Gere tabelas e catálogos em PDF com sua marca." },
  { icon: Globe, title: "Site ou vitrine digital", desc: "Publique sua loja online com checkout integrado." },
  { icon: Users, title: "CRM, clientes e atendimento", desc: "Gerencie conversas, clientes e atendimento via WhatsApp." },
  { icon: ShoppingCart, title: "Orçamentos e vendas", desc: "Crie orçamentos profissionais e converta em vendas." },
  { icon: ClipboardList, title: "Pedidos de compra", desc: "Gere pedidos de compra para fornecedores com um clique." },
  { icon: Truck, title: "Transportadoras e logística", desc: "Calcule fretes automaticamente por estado e peso." },
  { icon: Calculator, title: "Financeiro e documentos fiscais", desc: "Controle financeiro, notas fiscais e documentos." },
];

export default function HomeApp() {
  const [showSignup, setShowSignup] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);

  useEffect(() => {
    checkAuth();
    loadPlanos();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const u = await base44.auth.me();
        setAuthUser(u);
      }
    } catch {
      // not auth
    }
  };

  const loadPlanos = async () => {
    try {
      const data = await base44.entities.PlanoServico.filter({ ativo: true });
      setPlanos(data);
    } catch {
      setPlanos([]);
    }
    setLoadingPlanos(false);
  };

  const handleEntrar = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        window.location.href = "/app";
      } else {
        base44.auth.redirectToLogin("/app");
      }
    } catch {
      base44.auth.redirectToLogin("/app");
    }
  };

  const handleAssinar = async () => {
    if (authUser) {
      window.location.href = "/MinhaConta";
    } else {
      setShowSignup(true);
    }
  };

  const fmtPreco = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 sticky top-0 bg-gray-950/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={PLACEFIT_LOGO} alt="PlaceFit" className="h-8 w-auto object-contain" />
            <span className="font-bold text-lg tracking-tight">PlaceFit</span>
          </div>
          <Button
            variant="outline"
            onClick={handleEntrar}
            className="border-gray-700 text-white hover:bg-gray-800 hover:text-white"
          >
            {authUser ? "Ir para o app" : "Entrar"}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Da cotação à entrega.
            <br />
            <span className="text-green-500">Toda a sua operação fitness em um só lugar.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
            O PlaceFit conecta fornecedores, produtos, preços, clientes, orçamentos,
            pedidos, compras, fretes e resultados em uma única plataforma.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleAssinar}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8 text-base"
            >
              Assinar o PlaceFit
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={handleEntrar}
              size="lg"
              className="border-gray-700 text-white hover:bg-gray-800 hover:text-white px-8 text-base"
            >
              Entrar
            </Button>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="py-20 px-6 bg-gray-900 border-y border-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">
            Tudo que você precisa para vender
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((m) => (
              <div
                key={m.title}
                className="bg-gray-950 border border-gray-800 rounded-xl p-6 hover:border-green-600/50 transition-colors"
              >
                <m.icon className="w-8 h-8 text-green-500 mb-4" />
                <h3 className="font-semibold text-white mb-2">{m.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-4">
            Planos e recursos
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            A mensalidade do PlaceFit dá acesso a todos os recursos base.
            Recursos avulsos podem ser contratados separadamente dentro da sua conta.
          </p>

          {loadingPlanos ? (
            <div className="text-center text-gray-500">Carregando planos...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {planos.map((p) => {
                const isBase = p.slug === "mensalidade_padrao";
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-6 ${
                      isBase
                        ? "border-green-600 bg-green-600/10"
                        : "border-gray-800 bg-gray-900"
                    }`}
                  >
                    {isBase && (
                      <span className="inline-block text-xs font-bold uppercase tracking-wider text-green-500 mb-2">
                        Plano base
                      </span>
                    )}
                    <h3 className="text-xl font-bold text-white">{p.nome}</h3>
                    <p className="text-3xl font-bold text-white mt-2">
                      {fmtPreco(p.preco_mensal)}
                      <span className="text-sm font-normal text-gray-400">/mês</span>
                    </p>
                    {p.descricao && (
                      <p className="text-sm text-gray-400 mt-3">{p.descricao}</p>
                    )}
                    {p.beneficios && p.beneficios.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {p.beneficios.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      onClick={handleAssinar}
                      className={`mt-6 w-full ${
                        isBase
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                      }`}
                    >
                      {isBase ? "Assinar agora" : "Contratar recurso"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-green-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Comece hoje. 30 dias grátis.
          </h2>
          <p className="mt-4 text-green-50 text-lg">
            Sem cartão de crédito. Cancele quando quiser.
          </p>
          <Button
            onClick={handleAssinar}
            size="lg"
            className="mt-8 bg-gray-950 text-white hover:bg-gray-900 px-8 text-base"
          >
            Assinar o PlaceFit
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img src={PLACEFIT_LOGO} alt="PlaceFit" className="h-6 w-auto object-contain" />
            <span className="text-sm text-gray-500">© 2026 PlaceFit</span>
          </div>
          <p className="text-sm text-gray-500">
            Da cotação à entrega. Toda a sua operação fitness em um só lugar.
          </p>
        </div>
      </footer>

      <SignupDialog open={showSignup} onClose={() => setShowSignup(false)} />
    </div>
  );
}