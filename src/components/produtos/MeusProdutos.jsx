import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { List, Pencil, Trash2, Download, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const sps = await base44.entities.SupplierProduct.filter({ supplier_id: user.id });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
            Você tem {mySps.length} {mySps.length === 1 ? "produto" : "produtos"} na sua tabela de preços
          </Badge>
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
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nome do Produto</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead className="text-right">Preço de Fábrica</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                  <TableHead className="text-right">Preço Final</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mySps.map(sp => {
                  const tmpl = getTemplate(sp.product_id);
                  const precoFinal = (sp.preco || 0) * (1 + (sp.margem || 0) / 100);
                  return (
                    <TableRow key={sp.id}>
                      <TableCell className="font-mono text-xs">{tmpl?.cod || "—"}</TableCell>
                      <TableCell className="font-medium">{tmpl?.nome || "Produto não encontrado"}</TableCell>
                      <TableCell className="text-gray-600">{sp.fabricante_nome || "—"}</TableCell>
                      <TableCell className="text-right">{formatBRL(sp.preco)}</TableCell>
                      <TableCell className="text-right">{sp.margem || 0}%</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{formatBRL(precoFinal)}</TableCell>
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
    </div>
  );
}