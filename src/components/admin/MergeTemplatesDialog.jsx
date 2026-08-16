import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { GitMerge, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function MergeTemplatesDialog({ templates, supplierProducts, onClose, onMerged }) {
  const { toast } = useToast();
  const [keepId, setKeepId] = useState("");
  const [removeId, setRemoveId] = useState("");
  const [saving, setSaving] = useState(false);

  const keepTpl = templates.find(t => t.id === keepId);
  const removeTpl = templates.find(t => t.id === removeId);
  const spsToMove = supplierProducts.filter(sp => sp.product_id === removeId);

  const canConfirm = keepId && removeId && keepId !== removeId;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      // 1. Migra todos os SupplierProducts do template removido para o mantido
      if (spsToMove.length > 0) {
        await base44.entities.SupplierProduct.updateMany(
          { product_id: removeId },
          { $set: { product_id: keepId } }
        );
      }
      // 2. Exclui o template duplicado
      await base44.entities.ProductTemplate.delete(removeId);
      toast({
        title: "Templates unidos!",
        description: `${spsToMove.length} preço(s) migrado(s) para "${keepTpl.nome}". "${removeTpl.nome}" foi removido.`,
      });
      onMerged();
    } catch (e) {
      toast({ title: "Erro ao unir", description: e.message || "Erro na união.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-purple-600" /> Unir Templates
          </DialogTitle>
          <DialogDescription>
            Selecione dois templates duplicados. Os preços do template removido serão migrados para o template mantido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label>Template a MANTER (alvo)</Label>
            <select
              value={keepId}
              onChange={(e) => setKeepId(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.nome} ({t.cod})</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Template a REMOVER (duplicado)</Label>
            <select
              value={removeId}
              onChange={(e) => setRemoveId(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.nome} ({t.cod})</option>
              ))}
            </select>
          </div>

          {keepId && removeId && keepId === removeId && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> Selecione templates diferentes.
            </p>
          )}

          {canConfirm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700 line-clamp-1">{removeTpl.nome}</span>
                <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="font-medium text-blue-700 line-clamp-1">{keepTpl.nome}</span>
              </div>
              <p className="text-xs text-gray-600">
                {spsToMove.length} preço(s) de fornecedor serão migrados. O template "{removeTpl.nome}" será excluído.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitMerge className="w-4 h-4 mr-2" />}
              Unir Templates
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}