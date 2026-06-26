import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { getCatalogoData } from "@/functions/getCatalogoData";
import { Search, Package, Plus, Check, Loader2, Tag, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const [saving, setSaving] = useState(false);
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

  // Unique subcategorias and acabamentos based on selected categoria
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
          className="md:col-span-1"
        />
        <Select value={filters.categoria} onValueChange={(v) => setFilters(f => ({ ...f, categoria: v === "all" ? "" : v, subcategoria: "", acabamento: "" }))}>
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.subcategoria} onValueChange={(v) => setFilters(f => ({ ...f, subcategoria: v === "all" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {subcategoriaOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.acabamento} onValueChange={(v) => setFilters(f => ({ ...f, acabamento: v === "all" ? "" : v }))}>
          <SelectTrigger><SelectValue placeholder="Acabamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os acabamentos</SelectItem>
            {acabamentoOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-gray-500">{filteredTemplates.length} produtos encontrados</p>

      {/* Lista de produtos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(tmpl => {
          const fabPrices = pricesByProduct[tmpl.id] || [];
          const alreadyMine = isProductMine(tmpl.id);
          return (
            <Card key={tmpl.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  {tmpl.foto ? (
                    <img src={tmpl.foto} alt={tmpl.nome} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{tmpl.nome}</p>
                    <p className="text-xs text-gray-400 font-mono">{tmpl.cod}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs">{tmpl.categoria}</Badge>
                  {tmpl.subcategoria && <Badge variant="outline" className="text-xs">{tmpl.subcategoria}</Badge>}
                  {tmpl.acabamento && <Badge variant="outline" className="text-xs">{tmpl.acabamento}</Badge>}
                  {tmpl.peso_kg != null && (
                    <Badge variant="outline" className="text-xs"><Weight className="w-3 h-3 mr-1" />{tmpl.peso_kg}kg</Badge>
                  )}
                </div>

                {/* Fabricantes com preços */}
                {fabPrices.length > 0 ? (
                  <div className="space-y-1.5 border-t pt-2">
                    {fabPrices.map(sp => (
                      <div key={sp.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 truncate">{sp.fabricante_nome}</span>
                        <span className="font-semibold text-green-600">{formatBRL(sp.preco)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 border-t pt-2">Nenhum fabricante com preço cadastrado</p>
                )}

                {isRevendedor && fabPrices.length > 0 && (
                  alreadyMine ? (
                    <Button disabled size="sm" variant="outline" className="w-full">
                      <Check className="w-4 h-4 mr-1" /> Já na sua tabela
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                      onClick={() => setAddModal({ template: tmpl, fabPrices, preco: fabPrices[0].preco, fabricante_nome: fabPrices[0].fabricante_nome, margem: 0, observacoes: "" })}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Adicionar aos Meus Produtos
                    </Button>
                  )
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum produto encontrado com os filtros selecionados.</p>
        </div>
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
                <p className="font-semibold text-gray-900 text-sm">{addModal.template.nome}</p>
                <p className="text-xs text-gray-400 font-mono">{addModal.template.cod}</p>
              </div>

              <div>
                <Label>Selecione o Fabricante</Label>
                <Select
                  value={addModal.fabricante_nome}
                  onValueChange={(v) => {
                    const selected = addModal.fabPrices.find(f => f.fabricante_nome === v);
                    setAddModal(m => ({ ...m, fabricante_nome: v, preco: selected?.preco || 0 }));
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
    </div>
  );
}