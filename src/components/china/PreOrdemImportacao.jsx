import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Ship, Package, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function PreOrdemImportacao({ items = [], fabricantesChina = [], onClose }) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Agrupar itens por fabricante
  const grouped = items.reduce((acc, item) => {
    const fabId = item.fabricante_china_id || "desconhecido";
    if (!acc[fabId]) {
      const fab = fabricantesChina.find(f => f.id === fabId);
      acc[fabId] = { fabricante: fab, hub: fab?.hub || "—", items: [] };
    }
    acc[fabId].items.push(item);
    return acc;
  }, {});

  const hubs = [...new Set(Object.values(grouped).map(g => g.hub))];
  const precisaConsolidar = hubs.length > 1;

  // Calcular CBM total estimado
  const cbmTotal = items.reduce((sum, item) => {
    const peso = item.peso || 0;
    const cbmItem = peso * 0.002; // estimativa m³/kg para fitness equipment
    return sum + (cbmItem * (item.quantidade || 1));
  }, 0);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      // Criar pre-ordens agrupadas por fabricante China
      for (const [fabId, group] of Object.entries(grouped)) {
        if (!group.fabricante) continue;
        await base44.entities.PedidoChina.create({
          fabricante_china_id: fabId,
          fabricante_nome: group.fabricante.nome_fabrica,
          data_pedido: new Date().toISOString().split("T")[0],
          status: "em_producao",
          moeda: group.fabricante.moeda || "USD",
          cbm_total: cbmTotal / Object.keys(grouped).length,
          taxa_consolidacao_aplicada: group.fabricante.taxa_consolidacao || 8,
          itens: group.items.map(i => ({
            descricao: i.nome || i.descricao,
            quantidade: i.quantidade || 1,
            peso_kg: i.peso || 0,
            cbm: (i.peso || 0) * 0.002 * (i.quantidade || 1),
            preco_unitario: i.preco_fabricante || 0,
            moeda: group.fabricante.moeda || "USD"
          })),
          observacoes: precisaConsolidar ? `⚠️ Consolidação necessária: ${hubs.join(", ")}` : ""
        });
      }
      toast({ title: "Pré-Ordem criada!", description: "Pedido registrado no módulo China com sucesso." });
      onClose?.();
    } catch (err) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="w-5 h-5 text-blue-600" />
            Pré-Ordem de Importação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Alerta de consolidação */}
          {precisaConsolidar && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Consolidação de HUB necessária</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Você selecionou produtos de fábricas em hubs diferentes: <strong>{hubs.join(", ")}</strong>. 
                  Recomendamos consolidar toda a carga em um único hub antes do embarque para reduzir custos.
                </p>
              </div>
            </div>
          )}

          {/* Resumo por fabricante */}
          {Object.values(grouped).map((group, idx) => (
            <Card key={idx} className="border border-gray-200 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      🏭 {group.fabricante?.nome_fabrica || "Fabricante desconhecido"}
                    </p>
                    <p className="text-xs text-gray-500">Hub: {group.hub}</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">
                    {group.items.length} item(ns)
                  </Badge>
                </div>
                <div className="space-y-1">
                  {group.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-600">
                      <span>{item.nome || item.descricao}</span>
                      <span className="text-gray-500">{item.quantidade || 1}x · {item.peso || 0}kg</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* CBM estimado */}
          <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Volume estimado: {cbmTotal.toFixed(3)} m³</p>
              <p className="text-xs text-blue-600">Calculado pelo peso dos itens (0,002 m³/kg)</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={submitting} className="bg-blue-600 text-white">
            {submitting ? "Criando..." : "Confirmar Pré-Ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}