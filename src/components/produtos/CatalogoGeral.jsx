import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getCatalogoData } from "@/functions/getCatalogoData";
import { Search, Package, Plus, Check, Loader2, Weight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIAS = [
  "Anilhas","Halteres","Dumbells","Barras Montadas",
  "Tijolinhos","Pisos","Kettlebells","Suportes","Outros"
];

const formatBRL = (v) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

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
  const [selected, setSelected] = useState(new Set());
  const { toast } = useToast();

  const isRevendedor = user?.role !== 'admin' && user?.tipo_usuario !== 'fabricante' && user?.tipo_usuario !== 'transportador';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [tmpls, catalogRes, mine] = await Promise.all([
        base44.entities.ProductTemplate.filter({ ativo: true }, 'categoria', 500),
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
      return true;
    });
  }, [templates, filters]);

  const isProductMine = (productId) => mySps.some(sp => sp.product_id === productId);

  // Selection helpers
  const visibleIds = filteredTemplates.map(t => t.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const someVisibleSelected = visibleIds.some(id => selected.has(id));

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // Bulk add: only products with available fabricante prices and not already mine
  const getBulkEligible = () => {
    return filteredTemplates.filter(t => {
      const prices = pricesByProduct[t.id] || [];
      return prices.length > 0 && !isProductMine(t.id);
    });
  };

  const handleAdd = async () => {
    if (!addModal) return;
    setSaving(true);
    try {
      await base44.entities.SupplierProduct.create({
        supplier_id: user.id,
        product_id: addModal.template.id,
        preco: addModal.preco,
        margem: addModal.margem || 0,
        fabricante_nome: addModal.fabricante_nome,
        observacoes: addModal.observacoes || "",
        disponivel: true,
      });
      toast({ title: "Produto adicionado!", description: `${addModal.template.nome} foi adicionado à sua tabela.` });
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
    const eligible = getBulkEligible().filter(t => selected.has(t.id));
    let ok = 0, fail = 0;
    try {
      // bulkCreate with first available fabricante per product
      const records = eligible.map(t => {
        const prices = pricesByProduct[t.id] || [];
        const first = prices[0];
        return {
          supplier_id: user.id,
          product_id: t.id,
          preco: first.preco,
          margem: bulkModal.margem || 0,
          fabricante_nome: first.fabricante_nome,
          observacoes: "",
          disponivel: true,
        };
      });
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

      <p className="text-sm text-gray-500">{filteredTemplates.length} produtos encontrados</p>

      {/* Tabela de produtos */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fabricantes / Preços</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {isRevendedor && <TableHead className="text-center">Ação</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map(tmpl => {
                const fabPrices = pricesByProduct[tmpl.id] || [];
                const alreadyMine = isProductMine(tmpl.id);
                const isSelected = selected.has(tmpl.id);
                return (
                  <TableRow key={tmpl.id} className={isSelected ? "bg-blue-50/50" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(tmpl.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {tmpl.foto ? (
                        <img src={tmpl.foto} alt={tmpl.nome} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-gray-900">{tmpl.nome}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tmpl.subcategoria && <Badge variant="outline" className="text-xs">{tmpl.subcategoria}</Badge>}
                          {tmpl.acabamento && <Badge variant="outline" className="text-xs">{tmpl.acabamento}</Badge>}
                          {tmpl.peso_kg != null && (
                            <Badge variant="outline" className="text-xs"><Weight className="w-3 h-3 mr-0.5" />{tmpl.peso_kg}kg</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{tmpl.cod}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{tmpl.categoria}</Badge></TableCell>
                    <TableCell>
                      {fabPrices.length > 0 ? (
                        <div className="space-y-0.5">
                          {fabPrices.slice(0, 3).map(sp => (
                            <div key={sp.id} className="flex items-center justify-between text-xs gap-2 min-w-[160px]">
                              <span className="text-gray-600 truncate">{sp.fabricante_nome}</span>
                              <span className="font-semibold text-green-600 whitespace-nowrap">{formatBRL(sp.preco)}</span>
                            </div>
                          ))}
                          {fabPrices.length > 3 && (
                            <p className="text-xs text-gray-400">+{fabPrices.length - 3} outros</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Sem preços</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {alreadyMine ? (
                        <Badge className="bg-green-100 text-green-700 text-xs"><Check className="w-3 h-3 mr-0.5" /> Na tabela</Badge>
                      ) : fabPrices.length > 0 ? (
                        <Badge variant="outline" className="text-xs">Disponível</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-400">Sem preço</Badge>
                      )}
                    </TableCell>
                    {isRevendedor && (
                      <TableCell>
                        <div className="flex justify-center">
                          {fabPrices.length > 0 && !alreadyMine && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAddModal({ template: tmpl, fabPrices, preco: fabPrices[0].preco, fabricante_nome: fabPrices[0].fabricante_nome, margem: 0, observacoes: "" })}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Adicionar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum produto encontrado com os filtros selecionados.</p>
        </div>
      )}

      {/* Modal Adicionar Individual */}
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
                <p className="font-semibold text-gray-900 text-sm">{addModal.template.nome}</p>
                <p className="text-xs text-gray-400 font-mono">{addModal.template.cod}</p>
              </div>

              <div>
                <Label>Selecione o Fabricante</Label>
                <Select
                  value={addModal.fabricante_nome}
                  onValueChange={(v) => {
                    const selectedFab = addModal.fabPrices.find(f => f.fabricante_nome === v);
                    setAddModal(m => ({ ...m, fabricante_nome: v, preco: selectedFab?.preco || 0 }));
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {addModal.fabPrices.map(f => (
                      <SelectItem key={f.id} value={f.fabricante_nome}>
                        {f.fabricante_nome} — {formatBRL(f.preco)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Preço de Fábrica</Label>
                <Input value={formatBRL(addModal.preco)} disabled className="mt-1 bg-gray-50" />
              </div>

              <div>
                <Label>Margem (%)</Label>
                <Input
                  type="number"
                  value={addModal.margem}
                  onChange={(e) => setAddModal(m => ({ ...m, margem: parseFloat(e.target.value) || 0 }))}
                  className="mt-1"
                />
                <p className="text-xs text-green-600 mt-1">
                  Preço Final: {formatBRL(addModal.preco * (1 + (addModal.margem || 0) / 100))}
                </p>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={addModal.observacoes}
                  onChange={(e) => setAddModal(m => ({ ...m, observacoes: e.target.value }))}
                  rows={2}
                  className="mt-1"
                />
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
                  Serão adicionados apenas os produtos com preço de fabricante disponível e que ainda não estão na sua tabela. O primeiro fabricante de cada produto será usado.
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