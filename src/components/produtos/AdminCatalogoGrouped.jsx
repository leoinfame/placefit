import React, { useState, useMemo } from "react";
import {
  Search, Pencil, Trash2, Package, PackageSearch,
  ChevronDown, ChevronRight, Upload, Weight, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const CATEGORIAS = [
  "Anilhas", "Halteres", "Dumbells",
  "Tijolinhos", "Pisos", "Kettlebells", "Kits", "Outros",
];

const CATEGORY_ORDER = [...CATEGORIAS];

const GROUP_FIELDS = [
  'categoria', 'subcategoria', 'tipo_anilha', 'tipo_furo', 'acabamento',
  'barra_formato', 'barra_acabamento', 'presilha_tipo', 'comprimento_m',
  'barra_rolamento', 'bojo_formato', 'dumbell_tipo',
  'piso_espessura_mm', 'piso_formato', 'tijolinho_tipo', 'tijolinho_torre',
  'pegada', 'peso_faixa'
];

const SEARCH_FIELDS = [
  'nome', 'cod', 'subcategoria', 'acabamento', 'dumbell_tipo', 'bojo_formato',
  'pegada', 'tipo_anilha', 'tipo_furo', 'barra_acabamento',
  'piso_formato', 'tijolinho_tipo', 'tijolinho_torre',
  'peso_faixa', 'ncm', 'gtin', 'google_category',
];

const getGroupKey = (tmpl) => {
  if (tmpl.categoria === 'Suportes') {
    const n = (tmpl.nome || '').toLowerCase();
    if (n.includes('anilha') && !n.includes('halter')) {
      return 'Suportes|__anilhas__';
    }
    if (n.includes('halter') && !n.includes('anilha')) {
      return 'Suportes|__halter__';
    }
    if (n.includes('dumbbell') && n.includes('cal')) {
      return 'Suportes|__dumbbell_calco__';
    }
  }
  return GROUP_FIELDS.map(f => tmpl[f] ?? '').join('|');
};

const getBaseName = (tmpl) => {
  if (tmpl.categoria === 'Suportes') {
    const n = (tmpl.nome || '').toLowerCase();
    if (n.includes('anilha') && !n.includes('halter')) {
      return 'Suporte de Anilhas';
    }
    if (n.includes('halter') && !n.includes('anilha')) {
      return 'Suporte Halter';
    }
    if (n.includes('dumbbell') && n.includes('cal')) {
      return "Suporte Dumbbell (c/ cal\u00e7o)";
    }
  }
  return (tmpl.nome || '')
    .replace(/Expositor/gi, "Suporte")
    .replace(/\s+para\s+\d+\s+pares/gi, "")
    .replace(/\s+\d+\s*p[çc]s/gi, "")
    .replace(/\s+\d+\s*(?:divis[õo]es|div\.?)\s*/gi, " ")
    .replace(/\s+p\/\s*\d+\s*kg/gi, "")
    .replace(/\s+\d+(?:[.,]\d+)?\s*kg/gi, "")
    .replace(/\s+\d+(?:[.,]\d+)?\s*lbs?/gi, "")
    .replace(/\s+\d+\s+libras?/gi, "")
    .replace(/\s*\(?\d+\s+ao\s+\d+\)?/gi, "")
    .replace(/\s+\d+\s*x\s*\d+(?:\s*x\s*\d+(?:[.,]\d+)?)?(?:\s*d\d+)?/gi, "")
    .replace(/\s+\/\s*$/g, "")
    .replace(/\s+p\/\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
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

export default function AdminCatalogoGrouped({
  templates,
  selectedTpls,
  setSelectedTpls,
  onEditTemplate,
  onDeleteTemplate,
  onFotoTemplate,
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [subcatFilter, setSubcatFilter] = useState("all");
  const [acabamentoFilter, setAcabamentoFilter] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const subcatOptions = useMemo(() => {
    const base = catFilter !== "all" ? templates.filter(t => t.categoria === catFilter) : templates;
    return [...new Set(base.map(t => t.subcategoria).filter(Boolean))].sort();
  }, [templates, catFilter]);

  const acabamentoOptions = useMemo(() => {
    const base = catFilter !== "all" ? templates.filter(t => t.categoria === catFilter) : templates;
    return [...new Set(base.map(t => t.acabamento).filter(Boolean))].sort();
  }, [templates, catFilter]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (catFilter !== "all" && t.categoria !== catFilter) return false;
      if (subcatFilter !== "all" && t.subcategoria !== subcatFilter) return false;
      if (acabamentoFilter !== "all" && t.acabamento !== acabamentoFilter) return false;
      if (search) {
        const s = search.toLowerCase().trim();
        const matchField = SEARCH_FIELDS.some(f => {
          const val = t[f];
          return val != null && String(val).toLowerCase().includes(s);
        });
        if (!matchField && t.peso_kg != null && String(t.peso_kg).includes(s)) return true;
        if (!matchField) return false;
      }
      return true;
    });
  }, [templates, catFilter, subcatFilter, acabamentoFilter, search]);

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
          dumbell_tipo: tmpl.dumbell_tipo,
          bojo_formato: tmpl.bojo_formato,
          pegada: tmpl.pegada,
          tipo_anilha: tmpl.tipo_anilha,
          tipo_furo: tmpl.tipo_furo,
          barra_tipo: tmpl.barra_tipo,
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

  const toggleExpand = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allVisibleIds = filteredTemplates.map(t => t.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedTpls.has(id));
  const someSelected = allVisibleIds.some(id => selectedTpls.has(id));

  const toggleSelectAll = () => {
    setSelectedTpls(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allVisibleIds.forEach(id => next.delete(id));
      } else {
        allVisibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleTpl = (id) => {
    setSelectedTpls(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isGroupAllSelected = (g) => g.templates.every(t => selectedTpls.has(t.id));
  const isGroupSomeSelected = (g) => g.templates.some(t => selectedTpls.has(t.id));

  const toggleGroup = (g) => {
    const allSel = isGroupAllSelected(g);
    setSelectedTpls(prev => {
      const next = new Set(prev);
      if (allSel) {
        g.templates.forEach(t => next.delete(t.id));
      } else {
        g.templates.forEach(t => next.add(t.id));
      }
      return next;
    });
  };

  const getAttrBadges = (g) => {
    const badges = [];
    if (g.subcategoria) badges.push(g.subcategoria);
    if (g.acabamento) badges.push(g.acabamento);
    if (g.dumbell_tipo) badges.push(g.dumbell_tipo);
    if (g.bojo_formato) badges.push(g.bojo_formato);
    if (g.pegada) badges.push(g.pegada);
    if (g.tipo_anilha) badges.push(g.tipo_anilha);
    if (g.tipo_furo) badges.push(g.tipo_furo);
    if (g.barra_tipo) badges.push(g.barra_tipo);
    return badges.slice(0, 4);
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome, SKU, peso, acabamento, tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setSubcatFilter("all"); setAcabamentoFilter("all"); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {subcatOptions.length > 0 && (
          <Select value={subcatFilter} onValueChange={setSubcatFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Subtipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os subtipos</SelectItem>
              {subcatOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {acabamentoOptions.length > 0 && (
          <Select value={acabamentoFilter} onValueChange={setAcabamentoFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Acabamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os acabamentos</SelectItem>
              {acabamentoOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          {groups.length} {groups.length === 1 ? "produto" : "produtos"} • {filteredTemplates.length} variações
        </p>
        {filteredTemplates.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs text-gray-500">Selecionar todas as {filteredTemplates.length} variações</span>
          </div>
        )}
      </div>

      {byCategoria.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <PackageSearch className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {byCategoria.map(({ categoria, groups: catGroups }) => (
            <div key={categoria} className="rounded-lg border bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b">
                <Package className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">{categoria}</span>
                <Badge variant="secondary" className="text-xs">{catGroups.length} {catGroups.length === 1 ? "produto" : "produtos"}</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-14">Foto</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Variações</TableHead>
                      <TableHead className="w-20">Un.</TableHead>
                      <TableHead className="text-center w-24">Status</TableHead>
                      <TableHead className="text-center w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catGroups.map(g => {
                      const isExpanded = expandedGroups.has(g.key);
                      const groupAllSel = isGroupAllSelected(g);
                      const groupSomeSel = isGroupSomeSelected(g);
                      const hasWeights = g.templates.some(t => t.peso_kg != null);
                      const allActive = g.templates.every(t => t.ativo !== false);
                      const noneActive = g.templates.every(t => t.ativo === false);
                      const isSingle = g.templates.length === 1;
                      const first = g.templates[0];

                      return (
                        <React.Fragment key={g.key}>
                          <TableRow className="hover:bg-gray-50/50">
                            <TableCell>
                              <Checkbox
                                checked={groupAllSel ? true : groupSomeSel ? "indeterminate" : false}
                                onCheckedChange={() => toggleGroup(g)}
                              />
                            </TableCell>
                            <TableCell>
                              {!isSingle && (
                                <button onClick={() => toggleExpand(g.key)} className="p-1 hover:bg-gray-100 rounded">
                                  {isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-gray-500" />
                                    : <ChevronRight className="w-4 h-4 text-gray-500" />}
                                </button>
                              )}
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => onFotoTemplate(first)}
                                className="block w-10 h-10 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 hover:ring-1 hover:ring-blue-200 transition-all relative group"
                                title="Gerenciar imagem"
                              >
                                {g.foto ? (
                                  <img src={g.foto} alt={g.baseName} className="w-10 h-10 object-cover" />
                                ) : (
                                  <div className="w-10 h-10 bg-gray-100 flex items-center justify-center">
                                    <Upload className="w-4 h-4 text-gray-300 group-hover:text-blue-400" />
                                  </div>
                                )}
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-sm">{isSingle ? first.nome.replace(/Expositor/gi, "Suporte") : g.baseName}</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {getAttrBadges(g).map(b => (
                                  <Badge key={b} variant="outline" className="text-xs">{b}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isSingle ? (
                                <span className="text-xs text-gray-400">1 variação</span>
                              ) : hasWeights ? (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Weight className="w-3 h-3" />
                                  {g.templates.length} pesos
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Layers className="w-3 h-3" />
                                  {g.templates.length} variações
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{g.und}</TableCell>
                            <TableCell className="text-center">
                              {allActive ? (
                                <Badge className="bg-green-100 text-green-700 text-xs">Ativo</Badge>
                              ) : noneActive ? (
                                <Badge variant="outline" className="text-xs">Inativo</Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-700 text-xs">Misto</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEditTemplate(first)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => onDeleteTemplate(first)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expanded variations */}
                          {isExpanded && !isSingle && g.templates.map(t => {
                            const isSelected = selectedTpls.has(t.id);
                            return (
                              <TableRow key={t.id} className={`bg-gray-50/40 ${isSelected ? "bg-blue-50/50" : ""}`}>
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleTpl(t.id)}
                                  />
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="pl-8">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-600">{t.nome.replace(/Expositor/gi, "Suporte")}</span>
                                    {t.peso_kg != null && (
                                      <Badge variant="outline" className="text-xs">
                                        <Weight className="w-3 h-3 mr-0.5" />{t.peso_kg}kg
                                      </Badge>
                                    )}
                                    <span className="font-mono text-xs text-gray-500">{t.cod}</span>
                                  </div>
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-center">
                                  {t.ativo !== false ? (
                                    <Badge className="bg-green-100 text-green-700 text-xs">Ativo</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">Inativo</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditTemplate(t)}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => onDeleteTemplate(t)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}