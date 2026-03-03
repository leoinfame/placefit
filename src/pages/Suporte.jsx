import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import OnboardingTour from "@/components/OnboardingTour";
import { HelpCircle, PlayCircle, MessageCircle, BookOpen, RotateCcw, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ_DATA = {
  revendedor: [
    {
      pergunta: "Como adiciono produtos para revender?",
      resposta: "Acesse o menu 'Meus Produtos', clique em 'Adicionar Produto', busque no catálogo os produtos que deseja revender, defina seu preço e clique em Salvar. Seu produto estará ativo para gerar orçamentos."
    },
    {
      pergunta: "Como crio um orçamento para meu cliente?",
      resposta: "Vá em 'Orçamentos', clique em 'Novo Orçamento', selecione o cliente (ou cadastre um novo), adicione os produtos e quantidades desejadas e clique em Gerar Orçamento. Você pode enviar o PDF diretamente pelo WhatsApp."
    },
    {
      pergunta: "Como converto um orçamento em venda?",
      resposta: "Na listagem de Orçamentos, clique no orçamento desejado e clique no botão 'Converter em Venda'. O sistema gera automaticamente os pedidos de compra para os fabricantes correspondentes."
    },
    {
      pergunta: "Como gero minha tabela de preços personalizada?",
      resposta: "Acesse 'Sua Tabela' no menu. Lá você pode visualizar, exportar em PDF, copiar o link público e compartilhar por WhatsApp. A tabela já vem formatada com o nome e logo da sua empresa."
    },
    {
      pergunta: "Como cadastro um cliente?",
      resposta: "Vá em 'Meus Clientes' e clique em 'Novo Cliente'. Preencha o CPF/CNPJ (o sistema pode buscar os dados automaticamente) e complete as informações de contato e endereço."
    },
    {
      pergunta: "Como funciona o frete na plataforma?",
      resposta: "Acesse o menu 'Frete'. Você pode publicar uma demanda de frete informando cidade, estado e peso. As transportadoras cadastradas na plataforma podem te oferecer seus serviços de acordo com as rotas disponíveis."
    },
    {
      pergunta: "Como peço suporte ao Atendente IA?",
      resposta: "Acesse 'Atendente IA' no menu lateral. Você pode fazer perguntas sobre produtos, fabricantes, preços e processos. O assistente responde com base no conhecimento atualizado da plataforma."
    }
  ],
  fabricante: [
    {
      pergunta: "Como cadastro meus produtos?",
      resposta: "Acesse 'Meus Produtos' e clique em 'Novo Produto'. Preencha nome, código SKU, categoria, peso, dimensões, foto e preço sugerido. Após salvar, o produto entra em análise para aprovação pelo administrador PlaceFit."
    },
    {
      pergunta: "Como importo minha linha de produtos de uma vez?",
      resposta: "Em 'Meus Produtos', clique em 'Importar CSV'. Baixe o modelo de planilha, preencha com seus produtos e faça o upload. O sistema processa e cadastra em lote, economizando horas de trabalho manual."
    },
    {
      pergunta: "Como recebo os pedidos de compra dos revendedores?",
      resposta: "Sempre que um revendedor confirmar uma venda com seus produtos, um pedido de compra é gerado automaticamente em 'Pedidos'. Você recebe uma notificação e pode acompanhar status, itens, quantidades e dados de entrega."
    },
    {
      pergunta: "Como atualizo o status de um pedido de compra?",
      resposta: "Em 'Pedidos', clique no pedido desejado e use os botões de status: Confirmar, Em Produção, Despachado ou Recebido. O revendedor é notificado automaticamente a cada atualização."
    },
    {
      pergunta: "Como gero minha tabela de preços?",
      resposta: "Acesse 'Sua Tabela'. Você pode exportar em PDF, compartilhar o link público com revendedores e enviar via WhatsApp. A tabela é formatada com sua marca e linha completa de produtos."
    },
    {
      pergunta: "Meu produto ficou com status 'Aguardando Aprovação'. O que fazer?",
      resposta: "Produtos cadastrados por fabricantes passam por uma revisão do administrador PlaceFit antes de ficarem visíveis no catálogo. O processo costuma levar até 24 horas úteis. Caso demore mais, entre em contato pelo suporte."
    }
  ],
  transportador: [
    {
      pergunta: "Como cadastro minhas rotas?",
      resposta: "Acesse 'Minhas Rotas' e clique em 'Nova Rota'. Selecione o estado, informe as cidades atendidas, a periodicidade (semanal, quinzenal) e os dias de carregamento. Sua rota ficará visível para os revendedores daquela região."
    },
    {
      pergunta: "Como encontro demandas de frete disponíveis?",
      resposta: "Em 'Minhas Rotas', role para baixo para ver as ofertas de frete publicadas pelos revendedores. Você pode filtrar por estado e visualizar cidade, peso e observações de cada demanda."
    },
    {
      pergunta: "Como os revendedores me encontram?",
      resposta: "Quando um revendedor acessa o menu 'Frete', a plataforma exibe as transportadoras com rotas cadastradas para o estado de destino. Por isso, quanto mais rotas você cadastrar, mais visibilidade você tem."
    },
    {
      pergunta: "Como mantenho meu perfil atualizado?",
      resposta: "Acesse 'Perfil' no menu lateral. Mantenha CNPJ, endereço, WhatsApp e informações da empresa atualizados. Um perfil completo passa mais confiança para os revendedores que buscam frete."
    },
    {
      pergunta: "Posso desativar uma rota temporariamente?",
      resposta: "Sim! Em 'Minhas Rotas', cada rota tem um botão para ativar/desativar. Quando desativada, ela deixa de aparecer para os revendedores sem que você precise excluir os dados."
    }
  ]
};

export default function Suporte() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const getTipoUsuario = () => {
    if (!user) return "revendedor";
    if (user.tipo_usuario === "fabricante") return "fabricante";
    if (user.tipo_usuario === "transportador") return "transportador";
    return "revendedor";
  };

  const getTipoLabel = () => {
    const tipo = getTipoUsuario();
    if (tipo === "fabricante") return "Fabricante";
    if (tipo === "transportador") return "Transportadora";
    return "Revendedor";
  };

  const getTipoColor = () => {
    const tipo = getTipoUsuario();
    if (tipo === "fabricante") return "bg-green-100 text-green-800";
    if (tipo === "transportador") return "bg-orange-100 text-orange-800";
    return "bg-blue-100 text-blue-800";
  };

  const faqList = FAQ_DATA[getTipoUsuario()] || [];

  const handleRestartTour = () => {
    localStorage.removeItem("placefit_tour_done");
    setShowTour(true);
  };

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      {showTour && (
        <OnboardingTour
          onClose={() => setShowTour(false)}
          tipoUsuario={getTipoUsuario()}
        />
      )}

      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Central de Suporte</h1>
            <Badge className={getTipoColor()}>{getTipoLabel()}</Badge>
          </div>
          <p className="text-gray-500">Encontre respostas rápidas e reveja o tutorial de primeiros passos.</p>
        </div>

        {/* Card Rever Tour */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-green-600 text-white overflow-hidden relative">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-4 relative z-10">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <PlayCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-lg font-bold mb-1">Rever o Tutorial de Primeiro Acesso</h2>
              <p className="text-white/80 text-sm">Reveja o passo a passo personalizado para o seu perfil de {getTipoLabel()}. Leva menos de 2 minutos.</p>
            </div>
            <Button
              onClick={handleRestartTour}
              className="bg-white text-blue-700 hover:bg-gray-100 font-semibold flex items-center gap-2 flex-shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              Iniciar Tutorial
            </Button>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg font-bold text-gray-900">
                Perguntas Frequentes — {getTipoLabel()}
              </CardTitle>
            </div>
            <p className="text-sm text-gray-500 mt-1">As dúvidas mais comuns do seu perfil, respondidas de forma objetiva.</p>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {faqList.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border border-gray-100 rounded-xl px-4 data-[state=open]:bg-blue-50/50 transition-colors"
                >
                  <AccordionTrigger className="text-left font-medium text-gray-800 hover:text-blue-700 hover:no-underline py-4 text-sm">
                    {item.pergunta}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 text-sm pb-4 leading-relaxed">
                    {item.resposta}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-bold text-gray-900">Não encontrou o que precisava?</h3>
              <p className="text-sm text-gray-500 mt-0.5">Fale com nossa equipe pelo WhatsApp. Atendimento de segunda a sexta, das 8h às 18h.</p>
            </div>
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20PlaceFit"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 flex-shrink-0">
                <MessageCircle className="w-4 h-4" />
                Falar no WhatsApp
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}