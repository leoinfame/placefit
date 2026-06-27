import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useLogoColors } from "@/components/export/useLogoColors";
import {
  Download,
  FileText,
  Printer,
  Table,
  Eye,
  RefreshCw,
  Building,
  Phone,
  Mail,
  Globe,
  Copy,
  Share2,
  ExternalLink,
  Facebook,
  MessageCircle,
  Send,
  Linkedin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import PreviewGrid from "@/components/export/PreviewGrid";

export default function Export() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const { toast } = useToast();
  const colors = useLogoColors(user?.logomarca);

  // Agrupa produtos que têm variações de peso (ex: Halter 1kg, 2kg, 3kg...)
  // em uma única linha, mostrando os pesos disponíveis e o preço do item de referência (1kg)
  const groupWeightProducts = (previewItems) => {
    const withWeight = previewItems.filter(item => item.peso_kg || (item.categoria || '').toLowerCase() === 'kettlebells');
    const withoutWeight = previewItems.filter(item => !item.peso_kg && (item.categoria || '').toLowerCase() !== 'kettlebells');

    const groups = {};
    withWeight.forEach(item => {
      const baseName = item.nome.replace(/\s+\d+([.,]\d+)?kg$/i, '').trim();
      if (!groups[baseName]) {
        groups[baseName] = { items: [], pesos: [], categoria: item.categoria, und: item.und };
      }
      if (item.foto && !groups[baseName].foto) {
        groups[baseName].foto = item.foto;
      }
      groups[baseName].items.push(item);
      groups[baseName].pesos.push(item.peso_kg);
      if (item.peso_kg === 1) {
        groups[baseName].referenceItem = item;
      } else if (!groups[baseName].referenceItem) {
        groups[baseName].referenceItem = item;
      }
    });

    const groupedItems = Object.entries(groups).map(([baseName, group]) => {
      const ref = group.referenceItem || group.items[0];
      const isKettlebell = (group.categoria || '').toLowerCase() === 'kettlebells';
      const pesosPadraoKB = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40];
      const pesosOrdenados = isKettlebell
        ? pesosPadraoKB
        : [...new Set(group.pesos)].sort((a, b) => a - b);
      const isGrouped = group.items.length > 1 || isKettlebell;

      // Calculate price per kg: divide reference price by its weight
      const precoPorKg = (ref.peso_kg && ref.peso_kg > 0) ? ref.preco / ref.peso_kg : ref.preco;

      return {
        nome: isGrouped ? baseName : ref.nome,
        cod: isGrouped ? '' : (ref.cod || ''),
        categoria: ref.categoria,
        und: ref.und || 'peça',
        peso: '',
        pesosDisponiveis: isGrouped ? pesosOrdenados.map(p => `${p}kg`).join(', ') : '',
        foto: group.foto || ref.foto || '',
        preco: isGrouped ? precoPorKg : ref.preco,
        precoFormatado: isGrouped
          ? `R$ ${precoPorKg.toFixed(2)}/kg`
          : ref.precoFormatado,
        isWeightGrouped: isGrouped
      };
    });

    return [...withoutWeight, ...groupedItems];
  };

  const generatePreview = (productsData, supplierProductsData) => {
    const availableProducts = supplierProductsData.filter(sp => sp.preco > 0);

    const preview = availableProducts.map(sp => {
      const product = productsData.find(p => p.id === sp.product_id);
      return product ? {
        nome: product.nome,
        cod: product.cod || '',
        categoria: product.categoria || 'Outros',
        und: product.und || 'peça',
        peso: product.peso_kg ? `${product.peso_kg}kg` : '',
        peso_kg: product.peso_kg || null,
        foto: product.foto || '',
        preco: sp.preco,
        precoFormatado: `R$ ${sp.preco.toFixed(2)}`
      } : null;
    }).filter(Boolean);

    setPreviewData(groupWeightProducts(preview));
  };

  const generatePreviewForFabricante = (productsData, supplierProductsData = []) => {
    const preview = productsData.map(product => {
      const supplierProduct = supplierProductsData.find(sp => sp.product_id === product.id);
      const preco = supplierProduct?.preco || 0;
      
      return {
        nome: product.nome,
        cod: product.cod || '',
        categoria: product.categoria || 'Outros',
        und: product.und || 'peça',
        dimensoes: product.dimensoes || '',
        peso: product.peso_kg ? `${product.peso_kg}kg` : '',
        peso_kg: product.peso_kg || null,
        foto: product.foto || '',
        preco: parseFloat(preco),
        precoFormatado: preco ? `R$ ${parseFloat(preco).toFixed(2)}` : 'R$ 0,00'
      };
    });

    setPreviewData(groupWeightProducts(preview));
  };

  const loadData = useCallback(async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Admin pode visualizar como fabricante/fornecedor
      const viewMode = localStorage.getItem('admin_view_mode') || 'admin';
      if (currentUser.role === 'admin' && viewMode === 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      // Verificar se é fabricante
      const isFabricante = currentUser.tipo_usuario === 'fabricante' || viewMode === 'fabricante';

      // Helper para buscar todos os registros com paginação completa
      const fetchAll = async (entity, query, sort, pageSize = 500) => {
        let all = [];
        let skip = 0;
        while (true) {
          const batch = sort
            ? await entity.filter(query, sort, pageSize, skip)
            : await entity.filter(query, undefined, pageSize, skip);
          all = all.concat(batch);
          if (batch.length < pageSize) break;
          skip += pageSize;
        }
        return all;
      };

      if (isFabricante) {
        // Para fabricantes, buscar apenas templates que ele configurou preço (novo padrão)
        const [allTemplates, supplierProductsData] = await Promise.all([
          fetchAll(base44.entities.ProductTemplate, { ativo: true }),
          fetchAll(base44.entities.SupplierProduct, { supplier_id: currentUser.id })
        ]);
        
        // Filtrar templates que o fabricante tem SupplierProduct
        const configuredTemplateIds = supplierProductsData.map(sp => sp.product_id);
        const productsData = allTemplates.filter(t => configuredTemplateIds.includes(t.id));
        
        setProducts(productsData);
        setSupplierProducts(supplierProductsData);
        generatePreviewForFabricante(productsData, supplierProductsData);
      } else {
        // Para revendedores, buscar templates e seus SupplierProducts (com paginação completa)
        const [productsData, supplierProductsData] = await Promise.all([
          fetchAll(base44.entities.ProductTemplate, { ativo: true }, 'categoria'),
          fetchAll(base44.entities.SupplierProduct, { supplier_id: currentUser.id }, '-created_date')
        ]);

        setProducts(productsData);
        setSupplierProducts(supplierProductsData);
        generatePreview(productsData, supplierProductsData);
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar suas informações. Tente novamente.",
        variant: "destructive"
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportToExcel = async () => {
    setExporting(true);
    try {
      if (previewData.length === 0) {
        toast({
          title: "Nenhum produto para exportar",
          description: "Sua tabela de preços está vazia.",
          variant: "destructive"
        });
        setExporting(false);
        return;
      }

      const exportData = previewData.map(item => ({
        'Nome do Produto': item.nome,
        'Preço': item.preco
      }));

      // Converter para CSV
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        // Cabeçalho da empresa
        `"${user?.empresa || user?.full_name || ''}"`,
        `"${((user?.whatsapp || '') + (user?.whatsapp && user?.email ? ' | ' : '') + (user?.email || ''))}"`, // Corrected character here
        `"${user?.endereco || ''}"`,
        `"${user?.site || ''}"`,
        '', // Linha vazia
        'TABELA DE PREÇOS',
        `"Gerado em: ${new Date().toLocaleDateString('pt-BR')}"`,
        '', // Linha vazia
        // Cabeçalhos das colunas
        headers.map(h => `"${h}"`).join(','),
        // Dados
        ...exportData.map(row =>
          headers.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');

      // Criar e baixar arquivo
      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `tabela_precos_${user?.empresa?.replace(/\s+/g, '_') || 'fornecedor'}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Tabela exportada!",
        description: "Seu arquivo CSV foi baixado com sucesso.",
      });

    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro",
        description: "Erro ao exportar tabela. Tente novamente.",
        variant: "destructive"
      });
    }
    setExporting(false);
  };

  const buildPDFHTML = () => {
    const nomeEmpresa = user?.empresa || user?.full_name || 'Fornecedor';
    const dataGeracao = new Date().toLocaleDateString('pt-BR');
    const c = colors || {
      primary: '#1e3a5f', primaryDark: '#0f172a', secondary: '#1e40af',
      light: '#eff6ff', lightBorder: '#bfdbfe', textOnPrimary: '#ffffff', textAccent: '#1e40af'
    };

    // Agrupar por categoria
    const categorias = {};
    previewData.forEach(item => {
      const cat = item.categoria || 'Outros';
      if (!categorias[cat]) categorias[cat] = [];
      categorias[cat].push(item);
    });

    const categoryIcons = {
      'Cardiovascular': '🏃',
      'Musculação': '💪',
      'Funcional': '🤸',
      'Acessórios': '🎯',
      'Vestuário': '👕',
      'Nutrição': '🥗',
      'Outros': '📦',
    };

    const categoriasBlocos = Object.entries(categorias).map(([cat, itens]) => {
      const icon = categoryIcons[cat] || '📦';
      const cards = itens.map(item => {
        const espec = item.isWeightGrouped ? (item.pesosDisponiveis || '—') : (item.peso || item.dimensoes || '');
        const und = item.isWeightGrouped ? '/kg' : (item.und || 'peça');
        const precoLabel = item.isWeightGrouped ? 'Preço por kg' : 'Preço';
        const fotoHtml = item.foto
          ? `<img src="${item.foto}" alt="${item.nome}" style="width:30px;height:30px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0;flex-shrink:0;">`
          : `<div style="width:30px;height:30px;border-radius:4px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📦</div>`;
        return `
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px;background:#ffffff;break-inside:avoid;display:flex;gap:6px;min-height:78px;">
            ${fotoHtml}
            <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;min-width:0;">
              <div>
                ${item.cod ? `<span style="display:inline-block;font-size:7px;font-family:monospace;color:#64748b;background:#f1f5f9;padding:1px 4px;border-radius:3px;margin-bottom:3px;">${item.cod}</span>` : ''}
                <div style="font-size:9px;font-weight:600;color:#1e293b;line-height:1.25;">${item.nome}</div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;margin:4px 0;">
                ${espec && espec !== '—' ? `<span style="font-size:7px;color:#475569;background:#eff6ff;border:1px solid #dbeafe;padding:1px 5px;border-radius:8px;">${espec}</span>` : ''}
                <span style="font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;">${und}</span>
              </div>
              <div style="display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:3px;">
                <span style="font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;">${precoLabel}</span>
                <span style="font-size:11px;font-weight:700;color:#16a34a;">${item.precoFormatado}</span>
              </div>
            </div>
          </div>`;
      }).join('');

      return `
        <div style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <div style="width:3px;height:14px;background:${c.secondary};border-radius:2px;"></div>
            <span style="font-size:10px;font-weight:700;color:#1e293b;letter-spacing:1px;text-transform:uppercase;">${cat}</span>
            <span style="margin-left:auto;font-size:8px;color:#64748b;font-weight:500;">${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">${cards}</div>
        </div>`;
    }).join('');

    const totalProdutos = previewData.length;
    const totalCategorias = Object.keys(categorias).length;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Tabela de Preços — ${nomeEmpresa}</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; color: #1e293b; background: #fff; }
    .page-wrapper { padding: 12px 16px; }

    /* CAPA/HEADER */
    .cover { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: linear-gradient(135deg, ${c.primaryDark} 0%, ${c.primary} 50%, ${c.secondary} 100%); border-radius: 8px; margin-bottom: 12px; }
    .cover-logo { width: 56px; height: 56px; object-fit: contain; background: #fff; border-radius: 6px; padding: 4px; flex-shrink: 0; }
    .cover-logo-placeholder { width: 56px; height: 56px; background: rgba(255,255,255,0.15); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .cover-body { flex: 1; }
    .cover-title { font-size: 18px; font-weight: 800; color: #1e293b !important; letter-spacing: -0.5px; line-height: 1.1; }
    .cover-subtitle { font-size: 9px; font-weight: 600; color: #1e293b !important; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; margin-top: 0px; }
    .cover-contacts { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; }
    .cover-contact { font-size: 8px; color: #1e293b !important; display: flex; align-items: center; gap: 3px; }
    .cover-right { text-align: right; flex-shrink: 0; }
    .cover-doc-title { font-size: 11px; font-weight: 800; color: #1e293b !important; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1; }
    .cover-date { font-size: 8px; color: #1e293b !important; margin-top: 2px; }
    .cover-badge { margin-top: 4px; display: none; }

    /* STATS BAR */
    .stats-bar { display: flex; gap: 8px; margin-bottom: 12px; }
    .stat-card { flex: 1; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; text-align: center; }
    .stat-num { font-size: 16px; font-weight: 800; color: ${c.textAccent}; }
    .stat-label { font-size: 7px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }

    /* CONTENT */
    .section-divider { border: none; border-top: 1px solid #e2e8f0; margin: 8px 0; }

    /* FOOTER */
    .footer { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .footer-title { font-size: 9px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .footer-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .footer-item { flex: 1; min-width: 80px; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 8px; }
    .footer-item-label { font-size: 7px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
    .footer-item-value { font-size: 8px; color: #1e293b; font-weight: 500; }
    .footer-disclaimer { font-size: 8px; color: #64748b; line-height: 1.4; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; }
    .footer-bottom { margin-top: 8px; display: flex; justify-content: space-between; align-items: center; }
    .footer-brand { font-size: 7px; color: #94a3b8; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-wrapper { padding: 8mm; }
      .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="page-wrapper">

  <!-- CAPA -->
  <div class="cover">
    ${user?.logomarca
      ? `<img src="${user.logomarca}" alt="Logo" class="cover-logo">`
      : `<div class="cover-logo-placeholder">🏋️</div>`}
    <div class="cover-body">
    <div class="cover-title">${nomeEmpresa}</div>
      <div class="cover-contacts">
        ${user?.whatsapp ? `<span class="cover-contact">📱 ${user.whatsapp}</span>` : ''}
        ${user?.email ? `<span class="cover-contact">✉ ${user.email}</span>` : ''}
        ${user?.endereco ? `<span class="cover-contact">📍 ${user.endereco}</span>` : ''}
        ${user?.site ? `<span class="cover-contact">🌐 ${user.site}</span>` : ''}
      </div>
    </div>
    <div class="cover-right">
      <div class="cover-doc-title">Tabela de<br>Preços Oficial</div>
      <div class="cover-date">📅 ${dataGeracao}</div>

    </div>
  </div>

  <!-- STATS -->
  <div class="stats-bar">
    <div class="stat-card">
      <div class="stat-num">${totalProdutos}</div>
      <div class="stat-label">Produtos</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${totalCategorias}</div>
      <div class="stat-label">Categorias</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${dataGeracao}</div>
      <div class="stat-label">Atualizado em</div>
    </div>
  </div>

  <!-- CATEGORIAS E PRODUTOS -->
  ${categoriasBlocos}

  <!-- RODAPÉ COMERCIAL -->
  <div class="footer">
    <div class="footer-title">📋 Informações Comerciais</div>
    <div class="footer-grid">
      <div class="footer-item">
        <div class="footer-item-label">Condições de Pagamento</div>
        <div class="footer-item-value">À vista, cartão, boleto ou transferência bancária</div>
      </div>
      <div class="footer-item">
        <div class="footer-item-label">Prazo de Produção</div>
        <div class="footer-item-value">Consultar disponibilidade no momento do pedido</div>
      </div>
      <div class="footer-item">
        <div class="footer-item-label">Frete</div>
        <div class="footer-item-value">Calculado conforme destino e volume do pedido</div>
      </div>
      <div class="footer-item">
        <div class="footer-item-label">Validade da Tabela</div>
        <div class="footer-item-value">Válida na data de geração: ${dataGeracao}</div>
      </div>
    </div>
    <div class="footer-disclaimer">
      ⚠️ <strong>Aviso:</strong> Esta tabela de preços pode sofrer alterações sem aviso prévio. Consulte disponibilidade e prazo de entrega antes de confirmar o pedido. Os preços praticados são os vigentes no momento da emissão do pedido de compra. Para mais informações, entre em contato com nossa equipe comercial.
    </div>
    <div class="footer-bottom">
      <div class="footer-brand">Documento gerado automaticamente</div>
      <div class="footer-brand">${nomeEmpresa} · ${dataGeracao}</div>
    </div>
  </div>

</div>
</body>
</html>`;
  };

  const generatePDF = () => {
    if (previewData.length === 0) {
      toast({
        title: "Nenhum produto para gerar PDF",
        description: "Sua tabela de preços está vazia.",
        variant: "destructive"
      });
      return;
    }

    const htmlContent = buildPDFHTML();

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(htmlContent);
    iframe.contentDocument.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  const getPublicLink = () => {
    const isFab = user?.tipo_usuario === 'fabricante';
    return isFab
      ? `${window.location.origin}/PublicTableFabricante?fabricante=${user.id}`
      : `${window.location.origin}/PublicTable?supplier=${user.id}`;
  };

  const copyPublicLink = () => {
    navigator.clipboard.writeText(getPublicLink());
    toast({
      title: "Link copiado!",
      description: "Link público da sua tabela copiado para a área de transferência.",
    });
  };

  const openPublicLink = () => {
    window.open(getPublicLink(), '_blank');
  };

  const shareWhatsApp = () => {
    const link = getPublicLink();
    const text = `Confira nossa tabela de preços de equipamentos fitness: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getPublicLink())}`, '_blank');
  };

  const shareTelegram = () => {
    const text = `Confira nossa tabela de preços de equipamentos fitness`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(getPublicLink())}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getPublicLink())}`, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const isFabricante = user?.tipo_usuario === 'fabricante';
  const availableProductsCount = isFabricante ? products.length : supplierProducts.length;

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sua Tabela de Preços</h1>
          <p className="text-gray-600">Visualize, exporte e compartilhe sua tabela personalizada</p>
        </div>

        {/* Verificações */}
        {!user?.aprovado && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800">
              Sua conta ainda não foi aprovada. Entre em contato com a administração para liberar suas funcionalidades.
            </AlertDescription>
          </Alert>
        )}

        {availableProductsCount === 0 && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800">
              Você ainda não configurou preços para nenhum produto. Acesse "Meus Produtos" para começar.
            </AlertDescription>
          </Alert>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Table className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{availableProductsCount}</div>
              <p className="text-sm text-blue-700">Produtos na Tabela</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Building className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">
                {user?.empresa ? '✓' : '?'}
              </div>
              <p className="text-sm text-purple-700">Dados da Empresa</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 border">
            <CardContent className="p-4 text-center">
              <Eye className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">
                {user?.logomarca ? '✓' : '✗'}
              </div>
              <p className="text-sm text-orange-700">Logomarca</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Preview da Tabela */}
          <div className="lg:col-span-3">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Pré-visualização da Tabela
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  disabled={loading || exporting}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                {previewData.length > 0 ? (
                  <PreviewGrid previewData={previewData} user={user} colors={colors} />
                ) : (
                  <div className="text-center py-12">
                    <Table className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Tabela Vazia</h3>
                    <p className="text-gray-600">Configure preços em "Meus Produtos" para gerar sua tabela.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Opções de Exportação e Compartilhamento */}
          <div className="space-y-6">
            {/* Exportar */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Exportar Tabela
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={exportToExcel}
                  disabled={exporting || previewData.length === 0}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white"
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Baixar CSV (Excel)
                    </>
                  )}
                </Button>

                <Button
                  onClick={generatePDF}
                  disabled={previewData.length === 0}
                  variant="outline"
                  className="w-full hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Gerar PDF
                </Button>
              </CardContent>
            </Card>

            {/* Compartilhar */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-5 h-5" />
                  Compartilhar Tabela
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Link Público */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Link Público</Label>
                  <div className="flex gap-2">
                    <Button
                      onClick={copyPublicLink}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar Link
                    </Button>
                    <Button
                      onClick={openPublicLink}
                      variant="outline"
                      size="sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Redes Sociais */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Redes Sociais</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={shareWhatsApp}
                      variant="outline"
                      size="sm"
                      className="hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button
                      onClick={shareFacebook}
                      variant="outline"
                      size="sm"
                      className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                    >
                      <Facebook className="w-4 h-4 mr-2" />
                      Facebook
                    </Button>
                    <Button
                      onClick={shareTelegram}
                      variant="outline"
                      size="sm"
                      className="hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Telegram
                    </Button>
                    <Button
                      onClick={shareLinkedIn}
                      variant="outline"
                      size="sm"
                      className="hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
                    >
                      <Linkedin className="w-4 h-4 mr-2" />
                      LinkedIn
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dicas */}
            <Card className="bg-gradient-to-br from-blue-50 to-green-50 border-blue-200 border">
              <CardContent className="p-4">
                <h4 className="font-medium text-sm text-gray-900 mb-2">💡 Dicas:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Complete seu perfil para uma tabela mais profissional</li>
                  <li>• Adicione sua logomarca no perfil</li>
                  <li>• Configure preços em "Meus Produtos"</li>
                  <li>• Compartilhe com seus clientes!</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}