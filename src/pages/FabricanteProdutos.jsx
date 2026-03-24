import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit3, Trash2, Package, ImageIcon, Upload, CheckCircle, Clock, XCircle, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

export default function FabricanteProdutos() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    nome: "",
    cod: "",
    peso: "",
    dimensoes: "",
    und: "",
    categoria: "",
    foto: "",
    preco_fabricante: "",
    ativo: true
  });
  const [baseProducts, setBaseProducts] = useState([]);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState("produtos");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showBulkCategoryDialog, setShowBulkCategoryDialog] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [applyingBulkCategory, setApplyingBulkCategory] = useState(false);

  const { toast } = useToast();
  const [units, setUnits] = useState([]);

  useEffect(() => {
    loadUser();
    loadProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, selectedCategory]);

  const filterProducts = () => {
    let filtered = products;
    
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.cod.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (selectedCategory !== "all") {
      filtered = filtered.filter(product => product.categoria === selectedCategory);
    }
    
    setFilteredProducts(filtered);
  };

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser.role !== 'fabricante' && currentUser.tipo_usuario !== 'fabricante') {
        window.location.href = '/Dashboard';
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const loadProducts = async () => {
    try {
      const currentUser = await base44.auth.me();
      // Carregar produtos, base, categorias e unidades
      const [allProducts, categoriesData, unitsData] = await Promise.all([
        base44.entities.Product.list('-updated_date'),
        base44.entities.Category.list(),
        base44.entities.Unit.list()
      ]);
      const myProducts = allProducts.filter(p => p.fabricante_id === currentUser.id);
      const baseProds = allProducts.filter(p => !p.fabricante_id && p.ativo !== false);
      setProducts(myProducts);
      setBaseProducts(baseProds);
      setCategories(categoriesData.filter(c => c.ativo).map(c => c.nome));
      setUnits(unitsData.filter(u => u.ativo).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(u => u.nome));
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
    setLoading(false);
  };

  const downloadTemplate = () => {
    // Headers amigáveis para leigos
    const headers = [
      'NOME DO PRODUTO',
      'CÓDIGO (SKU)',
      'CATEGORIA',
      'UNIDADE DE VENDA',
      'PESO (kg)',
      'DIMENSÕES (Largura x Altura x Profundidade em cm)',
      'PREÇO SUGERIDO (R$)',
      'LINK DA FOTO (opcional)'
    ];

    // Instruções na primeira linha
    const instructions = [
      '👉 Preencha o nome completo do produto',
      '👉 Código único do produto (ex: EST-001)',
      '👉 Use: Cardiovascular, Musculação, Funcional, Acessórios, Vestuário ou Nutrição',
      '👉 Use: peça, par, kg, metro, litro ou caixa',
      '👉 Peso em quilogramas (ex: 85.5)',
      '👉 Formato: 200 x 80 x 150',
      '👉 Apenas números (ex: 2999.90)',
      '👉 URL da imagem do produto'
    ];
    
    // Pegar até 5 produtos como exemplo
    const sampleProducts = baseProducts.slice(0, 5);
    
    const rows = sampleProducts.map(p => [
      p.nome || '',
      p.cod || '',
      p.categoria || '',
      p.und || '',
      p.peso || '',
      p.dimensoes || '',
      p.preco_fabricante || '',
      p.foto || ''
    ]);

    // Se não houver produtos base, criar exemplos genéricos
    if (rows.length === 0) {
      rows.push(
        ['Esteira Profissional X1', 'EST-PRO-X1', 'Cardiovascular', 'peça', '120', '200 x 80 x 150', '8500.00', ''],
        ['Bicicleta Ergométrica Pro', 'BIC-ERG-PRO', 'Cardiovascular', 'peça', '45', '120 x 60 x 140', '3200.00', ''],
        ['Banco Supino Ajustável', 'BSA-001', 'Musculação', 'peça', '35', '150 x 60 x 50', '1800.00', '']
      );
    }

    // Linha separadora
    const separator = ['───────────', '───────────', '───────────', '───────────', '───────────', '───────────', '───────────', '───────────'];
    
    // Linha de aviso
    const notice = ['⬇️ APAGUE AS LINHAS ACIMA E PREENCHA SEUS PRODUTOS ABAIXO ⬇️', '', '', '', '', '', '', ''];

    const csvContent = [
      '📋 TEMPLATE DE CADASTRO DE PRODUTOS - PLACEFIT',
      '',
      headers.join(';'),
      instructions.join(';'),
      separator.join(';'),
      '📌 EXEMPLOS (pode apagar):',
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')),
      separator.join(';'),
      notice.join(';'),
      '',
      ''
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_produtos_fabricante_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Template baixado!",
      description: "Abra no Excel, preencha seus produtos e faça o upload.",
    });
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              cod: { type: "string" },
              categoria: { type: "string" },
              und: { type: "string" },
              peso: { type: "number" },
              dimensoes: { type: "string" },
              preco_fabricante: { type: "number" },
              foto: { type: "string" }
            }
          }
        }
      });

      if (result.status === 'success' && result.output) {
        const productsToCreate = result.output.filter(p => p.nome && p.cod);
        
        for (const prod of productsToCreate) {
          await base44.entities.Product.create({
            nome: prod.nome,
            cod: prod.cod,
            categoria: prod.categoria || 'Acessórios',
            und: prod.und || 'peça',
            peso: prod.peso || null,
            dimensoes: prod.dimensoes || '',
            preco_fabricante: prod.preco_fabricante || null,
            foto: prod.foto || '',
            fabricante_id: user.id,
            fabricante_nome: user.empresa || user.full_name,
            aprovado_produto: false,
            ativo: true
          });
        }

        toast({
          title: "Importação concluída!",
          description: `${productsToCreate.length} produto(s) importado(s) com sucesso. Aguarde aprovação.`,
        });
        
        loadProducts();
      } else {
        toast({
          title: "Erro na importação",
          description: result.details || "Não foi possível processar o arquivo.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar arquivo. Verifique o formato.",
        variant: "destructive"
      });
    }
    setImporting(false);
    e.target.value = '';
  };

  const notificarAlteracao = async (produtoId, produtoAntigo, produtoNovo) => {
    try {
      const precoMudou = produtoAntigo.preco_fabricante !== produtoNovo.preco_fabricante;
      const nomeMudou = produtoAntigo.nome !== produtoNovo.nome;
      
      if (!precoMudou && !nomeMudou) return;

      const precoAntigoNum = parseFloat(produtoAntigo.preco_fabricante || 0);
      const precoNovoNum = parseFloat(produtoNovo.preco_fabricante || 0);
      const descricaoMudanca = precoMudou 
        ? `R$ ${precoAntigoNum.toFixed(2)} → R$ ${precoNovoNum.toFixed(2)}`
        : 'dados atualizados';

      const notificacoes = [];

      // Admins
      const admins = await base44.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        notificacoes.push({
          supplier_id: admin.id,
          tipo: 'alteracao_preco',
          produto_id: produtoId,
          produto_nome: produtoNovo.nome,
          fabricante_id: produtoAntigo.fabricante_id,
          fabricante_nome: user.empresa || user.full_name,
          preco_antigo: precoAntigoNum,
          preco_novo: precoNovoNum,
          mensagem: `${user.empresa || user.full_name} alterou "${produtoNovo.nome}": ${descricaoMudanca}`,
          lida: false
        });
      }

      // Fornecedores que têm esse produto
      const fornecedoresComProduto = await base44.entities.SupplierProduct.filter({
        product_id: produtoId
      });
      for (const sp of fornecedoresComProduto) {
        notificacoes.push({
          supplier_id: sp.supplier_id,
          tipo: 'alteracao_preco',
          produto_id: produtoId,
          produto_nome: produtoNovo.nome,
          fabricante_id: produtoAntigo.fabricante_id,
          fabricante_nome: user.empresa || user.full_name,
          preco_antigo: precoAntigoNum,
          preco_novo: precoNovoNum,
          mensagem: `Produto "${produtoNovo.nome}" foi alterado: ${descricaoMudanca}`,
          lida: false
        });
      }

      // Criar todas as notificações
      if (notificacoes.length > 0) {
        await base44.entities.Notification.bulkCreate(notificacoes);
      }

      return notificacoes.length;
    } catch (error) {
      console.error("Erro ao notificar alteração:", error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (!editingProduct) {
        // Novo produto
        const productData = { ...formData };
        productData.fabricante_id = user.id;
        productData.fabricante_nome = user.empresa || user.full_name;
        productData.aprovado_produto = false;
        
        await base44.entities.Product.create(productData);
        toast({
          title: "Produto criado!",
          description: "Aguarde aprovação do administrador.",
        });
      } else {
        // Produto existente
        await base44.entities.Product.update(editingProduct.id, formData);
        
        // Se produto aprovado, notificar sobre alterações
        if (editingProduct.aprovado_produto) {
          try {
            const qtdNotif = await notificarAlteracao(
              editingProduct.id,
              editingProduct,
              formData
            );
            
            toast({
              title: "Produto atualizado!",
              description: qtdNotif > 0 ? `${qtdNotif} notificação(ões) enviada(s).` : "Alterações salvas.",
            });
          } catch (err) {
            console.error("Erro ao notificar:", err);
            toast({
              title: "Erro ao notificar",
              description: "Produto salvo, mas falha ao notificar usuários.",
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "Produto atualizado!",
            description: "Aguarde aprovação do administrador.",
          });
        }
      }
      
      setShowDialog(false);
      resetForm();
      loadProducts();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar produto. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (product) => {
    if (!categories.length || !units.length) {
      toast({
        title: "Aguarde",
        description: "Carregando dados do formulário...",
        variant: "destructive"
      });
      return;
    }
    setEditingProduct(product);
    setFormData({
      nome: product.nome || "",
      cod: product.cod || "",
      peso: product.peso || "",
      dimensoes: product.dimensoes || "",
      und: product.und || "",
      categoria: product.categoria || "",
      foto: product.foto || "",
      preco_fabricante: product.preco_fabricante || "",
      ativo: product.ativo !== undefined ? product.ativo : true
    });
    setShowDialog(true);
  };

  const handleDelete = async (product) => {
    if (!product.aprovado_produto) {
      toast({
        title: "Produto não aprovado",
        description: "Produtos não aprovados não podem ser excluídos. Aguarde aprovação ou entre em contato com o administrador.",
        variant: "destructive"
      });
      return;
    }

    if (confirm(`Tem certeza que deseja excluir "${product.nome}"?`)) {
      try {
        await base44.entities.Product.delete(product.id);
        loadProducts();
        toast({
          title: "Produto excluído",
          description: `${product.nome} foi removido do catálogo.`,
        });
      } catch (error) {
        console.error("Erro ao excluir produto:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir produto. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, foto: file_url });
      toast({
        title: "Foto enviada!",
        description: "Foto do produto carregada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar foto. Tente novamente.",
        variant: "destructive"
      });
    }
    setUploadingPhoto(false);
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      cod: "",
      peso: "",
      dimensoes: "",
      und: "",
      categoria: "",
      foto: "",
      preco_fabricante: "",
      ativo: true
    });
    setEditingProduct(null);
  };

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkCategoryChange = async () => {
    if (!bulkCategory) return;
    setApplyingBulkCategory(true);
    let updated = 0;
    for (const productId of selectedProducts) {
      try {
        await base44.entities.Product.update(productId, { categoria: bulkCategory });
        updated++;
      } catch (error) {
        console.error(error);
      }
    }
    await loadProducts();
    setSelectedProducts([]);
    setShowBulkCategoryDialog(false);
    setBulkCategory("");
    setApplyingBulkCategory(false);
    toast({
      title: "Categorias atualizadas!",
      description: `${updated} produto(s) atualizados com sucesso.`,
    });
  };

  const getStatusBadge = (product) => {
    if (!product.aprovado_produto) {
      return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" />Aguardando Aprovação</Badge>;
    }
    if (!product.ativo) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Inativo</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
  };

  const getStats = () => {
    const total = products.length;
    const approved = products.filter(p => p.aprovado_produto).length;
    const pending = products.filter(p => !p.aprovado_produto).length;
    
    return { total, approved, pending };
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = getStats();

  return (
    <div className="p-4 md:p-8 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 w-full max-w-full">
        {/* Header */}
        <div className="flex flex-col gap-4 w-full">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Meus Produtos - Fabricante</h1>
            <p className="text-sm md:text-base text-gray-600">Cadastre e gerencie seus produtos</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button 
              variant="outline"
              onClick={downloadTemplate}
              className="border-green-200 text-green-700 hover:bg-green-50 w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="text-sm">Baixar Template</span>
            </Button>
            <Button 
              onClick={() => setShowDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="text-sm">Novo Produto</span>
            </Button>
          </div>
        </div>

        {/* Alert de Aprovação */}
        {stats.pending > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Você tem {stats.pending} produto(s) aguardando aprovação do administrador.
            </AlertDescription>
          </Alert>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-3 md:p-4 text-center">
              <Package className="w-6 h-6 md:w-8 md:h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-xl md:text-2xl font-bold text-blue-900">{stats.total}</div>
              <p className="text-xs md:text-sm text-blue-700">Total</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-3 md:p-4 text-center">
              <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-green-600 mx-auto mb-2" />
              <div className="text-xl md:text-2xl font-bold text-green-900">{stats.approved}</div>
              <p className="text-xs md:text-sm text-green-700">Aprovados</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 border">
            <CardContent className="p-3 md:p-4 text-center">
              <Clock className="w-6 h-6 md:w-8 md:h-8 text-amber-600 mx-auto mb-2" />
              <div className="text-xl md:text-2xl font-bold text-amber-900">{stats.pending}</div>
              <p className="text-xs md:text-sm text-amber-700">Aguardando</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-3 md:p-4 text-center">
              <FileSpreadsheet className="w-6 h-6 md:w-8 md:h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-xl md:text-2xl font-bold text-purple-900">{baseProducts.length}</div>
              <p className="text-xs md:text-sm text-purple-700">Exemplos</p>
            </CardContent>
          </Card>
        </div>

        {/* Card de Importação */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 border w-full">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-4 w-full">
              <div className="flex items-start gap-3">
                <div className="p-2 md:p-3 bg-white rounded-xl shadow-sm flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 mb-1 text-sm md:text-base">Importação em Lote</h3>
                  <p className="text-xs md:text-sm text-gray-600 break-words">
                    Baixe o template, preencha e faça upload para cadastrar vários produtos
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  className="border-purple-200 text-purple-700 hover:bg-purple-50 w-full sm:flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  <span className="text-sm">Baixar Template</span>
                </Button>
                <div className="w-full sm:flex-1">
                  <input
                    id="import-file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                  <Button
                    onClick={() => document.getElementById('import-file')?.click()}
                    disabled={importing}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 w-full"
                  >
                    {importing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        <span className="text-sm">Importando...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        <span className="text-sm">Importar Planilha</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações em Lote */}
        {selectedProducts.length > 0 && (
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300 border-2">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Badge className="bg-purple-600 text-white text-lg px-4 py-2">
                    {selectedProducts.length} selecionado(s)
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => { setBulkCategory(""); setShowBulkCategoryDialog(true); }}
                    size="sm"
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Trocar Categoria
                  </Button>
                  <Button onClick={() => setSelectedProducts([])} size="sm" variant="outline">
                    Limpar Seleção
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full">
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200 w-full"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48 bg-white/80">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela de Produtos - Desktop */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-white font-semibold w-8 px-2">
                      <input
                        type="checkbox"
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onChange={handleSelectAll}
                        className="w-3 h-3 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="text-white font-semibold">Foto</TableHead>
                    <TableHead className="text-white font-semibold">Código</TableHead>
                    <TableHead className="text-white font-semibold">Nome</TableHead>
                    <TableHead className="text-white font-semibold">Categoria</TableHead>
                    <TableHead className="text-white font-semibold">Preço Sugerido</TableHead>
                    <TableHead className="text-white font-semibold">Status</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product, index) => (
                    <TableRow 
                      key={product.id} 
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${selectedProducts.includes(product.id) ? 'bg-purple-50 border-l-4 border-l-purple-500' : ''} hover:bg-blue-50 transition-colors`}
                    >
                      <TableCell className="px-2">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleSelectProduct(product.id)}
                          className="w-3 h-3 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden">
                          {product.foto ? (
                            <img 
                              src={product.foto} 
                              alt={product.nome}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className="flex items-center justify-center w-full h-full text-gray-400" 
                            style={product.foto ? {display: 'none'} : {}}
                          >
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {product.cod}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{product.nome}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {product.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-green-600">
                          {product.preco_fabricante ? `R$ ${parseFloat(product.preco_fabricante).toFixed(2)}` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(product)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(product)}
                            className="hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product)}
                            className="hover:bg-red-50 hover:text-red-700"
                            disabled={!product.aprovado_produto}
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

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                <p className="text-gray-600">Comece cadastrando seus produtos.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cards de Produtos - Mobile */}
        <div className="md:hidden space-y-3 w-full">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="bg-white shadow w-full">
              <CardContent className="p-3 w-full">
                <div className="space-y-3 w-full">
                  <div className="flex items-start gap-3 w-full">
                    <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      {product.foto ? (
                        <img 
                          src={product.foto} 
                          alt={product.nome}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="flex items-center justify-center w-full h-full text-gray-400" 
                        style={product.foto ? {display: 'none'} : {}}
                      >
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h3 className="font-semibold text-sm text-gray-900 break-words">{product.nome}</h3>
                      <p className="text-xs text-gray-500 font-mono break-all mt-1">{product.cod}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {product.categoria}
                        </Badge>
                        {getStatusBadge(product)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 pt-2 border-t">
                    <span className="text-xs text-gray-600">Preço:</span>
                    <span className="font-bold text-green-600 text-sm">
                      {product.preco_fabricante ? `R$ ${parseFloat(product.preco_fabricante).toFixed(2)}` : '-'}
                    </span>
                  </div>

                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(product)}
                      className="flex-1 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      <span className="text-xs">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(product)}
                      className="flex-1 hover:bg-red-50 hover:text-red-700"
                      disabled={!product.aprovado_produto}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      <span className="text-xs">Excluir</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
              <p className="text-sm text-gray-600">Comece cadastrando seus produtos.</p>
            </div>
          )}
        </div>

        {/* Dialog Trocar Categoria em Lote */}
        <Dialog open={showBulkCategoryDialog} onOpenChange={setShowBulkCategoryDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Trocar Categoria em Lote
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600">
                Selecione a nova categoria para os <strong>{selectedProducts.length}</strong> produto(s) selecionado(s).
              </p>
              <div>
                <Label>Nova Categoria</Label>
                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowBulkCategoryDialog(false)}>Cancelar</Button>
                <Button
                  onClick={handleBulkCategoryChange}
                  disabled={!bulkCategory || applyingBulkCategory}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {applyingBulkCategory ? 'Aplicando...' : 'Aplicar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Produto */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome do Produto *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    placeholder="Ex: Esteira Profissional X1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="cod">Código (SKU) *</Label>
                  <Input
                    id="cod"
                    value={formData.cod}
                    onChange={(e) => setFormData({ ...formData, cod: e.target.value })}
                    required
                    placeholder="Ex: EST-PRO-X1"
                  />
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
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="und">Unidade *</Label>
                  <Select
                    value={formData.und}
                    onValueChange={(value) => setFormData({ ...formData, und: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(unit => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="peso">Peso (kg)</Label>
                  <Input
                    id="peso"
                    type="number"
                    step="0.01"
                    value={formData.peso}
                    onChange={(e) => setFormData({ ...formData, peso: parseFloat(e.target.value) || "" })}
                    placeholder="Ex: 85.5"
                  />
                </div>
                
                <div>
                  <Label htmlFor="dimensoes">Dimensões (L x A x P cm)</Label>
                  <Input
                    id="dimensoes"
                    value={formData.dimensoes}
                    onChange={(e) => setFormData({ ...formData, dimensoes: e.target.value })}
                    placeholder="Ex: 200 x 80 x 150"
                  />
                </div>

                <div>
                  <Label htmlFor="preco_fabricante">Preço Sugerido (R$)</Label>
                  <Input
                    id="preco_fabricante"
                    type="number"
                    step="0.01"
                    value={formData.preco_fabricante}
                    onChange={(e) => setFormData({ ...formData, preco_fabricante: parseFloat(e.target.value) || "" })}
                    placeholder="Ex: 2999.90"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="foto">Foto do Produto</Label>
                <div className="mt-2 space-y-3">
                  {formData.foto && (
                    <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
                      <img src={formData.foto} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <input
                      id="foto-upload"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('foto-upload')?.click()}
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload de Foto
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    id="foto"
                    type="url"
                    value={formData.foto}
                    onChange={(e) => setFormData({ ...formData, foto: e.target.value })}
                    placeholder="Ou insira a URL da foto"
                  />
                </div>
              </div>

              {!editingProduct && (
                <Alert className="bg-blue-50 border-blue-200">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Produtos novos precisam ser aprovados pelo administrador antes de ficarem disponíveis para fornecedores.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
                >
                  {editingProduct ? "Salvar Alterações" : "Criar Produto"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}