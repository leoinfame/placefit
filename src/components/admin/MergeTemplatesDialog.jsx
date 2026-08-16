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
  const removeTpls = selectedTemplates.filter(t => t.id !== keepId);
  const removeIds = removeTpls.map(t => t.id);
  const spsToMove = removeIds.length > 0 ? supplierProducts.filter(sp => removeIds.includes(sp.product_id)) : [];

  const handleConfirm = async () => {
    if (!keepId || removeIds.length === 0) return;
    setSaving(true);
    try {
      // Migrar todos os preços dos templates removidos para o mantido
      if (spsToMove.length > 0) {
        await base44.entities.SupplierProduct.updateMany(
          { product_id: { $in: removeIds } },
          { $set: { product_id: keepId } }
        );
      }
      // Excluir todos os templates duplicados
      await base44.entities.ProductTemplate.deleteMany({ id: { $in: removeIds } });
      toast({
        title: "Templates unidos!",
        description: `${spsToMove.length} preço(s) migrado(s) para "${keepTpl.nome}". ${removeTpls.length} template(s) removido(s).`,
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
            <GitMerge className="w-5 h-5 text-purple-600" /> Unir {selectedTemplates.length} Templates
          </DialogTitle>
          <DialogDescription>
            Escolha qual template deve ser mantido. Todos os outros serão removidos e seus preços migrados para o mantido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label>Qual template manter?</Label>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
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

          {keepId && removeTpls.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium text-blue-700">
                {removeTpls.length} template(s) serão removidos:
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {removeTpls.map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-xs text-gray-700">
                    <span className="line-clamp-1 flex-1">{t.nome}</span>
                    <ArrowRight className="w-3 h-3 text-blue-600 flex-shrink-0" />
                    <span className="font-medium text-blue-700 line-clamp-1">{keepTpl.nome}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 pt-1">
                {spsToMove.length} preço(s) de fornecedor serão migrados.
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
              Unir {removeTpls.length || ""} em 1
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}