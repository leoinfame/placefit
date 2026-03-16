import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit3, Trash2, MessageSquare, Send, Bot, User, Loader2, Save, X, BookOpen, Upload, FileText, Package, CheckCircle, AlertCircle } from "lucide-react";
import WhatsAppSetup from "@/components/whatsapp/WhatsAppSetup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

const CATEGORIAS = ["Produtos", "Fornecedores", "Frete", "Políticas", "Procedimentos", "FAQ", "Outros"];

export default function AtendenteIA() {
  const [user, setUser] = useState(null);
  const [fabricantes, setFabricantes] = useState([]);
  const [selectedFabricante, setSelectedFabricante] = useState(null);
  const [fabricanteProducts, setFabricanteProducts] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState(null);
  const [formData, setFormData] = useState({
    titulo: "",
    conteudo: "",
    categoria: "",
    ativo: true
  });
  const [inputType, setInputType] = useState("texto");
  const [knowledgeFile, setKnowledgeFile] = useState(null);
  const [knowledgeWebsite, setKnowledgeWebsite] = useState("");
  const [processingKnowledge, setProcessingKnowledge] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("fabricantes");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionData, setCorrectionData] = useState({
    correcao: "",
    observacoes: ""
  });

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const [fabricantesData, knowledgeData, historyData] = await Promise.all([
        base44.entities.User.filter({ tipo_usuario: 'fabricante', aprovado: true }),
        base44.entities.AIKnowledge.list('-created_date'),
        base44.entities.ChatHistory.list('-created_date')
      ]);
      
      setFabricantes(fabricantesData);
      setKnowledge(knowledgeData);
      setChatHistory(historyData);
      
      // Carregar arquivos armazenados (simulado com conhecimento de categoria "Arquivos")
      const filesKnowledge = knowledgeData.filter(k => k.categoria === "Arquivos");
      setUploadedFiles(filesKnowledge);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const loadFabricanteProducts = async (fabricanteId) => {
    try {
      const allProducts = await base44.entities.Product.list();
      const products = allProducts.filter(p => 
        p.fabricante_id === fabricanteId && 
        p.aprovado_produto === true && 
        p.ativo !== false
      );
      setFabricanteProducts(products);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
  };

  const selectFabricante = async (fabricante) => {
    setSelectedFabricante(fabricante);
    setChatMessages([]);
    await loadFabricanteProducts(fabricante.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessingKnowledge(true);
    
    try {
      let finalData = { ...formData };

      // Se for upload de arquivo
      if (inputType === "arquivo" && knowledgeFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: knowledgeFile });
        
        const extractResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Extraia e organize todo o conteúdo relevante deste arquivo. Mantenha a estrutura e formatação importantes. Seja completo e detalhado.`,
          file_urls: [file_url]
        });
        
        finalData.conteudo = extractResult;
        if (!finalData.titulo) {
          finalData.titulo = knowledgeFile.name.replace(/\.[^/.]+$/, "");
        }
      }
      
      // Se for website
      if (inputType === "website" && knowledgeWebsite) {
        const webResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Acesse o site ${knowledgeWebsite} e extraia todo o conteúdo relevante. Inclua informações sobre produtos, serviços, políticas, formas de pagamento, prazos de entrega, contatos e qualquer informação útil para um agente de vendas.`,
          add_context_from_internet: true
        });
        
        finalData.conteudo = webResult;
        if (!finalData.titulo) {
          finalData.titulo = `Informações de ${knowledgeWebsite}`;
        }
      }

      // Adicionar fabricante_id
      finalData.fabricante_id = selectedFabricante?.id;

      if (!finalData.fabricante_id) {
        toast({
          title: "Erro",
          description: "Selecione um fabricante antes de adicionar conhecimento.",
          variant: "destructive"
        });
        setProcessingKnowledge(false);
        return;
      }

      if (editingKnowledge) {
        await base44.entities.AIKnowledge.update(editingKnowledge.id, finalData);
        toast({
          title: "Conhecimento atualizado!",
          description: "O conhecimento foi atualizado com sucesso.",
        });
      } else {
        await base44.entities.AIKnowledge.create(finalData);
        toast({
          title: "Conhecimento criado!",
          description: "Novo conhecimento adicionado ao atendente IA.",
        });
      }

      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar conhecimento:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar conhecimento. Tente novamente.",
        variant: "destructive"
      });
    }
    
    setProcessingKnowledge(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      // 1. Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // 2. Extrair conteúdo do arquivo
      let fileContent = "";
      try {
        const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: file_url,
          json_schema: {
            type: "object",
            properties: {
              conteudo: { type: "string" }
            }
          }
        });
        
        if (extractResult.status === "success" && extractResult.output) {
          fileContent = JSON.stringify(extractResult.output, null, 2);
        }
      } catch (extractError) {
        console.log("Não foi possível extrair dados estruturados, arquivo será referenciado por URL");
        fileContent = `Arquivo disponível em: ${file_url}`;
      }

      // 3. Salvar como conhecimento especial de arquivo
      if (!selectedFabricante?.id) {
        toast({
          title: "Erro",
          description: "Selecione um fabricante antes de enviar arquivos.",
          variant: "destructive"
        });
        setUploadingFile(false);
        return;
      }

      await base44.entities.AIKnowledge.create({
        fabricante_id: selectedFabricante.id,
        titulo: file.name,
        conteudo: fileContent,
        categoria: "Arquivos",
        ativo: true
      });

      toast({
        title: "Arquivo enviado!",
        description: `${file.name} foi adicionado ao conhecimento do atendente IA.`,
      });
      
      loadData();
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar arquivo. Tente novamente.",
        variant: "destructive"
      });
    }
    setUploadingFile(false);
  };

  const handleEdit = (item) => {
    setEditingKnowledge(item);
    setFormData(item);
    setShowDialog(true);
  };

  const handleDelete = async (item) => {
    if (confirm(`Tem certeza que deseja excluir "${item.titulo}"?`)) {
      try {
        await base44.entities.AIKnowledge.delete(item.id);
        loadData();
        toast({
          title: "Conhecimento excluído",
          description: "O conhecimento foi removido do sistema.",
        });
      } catch (error) {
        console.error("Erro ao excluir conhecimento:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir conhecimento. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      titulo: "",
      conteudo: "",
      categoria: "",
      ativo: true
    });
    setEditingKnowledge(null);
    setInputType("texto");
    setKnowledgeFile(null);
    setKnowledgeWebsite("");
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedFabricante) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      // Detectar se o cliente está pedindo tabela/catálogo ou foto
      const isRequestingTable = /\b(tabela|catálogo|catalogo|lista.*produtos?|ver.*produtos?|produtos?.*completo|pdf|enviar.*produtos?|envie.*tabela)\b/i.test(userMessage);
      const isRequestingPhoto = /\b(foto|imagem|image|picture|ver.*foto|mostre.*foto|envie.*foto|quero.*ver)\b/i.test(userMessage);

      // Contexto específico do fabricante
      const products = fabricanteProducts;

      // Criar tabela de produtos do fabricante
      const productsFullList = products.map((p, idx) => {
        const details = [];
        details.push(`CÓDIGO: ${p.cod}`);
        details.push(`NOME: ${p.nome}`);
        details.push(`CATEGORIA: ${p.categoria}`);
        details.push(`UNIDADE: ${p.und}`);
        if (p.peso) details.push(`PESO: ${p.peso}kg`);
        if (p.dimensoes) details.push(`DIMENSÕES: ${p.dimensoes}`);
        if (p.preco_fabricante) details.push(`PREÇO: R$ ${parseFloat(p.preco_fabricante).toFixed(2)}`);
        if (p.foto) details.push(`FOTO DISPONÍVEL: ${p.foto}`);
        
        return `
═══════════════════════════════════════════════════════════════
PRODUTO #${idx + 1}:
═══════════════════════════════════════════════════════════════
${details.map(d => `  ${d}`).join('\n')}
`;
      }).join('\n');

      // Se está pedindo tabela, gerar link público
      let tableLink = "";
      if (isRequestingTable) {
        tableLink = `${window.location.origin}/PublicTable?fabricante=${selectedFabricante.id}`;
      }

      // Montar contexto do agente do fabricante
      const trainingExamples = getTrainingContext();
      const knowledgeContext = getKnowledgeContext();
      const customInstructions = selectedFabricante.instrucoes_agente_ia || "";
      
      const systemContext = `
Você é o agente de vendas virtual da ${selectedFabricante.empresa || selectedFabricante.full_name}, fabricante de equipamentos fitness.

${customInstructions ? `
═══════════════════════════════════════════════════════════════
🎯 INSTRUÇÕES CUSTOMIZADAS PRIORITÁRIAS:
═══════════════════════════════════════════════════════════════

${customInstructions}

⚠️ IMPORTANTE: Estas instruções têm PRIORIDADE sobre as regras padrão.
Sempre siga estas diretrizes customizadas ao responder clientes.

` : ''}

${trainingExamples}

${knowledgeContext}

${tableLink ? `
═══════════════════════════════════════════════════════════════
📋 TABELA DE PRODUTOS (SOLICITADA PELO CLIENTE):
═══════════════════════════════════════════════════════════════

O cliente pediu a tabela de produtos. INCLUA este link na sua resposta:
${tableLink}

Diga algo como:
"Claro! Aqui está nossa tabela completa de produtos com todos os detalhes:
${tableLink}

Nesta tabela você encontra todos os nossos ${products.length} produtos com códigos, especificações e preços. Caso tenha dúvidas ou queira fazer um orçamento específico, estou à disposição!"

` : ''}

═══════════════════════════════════════════════════════════════
🏭 INFORMAÇÕES DA EMPRESA:
═══════════════════════════════════════════════════════════════

FABRICANTE: ${selectedFabricante.empresa || selectedFabricante.full_name}
${selectedFabricante.whatsapp ? `WHATSAPP: ${selectedFabricante.whatsapp}` : ''}
${selectedFabricante.email ? `EMAIL: ${selectedFabricante.email}` : ''}
${selectedFabricante.site ? `WEBSITE: ${selectedFabricante.site}` : ''}
${selectedFabricante.endereco ? `ENDEREÇO: ${selectedFabricante.endereco}` : ''}
${selectedFabricante.formas_pagamento ? `\n💳 FORMAS DE PAGAMENTO:\n${selectedFabricante.formas_pagamento}` : ''}
${selectedFabricante.prazo_entrega ? `\n🚚 PRAZO DE ENTREGA:\n${selectedFabricante.prazo_entrega}` : ''}
${selectedFabricante.politica_troca ? `\n🔄 POLÍTICA DE TROCA:\n${selectedFabricante.politica_troca}` : ''}
${selectedFabricante.historia_empresa ? `\n📋 SOBRE A EMPRESA:\n${selectedFabricante.historia_empresa}` : ''}

═══════════════════════════════════════════════════════════════
⚠️ INSTRUÇÕES CRÍTICAS - VOCÊ É UM AGENTE DE VENDAS:
═══════════════════════════════════════════════════════════════

1. 🎯 SUA MISSÃO:
   • Você representa EXCLUSIVAMENTE a ${selectedFabricante.empresa || selectedFabricante.full_name}
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
   • Você tem ${products.length} produtos cadastrados
   • SEMPRE busque na lista completa abaixo
   • Para cada produto, você tem: código, nome, categoria, unidade, peso, dimensões, preço e FOTO (quando disponível)
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
📦 BASE DE DADOS COMPLETA - ${products.length} PRODUTOS:
═══════════════════════════════════════════════════════════════

${productsFullList}



═══════════════════════════════════════════════════════════════
✅ MODELO DE RESPOSTA PARA ORÇAMENTO:
═══════════════════════════════════════════════════════════════

Quando um cliente solicitar orçamento, use este formato:

"Olá! Segue o orçamento solicitado:

PRODUTOS:
1. [Código] - [Nome do Produto]
   Quantidade: [X] unidades
   Preço unitário: R$ [XXX,XX]
   Subtotal: R$ [XXX,XX]

2. [Código] - [Nome do Produto]
   Quantidade: [X] unidades
   Preço unitário: R$ [XXX,XX]
   Subtotal: R$ [XXX,XX]

──────────────────────────────────
VALOR TOTAL: R$ [XXX,XX]
──────────────────────────────────

Condições de pagamento: [informar se disponível]
Prazo de entrega: [informar se disponível]

Ficou com alguma dúvida? Estou à disposição!"

RESPONDA EM PORTUGUÊS BRASILEIRO DE FORMA PROFISSIONAL E COMERCIAL.
`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${systemContext}\n\n════════════════════════════════════════════════════════════════\n💬 MENSAGEM DO CLIENTE:\n════════════════════════════════════════════════════════════════\n\n${userMessage}\n\n════════════════════════════════════════════════════════════════\n⚠️ IMPORTANTE:\n════════════════════════════════════════════════════════════════\n\nVocê representa a ${selectedFabricante.empresa || selectedFabricante.full_name}.\n\nSe for um pedido de orçamento:\n• Liste os produtos com códigos e preços\n• Calcule o total\n• Pergunte quantidades se necessário\n• Seja profissional e comercial\n\nVocê tem ${products.length} produtos disponíveis. Consulte a lista completa acima antes de responder.`,
      });

      const assistantMessage = typeof response === 'string' ? response : response.response || "Desculpe, não consegui processar sua pergunta.";
      
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: assistantMessage
      }]);

      // Salvar conversa no histórico
      try {
        await base44.entities.ChatHistory.create({
          fabricante_id: selectedFabricante.id,
          fabricante_nome: selectedFabricante.empresa || selectedFabricante.full_name,
          user_message: userMessage,
          agent_response: assistantMessage,
          feedback: "pendente"
        });
        loadData(); // Recarregar histórico
      } catch (error) {
        console.error("Erro ao salvar histórico:", error);
      }

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

  const handleFeedback = async (historyItem, feedbackType) => {
    try {
      await base44.entities.ChatHistory.update(historyItem.id, {
        feedback: feedbackType
      });
      loadData();
      toast({
        title: "Feedback registrado!",
        description: `Resposta marcada como ${feedbackType}.`,
      });
    } catch (error) {
      console.error("Erro ao registrar feedback:", error);
      toast({
        title: "Erro",
        description: "Erro ao registrar feedback.",
        variant: "destructive"
      });
    }
  };

  const openCorrectionDialog = (historyItem) => {
    setSelectedHistory(historyItem);
    setCorrectionData({
      correcao: historyItem.correcao || historyItem.agent_response,
      observacoes: historyItem.observacoes || ""
    });
    setShowCorrectionDialog(true);
  };

  const handleSaveCorrection = async (e) => {
    e.preventDefault();
    try {
      await base44.entities.ChatHistory.update(selectedHistory.id, {
        ...correctionData,
        feedback: "inadequado"
      });
      setShowCorrectionDialog(false);
      loadData();
      toast({
        title: "Correção salva!",
        description: "A resposta corrigida será usada para treinar o agente.",
      });
    } catch (error) {
      console.error("Erro ao salvar correção:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar correção.",
        variant: "destructive"
      });
    }
  };

  const getHistoryByFabricante = () => {
    if (!selectedFabricante) return [];
    return chatHistory.filter(h => h.fabricante_id === selectedFabricante.id);
  };

  const getTrainingContext = () => {
    // Buscar correções e respostas aprovadas para incluir no contexto do agente
    const approvedResponses = chatHistory.filter(h => 
      h.fabricante_id === selectedFabricante?.id && 
      (h.feedback === "aprovado" || h.correcao)
    );
    
    if (approvedResponses.length === 0) return "";
    
    return `
═══════════════════════════════════════════════════════════════
📚 EXEMPLOS DE RESPOSTAS APROVADAS (APRENDIZADO):
═══════════════════════════════════════════════════════════════

${approvedResponses.map((h, i) => `
EXEMPLO ${i + 1}:
PERGUNTA: ${h.user_message}
RESPOSTA CORRETA: ${h.correcao || h.agent_response}
${h.observacoes ? `OBSERVAÇÃO: ${h.observacoes}` : ''}
`).join('\n---\n')}

Use estes exemplos como referência para melhorar suas respostas.
`;
  };

  const getKnowledgeContext = () => {
    // Buscar conhecimento ativo APENAS deste fabricante
    const activeKnowledge = knowledge.filter(k => 
      k.ativo && k.fabricante_id === selectedFabricante?.id
    );
    
    if (activeKnowledge.length === 0) return "";
    
    return `
═══════════════════════════════════════════════════════════════
📖 BASE DE CONHECIMENTO ADICIONAL:
═══════════════════════════════════════════════════════════════

IMPORTANTE: Use estas informações para complementar suas respostas quando relevante.

${activeKnowledge.map((k, i) => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONHECIMENTO ${i + 1} - ${k.categoria}: ${k.titulo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${k.conteudo}
`).join('\n')}

═══════════════════════════════════════════════════════════════
⚠️ INSTRUÇÃO: Consulte esta base de conhecimento sempre que 
necessário para enriquecer suas respostas com informações 
precisas sobre políticas, procedimentos, FAQ, etc.
═══════════════════════════════════════════════════════════════
`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
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
          <p className="text-gray-600">Configure o conhecimento, envie arquivos e teste o atendimento virtual</p>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Bot className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{fabricantes.length}</div>
              <p className="text-sm text-blue-700">Fabricantes Ativos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">
                {selectedFabricante ? fabricanteProducts.length : 0}
              </div>
              <p className="text-sm text-purple-700">Produtos do Agente</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <MessageSquare className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{chatHistory.length}</div>
              <p className="text-sm text-green-700">Conversas Salvas</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="fabricantes">
              <Bot className="w-4 h-4 mr-2" />
              Agentes
            </TabsTrigger>
            <TabsTrigger value="chat" disabled={!selectedFabricante}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="training" disabled={!selectedFabricante}>
              <BookOpen className="w-4 h-4 mr-2" />
              Treinamento
            </TabsTrigger>
            <TabsTrigger value="whatsapp">
              <span className="mr-2">📱</span>
              WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fabricantes" className="space-y-4">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  Agentes de IA por Fabricante
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Cada fabricante possui um agente treinado com sua tabela de produtos para atender clientes e fazer orçamentos
                </p>
              </CardHeader>
              <CardContent>
                {fabricantes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fabricantes.map((fabricante) => (
                      <Card 
                        key={fabricante.id}
                        className={`cursor-pointer transition-all hover:shadow-lg ${
                          selectedFabricante?.id === fabricante.id 
                            ? 'border-2 border-blue-500 bg-blue-50' 
                            : 'hover:border-blue-200'
                        }`}
                        onClick={() => selectFabricante(fabricante)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {fabricante.logomarca ? (
                              <img 
                                src={fabricante.logomarca} 
                                alt={fabricante.empresa}
                                className="w-12 h-12 rounded-lg object-contain bg-white p-1 border"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
                                <Bot className="w-6 h-6 text-blue-600" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate">
                                {fabricante.empresa || fabricante.full_name}
                              </h3>
                              <p className="text-xs text-gray-500 truncate">
                                {fabricante.email}
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  <Bot className="w-3 h-3 mr-1" />
                                  Agente Ativo
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Nenhum fabricante ativo
                    </h3>
                    <p className="text-gray-600">
                      Aguarde a aprovação de fabricantes para criar agentes de IA
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedFabricante && (
              <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 border">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      {selectedFabricante.logomarca && (
                        <img 
                          src={selectedFabricante.logomarca} 
                          alt={selectedFabricante.empresa}
                          className="w-16 h-16 rounded-lg object-contain bg-white p-2 border"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-lg mb-1">
                          {selectedFabricante.empresa || selectedFabricante.full_name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {selectedFabricante.historia_empresa || 'Agente de vendas virtual treinado com a tabela de produtos'}
                        </p>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <Badge className="bg-blue-100 text-blue-700">
                            <Package className="w-3 h-3 mr-1" />
                            {fabricanteProducts.length} produtos cadastrados
                          </Badge>
                          {selectedFabricante.whatsapp && (
                            <Badge variant="outline">
                              📱 {selectedFabricante.whatsapp}
                            </Badge>
                          )}
                          {selectedFabricante.site && (
                            <Badge variant="outline">
                              🌐 {selectedFabricante.site}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-4">
                          <Button 
                            onClick={() => setActiveTab('chat')}
                            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Acessar Chat do Agente
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="training" className="space-y-4">
            {selectedFabricante && (
              <>
                <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 border">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                      {selectedFabricante.logomarca && (
                        <img 
                          src={selectedFabricante.logomarca} 
                          alt={selectedFabricante.empresa}
                          className="w-10 h-10 rounded-lg object-contain bg-white p-1 border"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          Treinamento: {selectedFabricante.empresa || selectedFabricante.full_name}
                        </h3>
                        <p className="text-xs text-gray-600">
                          {getHistoryByFabricante().length} conversas • {knowledge.filter(k => k.fabricante_id === selectedFabricante.id).length} conhecimentos
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          {getHistoryByFabricante().filter(h => h.feedback === 'aprovado').length} Aprovadas
                        </Badge>
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          {getHistoryByFabricante().filter(h => h.feedback === 'inadequado').length} Inadequadas
                        </Badge>
                        <Badge className="bg-gray-100 text-gray-700 text-xs">
                          {getHistoryByFabricante().filter(h => h.feedback === 'pendente').length} Pendentes
                        </Badge>
                      </div>
                      <Button
                        onClick={() => {
                          resetForm();
                          setShowDialog(true);
                        }}
                        className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 w-full md:w-auto"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Conhecimento
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Prompt de Instruções Customizadas */}
                <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      Instruções Customizadas do Agente
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Configure o comportamento e estilo de resposta do agente de IA
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={selectedFabricante.instrucoes_agente_ia || ""}
                      onChange={(e) => {
                        setSelectedFabricante({ ...selectedFabricante, instrucoes_agente_ia: e.target.value });
                      }}
                      rows={6}
                      placeholder="Exemplo:&#10;- Ao falar sobre modelos de produtos, agrupe por modelo e não liste cada variação de peso separadamente&#10;- Sempre mencionar prazo de entrega ao fazer orçamento&#10;- Use tom profissional mas amigável&#10;- Priorize informações sobre garantia dos produtos"
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-600">
                      💡 <strong>Dica:</strong> Descreva como o agente deve se comportar em situações específicas. 
                      Exemplo: "Ao listar produtos similares, agrupe por modelo e não por peso" ou "Sempre pergunte a quantidade desejada antes de fazer orçamento"
                    </p>
                    <Button
                      onClick={async () => {
                        try {
                          await base44.entities.User.update(selectedFabricante.id, {
                            instrucoes_agente_ia: selectedFabricante.instrucoes_agente_ia || ""
                          });
                          toast({
                            title: "Instruções salvas!",
                            description: "As instruções customizadas foram atualizadas.",
                          });
                          await loadData();
                          // Recarregar fabricante selecionado com dados atualizados
                          const updatedFabricantes = await base44.entities.User.filter({ tipo_usuario: 'fabricante', aprovado: true });
                          const updatedFabricante = updatedFabricantes.find(f => f.id === selectedFabricante.id);
                          if (updatedFabricante) {
                            setSelectedFabricante(updatedFabricante);
                          }
                        } catch (error) {
                          console.error("Erro ao salvar instruções:", error);
                          toast({
                            title: "Erro",
                            description: "Erro ao salvar instruções.",
                            variant: "destructive"
                          });
                        }
                      }}
                      className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Instruções Customizadas
                    </Button>
                  </CardContent>
                </Card>

                {/* Base de Conhecimento */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      Base de Conhecimento
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Gerencie textos, arquivos e URLs que alimentam o conhecimento do agente
                    </p>
                  </CardHeader>
                  <CardContent>
                    {knowledge.filter(k => k.fabricante_id === selectedFabricante.id).length > 0 ? (
                      <div className="space-y-3">
                        {knowledge.filter(k => k.fabricante_id === selectedFabricante.id).map((item) => (
                          <Card key={item.id} className="border hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                                  {item.categoria === "Arquivos" ? (
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                  ) : (
                                    <BookOpen className="w-5 h-5 text-indigo-600" />
                                  )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-gray-900 mb-1">
                                        {item.titulo}
                                      </h4>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge variant="secondary" className="text-xs">
                                          {item.categoria}
                                        </Badge>
                                        <Badge className={item.ativo ? "bg-green-100 text-green-700 text-xs" : "bg-gray-100 text-gray-700 text-xs"}>
                                          {item.ativo ? "Ativo" : "Inativo"}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-gray-600 line-clamp-2">
                                        {item.conteudo}
                                      </p>
                                    </div>
                                    
                                    <div className="flex gap-1 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(item)}
                                        className="hover:bg-blue-50 hover:text-blue-700"
                                        title="Editar"
                                      >
                                        <Edit3 className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(item)}
                                        className="hover:bg-red-50 hover:text-red-700"
                                        title="Deletar"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600 mb-3">
                          Nenhum conhecimento cadastrado ainda
                        </p>
                        <Button
                          onClick={() => {
                            resetForm();
                            setShowDialog(true);
                          }}
                          variant="outline"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar Primeiro Conhecimento
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-purple-600" />
                      Histórico de Conversas e Treinamento
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Revise conversas, corrija respostas inadequadas e forneça feedback para melhorar o agente
                    </p>
                  </CardHeader>
                  <CardContent>
                    {getHistoryByFabricante().length > 0 ? (
                      <div className="space-y-4">
                        {getHistoryByFabricante().map((item) => (
                          <Card key={item.id} className={`${
                            item.feedback === 'aprovado' ? 'border-green-200 bg-green-50' :
                            item.feedback === 'inadequado' ? 'border-red-200 bg-red-50' :
                            'border-gray-200'
                          }`}>
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                {/* Mensagem do Cliente */}
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <User className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-semibold text-gray-700">Cliente perguntou:</span>
                                  </div>
                                  <p className="text-sm bg-white p-3 rounded-lg border">
                                    {item.user_message}
                                  </p>
                                </div>

                                {/* Resposta do Agente */}
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Bot className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-semibold text-gray-700">Agente respondeu:</span>
                                  </div>
                                  <p className="text-sm bg-white p-3 rounded-lg border whitespace-pre-wrap">
                                    {item.agent_response}
                                  </p>
                                </div>

                                {/* Correção (se existir) */}
                                {item.correcao && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Edit3 className="w-4 h-4 text-purple-600" />
                                      <span className="text-sm font-semibold text-gray-700">Resposta corrigida:</span>
                                    </div>
                                    <p className="text-sm bg-purple-50 p-3 rounded-lg border border-purple-200 whitespace-pre-wrap">
                                      {item.correcao}
                                    </p>
                                  </div>
                                )}

                                {/* Observações */}
                                {item.observacoes && (
                                  <div>
                                    <span className="text-xs font-semibold text-gray-600">Observações:</span>
                                    <p className="text-xs text-gray-600 italic mt-1">
                                      {item.observacoes}
                                    </p>
                                  </div>
                                )}

                                {/* Ações */}
                                <div className="flex items-center justify-between pt-2 border-t">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">
                                      {new Date(item.created_date).toLocaleString('pt-BR')}
                                    </span>
                                    <Badge className={
                                      item.feedback === 'aprovado' ? 'bg-green-100 text-green-700' :
                                      item.feedback === 'inadequado' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-700'
                                    }>
                                      {item.feedback === 'aprovado' ? '✓ Aprovado' :
                                       item.feedback === 'inadequado' ? '✗ Inadequado' :
                                       '⏳ Pendente'}
                                    </Badge>
                                  </div>
                                  <div className="flex gap-2">
                                    {item.feedback !== 'aprovado' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleFeedback(item, 'aprovado')}
                                        className="border-green-200 text-green-700 hover:bg-green-50"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Aprovar
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openCorrectionDialog(item)}
                                      className="border-purple-200 text-purple-700 hover:bg-purple-50"
                                    >
                                      <Edit3 className="w-4 h-4 mr-1" />
                                      Corrigir
                                    </Button>
                                    {item.feedback !== 'inadequado' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleFeedback(item, 'inadequado')}
                                        className="border-red-200 text-red-700 hover:bg-red-50"
                                      >
                                        <X className="w-4 h-4 mr-1" />
                                        Marcar Inadequado
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Nenhuma conversa registrada
                        </h3>
                        <p className="text-gray-600">
                          Use a aba "Chat do Agente" para testar e gerar conversas
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  resetForm();
                  setShowDialog(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Conhecimento
              </Button>
            </div>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                        <TableHead className="text-white font-semibold">Título</TableHead>
                        <TableHead className="text-white font-semibold">Categoria</TableHead>
                        <TableHead className="text-white font-semibold">Conteúdo</TableHead>
                        <TableHead className="text-white font-semibold">Status</TableHead>
                        <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {knowledge.filter(k => k.categoria !== "Arquivos").map((item, index) => (
                        <TableRow
                          key={item.id}
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                        >
                          <TableCell className="font-medium max-w-xs">
                            <div className="truncate" title={item.titulo}>
                              {item.titulo}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.categoria}</Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate text-sm text-gray-600" title={item.conteudo}>
                              {item.conteudo}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.ativo ? (
                              <Badge className="bg-green-100 text-green-700">Ativo</Badge>
                            ) : (
                              <Badge variant="secondary">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(item)}
                                className="hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item)}
                                className="hover:bg-red-50 hover:text-red-700"
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

                {knowledge.filter(k => k.categoria !== "Arquivos").length === 0 && (
                  <div className="text-center py-12">
                    <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Nenhum conhecimento cadastrado
                    </h3>
                    <p className="text-gray-600">
                      Adicione conhecimentos para treinar o atendente IA
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <div className="flex justify-end">
              <div>
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls,.txt,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploadingFile}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {uploadingFile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Enviar Arquivo
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Arquivos e Documentos</CardTitle>
                <p className="text-sm text-gray-600">
                  Envie catálogos, planilhas e documentos para enriquecer o conhecimento do atendente IA
                </p>
              </CardHeader>
              <CardContent>
                {uploadedFiles.length > 0 ? (
                  <div className="space-y-3">
                    {uploadedFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <FileText className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{file.titulo}</p>
                            <p className="text-sm text-gray-500 truncate">
                              {file.conteudo.substring(0, 100)}...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={file.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                            {file.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(file)}
                            className="hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Nenhum arquivo enviado
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Envie catálogos e planilhas para complementar o conhecimento
                    </p>
                    <p className="text-sm text-gray-500">
                      Formatos aceitos: PDF, CSV, Excel, Word, TXT
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            {selectedFabricante && (
              <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {selectedFabricante.logomarca && (
                      <img 
                        src={selectedFabricante.logomarca} 
                        alt={selectedFabricante.empresa}
                        className="w-10 h-10 rounded-lg object-contain bg-white p-1 border"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        Agente: {selectedFabricante.empresa || selectedFabricante.full_name}
                      </h3>
                      <p className="text-xs text-gray-600">
                        Treinado com {fabricanteProducts.length} produtos
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab('fabricantes')}
                    >
                      Trocar Agente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Chat com o Agente de Vendas
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Simule atendimentos de clientes e teste o agente fazendo orçamentos
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px] p-6">
                  <div className="space-y-4">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p className="font-semibold mb-2">Bem-vindo ao agente de vendas!</p>
                        <p className="text-sm">Experimente perguntar:</p>
                        <div className="mt-4 space-y-2 text-left max-w-md mx-auto">
                          <p className="text-sm bg-blue-50 p-2 rounded">💬 "Quais produtos você tem disponíveis?"</p>
                          <p className="text-sm bg-green-50 p-2 rounded">💰 "Preciso de um orçamento para..."</p>
                          <p className="text-sm bg-purple-50 p-2 rounded">📋 "Quanto custa o produto [código]?"</p>
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
                      disabled={chatLoading || !selectedFabricante}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={chatLoading || !chatInput.trim() || !selectedFabricante}
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
                      Limpar Conversa
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog de Correção */}
        <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-600" />
                Corrigir Resposta do Agente
              </DialogTitle>
            </DialogHeader>

            {selectedHistory && (
              <form onSubmit={handleSaveCorrection} className="space-y-4">
                {/* Mensagem Original */}
                <div>
                  <Label>Pergunta do Cliente</Label>
                  <div className="mt-1 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-900">{selectedHistory.user_message}</p>
                  </div>
                </div>

                {/* Resposta Original do Agente */}
                <div>
                  <Label>Resposta Original do Agente</Label>
                  <div className="mt-1 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedHistory.agent_response}</p>
                  </div>
                </div>

                {/* Correção */}
                <div>
                  <Label htmlFor="correcao">Resposta Corrigida *</Label>
                  <Textarea
                    id="correcao"
                    value={correctionData.correcao}
                    onChange={(e) => setCorrectionData({ ...correctionData, correcao: e.target.value })}
                    required
                    rows={8}
                    placeholder="Digite a resposta correta que o agente deveria ter dado..."
                    className="resize-none mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Esta resposta será usada como exemplo para treinar o agente em futuras interações similares
                  </p>
                </div>

                {/* Observações */}
                <div>
                  <Label htmlFor="observacoes">Observações para Treinamento</Label>
                  <Textarea
                    id="observacoes"
                    value={correctionData.observacoes}
                    onChange={(e) => setCorrectionData({ ...correctionData, observacoes: e.target.value })}
                    rows={3}
                    placeholder="Ex: 'Sempre mencionar prazo de entrega', 'Detalhar mais as especificações técnicas', etc."
                    className="resize-none mt-1"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCorrectionDialog(false)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Correção
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Conhecimento */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingKnowledge ? "Editar Conhecimento" : "Novo Conhecimento"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required={inputType === "texto"}
                  placeholder="Ex: Como funciona o cadastro de fornecedores"
                />
                {inputType !== "texto" && (
                  <p className="text-xs text-gray-500 mt-1">Deixe em branco para gerar automaticamente</p>
                )}
              </div>

              <div>
                <Label htmlFor="categoria">Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de Entrada</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Button
                    type="button"
                    variant={inputType === "texto" ? "default" : "outline"}
                    onClick={() => setInputType("texto")}
                    className={inputType === "texto" ? "bg-blue-600" : ""}
                  >
                    📝 Texto
                  </Button>
                  <Button
                    type="button"
                    variant={inputType === "arquivo" ? "default" : "outline"}
                    onClick={() => setInputType("arquivo")}
                    className={inputType === "arquivo" ? "bg-blue-600" : ""}
                  >
                    📄 Arquivo
                  </Button>
                  <Button
                    type="button"
                    variant={inputType === "website" ? "default" : "outline"}
                    onClick={() => setInputType("website")}
                    className={inputType === "website" ? "bg-blue-600" : ""}
                  >
                    🌐 Website
                  </Button>
                </div>
              </div>

              {inputType === "texto" && (
                <div>
                  <Label htmlFor="conteudo">Conteúdo *</Label>
                  <Textarea
                    id="conteudo"
                    value={formData.conteudo}
                    onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                    required
                    rows={8}
                    placeholder="Descreva em detalhes o conhecimento que deseja adicionar..."
                    className="resize-none"
                  />
                </div>
              )}

              {inputType === "arquivo" && (
                <div>
                  <Label htmlFor="knowledge-file">Upload de Arquivo (PDF, Imagem)</Label>
                  <Input
                    id="knowledge-file"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setKnowledgeFile(e.target.files?.[0] || null)}
                    required
                    className="cursor-pointer"
                  />
                  {knowledgeFile && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {knowledgeFile.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    O sistema extrairá automaticamente o conteúdo do arquivo
                  </p>
                </div>
              )}

              {inputType === "website" && (
                <div>
                  <Label htmlFor="knowledge-website">URL do Website</Label>
                  <Input
                    id="knowledge-website"
                    type="url"
                    value={knowledgeWebsite}
                    onChange={(e) => setKnowledgeWebsite(e.target.value)}
                    required
                    placeholder="https://exemplo.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    O sistema extrairá automaticamente as informações do site
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label>Ativo</Label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  disabled={processingKnowledge}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                  disabled={processingKnowledge}
                >
                  {processingKnowledge ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {editingKnowledge ? "Salvar Alterações" : "Criar Conhecimento"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}