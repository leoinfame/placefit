import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { GitMerge, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function MergeTemplatesDialog({ selectedTemplates, supplierProducts, onClose, onMerged }) {
  const { toast } = useToast();
  const [keepId, setKeepId] = useState("");
  const [saving, setSaving] = useState(false);

  const keepTpl = selectedTemplates.find(t => t.id === keepId);
  const removeTpl = selectedTemplates.find(t => t.id !== keepId);
  const removeId = removeTpl?.id;
  const spsToMove = removeId ? supplierProducts.filter(sp => sp.product_id === removeId) : [];

  const handleConfirm = async () => {
    if (!keepId || !removeId) return;
    setSaving(true);
    try {
      if (spsToMove.length > 0) {
        await base44.entities.SupplierProduct.updateMany(
          { product_id: removeId },
          { $set: { product_id: keepId } }
        );
      }
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
            Escolha qual dos dois templates selecionados deve ser mantido. O outro será removido e seus preços migrados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label>Qual template manter?</Label>
            <div className="mt-2 space-y-2">
              {selectedTemplates.map(t => (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${keepId === t.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <input
                    type="radio"
                    name="keepTpl"
                    value={t.id}
                    checked={keepId === t.id}
                    onChange={(e) => setKeepId(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{t.nome}</p>
                    <p className="text-xs text-gray-500 font-mono">{t.cod} · {t.categoria}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {keepId && removeTpl && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700 line-clamp-1 flex-1">{removeTpl.nome}</span>
                <ArrowRight className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="font-medium text-blue-700 line-clamp-1 flex-1">{keepTpl.nome}</span>
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
              disabled={!keepId || saving}
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