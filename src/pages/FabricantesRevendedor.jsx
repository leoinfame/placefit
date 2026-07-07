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
import AIResponseFormatter from "@/components/AIResponseFormatter";
import ComissaoConfig from "@/components/ComissaoConfig";

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
  const [showPerfilDialog, setShowPerfilDialog] = useState(false);

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

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setLoading(true);
      }
      
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Usar função backend com service role
      console.log("🔍 Buscando fabricantes via backend...");
      const response = await base44.functions.invoke('getFabricantes', {});
      
      console.log("📦 Resposta recebida:", response);
      
      // Verificar se a resposta tem a estrutura correta
      if (!response || !response.data) {
        throw new Error("Nenhuma resposta do servidor");
      }
      
      if (!response.data.fabricantes) {
        throw new Error("Formato de resposta inválido do servidor");
      }
      
      const fabricantesList = response.data.fabricantes;
      console.log("✅ Fabricantes encontrados:", fabricantesList.length);
      
      setFabricantes(fabricantesList);
      setFilteredFabricantes(fabricantesList);
      
      if (forceRefresh) {
        toast({
          title: "Atualizado!",
          description: "Lista de fabricantes recarregada.",
        });
      }
    } catch (error) {
      console.error("❌ Erro ao carregar fabricantes:", error);
      toast({
        title: "Erro ao carregar fabricantes",
        description: error.message || "Não foi possível carregar fabricantes.",
        variant: "destructive",
      });
      setFabricantes([]);
      setFilteredFabricantes([]);
    }
    setLoading(false);
  };

  const extractLogoColors = (logoUrl) => {
    return new Promise((resolve) => {
      if (!logoUrl) { resolve(null); return; }
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const colorMap = {};
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a < 128) continue;
            const brightness = (r + g + b) / 3;
            if (brightness > 240 || brightness < 20) continue;
            const key = `${Math.round(r/20)*20},${Math.round(g/20)*20},${Math.round(b/20)*20}`;
            colorMap[key] = (colorMap[key] || 0) + 1;
          }
          const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
          if (!sorted.length) { resolve(null); return; }
          const [r1, g1, b1] = sorted[0][0].split(',').map(Number);
          const toHex = (r, g, b) => `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
          const darken = (r, g, b, f=0.6) => toHex(Math.round(r*f), Math.round(g*f), Math.round(b*f));
          const lighten = (r, g, b, f=0.9) => toHex(Math.round(255-(255-r)*f), Math.round(255-(255-g)*f), Math.round(255-(255-b)*f));
          resolve({
            primary: toHex(r1, g1, b1),
            primaryDark: darken(r1, g1, b1),
            secondary: toHex(r1, g1, b1),
            light: lighten(r1, g1, b1),
            lightBorder: lighten(r1, g1, b1, 0.6),
            textOnPrimary: '#ffffff',
            textAccent: darken(r1, g1, b1, 0.7),
          });
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    });
  };

  const downloadFabricanteTable = async (fabricante) => {
    setDownloadingTable(fabricante.id);
    try {
      const allProducts = await base44.entities.Product.list();
      const fabricanteProducts = allProducts.filter(
        p => p.fabricante_id === fabricante.id && p.aprovado_produto === true
      );

      if (fabricanteProducts.length === 0) {
        toast({ title: "Sem produtos", description: "Este fabricante não possui produtos aprovados." });
        setDownloadingTable(null);
        return;
      }

      // Extrair cores da logo
      const logoColors = await extractLogoColors(fabricante.logomarca);
      const c = logoColors || {
        primary: '#1e3a5f', primaryDark: '#0f172a', secondary: '#1e40af',
        light: '#eff6ff', lightBorder: '#bfdbfe', textOnPrimary: '#ffffff', textAccent: '#1e40af'
      };

      const nomeEmpresa = fabricante.empresa || fabricante.full_name;
      const dataGeracao = new Date().toLocaleDateString('pt-BR');

      // Agrupar por categoria
      const categorias = {};
      fabricanteProducts.forEach(p => {
        const cat = p.categoria || 'Outros';
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(p);
      });

      const categoryIcons = {
        'Cardiovascular': '🏃', 'Musculação': '💪', 'Funcional': '🤸',
        'Acessórios': '🎯', 'Anilhas': '🏋️', 'Halteres': '🏋️',
        'Barras': '📊', 'Suportes': '🔧', 'Caneleiras': '🦵',
        'Tornozeleiras': '🦵', 'Cabos': '🔗', 'Complemento': '➕', 'Outros': '📦',
      };

      const categoriasBlocos = Object.entries(categorias).map(([cat, itens]) => {
        const icon = categoryIcons[cat] || '📦';
        const linhas = itens.map((item, idx) => `
          <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
            <td style="padding:4px 6px;font-size:8px;color:#1e293b;font-family:monospace;white-space:nowrap;">${item.cod || '—'}</td>
            <td style="padding:4px 6px;font-size:9px;font-weight:600;color:#1e293b;">${item.nome}</td>
            <td style="padding:4px 6px;font-size:8px;color:#1e293b;text-align:center;">${item.peso ? item.peso + 'kg' : item.dimensoes || '—'}</td>
            <td style="padding:4px 6px;font-size:8px;color:#1e293b;text-align:center;">${item.und || 'peça'}</td>
            <td style="padding:4px 6px;font-size:9px;font-weight:700;color:#16a34a;text-align:right;white-space:nowrap;">${item.preco_fabricante ? 'R$ ' + parseFloat(item.preco_fabricante).toFixed(2) : '—'}</td>
          </tr>`).join('');

        return `
          <div style="margin-bottom:10px;page-break-inside:avoid;">
            <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:transparent;border:1px solid #e2e8f0;border-bottom:none;border-radius:4px 4px 0 0;">
              <span style="font-size:11px;">${icon}</span>
              <span style="font-size:10px;font-weight:700;color:#1e293b;letter-spacing:1px;text-transform:uppercase;">${cat}</span>
              <span style="margin-left:auto;font-size:8px;color:#64748b;font-weight:500;">${itens.length} item${itens.length !== 1 ? 's' : ''}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;font-size:9px;">
              <thead>
                <tr style="background:transparent;">
                 <th style="padding:5px 8px;font-size:8px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.3px;border-bottom:1px solid #e2e8f0;width:70px;">Código</th>
                 <th style="padding:5px 8px;font-size:8px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.3px;border-bottom:1px solid #e2e8f0;">Produto</th>
                 <th style="padding:5px 8px;font-size:8px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.3px;border-bottom:1px solid #e2e8f0;text-align:center;width:60px;">Espec.</th>
                 <th style="padding:5px 8px;font-size:8px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.3px;border-bottom:1px solid #e2e8f0;text-align:center;width:50px;">Und.</th>
                 <th style="padding:5px 8px;font-size:8px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.3px;border-bottom:1px solid #e2e8f0;text-align:right;width:70px;">Preço</th>
                </tr>
              </thead>
              <tbody>${linhas}</tbody>
            </table>
          </div>`;
      }).join('');

      const html = `<!DOCTYPE html>
      <html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Tabela de Preços — ${nomeEmpresa}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #1e293b; background: #fff; }
    .page-wrapper { padding: 12px 16px; }
    .cover { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: transparent; border-radius: 8px; margin-bottom: 6px; }
    .cover-logo { width: 56px; height: 56px; object-fit: contain; background: #fff; border-radius: 6px; padding: 4px; flex-shrink: 0; }
    .cover-logo-placeholder { width: 56px; height: 56px; background: rgba(255,255,255,0.15); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .cover-title { font-size: 18px; font-weight: 800; color: #0f172a !important; line-height: 1.1; }
    .cover-subtitle { font-size: 9px; font-weight: 600; color: #0f172a !important; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; margin-top: 0px; }
    .cover-contact { font-size: 8px; color: #475569 !important; display: inline-block; margin-right: 12px; margin-top: 2px; }
    .cover-right { text-align: right; flex-shrink: 0; }
    .cover-doc-title { font-size: 11px; font-weight: 800; color: #0f172a !important; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1; }
    .cover-date { font-size: 8px; color: #475569 !important; margin-top: 2px; }
    .stats-bar { display: flex; gap: 8px; margin-bottom: 12px; page-break-inside: avoid; }
    .stat-card { flex: 1; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; text-align: center; }
    .stat-num { font-size: 16px; font-weight: 800; color: ${c.primaryDark}; }
    .stat-label { font-size: 7px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
    .footer { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .footer-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .footer-item { flex: 1; min-width: 80px; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 8px; }
    .footer-item-label { font-size: 7px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
    .footer-item-value { font-size: 8px; color: #1e293b; font-weight: 500; }
    .footer-disclaimer { font-size: 8px; color: #64748b; line-height: 1.4; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; }
    .footer-brand { font-size: 7px; color: #94a3b8; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
<div class="page-wrapper">
  <div class="cover">
    ${fabricante.logomarca ? `<img src="${fabricante.logomarca}" alt="Logo" class="cover-logo">` : `<div class="cover-logo-placeholder">🏭</div>`}
    <div style="flex:1;">
      <div class="cover-title">${nomeEmpresa}</div>
      <div style="margin-top:6px;">
        ${fabricante.whatsapp ? `<span class="cover-contact">📱 ${fabricante.whatsapp}</span>` : ''}
        ${fabricante.email ? `<span class="cover-contact">✉ ${fabricante.email}</span>` : ''}
        ${fabricante.endereco ? `<span class="cover-contact">📍 ${fabricante.endereco}</span>` : ''}
        ${fabricante.site ? `<span class="cover-contact">🌐 ${fabricante.site}</span>` : ''}
      </div>
    </div>
    <div class="cover-right">
      <div class="cover-doc-title">Tabela de<br>Preços Oficial</div>
      <div class="cover-date">📅 ${dataGeracao}</div>
    </div>
  </div>

  <div class="stats-bar">
    <div class="stat-card"><div class="stat-num">${fabricanteProducts.length}</div><div class="stat-label">Produtos</div></div>
    <div class="stat-card"><div class="stat-num">${Object.keys(categorias).length}</div><div class="stat-label">Categorias</div></div>
    <div class="stat-card"><div class="stat-num">${dataGeracao}</div><div class="stat-label">Atualizado em</div></div>
  </div>

  ${categoriasBlocos}

  <div class="footer">
    <div class="footer-grid">
      <div class="footer-item"><div class="footer-item-label">Condições de Pagamento</div><div class="footer-item-value">À vista, cartão, boleto ou transferência bancária</div></div>
      <div class="footer-item"><div class="footer-item-label">Prazo de Produção</div><div class="footer-item-value">Consultar disponibilidade no momento do pedido</div></div>
      <div class="footer-item"><div class="footer-item-label">Frete</div><div class="footer-item-value">Calculado conforme destino e volume do pedido</div></div>
      <div class="footer-item"><div class="footer-item-label">Validade da Tabela</div><div class="footer-item-value">Válida na data de geração: ${dataGeracao}</div></div>
    </div>
    <div class="footer-disclaimer">⚠️ <strong>Aviso:</strong> Esta tabela pode sofrer alterações sem aviso prévio. Consulte disponibilidade antes de confirmar o pedido.</div>
    <div style="margin-top:12px;display:flex;justify-content:space-between;">
      <div class="footer-brand">Documento gerado automaticamente</div>
      <div class="footer-brand">${nomeEmpresa} · ${dataGeracao}</div>
    </div>
  </div>
</div>
</body>
</html>`;

      try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 800);
        }

        toast({
          title: "Tabela gerada!",
          description: `Tabela de ${nomeEmpresa} aberta para impressão/PDF.`,
        });
      } catch (printError) {
        console.error("Erro ao imprimir:", printError);
        toast({ title: "Erro", description: "Erro ao gerar tabela para impressão.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Erro ao baixar tabela:", error);
      toast({ title: "Erro", description: "Não foi possível gerar a tabela.", variant: "destructive" });
    } finally {
      setDownloadingTable(null);
    }
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
      // Buscar produtos do fabricante
      const allProducts = await base44.entities.Product.list();
      const products = allProducts.filter(
        p => p.fabricante_id === selectedFabricante.id && p.aprovado_produto === true && p.ativo !== false
      );

      // Buscar base de conhecimento
      const allKnowledge = await base44.entities.AIKnowledge.filter({ 
        fabricante_id: selectedFabricante.id,
        ativo: true
      });
      
      const knowledgeContext = allKnowledge.length > 0 ? `
═══════════════════════════════════════════════════════════════
📖 BASE DE CONHECIMENTO ADICIONAL:
═══════════════════════════════════════════════════════════════

${allKnowledge.map((k, i) => `
CONHECIMENTO ${i + 1} - ${k.categoria}: ${k.titulo}
${k.conteudo}
`).join('\n')}
` : '';

      // Buscar histórico de conversas aprovadas
      const allHistory = await base44.entities.ChatHistory.filter({
        fabricante_id: selectedFabricante.id
      });
      
      const approvedHistory = allHistory.filter(h => 
        h.feedback === "aprovado" || h.correcao
      );
      
      const trainingContext = approvedHistory.length > 0 ? `
═══════════════════════════════════════════════════════════════
📚 EXEMPLOS DE RESPOSTAS APROVADAS (APRENDIZADO):
═══════════════════════════════════════════════════════════════

${approvedHistory.map((h, i) => `
EXEMPLO ${i + 1}:
PERGUNTA: ${h.user_message}
RESPOSTA CORRETA: ${h.correcao || h.agent_response}
${h.observacoes ? `OBSERVAÇÃO: ${h.observacoes}` : ''}
`).join('\n---\n')}
` : '';

      // Criar lista completa de produtos
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

      const systemContext = `
Você é o agente de vendas virtual da ${selectedFabricante.empresa || selectedFabricante.full_name}, fabricante de equipamentos fitness.

${selectedFabricante.instrucoes_agente_ia ? `
═══════════════════════════════════════════════════════════════
🎯 INSTRUÇÕES CUSTOMIZADAS PRIORITÁRIAS:
═══════════════════════════════════════════════════════════════

${selectedFabricante.instrucoes_agente_ia}

⚠️ IMPORTANTE: Estas instruções têm PRIORIDADE sobre as regras padrão.
` : ''}

${trainingContext}

${knowledgeContext}

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

4. 💼 PROFISSIONALISMO:
   • Seja cordial e profissional
   • Responda de forma clara e objetiva
   • Destaque os benefícios dos produtos
   • Incentive o fechamento de negócio
   • Ofereça suporte para dúvidas técnicas

═══════════════════════════════════════════════════════════════
📦 BASE DE DADOS COMPLETA - ${products.length} PRODUTOS:
═══════════════════════════════════════════════════════════════

${productsFullList}

RESPONDA EM PORTUGUÊS BRASILEIRO DE FORMA PROFISSIONAL E COMERCIAL.
`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${systemContext}\n\n════════════════════════════════════════════════════════════════\n💬 MENSAGEM DO CLIENTE:\n════════════════════════════════════════════════════════════════\n\n${userMessage}\n\n════════════════════════════════════════════════════════════════\n⚠️ INSTRUÇÕES DE FORMATAÇÃO:\n════════════════════════════════════════════════════════════════\n\nSe a resposta envolver LISTAR PRODUTOS, siga este formato HTML:\n\n<h3>📦 Produtos Disponíveis</h3>\n<table>\n<tr><th>Código</th><th>Produto</th><th>Unidade</th><th>Especificações</th><th>Preço</th></tr>\n<tr><td>COD-001</td><td>Nome do Produto</td><td>peça</td><td>Peso/Dim</td><td>R$ 000,00</td></tr>\n</table>\n\n<p>Observações adicionais em parágrafos normais.</p>\n\nSe for ORÇAMENTO, use este formato:\n\n<h3>💰 Orçamento</h3>\n<table>\n<tr><th>Item</th><th>Qtd</th><th>Preço Unit.</th><th>Subtotal</th></tr>\n<tr><td>Produto 1</td><td>10</td><td>R$ 100,00</td><td>R$ 1.000,00</td></tr>\n</table>\n<p><strong>Total: R$ 1.000,00</strong></p>\n\nVocê representa a ${selectedFabricante.empresa || selectedFabricante.full_name}.\nSeja profissional, cordial e sempre use HTML para tabelas quando listar produtos ou valores.`,
      });

      const assistantMessage = typeof response === 'string' ? response : response.response || "Desculpe, não consegui processar sua pergunta.";

      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: assistantMessage
      }]);

      // Salvar histórico
      await base44.entities.ChatHistory.create({
        fabricante_id: selectedFabricante.id,
        fabricante_nome: selectedFabricante.empresa || selectedFabricante.full_name,
        user_message: userMessage,
        agent_response: assistantMessage,
        feedback: "pendente"
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

  const openPerfil = (fabricante) => {
    setSelectedFabricante(fabricante);
    setShowPerfilDialog(true);
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

        {/* Busca e Refresh */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Buscar fabricantes por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200 h-12"
            />
          </div>
          <Button
            onClick={() => loadData(true)}
            variant="outline"
            className="h-12 px-6"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar
              </>
            )}
          </Button>
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
                  
                  {fabricante.whatsapp && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        📱 {fabricante.whatsapp}
                      </Badge>
                    </div>
                  )}

                  <Button
                    onClick={() => openPerfil(fabricante)}
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-blue-600 hover:text-blue-700 text-xs"
                  >
                    Ver perfil completo da empresa →
                  </Button>

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

                    <ComissaoConfig
                      fabricanteNome={fabricante.empresa || fabricante.full_name}
                      fabricanteId={fabricante.id}
                      revendedorId={user?.id}
                    />
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
                  className={`max-w-[90%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <AIResponseFormatter content={msg.content} />
                  )}
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

      {/* Dialog de Perfil */}
      <Dialog open={showPerfilDialog} onOpenChange={setShowPerfilDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedFabricante?.logomarca && (
                <img 
                  src={selectedFabricante.logomarca} 
                  alt="Logo" 
                  className="w-12 h-12 object-contain rounded-lg border p-1"
                />
              )}
              Perfil - {selectedFabricante?.empresa || selectedFabricante?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedFabricante && (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações da Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.empresa && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Razão Social</p>
                      <p className="text-gray-900">{selectedFabricante.empresa}</p>
                    </div>
                  )}
                  {selectedFabricante.cnpj && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">CNPJ</p>
                      <p className="text-gray-900">{selectedFabricante.cnpj}</p>
                    </div>
                  )}
                  {selectedFabricante.endereco && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Endereço</p>
                      <p className="text-gray-900">{selectedFabricante.endereco}</p>
                    </div>
                  )}
                  {selectedFabricante.historia_empresa && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Sobre a Empresa</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.historia_empresa}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contatos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contatos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.email && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">E-mail</p>
                      <p className="text-gray-900">{selectedFabricante.email}</p>
                    </div>
                  )}
                  {selectedFabricante.whatsapp && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">WhatsApp</p>
                      <p className="text-gray-900">{selectedFabricante.whatsapp}</p>
                    </div>
                  )}
                  {selectedFabricante.site && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Website</p>
                      <a 
                        href={selectedFabricante.site} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedFabricante.site}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Políticas e Condições */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Políticas e Condições Comerciais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.formas_pagamento && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Formas de Pagamento</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.formas_pagamento}</p>
                    </div>
                  )}
                  {selectedFabricante.prazo_entrega && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Prazo de Entrega</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.prazo_entrega}</p>
                    </div>
                  )}
                  {selectedFabricante.politica_troca && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Política de Troca</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.politica_troca}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}