import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Search, Plus, Pencil, Trash2, Loader2, Package, PackageSearch,
  DollarSign, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import TemplateForm from "@/components/admin/TemplateForm";

const CATEGORIAS = [
  "Anilhas", "Halteres", "Dumbells", "Barras Montadas",
  "Tijolinhos", "Pisos", "Kettlebells", "Suportes", "Outros",
];

const formatBRL = (v) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function AdminProdutos() {
  const { toast } = useToast();
  const [tab, setTab] = useState("catalogo");
  const [loading, setLoading] = useState(true);

  // Catalogo state
  const [templates, setTemplates] = useState([]);
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState(null);
  const [confirmDeleteTpl, setConfirmDeleteTpl] = useState(null);

  // Supplier products state
  const [allSps, setAllSps] = useState([]);
  const [templateMap, setTemplateMap] = useState({});
  const [supplierMap, setSupplierMap] = useState({});
  const [spSearch, setSpSearch] = useState("");
  const [spCatFilter, setSpCatFilter] = useState("all");
  const [editSp, setEditSp] = useState(null);
  const [savingSp, setSavingSp] = useState(false);
  const [confirmDeleteSp, setConfirmDeleteSp] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tmpls, sps, users] = await Promise.all([
        base44.entities.ProductTemplate.list('categoria', 500),
        base44.entities.SupplierProduct.list('-created_date', 500),
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
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (catFilter !== "all" && t.categoria !== catFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.nome?.toLowerCase().includes(s) && !t.cod?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [templates, catFilter, search]);

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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar produto ou SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => { setEditingTpl(null); setFormOpen(true); }}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Adicionar Produto
            </Button>
          </div>

          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Foto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {t.foto ? (
                          <img src={t.foto} alt={t.nome} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.cod}</TableCell>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{t.categoria}</Badge></TableCell>
                      <TableCell className="text-xs">{t.und}</TableCell>
                      <TableCell className="text-center">
                        {t.ativo !== false ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Ativo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingTpl(t); setFormOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setConfirmDeleteTpl(t)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <PackageSearch className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum produto encontrado.</p>
            </div>
          )}
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

          <div className="rounded-lg border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    return (
                      <TableRow key={sp.id}>
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
    </div>
  );
}