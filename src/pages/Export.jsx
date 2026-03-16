import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useLogoColors } from "@/components/export/useLogoColors";
import {
  Download,
  FileText,
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

export default function Export() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const { toast } = useToast();
  const colors = useLogoColors(user?.logomarca);

  const generatePreview = (productsData, supplierProductsData) => {
    const availableProducts = supplierProductsData.filter(sp => sp.preco > 0);

    const preview = availableProducts.map(sp => {
      const product = productsData.find(p => p.id === sp.product_id);
      return product ? {
        nome: product.nome,
        cod: product.cod || '',
        categoria: product.categoria || 'Outros',
        und: product.und || 'peça',
        dimensoes: product.dimensoes || '',
        peso: product.peso ? `${product.peso}kg` : '',
        preco: sp.preco,
        precoFormatado: `R$ ${sp.preco.toFixed(2)}`
      } : null;
    }).filter(Boolean);

    setPreviewData(preview);
  };

  const generatePreviewForFabricante = (productsData) => {
    const preview = productsData.map(product => ({
      nome: product.nome,
      cod: product.cod || '',
      categoria: product.categoria || 'Outros',
      und: product.und || 'peça',
      dimensoes: product.dimensoes || '',
      peso: product.peso ? `${product.peso}kg` : '',
      preco: parseFloat(product.preco_fabricante || 0),
      precoFormatado: product.preco_fabricante ? `R$ ${parseFloat(product.preco_fabricante).toFixed(2)}` : 'R$ 0,00'
    }));

    setPreviewData(preview);
  };

  const loadData = useCallback(async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role === 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      // Verificar se é fabricante
      const isFabricante = currentUser.tipo_usuario === 'fabricante';

      if (isFabricante) {
        // Para fabricantes, buscar produtos criados por eles
        const allProducts = await base44.entities.Product.list();
        const productsData = allProducts.filter(p => 
          p.fabricante_id === currentUser.id && 
          p.aprovado_produto === true && 
          p.ativo !== false
        );
        
        console.log('Produtos do fabricante:', productsData);
        
        setProducts(productsData);
        setSupplierProducts([]); // Fabricantes não usam SupplierProduct
        generatePreviewForFabricante(productsData);
      } else {
        // Para fornecedores, buscar produtos normalmente
        const [productsData, supplierProductsData] = await Promise.all([
          base44.entities.Product.filter({ ativo: true }),
          base44.entities.SupplierProduct.filter({ supplier_id: currentUser.id, disponivel: true })
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
      const linhas = itens.map((item, idx) => `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding:7px 10px;font-size:10px;color:#64748b;font-family:monospace;white-space:nowrap;">${item.cod || '—'}</td>
          <td style="padding:7px 10px;font-size:11px;font-weight:600;color:#1e293b;">${item.nome}</td>
          <td style="padding:7px 10px;font-size:10px;color:#475569;text-align:center;">${item.peso || item.dimensoes || '—'}</td>
          <td style="padding:7px 10px;font-size:10px;color:#475569;text-align:center;">${item.und || 'peça'}</td>
          <td style="padding:7px 10px;font-size:11px;font-weight:700;color:#16a34a;text-align:right;white-space:nowrap;">${item.precoFormatado}</td>
        </tr>`).join('');

      return `
        <div style="margin-bottom:28px;page-break-inside:avoid;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:0;padding:9px 14px;background:linear-gradient(90deg,${c.primaryDark} 0%,${c.primary} 100%);border-radius:6px 6px 0 0;">
            <span style="font-size:14px;">${icon}</span>
            <span style="font-size:12px;font-weight:700;color:${c.textOnPrimary};letter-spacing:1.5px;text-transform:uppercase;">${cat}</span>
            <span style="margin-left:auto;font-size:10px;color:${c.light};font-weight:500;">${itens.length} produto${itens.length !== 1 ? 's' : ''}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
            <thead>
              <tr style="background:transparent;">
                <th style="padding:7px 10px;font-size:9px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;white-space:nowrap;width:80px;">Código</th>
                <th style="padding:7px 10px;font-size:9px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;">Produto</th>
                <th style="padding:7px 10px;font-size:9px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;text-align:center;width:90px;">Especificação</th>
                <th style="padding:7px 10px;font-size:9px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;text-align:center;width:70px;">Unidade</th>
                <th style="padding:7px 10px;font-size:9px;font-weight:700;color:#1e293b !important;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0;text-align:right;width:90px;">Preço</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
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
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; color: #1e293b; background: #fff; }
    .page-wrapper { padding: 28px 32px 24px 32px; }

    /* CAPA/HEADER */
    .cover { display: flex; align-items: center; gap: 20px; padding: 20px 24px; background: linear-gradient(135deg, ${c.primaryDark} 0%, ${c.primary} 50%, ${c.secondary} 100%); border-radius: 10px; margin-bottom: 20px; }
    .cover-logo { width: 72px; height: 72px; object-fit: contain; background: #fff; border-radius: 8px; padding: 6px; flex-shrink: 0; }
    .cover-logo-placeholder { width: 72px; height: 72px; background: rgba(255,255,255,0.15); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; }
    .cover-body { flex: 1; }
    .cover-title { font-size: 22px; font-weight: 800; color: #1e293b !important; letter-spacing: -0.5px; line-height: 1.2; }
    .cover-subtitle { font-size: 11px; font-weight: 600; color: #1e293b !important; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; margin-top: 2px; }
    .cover-contacts { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 8px; }
    .cover-contact { font-size: 10px; color: #1e293b !important; display: flex; align-items: center; gap: 4px; }
    .cover-right { text-align: right; flex-shrink: 0; }
    .cover-doc-title { font-size: 13px; font-weight: 800; color: ${c.textOnPrimary}; text-transform: uppercase; letter-spacing: 1px; }
    .cover-date { font-size: 10px; color: #1e293b !important; margin-top: 4px; }
    .cover-badge { margin-top: 8px; display: inline-block; background: rgba(255,255,255,0.15); color: #1e293b !important; font-size: 9px; padding: 3px 8px; border-radius: 20px; font-weight: 600; letter-spacing: 0.5px; }

    /* STATS BAR */
    .stats-bar { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat-card { flex: 1; background: #f8fafc; border: 1px solid ${c.lightBorder}; border-radius: 6px; padding: 10px 14px; text-align: center; }
    .stat-num { font-size: 20px; font-weight: 800; color: ${c.textAccent}; }
    .stat-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }

    /* CONTENT */
    .section-divider { border: none; border-top: 1px solid #e2e8f0; margin: 18px 0; }

    /* FOOTER */
    .footer { margin-top: 28px; border-top: 2px solid ${c.primary}; padding-top: 16px; }
    .footer-title { font-size: 11px; font-weight: 800; color: ${c.textAccent}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .footer-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
    .footer-item { flex: 1; min-width: 120px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
    .footer-item-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .footer-item-value { font-size: 10px; color: #1e293b; font-weight: 500; }
    .footer-disclaimer { font-size: 9px; color: #64748b; line-height: 1.5; background: #fefce8; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; }
    .footer-bottom { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; }
    .footer-brand { font-size: 9px; color: #94a3b8; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-wrapper { padding: 20px 24px; }
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
      <div class="cover-subtitle">PlaceFit — Equipamentos Fitness</div>
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
      <div class="cover-badge">PlaceFit · Documento Oficial</div>
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
      <div class="footer-brand">Gerado por PlaceFit — Plataforma de Revendedores de Equipamentos Fitness</div>
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

    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(buildPDFHTML());
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 800);
      }

      toast({
        title: "PDF gerado!",
        description: "Seu documento está pronto para impressão ou salvar como PDF.",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar PDF. Tente novamente.",
        variant: "destructive"
      });
    }
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
  const availableProductsCount = isFabricante ? products.length : supplierProducts.filter(sp => sp.preco > 0).length;

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preview da Tabela */}
          <div className="lg:col-span-2">
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
              <CardContent className="overflow-x-auto">
                {previewData.length > 0 ? (() => {
                  const categorias = {};
                  previewData.forEach(item => {
                    const cat = item.categoria || 'Outros';
                    if (!categorias[cat]) categorias[cat] = [];
                    categorias[cat].push(item);
                  });
                  return (
                    <div className="space-y-4">
                      {/* Header da empresa */}
                      <div className="rounded-xl overflow-hidden" style={{background: colors ? `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.primary} 60%, ${colors.secondary} 100%)` : 'linear-gradient(135deg,#0f172a,#1e3a5f,#1e40af)'}}>
                        <div className="flex items-center gap-4 p-4">
                          {user?.logomarca ? (
                            <img src={user.logomarca} alt="Logo" className="w-14 h-14 object-contain bg-white rounded-lg p-1 flex-shrink-0" />
                          ) : (
                            <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">🏋️</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{color: colors ? colors.light : '#93c5fd'}}>PlaceFit</p>
                            <h2 className="text-base font-bold truncate" style={{color: colors ? colors.textOnPrimary : '#ffffff'}}>{user?.empresa || user?.full_name}</h2>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {user?.whatsapp && <span className="text-xs" style={{color: colors ? colors.light : '#cbd5e1'}}>📱 {user.whatsapp}</span>}
                              {user?.email && <span className="text-xs" style={{color: colors ? colors.light : '#cbd5e1'}}>✉ {user.email}</span>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-bold uppercase tracking-wider" style={{color: colors ? colors.textOnPrimary : '#ffffff'}}>Tabela de<br/>Preços</p>
                            <p className="text-xs mt-1" style={{color: colors ? colors.light : '#93c5fd'}}>{new Date().toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Produtos por categoria */}
                      {Object.entries(categorias).map(([cat, itens]) => (
                        <div key={cat} className="rounded-lg overflow-hidden border" style={{borderColor: colors ? colors.lightBorder : '#e2e8f0'}}>
                          <div className="flex items-center justify-between px-3 py-2" style={{background: colors ? `linear-gradient(90deg, ${colors.primaryDark} 0%, ${colors.primary} 100%)` : 'linear-gradient(90deg,#1e3a5f,#1e40af)'}}>
                            <span className="text-xs font-bold uppercase tracking-widest" style={{color: colors ? colors.textOnPrimary : '#ffffff'}}>{cat}</span>
                            <span className="text-xs" style={{color: colors ? colors.light : '#93c5fd'}}>{itens.length} produto{itens.length !== 1 ? 's' : ''}</span>
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-gray-200">
                                <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide w-16" style={{color: '#1e293b !important'}}>Cód.</th>
                                <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide" style={{color: '#1e293b !important'}}>Produto</th>
                                <th className="px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide w-20 hidden md:table-cell" style={{color: '#1e293b !important'}}>Espec.</th>
                                <th className="px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide w-16 hidden md:table-cell" style={{color: '#1e293b !important'}}>Und.</th>
                                <th className="px-3 py-1.5 text-right text-xs font-semibold uppercase tracking-wide w-24" style={{color: '#1e293b !important'}}>Preço</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itens.map((item, i) => (
                                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                  <td className="px-3 py-2 font-mono text-gray-400 whitespace-nowrap overflow-hidden max-w-[64px]" style={{textOverflow:'ellipsis'}}>{item.cod || '—'}</td>
                                  <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap overflow-hidden max-w-[200px]" style={{textOverflow:'ellipsis'}}>{item.nome}</td>
                                  <td className="px-3 py-2 text-center text-gray-500 hidden md:table-cell whitespace-nowrap">{item.peso || item.dimensoes || '—'}</td>
                                  <td className="px-3 py-2 text-center text-gray-500 hidden md:table-cell whitespace-nowrap">{item.und || 'peça'}</td>
                                  <td className="px-3 py-2 text-right font-bold text-green-700 whitespace-nowrap">{item.precoFormatado}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}

                      {/* Rodapé */}
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        ⚠️ Tabela sujeita a alterações sem aviso prévio. Consulte disponibilidade antes do pedido.
                      </div>
                    </div>
                  );
                })() : (
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