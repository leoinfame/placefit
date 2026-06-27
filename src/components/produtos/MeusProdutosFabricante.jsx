import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Loader2, Package, Search, X, ChevronDown, ChevronRight,
  Power, PowerOff, Save, Tag, Weight, DollarSign, CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  // Remove weight suffix from name (e.g., "Anilha Vazada Injetado 10kg" → "Anilha Vazada Injetado")
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
  const [groups, setGroups] = useState([]); // [{ key, baseName, categoria, variations: [{sp, tmpl}], hasWeights, currentPrecoKg, allAvailable, someAvailable }]
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editValues, setEditValues] = useState({}); // { groupKey: { precoKg, precoIndividual, saving } }
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      // Fetch all SPs with pagination
      let allSps = [];
      let skip = 0;
      while (true) {
        const batch = await base44.entities.SupplierProduct.filter(
          { supplier_id: user.id }, '-created_date', 500, skip
        );
        allSps = allSps.concat(batch);
        if (batch.length < 500) break;
        skip += 500;
      }

      if (allSps.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Fetch all templates with pagination
      let allTemplates = [];
      skip = 0;
      while (true) {
        const batch = await base44.entities.ProductTemplate.list('categoria', 500, skip);
        allTemplates = allTemplates.concat(batch);
        if (batch.length < 500) break;
        skip += 500;
      }

      const tmplMap = new Map(allTemplates.map(t => [t.id, t]));

      // Group SPs by base product
      const groupMap = new Map();
      for (const sp of allSps) {
        const tmpl = tmplMap.get(sp.product_id);
        if (!tmpl) continue;
        const key = getGroupKey(tmpl);
        if (!groupMap.has(key)) {
          groupMap.set(key, { key, baseName: getBaseName(tmpl), categoria: tmpl.categoria, variations: [] });
        }
        groupMap.get(key).variations.push({ sp, tmpl });
      }

      // Sort variations by peso_kg within each group
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

  // Group by categoria for display
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

  const getGroupStatus = (g) => {
    const availableCount = g.variations.filter(v => v.sp.disponivel !== false).length;
    if (availableCount === g.variations.length) return 'all';
    if (availableCount === 0) return 'none';
    return 'partial';
  };

  const hasWeights = (g) => g.variations.some(v => v.tmpl.peso_kg != null);

  // Get current preço/kg from existing data
  const getCurrentPrecoKg = (g) => {
    const withWeights = g.variations.filter(v => v.tmpl.peso_kg && v.sp.preco);
    if (withWeights.length === 0) return null;
    // Use the smallest weight variant as reference
    const sorted = [...withWeights].sort((a, b) => a.tmpl.peso_kg - b.tmpl.peso_kg);
    return sorted[0].sp.preco / sorted[0].tmpl.peso_kg;
  };

  const handlePrecoKgChange = (groupKey, value) => {
    setEditValues(prev => ({ ...prev, [groupKey]: { ...prev[groupKey], precoKg: value } }));
  };

  const handleSavePrecoKg = async (g) => {
    const editVal = editValues[g.key];
    if (!editVal || editVal.precoKg == null || isNaN(editVal.precoKg)) {
      toast({ title: "Erro", description: "Informe um preço por kg válido.", variant: "destructive" });
      return;
    }

    setEditValues(prev => ({ ...prev, [g.key]: { ...prev[g.key], saving: true } }));

    try {
      const precoKg = parseFloat(editVal.precoKg);
      const updates = g.variations
        .filter(v => v.tmpl.peso_kg != null)
        .map(v => ({
          id: v.sp.id,
          preco: Math.round(precoKg * v.tmpl.peso_kg * 100) / 100,
        }));

      if (updates.length === 0) {
        toast({ title: "Aviso", description: "Este produto não tem variações com peso definido." });
        setEditValues(prev => { const n = { ...prev }; delete n[g.key]; return n; });
        return;
      }

      await base44.entities.SupplierProduct.bulkUpdate(updates);
      toast({ title: "Preços atualizados!", description: `${updates.length} variação(ões) atualizada(s) com base no preço/kg.` });
      setEditValues(prev => { const n = { ...prev }; delete n[g.key]; return n; });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao atualizar preços.", variant: "destructive" });
      setEditValues(prev => ({ ...prev, [g.key]: { ...prev[g.key], saving: false } }));
    }
  };

  const handleToggleDisponivel = async (g, makeAvailable) => {
    try {
      const updates = g.variations.map(v => ({ id: v.sp.id, disponivel: makeAvailable }));
      await base44.entities.SupplierProduct.bulkUpdate(updates);
      toast({ title: makeAvailable ? "Produtos publicados" : "Produtos despublicados", description: `${g.variations.length} variação(ões) ${makeAvailable ? 'disponibilizada(s)' : 'indisponibilizada(s)'}.` });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao atualizar disponibilidade.", variant: "destructive" });
    }
  };

  const handleIndividualPrecoChange = (spId, value) => {
    setEditValues(prev => ({ ...prev, [`ind_${spId}`]: value }));
  };

  const handleSaveIndividualPreco = async (sp) => {
    const val = editValues[`ind_${sp.id}`];
    if (val == null || isNaN(val)) {
      toast({ title: "Erro", description: "Preço inválido.", variant: "destructive" });
      return;
    }
    try {
      await base44.entities.SupplierProduct.update(sp.id, { preco: parseFloat(val) });
      toast({ title: "Preço atualizado!" });
      setEditValues(prev => { const n = { ...prev }; delete n[`ind_${sp.id}`]; return n; });
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao atualizar.", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  const totalPublished = groups.reduce((acc, g) => acc + g.variations.filter(v => v.sp.disponivel !== false).length, 0);
  const totalVariations = groups.reduce((acc, g) => acc + g.variations.length, 0);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
            {groups.length} {groups.length === 1 ? "produto" : "produtos"} ({totalVariations} variações)
          </Badge>
          <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
            {totalPublished} publicada(s)
          </Badge>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Você ainda não tem produtos cadastrados.</p>
          <p className="text-sm">Use a aba <strong>Importar Tabela</strong> para adicionar seus preços.</p>
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

                  return (
                    <div key={g.key} className="rounded-lg border bg-white overflow-hidden">
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
                              {g.variations.length} {g.variations.length === 1 ? "variação" : "variações"}
                              {hasW && currentPrecoKg != null && ` • Preço/kg atual: ${formatBRL(currentPrecoKg)}`}
                            </p>
                          </div>
                        </button>

                        {/* Publish toggle */}
                        <div className="flex items-center gap-1">
                          {status === 'all' && (
                            <Badge className="bg-green-100 text-green-700 gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Publicado
                            </Badge>
                          )}
                          {status === 'partial' && (
                            <Badge className="bg-yellow-100 text-yellow-700 gap-1">
                              <AlertCircle className="w-3 h-3" /> Parcial
                            </Badge>
                          )}
                          {status === 'none' && (
                            <Badge variant="outline" className="text-gray-400 gap-1">
                              <PowerOff className="w-3 h-3" /> Oculto
                            </Badge>
                          )}
                          {status !== 'all' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleDisponivel(g, true)}
                              className="border-green-300 text-green-700 hover:bg-green-50 h-8"
                            >
                              <Power className="w-3 h-3 mr-1" /> Publicar
                            </Button>
                          )}
                          {status !== 'none' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleDisponivel(g, false)}
                              className="border-gray-300 text-gray-600 hover:bg-gray-50 h-8"
                            >
                              <PowerOff className="w-3 h-3 mr-1" /> Ocultar
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expanded: edit preço/kg + list variations */}
                      {isExpanded && (
                        <div className="border-t bg-gray-50/50 p-4 space-y-4">
                          {/* Preço por kg editor (only for weight-based products) */}
                          {hasW && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-4 h-4 text-blue-600" />
                                <Label className="font-semibold text-blue-900">Definir preço por kg</Label>
                              </div>
                              <p className="text-xs text-blue-700 mb-3">
                                Informe o preço por kg e todos as variações de peso serão recalculadas automaticamente.
                              </p>
                              <div className="flex items-end gap-2 flex-wrap">
                                <div className="flex-1 min-w-[150px]">
                                  <Label className="text-xs text-gray-600">Preço por kg (R$)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder={currentPrecoKg != null ? currentPrecoKg.toFixed(2) : "0.00"}
                                    value={editVal?.precoKg ?? ""}
                                    onChange={(e) => handlePrecoKgChange(g.key, e.target.value)}
                                    className="mt-1"
                                  />
                                </div>
                                <Button
                                  onClick={() => handleSavePrecoKg(g)}
                                  disabled={editVal?.saving || editVal?.precoKg == null || editVal?.precoKg === ""}
                                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                                >
                                  {editVal?.saving
                                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    : <Save className="w-4 h-4 mr-2" />
                                  }
                                  Atualizar todos
                                </Button>
                              </div>
                              {editVal?.precoKg && !isNaN(editVal.precoKg) && (
                                <div className="mt-3 text-xs text-gray-600">
                                  <p className="font-medium mb-1">Prévia dos preços calculados:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {g.variations.filter(v => v.tmpl.peso_kg != null).map(v => (
                                      <Badge key={v.sp.id} variant="outline" className="text-xs gap-1">
                                        <Weight className="w-3 h-3" />
                                        {v.tmpl.peso_kg}kg → {formatBRL(parseFloat(editVal.precoKg) * v.tmpl.peso_kg)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Variation list */}
                          <div className="space-y-2">
                            {g.variations.map(v => {
                              const indEdit = editValues[`ind_${v.sp.id}`];
                              const disponivel = v.sp.disponivel !== false;
                              return (
                                <div key={v.sp.id} className="flex items-center gap-3 bg-white rounded-lg border p-3 flex-wrap">
                                  <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                                    {v.tmpl.peso_kg != null && (
                                      <Badge variant="outline" className="text-xs gap-1">
                                        <Weight className="w-3 h-3" /> {v.tmpl.peso_kg}kg
                                      </Badge>
                                    )}
                                    <span className="text-sm text-gray-700 truncate">{v.tmpl.nome}</span>
                                    <span className="text-xs text-gray-400 font-mono">{v.tmpl.cod}</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="w-[120px]">
                                      <Label className="text-xs text-gray-500">Preço (R$)</Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={indEdit ?? v.sp.preco ?? ""}
                                        onChange={(e) => handleIndividualPrecoChange(v.sp.id, e.target.value)}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSaveIndividualPreco(v.sp)}
                                      disabled={indEdit == null || indEdit === v.sp.preco}
                                      className="h-8 mt-5"
                                    >
                                      <Save className="w-3 h-3" />
                                    </Button>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {disponivel
                                      ? <Badge className="bg-green-100 text-green-700 text-xs">Disponível</Badge>
                                      : <Badge variant="outline" className="text-gray-400 text-xs">Oculto</Badge>
                                    }
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}