import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Search, Plus, Pencil, Trash2, Loader2, Package, PackageSearch,
  DollarSign, AlertTriangle, ShieldCheck, Layers, Power, PowerOff, Check, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import TemplateForm from "@/components/admin/TemplateForm";
import ImportarTemplatesCsv from "@/components/produtos/ImportarTemplatesCsv";
import FotoUploadModal from "@/components/produtos/FotoUploadModal";
import AdminCatalogoGrouped from "@/components/produtos/AdminCatalogoGrouped";

const CATEGORIAS = [
  "Anilhas", "Halteres", "Dumbells", "Barras Montadas",
  "Tijolinhos", "Pisos", "Kettlebells", "Suportes", "Kits", "Outros",
];

const formatBRL = (v) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function AdminProdutos() {
  const { toast } = useToast();
  const [tab, setTab] = useState("catalogo");
  const [loading, setLoading] = useState(true);

  // Catalogo state
  const [templates, setTemplates] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState(null);
  const [confirmDeleteTpl, setConfirmDeleteTpl] = useState(null);
  const [fotoModalTpl, setFotoModalTpl] = useState(null);
  const [selectedTpls, setSelectedTpls] = useState(new Set());
  const [bulkTplAction, setBulkTplAction] = useState(null); // null | 'delete' | 'activate' | 'deactivate'
  const [importOpen, setImportOpen] = useState(false);

  // Supplier products state
  const [allSps, setAllSps] = useState([]);
  const [templateMap, setTemplateMap] = useState({});
  const [supplierMap, setSupplierMap] = useState({});
  const [spSearch, setSpSearch] = useState("");
  const [spCatFilter, setSpCatFilter] = useState("all");
  const [editSp, setEditSp] = useState(null);
  const [savingSp, setSavingSp] = useState(false);
  const [confirmDeleteSp, setConfirmDeleteSp] = useState(null);
  const [selectedSps, setSelectedSps] = useState(new Set());
  const [bulkSpAction, setBulkSpAction] = useState(null); // null | 'delete' | 'enable' | 'disable'

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchAllTemplates = async () => {
        let all = [];
        let skip = 0;
        while (true) {
          const batch = await base44.entities.ProductTemplate.filter({}, 'categoria', 500, skip);
          all = all.concat(batch);
          if (batch.length < 500) break;
          skip += 500;
        }
        return all;
      };
      const fetchAllSps = async () => {
        let all = [];
        let skip = 0;
        while (true) {
          const batch = await base44.entities.SupplierProduct.filter({}, '-created_date', 500, skip);
          all = all.concat(batch);
          if (batch.length < 500) break;
          skip += 500;
        }
        return all;
      };
      const [tmpls, sps, users] = await Promise.all([
        fetchAllTemplates(),
        fetchAllSps(),
        base44.entities.User.list(),
      ]);
      setTemplates(tmpls || []);
      setAllSps(sps || []);
      const tMap = {};
      (tmpls || []).forEach(t => { tMap[t.id] = t; });
      setTemplateMap(tMap);
      const uMap = {};
      (users || []).forEach(u => { uMap[u.id] = u; });
      setSupplierMap(uMap);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Erro ao carregar dados.", variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Template CRUD ---
  const handleSaveTemplate = async (data) => {
    try {
      if (editingTpl) {
        await base44.entities.ProductTemplate.update(editingTpl.id, data);
        toast({ title: "Template atualizado!" });
      } else {
        await base44.entities.ProductTemplate.create(data);
        toast({ title: "Produto criado!" });
      }
      setFormOpen(false);
      setEditingTpl(null);
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message || "Erro ao salvar.", variant: "destructive" });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!confirmDeleteTpl) return;
    try {
      // Delete linked SupplierProducts first
      await base44.entities.SupplierProduct.deleteMany({ product_id: confirmDeleteTpl.id });
      await base44.entities.ProductTemplate.delete(confirmDeleteTpl.id);
      toast({ title: "Produto excluído", description: `${confirmDeleteTpl.nome} e preços vinculados foram removidos.` });
      setConfirmDeleteTpl(null);
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message || "Erro ao excluir.", variant: "destructive" });
    }
  };

  // --- Bulk Template Actions ---
  const handleBulkTplConfirm = async () => {
    const ids = [...selectedTpls];
    if (ids.length === 0 || !bulkTplAction) return;
    try {
      if (bulkTplAction === 'delete') {
        // Delete linked SupplierProducts first
        await base44.entities.SupplierProduct.deleteMany({ product_id: { $in: ids } });
        await base44.entities.ProductTemplate.deleteMany({ id: { $in: ids } });
        toast({ title: "Produtos excluídos", description: `${ids.length} produto(s) removido(s).` });
      } else if (bulkTplAction === 'activate' || bulkTplAction === 'deactivate') {
        await base44.entities.ProductTemplate.bulkUpdate(ids.map(id => ({ id, ativo: bulkTplAction === 'activate' })));
        toast({ title: "Status atualizado", description: `${ids.length} produto(s) ${bulkTplAction === 'activate' ? 'ativado(s)' : 'desativado(s)'}.` });
      }
      setSelectedTpls(new Set());
      setBulkTplAction(null);
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message || "Erro na ação em massa.", variant: "destructive" });
      setBulkTplAction(null);
    }
  };

  // --- SupplierProduct CRUD ---
  const filteredSps = useMemo(() => {
    return allSps.filter(sp => {
      const tmpl = templateMap[sp.product_id];
      if (spCatFilter !== "all" && tmpl?.categoria !== spCatFilter) return false;
      if (spSearch) {
        const s = spSearch.toLowerCase();
        const prodName = tmpl?.nome?.toLowerCase() || "";
        const prodCod = tmpl?.cod?.toLowerCase() || "";
        const fab = (sp.fabricante_nome || "").toLowerCase();
        const supplierName = (supplierMap[sp.supplier_id]?.full_name || supplierMap[sp.supplier_id]?.empresa || "").toLowerCase();
        if (!prodName.includes(s) && !prodCod.includes(s) && !fab.includes(s) && !supplierName.includes(s)) return false;
      }
      return true;
    });
  }, [allSps, templateMap, supplierMap, spCatFilter, spSearch]);

  const handleSaveSp = async () => {
    setSavingSp(true);
    try {
      await base44.entities.SupplierProduct.update(editSp.id, {
        preco: parseFloat(editSp.preco) || 0,
        margem: parseFloat(editSp.margem) || 0,
        sale_price: editSp.sale_price ? parseFloat(editSp.sale_price) : null,
        disponivel: editSp.disponivel !== false,
      });
      toast({ title: "Preço atualizado!" });
      setEditSp(null);
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message || "Erro ao atualizar.", variant: "destructive" });
    }
    setSavingSp(false);
  };

  const handleDeleteSp = async () => {
    if (!confirmDeleteSp) return;
    try {
      await base44.entities.SupplierProduct.delete(confirmDeleteSp.id);
      toast({ title: "Preço removido" });
      setConfirmDeleteSp(null);
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message || "Erro ao remover.", variant: "destructive" });
    }
  };

  // --- Bulk SupplierProduct Actions ---
  const visibleSpIds = filteredSps.map(sp => sp.id);
  const allSpsSelected = visibleSpIds.length > 0 && visibleSpIds.every(id => selectedSps.has(id));
  const someSpsSelected = visibleSpIds.some(id => selectedSps.has(id));

  const toggleSp = (id) => {
    setSelectedSps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllSps = () => {
    setSelectedSps(prev => {
      const next = new Set(prev);
      if (allSpsSelected) {
        visibleSpIds.forEach(id => next.delete(id));
      } else {
        visibleSpIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkSpConfirm = async () => {
    const ids = [...selectedSps];
    if (ids.length === 0 || !bulkSpAction) return;
    try {
      if (bulkSpAction === 'delete') {
        await base44.entities.SupplierProduct.deleteMany({ id: { $in: ids } });
        toast({ title: "Preços removidos", description: `${ids.length} preço(s) removido(s).` });
      } else if (bulkSpAction === 'enable' || bulkSpAction === 'disable') {
        await base44.entities.SupplierProduct.bulkUpdate(ids.map(id => ({ id, disponivel: bulkSpAction === 'enable' })));
        toast({ title: "Disponibilidade atualizada", description: `${ids.length} preço(s) ${bulkSpAction === 'enable' ? 'disponibilizado(s)' : 'indisponibilizado(s)'}.` });
      }
      setSelectedSps(new Set());
      setBulkSpAction(null);
      loadData();
    } catch (e) {
      toast({ title: "Erro", description: e.message || "Erro na ação em massa.", variant: "destructive" });
      setBulkSpAction(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg p-3">
        <ShieldCheck className="w-5 h-5 text-purple-600 flex-shrink-0" />
        <p className="text-sm text-purple-700">
          <strong>Modo Admin:</strong> controle total sobre catálogo e preços de todos os fornecedores.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="catalogo" className="gap-2"><Package className="w-4 h-4" /> Catálogo ({templates.length})</TabsTrigger>
          <TabsTrigger value="precos" className="gap-2"><DollarSign className="w-4 h-4" /> Preços de Fornecedores ({allSps.length})</TabsTrigger>
        </TabsList>

        {/* === ABA: CATÁLOGO === */}
        <TabsContent value="catalogo" className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Importar CSV
            </Button>
            <Button
              onClick={() => { setEditingTpl(null); setFormOpen(true); }}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Adicionar Produto
            </Button>
          </div>

          {selectedTpls.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{selectedTpls.size} selecionado(s)</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setBulkTplAction('activate')}>
                  <Power className="w-4 h-4 mr-1 text-green-600" /> Ativar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkTplAction('deactivate')}>
                  <PowerOff className="w-4 h-4 mr-1 text-orange-600" /> Desativar
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setBulkTplAction('delete')}>
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedTpls(new Set())}>Limpar</Button>
              </div>
            </div>
          )}

          <AdminCatalogoGrouped
            templates={templates}
            selectedTpls={selectedTpls}
            setSelectedTpls={setSelectedTpls}
            onEditTemplate={(t) => { setEditingTpl(t); setFormOpen(true); }}
            onDeleteTemplate={(t) => setConfirmDeleteTpl(t)}
            onFotoTemplate={(t) => setFotoModalTpl(t)}
          />
        </TabsContent>

        {/* === ABA: PREÇOS DE FORNECEDORES === */}
        <TabsContent value="precos" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por produto, SKU, fornecedor..."
                value={spSearch}
                onChange={(e) => setSpSearch(e.target.value)}
                className="pl-10 w-72"
              />
            </div>
            <Select value={spCatFilter} onValueChange={setSpCatFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedSps.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">{selectedSps.size} selecionado(s)</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setBulkSpAction('enable')}>
                  <Power className="w-4 h-4 mr-1 text-green-600" /> Disponibilizar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkSpAction('disable')}>
                  <PowerOff className="w-4 h-4 mr-1 text-orange-600" /> Indisponibilizar
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setBulkSpAction('delete')}>
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedSps(new Set())}>Limpar</Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSpsSelected ? true : someSpsSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAllSps}
                      />
                    </TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead className="text-right">Preço Fábrica</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Preço Final</TableHead>
                    <TableHead className="text-center">Disp.</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSps.map(sp => {
                    const tmpl = templateMap[sp.product_id];
                    const supplier = supplierMap[sp.supplier_id];
                    const supplierName = supplier?.empresa || supplier?.full_name || sp.supplier_id;
                    const precoFinal = (sp.preco || 0) * (1 + (sp.margem || 0) / 100);
                    const isSelected = selectedSps.has(sp.id);
                    return (
                      <TableRow key={sp.id} className={isSelected ? "bg-blue-50/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSp(sp.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{tmpl?.cod || "—"}</TableCell>
                        <TableCell className="font-medium text-sm">{tmpl?.nome || "Produto não encontrado"}</TableCell>
                        <TableCell className="text-sm text-gray-600">{supplierName}</TableCell>
                        <TableCell className="text-sm text-gray-600">{sp.fabricante_nome || "—"}</TableCell>
                        <TableCell className="text-right">{formatBRL(sp.preco)}</TableCell>
                        <TableCell className="text-right">{sp.margem || 0}%</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {sp.sale_price ? <span className="text-orange-600">{formatBRL(sp.sale_price)}</span> : formatBRL(precoFinal)}
                        </TableCell>
                        <TableCell className="text-center">
                          {sp.disponivel !== false ? (
                            <Badge className="bg-green-100 text-green-700 text-xs">Sim</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Não</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditSp({ ...sp })}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setConfirmDeleteSp(sp)}>
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

          {filteredSps.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum preço cadastrado.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* === MODAL: TEMPLATE FORM === */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); setEditingTpl(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              {editingTpl ? "Editar Produto do Catálogo" : "Adicionar Produto ao Catálogo"}
            </DialogTitle>
          </DialogHeader>
          <TemplateForm
            open={formOpen}
            editingTemplate={editingTpl}
            onSave={handleSaveTemplate}
            onClose={() => { setFormOpen(false); setEditingTpl(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* === MODAL: EDITAR PREÇO === */}
      {editSp && (
        <Dialog open onOpenChange={() => setEditSp(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" /> Editar Preço
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-sm">{templateMap[editSp.product_id]?.nome || "Produto"}</p>
                <p className="text-xs text-gray-500 font-mono">{templateMap[editSp.product_id]?.cod}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Fornecedor: {supplierMap[editSp.supplier_id]?.empresa || supplierMap[editSp.supplier_id]?.full_name || "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preço de Fábrica (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editSp.preco || 0}
                    onChange={(e) => setEditSp(s => ({ ...s, preco: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div>
                  <Label>Margem (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editSp.margem || 0}
                    onChange={(e) => setEditSp(s => ({ ...s, margem: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div>
                <Label>Preço Promocional (R$) — opcional</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editSp.sale_price || ""}
                  onChange={(e) => setEditSp(s => ({ ...s, sale_price: e.target.value || null }))}
                  placeholder="Deixe vazio para usar preço calculado"
                />
              </div>
              <p className="text-sm text-green-600">
                Preço Final: {formatBRL((editSp.preco || 0) * (1 + (editSp.margem || 0) / 100))}
              </p>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editSp.disponivel !== false}
                  onCheckedChange={(v) => setEditSp(s => ({ ...s, disponivel: v }))}
                />
                <Label>Disponível para venda</Label>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditSp(null)}>Cancelar</Button>
                <Button onClick={handleSaveSp} disabled={savingSp} className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                  {savingSp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* === CONFIRMAR EXCLUSÃO DE TEMPLATE === */}
      {confirmDeleteTpl && (
        <Dialog open onOpenChange={() => setConfirmDeleteTpl(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" /> Excluir Produto
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-gray-600">
                Tem certeza que deseja excluir <strong>{confirmDeleteTpl.nome}</strong> ({confirmDeleteTpl.cod})?
              </p>
              <p className="text-sm text-red-600">
                Todos os preços vinculados a este produto também serão removidos. Esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setConfirmDeleteTpl(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDeleteTemplate}>
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Definitivamente
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* === CONFIRMAR AÇÃO EM MASSA: TEMPLATES === */}
      {bulkTplAction && (
        <Dialog open onOpenChange={() => setBulkTplAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                {bulkTplAction === 'delete' ? `Excluir ${selectedTpls.size} produto(s)` : `${bulkTplAction === 'activate' ? 'Ativar' : 'Desativar'} ${selectedTpls.size} produto(s)`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-gray-600">
                {bulkTplAction === 'delete'
                  ? `Tem certeza que deseja excluir ${selectedTpls.size} produto(s) do catálogo? Todos os preços vinculados também serão removidos. Esta ação não pode ser desfeita.`
                  : `Confirma ${bulkTplAction === 'activate' ? 'ativar' : 'desativar'} ${selectedTpls.size} produto(s) selecionado(s)?`
                }
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setBulkTplAction(null)}>Cancelar</Button>
                <Button variant={bulkTplAction === 'delete' ? 'destructive' : 'default'} onClick={handleBulkTplConfirm}>
                  {bulkTplAction === 'delete' ? <Trash2 className="w-4 h-4 mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* === CONFIRMAR AÇÃO EM MASSA: PREÇOS === */}
      {bulkSpAction && (
        <Dialog open onOpenChange={() => setBulkSpAction(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                {bulkSpAction === 'delete' ? `Excluir ${selectedSps.size} preço(s)` : `${bulkSpAction === 'enable' ? 'Disponibilizar' : 'Indisponibilizar'} ${selectedSps.size} preço(s)`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-gray-600">
                {bulkSpAction === 'delete'
                  ? `Tem certeza que deseja remover ${selectedSps.size} preço(s) de fornecedor? Esta ação não pode ser desfeita.`
                  : `Confirma ${bulkSpAction === 'enable' ? 'disponibilizar' : 'indisponibilizar'} ${selectedSps.size} preço(s) selecionado(s)?`
                }
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setBulkSpAction(null)}>Cancelar</Button>
                <Button variant={bulkSpAction === 'delete' ? 'destructive' : 'default'} onClick={handleBulkSpConfirm}>
                  {bulkSpAction === 'delete' ? <Trash2 className="w-4 h-4 mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Confirmar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* === CONFIRMAR EXCLUSÃO DE PREÇO === */}
      {confirmDeleteSp && (
        <Dialog open onOpenChange={() => setConfirmDeleteSp(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" /> Remover Preço
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-sm text-gray-600">
                Remover o preço de <strong>{templateMap[confirmDeleteSp.product_id]?.nome || "produto"}</strong> do fornecedor <strong>{supplierMap[confirmDeleteSp.supplier_id]?.empresa || supplierMap[confirmDeleteSp.supplier_id]?.full_name || "—"}</strong>?
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setConfirmDeleteSp(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDeleteSp}>
                  <Trash2 className="w-4 h-4 mr-2" /> Remover
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        )}

        {/* === MODAL: UPLOAD DE FOTO === */}
        <Dialog open={!!fotoModalTpl} onOpenChange={(o) => { if (!o) setFotoModalTpl(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" /> Imagem do Produto
              </DialogTitle>
            </DialogHeader>
            {fotoModalTpl && (
              <FotoUploadModal
                template={fotoModalTpl}
                allTemplates={templates}
                onClose={() => setFotoModalTpl(null)}
                onSaved={() => { setFotoModalTpl(null); loadData(); }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* === IMPORTAR TEMPLATES CSV === */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Upload className="w-5 h-5" /> Importar Templates por CSV
           </DialogTitle>
         </DialogHeader>
         <ImportarTemplatesCsv
           onClose={() => setImportOpen(false)}
           onImported={loadData}
         />
        </DialogContent>
        </Dialog>
        </div>
        );
        }