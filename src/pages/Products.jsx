import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit3, Trash2, Package, ImageIcon, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Clock, User } from "lucide-react";
import { useSort } from "@/hooks/useSort";
import SortableTableHead from "@/components/ui/SortableTableHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Products() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [fabricantes, setFabricantes] = useState([]); // New state
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFabricante, setSelectedFabricante] = useState("all");
  const [activeTab, setActiveTab] = useState("catalog");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
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
    ativo: true,
    // Note: fabricante_id and aprovado_produto are not part of the admin's form data,
    // they are properties assigned by the system or toggled via switch for manufacturer products.
  });

  const { toast } = useToast();
  const [units, setUnits] = useState([]);
  const { sorted: sortedProducts, sortKey: prodSortKey, sortDir: prodSortDir, requestSort: requestProdSort } = useSort(filteredProducts, "nome");

  useEffect(() => {
    loadUser();
    loadProducts();
  }, []);

  const filterProducts = useCallback(() => {
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

    if (statusFilter === "pending") {
      filtered = filtered.filter(product => product.fabricante_id && !product.aprovado_produto);
    } else if (statusFilter === "approved") {
      filtered = filtered.filter(product => !product.fabricante_id || product.aprovado_produto);
    }

    if (selectedFabricante !== "all") {
      if (selectedFabricante === "admin") {
        filtered = filtered.filter(product => !product.fabricante_id);
      } else {
        filtered = filtered.filter(product => product.fabricante_id === selectedFabricante);
      }
    }
    
    setFilteredProducts(filtered);
  }, [products, searchTerm, selectedCategory, statusFilter, selectedFabricante]); // Add statusFilter to dependencies

  useEffect(() => {
    filterProducts();
  }, [filterProducts]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const loadProducts = async () => {
    try {
      // Fetch products, manufacturers, categories, and units
      const [productsData, categoriesData, unitsData] = await Promise.all([
        base44.entities.Product.list('-updated_date'),
        base44.entities.Category.list(),
        base44.entities.Unit.list()
      ]);
      
      // Buscar todos os fabricantes que têm produtos
      const fabricanteIds = [...new Set(productsData.filter(p => p.fabricante_id).map(p => p.fabricante_id))];
      
      let fabricantesData = [];
      if (fabricanteIds.length > 0) {
        const allUsers = await base44.entities.User.list();
        fabricantesData = allUsers.filter(f => 
          fabricanteIds.includes(f.id) && f.tipo_usuario === 'fabricante'
        );
      }
      
      setProducts(productsData);
      setFabricantes(fabricantesData);
      setCategories(categoriesData.filter(c => c.ativo).map(c => c.nome));
      setUnits(unitsData.filter(u => u.ativo).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(u => u.nome));
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        // When editing, preserve fabricant_id, fabricante_nome and aprovado_produto if they exist
        const updatedData = { ...formData };
        if (editingProduct.fabricante_id) {
          updatedData.fabricante_id = editingProduct.fabricante_id;
          updatedData.fabricante_nome = editingProduct.fabricante_nome || getFabricanteName(editingProduct.fabricante_id);
        }
        if (typeof editingProduct.aprovado_produto === 'boolean') updatedData.aprovado_produto = editingProduct.aprovado_produto;

        await base44.entities.Product.update(editingProduct.id, updatedData);
        
        // Detectar mudanças e notificar fornecedores APENAS se for produto de fabricante aprovado
        if (editingProduct.fabricante_id && editingProduct.aprovado_produto) {
          const precoAntigo = editingProduct.preco_fabricante ? parseFloat(editingProduct.preco_fabricante) : null;
          const precoNovo = updatedData.preco_fabricante ? parseFloat(updatedData.preco_fabricante) : null;
          const nomeAntigo = editingProduct.nome;
          const nomeNovo = updatedData.nome;
          const mudouPreco = precoAntigo !== precoNovo;
          const mudouNome = nomeAntigo !== nomeNovo;
          
          if (mudouPreco || mudouNome) {
            try {
              const allUsers = await base44.entities.User.list();
              const fornecedores = allUsers.filter(u => 
                u.role === 'user' && 
                u.aprovado === true && 
                (!u.tipo_usuario || u.tipo_usuario === 'fabricante') &&
                u.id !== editingProduct.fabricante_id
              );
              
              const fabricanteNome = editingProduct.fabricante_nome || getFabricanteName(editingProduct.fabricante_id);
              
              const notifications = fornecedores.map(u => {
                let mensagem = '';
                if (mudouPreco && mudouNome) {
                  mensagem = `${fabricanteNome} alterou "${nomeAntigo}" para "${nomeNovo}"${precoNovo ? ` e atualizou o preço para R$ ${precoNovo.toFixed(2)}` : ''}.`;
                } else if (mudouPreco) {
                  mensagem = precoAntigo 
                    ? `${fabricanteNome} alterou o preço de "${nomeNovo}" de R$ ${precoAntigo.toFixed(2)} para R$ ${precoNovo.toFixed(2)}.`
                    : `${fabricanteNome} definiu o preço de "${nomeNovo}" em R$ ${precoNovo.toFixed(2)}.`;
                } else if (mudouNome) {
                  mensagem = `${fabricanteNome} alterou o nome de "${nomeAntigo}" para "${nomeNovo}".`;
                }
                
                return {
                  supplier_id: u.id,
                  tipo: mudouPreco ? 'alteracao_preco' : 'novo_produto',
                  produto_id: editingProduct.id,
                  produto_nome: nomeNovo,
                  fabricante_id: editingProduct.fabricante_id,
                  fabricante_nome: fabricanteNome,
                  preco_antigo: precoAntigo,
                  preco_novo: precoNovo,
                  mensagem: mensagem,
                  lida: false
                };
              });
              
              if (notifications.length > 0) {
                await base44.entities.Notification.bulkCreate(notifications);
                toast({
                  title: "Usuários notificados",
                  description: `${notifications.length} usuário(s) notificado(s) sobre a alteração.`,
                });
              }
            } catch (error) {
              console.error("Erro ao criar notificações:", error);
              toast({
                title: "Erro ao notificar",
                description: "Produto atualizado, mas houve erro ao notificar usuários.",
                variant: "destructive"
              });
            }
          }
        }
      } else {
        await base44.entities.Product.create(formData);
      }
      setShowDialog(false);
      resetForm();
      loadProducts();
      toast({
        title: "Sucesso!",
        description: editingProduct ? "Produto atualizado." : "Produto criado.",
      });
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar produto. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    // When setting formData for editing, include all product properties that were loaded
    setFormData({
      nome: product.nome,
      cod: product.cod,
      peso: product.peso,
      dimensoes: product.dimensoes,
      und: product.und,
      categoria: product.categoria,
      foto: product.foto,
      ativo: product.ativo,
      preco_fabricante: product.preco_fabricante || '',
    });
    setShowDialog(true);
  };

  const handleDelete = async (product) => {
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

  // New function for approval toggle
  const handleApprovalToggle = async (product) => {
    if (!product.fabricante_id) return; // Only applicable for manufacturer products

    try {
      const novoStatus = !product.aprovado_produto;
      
      await base44.entities.Product.update(product.id, {
        aprovado_produto: novoStatus
      });
      
      // Se está aprovando o produto pela primeira vez, notificar fornecedores e fabricantes
      if (novoStatus && !product.aprovado_produto) {
        try {
          // Notificar o fabricante dono do produto sobre a aprovação
          if (product.fabricante_id) {
            await base44.entities.Notification.create({
              supplier_id: product.fabricante_id,
              tipo: 'produto_aprovado',
              produto_id: product.id,
              produto_nome: product.nome,
              fabricante_id: product.fabricante_id,
              fabricante_nome: product.fabricante_nome,
              preco_novo: product.preco_fabricante,
              mensagem: `Seu produto "${product.nome}" foi aprovado e está disponível no catálogo!`,
              lida: false
            });
          }
          
          // Buscar todos os fornecedores aprovados
          const todosFornecedores = await base44.entities.User.filter({ 
            role: 'user',
            aprovado: true
          });
          
          // Notificar fornecedores e outros fabricantes
          for (const usuario of todosFornecedores) {
            if (!usuario.tipo_usuario || (usuario.tipo_usuario === 'fabricante' && usuario.id !== product.fabricante_id)) {
              await base44.entities.Notification.create({
                supplier_id: usuario.id,
                tipo: 'novo_produto',
                produto_id: product.id,
                produto_nome: product.nome,
                fabricante_id: product.fabricante_id,
                fabricante_nome: product.fabricante_nome,
                preco_novo: product.preco_fabricante,
                mensagem: `Novo produto disponível: "${product.nome}" de ${product.fabricante_nome}${product.preco_fabricante ? ` por R$ ${parseFloat(product.preco_fabricante).toFixed(2)}` : ''}.`,
                lida: false
              });
            }
          }
        } catch (error) {
          console.error("Erro ao criar notificações:", error);
        }
      }
      
      loadProducts(); // Reload products to reflect changes
      toast({
        title: "Status atualizado",
        description: `Produto ${product.aprovado_produto ? 'desaprovado' : 'aprovado'} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao alterar aprovação:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSelectAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const handleApproveSelected = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Nenhum produto selecionado",
        description: "Selecione pelo menos um produto para aprovar.",
        variant: "destructive"
      });
      return;
    }

    let approved = 0;
    let errors = 0;

    for (const productId of selectedProducts) {
      const product = products.find(p => p.id === productId);
      if (product?.fabricante_id && !product.aprovado_produto) {
        try {
          await base44.entities.Product.update(productId, { aprovado_produto: true });
          approved++;
          
          // Notificar o fabricante e outros usuários sobre o produto aprovado
          try {
            // Notificar o fabricante dono do produto
            await base44.entities.Notification.create({
              supplier_id: product.fabricante_id,
              tipo: 'produto_aprovado',
              produto_id: product.id,
              produto_nome: product.nome,
              fabricante_id: product.fabricante_id,
              fabricante_nome: product.fabricante_nome,
              preco_novo: product.preco_fabricante,
              mensagem: `Seu produto "${product.nome}" foi aprovado e está disponível no catálogo!`,
              lida: false
            });
            
            const todosFornecedores = await base44.entities.User.filter({
              role: 'user',
              aprovado: true
            });
            
            for (const usuario of todosFornecedores) {
              if (!usuario.tipo_usuario || (usuario.tipo_usuario === 'fabricante' && usuario.id !== product.fabricante_id)) {
                await base44.entities.Notification.create({
                  supplier_id: usuario.id,
                  tipo: 'novo_produto',
                  produto_id: product.id,
                  produto_nome: product.nome,
                  fabricante_id: product.fabricante_id,
                  fabricante_nome: product.fabricante_nome,
                  preco_novo: product.preco_fabricante,
                  mensagem: `Novo produto disponível: "${product.nome}" de ${product.fabricante_nome}${product.preco_fabricante ? ` por R$ ${parseFloat(product.preco_fabricante).toFixed(2)}` : ''}.`,
                  lida: false
                });
              }
            }
          } catch (notifError) {
            console.error("Erro ao criar notificações:", notifError);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Erro ao aprovar produto ${productId}:`, error);
          errors++;
        }
      }
    }

    await loadProducts();
    setSelectedProducts([]);

    if (errors === 0) {
      toast({
        title: "Produtos aprovados!",
        description: `${approved} produto(s) aprovado(s) com sucesso.`,
      });
    } else {
      toast({
        title: "Aprovação concluída com avisos",
        description: `${approved} aprovado(s). ${errors} erro(s).`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Nenhum produto selecionado",
        description: "Selecione pelo menos um produto para deletar.",
        variant: "destructive"
      });
      return;
    }

    if (confirm(`Tem certeza que deseja excluir ${selectedProducts.length} produto(s) selecionado(s)? Esta ação não pode ser desfeita.`)) {
      let deleted = 0;
      let errors = 0;

      for (const productId of selectedProducts) {
        try {
          await base44.entities.Product.delete(productId);
          deleted++;
          await new Promise(resolve => setTimeout(resolve, 300)); // Delay aumentado para 300ms
        } catch (error) {
          console.error(`Erro ao deletar produto ${productId}:`, error);
          errors++;
        }
      }

      await loadProducts();
      setSelectedProducts([]);

      if (errors === 0) {
        toast({
          title: "Produtos deletados!",
          description: `${deleted} produto(s) removido(s) com sucesso.`,
        });
      } else {
        toast({
          title: "Exclusão concluída com avisos",
          description: `${deleted} deletado(s). ${errors} erro(s).`,
          variant: "destructive"
        });
      }
    }
  };

  // Helper to get manufacturer's name
  const getFabricanteName = (fabricanteId) => {
    const fabricante = fabricantes.find(f => f.id === fabricanteId);
    return fabricante?.empresa || fabricante?.full_name || "Desconhecido";
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
      ativo: true
    });
    setEditingProduct(null);
  };

  const getCategoryStats = () => {
    const stats = {};
    categories.forEach(cat => {
      stats[cat] = products.filter(p => p.categoria === cat).length;
    });
    return stats;
  };

  // New function for general statistics
  const getGeneralStats = () => {
    const total = products.length;
    const adminProducts = products.filter(p => !p.fabricante_id).length;
    const fabricanteProducts = products.filter(p => p.fabricante_id).length;
    const pending = products.filter(p => p.fabricante_id && !p.aprovado_produto).length;
    
    return { total, adminProducts, fabricanteProducts, pending };
  };

  const downloadMasterTable = async () => {
    setExporting(true);
    try {
      if (products.length === 0) {
        toast({
          title: "Nenhum produto para exportar",
          description: "O catálogo mestre está vazio.",
          variant: "destructive"
        });
        setExporting(false);
        return;
      }

      const exportData = products.map(product => ({
        'Código (SKU)': product.cod,
        'Nome do Produto': product.nome,
        'Categoria': product.categoria,
        'Unidade': product.und,
        'Peso (kg)': product.peso || '',
        'Dimensões (L x A x P)': product.dimensoes || '',
        'URL Foto': product.foto || '',
        'Ativo': product.ativo ? 'SIM' : 'NÃO',
        'Fabricante': product.fabricante_id ? getFabricanteName(product.fabricante_id) : 'Admin', // New field
        'Status': product.fabricante_id ? (product.aprovado_produto ? 'Aprovado' : 'Pendente') : 'Aprovado' // New field
      }));

      // Converter para CSV
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        'CATÁLOGO MESTRE DE PRODUTOS - PLACEFIT',
        `"Exportado em: ${new Date().toLocaleDateString('pt-BR')}"`,
        '', // Linha vazia
        headers.map(h => `"${h}"`).join(','),
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
      link.setAttribute('download', `catalogo_mestre_placefit_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Catálogo exportado!",
        description: "Arquivo CSV baixado com sucesso.",
      });

    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro",
        description: "Erro ao exportar catálogo. Tente novamente.",
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
              "Nome do Produto": { type: "string" },
              "Categoria": { type: "string" },
              "Unidade": { type: "string" },
              "Peso (kg)": { type: "number" },
              "Dimensões (L x A x P)": { type: "string" },
              "URL Foto": { type: "string" },
              "Ativo": { type: "string" }
            },
            required: ["Código (SKU)", "Nome do Produto", "Categoria", "Unidade"]
          }
        }
      });

      if (result.status === "error") {
        throw new Error(result.details || "Erro ao processar arquivo.");
      }

      // 3. Processar produtos
      const updates = result.output || [];
      let created = 0;
      let updated = 0;
      let errors = 0;
      let errorDetails = [];

      for (const item of updates) {
        try {
          // Check for required fields before processing
          if (!item["Código (SKU)"] || !item["Nome do Produto"] || !item["Categoria"] || !item["Unidade"]) {
            errorDetails.push(`Linha com dados incompletos, ignorada. Detalhes: ${JSON.stringify(item)}`);
            errors++;
            continue;
          }

          const productData = {
            cod: item["Código (SKU)"]?.toString(), // Ensure string
            nome: item["Nome do Produto"]?.toString(),
            categoria: item["Categoria"]?.toString(),
            und: item["Unidade"]?.toString(),
            peso: item["Peso (kg)"] ? parseFloat(item["Peso (kg)"]) : null,
            dimensoes: item["Dimensões (L x A x P)"]?.toString() || "",
            foto: item["URL Foto"]?.toString() || "",
            ativo: item["Ativo"]?.toUpperCase() !== "NÃO"
          };

          // Basic validation for mandatory fields
          if (!productData.cod || !productData.nome || !productData.categoria || !productData.und) {
            errorDetails.push(`Produto com SKU ${item["Código (SKU)"]}: Dados obrigatórios faltando.`);
            errors++;
            continue;
          }

          // Validate category and unit against predefined lists
          if (!categories.includes(productData.categoria)) {
            errorDetails.push(`Produto ${productData.cod}: Categoria inválida '${productData.categoria}'.`);
            errors++;
            continue;
          }
          if (!units.includes(productData.und)) {
            errorDetails.push(`Produto ${productData.cod}: Unidade inválida '${productData.und}'.`);
            errors++;
            continue;
          }

          // Verificar se produto já existe
          const existing = products.find(p => p.cod === productData.cod);
          if (existing) {
            await base44.entities.Product.update(existing.id, productData);
            updated++;
          } else {
            await base44.entities.Product.create(productData);
            created++;
          }

        } catch (updateError) {
          console.error("Erro ao processar produto:", item, updateError);
          errorDetails.push(`Erro em ${item["Código (SKU)"] || "produto sem SKU"}: ${updateError.message || "Erro desconhecido"}.`);
          errors++;
        }
      }

      toast({
        title: "Importação concluída!",
        description: `${created} criados, ${updated} atualizados.${errors > 0 ? ` ${errors} erros.` : ''}`,
      });

      if (errorDetails.length > 0) {
        // Show up to 3 error details in toasts
        errorDetails.slice(0, 3).forEach(detail => {
          toast({
            title: "Detalhe do Erro na Importação",
            description: detail,
            variant: "destructive",
            duration: 9000
          });
        });
        if (errorDetails.length > 3) {
            toast({
                title: "Mais Erros na Importação",
                description: `Existem mais ${errorDetails.length - 3} erros não exibidos. Verifique o console.`,
                variant: "destructive",
                duration: 9000
            });
        }
      }

      await loadProducts();
      setUploadedFile(null);
      setActiveTab("catalog");

    } catch (error) {
      console.error("Erro na importação:", error);
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao processar arquivo.",
        variant: "destructive"
      });
    }
    setImporting(false);
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

  const categoryStats = getCategoryStats();
  const generalStats = getGeneralStats();
  // useSort já declarado no topo do componente (linha ~72)

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Catálogo Mestre</h1>
            <p className="text-gray-600">Gerencie todos os produtos da PlaceFit</p>
          </div>
          <Button 
            onClick={() => setShowDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </Button>
        </div>

        {/* New: Alert for pending products */}
        {generalStats.pending > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>{generalStats.pending} produto(s) de fabricantes aguardando aprovação.</strong> Revise-os na aba Catálogo.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="catalog">
              Catálogo ({products.length})
              {generalStats.pending > 0 && ( // Display pending count on tab
                <Badge className="ml-2 bg-amber-500 text-white">{generalStats.pending}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="export">Exportar</TabsTrigger>
            <TabsTrigger value="import">Importar</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-6">
            {/* New: General Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
                <CardContent className="p-4 text-center">
                  <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-900">{generalStats.total}</div>
                  <p className="text-sm text-blue-700">Total</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-900">{generalStats.adminProducts}</div>
                  <p className="text-sm text-green-700">Admin</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
                <CardContent className="p-4 text-center">
                  <User className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-900">{generalStats.fabricanteProducts}</div>
                  <p className="text-sm text-purple-700">Fabricantes</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 border">
                <CardContent className="p-4 text-center">
                  <Clock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-amber-900">{generalStats.pending}</div>
                  <p className="text-sm text-amber-700">Pendentes</p>
                </CardContent>
              </Card>
            </div>

            {/* Ações em Lote */}
            {selectedProducts.length > 0 && (
              <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-300 border-2">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600 text-white text-lg px-4 py-2">
                        {selectedProducts.length} selecionado(s)
                      </Badge>
                      <p className="text-sm text-gray-600">
                        Ações em lote para os produtos selecionados
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={handleApproveSelected}
                        size="sm"
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Aprovar Selecionados
                      </Button>
                      <Button
                        onClick={handleDeleteSelected}
                        size="sm"
                        variant="destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Deletar Selecionados
                      </Button>
                      <Button
                        onClick={() => setSelectedProducts([])}
                        size="sm"
                        variant="outline"
                      >
                        Limpar Seleção
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/80 border-gray-200"
                  />
                </div>
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-48 bg-white/80">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category} ({categoryStats[category] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedFabricante} onValueChange={setSelectedFabricante}>
                <SelectTrigger className="w-full md:w-48 bg-white/80">
                  <SelectValue placeholder="Fabricante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Fabricantes</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {fabricantes
                    .filter(fab => fab.empresa || fab.full_name)
                    .sort((a, b) => {
                      const nomeA = a.empresa || a.full_name || '';
                      const nomeB = b.empresa || b.full_name || '';
                      return nomeA.localeCompare(nomeB);
                    })
                    .map(fab => (
                      <SelectItem key={fab.id} value={fab.id}>
                        {fab.empresa || fab.full_name || `Fabricante ${fab.id.substring(0, 8)}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48 bg-white/80">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="pending">Pendentes ({generalStats.pending})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Produtos em Formato Tabela - Desktop */}
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
              <CardContent className="p-0">
                <div className="w-full">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                        <TableHead className="text-white font-semibold w-8 px-2">
                          <input
                            type="checkbox"
                            checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                            onChange={handleSelectAllProducts}
                            className="w-3 h-3 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead className="text-white font-semibold w-12 px-2 text-xs">Foto</TableHead>
                        <SortableTableHead sortKey="nome" currentKey={prodSortKey} currentDir={prodSortDir} onSort={requestProdSort} className="text-white font-semibold px-2 text-xs">Nome</SortableTableHead>
                        <SortableTableHead sortKey="categoria" currentKey={prodSortKey} currentDir={prodSortDir} onSort={requestProdSort} className="text-white font-semibold px-2 text-xs">Cat.</SortableTableHead>
                        <SortableTableHead sortKey="fabricante_nome" currentKey={prodSortKey} currentDir={prodSortDir} onSort={requestProdSort} className="text-white font-semibold px-2 text-xs">Origem</SortableTableHead>
                        <SortableTableHead sortKey="aprovado_produto" currentKey={prodSortKey} currentDir={prodSortDir} onSort={requestProdSort} className="text-white font-semibold px-2 text-xs">Status</SortableTableHead>
                        <TableHead className="text-white font-semibold text-center px-2 text-xs">Aprovar</TableHead>
                        <TableHead className="text-white font-semibold text-center px-2 text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-200">
                      {sortedProducts.map((product, index) => (
                        <TableRow 
                          key={product.id} 
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${selectedProducts.includes(product.id) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''} hover:bg-blue-50 transition-colors`}
                        >
                          <TableCell className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => handleSelectProduct(product.id)}
                              className="w-3 h-3 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden">
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
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-2 py-2 font-medium text-xs max-w-[200px] truncate">
                            {product.nome}
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <Badge 
                              variant="secondary"
                              className={`text-xs px-1 ${
                                product.categoria === 'Cardiovascular' ? 'bg-red-100 text-red-700' :
                                product.categoria === 'Musculação' ? 'bg-blue-100 text-blue-700' :
                                product.categoria === 'Funcional' ? 'bg-green-100 text-green-700' :
                                product.categoria === 'Acessórios' ? 'bg-purple-100 text-purple-700' :
                                product.categoria === 'Vestuário' ? 'bg-pink-100 text-pink-700' :
                                'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {product.categoria.substring(0, 3)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            {product.fabricante_id ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 px-1">
                                  Fab
                                </Badge>
                                <span className="text-xs text-gray-500 truncate max-w-[80px]">
                                  {getFabricanteName(product.fabricante_id)}
                                </span>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 px-1">
                                Admin
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            {product.fabricante_id ? (
                              product.aprovado_produto ? (
                                <Badge className="bg-green-100 text-green-700 text-xs px-1">
                                  <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                  OK
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-700 text-xs px-1">
                                  <Clock className="w-2.5 h-2.5 mr-0.5" />
                                  Pend
                                </Badge>
                              )
                            ) : (
                              <Badge className="bg-green-100 text-green-700 text-xs px-1">
                                <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                OK
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-2 text-center">
                            {product.fabricante_id ? (
                              <Switch
                                checked={product.aprovado_produto}
                                onCheckedChange={() => handleApprovalToggle(product)}
                                className="scale-75"
                              />
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-2 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(product)}
                                className="hover:bg-blue-50 hover:text-blue-700 h-7 w-7 p-0"
                                disabled={product.fabricante_id && !product.aprovado_produto}
                              >
                                <Edit3 className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(product)}
                                className="hover:bg-red-50 hover:text-red-700 h-7 w-7 p-0"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table> {/* End shadcn Table */}
                </div>

                {filteredProducts.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                    <p className="text-gray-600">Tente ajustar os filtros ou adicione novos produtos.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cards Mobile */}
            <div className="md:hidden space-y-2 w-full">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="bg-white shadow-sm w-full">
                  <CardContent className="p-2 w-full">
                    <div className="space-y-2 w-full">
                      {/* Linha 1: Checkbox, Foto e Nome */}
                      <div className="flex items-start gap-2 w-full">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleSelectProduct(product.id)}
                          className="w-3.5 h-3.5 mt-1 flex-shrink-0"
                        />
                        <div className="w-10 h-10 bg-gray-100 rounded flex-shrink-0">
                          {product.foto ? (
                            <img 
                              src={product.foto} 
                              alt={product.nome}
                              className="w-full h-full object-cover rounded"
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
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h3 className="font-medium text-xs break-words line-clamp-2">{product.nome}</h3>
                        </div>
                      </div>
                      
                      {/* Linha 2: Badges de Categoria, Origem e Status */}
                      <div className="flex flex-wrap gap-1 w-full">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                          {product.categoria.substring(0, 3)}
                        </Badge>
                        {product.fabricante_id ? (
                          <>
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 px-1.5 py-0.5">
                              Fab
                            </Badge>
                            {product.aprovado_produto ? (
                              <Badge className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5">
                                <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                Aprovado
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5">
                                <Clock className="w-2.5 h-2.5 mr-0.5" />
                                Pendente
                              </Badge>
                            )}
                          </>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5">
                            <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                            Admin
                          </Badge>
                        )}
                      </div>
                      
                      {/* Linha 3: Ações */}
                      <div className="flex items-center justify-between gap-2 w-full border-t pt-2">
                        {product.fabricante_id && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-600">Aprovar:</span>
                            <Switch
                              checked={product.aprovado_produto}
                              onCheckedChange={() => handleApprovalToggle(product)}
                              className="scale-90"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(product)}
                            className="h-7 px-2 text-xs"
                            disabled={product.fabricante_id && !product.aprovado_produto}
                          >
                            <Edit3 className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(product)}
                            className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredProducts.length === 0 && (
                <div className="text-center py-12 overflow-hidden">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base font-semibold text-gray-900 mb-2 px-4">Nenhum produto encontrado</h3>
                  <p className="text-sm text-gray-600 px-4">Tente ajustar os filtros ou adicione novos produtos.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Exportar Catálogo Mestre
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FileSpreadsheet className="w-12 h-12 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Exportar Todos os Produtos
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Baixe o catálogo completo de produtos em formato CSV para backup ou edição externa.
                  </p>
                  <Button
                    onClick={downloadMasterTable}
                    disabled={exporting || products.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                    size="lg"
                  >
                    {exporting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Exportando...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 mr-2" />
                        Baixar Catálogo Mestre (.CSV)
                      </>
                    )}
                  </Button>
                </div>

                <Separator />

                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    O que será exportado:
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Todos os {products.length} produtos do catálogo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Informações completas (código, nome, categoria, especificações)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Status de ativação dos produtos</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Formato compatível com Excel e Google Sheets</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Importar Catálogo Mestre
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>Atenção:</strong> A importação irá criar novos produtos ou atualizar produtos existentes com base no código SKU.
                    Produtos não incluídos no arquivo NÃO serão excluídos.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Formato do Arquivo</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      O arquivo CSV deve conter as seguintes colunas (obrigatórias em negrito):
                    </p>
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <ul className="text-sm space-y-1">
                        <li><strong>• Código (SKU)</strong> - Identificador único do produto</li>
                        <li><strong>• Nome do Produto</strong> - Nome descritivo</li>
                        <li><strong>• Categoria</strong> - {categories.join(', ')}</li>
                        <li><strong>• Unidade</strong> - {units.join(', ')}</li>
                        <li>• Peso (kg) - Peso em quilogramas (opcional, pode ser float)</li>
                        <li>• Dimensões (L x A x P) - Formato: "200 x 80 x 150" (opcional)</li>
                        <li>• URL Foto - Link da imagem do produto (opcional)</li>
                        <li>• Ativo - "SIM" ou "NÃO" (padrão: SIM se não informado ou diferente de "NÃO")</li>
                      </ul>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label htmlFor="master-file-upload" className="text-base font-semibold">
                      Selecione o arquivo para importar
                    </Label>
                    <Input
                      id="master-file-upload"
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="cursor-pointer"
                      disabled={importing}
                    />
                    {uploadedFile && (
                      <p className="text-sm text-green-600 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Arquivo selecionado: {uploadedFile.name}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={processImport}
                    disabled={importing || !uploadedFile}
                    className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                    size="lg"
                  >
                    {importing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-2" />
                        Importar Produtos
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Dicas para importação bem-sucedida:
                  </h4>
                  <ul className="text-sm text-green-800 space-y-2">
                    <li>• Use o formato CSV com separador de vírgula</li>
                    <li>• Certifique-se de que as categorias e unidades são válidas</li>
                    <li>• Códigos SKU devem ser únicos</li>
                    <li>• Use codificação UTF-8 para caracteres especiais</li>
                    <li>• Você pode baixar um exemplo usando a aba "Exportar"</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                    value={formData.peso === null ? '' : formData.peso} // Handle null for number input
                    onChange={(e) => setFormData({ ...formData, peso: parseFloat(e.target.value) || null })}
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
                    value={formData.preco_fabricante === null ? '' : formData.preco_fabricante}
                    onChange={(e) => setFormData({ ...formData, preco_fabricante: parseFloat(e.target.value) || null })}
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