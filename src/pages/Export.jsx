import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
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

  const generatePreview = (productsData, supplierProductsData) => {
    const availableProducts = supplierProductsData.filter(sp => sp.preco > 0);

    const preview = availableProducts.map(sp => {
      const product = productsData.find(p => p.id === sp.product_id);
      return product ? {
        codigo: product.cod,
        nome: product.nome,
        categoria: product.categoria,
        unidade: product.und,
        peso: product.peso ? `${product.peso} kg` : '-',
        dimensoes: product.dimensoes || '-',
        preco: `R$ ${sp.preco.toFixed(2)}`,
        observacoes: sp.observacoes || ''
      } : null;
    }).filter(Boolean);

    setPreviewData(preview);
  };

  const generatePreviewForFabricante = (productsData) => {
    const preview = productsData.map(product => ({
      codigo: product.cod,
      nome: product.nome,
      categoria: product.categoria,
      unidade: product.und,
      peso: product.peso ? `${product.peso} kg` : '-',
      dimensoes: product.dimensoes || '-',
      preco: product.preco_fabricante ? `R$ ${parseFloat(product.preco_fabricante).toFixed(2)}` : 'R$ 0,00',
      observacoes: ''
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
        'Código': item.codigo,
        'Nome do Produto': item.nome,
        'Categoria': item.categoria,
        'Unidade': item.unidade,
        'Peso': item.peso,
        'Dimensões (L x A x P)': item.dimensoes,
        'Preço': item.preco,
        'Observações': item.observacoes
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

  const generatePDF = async () => {
    setExporting(true);
    try {
      if (previewData.length === 0) {
        toast({
          title: "Nenhum produto para gerar PDF",
          description: "Sua tabela de preços está vazia.",
          variant: "destructive"
        });
        setExporting(false);
        return;
      }

      // Gerar HTML diretamente
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Tabela de Preços - ${user?.empresa || user?.full_name}</title>
          <style>
            @page { margin: 0; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: white;
              margin: 1cm;
              font-family: Arial, sans-serif;
              color: #000;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              padding: 20px;
            }
            .logo {
              max-width: 150px;
              max-height: 80px;
              margin-bottom: 15px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .company-info {
              font-size: 12px;
              line-height: 1.6;
            }
            .title {
              font-size: 18px;
              font-weight: bold;
              text-align: center;
              margin: 20px 0;
              text-transform: uppercase;
            }
            .date {
              text-align: center;
              font-size: 11px;
              color: #666;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #333;
              padding: 8px;
              text-align: left;
              font-size: 11px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #fafafa;
            }
            .price {
              text-align: right;
              font-weight: bold;
            }
            @media print {
              body { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${user?.logomarca ? `<img src="${user.logomarca}" alt="Logo" class="logo">` : ''}
            <div class="company-name">${user?.empresa || user?.full_name}</div>
            <div class="company-info">
              ${user?.whatsapp ? `Tel: ${user.whatsapp}<br>` : ''}
              ${user?.email ? `E-mail: ${user.email}<br>` : ''}
              ${user?.endereco ? `${user.endereco}<br>` : ''}
              ${user?.site ? `${user.site}` : ''}
            </div>
          </div>

          <div class="title">Tabela de Preços</div>
          <div class="date">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>

          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Unidade</th>
                <th>Peso</th>
                <th style="text-align: right;">Preço</th>
              </tr>
            </thead>
            <tbody>
              ${previewData.map(item => `
                <tr>
                  <td>${item.codigo}</td>
                  <td>${item.nome}</td>
                  <td>${item.categoria}</td>
                  <td>${item.unidade}</td>
                  <td>${item.peso}</td>
                  <td class="price">${item.preco}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      // Criar novo documento para impressão
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Aguardar carregamento e imprimir
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };

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
    setExporting(false);
  };

  const copyPublicLink = () => {
    const link = `${window.location.origin}/PublicTable?supplier=${user.id}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Link público da sua tabela copiado para a área de transferência.",
    });
  };

  const openPublicLink = () => {
    const link = `${window.location.origin}/PublicTable?supplier=${user.id}`;
    window.open(link, '_blank');
  };

  const shareWhatsApp = () => {
    const link = `${window.location.origin}/PublicTable?supplier=${user.id}`;
    const text = `Confira nossa tabela de preços de equipamentos fitness: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareFacebook = () => {
    const link = `${window.location.origin}/PublicTable?supplier=${user.id}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank');
  };

  const shareTelegram = () => {
    const link = `${window.location.origin}/PublicTable?supplier=${user.id}`;
    const text = `Confira nossa tabela de preços de equipamentos fitness`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareLinkedIn = () => {
    const link = `${window.location.origin}/PublicTable?supplier=${user.id}`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, '_blank');
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
                {previewData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Cabeçalho da Empresa */}
                    <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
                      {user?.logomarca && (
                        <div className="w-20 h-20 mx-auto mb-3 rounded-lg overflow-hidden bg-white p-2">
                          <img
                            src={user.logomarca}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <h2 className="text-xl font-bold text-gray-900 mb-2">
                        {user?.empresa || user?.full_name}
                      </h2>
                      <div className="text-sm text-gray-600 space-y-1">
                        {user?.whatsapp && (
                          <div className="flex items-center justify-center gap-1">
                            <Phone className="w-3 h-3" />
                            {user.whatsapp}
                          </div>
                        )}
                        {user?.email && (
                          <div className="flex items-center justify-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                        )}
                        {user?.site && (
                          <div className="flex items-center justify-center gap-1">
                            <Globe className="w-3 h-3" />
                            {user.site}
                          </div>
                        )}
                      </div>
                      <Separator className="my-3" />
                      <p className="font-semibold text-gray-800">TABELA DE PREÇOS</p>
                      <p className="text-xs text-gray-500">
                        Atualizada em {new Date().toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    {/* Tabela */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-500 to-green-500 text-white">
                            <th className="border border-gray-300 px-3 py-2 text-left">Código</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Produto</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Categoria</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Unidade</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Peso</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Dimensões (L x A x P)</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Observações</th>
                            <th className="border border-gray-300 px-3 py-2 text-right">Preço</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((item, index) => (
                            <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                              <td className="border border-gray-300 px-3 py-2 font-mono text-xs">
                                {item.codigo}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 font-medium">
                                {item.nome}
                              </td>
                              <td className="border border-gray-300 px-3 py-2">
                                <Badge variant="outline" className="text-xs">
                                  {item.categoria}
                                </Badge>
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-center">
                                {item.unidade}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-xs">
                                {item.peso}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-xs">
                                {item.dimensoes}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-xs">
                                {item.observacoes}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-right font-bold text-green-700">
                                {item.preco}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
                  disabled={exporting || previewData.length === 0}
                  variant="outline"
                  className="w-full hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Gerando...
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
    </div>
  );
}