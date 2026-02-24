import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare, Send, Bot, User, Loader2, X, Package, DollarSign, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

export default function AtendenteIARevendedor() {
  const [user, setUser] = useState(null);
  const [myProducts, setMyProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Carregar produtos do revendedor (SupplierProduct)
      const supplierProducts = await base44.entities.SupplierProduct.filter({
        supplier_id: currentUser.id
      });

      // Buscar detalhes dos produtos
      const productIds = supplierProducts.map(sp => sp.product_id);
      const allProducts = await base44.entities.Product.list();
      
      const productsWithPrices = supplierProducts.map(sp => {
        const product = allProducts.find(p => p.id === sp.product_id);
        return {
          ...product,
          preco_revendedor: sp.preco,
          disponivel: sp.disponivel,
          observacoes_revendedor: sp.observacoes
        };
      }).filter(p => p && p.disponivel !== false);

      setMyProducts(productsWithPrices);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar seus dados. Tente novamente.",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      // Criar contexto com dados do revendedor
      const revendedorInfo = `
═══════════════════════════════════════════════════════════════
🏢 INFORMAÇÕES DO REVENDEDOR:
═══════════════════════════════════════════════════════════════

EMPRESA: ${user.empresa || user.full_name}
${user.whatsapp ? `WHATSAPP: ${user.whatsapp}` : ''}
${user.email ? `EMAIL: ${user.email}` : ''}
${user.site ? `WEBSITE: ${user.site}` : ''}
${user.endereco ? `ENDEREÇO: ${user.endereco}` : ''}
${user.cidade ? `CIDADE: ${user.cidade}` : ''}
${user.estado ? `ESTADO: ${user.estado}` : ''}
${user.formas_pagamento ? `\n💳 FORMAS DE PAGAMENTO:\n${user.formas_pagamento}` : ''}
${user.prazo_entrega ? `\n🚚 PRAZO DE ENTREGA:\n${user.prazo_entrega}` : ''}
${user.politica_troca ? `\n🔄 POLÍTICA DE TROCA:\n${user.politica_troca}` : ''}
${user.historia_empresa ? `\n📋 SOBRE A EMPRESA:\n${user.historia_empresa}` : ''}
`;

      // Criar lista detalhada de produtos com preços
      const productsFullList = myProducts.map((p, idx) => {
        const details = [];
        details.push(`CÓDIGO: ${p.cod}`);
        details.push(`NOME: ${p.nome}`);
        details.push(`CATEGORIA: ${p.categoria}`);
        details.push(`UNIDADE: ${p.und}`);
        if (p.peso) details.push(`PESO: ${p.peso}kg`);
        if (p.dimensoes) details.push(`DIMENSÕES: ${p.dimensoes}`);
        if (p.preco_revendedor) details.push(`PREÇO: R$ ${parseFloat(p.preco_revendedor).toFixed(2)}`);
        if (p.fabricante_nome) details.push(`FABRICANTE: ${p.fabricante_nome}`);
        if (p.observacoes_revendedor) details.push(`OBSERVAÇÕES: ${p.observacoes_revendedor}`);
        if (p.foto) details.push(`FOTO DISPONÍVEL: ${p.foto}`);
        
        return `
═══════════════════════════════════════════════════════════════
PRODUTO #${idx + 1}:
═══════════════════════════════════════════════════════════════
${details.map(d => `  ${d}`).join('\n')}
`;
      }).join('\n');

      const systemContext = `
Você é o assistente virtual de vendas da ${user.empresa || user.full_name}, um revendedor de equipamentos fitness.

${revendedorInfo}

═══════════════════════════════════════════════════════════════
⚠️ INSTRUÇÕES CRÍTICAS - VOCÊ É UM ASSISTENTE DE VENDAS:
═══════════════════════════════════════════════════════════════

1. 🎯 SUA MISSÃO:
   • Você representa EXCLUSIVAMENTE a ${user.empresa || user.full_name}
   • Atenda clientes interessados em fazer orçamentos
   • Seja proativo, profissional e prestativo
   • Destaque a qualidade e diferenciais dos produtos

2. 💰 ORÇAMENTOS:
   • Quando um cliente pedir orçamento:
     ➜ Liste os produtos solicitados com códigos, nomes e preços
     ➜ Calcule o valor total do orçamento
     ➜ Informe condições de pagamento e entrega (se disponível)
     ➜ Pergunte a quantidade desejada de cada item
   
3. 📋 TABELA DE PRODUTOS:
   • Você tem ${myProducts.length} produtos cadastrados
   • SEMPRE busque na lista completa abaixo
   • Para cada produto, você tem: código, nome, categoria, unidade, peso, dimensões, preço, fabricante e FOTO (quando disponível)
   • Se o cliente perguntar sobre disponibilidade, consulte a lista

3.1 📸 ENVIO DE FOTOS:
   • Quando o cliente pedir para ver a foto de um produto, verifique se o campo "FOTO DISPONÍVEL" existe
   • Se a foto existir, ENVIE O LINK DA FOTO na sua resposta
   • Diga algo como: "Aqui está a foto do produto [nome]: [URL_DA_FOTO]"
   • Se não houver foto cadastrada, informe: "Infelizmente este produto ainda não possui foto cadastrada"

4. 🔍 BUSCAS:
   • Use busca flexível (sinônimos, variações, singular/plural)
   • Ignore acentos e maiúsculas
   • Se não encontrar o produto exato, sugira similares
   • NUNCA diga que não tem um produto sem verificar TODA a lista

5. 💼 PROFISSIONALISMO:
   • Seja cordial e profissional
   • Responda de forma clara e objetiva
   • Destaque os benefícios dos produtos
   • Incentive o fechamento de negócio
   • Ofereça suporte para dúvidas técnicas

═══════════════════════════════════════════════════════════════
📦 BASE DE DADOS COMPLETA - ${myProducts.length} PRODUTOS:
═══════════════════════════════════════════════════════════════

${productsFullList}

═══════════════════════════════════════════════════════════════
✅ MODELO DE RESPOSTA PARA ORÇAMENTO:
═══════════════════════════════════════════════════════════════

Quando um cliente solicitar orçamento, use este formato:

"Olá! Segue o orçamento solicitado:

PRODUTOS:
1. [Código] - [Nome do Produto]
   Fabricante: [Nome do Fabricante]
   Quantidade: [X] unidades
   Preço unitário: R$ [XXX,XX]
   Subtotal: R$ [XXX,XX]

2. [Código] - [Nome do Produto]
   Fabricante: [Nome do Fabricante]
   Quantidade: [X] unidades
   Preço unitário: R$ [XXX,XX]
   Subtotal: R$ [XXX,XX]

──────────────────────────────────
VALOR TOTAL: R$ [XXX,XX]
──────────────────────────────────

${user.formas_pagamento ? `Condições de pagamento: ${user.formas_pagamento}` : 'Condições de pagamento: A combinar'}
${user.prazo_entrega ? `Prazo de entrega: ${user.prazo_entrega}` : 'Prazo de entrega: A combinar'}

Ficou com alguma dúvida? Estou à disposição!"

RESPONDA EM PORTUGUÊS BRASILEIRO DE FORMA PROFISSIONAL E COMERCIAL.
`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${systemContext}\n\n════════════════════════════════════════════════════════════════\n💬 MENSAGEM DO CLIENTE:\n════════════════════════════════════════════════════════════════\n\n${userMessage}\n\n════════════════════════════════════════════════════════════════\n⚠️ IMPORTANTE:\n════════════════════════════════════════════════════════════════\n\nVocê representa a ${user.empresa || user.full_name}.\n\nSe for um pedido de orçamento:\n• Liste os produtos com códigos e preços\n• Calcule o total\n• Pergunte quantidades se necessário\n• Seja profissional e comercial\n\nVocê tem ${myProducts.length} produtos disponíveis. Consulte a lista completa acima antes de responder.`,
      });

      const assistantMessage = typeof response === 'string' ? response : response.response || "Desculpe, não consegui processar sua pergunta.";
      
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: assistantMessage
      }]);

    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."
      }]);
      toast({
        title: "Erro no chat",
        description: "Erro ao processar mensagem. Tente novamente.",
        variant: "destructive"
      });
    }

    setChatLoading(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Atendente IA</h1>
          <p className="text-gray-600">Assistente virtual treinado com seus dados e tabela de preços</p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Store className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{user?.empresa || user?.full_name}</div>
              <p className="text-sm text-blue-700">Seu Negócio</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{myProducts.length}</div>
              <p className="text-sm text-purple-700">Produtos na Tabela</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <MessageSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{chatMessages.length}</div>
              <p className="text-sm text-green-700">Mensagens na Conversa</p>
            </CardContent>
          </Card>
        </div>

        {/* Informações do Agente */}
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 border">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">
                    Seu Assistente Virtual
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Treinado com informações do seu negócio e sua tabela de preços completa
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge className="bg-blue-100 text-blue-700">
                      <Package className="w-3 h-3 mr-1" />
                      {myProducts.length} produtos cadastrados
                    </Badge>
                    <Badge className="bg-green-100 text-green-700">
                      <DollarSign className="w-3 h-3 mr-1" />
                      Com preços personalizados
                    </Badge>
                    {user?.whatsapp && (
                      <Badge variant="outline">
                        📱 {user.whatsapp}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Chat com seu Assistente Virtual
            </CardTitle>
            <p className="text-sm text-gray-600">
              Faça perguntas sobre seus produtos, preços, condições de pagamento e mais
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] p-6">
              <div className="space-y-4">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="font-semibold mb-2">Bem-vindo ao seu assistente virtual!</p>
                    <p className="text-sm">Experimente perguntar:</p>
                    <div className="mt-4 space-y-2 text-left max-w-md mx-auto">
                      <p className="text-sm bg-blue-50 p-2 rounded">💬 "Quais produtos você tem disponíveis?"</p>
                      <p className="text-sm bg-green-50 p-2 rounded">💰 "Quanto custa o produto [código]?"</p>
                      <p className="text-sm bg-purple-50 p-2 rounded">📋 "Preciso de um orçamento para..."</p>
                      <p className="text-sm bg-amber-50 p-2 rounded">🏢 "Quais são as formas de pagamento?"</p>
                    </div>
                  </div>
                )}

                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-blue-600" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-green-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="bg-gray-100 rounded-lg px-4 py-3">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !chatLoading && handleSendMessage()}
                  placeholder="Digite sua mensagem... (ex: 'Quero um orçamento para 10 unidades do produto...')"
                  disabled={chatLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                >
                  {chatLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {chatMessages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChatMessages([])}
                  className="mt-2 text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpar Conversa
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}