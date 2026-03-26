import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, ShoppingCart, DollarSign, Package, Plus, Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, RefreshCw, Edit3, Trash2, Save, X, Percent, Power, CheckSquare, Ship, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import ContainerTracker from "@/components/china/ContainerTracker";
import InternationalProductBadge from "@/components/china/InternationalProductBadge";
import PreOrdemImportacao from "@/components/china/PreOrdemImportacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
// Keep Textarea for import tab, but use Input in my-products
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MyProducts() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [fabricantes, setFabricantes] = useState([]);
  const [allFabricantes, setAllFabricantes] = useState([]);
  const [activeTab, setActiveTab] = useState("catalog");
  const [editingPrices, setEditingPrices] = useState({});
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [editingRow, setEditingRow] = useState(null); // New state to track which row is being edited
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCatalogProducts, setSelectedCatalogProducts] = useState([]);
  const [bulkPercentage, setBulkPercentage] = useState("");
  // Filtros avançados - Catálogo
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogFabricante, setCatalogFabricante] = useState("all");
  const [catalogOrigin, setCatalogOrigin] = useState("all");
  const [catalogPriceMin, setCatalogPriceMin] = useState("");
  const [catalogPriceMax, setCatalogPriceMax] = useState("");
  // Filtros avançados - Meus Produtos
  const [mySearch, setMySearch] = useState("");
  const [myCategory, setMyCategory] = useState("all");
  const [myFabricante, setMyFabricante] = useState("all");
  const [myStatus, setMyStatus] = useState("all"); // all | active | inactive
  const [myPriceMin, setMyPriceMin] = useState("");
  const [myPriceMax, setMyPriceMax] = useState("");
  // Bulk categoria
  const [bulkCategory, setBulkCategory] = useState("");
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [fabricantesChina, setFabricantesChina] = useState([]);
  const [showPreOrdem, setShowPreOrdem] = useState(false);
  const [preOrdemItems, setPreOrdemItems] = useState([]);
  const [catalogSort, setCatalogSort] = useState({ key: null, dir: 'asc' });
  const [mySort, setMySort] = useState({ key: null, dir: 'asc' });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    
    // Recarregar dados a cada 30 segundos para pegar atualizações
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.role === 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const [allProducts, supplierProductsData, unitsData, chinafabs] = await Promise.all([
        base44.entities.Product.list(),
        base44.entities.SupplierProduct.filter({ supplier_id: currentUser.id }),
        base44.entities.Unit.list(),
        base44.entities.FabricanteChina.list()
      ]);
      setFabricantesChina(chinafabs);

      // Filtrar apenas produtos ativos E aprovados (se forem de fabricantes)
      const productsData = allProducts.filter(p => {
        if (p.ativo === false) return false;
        // Se tem fabricante_id, deve estar aprovado
        if (p.fabricante_id) return p.aprovado_produto === true;
        // Produtos sem fabricante_id são produtos do admin, sempre disponíveis
        return true;
      });

      // Buscar IDs únicos de fabricantes
      const fabricanteIds = [...new Set(
        productsData.filter(p => p.fabricante_id).map(p => p.fabricante_id)
      )];
      
      let uniqueFabricantes = [];
      
      // Buscar fabricantes via backend function usando service role
      try {
        const response = await base44.functions.invoke('getFabricantes', {});
        
        if (response.data && response.data.fabricantes) {
          const allFabricantes = response.data.fabricantes;
          uniqueFabricantes = allFabricantes.filter(u => fabricanteIds.includes(u.id));
          console.log("Fabricantes carregados via backend:", uniqueFabricantes);
        } else {
          throw new Error("Resposta inválida do servidor");
        }
      } catch (err) {
        console.error("Erro ao buscar fabricantes:", err);
        toast({
          title: "Erro ao carregar fabricantes",
          description: "Não foi possível carregar a lista de fabricantes.",
          variant: "destructive"
        });
        uniqueFabricantes = [];
      }

      // Extrair fabricantes dos produtos selecionados
      const myProductIds = supplierProductsData.map(sp => sp.product_id);
      const myProducts = productsData.filter(p => myProductIds.includes(p.id));
      
      const myFabricanteIds = [...new Set(
        myProducts.filter(p => p.fabricante_id).map(p => p.fabricante_id)
      )];
      
      // Filtrar apenas os fabricantes dos produtos selecionados
      const uniqueMyFabricantes = uniqueFabricantes.filter(u => 
        myFabricanteIds.includes(u.id)
      );

      setProducts(productsData);
      setSupplierProducts(supplierProductsData);
      
      // Extrair categorias únicas dos produtos
      const uniqueCategories = [...new Set(productsData.map(p => p.categoria).filter(Boolean))].sort();
      setCategories(uniqueCategories);
      
      setUnits(unitsData.filter(u => u.ativo).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(u => u.nome));
      setFabricantes(uniqueFabricantes);
      setAllFabricantes(uniqueMyFabricantes);
      
      // Inicializar preços de edição
      const prices = {};
      supplierProductsData.forEach(sp => {
        prices[sp.product_id] = {
          preco: sp.preco || "",
          disponivel: sp.disponivel !== false,
          observacoes: sp.observacoes || ""
        };
      });
      setEditingPrices(prices);
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar",
        description: error.message || "Erro ao carregar dados. Verifique o console.",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const getFilteredProducts = () => {
    let filtered = products;
    
    if (catalogSearch) {
      const s = catalogSearch.toLowerCase();
      filtered = filtered.filter(p =>
        p.nome?.toLowerCase().includes(s) ||
        p.cod?.toLowerCase().includes(s) ||
        p.categoria?.toLowerCase().includes(s)
      );
    }
    if (catalogCategory !== "all") filtered = filtered.filter(p => p.categoria === catalogCategory);
    if (catalogFabricante !== "all") {
      if (catalogFabricante === "admin") filtered = filtered.filter(p => !p.fabricante_id);
      else filtered = filtered.filter(p => p.fabricante_id === catalogFabricante);
    }
    if (catalogOrigin !== "all") filtered = filtered.filter(p => (p.origem || "nacional") === catalogOrigin);
    if (catalogPriceMin !== "") filtered = filtered.filter(p => (p.preco_fabricante || 0) >= parseFloat(catalogPriceMin));
    if (catalogPriceMax !== "") filtered = filtered.filter(p => (p.preco_fabricante || 0) <= parseFloat(catalogPriceMax));
    
    return filtered;
  };

  const getMyProducts = () => {
    const myProductIds = supplierProducts.map(sp => sp.product_id);
    return products.filter(p => myProductIds.includes(p.id));
  };

  const getMyProductsFiltered = () => {
    let filtered = getMyProducts();

    if (mySearch) {
      const s = mySearch.toLowerCase();
      filtered = filtered.filter(p =>
        p.nome?.toLowerCase().includes(s) ||
        p.cod?.toLowerCase().includes(s) ||
        p.categoria?.toLowerCase().includes(s)
      );
    }
    if (myCategory !== "all") filtered = filtered.filter(p => p.categoria === myCategory);
    if (myFabricante !== "all") {
      if (myFabricante === "admin") filtered = filtered.filter(p => !p.fabricante_id);
      else filtered = filtered.filter(p => p.fabricante_id === myFabricante);
    }
    if (myStatus !== "all") {
      filtered = filtered.filter(p => {
        const sp = supplierProducts.find(s => s.product_id === p.id);
        const ativo = sp?.disponivel !== false;
        return myStatus === "active" ? ativo : !ativo;
      });
    }
    if (myPriceMin !== "") {
      filtered = filtered.filter(p => {
        const sp = supplierProducts.find(s => s.product_id === p.id);
        return (sp?.preco || 0) >= parseFloat(myPriceMin);
      });
    }
    if (myPriceMax !== "") {
      filtered = filtered.filter(p => {
        const sp = supplierProducts.find(s => s.product_id === p.id);
        return (sp?.preco || 0) <= parseFloat(myPriceMax);
      });
    }

    return filtered;
  };

  const isProductSelected = (productId) => {
    return supplierProducts.some(sp => sp.product_id === productId);
  };

  const handleProductToggle = async (product) => {
    try {
      if (isProductSelected(product.id)) {
        // Remover produto
        const supplierProduct = supplierProducts.find(sp => sp.product_id === product.id);
        await base44.entities.SupplierProduct.delete(supplierProduct.id);
      } else {
        // Adicionar produto
        await base44.entities.SupplierProduct.create({
          supplier_id: user.id,
          product_id: product.id,
          preco: 0,
          disponivel: true
        });
      }
      loadData();
    } catch (error) {
      console.error("Erro ao alterar produto:", error);
      toast({
        title: "Erro",
        description: "Erro ao alterar produto. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleSelectAll = () => {
    const filteredIds = getMyProductsFiltered().map(p => p.id);
    if (selectedProducts.length === filteredIds.length && filteredIds.length > 0) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredIds);
    }
  };

  const handleBulkChangeCategory = async () => {
    if (!bulkCategory) {
      toast({ title: "Erro", description: "Selecione uma categoria.", variant: "destructive" });
      return;
    }
    if (selectedProducts.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um produto.", variant: "destructive" });
      return;
    }
    setApplyingBulk(true);
    let successCount = 0;
    for (const productId of selectedProducts) {
      await base44.entities.Product.update(productId, { categoria: bulkCategory });
      successCount++;
    }
    toast({ title: "Categoria atualizada!", description: `${successCount} produto(s) atualizados para "${bulkCategory}".` });
    setSelectedProducts([]);
    setBulkCategory("");
    await loadData();
    setApplyingBulk(false);
  };

  const handleSelectProduct = (productId) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    } else {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const handleBulkApplyPercentage = async () => {
    if (!bulkPercentage || parseFloat(bulkPercentage) <= 0) {
      toast({
        title: "Erro",
        description: "Digite um percentual válido maior que 0.",
        variant: "destructive"
      });
      return;
    }

    if (selectedProducts.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um produto.",
        variant: "destructive"
      });
      return;
    }

    setApplyingBulk(true);
    const percentage = parseFloat(bulkPercentage);
    let successCount = 0;
    let skippedCount = 0;

    try {
      for (const productId of selectedProducts) {
        const product = products.find(p => p.id === productId);
        const supplierProduct = supplierProducts.find(sp => sp.product_id === productId);
        
        if (!product || !supplierProduct) {
          skippedCount++;
          continue;
        }

        // Verificar se tem preço de fabricante
        if (!product.preco_fabricante || parseFloat(product.preco_fabricante) <= 0) {
          skippedCount++;
          continue;
        }
        
        const precoCusto = parseFloat(product.preco_fabricante);
        const novoPreco = precoCusto * (1 + percentage / 100);
        
        await base44.entities.SupplierProduct.update(supplierProduct.id, {
          preco: novoPreco,
          disponivel: true
        });
        successCount++;
      }

      toast({
        title: "Aplicação concluída!",
        description: `${successCount} produtos atualizados com ${percentage}% de margem.${skippedCount > 0 ? ` ${skippedCount} produtos sem preço de custo foram ignorados.` : ''}`,
      });

      setSelectedProducts([]);
      setBulkPercentage("");
      await loadData();
    } catch (error) {
      console.error("Erro ao aplicar percentual:", error);
      toast({
        title: "Erro",
        description: "Erro ao aplicar percentual. Tente novamente.",
        variant: "destructive"
      });
    }
    setApplyingBulk(false);
  };

  const handleBulkActivate = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um produto.",
        variant: "destructive"
      });
      return;
    }

    setApplyingBulk(true);
    try {
      for (const productId of selectedProducts) {
        const supplierProduct = supplierProducts.find(sp => sp.product_id === productId);
        if (supplierProduct) {
          await base44.entities.SupplierProduct.update(supplierProduct.id, {
            disponivel: true
          });
        }
      }

      toast({
        title: "Sucesso!",
        description: `${selectedProducts.length} produtos ativados.`,
      });

      setSelectedProducts([]);
      await loadData();
    } catch (error) {
      console.error("Erro ao ativar produtos:", error);
      toast({
        title: "Erro",
        description: "Erro ao ativar produtos. Tente novamente.",
        variant: "destructive"
      });
    }
    setApplyingBulk(false);
  };

  const handleBulkRemove = async () => {
    if (selectedProducts.length === 0) {
      toast({ title: "Erro", description: "Selecione pelo menos um produto.", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Remover ${selectedProducts.length} produto(s) da sua tabela?`)) return;

    setApplyingBulk(true);
    try {
      for (const productId of selectedProducts) {
        const supplierProduct = supplierProducts.find(sp => sp.product_id === productId);
        if (supplierProduct) {
          await base44.entities.SupplierProduct.delete(supplierProduct.id);
        }
      }
      toast({ title: "Removido!", description: `${selectedProducts.length} produto(s) removidos da sua tabela.` });
      setSelectedProducts([]);
      await loadData();
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao remover produtos.", variant: "destructive" });
    }
    setApplyingBulk(false);
  };

  const handleSelectAllCatalog = () => {
    const filteredIds = getFilteredProducts().filter(p => !isProductSelected(p.id)).map(p => p.id);
    if (selectedCatalogProducts.length === filteredIds.length && filteredIds.length > 0) {
      setSelectedCatalogProducts([]);
    } else {
      setSelectedCatalogProducts(filteredIds);
    }
  };

  const handleSelectCatalogProduct = (productId) => {
    if (selectedCatalogProducts.includes(productId)) {
      setSelectedCatalogProducts(selectedCatalogProducts.filter(id => id !== productId));
    } else {
      setSelectedCatalogProducts([...selectedCatalogProducts, productId]);
    }
  };

  const handleBulkAddProducts = async () => {
    if (selectedCatalogProducts.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um produto.",
        variant: "destructive"
      });
      return;
    }

    setApplyingBulk(true);
    let successCount = 0;
    let skippedCount = 0;

    try {
      for (const productId of selectedCatalogProducts) {
        // Verificar se o produto já existe na lista do fornecedor
        const alreadyExists = supplierProducts.some(sp => sp.product_id === productId);
        
        if (alreadyExists) {
          skippedCount++;
          continue;
        }

        await base44.entities.SupplierProduct.create({
          supplier_id: user.id,
          product_id: productId,
          preco: 0,
          disponivel: true
        });
        successCount++;
      }

      toast({
        title: "Sucesso!",
        description: `${successCount} produto(s) adicionado(s) à sua tabela.${skippedCount > 0 ? ` ${skippedCount} já estavam adicionados.` : ''}`,
      });

      setSelectedCatalogProducts([]);
      await loadData();
    } catch (error) {
      console.error("Erro ao adicionar produtos:", error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar produtos. Tente novamente.",
        variant: "destructive"
      });
    }
    setApplyingBulk(false);
  };

  const handlePriceUpdate = async (productId) => {
    try {
      const supplierProduct = supplierProducts.find(sp => sp.product_id === productId);
      if (!supplierProduct) return;

      const updateData = editingPrices[productId];
      await base44.entities.SupplierProduct.update(supplierProduct.id, updateData);
      
      setEditingRow(null); // Exit editing mode
      loadData();
      toast({
        title: "Sucesso!",
        description: `Produto ${products.find(p => p.id === productId)?.nome} atualizado.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar preço:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar produto. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const updateEditingPrice = (productId, field, value) => {
    setEditingPrices(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const downloadTemplate = async () => {
    setExporting(true);
    try {
      // Preparar dados para template - incluir TODOS os produtos associados ao fornecedor
      const myProductsData = supplierProducts.map(sp => {
        const product = products.find(p => p.id === sp.product_id);
        return product ? {
          'Código (SKU)': product.cod,
          'Nome do Produto': product.nome,
          'Unidade': product.und,
          'Preço': sp.preco || 0,
          'Disponível': sp.disponivel ? 'SIM' : 'NÃO'
        } : null;
      }).filter(Boolean);

      if (myProductsData.length === 0) {
        toast({
          title: "Nenhum produto encontrado",
          description: "Você precisa ter produtos configurados para gerar o template.",
          variant: "destructive"
        });
        setExporting(false);
        return;
      }

      // Converter para CSV
      const headers = Object.keys(myProductsData[0] || {});
      const csvContent = [
        // Instruções
         `"INSTRUÇÕES:"`,
         `"1. Atualize os valores nas colunas Preço e Disponível (SIM/NÃO)."`,
         `"2. NÃO altere as colunas Código (SKU), Nome do Produto e Unidade."`,
         `"3. Certifique-se de que o preço seja um número válido (ex: 123.45, use ponto como separador decimal) e Disponível seja 'SIM' ou 'NÃO'."`,
         `"4. Após editar, salve o arquivo como CSV (separado por vírgulas) e importe de volta no sistema."`,
        `""`, // Empty line
        // Column headers
        headers.map(h => `"${(h + '').replace(/"/g, '""')}"`).join(','),
        // Data
        ...myProductsData.map(row =>
          headers.map(header => `"${(row[header] + '').replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      // Criar e baixar arquivo
      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `template_produtos_${user?.empresa?.replace(/\s+/g, '_') || 'fornecedor'}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Template baixado!",
        description: "Edite o arquivo e importe de volta para atualizar em massa.",
      });

    } catch (error) {
      console.error("Erro ao gerar template:", error);
      toast({
        title: "Erro",
        description: "Erro ao gerar template. Tente novamente.",
        variant: "destructive"
      });
    }
    setExporting(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadedFile(null);
      return;
    }
    setUploadedFile(file);
  };

  const processImport = async () => {
    if (!uploadedFile) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo para importar.",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);
    try {
      // 1. Upload do arquivo
      const uploadResult = await base44.integrations.Core.UploadFile({ file: uploadedFile });
      if (uploadResult.status === "error") {
        throw new Error(uploadResult.details || "Erro ao fazer upload do arquivo.");
      }
      const { file_url } = uploadResult;

      // 2. Extrair dados do arquivo
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "Código (SKU)": { type: "string" },
              "Preço": { type: "number" },
              "Disponível": { type: "string" },
              "Observações": { type: "string" }
            },
            required: ["Código (SKU)", "Preço", "Disponível"]
          }
        }
      });

      if (result.status === "error") {
        throw new Error(result.details || "Erro ao processar arquivo. Verifique o formato e o conteúdo.");
      }

      // 3. Atualizar produtos em massa
      const updates = result.output || [];
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      let errorDetails = [];

      for (const item of updates) {
        try {
          const sku = item["Código (SKU)"];
          const price = parseFloat(item["Preço"]);
          const available = item["Disponível"]?.toUpperCase();
          const observations = item["Observações"] || "";

          // Validação básica
          if (isNaN(price) || price < 0) {
            errorDetails.push(`Produto ${sku}: Preço inválido '${item["Preço"]}'.`);
            errorCount++;
            continue;
          }
          if (available !== "SIM" && available !== "NÃO") {
            errorDetails.push(`Produto ${sku}: Disponibilidade inválida '${item["Disponível"]}'. Use 'SIM' ou 'NÃO'.`);
            errorCount++;
            continue;
          }

          // Encontrar o produto pelo código
          const product = products.find(p => p.cod === sku);
          if (!product) {
            errorDetails.push(`Produto ${sku}: Não encontrado na sua lista de produtos. Item pulado.`);
            skippedCount++;
            continue;
          }

          // Encontrar o SupplierProduct correspondente
          const supplierProduct = supplierProducts.find(sp => sp.product_id === product.id);
          if (!supplierProduct) {
            errorDetails.push(`Produto ${sku}: Item de fornecedor não encontrado. Não é possível atualizar. Item pulado.`);
            skippedCount++;
            continue;
          }

          // Atualizar o SupplierProduct
          await base44.entities.SupplierProduct.update(supplierProduct.id, {
            preco: price,
            disponivel: available === "SIM",
            observacoes: observations
          });

          successCount++;
        } catch (updateError) {
          console.error("Erro ao atualizar produto individualmente:", item, updateError);
          errorDetails.push(`Erro ao atualizar ${item["Código (SKU)"]}: ${updateError.message || "Erro desconhecido"}.`);
          errorCount++;
        }
      }

      toast({
        title: "Importação concluída!",
        description: `${successCount} produtos atualizados com sucesso.${errorCount > 0 ? ` ${errorCount} erros.` : ''}${skippedCount > 0 ? ` ${skippedCount} produtos pulados.` : ''}`,
      });

      if (errorDetails.length > 0) {
        errorDetails.forEach(detail => {
          toast({
            title: "Detalhe do Erro na Importação",
            description: detail,
            variant: "destructive",
            duration: 9000
          });
        });
      }

      // Reload data and reset state
      await loadData();
      setUploadedFile(null);
      setActiveTab("catalog");

    } catch (error) {
      console.error("Erro geral na importação:", error);
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao processar arquivo. Verifique o formato e as instruções.",
        variant: "destructive"
      });
    }
    setImporting(false);
  };

  const toggleCatalogSort = (key) => {
    setCatalogSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const toggleMySort = (key) => {
    setMySort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const SortIcon = ({ sortState, col }) => {
    if (sortState.key !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 inline opacity-60" />;
    return sortState.dir === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 inline" /> : <ChevronDown className="w-3 h-3 ml-1 inline" />;
  };

  const applyCatalogSort = (list) => {
    if (!catalogSort.key) return list;
    return [...list].sort((a, b) => {
      let va, vb;
      if (catalogSort.key === 'nome') { va = a.nome || ''; vb = b.nome || ''; }
      else if (catalogSort.key === 'categoria') { va = a.categoria || ''; vb = b.categoria || ''; }
      else if (catalogSort.key === 'fabricante') { va = a.fabricante_nome || ''; vb = b.fabricante_nome || ''; }
      else if (catalogSort.key === 'preco') { va = parseFloat(a.preco_fabricante) || 0; vb = parseFloat(b.preco_fabricante) || 0; }
      if (typeof va === 'string') return catalogSort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return catalogSort.dir === 'asc' ? va - vb : vb - va;
    });
  };

  const applyMySort = (list) => {
    if (!mySort.key) return list;
    return [...list].sort((a, b) => {
      let va, vb;
      if (mySort.key === 'nome') { va = a.nome || ''; vb = b.nome || ''; }
      else if (mySort.key === 'fabricante') { va = a.fabricante_nome || ''; vb = b.fabricante_nome || ''; }
      else if (mySort.key === 'custo') { va = parseFloat(a.preco_fabricante) || 0; vb = parseFloat(b.preco_fabricante) || 0; }
      else if (mySort.key === 'venda') {
        va = parseFloat(editingPrices[a.id]?.preco) || 0;
        vb = parseFloat(editingPrices[b.id]?.preco) || 0;
      }
      if (typeof va === 'string') return mySort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return mySort.dir === 'asc' ? va - vb : vb - va;
    });
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

  const filteredProducts = applyCatalogSort(getFilteredProducts());
  const myProducts = getMyProducts();
  const availableProducts = myProducts.filter(p => {
    const sp = supplierProducts.find(sp => sp.product_id === p.id);
    return sp && sp.disponivel && sp.preco > 0;
  });

  return (
    <div className="p-4 md:p-8 min-h-screen">
      {showPreOrdem && (
        <PreOrdemImportacao
          items={preOrdemItems}
          fabricantesChina={fabricantesChina}
          onClose={() => setShowPreOrdem(false)}
        />
      )}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meus Produtos</h1>
          <p className="text-gray-600">Selecione produtos, configure preços e gerencie sua tabela</p>
        </div>

        {/* Container Tracker China */}
        <ContainerTracker />

        {/* Verificar se fornecedor foi aprovado */}
        {!user?.aprovado && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-amber-800">
              Sua conta ainda não foi aprovada. Entre em contato com a administração para ativar seu acesso completo.
            </AlertDescription>
          </Alert>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{products.length}</div>
              <p className="text-sm text-blue-700">Total Catálogo</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <ShoppingCart className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{myProducts.length}</div>
              <p className="text-sm text-green-700">Produtos Selecionados</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{availableProducts.length}</div>
              <p className="text-sm text-purple-700">Com Preço Definido</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-sm text-xs md:text-sm">
            <TabsTrigger value="catalog" className="px-2 md:px-4">Catálogo</TabsTrigger>
            <TabsTrigger value="my-products" className="px-2 md:px-4">Meus ({myProducts.length})</TabsTrigger>
            <TabsTrigger value="import" className="px-2 md:px-4">Importar</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-6">
            {/* Ações em Massa - Catálogo */}
            {selectedCatalogProducts.length > 0 && (
              <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-green-900">
                        {selectedCatalogProducts.length} produto(s) selecionado(s)
                      </p>
                      <p className="text-xs text-gray-600">
                        Clique para adicionar à sua tabela de produtos
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleBulkAddProducts}
                        disabled={applyingBulk}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {applyingBulk ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Adicionar Selecionados
                      </Button>
                      <Button
                        onClick={handleSelectAllCatalog}
                        variant="outline"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        {selectedCatalogProducts.length === getFilteredProducts().filter(p => !isProductSelected(p.id)).length ? 'Desmarcar' : 'Selecionar'} Todos
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Filtros Catálogo */}
            <Card className="bg-white/80 border border-gray-100 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome, código ou categoria..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="pl-10 bg-white"
                    />
                  </div>
                  <Select value={catalogCategory} onValueChange={setCatalogCategory}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Select value={catalogFabricante} onValueChange={setCatalogFabricante}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Fabricante" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Fabricantes</SelectItem>
                      <SelectItem value="admin">PlaceFit (Admin)</SelectItem>
                      {fabricantes.map(f => <SelectItem key={f.id} value={f.id}>{f.empresa || f.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={catalogOrigin} onValueChange={setCatalogOrigin}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Origem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as origens</SelectItem>
                      <SelectItem value="nacional">Nacional</SelectItem>
                      <SelectItem value="china">China</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400">R$</span>
                    <Input placeholder="Preço mín" value={catalogPriceMin} onChange={e => setCatalogPriceMin(e.target.value)} type="number" className="pl-8 bg-white" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400">R$</span>
                    <Input placeholder="Preço máx" value={catalogPriceMax} onChange={e => setCatalogPriceMax(e.target.value)} type="number" className="pl-8 bg-white" />
                  </div>
                </div>
                {(catalogSearch || catalogCategory !== "all" || catalogFabricante !== "all" || catalogOrigin !== "all" || catalogPriceMin || catalogPriceMax) && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{getFilteredProducts().length} produto(s) encontrado(s)</span>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7" onClick={() => { setCatalogSearch(""); setCatalogCategory("all"); setCatalogFabricante("all"); setCatalogOrigin("all"); setCatalogPriceMin(""); setCatalogPriceMax(""); }}>
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabela de Produtos - Desktop */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-16">
                          <input
                            type="checkbox"
                            checked={selectedCatalogProducts.length === getFilteredProducts().filter(p => !isProductSelected(p.id)).length && getFilteredProducts().filter(p => !isProductSelected(p.id)).length > 0}
                            onChange={handleSelectAllCatalog}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="text-center w-24">Adicionar</TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleCatalogSort('nome')}>
                          Nome <SortIcon sortState={catalogSort} col="nome" />
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleCatalogSort('categoria')}>
                          Categoria <SortIcon sortState={catalogSort} col="categoria" />
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleCatalogSort('fabricante')}>
                          Fabricante <SortIcon sortState={catalogSort} col="fabricante" />
                        </TableHead>
                        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleCatalogSort('preco')}>
                          Preço Sugerido <SortIcon sortState={catalogSort} col="preco" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product, index) => {
                        const fabricanteNome = product.fabricante_id ? 
                         (fabricantes.find(f => f.id === product.fabricante_id)?.empresa || 
                          product.fabricante_nome || 
                          'Fabricante') : null;
                        const precoSugerido = product.preco_fabricante ? parseFloat(product.preco_fabricante) : null;

                        return (
                          <TableRow 
                            key={product.id}
                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                          >
                            <TableCell className="text-center">
                              {!isProductSelected(product.id) ? (
                                <input
                                  type="checkbox"
                                  checked={selectedCatalogProducts.includes(product.id)}
                                  onChange={() => handleSelectCatalogProduct(product.id)}
                                  disabled={!user?.aprovado}
                                  className="w-4 h-4 cursor-pointer"
                                />
                              ) : (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                  ✓ Já adicionado
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={isProductSelected(product.id)}
                                onCheckedChange={() => handleProductToggle(product)}
                                disabled={!user?.aprovado}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{product.nome}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {product.categoria}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {fabricanteNome ? (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 w-fit">
                                    {fabricanteNome}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 w-fit">
                                    PlaceFit
                                  </Badge>
                                )}
                                {product.origem === "china" && (
                                  <InternationalProductBadge product={product} />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {precoSugerido ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-sm font-semibold text-green-600">
                                    R$ {precoSugerido.toFixed(2)}
                                  </span>
                                  {product.origem === "china" && (
                                    <button
                                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreOrdemItems([{ ...product, quantidade: 1 }]);
                                        setShowPreOrdem(true);
                                      }}
                                    >
                                      <Ship className="w-3 h-3" /> Pré-Ordem
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {filteredProducts.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                    <p className="text-gray-600">Tente ajustar os filtros.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cards de Produtos - Mobile */}
            <div className="md:hidden space-y-3 w-full">
              {filteredProducts.map((product) => {
                const fabricanteNome = product.fabricante_id ? 
                  (fabricantes.find(f => f.id === product.fabricante_id)?.empresa || 
                   product.fabricante_nome || 
                   'Fabricante') : null;
                const precoSugerido = product.preco_fabricante ? parseFloat(product.preco_fabricante) : null;

                return (
                  <Card key={product.id} className="bg-white shadow w-full">
                    <CardContent className="p-3 w-full">
                      <div className="flex items-start gap-2 w-full mb-2">
                        {!isProductSelected(product.id) && (
                          <input
                            type="checkbox"
                            checked={selectedCatalogProducts.includes(product.id)}
                            onChange={() => handleSelectCatalogProduct(product.id)}
                            disabled={!user?.aprovado}
                            className="w-4 h-4 mt-1 cursor-pointer flex-shrink-0"
                          />
                        )}
                        <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h3 className="font-semibold text-sm text-gray-900 break-words">{product.nome}</h3>
                          {precoSugerido && (
                            <p className="text-sm font-semibold text-green-600 mt-1">
                              R$ {precoSugerido.toFixed(2)}
                            </p>
                          )}
                        </div>
                          <Switch
                            checked={isProductSelected(product.id)}
                            onCheckedChange={() => handleProductToggle(product)}
                            disabled={!user?.aprovado}
                            className="flex-shrink-0"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 w-full">
                        <Badge variant="secondary" className="text-xs">
                          {product.categoria}
                        </Badge>
                        {fabricanteNome ? (
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                            {fabricanteNome}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                            PlaceFit
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                  <p className="text-gray-600">Tente ajustar os filtros.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="my-products" className="space-y-6">
            {/* Ações em Massa */}
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold text-purple-900 mb-2 block">
                      Aplicar Margem nos Produtos Selecionados
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 max-w-xs">
                        <Percent className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="number"
                          step="0.01"
                          value={bulkPercentage}
                          onChange={(e) => setBulkPercentage(e.target.value)}
                          placeholder="Ex: 30 (para 30%)"
                          className="pl-10"
                        />
                      </div>
                      <Button
                        onClick={handleBulkApplyPercentage}
                        disabled={applyingBulk || selectedProducts.length === 0}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {applyingBulk ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <Percent className="w-4 h-4 mr-2" />
                            Aplicar
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {selectedProducts.length} produto(s) selecionado(s)
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        onClick={handleBulkActivate}
                        disabled={applyingBulk || selectedProducts.length === 0}
                        variant="outline"
                        className="border-green-200 text-green-700 hover:bg-green-50"
                      >
                        <Power className="w-4 h-4 mr-2" />
                        Ativar Selecionados
                      </Button>
                      <Button
                        onClick={handleBulkRemove}
                        disabled={applyingBulk || selectedProducts.length === 0}
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remover Selecionados
                      </Button>
                      <Button
                        onClick={handleSelectAll}
                        variant="outline"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        {selectedProducts.length === getMyProductsFiltered().length ? 'Desmarcar' : 'Selecionar'} Todos
                      </Button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Select value={bulkCategory} onValueChange={setBulkCategory}>
                        <SelectTrigger className="bg-white w-48 text-sm h-9">
                          <SelectValue placeholder="Mudar categoria..." />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleBulkChangeCategory}
                        disabled={applyingBulk || selectedProducts.length === 0 || !bulkCategory}
                        variant="outline"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50 h-9 text-sm"
                      >
                        Aplicar Categoria
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filtros Meus Produtos */}
            <Card className="bg-white/80 border border-gray-100 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome, código ou categoria..."
                      value={mySearch}
                      onChange={(e) => setMySearch(e.target.value)}
                      className="pl-10 bg-white"
                    />
                  </div>
                  <Select value={myCategory} onValueChange={setMyCategory}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Select value={myFabricante} onValueChange={setMyFabricante}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Fabricante" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Fabricantes</SelectItem>
                      <SelectItem value="admin">PlaceFit (Admin)</SelectItem>
                      {allFabricantes.map(f => <SelectItem key={f.id} value={f.id}>{f.empresa || f.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={myStatus} onValueChange={setMyStatus}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="inactive">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400">R$</span>
                    <Input placeholder="Preço mín" value={myPriceMin} onChange={e => setMyPriceMin(e.target.value)} type="number" className="pl-8 bg-white" />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400">R$</span>
                    <Input placeholder="Preço máx" value={myPriceMax} onChange={e => setMyPriceMax(e.target.value)} type="number" className="pl-8 bg-white" />
                  </div>
                </div>
                {(mySearch || myCategory !== "all" || myFabricante !== "all" || myStatus !== "all" || myPriceMin || myPriceMax) && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{getMyProductsFiltered().length} produto(s) encontrado(s)</span>
                    <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7" onClick={() => { setMySearch(""); setMyCategory("all"); setMyFabricante("all"); setMyStatus("all"); setMyPriceMin(""); setMyPriceMax(""); }}>
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabela de Meus Produtos - Desktop */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                         <TableHead className="text-center w-16">
                           <input
                             type="checkbox"
                             checked={selectedProducts.length === getMyProductsFiltered().length && getMyProductsFiltered().length > 0}
                             onChange={handleSelectAll}
                             className="w-4 h-4 cursor-pointer"
                           />
                         </TableHead>
                         <TableHead className="cursor-pointer select-none" onClick={() => toggleMySort('nome')}>
                           Produto <SortIcon sortState={mySort} col="nome" />
                         </TableHead>
                         <TableHead className="w-40 cursor-pointer select-none" onClick={() => toggleMySort('fabricante')}>
                           Fabricante <SortIcon sortState={mySort} col="fabricante" />
                         </TableHead>
                         <TableHead className="w-32 cursor-pointer select-none" onClick={() => toggleMySort('custo')}>
                           Preço Custo <SortIcon sortState={mySort} col="custo" />
                         </TableHead>
                         <TableHead className="w-32 cursor-pointer select-none" onClick={() => toggleMySort('venda')}>
                           Preço Venda (R$) <SortIcon sortState={mySort} col="venda" />
                         </TableHead>
                         <TableHead className="text-center w-28">Disponível</TableHead>
                         <TableHead className="text-center w-32">Ações</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applyMySort(getMyProductsFiltered()).map((product, index) => {
                        const isEditing = editingRow === product.id;
                        return (
                          <TableRow 
                            key={product.id}
                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                            >
                            <TableCell className="text-center">
                               <input
                                 type="checkbox"
                                 checked={selectedProducts.includes(product.id)}
                                 onChange={() => handleSelectProduct(product.id)}
                                 className="w-4 h-4 cursor-pointer"
                               />
                             </TableCell>
                             <TableCell className="font-medium">{product.nome}</TableCell>
                             <TableCell>
                              {product.fabricante_id ? (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                  {fabricantes.find(f => f.id === product.fabricante_id)?.empresa || 
                                   fabricantes.find(f => f.id === product.fabricante_id)?.full_name || 
                                   product.fabricante_nome || 'Fabricante'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  PlaceFit
                                </Badge>
                              )}
                             </TableCell>
                            <TableCell>
                              {product.preco_fabricante ? (
                                <span className="text-sm text-gray-600">
                                  R$ {parseFloat(product.preco_fabricante).toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingPrices[product.id]?.preco || ""}
                                  onChange={(e) => updateEditingPrice(product.id, 'preco', parseFloat(e.target.value) || 0)}
                                  className="w-24 h-8 text-sm"
                                />
                              ) : (
                                <span className="font-bold text-green-600">
                                  {editingPrices[product.id]?.preco ? `R$ ${parseFloat(editingPrices[product.id].preco).toFixed(2)}` : '-'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {isEditing ? (
                                <Switch
                                  checked={editingPrices[product.id]?.disponivel !== false}
                                  onCheckedChange={(checked) => updateEditingPrice(product.id, 'disponivel', checked)}
                                />
                              ) : (
                                <Badge className={editingPrices[product.id]?.disponivel ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                                  {editingPrices[product.id]?.disponivel ? 'Sim' : 'Não'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handlePriceUpdate(product.id)}
                                      className="h-8 px-2 hover:bg-green-50 hover:text-green-700"
                                      title="Salvar"
                                    >
                                      <Save className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingRow(null);
                                        loadData();
                                      }}
                                      className="h-8 px-2 hover:bg-gray-100"
                                      title="Cancelar"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingRow(product.id)}
                                      className="h-8 px-2 hover:bg-blue-50 hover:text-blue-700"
                                      title="Editar"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleProductToggle(product)}
                                      className="h-8 px-2 hover:bg-red-50 hover:text-red-700"
                                      title="Remover"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {myProducts.length === 0 && (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto selecionado</h3>
                    <p className="text-gray-600">Acesse a aba "Catálogo Geral" para selecionar produtos.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cards de Meus Produtos - Mobile */}
            <div className="md:hidden space-y-3 w-full">
              {getMyProductsFiltered().map((product) => {
                const isEditing = editingRow === product.id;
                return (
                  <Card key={product.id} className="bg-white shadow w-full">
                    <CardContent className="p-3 w-full">
                      <div className="space-y-3 w-full">
                        <div className="flex items-start gap-2 w-full">
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={() => handleSelectProduct(product.id)}
                            className="w-4 h-4 mt-1 cursor-pointer flex-shrink-0"
                          />
                          <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h3 className="font-semibold text-sm text-gray-900 break-words">{product.nome}</h3>
                            <p className="text-xs text-gray-500 break-all">
                              {product.fabricante_id ? 
                                (fabricantes.find(f => f.id === product.fabricante_id)?.empresa || 
                                 fabricantes.find(f => f.id === product.fabricante_id)?.full_name || 
                                 product.fabricante_nome || 'Fabricante')
                                : 'PlaceFit'
                              }
                            </p>
                          </div>
                          {!isEditing && (
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingRow(product.id)}
                                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleProductToggle(product)}
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              </div>
                              )}
                              </div>
                              </div>

                              {isEditing ? (
                          <div className="space-y-3">
                            {product.preco_fabricante && (
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-xs text-gray-600">Preço Custo:</span>
                                <p className="text-sm font-semibold text-gray-700">
                                  R$ {parseFloat(product.preco_fabricante).toFixed(2)}
                                </p>
                              </div>
                            )}
                            <div>
                              <Label className="text-xs">Preço Venda (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editingPrices[product.id]?.preco || ""}
                                onChange={(e) => updateEditingPrice(product.id, 'preco', parseFloat(e.target.value) || 0)}
                                className="h-9 text-sm w-full"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Disponível</Label>
                              <Switch
                                checked={editingPrices[product.id]?.disponivel !== false}
                                onCheckedChange={(checked) => updateEditingPrice(product.id, 'disponivel', checked)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Observações</Label>
                              <Input
                                value={editingPrices[product.id]?.observacoes || ""}
                                onChange={(e) => updateEditingPrice(product.id, 'observacoes', e.target.value)}
                                placeholder="Observações..."
                                className="h-9 text-sm w-full"
                              />
                            </div>
                            <div className="flex flex-col gap-2 w-full">
                              <Button
                                onClick={() => handlePriceUpdate(product.id)}
                                className="w-full bg-green-600 hover:bg-green-700"
                                size="sm"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Salvar
                              </Button>
                              <Button
                                onClick={() => {
                                  setEditingRow(null);
                                  loadData();
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {product.preco_fabricante && (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-gray-600 flex-shrink-0">Preço Custo:</span>
                                <span className="text-sm text-gray-700 truncate">
                                  R$ {parseFloat(product.preco_fabricante).toFixed(2)}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-600 flex-shrink-0">Preço Venda:</span>
                              <span className="font-bold text-green-600 truncate">
                                {editingPrices[product.id]?.preco ? `R$ ${parseFloat(editingPrices[product.id].preco).toFixed(2)}` : '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-gray-600 flex-shrink-0">Status:</span>
                              <Badge className={editingPrices[product.id]?.disponivel ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                                {editingPrices[product.id]?.disponivel ? 'Disponível' : 'Indisponível'}
                              </Badge>
                            </div>
                            {editingPrices[product.id]?.observacoes && (
                              <div className="break-words">
                                <span className="text-xs text-gray-500">Obs:</span>
                                <p className="text-sm text-gray-700 break-words">{editingPrices[product.id].observacoes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {myProducts.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto selecionado</h3>
                  <p className="text-gray-600 text-sm">Acesse a aba "Catálogo Geral" para selecionar produtos.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Instruções */}
              <div className="lg:col-span-2">
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5" />
                      Importação em Massa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Passo 1 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                          1
                        </div>
                        <h3 className="font-semibold text-gray-900">Baixe o Template</h3>
                      </div>
                      <p className="text-sm text-gray-600 ml-10">
                        Primeiro, baixe o arquivo CSV (compatível com Excel) que já contém todos os seus produtos cadastrados.
                        Este arquivo servirá como base para atualização.
                      </p>
                      <div className="ml-10">
                        <Button
                          onClick={downloadTemplate}
                          disabled={exporting || importing || supplierProducts.length === 0}
                          variant="outline"
                          className="w-full md:w-auto hover:bg-blue-50 hover:border-blue-200"
                        >
                          {exporting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Baixar Template (.CSV)
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Passo 2 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
                          2
                        </div>
                        <h3 className="font-semibold text-gray-900">Edite o Arquivo</h3>
                      </div>
                      <div className="ml-10 space-y-2">
                        <p className="text-sm text-gray-600">
                          Abra o arquivo no Excel, Google Sheets ou qualquer editor de planilhas e atualize as seguintes colunas:
                        </p>
                        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                          <li><strong>Preço:</strong> Valor numérico (ex: 299.90, use ponto como separador decimal)</li>
                          <li><strong>Disponível:</strong> Escreva "SIM" ou "NÃO" (não sensível a maiúsculas/minúsculas)</li>
                        </ul>
                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <AlertDescription className="text-amber-800 text-sm">
                            <strong>Importante:</strong> NÃO altere as colunas de Código (SKU), Nome do Produto e Unidade.
                            Altere apenas Preço e Disponibilidade. Colunas alteradas incorretamente podem ser ignoradas.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>

                    <Separator />

                    {/* Passo 3 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold">
                          3
                        </div>
                        <h3 className="font-semibold text-gray-900">Importe de Volta</h3>
                      </div>
                      <div className="ml-10 space-y-3">
                        <p className="text-sm text-gray-600">
                          Após editar, salve o arquivo no formato CSV (separado por vírgulas) e faça upload aqui para atualizar todos os produtos de uma vez.
                        </p>

                        <div className="space-y-2">
                          <Label htmlFor="file-upload">Selecione o arquivo editado</Label>
                          <Input
                            id="file-upload"
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileUpload}
                            className="cursor-pointer"
                            disabled={importing || exporting}
                          />
                          {uploadedFile && (
                            <p className="text-sm text-green-600 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Arquivo selecionado: {uploadedFile.name}
                            </p>
                          )}
                          {!uploadedFile && (
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4" />
                              Nenhum arquivo selecionado.
                            </p>
                          )}
                        </div>

                        <Button
                          onClick={processImport}
                          disabled={importing || !uploadedFile || exporting}
                          className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                        >
                          {importing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Importando e Atualizando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Importar e Atualizar Produtos
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar de Benefícios */}
              <div>
                <Card className="bg-gradient-to-br from-blue-50 to-green-50 border-blue-200 border">
                  <CardHeader>
                    <CardTitle className="text-lg">Vantagens da Importação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <RefreshCw className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">Atualização Rápida</h4>
                        <p className="text-xs text-gray-600">
                          Atualize dezenas ou centenas de produtos em segundos, economizando tempo.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">Use Excel</h4>
                        <p className="text-xs text-gray-600">
                          Edite no programa que você já conhece e está acostumado a usar.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">Dados Validados</h4>
                        <p className="text-xs text-gray-600">
                          Nosso sistema valida os dados automaticamente, minimizando erros na atualização.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="mt-4 bg-white/80">
                  <CardHeader>
                    <CardTitle className="text-lg">Formatos Aceitos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm text-gray-600 space-y-2">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        CSV (.csv) - Recomendado
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Excel (.xlsx, .xls)
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}