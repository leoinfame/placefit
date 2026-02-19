import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Search, Mail, Phone, Building, Eye, Package, CheckCircle, Copy, Share2, Plus, Edit3, Trash2, Upload, Download, FileSpreadsheet, Globe, Printer, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";

export default function Fabricantes() {
  const [user, setUser] = useState(null);
  const [fabricantes, setFabricantes] = useState([]);
  const [filteredFabricantes, setFilteredFabricantes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFabricante, setSelectedFabricante] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [fabricanteProducts, setFabricanteProducts] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showFabricanteDialog, setShowFabricanteDialog] = useState(false);
  const [editingFabricante, setEditingFabricante] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [fabricanteFormData, setFabricanteFormData] = useState({
    full_name: "",
    email: "",
    empresa: "",
    cnpj: "",
    whatsapp: "",
    endereco: "",
    site: "",
    logomarca: "",
    historia_empresa: "",
    formas_pagamento: "",
    politica_troca: "",
    prazo_entrega: "",
    tipo_usuario: "fabricante",
    aprovado: true
  });
  const [productFormData, setProductFormData] = useState({
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
  const [selectedProducts, setSelectedProducts] = useState([]);

  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);

  const downloadFabricanteTemplate = () => {
    const headers = [
      'NOME DO PRODUTO',
      'CODIGO SKU',
      'CATEGORIA',
      'UNIDADE DE VENDA',
      'PESO',
      'DIMENSOES',
      'PRECO SUGERIDO',
      'LINK DA FOTO'
    ];

    const examples = [
      ['Esteira Profissional X1', 'EST-PRO-X1', 'Cardiovascular', 'peca', '120', '200 x 80 x 150', '8500.00', ''],
      ['Bicicleta Ergometrica Pro', 'BIC-ERG-PRO', 'Cardiovascular', 'peca', '45', '120 x 60 x 140', '3200.00', ''],
      ['Banco Supino Ajustavel', 'BSA-001', 'Musculacao', 'peca', '35', '150 x 60 x 50', '1800.00', '']
    ];

    const csvContent = [
      headers.join(','),
      ...examples.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template_produtos_${selectedFabricante?.empresa?.replace(/\s+/g, '_') || 'fabricante'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Template baixado!",
      description: "Preencha o template e faca o upload. Use formato CSV simples.",
    });
  };

  const exportFabricanteProducts = () => {
    setExporting(true);
    try {
      if (fabricanteProducts.length === 0) {
        toast({
          title: "Nenhum produto para exportar",
          description: "Este fabricante ainda nao possui produtos cadastrados.",
          variant: "destructive"
        });
        setExporting(false);
        return;
      }

      const exportData = fabricanteProducts.map(p => [
        p.nome,
        p.cod,
        p.categoria,
        p.und,
        p.peso || '',
        p.dimensoes || '',
        p.preco_fabricante || '',
        p.foto || ''
      ]);

      const headers = ['NOME DO PRODUTO', 'CODIGO SKU', 'CATEGORIA', 'UNIDADE DE VENDA', 'PESO', 'DIMENSOES', 'PRECO SUGERIDO', 'LINK DA FOTO'];
      
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `produtos_${selectedFabricante?.empresa?.replace(/\s+/g, '_') || 'fabricante'}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Produtos exportados!",
        description: `${fabricanteProducts.length} produto(s) exportado(s) com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro",
        description: "Erro ao exportar produtos. Tente novamente.",
        variant: "destructive"
      });
    }
    setExporting(false);
  };

  const handleImportFabricanteProducts = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      // Read file content directly
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() && !line.match(/^[,;]+$/));
      
      if (lines.length < 2) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo nao contem dados validos.",
          variant: "destructive"
        });
        setImporting(false);
        e.target.value = '';
        return;
      }

      // Detect separator (comma or semicolon)
      const separator = lines[0].includes(';') ? ';' : ',';
      
      // Parse CSV manually
      const parseCSVLine = (line) => {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === separator && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values;
      };

      const headers = parseCSVLine(lines[0]);
      const dataLines = lines.slice(1);
      
      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const line of dataLines) {
        const values = parseCSVLine(line);
        
        // Garantir que temos pelo menos 8 valores (preencher com vazios se necessário)
        while (values.length < 8) {
          values.push('');
        }
        
        if (!values[0] || !values[1]) {
          errors++;
          continue;
        }

        try {
          const productData = {
            nome: values[0].trim(),
            cod: values[1].trim(),
            categoria: values[2]?.trim() || 'Acessorios',
            und: values[3]?.trim() || 'peca',
            peso: values[4] && values[4].trim() ? parseFloat(values[4].trim()) : null,
            dimensoes: values[5]?.trim() || '',
            preco_fabricante: values[6] && values[6].trim() ? parseFloat(values[6].trim()) : null,
            foto: values[7]?.trim() || '',
            fabricante_id: selectedFabricante.id,
            aprovado_produto: true,
            ativo: true
          };

          // Buscar produto existente pelo código SKU e fabricante
          const allProducts = await base44.entities.Product.list();
          const existingProduct = allProducts.find(p => 
            p.cod === values[1] && p.fabricante_id === selectedFabricante.id
          );

          if (existingProduct) {
            // Atualizar produto existente
            await base44.entities.Product.update(existingProduct.id, productData);
            updated++;
          } else {
            // Criar novo produto
            await base44.entities.Product.create(productData);
            created++;
          }
        } catch (err) {
          console.error("Erro ao processar produto:", err);
          errors++;
        }
      }

      toast({
        title: "Importacao concluida!",
        description: `${created} criado(s), ${updated} atualizado(s).${errors > 0 ? ` ${errors} erro(s).` : ''}`,
      });
      
      viewFabricanteDetails(selectedFabricante);
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

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterFabricantes();
  }, [fabricantes, searchTerm]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const [data, categoriesData, unitsData] = await Promise.all([
        base44.entities.User.filter({ tipo_usuario: 'fabricante' }),
        base44.entities.Category.list(),
        base44.entities.Unit.list()
      ]);
      setFabricantes(data);
      setCategories(categoriesData.filter(c => c.ativo).map(c => c.nome));
      setUnits(unitsData.filter(u => u.ativo).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(u => u.nome));
    } catch (error) {
      console.error("Erro ao carregar fabricantes:", error);
    }
    setLoading(false);
  };

  const filterFabricantes = () => {
    let filtered = fabricantes;
    
    if (searchTerm) {
      filtered = filtered.filter(fabricante =>
        (fabricante.empresa?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (fabricante.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (fabricante.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredFabricantes(filtered);
  };

  const handleApprovalToggle = async (fabricante) => {
    try {
      await base44.entities.User.update(fabricante.id, { 
        aprovado: !fabricante.aprovado 
      });
      loadData();
      toast({
        title: "Status atualizado",
        description: `Fabricante ${fabricante.aprovado ? 'desaprovado' : 'aprovado'} com sucesso.`,
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

  const viewFabricanteDetails = async (fabricante) => {
    setSelectedFabricante(fabricante);
    setSelectedProducts([]);
    try {
      const allProducts = await base44.entities.Product.list();
      const products = allProducts.filter(p => p.fabricante_id === fabricante.id);
      setFabricanteProducts(products);
    } catch (error) {
      console.error("Erro ao carregar produtos do fabricante:", error);
    }
    setShowDialog(true);
  };



  const viewFabricanteTable = async (fabricante) => {
    setSelectedFabricante(fabricante);
    try {
      const allProducts = await base44.entities.Product.list();
      const products = allProducts.filter(p => 
        p.fabricante_id === fabricante.id && 
        p.aprovado_produto === true && 
        p.ativo !== false
      );
      setFabricanteProducts(products);
    } catch (error) {
      console.error("Erro ao carregar produtos do fabricante:", error);
    }
    setShowTableDialog(true);
  };

  const handlePrintTable = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    const logoHtml = selectedFabricante.logomarca 
      ? `<img src="${selectedFabricante.logomarca}" alt="Logo" style="width: 80px; height: 80px; object-fit: contain; margin-right: 20px;" />`
      : '';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Tabela de Produtos - ${selectedFabricante?.empresa || selectedFabricante?.full_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { display: flex; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #3B82F6; padding-bottom: 15px; }
            .header-info { flex: 1; }
            .header h1 { margin: 0 0 10px 0; color: #1F2937; font-size: 24px; }
            .header p { margin: 3px 0; color: #6B7280; font-size: 12px; }
            .header-right { text-align: right; }
            .header-right p { font-weight: bold; color: #1F2937; margin: 0; }
            .header-right span { color: #6B7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: linear-gradient(to right, #3B82F6, #10B981); color: white; padding: 10px; text-align: left; font-size: 11px; }
            td { border: 1px solid #E5E7EB; padding: 8px; font-size: 11px; }
            tr:nth-child(even) { background-color: #F9FAFB; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; color: #059669; }
            .badge { display: inline-block; padding: 2px 8px; border: 1px solid #D1D5DB; border-radius: 4px; font-size: 10px; }
            @media print {
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <div class="header-info">
              <h1>${selectedFabricante?.empresa || selectedFabricante?.full_name}</h1>
              ${selectedFabricante.whatsapp ? `<p>📱 ${selectedFabricante.whatsapp}</p>` : ''}
              ${selectedFabricante.email ? `<p>✉️ ${selectedFabricante.email}</p>` : ''}
              ${selectedFabricante.site ? `<p>🌐 ${selectedFabricante.site}</p>` : ''}
            </div>
            <div class="header-right">
              <p>TABELA DE PRODUTOS</p>
              <span>${fabricanteProducts.length} produto(s)</span>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th class="text-center">Unidade</th>
                <th>Peso</th>
                <th>Dimensões</th>
                <th class="text-right">Preço Sugerido</th>
              </tr>
            </thead>
            <tbody>
              ${fabricanteProducts.map(product => `
                <tr>
                  <td style="font-family: monospace;">${product.cod}</td>
                  <td style="font-weight: 500;">${product.nome}</td>
                  <td>${product.categoria}</td>
                  <td class="text-center">${product.und}</td>
                  <td>${product.peso ? `${product.peso} kg` : '-'}</td>
                  <td>${product.dimensoes || '-'}</td>
                  <td class="text-right font-bold">${product.preco_fabricante ? `R$ ${parseFloat(product.preco_fabricante).toFixed(2)}` : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const openProductDialog = (fabricante, product = null) => {
    setSelectedFabricante(fabricante);
    if (product) {
      setEditingProduct(product);
      setProductFormData(product);
    } else {
      resetProductForm();
    }
    setShowDialog(false);
    setShowProductDialog(true);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...productFormData,
        fabricante_id: selectedFabricante.id,
        fabricante_nome: selectedFabricante.empresa || selectedFabricante.full_name,
        aprovado_produto: true // Admin cria como aprovado
      };

      if (editingProduct) {
        const precoAntigo = editingProduct.preco_fabricante;
        const precoNovo = productData.preco_fabricante;
        
        await base44.entities.Product.update(editingProduct.id, productData);
        
        // Se o preço mudou, notificar fornecedores e fabricantes
        if (precoAntigo !== precoNovo && precoNovo) {
          try {
            const supplierProducts = await base44.entities.SupplierProduct.filter({
              product_id: editingProduct.id
            });
            
            // Notificar fornecedores
            for (const sp of supplierProducts) {
              await base44.entities.Notification.create({
                supplier_id: sp.supplier_id,
                tipo: 'alteracao_preco',
                produto_id: editingProduct.id,
                produto_nome: productData.nome,
                fabricante_id: selectedFabricante.id,
                fabricante_nome: productData.fabricante_nome,
                preco_antigo: precoAntigo,
                preco_novo: precoNovo,
                mensagem: precoAntigo 
                  ? `O preço do produto "${productData.nome}" foi alterado de R$ ${parseFloat(precoAntigo).toFixed(2)} para R$ ${parseFloat(precoNovo).toFixed(2)}.`
                  : `Preço do produto "${productData.nome}" definido em R$ ${parseFloat(precoNovo).toFixed(2)}.`,
                lida: false
              });
            }
            
            // Notificar também outros fabricantes
            const outrosFabricantes = await base44.entities.User.filter({
              tipo_usuario: 'fabricante',
              aprovado: true
            });
            
            for (const fabricante of outrosFabricantes) {
              if (fabricante.id !== selectedFabricante.id) {
                await base44.entities.Notification.create({
                  supplier_id: fabricante.id,
                  tipo: 'alteracao_preco',
                  produto_id: editingProduct.id,
                  produto_nome: productData.nome,
                  fabricante_id: selectedFabricante.id,
                  fabricante_nome: productData.fabricante_nome,
                  preco_antigo: precoAntigo,
                  preco_novo: precoNovo,
                  mensagem: precoAntigo 
                    ? `${productData.fabricante_nome} alterou o preço de "${productData.nome}" de R$ ${parseFloat(precoAntigo).toFixed(2)} para R$ ${parseFloat(precoNovo).toFixed(2)}.`
                    : `${productData.fabricante_nome} definiu o preço de "${productData.nome}" em R$ ${parseFloat(precoNovo).toFixed(2)}.`,
                  lida: false
                });
              }
            }
          } catch (error) {
            console.error("Erro ao criar notificações:", error);
          }
        }
        
        toast({
          title: "Produto atualizado!",
          description: "Produto atualizado com sucesso.",
        });
      } else {
        const newProduct = await base44.entities.Product.create(productData);
        
        // Novo produto criado = notificar fornecedores e fabricantes
        try {
          const usuarios = await base44.entities.User.filter({ 
            role: 'user',
            aprovado: true
          });
          
          for (const usuario of usuarios) {
            // Notificar fornecedores (sem tipo_usuario) e outros fabricantes
            if (!usuario.tipo_usuario || (usuario.tipo_usuario === 'fabricante' && usuario.id !== selectedFabricante.id)) {
              await base44.entities.Notification.create({
                supplier_id: usuario.id,
                tipo: 'novo_produto',
                produto_id: newProduct.id,
                produto_nome: productData.nome,
                fabricante_id: selectedFabricante.id,
                fabricante_nome: productData.fabricante_nome,
                preco_novo: productData.preco_fabricante,
                mensagem: `Novo produto disponível: "${productData.nome}" de ${productData.fabricante_nome}${productData.preco_fabricante ? ` por R$ ${parseFloat(productData.preco_fabricante).toFixed(2)}` : ''}.`,
                lida: false
              });
            }
          }
        } catch (error) {
          console.error("Erro ao criar notificações:", error);
        }
        
        toast({
          title: "Produto criado!",
          description: "Produto criado e já está disponível.",
        });
      }

      setShowProductDialog(false);
      resetProductForm();
      if (selectedFabricante) {
        viewFabricanteDetails(selectedFabricante);
      }
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar produto. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProduct = async (product) => {
    if (confirm(`Tem certeza que deseja excluir "${product.nome}"?`)) {
      try {
        await base44.entities.Product.delete(product.id);
        viewFabricanteDetails(selectedFabricante);
        toast({
          title: "Produto excluido",
          description: "Produto removido com sucesso.",
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

  const handleDeleteAllProducts = async () => {
    if (fabricanteProducts.length === 0) {
      toast({
        title: "Nenhum produto",
        description: "Este fabricante nao possui produtos para deletar.",
        variant: "destructive"
      });
      return;
    }

    if (confirm(`Tem certeza que deseja excluir TODOS os ${fabricanteProducts.length} produtos de ${selectedFabricante?.empresa || selectedFabricante?.full_name}? Esta acao nao pode ser desfeita.`)) {
      let deleted = 0;
      let errors = 0;
      
      for (const product of fabricanteProducts) {
        try {
          await base44.entities.Product.delete(product.id);
          deleted++;
        } catch (error) {
          console.error(`Erro ao excluir produto ${product.id}:`, error);
          errors++;
        }
      }
      
      viewFabricanteDetails(selectedFabricante);
      
      if (errors === 0) {
        toast({
          title: "Produtos excluidos",
          description: `${deleted} produto(s) removido(s) com sucesso.`,
        });
      } else {
        toast({
          title: "Exclusao concluida com avisos",
          description: `${deleted} produto(s) excluido(s). ${errors} erro(s).`,
          variant: "destructive"
        });
      }
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
    if (selectedProducts.length === fabricanteProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(fabricanteProducts.map(p => p.id));
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
      const product = fabricanteProducts.find(p => p.id === productId);
      try {
        await base44.entities.Product.update(productId, { aprovado_produto: true });
        approved++;
        
        // Notificar o fabricante sobre a aprovação
        if (product && selectedFabricante) {
          await base44.entities.Notification.create({
            supplier_id: selectedFabricante.id,
            tipo: 'produto_aprovado',
            produto_id: product.id,
            produto_nome: product.nome,
            fabricante_id: selectedFabricante.id,
            fabricante_nome: selectedFabricante.empresa || selectedFabricante.full_name,
            preco_novo: product.preco_fabricante,
            mensagem: `Seu produto "${product.nome}" foi aprovado e está disponível no catálogo!`,
            lida: false
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 150)); // Delay para evitar rate limit
      } catch (error) {
        console.error(`Erro ao aprovar produto ${productId}:`, error);
        errors++;
      }
    }

    viewFabricanteDetails(selectedFabricante);
    setSelectedProducts([]);

    if (errors === 0) {
      toast({
        title: "Produtos aprovados!",
        description: `${approved} produto(s) aprovado(s) com sucesso.`,
      });
    } else {
      toast({
        title: "Aprovacao concluida com avisos",
        description: `${approved} aprovado(s). ${errors} erro(s).`,
        variant: "destructive"
      });
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setProductFormData({ ...productFormData, foto: file_url });
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

  const resetProductForm = () => {
    setProductFormData({
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

  const resetFabricanteForm = () => {
    setFabricanteFormData({
      full_name: "",
      email: "",
      empresa: "",
      cnpj: "",
      whatsapp: "",
      endereco: "",
      site: "",
      logomarca: "",
      historia_empresa: "",
      formas_pagamento: "",
      politica_troca: "",
      prazo_entrega: "",
      tipo_usuario: "fabricante",
      aprovado: true
    });
    setEditingFabricante(null);
  };

  const handleFabricanteSubmit = async (e) => {
    e.preventDefault();
    try {
      await base44.entities.User.update(editingFabricante.id, fabricanteFormData);
      toast({
        title: "Fabricante atualizado!",
        description: "Dados do fabricante foram atualizados.",
      });
      setShowFabricanteDialog(false);
      resetFabricanteForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar fabricante:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar fabricante. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFabricanteFormData({ ...fabricanteFormData, logomarca: file_url });
      toast({
        title: "Logo enviada!",
        description: "Logo da empresa carregada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar logo. Tente novamente.",
        variant: "destructive"
      });
    }
    setUploadingLogo(false);
  };

  const handleEditFabricante = (fabricante) => {
    setEditingFabricante(fabricante);
    setFabricanteFormData({
      full_name: fabricante.full_name || "",
      email: fabricante.email || "",
      empresa: fabricante.empresa || "",
      cnpj: fabricante.cnpj || "",
      whatsapp: fabricante.whatsapp || "",
      endereco: fabricante.endereco || "",
      site: fabricante.site || "",
      logomarca: fabricante.logomarca || "",
      historia_empresa: fabricante.historia_empresa || "",
      formas_pagamento: fabricante.formas_pagamento || "",
      politica_troca: fabricante.politica_troca || "",
      prazo_entrega: fabricante.prazo_entrega || "",
      tipo_usuario: "fabricante",
      aprovado: fabricante.aprovado
    });
    setShowFabricanteDialog(true);
  };

  const handleDeleteFabricante = async (fabricante) => {
    if (confirm(`Tem certeza que deseja excluir o fabricante "${fabricante.empresa || fabricante.full_name}"? Esta acao nao pode ser desfeita.`)) {
      try {
        await base44.entities.User.delete(fabricante.id);
        loadData();
        toast({
          title: "Fabricante excluido",
          description: "Fabricante removido com sucesso.",
        });
      } catch (error) {
        console.error("Erro ao excluir fabricante:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir fabricante. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const copyRegistrationLink = () => {
    const link = `${window.location.origin}/PublicRegisterFabricante`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Link de cadastro de fabricantes copiado.",
    });
  };

  const getStats = () => {
    const total = fabricantes.length;
    const approved = fabricantes.filter(f => f.aprovado).length;
    const pending = total - approved;
    
    return { total, approved, pending };
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

  const stats = getStats();

  return (
    <div className="p-4 md:p-8 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 w-full max-w-full">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fabricantes</h1>
          <p className="text-gray-600">Gerencie todos os fabricantes e seus produtos</p>
        </div>

        {/* Link de Cadastro */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 border">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Share2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Link de Cadastro de Fabricantes</h3>
                  <p className="text-sm text-gray-600">
                    Compartilhe este link para que novos fabricantes se cadastrem
                  </p>
                  <code className="text-xs bg-white px-2 py-1 rounded mt-2 inline-block border">
                    {window.location.origin}/PublicRegisterFabricante
                  </code>
                </div>
              </div>
              <Button
                onClick={copyRegistrationLink}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 whitespace-nowrap"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{stats.total}</div>
              <p className="text-sm text-purple-700">Total de Fabricantes</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{stats.approved}</div>
              <p className="text-sm text-green-700">Aprovados</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">{stats.pending}</div>
              <p className="text-sm text-orange-700">Aguardando Aprovacao</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtro */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar fabricantes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200"
            />
          </div>
        </div>

        {/* Tabela de Fabricantes - Desktop */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-500 hover:to-blue-500">
                    <TableHead className="text-white font-semibold">Empresa</TableHead>
                    <TableHead className="text-white font-semibold">Responsavel</TableHead>
                    <TableHead className="text-white font-semibold">E-mail</TableHead>
                    <TableHead className="text-white font-semibold">Contato</TableHead>
                    <TableHead className="text-white font-semibold">Status</TableHead>
                    <TableHead className="text-white font-semibold text-center">Aprovar</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFabricantes.map((fabricante, index) => (
                    <TableRow 
                      key={fabricante.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors`}
                    >
                      <TableCell className="font-medium">
                        {fabricante.empresa || '-'}
                      </TableCell>
                      <TableCell>{fabricante.full_name}</TableCell>
                      <TableCell className="text-sm">{fabricante.email}</TableCell>
                      <TableCell className="text-sm">
                        {fabricante.whatsapp || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={fabricante.aprovado ? "success" : "secondary"}
                          className={fabricante.aprovado 
                            ? "bg-green-100 text-green-700" 
                            : "bg-orange-100 text-orange-700"
                          }
                        >
                          {fabricante.aprovado ? "Aprovado" : "Aguardando"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Switch
                            checked={fabricante.aprovado}
                            onCheckedChange={() => handleApprovalToggle(fabricante)}
                          />
                          <Label className="text-xs">Aprovado</Label>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewFabricanteDetails(fabricante)}
                            className="hover:bg-purple-50 hover:text-purple-700"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewFabricanteTable(fabricante)}
                            className="hover:bg-indigo-50 hover:text-indigo-700"
                            title="Ver tabela"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFabricante(fabricante)}
                            className="hover:bg-blue-50 hover:text-blue-700"
                            title="Editar fabricante"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openProductDialog(fabricante)}
                            className="hover:bg-green-50 hover:text-green-700"
                            title="Adicionar produto"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFabricante(fabricante)}
                            className="hover:bg-red-50 hover:text-red-700"
                            title="Excluir fabricante"
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

            {filteredFabricantes.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum fabricante encontrado</h3>
                <p className="text-gray-600">Os fabricantes aparecerão aqui após se cadastrarem.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cards Mobile */}
        <div className="md:hidden space-y-2 w-full">
          {filteredFabricantes.map((fabricante) => (
            <Card key={fabricante.id} className="bg-white shadow-sm w-full">
              <CardContent className="p-3 w-full">
                <div className="space-y-2 w-full">
                  {/* Linha 1: Logo, Nome e Status */}
                  <div className="flex items-start gap-2 w-full">
                    {fabricante.logomarca && (
                      <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                        <img 
                          src={fabricante.logomarca} 
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm break-words">
                        {fabricante.empresa || fabricante.full_name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">{fabricante.full_name}</p>
                    </div>
                    <Badge 
                      variant={fabricante.aprovado ? "success" : "secondary"}
                      className={fabricante.aprovado 
                        ? "bg-green-100 text-green-700 text-xs flex-shrink-0" 
                        : "bg-orange-100 text-orange-700 text-xs flex-shrink-0"
                      }
                    >
                      {fabricante.aprovado ? "Aprovado" : "Aguardando"}
                    </Badge>
                  </div>

                  {/* Linha 2: Contato */}
                  <div className="space-y-0.5 text-xs text-gray-600">
                    <div className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{fabricante.email}</span>
                    </div>
                    {fabricante.whatsapp && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{fabricante.whatsapp}</span>
                      </div>
                    )}
                  </div>

                  {/* Linha 3: Aprovação */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-xs text-gray-600">Aprovar:</span>
                    <Switch
                      checked={fabricante.aprovado}
                      onCheckedChange={() => handleApprovalToggle(fabricante)}
                      className="scale-90"
                    />
                  </div>

                  {/* Linha 4: Ações */}
                  <div className="flex flex-wrap gap-1 w-full pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewFabricanteDetails(fabricante)}
                      className="flex-1 h-7 text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewFabricanteTable(fabricante)}
                      className="flex-1 h-7 text-xs"
                    >
                      <FileSpreadsheet className="w-3 h-3 mr-1" />
                      Tabela
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditFabricante(fabricante)}
                      className="flex-1 h-7 text-xs"
                    >
                      <Edit3 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openProductDialog(fabricante)}
                      className="flex-1 h-7 text-xs text-green-600 hover:bg-green-50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Produto
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteFabricante(fabricante)}
                      className="flex-1 h-7 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredFabricantes.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-gray-900 mb-2">Nenhum fabricante encontrado</h3>
              <p className="text-sm text-gray-600">Os fabricantes aparecerão aqui após se cadastrarem.</p>
            </div>
          )}
        </div>

        {/* Dialog de Detalhes do Fabricante */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Detalhes do Fabricante: {selectedFabricante?.empresa || selectedFabricante?.full_name}
              </DialogTitle>
            </DialogHeader>
            
            {selectedFabricante && (
              <div className="space-y-6">
                {/* Informações do Fabricante */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dados do Fabricante</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Empresa</Label>
                      <p className="font-medium">{selectedFabricante.empresa || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">CNPJ</Label>
                      <p className="font-medium">{selectedFabricante.cnpj || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Responsavel</Label>
                      <p className="font-medium">{selectedFabricante.full_name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">E-mail</Label>
                      <p className="font-medium">{selectedFabricante.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">WhatsApp</Label>
                      <p className="font-medium">{selectedFabricante.whatsapp || "Não informado"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Status</Label>
                      <Badge 
                        variant={selectedFabricante.aprovado ? "success" : "secondary"}
                        className={selectedFabricante.aprovado 
                          ? "bg-green-100 text-green-700" 
                          : "bg-orange-100 text-orange-700"
                        }
                      >
                        {selectedFabricante.aprovado ? "Aprovado" : "Aguardando Aprovacao"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Produtos do Fabricante */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Produtos Cadastrados ({fabricanteProducts.length})
                        {selectedProducts.length > 0 && (
                          <Badge className="ml-2 bg-blue-500 text-white">
                            {selectedProducts.length} selecionado(s)
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        {selectedProducts.length > 0 && (
                          <Button
                            onClick={handleApproveSelected}
                            size="sm"
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Aprovar Selecionados ({selectedProducts.length})
                          </Button>
                        )}
                        <Button
                          onClick={downloadFabricanteTemplate}
                          size="sm"
                          variant="outline"
                          className="border-green-200 text-green-700 hover:bg-green-50"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Template
                        </Button>
                        {fabricanteProducts.length > 0 && (
                          <>
                            <Button
                              onClick={exportFabricanteProducts}
                              size="sm"
                              variant="outline"
                              disabled={exporting}
                              className="border-blue-200 text-blue-700 hover:bg-blue-50"
                            >
                              {exporting ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                                  Exportando...
                                </>
                              ) : (
                                <>
                                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                                  Exportar CSV
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={handleDeleteAllProducts}
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Deletar Todos
                            </Button>
                          </>
                        )}
                        <div>
                          <input
                            id="import-fabricante-products"
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleImportFabricanteProducts}
                            className="hidden"
                          />
                          <Button
                            onClick={() => document.getElementById('import-fabricante-products')?.click()}
                            size="sm"
                            variant="outline"
                            disabled={importing}
                            className="border-purple-200 text-purple-700 hover:bg-purple-50"
                          >
                            {importing ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600 mr-2"></div>
                                Importando...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Importar CSV
                              </>
                            )}
                          </Button>
                        </div>
                        <Button
                          onClick={() => openProductDialog(selectedFabricante)}
                          size="sm"
                          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Novo Produto
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {fabricanteProducts.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border mb-3">
                          <input
                            type="checkbox"
                            checked={selectedProducts.length === fabricanteProducts.length && fabricanteProducts.length > 0}
                            onChange={handleSelectAllProducts}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <Label className="cursor-pointer text-sm font-medium">
                            Selecionar Todos ({fabricanteProducts.length})
                          </Label>
                        </div>

                        {fabricanteProducts.map((product) => (
                          <div 
                            key={product.id} 
                            className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                              selectedProducts.includes(product.id) ? 'bg-blue-50 border-blue-300' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => handleSelectProduct(product.id)}
                              className="w-4 h-4 cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{product.nome}</p>
                              <p className="text-sm text-gray-500">{product.cod}</p>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-right">
                                {product.preco_fabricante && (
                                  <p className="font-bold text-lg whitespace-nowrap">
                                    R$ {parseFloat(product.preco_fabricante).toFixed(2)}
                                  </p>
                                )}
                                <Badge 
                                  variant={product.aprovado_produto ? "success" : "secondary"}
                                  className={product.aprovado_produto ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}
                                >
                                  {product.aprovado_produto ? "Aprovado" : "Aguardando"}
                                </Badge>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openProductDialog(selectedFabricante, product)}
                                  className="hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteProduct(product)}
                                  className="hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 mb-4">
                          Nenhum produto cadastrado ainda
                        </p>
                        <Button
                          onClick={() => openProductDialog(selectedFabricante)}
                          variant="outline"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Cadastrar Primeiro Produto
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Produto */}
        <Dialog open={showProductDialog} onOpenChange={(open) => {
          setShowProductDialog(open);
          if (!open) resetProductForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"} - {selectedFabricante?.empresa}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleProductSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome do Produto *</Label>
                  <Input
                    id="nome"
                    value={productFormData.nome}
                    onChange={(e) => setProductFormData({ ...productFormData, nome: e.target.value })}
                    required
                    placeholder="Ex: Esteira Profissional X1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="cod">Código (SKU) *</Label>
                  <Input
                    id="cod"
                    value={productFormData.cod}
                    onChange={(e) => setProductFormData({ ...productFormData, cod: e.target.value })}
                    required
                    placeholder="Ex: EST-PRO-X1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select
                    value={productFormData.categoria}
                    onValueChange={(value) => setProductFormData({ ...productFormData, categoria: value })}
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
                    value={productFormData.und}
                    onValueChange={(value) => setProductFormData({ ...productFormData, und: value })}
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
                    value={productFormData.peso}
                    onChange={(e) => setProductFormData({ ...productFormData, peso: parseFloat(e.target.value) || "" })}
                    placeholder="Ex: 85.5"
                  />
                </div>
                
                <div>
                  <Label htmlFor="dimensoes">Dimensoes (L x A x P cm)</Label>
                  <Input
                    id="dimensoes"
                    value={productFormData.dimensoes}
                    onChange={(e) => setProductFormData({ ...productFormData, dimensoes: e.target.value })}
                    placeholder="Ex: 200 x 80 x 150"
                  />
                </div>

                <div>
                  <Label htmlFor="preco_fabricante">Preco Sugerido (R$)</Label>
                  <Input
                    id="preco_fabricante"
                    type="number"
                    step="0.01"
                    value={productFormData.preco_fabricante}
                    onChange={(e) => setProductFormData({ ...productFormData, preco_fabricante: parseFloat(e.target.value) || "" })}
                    placeholder="Ex: 2999.90"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="foto">Foto do Produto</Label>
                <div className="mt-2 space-y-3">
                  {productFormData.foto && (
                    <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
                      <img src={productFormData.foto} alt="Preview" className="w-full h-full object-cover" />
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
                    value={productFormData.foto}
                    onChange={(e) => setProductFormData({ ...productFormData, foto: e.target.value })}
                    placeholder="Ou insira a URL da foto"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowProductDialog(false);
                    setShowDialog(true);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                >
                  {editingProduct ? "Salvar Alteracoes" : "Criar Produto"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Cadastro de Fabricante */}
        <Dialog open={showFabricanteDialog} onOpenChange={(open) => {
          setShowFabricanteDialog(open);
          if (!open) resetFabricanteForm();
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Editar Fabricante
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleFabricanteSubmit} className="space-y-6">
              {/* Logo Upload */}
              <div>
                <Label>Logo da Empresa</Label>
                <div className="mt-2 space-y-3">
                  {fabricanteFormData.logomarca && (
                    <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden border">
                      <img 
                        src={fabricanteFormData.logomarca} 
                        alt="Logo" 
                        className="w-full h-full object-contain p-2" 
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload de Logo
                        </>
                      )}
                    </Button>
                    <Input
                      type="url"
                      value={fabricanteFormData.logomarca}
                      onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, logomarca: e.target.value })}
                      placeholder="Ou insira a URL da logo"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Dados Básicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="empresa">Nome da Empresa *</Label>
                  <Input
                    id="empresa"
                    value={fabricanteFormData.empresa}
                    onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, empresa: e.target.value })}
                    required
                    placeholder="Ex: FitTech Equipamentos"
                  />
                </div>

                <div>
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    value={fabricanteFormData.cnpj}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const formatted = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
                      setFabricanteFormData({ ...fabricanteFormData, cnpj: formatted });
                    }}
                    required
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div>
                  <Label htmlFor="full_name">Nome do Responsavel *</Label>
                  <Input
                    id="full_name"
                    value={fabricanteFormData.full_name}
                    onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, full_name: e.target.value })}
                    required
                    placeholder="Ex: João Silva"
                  />
                </div>

                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={fabricanteFormData.email}
                    onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, email: e.target.value })}
                    required
                    placeholder="contato@empresa.com"
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={fabricanteFormData.whatsapp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const formatted = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
                      setFabricanteFormData({ ...fabricanteFormData, whatsapp: formatted });
                    }}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <Label htmlFor="site">Website</Label>
                  <Input
                    id="site"
                    type="url"
                    value={fabricanteFormData.site}
                    onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, site: e.target.value })}
                    placeholder="https://www.empresa.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="endereco">Endereco Completo</Label>
                <Input
                  id="endereco"
                  value={fabricanteFormData.endereco}
                  onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, endereco: e.target.value })}
                  placeholder="Rua, numero, bairro, cidade - UF"
                />
              </div>

              {/* História da Empresa */}
              <div>
                <Label htmlFor="historia_empresa">Historia da Empresa</Label>
                <Textarea
                  id="historia_empresa"
                  value={fabricanteFormData.historia_empresa}
                  onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, historia_empresa: e.target.value })}
                  rows={6}
                  placeholder="Descreva a historia, missao, valores e diferenciais da empresa..."
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este texto sera usado para apresentar a empresa aos clientes e fornecedores.
                </p>
              </div>

              <Separator />

              {/* Informações Comerciais */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Informações Comerciais</h4>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="formas_pagamento">Formas de Pagamento</Label>
                    <Input
                      id="formas_pagamento"
                      value={fabricanteFormData.formas_pagamento}
                      onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, formas_pagamento: e.target.value })}
                      placeholder="Ex: PIX, Boleto, Cartão (até 12x), Depósito"
                    />
                  </div>

                  <div>
                    <Label htmlFor="prazo_entrega">Prazo de Entrega</Label>
                    <Input
                      id="prazo_entrega"
                      value={fabricanteFormData.prazo_entrega}
                      onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, prazo_entrega: e.target.value })}
                      placeholder="Ex: 5-10 dias úteis após confirmação do pagamento"
                    />
                  </div>

                  <div>
                    <Label htmlFor="politica_troca">Política de Troca</Label>
                    <Textarea
                      id="politica_troca"
                      value={fabricanteFormData.politica_troca}
                      onChange={(e) => setFabricanteFormData({ ...fabricanteFormData, politica_troca: e.target.value })}
                      rows={4}
                      placeholder="Ex: Troca em até 7 dias para produtos com defeito de fabricação. Produto deve estar em embalagem original."
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Status de Aprovação */}
              <div className="flex items-center space-x-2 p-4 bg-green-50 rounded-lg border border-green-200">
                <Switch
                  checked={fabricanteFormData.aprovado}
                  onCheckedChange={(checked) => setFabricanteFormData({ ...fabricanteFormData, aprovado: checked })}
                />
                <div>
                  <Label>Aprovar Fabricante</Label>
                  <p className="text-xs text-gray-600">
                    Fabricantes aprovados podem acessar o sistema imediatamente
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowFabricanteDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  disabled={!editingFabricante}
                >
                  Salvar Alteracoes
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Visualização da Tabela */}
        <Dialog open={showTableDialog} onOpenChange={setShowTableDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between no-print">
                <DialogTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Tabela de Produtos - {selectedFabricante?.empresa || selectedFabricante?.full_name}
                </DialogTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={handlePrintTable}
                    size="sm"
                    variant="outline"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button
                    onClick={handleExportPDF}
                    size="sm"
                    variant="outline"
                    className="border-green-200 text-green-700 hover:bg-green-50"
                  >
                    <FileDown className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </div>
              <style>{`
                @media print {
                  @page { 
                    margin: 1cm; 
                    size: A4;
                  }
                  html, body { 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    height: auto !important;
                    overflow: visible !important;
                  }
                  body * { 
                    visibility: hidden; 
                  }
                  #print-area, #print-area * { 
                    visibility: visible; 
                  }
                  #print-area { 
                    position: fixed !important; 
                    left: 0 !important; 
                    top: 0 !important; 
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    transform: translateY(0) !important;
                  }
                  * { 
                    overflow: visible !important; 
                  }
                }
              `}</style>
            </DialogHeader>
            
            {selectedFabricante && (
              <div id="print-area" className="space-y-4">
                {fabricanteProducts.length > 0 ? (
                  <>
                    {/* Cabeçalho da Empresa */}
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
                      {selectedFabricante.logomarca && (
                        <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-white p-2">
                          <img
                            src={selectedFabricante.logomarca}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">
                          {selectedFabricante.empresa || selectedFabricante.full_name}
                        </h2>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {selectedFabricante.whatsapp && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {selectedFabricante.whatsapp}
                            </div>
                          )}
                          {selectedFabricante.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {selectedFabricante.email}
                            </div>
                          )}
                          {selectedFabricante.site && (
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {selectedFabricante.site}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-800">TABELA DE PRODUTOS</p>
                        <p className="text-xs text-gray-500">
                          {fabricanteProducts.length} produto(s)
                        </p>
                      </div>
                    </div>

                    {/* Tabela */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gradient-to-r from-blue-500 to-green-500 text-white">
                            <th className="border border-gray-300 px-3 py-2 text-left">Codigo</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Produto</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Categoria</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Unidade</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Peso</th>
                            <th className="border border-gray-300 px-3 py-2 text-left">Dimensoes</th>
                            <th className="border border-gray-300 px-3 py-2 text-right">Preco Sugerido</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fabricanteProducts.map((product, index) => (
                            <tr key={product.id} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                              <td className="border border-gray-300 px-3 py-2 font-mono text-xs">
                                {product.cod}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 font-medium">
                                {product.nome}
                              </td>
                              <td className="border border-gray-300 px-3 py-2">
                                {product.categoria}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-center">
                                {product.und}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-xs">
                                {product.peso ? `${product.peso} kg` : '-'}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-xs">
                                {product.dimensoes || '-'}
                              </td>
                              <td className="border border-gray-300 px-3 py-2 text-right font-bold text-green-700">
                                {product.preco_fabricante ? `R$ ${parseFloat(product.preco_fabricante).toFixed(2)}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto ativo</h3>
                    <p className="text-gray-600">Este fabricante nao possui produtos aprovados e ativos.</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
        </div>
        );
        }