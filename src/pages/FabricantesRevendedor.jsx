import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Store, Download, MessageSquare, Package, Search, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function FabricantesRevendedor() {
  const [user, setUser] = useState(null);
  const [fabricantes, setFabricantes] = useState([]);
  const [filteredFabricantes, setFilteredFabricantes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFabricante, setSelectedFabricante] = useState(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [showCatalogoDialog, setShowCatalogoDialog] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [catalogoProducts, setCatalogoProducts] = useState([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [downloadingTable, setDownloadingTable] = useState(null);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredFabricantes(
        fabricantes.filter(f =>
          f.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredFabricantes(fabricantes);
    }
  }, [searchTerm, fabricantes]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Buscar todos os usuários e filtrar fabricantes aprovados
      const allUsers = await base44.entities.User.list();
      const fabricantesAprovados = allUsers.filter(
        u => u.tipo_usuario === 'fabricante' && u.aprovado === true
      );

      setFabricantes(fabricantesAprovados);
      setFilteredFabricantes(fabricantesAprovados);
    } catch (error) {
      console.error("Erro ao carregar fabricantes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os fabricantes.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const downloadFabricanteTable = async (fabricante) => {
    setDownloadingTable(fabricante.id);
    try {
      const allProducts = await base44.entities.Product.list();
      const fabricanteProducts = allProducts.filter(
        p => p.fabricante_id === fabricante.id && p.aprovado_produto === true
      );

      if (fabricanteProducts.length === 0) {
        toast({
          title: "Sem produtos",
          description: "Este fabricante não possui produtos aprovados.",
        });
        setDownloadingTable(null);
        return;
      }

      // Gerar CSV
      const headers = ["Código", "Nome", "Categoria", "Unidade", "Peso (kg)", "Dimensões (cm)", "Preço"];
      const rows = fabricanteProducts.map(p => [
        p.cod || "",
        p.nome || "",
        p.categoria || "",
        p.und || "",
        p.peso || "",
        p.dimensoes || "",
        p.preco_fabricante || ""
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `tabela_${fabricante.empresa || fabricante.full_name}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast({
        title: "Download concluído!",
        description: `Tabela de ${fabricante.empresa || fabricante.full_name} baixada com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao baixar tabela:", error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar a tabela.",
        variant: "destructive",
      });
    }
    setDownloadingTable(null);
  };

  const openChat = (fabricante) => {
    setSelectedFabricante(fabricante);
    setChatMessages([
      {
        role: "assistant",
        content: `Olá! Sou o assistente virtual de ${fabricante.empresa || fabricante.full_name}. Como posso ajudá-lo?`
      }
    ]);
    setShowChatDialog(true);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || sendingMessage) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setSendingMessage(true);

    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);

    try {
      // Buscar base de conhecimento do fabricante
      const knowledgeBase = await base44.entities.AIKnowledge.filter({
        fabricante_id: selectedFabricante.id,
        ativo: true
      });

      const context = knowledgeBase.map(k => `${k.titulo}: ${k.conteudo}`).join("\n\n");

      // Chamar LLM com contexto
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente virtual da empresa ${selectedFabricante.empresa || selectedFabricante.full_name}.
        
Base de conhecimento:
${context}

Pergunta do cliente: ${userMessage}

Responda de forma profissional e útil, usando apenas as informações da base de conhecimento. Se não souber a resposta, seja honesto e sugira entrar em contato diretamente.`,
      });

      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: response 
      }]);

      // Salvar histórico
      await base44.entities.ChatHistory.create({
        fabricante_id: selectedFabricante.id,
        fabricante_nome: selectedFabricante.empresa || selectedFabricante.full_name,
        user_message: userMessage,
        agent_response: response,
      });

    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente." 
      }]);
    }

    setSendingMessage(false);
  };

  const openCatalogo = async (fabricante) => {
    setSelectedFabricante(fabricante);
    setShowCatalogoDialog(true);
    setLoadingCatalogo(true);

    try {
      const allProducts = await base44.entities.Product.list();
      const fabricanteProducts = allProducts.filter(
        p => p.fabricante_id === fabricante.id && p.aprovado_produto === true
      );
      setCatalogoProducts(fabricanteProducts);
    } catch (error) {
      console.error("Erro ao carregar catálogo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o catálogo.",
        variant: "destructive",
      });
    }
    setLoadingCatalogo(false);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-16 bg-gray-200 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">
            Fabricantes Parceiros
          </h1>
          <p className="text-gray-600">
            Acesse catálogos, tabelas de preços e atendimento personalizado
          </p>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Buscar fabricantes por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/80 border-gray-200 h-12"
          />
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total de Fabricantes</p>
                  <p className="text-3xl font-bold text-blue-900">{filteredFabricantes.length}</p>
                </div>
                <Store className="w-12 h-12 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grid de Fabricantes */}
        {filteredFabricantes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFabricantes.map((fabricante) => (
              <Card key={fabricante.id} className="bg-white shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    {fabricante.logomarca ? (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg p-2 flex-shrink-0">
                        <img
                          src={fabricante.logomarca}
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="w-8 h-8 text-blue-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-1 line-clamp-2">
                        {fabricante.empresa || fabricante.full_name}
                      </CardTitle>
                      {fabricante.cnpj && (
                        <p className="text-xs text-gray-500">CNPJ: {fabricante.cnpj}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fabricante.endereco && (
                    <p className="text-sm text-gray-600 line-clamp-2">{fabricante.endereco}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {fabricante.whatsapp && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                        WhatsApp
                      </Badge>
                    )}
                    {fabricante.site && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        Site
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 pt-3">
                    <Button
                      onClick={() => downloadFabricanteTable(fabricante)}
                      disabled={downloadingTable === fabricante.id}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {downloadingTable === fabricante.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          Baixando...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Tabela
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => openChat(fabricante)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Atendimento IA
                    </Button>

                    <Button
                      onClick={() => openCatalogo(fabricante)}
                      className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                      size="sm"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Ver Catálogo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhum fabricante encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm
                  ? "Tente ajustar os termos de busca."
                  : "Não há fabricantes aprovados no momento."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Chat */}
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Atendimento IA - {selectedFabricante?.empresa || selectedFabricante?.full_name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sendingMessage && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
              disabled={sendingMessage}
            />
            <Button
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || sendingMessage}
              className="bg-gradient-to-r from-blue-600 to-green-600"
            >
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Catálogo */}
      <Dialog open={showCatalogoDialog} onOpenChange={setShowCatalogoDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Catálogo - {selectedFabricante?.empresa || selectedFabricante?.full_name}
            </DialogTitle>
          </DialogHeader>

          {loadingCatalogo ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando catálogo...</p>
            </div>
          ) : catalogoProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogoProducts.map((product) => (
                <Card key={product.id} className="bg-white">
                  <CardContent className="p-4">
                    {product.foto && (
                      <img
                        src={product.foto}
                        alt={product.nome}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h4 className="font-bold text-sm mb-2 line-clamp-2">{product.nome}</h4>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><strong>Código:</strong> {product.cod}</p>
                      {product.peso && <p><strong>Peso:</strong> {product.peso} kg</p>}
                      {product.dimensoes && <p><strong>Dimensões:</strong> {product.dimensoes} cm</p>}
                      <p><strong>Unidade:</strong> {product.und}</p>
                      {product.preco_fabricante && (
                        <p className="text-green-600 font-bold">
                          R$ {product.preco_fabricante.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Este fabricante não possui produtos no catálogo.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}