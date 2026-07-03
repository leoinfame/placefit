import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getCatalogoData } from "@/functions/getCatalogoData";
import { Search, Package, Plus, Check, Loader2, Weight, Layers, Tag, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIAS = [
  "Anilhas","Halteres","Dumbells",
  "Tijolinhos","Pisos","Kettlebells","Kits","Outros"
];

const CATEGORY_ORDER = [...CATEGORIAS];

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

const formatBRL = (v) => v != null && !isNaN(v) ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function CatalogoGeral({ user }) {
  const [templates, setTemplates] = useState([]);
  const [pricesByProduct, setPricesByProduct] = useState({});
  const [mySps, setMySps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ categoria: "", subcategoria: "", acabamento: "", search: "" });
  const [addModal, setAddModal] = useState(null);
  const [bulkModal, setBulkModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);
  const [selected, setSelected] = useState(new Set()); // group keys
  const { toast } = useToast();

  const isRevendedor = user?.role !== 'admin' && user?.tipo_usuario !== 'fabricante' && user?.tipo_usuario !== 'transportador';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const fetchAllTemplates = async () => {
        let all = [];
        let skip = 0;
        while (true) {
          const batch = await base44.entities.ProductTemplate.filter({ ativo: true }, '_id', 500, skip);
          all = all.concat(batch);
          if (batch.length < 500) break;
          skip += 500;
        }
        // Dedup by id — safety net against unstable pagination
        const seen = new Set();
        return all.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
      };
      const [tmpls, catalogRes, mine] = await Promise.all([
        fetchAllTemplates(),
        getCatalogoData({}).catch(() => ({ data: { pricesByProduct: {} } })),
        base44.entities.SupplierProduct.filter({ supplier_id: user.id }, '-created_date', 500),
      ]);
      setTemplates(tmpls || []);
      setPricesByProduct(catalogRes?.data?.pricesByProduct || {});
      setMySps(mine || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Erro ao carregar catálogo.", variant: "destructive" });
    }
    setLoading(false);
  };

  const subcategoriaOptions = useMemo(() => {
    const base = filters.categoria ? templates.filter(t => t.categoria === filters.categoria) : templates;
    return [...new Set(base.map(t => t.subcategoria).filter(Boolean))].sort();
  }, [templates, filters.categoria]);

  const acabamentoOptions = useMemo(() => {
    const base = filters.categoria ? templates.filter(t => t.categoria === filters.categoria) : templates;
    return [...new Set(base.map(t => t.acabamento).filter(Boolean))].sort();
  }, [templates, filters.categoria]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (filters.categoria && t.categoria !== filters.categoria) return false;
      if (filters.subcategoria && t.subcategoria !== filters.subcategoria) return false;
      if (filters.acabamento && t.acabamento !== filters.acabamento) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!t.nome?.toLowerCase().includes(s) && !t.cod?.toLowerCase().includes(s)) return false;
      }
      if (isRevendedor) {
        const prices = pricesByProduct[t.id] || [];
        if (prices.length === 0) return false;
      }
      return true;
    });
  }, [templates, filters, pricesByProduct, isRevendedor]);

  // Group filtered templates by base product
  const groups = useMemo(() => {
    const map = new Map();
    for (const tmpl of filteredTemplates) {
      const key = getGroupKey(tmpl);
      if (!map.has(key)) {
        map.set(key, {
          key,
          baseName: getBaseName(tmpl),
          categoria: tmpl.categoria,
          subcategoria: tmpl.subcategoria,
          acabamento: tmpl.acabamento,
          foto: tmpl.foto,
          und: tmpl.und,
          templates: [],
        });
      }
      map.get(key).templates.push(tmpl);
    }
    for (const g of map.values()) {
      g.templates.sort((a, b) => (a.peso_kg || 0) - (b.peso_kg || 0));
    }
    return [...map.values()];
  }, [filteredTemplates]);

  // Group by categoria for display
  const byCategoria = useMemo(() => {
    const map = new Map();
    for (const g of groups) {
      if (!map.has(g.categoria)) map.set(g.categoria, []);
      map.get(g.categoria).push(g);
    }
    return sortCategories([...map.keys()]).map(cat => ({ categoria: cat, groups: map.get(cat) }));
  }, [groups]);

  // Compute fabricante prices for a group (preço/kg for weight products, unit price otherwise)
  const getGroupFabricantes = (group) => {
    const hasWeights = group.templates.some(t => t.peso_kg != null);
    const fabData = {};

    for (const tmpl of group.templates) {
      const prices = pricesByProduct[tmpl.id] || [];
      for (const p of prices) {
        if (!fabData[p.fabricante_nome]) {
          fabData[p.fabricante_nome] = { sum: 0, count: 0, preco: null };
        }
        if (hasWeights && tmpl.peso_kg && p.preco) {
          fabData[p.fabricante_nome].sum += p.preco / tmpl.peso_kg;
          fabData[p.fabricante_nome].count++;
        } else if (!hasWeights && p.preco != null) {
          fabData[p.fabricante_nome].preco = p.preco;
        }
      }
    }

    return Object.entries(fabData).map(([fab, data]) => ({
      fabricante_nome: fab,
      precoKg: hasWeights ? (data.count > 0 ? data.sum / data.count : null) : null,
      preco: !hasWeights ? data.preco : null,
      hasWeights,
    })).sort((a, b) => {
      const va = a.precoKg ?? a.preco ?? Infinity;
      const vb = b.precoKg ?? b.preco ?? Infinity;
      return va - vb;
    });
  };

  const isGroupMine = (group) => {
    return group.templates.some(t => mySps.some(sp => sp.product_id === t.id));
  };

  // Selection helpers (at group level)
  const visibleKeys = groups.map(g => g.key);
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

  // Get fabricante prices for a specific fabricante within a group
  const getGroupFabricanteVariations = (group, fabricanteNome) => {
    const result = [];
    for (const tmpl of group.templates) {
      const prices = pricesByProduct[tmpl.id] || [];
      const fabPrice = prices.find(p => p.fabricante_nome === fabricanteNome);
      if (fabPrice) {
        result.push({ templateId: tmpl.id, preco: fabPrice.preco, peso_kg: tmpl.peso_kg, nome: tmpl.nome });
      }
    }
    return result;
  };

  const handleAdd = async () => {
    if (!addModal) return;
    setSaving(true);
    try {
      const variations = getGroupFabricanteVariations(addModal.group, addModal.fabricante_nome);
      if (variations.length === 0) {
        toast({ title: "Erro", description: "Este fabricante não tem preços para este produto.", variant: "destructive" });
        setSaving(false);
        return;
      }

      const records = variations.map(v => ({
        supplier_id: user.id,
        product_id: v.templateId,
        preco: v.preco,
        margem: addModal.margem || 0,
        fabricante_nome: addModal.fabricante_nome,
        observacoes: "",
        disponivel: true,
      }));

      await base44.entities.SupplierProduct.bulkCreate(records);
      toast({ title: "Produto adicionado!", description: `${addModal.group.baseName} (${records.length} variações) adicionado à sua tabela.` });
      setAddModal(null);
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao adicionar produto.", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleBulkAdd = async () => {
    if (!bulkModal) return;
    setSavingBulk(true);
    const eligibleGroups = groups.filter(g => selected.has(g.key) && !isGroupMine(g) && getGroupFabricantes(g).length > 0);
    let ok = 0, fail = 0;
    try {
      const records = [];
      for (const g of eligibleGroups) {
        const fabs = getGroupFabricantes(g);
        if (fabs.length === 0) continue;
        const fabName = fabs[0].fabricante_nome;
        const variations = getGroupFabricanteVariations(g, fabName);
        for (const v of variations) {
          records.push({
            supplier_id: user.id,
            product_id: v.templateId,
            preco: v.preco,
            margem: bulkModal.margem || 0,
            fabricante_nome: fabName,
            observacoes: "",
            disponivel: true,
          });
        }
      }
      if (records.length > 0) {
        const created = await base44.entities.SupplierProduct.bulkCreate(records);
        ok = Array.isArray(created) ? created.length : records.length;
      }
      toast({ title: `${ok} produtos adicionados!`, description: `Margem de ${bulkModal.margem || 0}% aplicada a todos.` });
      setBulkModal(null);
      clearSelection();
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: "Erro ao adicionar produtos em massa.", variant: "destructive" });
    }
    setSavingBulk(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Input
          placeholder="Buscar por nome ou SKU..."
          value={filters.search}
          onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
        />
        <Select value={filters.categoria || "all"} onValueChange={(v) => setFilters(f => ({ ...f, categoria: v === "all" ? "" : v, subcategoria: "", acabamento: "" }))}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.subcategoria || "all"} onValueChange={(v) => setFilters(f => ({ ...f, subcategoria: v === "all" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {subcategoriaOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.acabamento || "all"} onValueChange={(v) => setFilters(f => ({ ...f, acabamento: v === "all" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="Acabamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os acabamentos</SelectItem>
            {acabamentoOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Barra de ações em massa */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">{selected.size} selecionado(s)</span>
          </div>
          <div className="flex items-center gap-2">
            {isRevendedor && (
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                onClick={() => setBulkModal({ margem: 0 })}
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar Selecionados
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={clearSelection}>Limpar</Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">{groups.length} produtos encontrados</p>
        {groups.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-gray-500">Selecionar todos</span>
          </div>
        )}
      </div>

      {/* Cards agrupados por categoria */}
      {byCategoria.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum produto encontrado com os filtros selecionados.</p>
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
                const fabs = getGroupFabricantes(g);
                const alreadyMine = isGroupMine(g);
                const isSelected = selected.has(g.key);
                const hasWeights = g.templates.some(t => t.peso_kg != null);
                const minPreco = fabs.length > 0 ? (hasWeights ? fabs[0].precoKg : fabs[0].preco) : null;

                return (
                  <div key={g.key} className={`rounded-lg border bg-white overflow-hidden transition-all ${isSelected ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'} ${alreadyMine ? 'border-green-200' : ''}`}>
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
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-900 leading-tight">{g.baseName}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {g.subcategoria && <Badge variant="outline" className="text-xs">{g.subcategoria}</Badge>}
                              {g.acabamento && <Badge variant="outline" className="text-xs">{g.acabamento}</Badge>}
                              {g.templates.length > 1 && (
                                <Badge variant="outline" className="text-xs gap-0.5">
                                  <Weight className="w-3 h-3" />{g.templates.length} pesos
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Price display */}
                    <div className="px-3 pb-2">
                      {fabs.length > 0 ? (
                        <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <DollarSign className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-xs font-medium text-gray-600">
                              {hasWeights ? "Preço por kg" : "Preço unitário"}
                            </span>
                            {minPreco != null && (
                              <span className="text-sm font-bold text-green-600 ml-auto">
                                a partir de {formatBRL(minPreco)}
                              </span>
                            )}
                          </div>
                          {fabs.slice(0, 3).map(f => (
                            <div key={f.fabricante_nome} className="flex items-center justify-between text-xs gap-2">
                              <span className="text-gray-600 truncate">{f.fabricante_nome}</span>
                              <span className="font-semibold text-gray-900 whitespace-nowrap">
                                {formatBRL(hasWeights ? f.precoKg : f.preco)}
                                {hasWeights && <span className="text-gray-400 font-normal">/kg</span>}
                              </span>
                            </div>
                          ))}
                          {fabs.length > 3 && (
                            <p className="text-xs text-gray-400">+{fabs.length - 3} outros</p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <span className="text-xs text-gray-400">Sem preços de fabricante</span>
                        </div>
                      )}
                    </div>

                    {/* Card footer */}
                    <div className="border-t px-3 py-2 flex items-center justify-between gap-2">
                      {alreadyMine ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <Check className="w-3 h-3 mr-0.5" /> Na sua tabela
                        </Badge>
                      ) : fabs.length > 0 ? (
                        <Badge variant="outline" className="text-xs text-blue-600">Disponível</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-400">Sem preço</Badge>
                      )}

                      {isRevendedor && fabs.length > 0 && !alreadyMine && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAddModal({
                            group: g,
                            fabricantes: fabs,
                            fabricante_nome: fabs[0].fabricante_nome,
                            margem: 0,
                          })}
                          className="h-7 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Adicionar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal Adicionar */}
      {addModal && (
        <Dialog open onOpenChange={() => setAddModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> Adicionar aos Meus Produtos
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-900 text-sm">{addModal.group.baseName}</p>
                <p className="text-xs text-gray-500">
                  {addModal.group.templates.length} {addModal.group.templates.length === 1 ? "variação" : "variações"} • {addModal.group.categoria}
                </p>
              </div>

              <div>
                <Label>Selecione o Fabricante</Label>
                <Select
                  value={addModal.fabricante_nome}
                  onValueChange={(v) => setAddModal(m => ({ ...m, fabricante_nome: v }))}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {addModal.fabricantes.map(f => (
                      <SelectItem key={f.fabricante_nome} value={f.fabricante_nome}>
                        {f.fabricante_nome} — {formatBRL(f.hasWeights ? f.precoKg : f.preco)}{f.hasWeights ? "/kg" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Margem (%)</Label>
                <Input
                  type="number"
                  value={addModal.margem}
                  onChange={(e) => setAddModal(m => ({ ...m, margem: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  A margem será aplicada sobre o preço de fábrica de cada variação.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setAddModal(null)}>Cancelar</Button>
                <Button onClick={handleAdd} disabled={saving} className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : <><Check className="w-4 h-4 mr-2" />Salvar</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Adicionar em Massa */}
      {bulkModal && (
        <Dialog open onOpenChange={() => setBulkModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" /> Adicionar em Massa
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  {selected.size} produto(s) selecionado(s).
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Serão adicionadas todas as variações de cada produto, usando o primeiro fabricante disponível.
                </p>
              </div>

              <div>
                <Label>Margem Padrão (%) — aplicada a todos</Label>
                <Input
                  type="number"
                  value={bulkModal.margem}
                  onChange={(e) => setBulkModal(m => ({ ...m, margem: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Você poderá ajustar individualmente depois em "Meus Produtos".
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setBulkModal(null)}>Cancelar</Button>
                <Button onClick={handleBulkAdd} disabled={savingBulk} className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                  {savingBulk ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adicionando...</> : <><Plus className="w-4 h-4 mr-2" />Adicionar Tudo</>}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}