import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Pencil, Trash2, Download, Loader2, Package, Search, X, CheckSquare, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const formatBRL = (v) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function MeusProdutos({ user }) {
  const [mySps, setMySps] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("all");
  const [filterSubcategoria, setFilterSubcategoria] = useState("all");
  const [filterAcabamento, setFilterAcabamento] = useState("all");
  const [filterTipoFuro, setFilterTipoFuro] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null); // null | 'delete' | 'margin' | 'enable' | 'disable'
  const [bulkMargin, setBulkMargin] = useState(0);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const sps = await base44.entities.SupplierProduct.filter({ supplier_id: user.id }, '-created_date', 500);
      setMySps(sps);
      if (sps.length > 0) {
        const productIds = [...new Set(sps.map(sp => sp.product_id))];
        const allTemplates = await base44.entities.ProductTemplate.list('categoria', 500);
        setTemplates(allTemplates.filter(t => productIds.includes(t.id)));
      }
    } catch (e) { console.error(e); toast({ title: "Erro", description: "Erro ao carregar produtos.", variant: "destructive" }); }
    setLoading(false);
  };

  const getTemplate = (pid) => templates.find(t => t.id === pid);

  // Build filter options dynamically from templates
  const filterOptions = useMemo(() => {
    const cats = new Set();
    const subs = new Set();
    const acabs = new Set();
    const furos = new Set();
    for (const t of templates) {
      if (t.categoria) cats.add(t.categoria);
      if (t.subcategoria) subs.add(t.subcategoria);
      if (t.acabamento) acabs.add(t.acabamento);
      if (t.tipo_furo) furos.add(t.tipo_furo);
    }
    return {
      categorias: [...cats].sort(),
      subcategorias: [...subs].sort(),
      acabamentos: [...acabs].sort(),
      tiposFuro: [...furos].sort(),
    };
  }, [templates]);

  // Filtered products
  const filteredSps = useMemo(() => {
    return mySps.filter(sp => {
      const tmpl = getTemplate(sp.product_id);
      if (!tmpl) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!tmpl.nome?.toLowerCase().includes(s) && !tmpl.cod?.toLowerCase().includes(s) && !sp.fabricante_nome?.toLowerCase().includes(s)) return false;
      }
      if (filterCategoria !== "all" && tmpl.categoria !== filterCategoria) return false;
      if (filterSubcategoria !== "all" && tmpl.subcategoria !== filterSubcategoria) return false;
      if (filterAcabamento !== "all" && tmpl.acabamento !== filterAcabamento) return false;
      if (filterTipoFuro !== "all" && tmpl.tipo_furo !== filterTipoFuro) return false;
      return true;
    });
  }, [mySps, templates, search, filterCategoria, filterSubcategoria, filterAcabamento, filterTipoFuro]);

  // Selection handlers
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (filteredSps.every(sp => selected.has(sp.id))) {
      setSelected(prev => {
        const next = new Set(prev);
        filteredSps.forEach(sp => next.delete(sp.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filteredSps.forEach(sp => next.add(sp.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelected(new Set());

  const hasFilters = search || filterCategoria !== "all" || filterSubcategoria !== "all" || filterAcabamento !== "all" || filterTipoFuro !== "all";

  const clearFilters = () => {
    setSearch("");
    setFilterCategoria("all");
    setFilterSubcategoria("all");
    setFilterAcabamento("all");
    setFilterTipoFuro("all");
  };

  const handleEditSave = async () => {
    setSaving(true);
    try {
      await base44.entities.SupplierProduct.update(editModal.id, { margem: editModal.margem });
      toast({ title: "Margem atualizada!" });
      setEditModal(null);
      loadData();
    } catch (e) { toast({ title: "Erro", description: "Erro ao atualizar.", variant: "destructive" }); }
    setSaving(false);
  };

  const handleDelete = async (sp) => {
    if (!confirm("Remover este produto da sua tabela?")) return;
    try {
      await base44.entities.SupplierProduct.delete(sp.id);
      toast({ title: "Produto removido" });
      loadData();
    } catch (e) { toast({ title: "Erro", description: "Erro ao remover.", variant: "destructive" }); }
  };

  const handleBulkConfirm = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkProcessing(true);
    try {
      if (bulkAction === 'delete') {
        for (const id of ids) {
          await base44.entities.SupplierProduct.delete(id);
        }
        toast({ title: `${ids.length} produto(s) removido(s)` });
      } else if (bulkAction === 'margin') {
        const updates = ids.map(id => ({ id, margem: bulkMargin }));
        await base44.entities.SupplierProduct.bulkUpdate(updates);
        toast({ title: `Margem de ${ids.length} produto(s) atualizada` });
      } else if (bulkAction === 'enable' || bulkAction === 'disable') {
        const disp = bulkAction === 'enable';
        const updates = ids.map(id => ({ id, disponivel: disp }));
        await base44.entities.SupplierProduct.bulkUpdate(updates);
        toast({ title: `${ids.length} produto(s) ${disp ? 'disponibilizado(s)' : 'indisponibilizado(s)'}` });
      }
      setBulkAction(null);
      setBulkMargin(0);
      clearSelection();
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro na ação em massa.", variant: "destructive" });
    }
    setBulkProcessing(false);
  };

  const handleExportCSV = () => {
    const rows = [["SKU", "Nome", "Fabricante", "Preço Final"]];
    for (const sp of mySps) {
      const tmpl = getTemplate(sp.product_id);
      const precoFinal = (sp.preco || 0) * (1 + (sp.margem || 0) / 100);
      rows.push([
        tmpl?.cod || "",
        tmpl?.nome || "",
        sp.fabricante_nome || "",
        precoFinal.toFixed(2),
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

  const allFilteredSelected = filteredSps.length > 0 && filteredSps.every(sp => selected.has(sp.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
            Você tem {mySps.length} {mySps.length === 1 ? "produto" : "produtos"} na sua tabela de preços
          </Badge>
          {filteredSps.length !== mySps.length && (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {filteredSps.length} exibido(s)
            </Badge>
          )}
        </div>
        <Button onClick={handleExportCSV} variant="outline" disabled={mySps.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {mySps.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Você ainda não adicionou produtos à sua tabela.</p>
          <p className="text-sm">Acesse o <strong>Catálogo Geral</strong> para adicionar produtos.</p>
        </div>
      ) : (
        <>
          {/* === FILTROS === */}
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, SKU ou fabricante..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500">
                  <X className="w-4 h-4 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {filterOptions.categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSubcategoria} onValueChange={setFilterSubcategoria} disabled={filterOptions.subcategorias.length === 0}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas subcategorias</SelectItem>
                  {filterOptions.subcategorias.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterAcabamento} onValueChange={setFilterAcabamento} disabled={filterOptions.acabamentos.length === 0}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Acabamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos acabamentos</SelectItem>
                  {filterOptions.acabamentos.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTipoFuro} onValueChange={setFilterTipoFuro} disabled={filterOptions.tiposFuro.length === 0}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Tipo de Furo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os furos</SelectItem>
                  {filterOptions.tiposFuro.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* === AÇÕES EM MASSA === */}
          {selected.size > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {selected.size} produto(s) selecionado(s)
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="text-blue-600">
                  <X className="w-4 h-4 mr-1" /> Limpar
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setBulkAction('margin')} className="border-blue-300 text-blue-700 hover:bg-blue-100">
                  <Pencil className="w-4 h-4 mr-1" /> Definir Margem
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('enable')} className="border-green-300 text-green-700 hover:bg-green-50">
                  <Power className="w-4 h-4 mr-1" /> Disponibilizar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('disable')} className="border-gray-300 text-gray-600 hover:bg-gray-50">
                  <PowerOff className="w-4 h-4 mr-1" /> Indisponibilizar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setBulkAction('delete')}>
                  <Trash2 className="w-4 h-4 mr-1" /> Remover
                </Button>
              </div>
            </div>
          )}

          {/* === TABELA === */}
          {filteredSps.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum produto encontrado com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="rounded-lg border bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nome do Produto</TableHead>
                      <TableHead>Fabricante</TableHead>
                      <TableHead className="text-right">Preço de Fábrica</TableHead>
                      <TableHead className="text-right">Margem %</TableHead>
                      <TableHead className="text-right">Preço Final</TableHead>
                      <TableHead className="text-center">Disponível</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSps.map(sp => {
                      const tmpl = getTemplate(sp.product_id);
                      const precoFinal = (sp.preco || 0) * (1 + (sp.margem || 0) / 100);
                      return (
                        <TableRow key={sp.id} className={selected.has(sp.id) ? "bg-blue-50/50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(sp.id)}
                              onCheckedChange={() => toggleSelect(sp.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{tmpl?.cod || "—"}</TableCell>
                          <TableCell className="font-medium">{tmpl?.nome || "Produto não encontrado"}</TableCell>
                          <TableCell className="text-gray-600">{sp.fabricante_nome || "—"}</TableCell>
                          <TableCell className="text-right">{formatBRL(sp.preco)}</TableCell>
                          <TableCell className="text-right">{sp.margem || 0}%</TableCell>
                          <TableCell className="text-right font-semibold text-green-600">{formatBRL(precoFinal)}</TableCell>
                          <TableCell className="text-center">
                            {sp.disponivel === false
                              ? <Badge variant="outline" className="text-gray-400">Não</Badge>
                              : <Badge className="bg-green-100 text-green-700">Sim</Badge>
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => setEditModal({ ...sp })} className="h-8 w-8">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(sp)} className="h-8 w-8 text-red-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
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
                <p className="font-semibold text-sm">{getTemplate(editModal.product_id)?.nome}</p>
                <p className="text-xs text-gray-500">Preço de fábrica: {formatBRL(editModal.preco)}</p>
              </div>
              <div>
                <Label>Margem (%)</Label>
                <Input
                  type="number"
                  value={editModal.margem || 0}
                  onChange={(e) => setEditModal(m => ({ ...m, margem: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-sm text-green-600 mt-1">
                  Preço Final: {formatBRL((editModal.preco || 0) * (1 + (editModal.margem || 0) / 100))}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditModal(null)}>Cancelar</Button>
                <Button onClick={handleEditSave} disabled={saving} className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Ação em Massa */}
      {bulkAction && (
        <Dialog open onOpenChange={() => { setBulkAction(null); setBulkMargin(0); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {bulkAction === 'delete' && <><Trash2 className="w-5 h-5 text-red-600" /> Remover Produtos</>}
                {bulkAction === 'margin' && <><Pencil className="w-5 h-5 text-blue-600" /> Definir Margem</>}
                {bulkAction === 'enable' && <><Power className="w-5 h-5 text-green-600" /> Disponibilizar</>}
                {bulkAction === 'disable' && <><PowerOff className="w-5 h-5 text-gray-600" /> Indisponibilizar</>}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600">
                {bulkAction === 'delete'
                  ? `Tem certeza que deseja remover ${selected.size} produto(s) da sua tabela? Esta ação não pode ser desfeita.`
                  : bulkAction === 'margin'
                    ? `Definir a margem para ${selected.size} produto(s) selecionado(s):`
                    : `Confirma ${bulkAction === 'enable' ? 'disponibilizar' : 'indisponibilizar'} ${selected.size} produto(s) selecionado(s)?`
                }
              </p>
              {bulkAction === 'margin' && (
                <div>
                  <Label>Margem (%)</Label>
                  <Input
                    type="number"
                    value={bulkMargin}
                    onChange={(e) => setBulkMargin(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setBulkAction(null); setBulkMargin(0); }}>Cancelar</Button>
                <Button
                  variant={bulkAction === 'delete' ? 'destructive' : 'default'}
                  onClick={handleBulkConfirm}
                  disabled={bulkProcessing}
                  className={bulkAction !== 'delete' ? "bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700" : ""}
                >
                  {bulkProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
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