import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getProdutosData } from "@/functions/getProdutosData";
import {
  Loader2, Package, Search, X, ChevronDown, ChevronRight,
  Save, Tag, Weight, DollarSign, CheckCircle2, Plus, RefreshCw,
  Trash2, Eye, EyeOff, CheckSquare, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { expandTemplates } from "@/utils/expandTemplates";

const formatBRL = (v) => v != null && !isNaN(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const CATEGORY_ORDER = [
  "Anilhas", "Halteres", "Dumbells", "Barras Montadas",
  "Tijolinhos", "Pisos", "Kettlebells", "Suportes", "Kits", "Outros"
];

const GROUP_FIELDS = [
  'categoria', 'subcategoria', 'tipo_anilha', 'tipo_furo', 'acabamento',
  'barra_formato', 'barra_acabamento', 'presilha_tipo', 'comprimento_m',
  'barra_rolamento', 'bojo_formato', 'dumbell_tipo',
  'piso_espessura_mm', 'piso_formato', 'tijolinho_tipo', 'tijolinho_torre',
  'suporte_modelo', 'suporte_estrutura', 'suporte_degraus',
  'suporte_capacidade_pares', 'suporte_capacidade_unidades',
  'suporte_torre_capacidade', 'suporte_torre_tipo',
  'pegada', 'peso_faixa'
];

const getGroupKey = (tmpl) => GROUP_FIELDS.map(f => tmpl[f] ?? '').join('|');

const getBaseName = (tmpl) => {
  return (tmpl.nome || '').replace(/\s+\d+([.,]\d+)?\s*kg$/i, '').trim();
};

const sortCategories = (cats) => {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
};

export default function MeusProdutosFabricante({ user }) {
  const [allGroups, setAllGroups] = useState([]); // ALL product groups from catalog
  const [spMap, setSpMap] = useState({}); // { productTemplateId: sp }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // all | selected | notSelected
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editValues, setEditValues] = useState({}); // { groupKey: precoKg }
  const [editValuesByTemplate, setEditValuesByTemplate] = useState({}); // { templateId: preco }
  const [savingGroups, setSavingGroups] = useState(new Set());
  const [savingTemplates, setSavingTemplates] = useState(new Set());
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [bulkPrecoKg, setBulkPrecoKg] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProdutosData({ mode: "catalogo", isFabricante: true });
      const data = res.data || res;
      const allTemplates = expandTemplates(data.templates || [], data.fieldMap);
      const allSps = data.mySupplierProducts || [];

      // Map SPs by product_id
      const spByProduct = {};
      for (const sp of allSps) {
        spByProduct[sp.product_id] = sp;
      }
      setSpMap(spByProduct);

      // Group ALL templates by base product
      const groupMap = new Map();
      for (const tmpl of allTemplates) {
        const key = getGroupKey(tmpl);
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            key,
            baseName: getBaseName(tmpl),
            categoria: tmpl.categoria,
            templates: [],
          });
        }
        groupMap.get(key).templates.push(tmpl);
      }

      // Sort templates by peso_kg within each group
      for (const g of groupMap.values()) {
        g.templates.sort((a, b) => (a.peso_kg || 0) - (b.peso_kg || 0));
      }

      setAllGroups([...groupMap.values()]);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Erro ao carregar produtos.", variant: "destructive" });
    }
    setLoading(false);
  };

  // Check if a group is selected (has SPs for all templates)
  const isGroupSelected = (g) => {
    return g.templates.every(t => spMap[t.id]);
  };

  const isGroupPartiallySelected = (g) => {
    return g.templates.some(t => spMap[t.id]) && !isGroupSelected(g);
  };

  const hasWeights = (g) => g.templates.some(t => t.peso_kg != null);

  const getCurrentPrecoKg = (g) => {
    const withWeights = g.templates.filter(t => t.peso_kg && spMap[t.id]?.preco);
    if (withWeights.length === 0) return null;
    const sorted = [...withWeights].sort((a, b) => a.peso_kg - b.peso_kg);
    return spMap[sorted[0].id].preco / sorted[0].peso_kg;
  };

  // Faixa de preços reais do grupo (mostra os preços efetivamente cadastrados, não preço/kg)
  const getPriceRange = (g) => {
    const priced = g.templates
      .map(t => spMap[t.id]?.preco)
      .filter(p => p != null && !isNaN(p));
    if (priced.length === 0) return null;
    const min = Math.min(...priced);
    const max = Math.max(...priced);
    if (min === max) return formatBRL(min);
    return `${formatBRL(min)} – ${formatBRL(max)}`;
  };

  const handleTemplatePrecoChange = (templateId, value) => {
    setEditValuesByTemplate(prev => ({ ...prev, [templateId]: value }));
  };

  const handleSaveTemplatePreco = async (t) => {
    const val = editValuesByTemplate[t.id];
    if (val == null || val === "" || isNaN(val)) {
      toast({ title: "Erro", description: "Informe um preço válido.", variant: "destructive" });
      return;
    }
    const preco = parseFloat(val);
    setSavingTemplates(prev => new Set(prev).add(t.id));
    try {
      const existing = spMap[t.id];
      if (existing) {
        await base44.entities.SupplierProduct.update(existing.id, { preco, disponivel: true });
      } else {
        await base44.entities.SupplierProduct.create({
          supplier_id: user.id,
          product_id: t.id,
          preco,
          fabricante_nome: user.empresa || user.full_name,
          disponivel: true,
        });
      }
      toast({ title: "Preço atualizado!", description: `${t.cod || t.nome}: ${formatBRL(preco)}` });
      setEditValuesByTemplate(prev => { const n = { ...prev }; delete n[t.id]; return n; });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao salvar.", variant: "destructive" });
    }
    setSavingTemplates(prev => { const n = new Set(prev); n.delete(t.id); return n; });
  };

  const getGroupStatus = (g) => {
    if (isGroupSelected(g)) {
      const allAvailable = g.templates.every(t => spMap[t.id]?.disponivel !== false);
      if (allAvailable) return 'published';
      const anyAvailable = g.templates.some(t => spMap[t.id]?.disponivel !== false);
      if (anyAvailable) return 'partial';
      return 'hidden';
    }
    if (isGroupPartiallySelected(g)) return 'partial';
    return 'notSelected';
  };

  // Filter
  const filteredGroups = useMemo(() => {
    return allGroups.filter(g => {
      if (filterCategoria !== "all" && g.categoria !== filterCategoria) return false;
      const status = getGroupStatus(g);
      if (filterStatus === "selected" && status === 'notSelected') return false;
      if (filterStatus === "notSelected" && status !== 'notSelected') return false;
      if (search) {
        const s = search.toLowerCase();
        if (!g.baseName.toLowerCase().includes(s) && !g.categoria.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGroups, spMap, search, filterCategoria, filterStatus]);

  // Group by categoria for display
  const byCategoria = useMemo(() => {
    const map = new Map();
    for (const g of filteredGroups) {
      if (!map.has(g.categoria)) map.set(g.categoria, []);
      map.get(g.categoria).push(g);
    }
    return sortCategories([...map.keys()]).map(cat => ({ categoria: cat, groups: map.get(cat) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGroups]);

  const categoriasDisponiveis = useMemo(() => {
    const set = new Set(allGroups.map(g => g.categoria));
    return sortCategories([...set]);
  }, [allGroups]);

  const toggleExpand = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handlePrecoKgChange = (groupKey, value) => {
    setEditValues(prev => ({ ...prev, [groupKey]: value }));
  };

  // Save: create or update SPs for all weight variations based on preço/kg
  const handleSaveGroup = async (g) => {
    const precoKgStr = editValues[g.key];
    if (precoKgStr == null || precoKgStr === "" || isNaN(precoKgStr)) {
      toast({ title: "Erro", description: "Informe um preço por kg válido.", variant: "destructive" });
      return;
    }

    const precoKg = parseFloat(precoKgStr);
    const weightTemplates = g.templates.filter(t => t.peso_kg != null);
    const nonWeightTemplates = g.templates.filter(t => t.peso_kg == null);

    if (weightTemplates.length === 0 && nonWeightTemplates.length === 0) {
      toast({ title: "Aviso", description: "Este produto não tem variações." });
      return;
    }

    setSavingGroups(prev => new Set(prev).add(g.key));

    try {
      const toCreate = [];
      const toUpdate = [];

      // Weight-based: calculate from precoKg
      for (const tmpl of weightTemplates) {
        const preco = Math.round(precoKg * tmpl.peso_kg * 100) / 100;
        const existing = spMap[tmpl.id];
        if (existing) {
          toUpdate.push({ id: existing.id, preco, disponivel: true });
        } else {
          toCreate.push({
            supplier_id: user.id,
            product_id: tmpl.id,
            preco,
            fabricante_nome: user.empresa || user.full_name,
            disponivel: true,
          });
        }
      }

      // Non-weight templates: use precoKg as direct price (for products like Suportes, Kits without weight)
      for (const tmpl of nonWeightTemplates) {
        const existing = spMap[tmpl.id];
        if (existing) {
          toUpdate.push({ id: existing.id, preco: precoKg, disponivel: true });
        } else {
          toCreate.push({
            supplier_id: user.id,
            product_id: tmpl.id,
            preco: precoKg,
            fabricante_nome: user.empresa || user.full_name,
            disponivel: true,
          });
        }
      }

      if (toCreate.length > 0) {
        await base44.entities.SupplierProduct.bulkCreate(toCreate);
      }
      if (toUpdate.length > 0) {
        await base44.entities.SupplierProduct.bulkUpdate(toUpdate);
      }

      toast({
        title: "Preço salvo e produto publicado!",
        description: `${toCreate.length} criada(s), ${toUpdate.length} atualizada(s).`,
      });
      setEditValues(prev => { const n = { ...prev }; delete n[g.key]; return n; });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao salvar.", variant: "destructive" });
    }
    setSavingGroups(prev => { const n = new Set(prev); n.delete(g.key); return n; });
  };

  // Toggle visibility (publish/hide) for an already-selected group
  const handleTogglePublish = async (g, makeAvailable) => {
    setSavingGroups(prev => new Set(prev).add(g.key));
    try {
      const updates = g.templates
        .filter(t => spMap[t.id])
        .map(t => ({ id: spMap[t.id].id, disponivel: makeAvailable }));
      if (updates.length > 0) {
        await base44.entities.SupplierProduct.bulkUpdate(updates);
      }
      toast({ title: makeAvailable ? "Publicado" : "Ocultado", description: `${g.baseName} ${makeAvailable ? 'publicado' : 'ocultado'}.` });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao atualizar.", variant: "destructive" });
    }
    setSavingGroups(prev => { const n = new Set(prev); n.delete(g.key); return n; });
  };

  // Remove all SPs for a group
  const handleRemoveGroup = async (g) => {
    if (!confirm(`Remover "${g.baseName}" da sua tabela de preços?`)) return;
    setSavingGroups(prev => new Set(prev).add(g.key));
    try {
      const sps = g.templates.filter(t => spMap[t.id]).map(t => spMap[t.id].id);
      for (const spId of sps) {
        await base44.entities.SupplierProduct.delete(spId);
      }
      toast({ title: "Produto removido", description: `${g.baseName} removido da sua tabela.` });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao remover.", variant: "destructive" });
    }
    setSavingGroups(prev => { const n = new Set(prev); n.delete(g.key); return n; });
  };

  const toggleGroupSelection = (key) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allKeys = filteredGroups.map(g => g.key);
    const allSelected = allKeys.every(k => selectedGroups.has(k));
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allKeys.forEach(k => next.delete(k));
      } else {
        allKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const getSelectedGroups = () => filteredGroups.filter(g => selectedGroups.has(g.key));

  const handleBulkPublish = async (makeAvailable) => {
    const groups = getSelectedGroups();
    if (groups.length === 0) return;
    setBulkLoading(true);
    try {
      const updates = [];
      for (const g of groups) {
        for (const t of g.templates) {
          if (spMap[t.id]) {
            updates.push({ id: spMap[t.id].id, disponivel: makeAvailable });
          }
        }
      }
      if (updates.length > 0) {
        await base44.entities.SupplierProduct.bulkUpdate(updates);
      }
      toast({
        title: makeAvailable ? "Produtos publicados" : "Produtos ocultados",
        description: `${groups.length} produto(s) ${makeAvailable ? 'publicado(s)' : 'ocultado(s)'}.`,
      });
      setSelectedGroups(new Set());
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao atualizar.", variant: "destructive" });
    }
    setBulkLoading(false);
  };

  const handleBulkRemove = async () => {
    const groups = getSelectedGroups();
    if (groups.length === 0) return;
    if (!confirm(`Remover ${groups.length} produto(s) da sua tabela de preços?`)) return;
    setBulkLoading(true);
    try {
      const spIds = [];
      for (const g of groups) {
        for (const t of g.templates) {
          if (spMap[t.id]) spIds.push(spMap[t.id].id);
        }
      }
      for (const spId of spIds) {
        await base44.entities.SupplierProduct.delete(spId);
      }
      toast({ title: "Produtos removidos", description: `${groups.length} produto(s) removido(s).` });
      setSelectedGroups(new Set());
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao remover.", variant: "destructive" });
    }
    setBulkLoading(false);
  };

  const handleBulkUpdatePreco = async () => {
    const groups = getSelectedGroups();
    if (groups.length === 0) return;
    if (!bulkPrecoKg || isNaN(bulkPrecoKg)) {
      toast({ title: "Erro", description: "Informe um preço por kg válido.", variant: "destructive" });
      return;
    }
    setBulkLoading(true);
    try {
      const precoKg = parseFloat(bulkPrecoKg);
      const toCreate = [];
      const toUpdate = [];
      for (const g of groups) {
        const weightTemplates = g.templates.filter(t => t.peso_kg != null);
        const nonWeightTemplates = g.templates.filter(t => t.peso_kg == null);
        for (const tmpl of weightTemplates) {
          const preco = Math.round(precoKg * tmpl.peso_kg * 100) / 100;
          const existing = spMap[tmpl.id];
          if (existing) {
            toUpdate.push({ id: existing.id, preco, disponivel: true });
          } else {
            toCreate.push({
              supplier_id: user.id,
              product_id: tmpl.id,
              preco,
              fabricante_nome: user.empresa || user.full_name,
              disponivel: true,
            });
          }
        }
        for (const tmpl of nonWeightTemplates) {
          const existing = spMap[tmpl.id];
          if (existing) {
            toUpdate.push({ id: existing.id, preco: precoKg, disponivel: true });
          } else {
            toCreate.push({
              supplier_id: user.id,
              product_id: tmpl.id,
              preco: precoKg,
              fabricante_nome: user.empresa || user.full_name,
              disponivel: true,
            });
          }
        }
      }
      if (toCreate.length > 0) {
        await base44.entities.SupplierProduct.bulkCreate(toCreate);
      }
      if (toUpdate.length > 0) {
        await base44.entities.SupplierProduct.bulkUpdate(toUpdate);
      }
      toast({
        title: "Preços atualizados!",
        description: `${groups.length} produto(s) • ${toCreate.length} criada(s), ${toUpdate.length} atualizada(s).`,
      });
      setSelectedGroups(new Set());
      setBulkPrecoKg("");
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao salvar.", variant: "destructive" });
    }
    setBulkLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const totalSelected = allGroups.filter(g => isGroupSelected(g)).length;
  const totalGroups = allGroups.length;
  const selectedCount = selectedGroups.size;
  const allFilteredKeys = filteredGroups.map(g => g.key);
  const allFilteredSelected = allFilteredKeys.length > 0 && allFilteredKeys.every(k => selectedGroups.has(k));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
            {totalSelected} de {totalGroups} produtos selecionados
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categoriasDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="selected">Selecionados</SelectItem>
              <SelectItem value="notSelected">Não selecionados</SelectItem>
            </SelectContent>
          </Select>
          {(search || filterCategoria !== "all" || filterStatus !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterCategoria("all"); setFilterStatus("all"); }} className="text-gray-500">
              <X className="w-4 h-4 mr-1" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-10 rounded-lg border-2 border-blue-300 bg-white shadow-md p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">{selectedCount} produto(s) selecionado(s)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedGroups(new Set())} className="text-gray-500">
              <X className="w-4 h-4 mr-1" /> Limpar seleção
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkPublish(true)}
              disabled={bulkLoading}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              <Eye className="w-4 h-4 mr-1" /> Publicar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkPublish(false)}
              disabled={bulkLoading}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              <EyeOff className="w-4 h-4 mr-1" /> Ocultar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkRemove}
              disabled={bulkLoading}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Remover
            </Button>
            <div className="h-6 w-px bg-gray-200 mx-1" />
            <div className="flex items-end gap-2 flex-1 min-w-[200px]">
              <div className="flex-1">
                <Label className="text-xs text-gray-600">Preço/kg em massa (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={bulkPrecoKg}
                  onChange={(e) => setBulkPrecoKg(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <Button
                size="sm"
                onClick={handleBulkUpdatePreco}
                disabled={bulkLoading || !bulkPrecoKg}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              >
                {bulkLoading
                  ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  : <RefreshCw className="w-4 h-4 mr-1" />
                }
                Atualizar Preços
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Products grouped by category */}
      {byCategoria.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Nenhum produto encontrado com os filtros aplicados.</p>
        </div>
      ) : (
        byCategoria.map(({ categoria, groups: catGroups }) => (
          <div key={categoria} className="space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <Tag className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-900">{categoria}</h3>
              <Badge variant="outline" className="text-xs">{catGroups.length} {catGroups.length === 1 ? "produto" : "produtos"}</Badge>
            </div>

            {/* Select All checkbox */}
            {byCategoria.length > 0 && categoria === byCategoria[0].categoria && (
              <div className="flex items-center gap-2 px-1 py-1">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <button onClick={toggleSelectAll} className="text-sm text-gray-600 hover:text-gray-900">
                  {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              </div>
            )}

            {catGroups.map(g => {
              const status = getGroupStatus(g);
              const isExpanded = expandedGroups.has(g.key);
              const currentPrecoKg = getCurrentPrecoKg(g);
              const priceRange = getPriceRange(g);
              const editVal = editValues[g.key];
              const hasW = hasWeights(g);
              const isSaving = savingGroups.has(g.key);
              const isSelected = status !== 'notSelected';

              return (
                <div key={g.key} className={`rounded-lg border bg-white overflow-hidden transition-all ${isSelected ? 'border-blue-200' : 'border-gray-200'}`}>
                  {/* Group header */}
                  <div className="flex items-center gap-3 p-4 flex-wrap">
                    <Checkbox
                      checked={selectedGroups.has(g.key)}
                      onCheckedChange={() => toggleGroupSelection(g.key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={() => toggleExpand(g.key)}
                      className="flex items-center gap-2 flex-1 text-left min-w-0"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        : <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{g.baseName}</p>
                        <p className="text-xs text-gray-500">
                          {g.templates.length} {g.templates.length === 1 ? "variação" : "variações"}
                          {isSelected && priceRange != null && ` • ${priceRange}`}
                          {isSelected && priceRange == null && ` • Sem preço definido`}
                          {!isSelected && ` • Não selecionado`}
                        </p>
                      </div>
                    </button>

                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                      {status === 'published' && (
                        <Badge className="bg-green-100 text-green-700 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Publicado
                        </Badge>
                      )}
                      {status === 'partial' && (
                        <Badge className="bg-yellow-100 text-yellow-700 gap-1">
                          Parcial
                        </Badge>
                      )}
                      {status === 'hidden' && (
                        <Badge variant="outline" className="text-gray-400 gap-1">
                          Oculto
                        </Badge>
                      )}
                      {status === 'notSelected' && (
                        <Badge variant="outline" className="text-gray-400 gap-1">
                          Não selecionado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Price/kg input — always visible on each card */}
                  <div className="border-t bg-gray-50/50 px-4 py-3">
                    <div className="flex items-end gap-2 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <Label className="text-xs text-gray-600 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {hasW ? "Preço por kg (R$) — aplica a todas as variações" : "Preço unitário (R$)"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={currentPrecoKg != null ? currentPrecoKg.toFixed(2) : "0.00"}
                          value={editVal ?? ""}
                          onChange={(e) => handlePrecoKgChange(g.key, e.target.value)}
                          className="mt-1"
                        />
                        {hasW && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            Aplica preço linear (preço/kg × peso) a todas as variações. Para preços individuais, expanda e edite cada variação.
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => handleSaveGroup(g)}
                        disabled={isSaving || editVal == null || editVal === ""}
                        className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                      >
                        {isSaving
                          ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          : isSelected
                            ? <RefreshCw className="w-4 h-4 mr-2" />
                            : <Plus className="w-4 h-4 mr-2" />
                        }
                        {isSelected ? "Atualizar" : "Selecionar & Salvar"}
                      </Button>

                      {isSelected && (
                        <>
                          {status !== 'published' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTogglePublish(g, true)}
                              disabled={isSaving}
                              className="border-green-300 text-green-700 hover:bg-green-50"
                            >
                              Publicar
                            </Button>
                          )}
                          {status === 'published' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTogglePublish(g, false)}
                              disabled={isSaving}
                              className="border-gray-300 text-gray-600 hover:bg-gray-50"
                            >
                              Ocultar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveGroup(g)}
                            disabled={isSaving}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            Remover
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Preview of calculated prices */}
                    {editVal && !isNaN(editVal) && (
                      <div className="mt-2 text-xs text-gray-600">
                        <p className="font-medium mb-1">Prévia dos preços:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {g.templates.filter(t => t.peso_kg != null).slice(0, 8).map(t => (
                            <Badge key={t.id} variant="outline" className="text-xs gap-1">
                              <Weight className="w-3 h-3" />
                              {t.peso_kg}kg → {formatBRL(parseFloat(editVal) * t.peso_kg)}
                            </Badge>
                          ))}
                          {g.templates.filter(t => t.peso_kg != null).length > 8 && (
                            <Badge variant="outline" className="text-xs">
                              +{g.templates.filter(t => t.peso_kg != null).length - 8} mais
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded: list variations with individual price editing */}
                  {isExpanded && (
                    <div className="border-t bg-white p-4 space-y-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Variações — edite o preço individual de cada uma:</p>
                      {g.templates.map(t => {
                        const sp = spMap[t.id];
                        const tplEditVal = editValuesByTemplate[t.id];
                        const tplSaving = savingTemplates.has(t.id);
                        return (
                          <div key={t.id} className="flex items-center gap-3 bg-gray-50 rounded-lg border p-2.5 flex-wrap">
                            {t.peso_kg != null && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Weight className="w-3 h-3" /> {t.peso_kg}kg
                              </Badge>
                            )}
                            <span className="text-sm text-gray-700 truncate flex-1 min-w-[120px]">{t.nome}</span>
                            <span className="text-xs text-gray-400 font-mono">{t.cod}</span>
                            {sp && (
                              <span className="text-xs text-gray-500">
                                Atual: <strong className="text-gray-700">{formatBRL(sp.preco)}</strong>
                                {sp.disponivel === false && <Badge variant="outline" className="text-gray-400 text-xs ml-1">Oculto</Badge>}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={sp ? sp.preco.toFixed(2) : "0.00"}
                                value={tplEditVal ?? ""}
                                onChange={(e) => handleTemplatePrecoChange(t.id, e.target.value)}
                                className="h-8 w-24 text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveTemplatePreco(t)}
                                disabled={tplSaving || tplEditVal == null || tplEditVal === ""}
                                className="h-8"
                              >
                                {tplSaving
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Save className="w-3.5 h-3.5" />
                                }
                              </Button>
                            </div>
                            {!sp && (
                              <Badge variant="outline" className="text-gray-400 text-xs">Sem preço</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}