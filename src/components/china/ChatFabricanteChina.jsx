import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Globe, MessageCircle, RefreshCw, Languages } from "lucide-react";

/**
 * Chat bilíngue PT-BR ↔ Mandarim com fabricante chinês
 * Usa ChatHistory entity para persistência
 */
export default function ChatFabricanteChina({ fabricante, open, onClose }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [traduzindo, setTraduzindo] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && fabricante) carregarHistorico();
  }, [open, fabricante]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const carregarHistorico = async () => {
    const hist = await base44.entities.ChatHistory.filter({ fabricante_id: fabricante.id });
    const msgs = [];
    hist.forEach(h => {
      msgs.push({ role: "user", text: h.user_message, text_zh: h.user_message_zh, ts: h.created_date });
      msgs.push({ role: "assistant", text: h.agent_response, ts: h.created_date });
    });
    msgs.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    setMensagens(msgs);
  };

  const enviarMensagem = async () => {
    if (!texto.trim() || enviando) return;
    const msgPt = texto.trim();
    setTexto("");
    setEnviando(true);

    // Adicionar mensagem do usuário imediatamente
    setMensagens(prev => [...prev, { role: "user", text: msgPt, ts: new Date().toISOString() }]);

    // Traduzir PT → ZH e obter resposta simulada do fabricante
    setTraduzindo(true);
    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um assistente bilíngue (Português Brasileiro e Mandarim Chinês Simplificado) para comunicação entre revendedores brasileiros e fabricantes chineses de equipamentos esportivos.

Fabricante: ${fabricante.nome_fabrica} (HUB: ${fabricante.hub})
Contato: ${fabricante.contato_nome || "Não informado"}
Mensagem do revendedor (PT-BR): "${msgPt}"

Faça:
1. Traduza a mensagem para Mandarim Simplificado (como seria enviada ao fabricante)
2. Simule uma resposta profissional do fabricante em Mandarim e traduza para PT-BR

Retorne JSON:
- mensagem_zh: tradução da mensagem em Mandarim
- resposta_fabricante_zh: resposta do fabricante em Mandarim
- resposta_fabricante_pt: tradução da resposta para PT-BR`,
      response_json_schema: {
        type: "object",
        properties: {
          mensagem_zh: { type: "string" },
          resposta_fabricante_zh: { type: "string" },
          resposta_fabricante_pt: { type: "string" }
        }
      }
    });
    setTraduzindo(false);

    const msgZh = resultado.mensagem_zh || "";
    const respZh = resultado.resposta_fabricante_zh || "";
    const respPt = resultado.resposta_fabricante_pt || "—";

    // Salvar no histórico
    await base44.entities.ChatHistory.create({
      fabricante_id: fabricante.id,
      fabricante_nome: fabricante.nome_fabrica,
      user_message: msgPt,
      user_message_zh: msgZh,
      agent_response: respPt,
      agent_response_zh: respZh,
    });

    // Atualizar mensagens com tradução e resposta
    setMensagens(prev => [
      ...prev.slice(0, -1),
      { role: "user", text: msgPt, text_zh: msgZh, ts: new Date().toISOString() },
      { role: "assistant", text: respPt, text_zh: respZh, ts: new Date().toISOString() }
    ]);

    setEnviando(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-red-50 to-orange-50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-sm font-bold text-red-700">
              🇨🇳
            </div>
            <div>
              <p className="font-bold text-gray-900">{fabricante?.nome_fabrica}</p>
              <p className="text-xs text-gray-500 font-normal flex items-center gap-1">
                <Languages className="w-3 h-3" />
                Tradução automática PT-BR ↔ 中文
              </p>
            </div>
          </DialogTitle>
          <div className="flex gap-2 mt-2">
            {fabricante?.contato_nome && (
              <Badge className="bg-white text-gray-600 border border-gray-200 text-xs">
                👤 {fabricante.contato_nome}
              </Badge>
            )}
            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              📍 {fabricante?.hub}, China
            </Badge>
          </div>
        </DialogHeader>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {mensagens.length === 0 && (
            <div className="text-center py-10">
              <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Inicie uma conversa com o fabricante</p>
              <p className="text-xs text-gray-400 mt-1">Suas mensagens serão traduzidas automaticamente para Mandarim</p>
              <div className="mt-4 grid grid-cols-1 gap-2 max-w-xs mx-auto">
                {[
                  "Qual o prazo de produção mínimo?",
                  "Vocês têm certificação de qualidade?",
                  "Qual o pedido mínimo (MOQ)?"
                ].map(s => (
                  <button key={s} onClick={() => setTexto(s)}
                    className="text-xs text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-600">
                    💬 {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs mr-2 shrink-0 mt-1">
                  🏭
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm"
              }`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
                {msg.text_zh && (
                  <p className={`text-xs mt-1.5 ${msg.role === "user" ? "text-blue-200" : "text-gray-400"}`}>
                    🀄 {msg.text_zh}
                  </p>
                )}
              </div>
            </div>
          ))}

          {(enviando || traduzindo) && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-xs mr-2">
                🏭
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {traduzindo ? "Traduzindo e aguardando resposta..." : "Processando..."}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-white shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-400">Escreva em Português · será traduzido para 中文</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Digite sua mensagem em português..."
              disabled={enviando}
              className="flex-1"
            />
            <Button
              onClick={enviarMensagem}
              disabled={!texto.trim() || enviando}
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}