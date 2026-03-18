import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Eye, Trash2, ShoppingCart, Package, FileText, Printer, User, Edit3, Save, Loader2, Zap } from "lucide-react";
import { generateProfessionalPDF } from "@/components/ProfessionalPDF";
import ClienteAutoComplete from "@/components/ClienteAutoComplete";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

export default function Vendas() {
  const [user, setUser] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFornecedor, setSelectedFornecedor] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [viewingPedido, setViewingPedido] = useState(null);
  const [activeTab, setActiveTab] = useState("lista");
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPedido, setEditingPedido] = useState(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Novo Pedido
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [itens, setItens] = useState([]);
  const [frete, setFrete] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const allPedidos = await base44.entities.Pedido.list();
      let pedidosData = currentUser.role === 'admin' 
        ? allPedidos.filter(p => p.tipo === 'venda')
        : allPedidos.filter(p => p.fornecedor_id === currentUser.id && p.tipo === 'venda');
      
      const [clientesData, productsData] = await Promise.all([
        currentUser.role === 'admin' 
          ? base44.entities.Cliente.filter({ ativo: true })
          : base44.entities.Cliente.filter({ fornecedor_id: currentUser.id, ativo: true }),
        base44.entities.Product.list()
      ]);

      // Calcular lucro para revendedores
      if (currentUser.role !== 'admin' && !currentUser.tipo_usuario) {
        pedidosData = pedidosData.map(pedido => {
          let lucroTotal = 0;
          pedido.itens.forEach(item => {
            const produto = productsData.find(p => p.id === item.product_id);
            if (produto && produto.preco_fabricante) {
              const precoFabricante = parseFloat(produto.preco_fabricante);
              const precoVenda = parseFloat(item.preco_unitario);
              const lucroItem = (precoVenda - precoFabricante) * item.quantidade;
              lucroTotal += lucroItem;
            }
          });
          return { ...pedido, lucro_total: lucroTotal };
        });
      }

      let myProductsList = [];

      // Se for fabricante, pegar produtos dele com preco_fabricante
      if (currentUser.tipo_usuario === 'fabricante') {
        myProductsList = productsData
          .filter(p => p.fabricante_id === currentUser.id && p.aprovado_produto === true && p.ativo !== false)
          .map(p => ({
            ...p,
            preco: p.preco_fabricante || 0
          }))
          .filter(p => p.preco > 0);
      } else {
        // Se for fornecedor, pegar produtos via SupplierProduct
        const supplierProductsData = await base44.entities.SupplierProduct.filter({ 
          supplier_id: currentUser.id, 
          disponivel: true 
        });

        myProductsList = supplierProductsData
          .map(sp => {
            const product = productsData.find(p => p.id === sp.product_id);
            if (!product) return null;
            return {
              ...product,
              preco: sp.preco || 0,
              supplier_product_id: sp.id
            };
          })
          .filter(p => p && p.preco > 0);
      }

      console.log('Produtos carregados para pedido:', myProductsList.length);

      // Buscar fornecedores para exibir nome
      if (currentUser.role === 'admin') {
        const allUsers = await base44.entities.User.list();
        const fornecedoresData = allUsers
          .filter(u => u.role === 'user' || u.tipo_usuario === 'fabricante')
          .map(u => ({ id: u.id, nome: u.empresa || u.full_name }));
        setFornecedores(fornecedoresData);
      }

      setPedidos(pedidosData.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      setClientes(clientesData);
      setMyProducts(myProductsList);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const addItem = () => {
    if (!selectedProduct || quantidade <= 0) {
      toast({
        title: "Erro",
        description: "Selecione um produto e quantidade válida.",
        variant: "destructive"
      });
      return;
    }

    const product = myProducts.find(p => p.id === selectedProduct);
    if (!product) return;

    const newItem = {
      product_id: product.id,
      cod: product.cod,
      nome: product.nome,
      quantidade: quantidade,
      preco_unitario: parseFloat(product.preco),
      subtotal: quantidade * parseFloat(product.preco)
    };

    setItens([...itens, newItem]);
    setSelectedProduct("");
    setQuantidade(1);
  };

  const removeItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const calcularTotais = () => {
    const subtotal = itens.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal + parseFloat(frete || 0) - parseFloat(desconto || 0);
    return { subtotal, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedCliente) {
      toast({
        title: "Erro",
        description: "Selecione um cliente.",
        variant: "destructive"
      });
      return;
    }

    if (itens.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um produto ao pedido.",
        variant: "destructive"
      });
      return;
    }

    try {
      const cliente = clientes.find(c => c.id === selectedCliente);
      const { subtotal, total } = calcularTotais();
      const numeroPedido = `PED-${Date.now()}`;

      // ===== PASSO 1: DATA ENRICHMENT (sem User - RLS protegido) =====
      const allProds = await base44.entities.Product.list();

      console.log(`📊 DATA ENRICHMENT: Carregados ${allProds.length} produtos`);

      // ===== PASSO 2: ENRIQUECIMENTO - Validar cada item e buscar fabricante_id se faltante =====
      const itensEnriquecidos = [];
      const mapeamentoFabricantes = {};
      const errosValidacao = [];

      itens.forEach((item, idx) => {
        console.log(`🔍 [Item ${idx + 1}] Analisando: ${item.nome} (ID: ${item.product_id})`);
        
        const produto = allProds.find(p => p.id === item.product_id);

        // Verificar se produto existe
        if (!produto) {
          console.error(`❌ [Item ${idx + 1}] Produto não encontrado: ${item.product_id}`);
          errosValidacao.push(`Item ${idx + 1}: Produto não encontrado na base (ID: ${item.product_id})`);
          return;
        }

        console.log(`✅ [Item ${idx + 1}] Produto encontrado: ${produto.nome}`);
        console.log(`   - fabricante_id no produto: ${produto.fabricante_id || 'NULO'}`);
        console.log(`   - fabricante_nome no produto: ${produto.fabricante_nome || 'NULO'}`);

        // CRÍTICO: Enriquecer fabricante_id se estiver faltando
        let fabId = produto.fabricante_id;
        
        if (!fabId || fabId.trim() === '') {
          console.warn(`⚠️  [Item ${idx + 1}] fabricante_id faltando! Tentando enriquecer...`);
          errosValidacao.push(
            `Item ${idx + 1} - "${produto.nome}": Nenhum fabricante associado no banco de dados. ` +
            `Contate o administrador para atualizar o cadastro do produto.`
          );
          return;
        }

        console.log(`✅ [Item ${idx + 1}] fabricante_id validado: ${fabId}`);

        // ✅ USAR DADOS DO PRODUTO (sem consultar User protegido)
        if (!mapeamentoFabricantes[fabId]) {
          const fabNome = produto.fabricante_nome || `Fabricante ${fabId.substring(0, 8)}`;
          console.log(`✅ [Item ${idx + 1}] Fabricante: ${fabNome} (ID: ${fabId})`);
          
          mapeamentoFabricantes[fabId] = {
            fabricante_id: fabId,
            fabricante_nome: fabNome,
            itens: []
          };
        }

        itensEnriquecidos.push({ ...item, fabricante_id: fabId });
        mapeamentoFabricantes[fabId].itens.push(item);
        console.log(`✅ [Item ${idx + 1}] Adicionado ao grupo do fabricante ${mapeamentoFabricantes[fabId].fabricante_nome}`);
      });

      // ===== PASSO 3: REJEITAR PRÉ-VENDA se houver erros =====
      if (errosValidacao.length > 0) {
        toast({
          title: "❌ Validação Falhou - Venda Não Criada",
          description: errosValidacao.join('\n\n'),
          variant: "destructive"
        });
        return; // INTERROMPE ANTES DE CRIAR A VENDA
      }

      if (Object.keys(mapeamentoFabricantes).length === 0) {
        toast({
          title: "❌ Erro de Validação",
          description: "Nenhum produto com fabricante válido encontrado.",
          variant: "destructive"
        });
        return;
      }

      // ===== PASSO 4: ATOMICITY - Criar Venda (Ponto de não retorno) =====
      const pedidoCriado = await base44.entities.Pedido.create({
        fornecedor_id: user.id,
        cliente_id: selectedCliente,
        cliente_nome: cliente.nome,
        numero_pedido: numeroPedido,
        data_pedido: new Date().toISOString().split('T')[0],
        tipo: 'venda',
        itens: itens,
        subtotal: subtotal,
        frete: parseFloat(frete || 0),
        desconto: parseFloat(desconto || 0),
        total: total,
        status: "pendente",
        observacoes: observacoes
      });

      console.log(`✅ VENDA CRIADA: ${numeroPedido} (ID: ${pedidoCriado.id})`);

      // ===== PASSO 5: CRIAR PEDIDOS DE COMPRA EM LOTE COM DEBUG ROBUSTO =====
      const resultadosPC = [];
      let pcSucesso = 0;
      let pcErro = 0;

      console.log(`\n🔄 INICIANDO CRIAÇÃO DE PEDIDOS DE COMPRA...`);
      console.log(`   Total de fabricantes únicos: ${Object.keys(mapeamentoFabricantes).length}`);

      for (const [fabId, dados] of Object.entries(mapeamentoFabricantes)) {
        console.log(`\n📦 Processando Fabricante: ${dados.fabricante_nome} (ID: ${fabId})`);
        console.log(`   Itens neste PC: ${dados.itens.length}`);

        try {
          const totalFab = dados.itens.reduce((sum, item) => sum + (item.subtotal || 0), 0);
          const numPCUnico = `PC-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

          console.log(`   📋 Montando payload de PedidoCompra...`);
          console.log(`      - revendedor_id: ${user.id}`);
          console.log(`      - revendedor_nome: ${user.empresa || user.full_name}`);
          console.log(`      - fabricante_id: ${fabId}`);
          console.log(`      - fabricante_nome: ${dados.fabricante_nome}`);
          console.log(`      - venda_id: ${pedidoCriado.id}`);
          console.log(`      - numero_pedido: ${numPCUnico}`);
          console.log(`      - total: R$ ${totalFab.toFixed(2)}`);
          console.log(`      - itens count: ${dados.itens.length}`);

          const payloadPC = {
            revendedor_id: user.id,
            revendedor_nome: user.empresa || user.full_name,
            fabricante_id: fabId,
            fabricante_nome: dados.fabricante_nome,
            venda_id: pedidoCriado.id,  // ✅ VÍNCULO CRÍTICO
            numero_pedido: numPCUnico,
            data_pedido: new Date().toISOString().split('T')[0],
            itens: dados.itens,
            total: totalFab,
            status: "pendente",
            observacoes: observacoes
          };

          console.log(`   🚀 Enviando para banco de dados...`);
          const novoPedido = await base44.entities.PedidoCompra.create(payloadPC);

          console.log(`✅ PC CRIADO COM SUCESSO!`);
          console.log(`   - ID: ${novoPedido.id}`);
          console.log(`   - Número: ${numPCUnico}`);
          console.log(`   - Vínculo venda_id: ${novoPedido.venda_id}`);
          
          resultadosPC.push({
            status: 'sucesso',
            fabricante: dados.fabricante_nome,
            pedidoId: novoPedido.id,
            numero: numPCUnico
          });
          pcSucesso++;
        } catch (err) {
          console.error(`❌ ERRO AO CRIAR PC PARA ${dados.fabricante_nome}:`);
          console.error(`   Tipo de erro: ${err?.name || 'desconhecido'}`);
          console.error(`   Mensagem: ${err?.message || 'sem mensagem'}`);
          console.error(`   Código: ${err?.code || 'sem código'}`);
          console.error(`   Status HTTP: ${err?.status || 'sem status'}`);
          console.error(`   Stack: ${err?.stack}`);
          console.error(`   Resposta completa:`, err);
          
          // Exibir erro JSON completo
          const erroJSON = JSON.stringify({
            name: err?.name,
            message: err?.message,
            code: err?.code,
            status: err?.status,
            response: err?.response,
            details: err?.details
          }, null, 2);
          
          console.error(`   JSON do erro:\n${erroJSON}`);

          alert(`⚠️ ERRO AO CRIAR PC PARA ${dados.fabricante_nome}:\n\nJSON DO ERRO:\n${erroJSON}`);
          
          resultadosPC.push({
            status: 'erro',
            fabricante: dados.fabricante_nome,
            erro: erroJSON
          });
          pcErro++;
        }
      }

      // ===== PASSO 6: RELATÓRIO FINAL =====
      const totalFabricantes = Object.keys(mapeamentoFabricantes).length;

      if (pcErro === 0 && pcSucesso === totalFabricantes) {
        // SUCESSO TOTAL
        toast({
          title: "✅ SUCESSO TOTAL",
          description: `Venda ${numeroPedido} criada com ${pcSucesso} pedido(s) de compra associado(s).`
        });
        console.log(`✅ CICLO COMPLETO: Venda + ${pcSucesso} PCs criadas com sucesso`);
      } else if (pcSucesso > 0 && pcErro > 0) {
        // SUCESSO PARCIAL
        const erroDetalhes = resultadosPC
          .filter(r => r.status === 'erro')
          .map(r => `${r.fabricante}: ${r.erro}`)
          .join('; ');
        toast({
          title: "⚠️ SUCESSO PARCIAL",
          description: `Venda criada (${numeroPedido}), mas ${pcErro} PC(s) falharam: ${erroDetalhes}`,
          variant: "destructive"
        });
        console.warn(`⚠️ SUCESSO PARCIAL: ${pcSucesso} PCs OK, ${pcErro} PCs FALHARAM`);
      } else {
        // FALHA CRÍTICA
        toast({
          title: "❌ FALHA CRÍTICA",
          description: `Venda criada (${numeroPedido}), mas NENHUM pedido de compra foi registrado. Contate o suporte.`,
          variant: "destructive"
        });
        console.error(`❌ FALHA CRÍTICA: Venda criada mas ${totalFabricantes} PC(s) não foram registradas`);
      }

      resetForm();
      setActiveTab("lista");
      await loadData();
    } catch (error) {
      console.error("❌ ERRO CRÍTICO ao criar venda:", error);
      toast({
        title: "❌ Erro Crítico",
        description: `${error?.message || 'Erro desconhecido ao criar pedido'}. Verifique o console para detalhes.`,
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setSelectedCliente("");
    setSelectedProduct("");
    setQuantidade(1);
    setItens([]);
    setFrete(0);
    setDesconto(0);
    setObservacoes("");
  };

  const handleViewPedido = (pedido) => {
    setViewingPedido(pedido);
    setShowDialog(true);
  };

  const handleDeletePedido = async (pedido) => {
    if (confirm(`Tem certeza que deseja excluir o pedido ${pedido.numero_pedido}?`)) {
      try {
        await base44.entities.Pedido.delete(pedido.id);
        loadData();
        toast({
          title: "Pedido excluído",
          description: `Pedido ${pedido.numero_pedido} foi removido.`,
        });
      } catch (error) {
        console.error("Erro ao excluir pedido:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir pedido.",
          variant: "destructive"
        });
      }
    }
  };

  const handleGerarPedidosCompra = async (pedido) => {
    try {
      console.log(`\n🚀 [handleGerarPedidosCompra] INICIANDO CICLO À PROVA DE FALHAS`);
      console.log(`   Venda ID: ${pedido.id}`);
      console.log(`   Venda número: ${pedido.numero_pedido}`);
      console.log(`   Itens na venda: ${pedido.itens.length}`);
      
      // ✅ PASSO 1: Usar APENAS dados locais (myProducts já foi carregado)
      const porFabricante = {};

      (pedido.itens || []).forEach((item, idx) => {
        // Buscar no array myProducts que já temos em memória
        const produto = myProducts.find(p => p.id === item.product_id);
        
        if (!produto) {
          console.warn(`   ⚠️ Item ${idx + 1}: Produto ${item.product_id} não em myProducts`);
          return;
        }

        const fabId = produto.fabricante_id;
        if (!fabId || fabId.trim() === '') {
          console.warn(`   ⚠️ Item ${idx + 1} (${produto.nome}): fabricante_id vazio`);
          return;
        }

        const fabNome = produto.fabricante_nome || `Fabricante ${fabId.substring(0, 8)}`;

        if (!porFabricante[fabId]) {
          porFabricante[fabId] = {
            fabricante_id: fabId,
            fabricante_nome: fabNome,
            itens: []
          };
        }
        porFabricante[fabId].itens.push(item);
        console.log(`   ✅ Item ${idx + 1}: ${produto.nome} → ${fabNome}`);
      });

      const fabricantesCount = Object.keys(porFabricante).length;
      console.log(`\n📋 ANÁLISE: ${fabricantesCount} fabricante(s) encontrado(s)`);
      
      if (fabricantesCount === 0) {
        toast({
          title: "Nenhum Fabricante",
          description: "Nenhum produto com fabricante válido encontrado nesta venda.",
          variant: "destructive"
        });
        return;
      }

      let pcSucesso = 0;
      let pcErro = 0;

      // ✅ PASSO 2: Criar Pedidos de Compra com Log Detalhado
      for (const [fabId, dados] of Object.entries(porFabricante)) {
        try {
          const totalFab = dados.itens.reduce((sum, item) => sum + (item.subtotal || 0), 0);
          
          // ✅ PASSO 3: PAYLOAD COM VERIFICAÇÃO
          const payloadPC = {
            revendedor_id: user.id,
            revendedor_nome: user.empresa || user.full_name,
            fabricante_id: fabId,
            fabricante_nome: dados.fabricante_nome,
            venda_id: pedido.id,  // ✅ COLUNA CRÍTICA: venda_id
            numero_pedido: `PC-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            data_pedido: new Date().toISOString().split('T')[0],
            itens: dados.itens,
            total: totalFab,
            status: "pendente",
            observacoes: pedido.observacoes || ""
          };

          // ✅ PASSO 4: LOG DE AUDITORIA - O QUE SERÁ ENVIADO
          console.log(`\n📤 DADOS PARA ENVIO - ${dados.fabricante_nome}:`);
          console.log(JSON.stringify(payloadPC, null, 2));

          // Criar PC
          console.log(`   → Inserindo no banco...`);
          const novoPC = await base44.entities.PedidoCompra.create(payloadPC);
          
          console.log(`✅ SUCESSO! PC ID: ${novoPC.id}, venda_id: ${novoPC.venda_id}`);
          pcSucesso++;
        } catch (err) {
          pcErro++;
          console.error(`❌ ERRO ao criar PC para ${dados.fabricante_nome}:`, err?.message);
          toast({
            title: "Erro ao criar PC",
            description: `${dados.fabricante_nome}: ${err?.message}`,
            variant: "destructive"
          });
        }
      }

      // ✅ PASSO 5: GARANTIA DE PERSISTÊNCIA - Marcar Venda como Processada
      if (pcSucesso > 0) {
        try {
          console.log(`\n🔄 CONFIRMANDO: Atualizando status da venda...`);
          await base44.entities.Pedido.update(pedido.id, {
            status: "confirmado"  // Mudar de "pendente" para "confirmado"
          });
          console.log(`✅ Venda atualizada para status "confirmado"`);
        } catch (err) {
          console.warn(`⚠️ Não foi possível atualizar status da venda:`, err?.message);
        }
      }

      // Resumo final
      console.log(`\n📊 RESUMO FINAL:`);
      console.log(`   PCs criados: ${pcSucesso}/${fabricantesCount}`);
      console.log(`   Erros: ${pcErro}`);

      if (pcSucesso > 0) {
        toast({
          title: "✅ Pedidos de Compra Criados",
          description: `${pcSucesso} PC(s) gerado(s) com sucesso. Verifique em "Pedidos de Compra".`
        });
      }

      await loadData();
    } catch (error) {
      console.error("❌ ERRO CRÍTICO:", error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao gerar pedidos de compra",
        variant: "destructive"
      });
    }
  };

  const handleEditPedido = (pedido) => {
    setEditingPedido({
      id: pedido.id,
      cliente_id: pedido.cliente_id,
      numero_pedido: pedido.numero_pedido,
      itens: pedido.itens.map(item => ({ ...item })),
      frete: pedido.frete || 0,
      desconto: pedido.desconto || 0,
      observacoes: pedido.observacoes || "",
      status: pedido.status
    });
    setShowEditDialog(true);
  };

  const updateEditItem = (index, field, value) => {
    const newItens = [...editingPedido.itens];
    if (field === 'quantidade' || field === 'preco_unitario') {
      newItens[index][field] = parseFloat(value) || 0;
      newItens[index].subtotal = newItens[index].quantidade * newItens[index].preco_unitario;
    }
    setEditingPedido({ ...editingPedido, itens: newItens });
  };

  const removeEditItem = (index) => {
    const newItens = editingPedido.itens.filter((_, i) => i !== index);
    setEditingPedido({ ...editingPedido, itens: newItens });
  };

  const handleUpdatePedido = async () => {
    if (editingPedido.itens.length === 0) {
      toast({
        title: "Erro",
        description: "O pedido deve ter pelo menos um produto.",
        variant: "destructive"
      });
      return;
    }

    setSubmittingEdit(true);
    try {
      const cliente = clientes.find(c => c.id === editingPedido.cliente_id);
      const subtotal = editingPedido.itens.reduce((sum, item) => sum + item.subtotal, 0);
      const total = subtotal + parseFloat(editingPedido.frete || 0) - parseFloat(editingPedido.desconto || 0);

      await base44.entities.Pedido.update(editingPedido.id, {
        itens: editingPedido.itens,
        subtotal,
        frete: parseFloat(editingPedido.frete || 0),
        desconto: parseFloat(editingPedido.desconto || 0),
        total,
        observacoes: editingPedido.observacoes,
        status: editingPedido.status
      });

      toast({
        title: "Pedido atualizado!",
        description: "As alterações foram salvas com sucesso.",
      });
      
      setShowEditDialog(false);
      setEditingPedido(null);
      loadData();
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar pedido.",
        variant: "destructive"
      });
    }
    setSubmittingEdit(false);
  };

  const calcPesoTotal = (itensLista) => {
    return itensLista.reduce((sum, item) => {
      const prod = myProducts.find(p => p.id === item.product_id);
      const peso = prod?.peso ? parseFloat(prod.peso) : 0;
      return sum + peso * (item.quantidade || 1);
    }, 0);
  };

  const generatePDF = async (pedido) => {
    setGeneratingPDF(true);
    try {
      await generateProfessionalPDF(pedido, user, clientes, 'venda', myProducts);
      toast({ title: "PDF gerado!", description: "Abrindo janela de impressão/PDF." });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({ title: "Erro", description: "Erro ao gerar PDF.", variant: "destructive" });
    }
    setGeneratingPDF(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      pendente: "bg-amber-100 text-amber-700",
      confirmado: "bg-blue-100 text-blue-700",
      em_separacao: "bg-purple-100 text-purple-700",
      enviado: "bg-indigo-100 text-indigo-700",
      entregue: "bg-green-100 text-green-700",
      cancelado: "bg-red-100 text-red-700"
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const filteredPedidos = pedidos.filter(pedido => {
    const matchSearch = searchTerm === "" ||
      pedido.numero_pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pedido.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchFornecedor = selectedFornecedor === "all" || pedido.fornecedor_id === selectedFornecedor;
    
    return matchSearch && matchFornecedor;
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { subtotal: currentSubtotal, total: currentTotal } = calcularTotais();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendas</h1>
            <p className="text-gray-600">Gerencie seus pedidos de venda</p>
          </div>
        </div>

        {/* Busca e Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por número ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200"
            />
          </div>
          {user?.role === 'admin' && (
            <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
              <SelectTrigger className="w-full md:w-64 bg-white/80">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Fornecedores</SelectItem>
                {fornecedores.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <ShoppingCart className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{pedidos.length}</div>
              <p className="text-sm text-blue-700">Total de Pedidos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{myProducts.length}</div>
              <p className="text-sm text-green-700">Produtos Disponíveis</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <User className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{clientes.length}</div>
              <p className="text-sm text-purple-700">Clientes Ativos</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-white/80">
            <TabsTrigger value="lista">
              <FileText className="w-4 h-4 mr-2" />
              Lista de Pedidos
            </TabsTrigger>
            <TabsTrigger value="novo">
              <Plus className="w-4 h-4 mr-2" />
              Novo Pedido
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4">
            {filteredPedidos.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhum pedido criado
                </h3>
                <p className="text-gray-600 mb-4">
                  Crie seu primeiro pedido de venda.
                </p>
                <Button onClick={() => setActiveTab("novo")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Pedido
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredPedidos.map((pedido) => (
                  <Card key={pedido.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                         <div className="flex items-center gap-3 mb-2">
                           <h3 className="font-semibold text-gray-900">{pedido.numero_pedido}</h3>
                           <Badge className={getStatusColor(pedido.status)}>
                             {pedido.status.replace('_', ' ')}
                           </Badge>
                         </div>
                         <div className="text-sm text-gray-600 space-y-1">
                           <p><strong>Cliente:</strong> {pedido.cliente_nome}</p>
                           {user?.role === 'admin' && (
                             <p><strong>Fornecedor:</strong> {fornecedores.find(f => f.id === pedido.fornecedor_id)?.nome || 'N/A'}</p>
                           )}
                           <p><strong>Data:</strong> {new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}</p>
                           <p><strong>Itens:</strong> {pedido.itens.length} produto(s)</p>
                         </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                         <div className="text-right">
                           <p className="text-2xl font-bold text-blue-600">
                             R$ {pedido.total.toFixed(2)}
                           </p>
                           {pedido.lucro_total !== undefined && (
                             <p className="text-sm font-semibold text-green-600 mt-1">
                               Lucro: R$ {pedido.lucro_total.toFixed(2)}
                             </p>
                           )}
                         </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewPedido(pedido)}
                              title="Ver detalhes"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGerarPedidosCompra(pedido)}
                              className="text-green-600 hover:bg-green-50"
                              title="Gerar pedidos de compra"
                            >
                              <Zap className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditPedido(pedido)}
                              className="text-purple-600 hover:bg-purple-50"
                              title="Editar pedido"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generatePDF(pedido)}
                              disabled={generatingPDF}
                              title="Gerar PDF"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePedido(pedido)}
                              className="text-red-600 hover:bg-red-50"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="novo">
            <Card className="bg-white/80">
              <CardHeader>
                <CardTitle>Criar Novo Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="cliente">Cliente *</Label>
                    <ClienteAutoComplete
                      clientes={clientes}
                      value={selectedCliente}
                      onSelect={setSelectedCliente}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-4">Adicionar Produtos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="produto">Produto</Label>
                        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {myProducts.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.nome} - R$ {parseFloat(product.preco).toFixed(2)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="quantidade">Quantidade</Label>
                        <div className="flex gap-2">
                          <Input
                            id="quantidade"
                            type="number"
                            min="1"
                            value={quantidade}
                            onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                          />
                          <Button type="button" onClick={addItem}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {itens.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left p-3">Produto</th>
                              <th className="text-center p-3">Qtd</th>
                              <th className="text-right p-3">Preço Unit.</th>
                              <th className="text-right p-3">Subtotal</th>
                              <th className="p-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {itens.map((item, index) => (
                              <tr key={index} className="border-t">
                                <td className="p-3">{item.nome}</td>
                                <td className="text-center p-3">{item.quantidade}</td>
                                <td className="text-right p-3">R$ {item.preco_unitario.toFixed(2)}</td>
                                <td className="text-right p-3">R$ {item.subtotal.toFixed(2)}</td>
                                <td className="p-3">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(index)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="frete">Frete (R$)</Label>
                      <Input
                        id="frete"
                        type="number"
                        step="0.01"
                        min="0"
                        value={frete}
                        onChange={(e) => setFrete(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="desconto">Desconto (R$)</Label>
                      <Input
                        id="desconto"
                        type="number"
                        step="0.01"
                        min="0"
                        value={desconto}
                        onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={3}
                      placeholder="Informações adicionais sobre o pedido"
                    />
                  </div>

                  {itens.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="space-y-2 text-right">
                        <p className="text-sm text-gray-600">
                          Subtotal: <span className="font-semibold">R$ {currentSubtotal.toFixed(2)}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Frete: <span className="font-semibold">R$ {parseFloat(frete || 0).toFixed(2)}</span>
                        </p>
                        <p className="text-sm text-gray-600">
                          Desconto: <span className="font-semibold">R$ {parseFloat(desconto || 0).toFixed(2)}</span>
                        </p>
                        <p className="text-xl font-bold text-blue-600">
                          Total: R$ {currentTotal.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                    >
                      Limpar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                      disabled={!selectedCliente || itens.length === 0}
                    >
                      Criar Pedido
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog de Edição */}
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setEditingPedido(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Pedido - {editingPedido?.numero_pedido}</DialogTitle>
            </DialogHeader>

            {editingPedido && (
              <div className="space-y-6">
                {/* Cliente (só exibição) */}
                <div>
                  <Label>Cliente</Label>
                  <p className="font-semibold text-gray-900 mt-1">
                    {clientes.find(c => c.id === editingPedido.cliente_id)?.nome || editingPedido.cliente_id}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <Label>Status do Pedido</Label>
                  <Select
                    value={editingPedido.status}
                    onValueChange={(value) => setEditingPedido({ ...editingPedido, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="confirmado">Confirmado</SelectItem>
                      <SelectItem value="em_separacao">Em Separação</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="entregue">Entregue</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Produtos */}
                <div>
                  <Label className="text-base font-semibold">Produtos do Pedido</Label>
                  {editingPedido.itens.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {editingPedido.itens.map((item, index) => (
                        <Card key={index} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                            <div className="md:col-span-2">
                              <Label className="text-xs">Produto</Label>
                              <p className="font-medium text-sm mt-1">{item.nome}</p>
                              <p className="text-xs text-gray-500">Cód: {item.cod}</p>
                            </div>
                            <div>
                              <Label className="text-xs">Quantidade</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) => updateEditItem(index, 'quantidade', e.target.value)}
                                className="h-9 mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Preço Unit. (R$)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.preco_unitario}
                                onChange={(e) => updateEditItem(index, 'preco_unitario', e.target.value)}
                                className="h-9 mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Subtotal</Label>
                              <p className="font-bold text-green-600 mt-1">
                                R$ {item.subtotal.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEditItem(index)}
                                className="text-red-600 hover:bg-red-50 w-full h-9"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mt-2">Nenhum produto no pedido</p>
                  )}
                </div>

                {/* Frete e Desconto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Frete (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingPedido.frete}
                      onChange={(e) => setEditingPedido({ ...editingPedido, frete: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Desconto (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingPedido.desconto}
                      onChange={(e) => setEditingPedido({ ...editingPedido, desconto: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={editingPedido.observacoes}
                    onChange={(e) => setEditingPedido({ ...editingPedido, observacoes: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Total */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border">
                  <div className="space-y-2 text-right">
                    <p className="text-sm text-gray-600">
                      Subtotal: <span className="font-semibold">
                        R$ {editingPedido.itens.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Frete: <span className="font-semibold text-blue-600">
                        + R$ {parseFloat(editingPedido.frete || 0).toFixed(2)}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Desconto: <span className="font-semibold text-red-600">
                        - R$ {parseFloat(editingPedido.desconto || 0).toFixed(2)}
                      </span>
                    </p>
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xl font-bold text-green-600">
                        Total: R$ {(
                          editingPedido.itens.reduce((sum, item) => sum + item.subtotal, 0) +
                          parseFloat(editingPedido.frete || 0) -
                          parseFloat(editingPedido.desconto || 0)
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                    disabled={submittingEdit}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUpdatePedido}
                    disabled={submittingEdit || editingPedido.itens.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-green-600"
                  >
                    {submittingEdit ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Visualização */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Pedido</DialogTitle>
            </DialogHeader>
            
            {viewingPedido && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Número do Pedido</p>
                    <p className="font-semibold">{viewingPedido.numero_pedido}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Data</p>
                    <p className="font-semibold">{new Date(viewingPedido.data_pedido).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Cliente</p>
                    <p className="font-semibold">{viewingPedido.cliente_nome}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Status</p>
                    <Badge className={getStatusColor(viewingPedido.status)}>
                      {viewingPedido.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Itens do Pedido</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3">Código</th>
                          <th className="text-left p-3">Produto</th>
                          <th className="text-center p-3">Qtd</th>
                          <th className="text-right p-3">Preço</th>
                          <th className="text-right p-3">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingPedido.itens.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-3">{item.cod}</td>
                            <td className="p-3">{item.nome}</td>
                            <td className="text-center p-3">{item.quantidade}</td>
                            <td className="text-right p-3">R$ {item.preco_unitario.toFixed(2)}</td>
                            <td className="text-right p-3">R$ {item.subtotal.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2 text-right">
                  <p className="text-gray-600">
                    Subtotal: <span className="font-semibold">R$ {viewingPedido.subtotal.toFixed(2)}</span>
                  </p>
                  <p className="text-gray-600">
                    Frete: <span className="font-semibold">R$ {viewingPedido.frete.toFixed(2)}</span>
                  </p>
                  <p className="text-gray-600">
                    Desconto: <span className="font-semibold">R$ {viewingPedido.desconto.toFixed(2)}</span>
                  </p>
                  <p className="text-xl font-bold text-blue-600">
                    Total: R$ {viewingPedido.total.toFixed(2)}
                  </p>
                  {viewingPedido.lucro_total !== undefined && (
                    <p className="text-lg font-bold text-green-600 pt-2 border-t">
                      Lucro: R$ {viewingPedido.lucro_total.toFixed(2)}
                    </p>
                  )}
                </div>

                {viewingPedido.observacoes && (
                  <div className="border-t pt-4">
                    <p className="text-gray-600 text-sm mb-1">Observações:</p>
                    <p className="text-sm">{viewingPedido.observacoes}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => generatePDF(viewingPedido)}
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Gerar PDF
                  </Button>
                  <Button onClick={() => setShowDialog(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}