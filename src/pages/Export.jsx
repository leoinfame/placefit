import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getProdutosData } from "@/functions/getProdutosData";
import { expandTemplates } from "@/utils/expandTemplates";
import { useLogoColors } from "@/components/export/useLogoColors";
import { paletaDaLoja } from "../../base44/shared/identidadeCores.js";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import PreviewGrid from "@/components/export/PreviewGrid";
import { PDF_CATEGORY_ORDER, groupWeightProducts, buildPDFHTML as buildPDFHTMLShared } from "../../base44/shared/tabelaPdfHtml.js";


export default function Export() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [pdfCatsOpen, setPdfCatsOpen] = useState(false);
  const [selectedCats, setSelectedCats] = useState(null);
  const { toast } = useToast();
  const coresDaLogo = useLogoColors(user?.logomarca);
  // Identidade visual configurada (Perfil → Identidade visual) manda; sem ela, cores da logo
  const [paletaLoja, setPaletaLoja] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    base44.entities.LojaConfig.filter({ revendedor_id: user.id })
      .then((l) => setPaletaLoja(paletaDaLoja(l?.[0])))
      .catch(() => setPaletaLoja(null));
  }, [user?.id]);
  const colors = paletaLoja || coresDaLogo;

  const generatePreview = (productsData, supplierProductsData) => {
    const availableProducts = supplierProductsData.filter(sp => sp.preco > 0);

    const preview = availableProducts.map(sp => {
      const product = productsData.find(p => p.id === sp.product_id);
      if (!product) return null;
      // Preço final com margem aplicada (ou preço promocional se definido)
      const precoFinal = sp.sale_price || (sp.preco * (1 + (sp.margem || 0) / 100));
      return {
        nome: product.nome,
        cod: product.cod || '',
        categoria: product.categoria || 'Outros',
        und: product.und || 'peça',
        peso: product.peso_kg ? `${product.peso_kg}kg` : '',
        peso_kg: product.peso_kg || null,
        foto: product.foto || '',
        preco: precoFinal,
        precoFormatado: `R$ ${precoFinal.toFixed(2)}`
      };
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

      const isFabricante = currentUser.tipo_usuario === 'fabricante' || viewMode === 'fabricante';

      const res = await getProdutosData({ mode: "meus", isFabricante });
      const data = res.data || res;
      const allTemplates = expandTemplates(data.templates || [], data.fieldMap);
      const supplierProductsData = data.mySupplierProducts || [];

      if (isFabricante) {
        const configuredTemplateIds = supplierProductsData.map(sp => sp.product_id);
        const productsData = allTemplates.filter(t => configuredTemplateIds.includes(t.id));
        setProducts(productsData);
        setSupplierProducts(supplierProductsData);
        generatePreviewForFabricante(productsData, supplierProductsData);
      } else {
        setProducts(allTemplates);
        setSupplierProducts(supplierProductsData);
        generatePreview(allTemplates, supplierProductsData);
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

  const fetchImageAsDataURL = async (url) => {
    if (!url) return url;
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) return url;
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return url;
    }
  };

  const buildPDFHTML = (imageMap = {}, items = previewData) => buildPDFHTMLShared({ user, colors, imageMap, items });

  const generatePDF = async (selectedCategories = null) => {
    const items = selectedCategories && selectedCategories.size > 0
      ? previewData.filter(item => selectedCategories.has(item.categoria || 'Outros'))
      : previewData;

    if (items.length === 0) {
      toast({
        title: "Nenhum produto para gerar PDF",
        description: "Sua tabela de preços está vazia.",
        variant: "destructive"
      });
      return;
    }

    setExporting(true);

    // Coletar todas as URLs de imagens únicas e converter para base64
    const imageUrls = new Set();
    if (user?.logomarca) imageUrls.add(user.logomarca);
    items.forEach(item => {
      if (item.foto) imageUrls.add(item.foto);
    });

    const imageMap = {};
    await Promise.all(Array.from(imageUrls).map(async (url) => {
      imageMap[url] = await fetchImageAsDataURL(url);
    }));

    const htmlContent = buildPDFHTML(imageMap, items);

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
      setExporting(false);
    }, 500);
  };

  const pdfCategories = useMemo(() => {
    const counts = {};
    previewData.forEach(item => {
      const cat = item.categoria || 'Outros';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const cats = Object.keys(counts);
    cats.sort((a, b) => {
      const ia = PDF_CATEGORY_ORDER.indexOf(a);
      const ib = PDF_CATEGORY_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'pt-BR');
    });
    return cats.map(c => ({ categoria: c, count: counts[c] }));
  }, [previewData]);

  const openPdfCategoryDialog = () => {
    if (previewData.length === 0) {
      toast({
        title: "Nenhum produto para gerar PDF",
        description: "Sua tabela de preços está vazia.",
        variant: "destructive"
      });
      return;
    }
    const present = pdfCategories.map(c => c.categoria);
    if (selectedCats === null) {
      setSelectedCats(new Set(present));
    } else {
      const stillPresent = new Set([...selectedCats].filter(c => present.includes(c)));
      if (stillPresent.size === 0) present.forEach(c => stillPresent.add(c));
      setSelectedCats(stillPresent);
    }
    setPdfCatsOpen(true);
  };

  const selectedProductCount = pdfCategories
    .filter(c => selectedCats?.has(c.categoria))
    .reduce((s, c) => s + c.count, 0);

  const handleConfirmPdf = () => {
    setPdfCatsOpen(false);
    generatePDF(selectedCats);
  };

  const getPublicLink = () => {
    const isFab = user?.tipo_usuario === 'fabricante';
    return isFab
      ? `${window.location.origin}/PublicTableFabricante?fabricante=${user.id}`
      : `${window.location.origin}/functions/tabela?supplier=${user.id}`; // 022g: prévia com o nome da empresa
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
                  onClick={openPdfCategoryDialog}
                  disabled={exporting || previewData.length === 0}
                  variant="outline"
                  className="w-full hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Preparando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Gerar PDF
                    </>
                  )}
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

      <Dialog open={pdfCatsOpen} onOpenChange={setPdfCatsOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Escolher categorias da tabela</DialogTitle>
            <DialogDescription>Selecione as categorias que deseja incluir no PDF.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedCats(new Set(pdfCategories.map(c => c.categoria)))}>
              Selecionar todas
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedCats(new Set())}>
              Limpar
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedCats?.size || 0} categorias, {selectedProductCount} {selectedProductCount === 1 ? 'produto' : 'produtos'} selecionados
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 -mx-1 px-1 space-y-1">
            {pdfCategories.map(({ categoria, count }) => (
              <label key={categoria} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-accent cursor-pointer">
                <Checkbox
                  checked={selectedCats?.has(categoria) || false}
                  onCheckedChange={(v) => {
                    setSelectedCats(prev => {
                      const base = prev ?? new Set(pdfCategories.map(c => c.categoria));
                      const next = new Set(base);
                      if (v) next.add(categoria); else next.delete(categoria);
                      return next;
                    });
                  }}
                />
                <span className="flex-1 text-sm">{categoria}</span>
                <span className="text-xs text-muted-foreground">{count} {count === 1 ? 'produto' : 'produtos'}</span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPdfCatsOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmPdf} disabled={!selectedCats || selectedCats.size === 0}>
              Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
