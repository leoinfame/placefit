import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { X, ChevronRight, ChevronLeft, CheckCircle, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DEFAULT_TOUR_STEPS = [
  {
    title: "Bem-vindo ao PlaceFit! 🎉",
    description: "Você acaba de entrar na plataforma de revendedores de equipamentos fitness. Vamos te mostrar um tour rápido pelos principais recursos. São apenas 8 passos!",
    icon: "🏋️",
    highlight: null,
    isIntro: true,
  },
  {
    title: "Painel (Dashboard)",
    description: "Esta é sua página inicial. Aqui você vê um resumo de tudo: seus produtos ativos, orçamentos, pedidos e acesso rápido às principais seções.",
    icon: "📊",
    highlight: "Dashboard",
    menuItem: "Painel",
  },
  {
    title: "Catálogo",
    description: "Explore o catálogo completo de produtos disponíveis na plataforma. Você pode visualizar todos os produtos dos fabricantes e escolher quais quer revender.",
    icon: "📋",
    highlight: "Catalogo",
    menuItem: "Catálogo",
  },
  {
    title: "Fabricantes",
    description: "Veja todos os fabricantes parceiros da PlaceFit. Acesse o perfil, catálogo e informações de contato de cada fabricante para fazer seus pedidos de compra.",
    icon: "🏭",
    highlight: "FabricantesRevendedor",
    menuItem: "Fabricantes",
  },
  {
    title: "Meus Produtos",
    description: "Selecione os produtos que você vai revender, defina seus preços e disponibilidade. Esses produtos formarão a sua tabela personalizada de preços.",
    icon: "🛒",
    highlight: "MyProducts",
    menuItem: "Meus Produtos",
  },
  {
    title: "Meus Clientes",
    description: "Cadastre e gerencie sua carteira de clientes. Mantenha os dados atualizados para agilizar a criação de orçamentos e pedidos.",
    icon: "👥",
    highlight: "Clientes",
    menuItem: "Meus Clientes",
  },
  {
    title: "Orçamentos e Vendas",
    description: "Crie orçamentos para seus clientes e converta-os em vendas. Ao confirmar uma venda, os pedidos de compra para os fabricantes são gerados automaticamente.",
    icon: "💼",
    highlight: "Orcamentos",
    menuItem: "Orçamentos / Vendas",
  },
  {
    title: "Sua Tabela de Preços",
    description: "Gere, exporte e compartilhe sua tabela de preços personalizada com sua marca. Envie por WhatsApp, e-mail ou gere um PDF profissional.",
    icon: "📄",
    highlight: "Export",
    menuItem: "Sua Tabela",
  },
  {
    title: "Tudo pronto! 🚀",
    description: "Agora você conhece os principais recursos. Comece adicionando seus produtos em 'Meus Produtos' e já crie seu primeiro orçamento. Qualquer dúvida, use o Atendente IA disponível no menu!",
    icon: "✅",
    highlight: null,
    isOutro: true,
    cta: { label: "Ir para Meus Produtos", page: "MyProducts" },
  },
];

export default function OnboardingTour({ onClose }) {
  const [step, setStep] = useState(0);
  const current = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  const progress = Math.round((step / (TOUR_STEPS.length - 1)) * 100);

  const handleClose = () => {
    localStorage.setItem("placefit_tour_done", "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <Badge variant="secondary" className="text-xs">
            Passo {step + 1} de {TOUR_STEPS.length}
          </Badge>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 text-center">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{current.title}</h2>
          <p className="text-gray-600 leading-relaxed text-sm">{current.description}</p>

          {current.menuItem && (
            <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <span className="text-blue-700 text-sm font-medium">📌 Menu: {current.menuItem}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(s => s - 1)}
            disabled={isFirst}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </Button>

          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step ? "w-4 h-2 bg-blue-500" : "w-2 h-2 bg-gray-300"
                }`}
              />
            ))}
          </div>

          {isLast ? (
            current.cta ? (
              <Link to={createPageUrl(current.cta.page)} onClick={handleClose}>
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-green-600 text-white flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {current.cta.label}
                </Button>
              </Link>
            ) : (
              <Button size="sm" onClick={handleClose} className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
                Concluir
              </Button>
            )
          ) : (
            <Button
              size="sm"
              onClick={() => setStep(s => s + 1)}
              className="bg-gradient-to-r from-blue-600 to-green-600 text-white flex items-center gap-1"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Skip */}
        {!isLast && (
          <div className="text-center pb-3">
            <button onClick={handleClose} className="text-xs text-gray-400 hover:text-gray-600 underline">
              Pular tour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}