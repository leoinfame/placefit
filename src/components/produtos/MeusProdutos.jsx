import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getProdutosData } from "@/functions/getProdutosData";
import {
  Loader2, Package, Search, X, ChevronDown, ChevronRight,
  Trash2, Download, Tag, Weight, DollarSign, Pencil, Power, PowerOff,
  RefreshCw, CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const formatBRL = (v) => v != null && !isNaN(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const CATEGORY_ORDER = [
  "Anilhas","Halteres","Dumbells","Barras Montadas",
  "Tijolinhos","Pisos","Kettlebells","Suportes","Kits","Outros"
];

const GROUP_FIELDS = [
  'categoria', 'subcategoria', 'tipo_anilha', 'tipo_furo', 'acabamento',
  'barra_tipo', 'barra_acabamento', 'bojo_formato', 'dumbell_tipo',
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

export default function MeusProdutos({ user }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selected, setSelected] = useState(new Set()); // group keys
  const [editModal, setEditModal] = useState(null); // { groupKey, margem, fabricante_nome }
  const [bulkModal, setBulkModal] = useState(null); // { type: 'margin'|'enable'|'disable'|'delete', margem }
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProdutosData({ mode: "meus" });
      const data = res.data || res;
      const allSps = data.mySupplierProducts || [];
      const allTemplates = data.templates || [];

      if (allSps.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const tmplMap = new Map(allTemplates.map(t => [t.id, t]));

      // Group SPs by base product
      const groupMap = new Map();
      for (const sp of allSps) {
        const tmpl = tmplMap.get(sp.product_id);
        if (!tmpl) continue;
        const key = getGroupKey(tmpl);
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            key,
            baseName: getBaseName(tmpl),
            categoria: tmpl.categoria,
            subcategoria: tmpl.subcategoria,
            acabamento: tmpl.acabamento,
            foto: tmpl.foto,
            und: tmpl.und,
            variations: [],
          });
        }
        groupMap.get(key).variations.push({ sp, tmpl });
      }

      // Sort variations by peso_kg
      for (const g of groupMap.values()) {
        g.variations.sort((a, b) => (a.tmpl.peso_kg || 0) - (b.tmpl.peso_kg || 0));
      }

      setGroups([...groupMap.values()]);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Erro ao carregar produtos.", variant: "destructive" });
    }
    setLoading(false);
  };

  const hasWeights = (g) => g.variations.some(v => v.tmpl.peso_kg != null);

  // Compute preço/kg for the group (using smallest weight variation with price)
  const getGroupPrecoKg = (g) => {
    const withWeights = g.variations.filter(v => v.tmpl.peso_kg && v.sp.preco);
    if (withWeights.length === 0) return null;
    const sorted = [...withWeights].sort((a, b) => a.tmpl.peso_kg - b.tmpl.peso_kg);
    return sorted[0].sp.preco / sorted[0].tmpl.peso_kg;
  };

  // Get preço/kg with margin applied
  const getGroupPrecoKgWithMargin = (g) => {
    const baseKg = getGroupPrecoKg(g);
    if (baseKg == null) return null;
    const margem = getGroupMargem(g);
    return baseKg * (1 + margem / 100);
  };

  // Get unit price (for non-weight products)
  const getGroupUnitPrice = (g) => {
    if (hasWeights(g)) return null;
    const withPrice = g.variations.find(v => v.sp.preco != null);
    return withPrice?.sp.preco ?? null;
  };

  const getGroupUnitPriceWithMargin = (g) => {
    const base = getGroupUnitPrice(g);
    if (base == null) return null;
    const margem = getGroupMargem(g);
    return base * (1 + margem / 100);
  };

  // Get margem (use first variation's margem as representative)
  const getGroupMargem = (g) => {
    return g.variations[0]?.sp.margem || 0;
  };

  const getGroupFabricante = (g) => {
    return g.variations[0]?.sp.fabricante_nome || "—";
  };

  const getGroupStatus = (g) => {
    const availableCount = g.variations.filter(v => v.sp.disponivel !== false).length;
    if (availableCount === g.variations.length) return 'published';
    if (availableCount === 0) return 'hidden';
    return 'partial';
  };

  // Filter
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      if (filterCategoria !== "all" && g.categoria !== filterCategoria) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!g.baseName.toLowerCase().includes(s) && !g.categoria.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [groups, search, filterCategoria]);

  // Group by categoria
  const byCategoria = useMemo(() => {
    const map = new Map();
    for (const g of filteredGroups) {
      if (!map.has(g.categoria)) map.set(g.categoria, []);
      map.get(g.categoria).push(g);
    }
    return sortCategories([...map.keys()]).map(cat => ({ categoria: cat, groups: map.get(cat) }));
  }, [filteredGroups]);

  const categoriasDisponiveis = useMemo(() => {
    const set = new Set(groups.map(g => g.categoria));
    return sortCategories([...set]);
  }, [groups]);

  const toggleExpand = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Selection
  const visibleKeys = filteredGroups.map(g => g.key);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(k => selected.has(k));
  const someVisibleSelected = visibleKeys.some(k => selected.has(k));

  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleKeys.forEach(k => next.delete(k));
      } else {
        visibleKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // Edit margin for a group
  const handleEditMargin = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const g = groups.find(g => g.key === editModal.groupKey);
      if (!g) return;
      const updates = g.variations.map(v => ({ id: v.sp.id, margem: editModal.margem }));
      await base44.entities.SupplierProduct.bulkUpdate(updates);
      toast({ title: "Margem atualizada!", description: `${g.baseName}: ${editModal.margem}% aplicada a ${updates.length} variações.` });
      setEditModal(null);
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao atualizar margem.", variant: "destructive" });
    }
    setSaving(false);
  };

  // Toggle publish for a group
  const handleTogglePublish = async (g, makeAvailable) => {
    try {
      const updates = g.variations.map(v => ({ id: v.sp.id, disponivel: makeAvailable }));
      await base44.entities.SupplierProduct.bulkUpdate(updates);
      toast({ title: makeAvailable ? "Publicado" : "Ocultado", description: `${g.baseName} ${makeAvailable ? 'publicado' : 'ocultado'}.` });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao atualizar.", variant: "destructive" });
    }
  };

  // Remove a group (all variations) — uses deleteMany to be resilient to already-deleted records
  const handleRemoveGroup = async (g) => {
    if (!confirm(`Remover "${g.baseName}" da sua tabela?`)) return;
    try {
      const spIds = g.variations.map(v => v.sp.id);
      await base44.entities.SupplierProduct.deleteMany({ _id: { $in: spIds } });
      toast({ title: "Produto removido", description: `${g.baseName} removido da sua tabela.` });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao remover.", variant: "destructive" });
    }
  };

  // Bulk actions
  const handleBulkConfirm = async () => {
    if (!bulkModal) return;
    const selectedGroups = groups.filter(g => selected.has(g.key));
    if (selectedGroups.length === 0) return;
    setSaving(true);
    try {
      if (bulkModal.type === 'delete') {
        const allSpIds = selectedGroups.flatMap(g => g.variations.map(v => v.sp.id));
        if (allSpIds.length > 0) {
          await base44.entities.SupplierProduct.deleteMany({ _id: { $in: allSpIds } });
        }
        toast({ title: `${selectedGroups.length} produto(s) removido(s)` });
      } else if (bulkModal.type === 'margin') {
        const updates = [];
        for (const g of selectedGroups) {
          for (const v of g.variations) {
            updates.push({ id: v.sp.id, margem: bulkModal.margem });
          }
        }
        if (updates.length > 0) await base44.entities.SupplierProduct.bulkUpdate(updates);
        toast({ title: `Margem de ${selectedGroups.length} produto(s) atualizada` });
      } else if (bulkModal.type === 'enable' || bulkModal.type === 'disable') {
        const disp = bulkModal.type === 'enable';
        const updates = [];
        for (const g of selectedGroups) {
          for (const v of g.variations) {
            updates.push({ id: v.sp.id, disponivel: disp });
          }
        }
        if (updates.length > 0) await base44.entities.SupplierProduct.bulkUpdate(updates);
        toast({ title: `${selectedGroups.length} produto(s) ${disp ? 'disponibilizado(s)' : 'indisponibilizado(s)'}` });
      }
      setBulkModal(null);
      clearSelection();
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro na ação em massa.", variant: "destructive" });
    }
    setSaving(false);
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = [["Categoria", "Produto", "Fabricante", "Preço/kg", "Margem %", "Preço Final/kg", "Status"]];
    for (const g of groups) {
      const hasW = hasWeights(g);
      const precoKg = getGroupPrecoKg(g);
      const unitPrice = getGroupUnitPrice(g);
      const margem = getGroupMargem(g);
      const finalPrice = hasW
        ? (precoKg != null ? precoKg * (1 + margem / 100) : null)
        : (unitPrice != null ? unitPrice * (1 + margem / 100) : null);
      rows.push([
        g.categoria,
        g.baseName,
        getGroupFabricante(g),
        hasW ? (precoKg != null ? precoKg.toFixed(2) : "") : (unitPrice != null ? unitPrice.toFixed(2) : ""),
        margem.toString(),
        finalPrice != null ? finalPrice.toFixed(2) : "",
        getGroupStatus(g),
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "minha-tabela-precos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const totalProducts = groups.length;
  const totalPublished = groups.filter(g => getGroupStatus(g) === 'published').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
            {totalProducts} {totalProducts === 1 ? "produto" : "produtos"} na sua tabela
          </Badge>
          <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
            {totalPublished} publicado(s)
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
          <Button onClick={handleExportCSV} variant="outline" size="sm" disabled={totalProducts === 0}>
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Você ainda não adicionou produtos à sua tabela.</p>
          <p className="text-sm">Acesse o <strong>Catálogo Geral</strong> para adicionar produtos.</p>
        </div>
      ) : (
        <>
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
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categoriasDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {(search || filterCategoria !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterCategoria("all"); }} className="text-gray-500">
                  <X className="w-4 h-4 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">{selected.size} selecionado(s)</span>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="text-blue-600">
                  <X className="w-4 h-4 mr-1" /> Limpar
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setBulkModal({ type: 'margin', margem: 0 })} className="border-blue-300 text-blue-700 hover:bg-blue-100">
                  <Pencil className="w-4 h-4 mr-1" /> Definir Margem
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkModal({ type: 'enable' })} className="border-green-300 text-green-700 hover:bg-green-50">
                  <Power className="w-4 h-4 mr-1" /> Publicar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkModal({ type: 'disable' })} className="border-gray-300 text-gray-600 hover:bg-gray-50">
                  <PowerOff className="w-4 h-4 mr-1" /> Ocultar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setBulkModal({ type: 'delete' })}>
                  <Trash2 className="w-4 h-4 mr-1" /> Remover
                </Button>
              </div>
            </div>
          )}

          {/* Select all */}
          {filteredGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-xs text-gray-500">Selecionar todos os {filteredGroups.length} produtos</span>
            </div>
          )}

          {/* Cards grouped by category */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catGroups.map(g => {
                    const status = getGroupStatus(g);
                    const isExpanded = expandedGroups.has(g.key);
                    const hasW = hasWeights(g);
                    const precoKg = getGroupPrecoKg(g);
                    const precoKgWithMargin = getGroupPrecoKgWithMargin(g);
                    const unitPrice = getGroupUnitPrice(g);
                    const unitPriceWithMargin = getGroupUnitPriceWithMargin(g);
                    const margem = getGroupMargem(g);
                    const isSelected = selected.has(g.key);

                    return (
                      <div key={g.key} className={`rounded-lg border bg-white overflow-hidden transition-all ${isSelected ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}>
                        {/* Card header */}
                        <div className="flex items-start gap-3 p-3">
                          <div className="pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(g.key)}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              {g.foto ? (
                                <img src={g.foto} alt={g.baseName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-5 h-5 text-gray-300" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-gray-900 leading-tight">{g.baseName}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {g.subcategoria && <Badge variant="outline" className="text-xs">{g.subcategoria}</Badge>}
                                  {g.acabamento && <Badge variant="outline" className="text-xs">{g.acabamento}</Badge>}
                                  {g.variations.length > 1 && (
                                    <Badge variant="outline" className="text-xs gap-0.5">
                                      <Weight className="w-3 h-3" />{g.variations.length} variações
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Price display */}
                        <div className="px-3 pb-2">
                          <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-xs font-medium text-gray-600">
                                {hasW ? "Preço por kg" : "Preço unitário"}
                              </span>
                              {status === 'published' && (
                                <Badge className="bg-green-100 text-green-700 text-xs ml-auto">Publicado</Badge>
                              )}
                              {status === 'partial' && (
                                <Badge className="bg-yellow-100 text-yellow-700 text-xs ml-auto">Parcial</Badge>
                              )}
                              {status === 'hidden' && (
                                <Badge variant="outline" className="text-gray-400 text-xs ml-auto">Oculto</Badge>
                              )}
                            </div>

                            {hasW ? (
                              <>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Preço de fábrica:</span>
                                  <span className="font-semibold text-gray-700">
                                    {formatBRL(precoKg)}<span className="text-gray-400 font-normal">/kg</span>
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Margem: {margem}%</span>
                                  <span className="font-bold text-green-600">
                                    {formatBRL(precoKgWithMargin)}<span className="text-gray-400 font-normal">/kg</span>
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Preço de fábrica:</span>
                                  <span className="font-semibold text-gray-700">{formatBRL(unitPrice)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Margem: {margem}%</span>
                                  <span className="font-bold text-green-600">{formatBRL(unitPriceWithMargin)}</span>
                                </div>
                              </>
                            )}

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200">
                              <span className="text-gray-500">Fabricante:</span>
                              <span className="text-gray-700 truncate ml-1">{getGroupFabricante(g)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Card footer */}
                        <div className="border-t px-3 py-2 flex items-center justify-between gap-1 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditModal({ groupKey: g.key, margem, baseName: g.baseName })}
                            className="h-7 text-xs"
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Margem
                          </Button>
                          <div className="flex items-center gap-1">
                            {status !== 'published' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTogglePublish(g, true)}
                                className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                              >
                                <Power className="w-3 h-3 mr-1" /> Publicar
                              </Button>
                            )}
                            {status !== 'hidden' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTogglePublish(g, false)}
                                className="h-7 text-xs border-gray-300 text-gray-600 hover:bg-gray-50"
                              >
                                <PowerOff className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveGroup(g)}
                              className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Expanded: list variations */}
                        {isExpanded && (
                          <div className="border-t bg-white p-3 space-y-1.5">
                            <p className="text-xs font-medium text-gray-500 mb-1">Variações:</p>
                            {g.variations.map(v => {
                              const precoFinal = (v.sp.preco || 0) * (1 + (v.sp.margem || 0) / 100);
                              return (
                                <div key={v.sp.id} className="flex items-center gap-2 bg-gray-50 rounded-lg border p-2 flex-wrap text-xs">
                                  {v.tmpl.peso_kg != null && (
                                    <Badge variant="outline" className="text-xs gap-0.5">
                                      <Weight className="w-3 h-3" />{v.tmpl.peso_kg}kg
                                    </Badge>
                                  )}
                                  <span className="text-gray-600 truncate flex-1 min-w-[100px]">{v.tmpl.cod}</span>
                                  <span className="text-gray-500">{formatBRL(v.sp.preco)}</span>
                                  <span className="font-semibold text-green-600">{formatBRL(precoFinal)}</span>
                                  {v.sp.disponivel === false && <Badge variant="outline" className="text-gray-400 text-xs">Oculto</Badge>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Modal Editar Margem */}
      {editModal && (
        <Dialog open onOpenChange={() => setEditModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" /> Editar Margem
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-sm">{editModal.baseName}</p>
                <p className="text-xs text-gray-500">Margem atual aplicada a todas as variações</p>
              </div>
              <div>
                <Label>Margem (%)</Label>
                <Input
                  type="number"
                  value={editModal.margem || 0}
                  onChange={(e) => setEditModal(m => ({ ...m, margem: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditModal(null)}>Cancelar</Button>
                <Button onClick={handleEditMargin} disabled={saving} className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Ação em Massa */}
      {bulkModal && (
        <Dialog open onOpenChange={() => setBulkModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {bulkModal.type === 'delete' && <><Trash2 className="w-5 h-5 text-red-600" /> Remover Produtos</>}
                {bulkModal.type === 'margin' && <><Pencil className="w-5 h-5 text-blue-600" /> Definir Margem</>}
                {bulkModal.type === 'enable' && <><Power className="w-5 h-5 text-green-600" /> Publicar</>}
                {bulkModal.type === 'disable' && <><PowerOff className="w-5 h-5 text-gray-600" /> Ocultar</>}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600">
                {bulkModal.type === 'delete'
                  ? `Remover ${selected.size} produto(s) da sua tabela? Esta ação não pode ser desfeita.`
                  : bulkModal.type === 'margin'
                    ? `Definir a margem para ${selected.size} produto(s) selecionado(s):`
                    : `Confirma ${bulkModal.type === 'enable' ? 'publicar' : 'ocultar'} ${selected.size} produto(s)?`
                }
              </p>
              {bulkModal.type === 'margin' && (
                <div>
                  <Label>Margem (%)</Label>
                  <Input
                    type="number"
                    value={bulkModal.margem}
                    onChange={(e) => setBulkModal(m => ({ ...m, margem: parseFloat(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setBulkModal(null)}>Cancelar</Button>
                <Button
                  variant={bulkModal.type === 'delete' ? 'destructive' : 'default'}
                  onClick={handleBulkConfirm}
                  disabled={saving}
                  className={bulkModal.type !== 'delete' ? "bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700" : ""}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}