import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Package, Loader2, Weight, Tag, Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { expandTemplates } from "@/utils/expandTemplates";
import { getProdutosData } from "@/functions/getProdutosData";

const CATEGORIAS = ["Anilhas","Halteres","Dumbells","Tijolinhos","Pisos","Colchonetes","Kettlebells","Kits","Outros"];
const CATEGORY_ORDER = [...CATEGORIAS];

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

const getBaseName = (tmpl) => (tmpl.nome || '').replace(/\s+\d+([.,]\d+)?\s*kg$/i, '').trim();
const getGroupKey = (tmpl) => getBaseName(tmpl) + '|' + GROUP_FIELDS.map(f => tmpl[f] ?? '').join('|');

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

export default function ProdutoTemplateDialog({ open, fabricante, onClose, onSaved }) {
  const [templates, setTemplates] = useState([]);
  const [linkedProductIds, setLinkedProductIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [precoKg, setPrecoKg] = useState("");
  const [precoUnit, setPrecoUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && fabricante) loadData();
  }, [open, fabricante]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getProdutosData({ mode: "catalogo" });
      const data = res.data || res;
      const expanded = expandTemplates(data.templates || [], data.fieldMap);
      setTemplates(expanded.filter(t => t.ativo !== false));

      // Find templates already linked to this fabricante
      const allSps = await base44.entities.SupplierProduct.list();
      const fabId = fabricante.id;
      const fabUserId = fabricante.user_id;
      const linked = new Set(
        allSps
          .filter(sp => sp.fabricante_id === fabId || (fabUserId && sp.supplier_id === fabUserId))
          .map(sp => sp.product_id)
      );
      setLinkedProductIds(linked);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Erro ao carregar catálogo de templates.", variant: "destructive" });
    }
    setLoading(false);
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (filterCategoria !== "all" && t.categoria !== filterCategoria) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.nome?.toLowerCase().includes(s) && !t.cod?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [templates, search, filterCategoria]);

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

  const byCategoria = useMemo(() => {
    const map = new Map();
    for (const g of groups) {
      if (!map.has(g.categoria)) map.set(g.categoria, []);
      map.get(g.categoria).push(g);
    }
    return sortCategories([...map.keys()]).map(cat => ({ categoria: cat, groups: map.get(cat) }));
  }, [groups]);

  const hasWeights = (g) => g.templates.some(t => t.peso_kg != null);
  const isGroupLinked = (g) => g.templates.some(t => linkedProductIds.has(t.id));

  const handleSelectGroup = (g) => {
    if (selectedGroup?.key === g.key) {
      setSelectedGroup(null);
    } else {
      setSelectedGroup(g);
      setPrecoKg("");
      setPrecoUnit("");
    }
  };

  const handleSave = async () => {
    if (!selectedGroup) return;
    const g = selectedGroup;
    const isWeight = hasWeights(g);

    if (isWeight) {
      if (!precoKg || parseFloat(precoKg) <= 0) {
        toast({ title: "Informe o preço por kg", description: "Digite um valor válido.", variant: "destructive" });
        return;
      }
    } else {
      if (!precoUnit || parseFloat(precoUnit) <= 0) {
        toast({ title: "Informe o preço unitário", description: "Digite um valor válido.", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      const fabNome = fabricante.nome_fantasia || fabricante.razao_social;
      const records = g.templates.map(t => ({
        fabricante_id: fabricante.id,
        fabricante_nome: fabNome,
        product_id: t.id,
        preco: isWeight
          ? Math.round(parseFloat(precoKg) * (t.peso_kg || 0) * 100) / 100
          : parseFloat(precoUnit),
        margem: 0,
        disponivel: true,
      }));
      await base44.entities.SupplierProduct.bulkCreate(records);
      toast({ title: "Produto vinculado!", description: `${g.baseName} (${records.length} ${records.length === 1 ? "variação" : "variações"}) adicionado a ${fabNome}.` });
      setSelectedGroup(null);
      setPrecoKg("");
      setPrecoUnit("");
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Erro ao salvar produto.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Adicionar Produto — {fabricante?.nome_fantasia || fabricante?.razao_social}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Selecione um produto do catálogo padronizado e defina o preço de fábrica. O produto será vinculado a este fabricante.
            </p>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar produto por nome ou SKU..."
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
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Selected group price panel */}
            {selectedGroup && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{selectedGroup.baseName}</p>
                    <p className="text-xs text-gray-500">{selectedGroup.templates.length} {selectedGroup.templates.length === 1 ? "variação" : "variações"} • {selectedGroup.categoria}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {hasWeights(selectedGroup) ? (
                  <div>
                    <Label>Preço por kg (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precoKg}
                      onChange={(e) => setPrecoKg(e.target.value)}
                      placeholder="Ex: 12.50"
                      className="mt-1"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      O preço de cada variação será calculado automaticamente (preço/kg × peso).
                    </p>
                    <div className="mt-2 bg-white rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                      {selectedGroup.templates.map(t => (
                        <div key={t.id} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate">{t.nome}</span>
                          <span className="font-medium whitespace-nowrap ml-2">
                            {precoKg ? formatBRL(Math.round(parseFloat(precoKg) * (t.peso_kg || 0) * 100) / 100) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label>Preço unitário (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precoUnit}
                      onChange={(e) => setPrecoUnit(e.target.value)}
                      placeholder="Ex: 89.90"
                      className="mt-1"
                      autoFocus
                    />
                  </div>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                    : <><Check className="w-4 h-4 mr-2" />Vincular Produto ao Fabricante</>
                  }
                </Button>
              </div>
            )}

            {/* Template list */}
            {byCategoria.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Nenhum produto encontrado com os filtros aplicados.</p>
              </div>
            ) : (
              byCategoria.map(({ categoria, groups: catGroups }) => (
                <div key={categoria} className="space-y-2">
                  <div className="flex items-center gap-2 pt-2">
                    <Tag className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-gray-900">{categoria}</h3>
                    <Badge variant="outline" className="text-xs">{catGroups.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {catGroups.map(g => {
                      const linked = isGroupLinked(g);
                      const isSelected = selectedGroup?.key === g.key;
                      return (
                        <div
                          key={g.key}
                          className={`rounded-lg border bg-white overflow-hidden transition-all ${
                            isSelected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
                          } ${linked ? 'opacity-60' : 'cursor-pointer hover:border-gray-300'}`}
                          onClick={() => !linked && handleSelectGroup(g)}
                        >
                          <div className="flex items-start gap-2 p-3">
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
                                {g.templates.length > 1 && (
                                  <Badge variant="outline" className="text-xs gap-0.5">
                                    <Weight className="w-3 h-3" />{g.templates.length} pesos
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="px-3 pb-2">
                            {linked ? (
                              <Badge className="bg-green-100 text-green-700 text-xs w-full justify-center">
                                <Check className="w-3 h-3 mr-1" /> Já vinculado
                              </Badge>
                            ) : isSelected ? (
                              <Badge className="bg-blue-100 text-blue-700 text-xs w-full justify-center">Selecionado</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-gray-500 w-full justify-center">Clique para selecionar</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}