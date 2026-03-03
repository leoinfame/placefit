import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Package, ImageIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIAS = ["Cardiovascular", "Musculação", "Funcional", "Acessórios", "Vestuário", "Nutrição"];
const EMPTY = {
  nome: "", cod: "", foto: "", categoria: "Musculação", und: "peça",
  peso: "", dimensoes: "", preco_rmb: "", cbm_unitario: "", ncm: "9506.91.00", ativo: true
};

export default function ProdutosChinaForm({ fabricante }) {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const { toast } = useToast();

  useEffect(() => {
    if (fabricante?.id) loadProdutos();
  }, [fabricante]);

  const loadProdutos = async () => {
    setLoading(true);
    const all = await base44.entities.Product.filter({ fabricante_china_id: fabricante.id });
    setProdutos(all);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.nome || !form.cod) {
      toast({ title: "Preencha nome e código", variant: "destructive" });
      return;
    }
    const data = {
      ...form,
      origem: "china",
      fabricante_china_id: fabricante.id,
      fabricante_china_nome: fabricante.nome_fabrica,
      // também preenche fabricante_nome para aparecer igual ao nacional
      fabricante_nome: fabricante.nome_fabrica,
      aprovado_produto: true, // produtos chineses já aprovados pelo admin
      preco_rmb: parseFloat(form.preco_rmb) || 0,
      cbm_unitario: parseFloat(form.cbm_unitario) || 0,
      peso: parseFloat(form.peso) || 0,
    };
    if (editItem) {
      await base44.entities.Product.update(editItem.id, data);
    } else {
      await base44.entities.Product.create(data);
    }
    toast({ title: editItem ? "Produto atualizado!" : "Produto cadastrado!" });
    setShowForm(false);
    setEditItem(null);
    setForm(EMPTY);
    loadProdutos();
  };

  const handleEdit = (p) => {
    setEditItem(p);
    setForm({ ...EMPTY, ...p });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Remover este produto?")) return;
    await base44.entities.Product.delete(id);
    toast({ title: "Produto removido" });
    loadProdutos();
  };

  if (!fabricante) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Produtos cadastrados aparecem no catálogo e na seleção de produtos igual aos nacionais.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditItem(null); setForm(EMPTY); setShowForm(true); }}
          className="bg-blue-600 text-white">
          <Plus className="w-4 h-4 mr-1" /> Novo Produto
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : produtos.length === 0 ? (
        <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum produto ainda. Clique em "Novo Produto" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {produtos.map(p => (
            <Card key={p.id} className="border border-gray-100 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {p.foto ? (
                    <img src={p.foto} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{p.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{p.cod}</span>
                    {p.preco_rmb > 0 && (
                      <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5">
                        ¥ {p.preco_rmb}
                      </Badge>
                    )}
                    {p.cbm_unitario > 0 && (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5">
                        {p.cbm_unitario} m³
                      </Badge>
                    )}
                    <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] px-1.5">
                      🇨🇳 China
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(p)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">🇨🇳</span>
              {editItem ? "Editar Produto" : "Novo Produto"} — {fabricante.nome_fabrica}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome do Produto *</Label>
              <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
                placeholder="Ex: Bumper Plate 20kg" className="mt-1" />
            </div>
            <div>
              <Label>Código (SKU) *</Label>
              <Input value={form.cod} onChange={e => setForm({...form, cod: e.target.value})}
                placeholder="APE-BP-20" className="mt-1" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({...form, categoria: v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preço de Fábrica (¥ RMB)</Label>
              <Input type="number" value={form.preco_rmb} onChange={e => setForm({...form, preco_rmb: e.target.value})}
                placeholder="280" className="mt-1" />
            </div>
            <div>
              <Label>Volume por unidade (m³ CBM)</Label>
              <Input type="number" step="0.001" value={form.cbm_unitario} onChange={e => setForm({...form, cbm_unitario: e.target.value})}
                placeholder="0.080" className="mt-1" />
            </div>
            <div>
              <Label>Peso (kg)</Label>
              <Input type="number" value={form.peso} onChange={e => setForm({...form, peso: e.target.value})}
                placeholder="20" className="mt-1" />
            </div>
            <div>
              <Label>Dimensões (cm)</Label>
              <Input value={form.dimensoes} onChange={e => setForm({...form, dimensoes: e.target.value})}
                placeholder="45 x 45 x 6" className="mt-1" />
            </div>
            <div>
              <Label>NCM</Label>
              <Input value={form.ncm} onChange={e => setForm({...form, ncm: e.target.value})}
                placeholder="9506.91.00" className="mt-1" />
            </div>
            <div>
              <Label>Unidade de Venda</Label>
              <Select value={form.und} onValueChange={v => setForm({...form, und: v})}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["peça","par","kg","metro","litro","caixa"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>URL da Foto</Label>
              <Input value={form.foto} onChange={e => setForm({...form, foto: e.target.value})}
                placeholder="https://..." className="mt-1" />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-blue-600 text-white">
              {editItem ? "Salvar" : "Cadastrar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}