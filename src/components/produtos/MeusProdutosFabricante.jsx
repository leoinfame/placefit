import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getProdutosData } from "@/functions/getProdutosData";
import {
  Loader2, Package, Search, X, ChevronDown, ChevronRight,
  Save, Tag, Weight, DollarSign, CheckCircle2, Plus, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const formatBRL = (v) => v != null && !isNaN(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const CATEGORY_ORDER = [
  "Anilhas", "Halteres", "Dumbells", "Barras Montadas",
  "Tijolinhos", "Pisos", "Kettlebells", "Suportes", "Kits", "Outros"
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

export default function MeusProdutosFabricante({ user }) {
  const [allGroups, setAllGroups] = useState([]); // ALL product groups from catalog
  const [spMap, setSpMap] = useState({}); // { productTemplateId: sp }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // all | selected | notSelected
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editValues, setEditValues] = useState({}); // { groupKey: precoKg }
  const [savingGroups, setSavingGroups] = useState(new Set());
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProdutosData({ mode: "catalogo", isFabricante: true });
      const data = res.data || res;
      const allTemplates = data.templates || [];
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

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const totalSelected = allGroups.filter(g => isGroupSelected(g)).length;
  const totalGroups = allGroups.length;

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

            {catGroups.map(g => {
              const status = getGroupStatus(g);
              const isExpanded = expandedGroups.has(g.key);
              const currentPrecoKg = getCurrentPrecoKg(g);
              const editVal = editValues[g.key];
              const hasW = hasWeights(g);
              const isSaving = savingGroups.has(g.key);
              const isSelected = status !== 'notSelected';

              return (
                <div key={g.key} className={`rounded-lg border bg-white overflow-hidden transition-all ${isSelected ? 'border-blue-200' : 'border-gray-200'}`}>
                  {/* Group header */}
                  <div className="flex items-center gap-3 p-4 flex-wrap">
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
                          {hasW && currentPrecoKg != null && ` • Preço/kg atual: ${formatBRL(currentPrecoKg)}`}
                          {hasW && currentPrecoKg == null && isSelected && ` • Sem preço definido`}
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
                          <DollarSign className="w-3 h-3" /> Preço por kg (R$)
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={currentPrecoKg != null ? currentPrecoKg.toFixed(2) : "0.00"}
                          value={editVal ?? ""}
                          onChange={(e) => handlePrecoKgChange(g.key, e.target.value)}
                          className="mt-1"
                        />
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

                  {/* Expanded: list variations */}
                  {isExpanded && (
                    <div className="border-t bg-white p-4 space-y-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Variações deste produto:</p>
                      {g.templates.map(t => {
                        const sp = spMap[t.id];
                        return (
                          <div key={t.id} className="flex items-center gap-3 bg-gray-50 rounded-lg border p-2.5 flex-wrap">
                            {t.peso_kg != null && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Weight className="w-3 h-3" /> {t.peso_kg}kg
                              </Badge>
                            )}
                            <span className="text-sm text-gray-700 truncate flex-1 min-w-[150px]">{t.nome}</span>
                            <span className="text-xs text-gray-400 font-mono">{t.cod}</span>
                            {sp ? (
                              <>
                                <Badge className="bg-green-100 text-green-700 text-xs">
                                  {formatBRL(sp.preco)}
                                </Badge>
                                {sp.disponivel === false
                                  ? <Badge variant="outline" className="text-gray-400 text-xs">Oculto</Badge>
                                  : <Badge className="bg-green-50 text-green-600 text-xs">Ativo</Badge>
                                }
                              </>
                            ) : (
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