import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Percent, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Config por revendedor de como o lucro de um fabricante e calculado:
// - paga_comissao = true  -> lucro = percentual_comissao % sobre o valor da venda
// - paga_comissao = false -> lucro = markup (preco de venda - custo do fabricante)
export default function ComissaoConfig({ fabricanteNome, fabricanteId, revendedorId }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [pagaComissao, setPagaComissao] = useState(false);
  const [percentual, setPercentual] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!revendedorId || !fabricanteNome) {
        setLoading(false);
        return;
      }
      try {
        const found = await base44.entities.AcordoComissao.filter({
          revendedor_id: revendedorId,
          fabricante_nome: fabricanteNome,
        });
        if (!active) return;
        const rec = (found && found[0]) || null;
        setRecord(rec);
        setPagaComissao(rec?.paga_comissao || false);
        setPercentual(rec?.percentual_comissao || 0);
      } catch (e) {
        console.error("Erro ao carregar acordo de comissao:", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [revendedorId, fabricanteNome]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        revendedor_id: revendedorId,
        fabricante_nome: fabricanteNome,
        fabricante_id: fabricanteId || "",
        paga_comissao: pagaComissao,
        percentual_comissao: pagaComissao ? parseFloat(percentual) || 0 : 0,
      };
      let saved;
      if (record?.id) {
        saved = await base44.entities.AcordoComissao.update(record.id, payload);
      } else {
        saved = await base44.entities.AcordoComissao.create(payload);
      }
      setRecord(saved || { ...payload, id: record?.id });
      toast.success("Acordo de comissao salvo.");
      setOpen(false);
    } catch (e) {
      console.error("Erro ao salvar acordo:", e);
      toast.error("Erro ao salvar o acordo de comissao.");
    } finally {
      setSaving(false);
    }
  };

  const label = loading
    ? "Comissao..."
    : record?.paga_comissao
    ? `Comissao: ${record.percentual_comissao || 0}%`
    : "Lucro: markup";

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant="outline"
        size="sm"
        className="w-full"
        disabled={loading}
      >
        <Percent className="w-4 h-4 mr-2" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lucro — {fabricanteNome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">Este fabricante paga comissao</Label>
                <p className="text-xs text-gray-500">
                  Ligado: o lucro da venda e a comissao (% sobre o valor vendido).
                  Desligado: o lucro e o markup (venda menos custo).
                </p>
              </div>
              <Switch checked={pagaComissao} onCheckedChange={setPagaComissao} />
            </div>

            {pagaComissao && (
              <div>
                <Label htmlFor="perc_comissao">Percentual de comissao (%)</Label>
                <Input
                  id="perc_comissao"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={percentual}
                  onFocus={(e) => {
                    if (parseFloat(e.target.value) === 0) e.target.select();
                  }}
                  onChange={(e) => setPercentual(parseFloat(e.target.value) || 0)}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
