import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship, Package, CheckCircle, Loader2, MapPin } from "lucide-react";

const STATUS_STEPS = [
  { key: "em_producao", label: "Em Produção", icon: "🏭" },
  { key: "pronto_embarque", label: "Pronto p/ Embarque", icon: "📦" },
  { key: "em_transito", label: "Em Trânsito", icon: "🚢" },
  { key: "chegou_brasil", label: "Chegou ao Brasil", icon: "🇧🇷" },
  { key: "entregue", label: "Entregue", icon: "✅" },
];

const STATUS_ORDER = STATUS_STEPS.map(s => s.key);

export default function ContainerTracker() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPedidos();
  }, []);

  const loadPedidos = async () => {
    try {
      const all = await base44.entities.PedidoChina.list("-created_date", 10);
      setPedidos(all.filter(p => p.status !== "cancelado"));
    } catch {
      // silently fail
    }
    setLoading(false);
  };

  if (loading) return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando rastreador...
      </CardContent>
    </Card>
  );

  if (pedidos.length === 0) return null;

  const cbmTotal = pedidos.filter(p => ["em_transito", "pronto_embarque"].includes(p.status))
    .reduce((s, p) => s + (p.cbm_total || 0), 0);

  return (
    <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Ship className="w-5 h-5 text-blue-600" />
          Rastreador de Container China
          {cbmTotal > 0 && (
            <Badge className="ml-auto bg-blue-100 text-blue-800 border-0 font-normal text-xs">
              {cbmTotal.toFixed(2)} m³ em trânsito
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-3">
        {pedidos.slice(0, 3).map(pedido => {
          const currentIdx = STATUS_ORDER.indexOf(pedido.status);
          return (
            <div key={pedido.id} className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-800">
                  🏭 {pedido.fabricante_nome || "Fabricante"} · #{(pedido.numero_pedido || pedido.id.slice(-6).toUpperCase())}
                </span>
                {pedido.data_embarque_prevista && (
                  <span className="text-[10px] text-gray-400">Embarque: {pedido.data_embarque_prevista}</span>
                )}
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-0.5 mt-1">
                {STATUS_STEPS.filter(s => s.key !== "entregue").map((step, idx) => {
                  const stepIdx = STATUS_ORDER.indexOf(step.key);
                  const done = stepIdx <= currentIdx;
                  const active = stepIdx === currentIdx;
                  return (
                    <React.Fragment key={step.key}>
                      <div className="flex flex-col items-center" style={{ minWidth: 0, flex: 1 }}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border-2 transition-all
                          ${done ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 text-gray-400"}
                          ${active ? "ring-2 ring-blue-300 ring-offset-1" : ""}
                        `}>
                          {step.icon}
                        </div>
                        <span className={`text-[9px] mt-0.5 text-center leading-tight ${done ? "text-blue-700 font-medium" : "text-gray-400"}`}>
                          {step.label.split(" ").slice(0, 2).join(" ")}
                        </span>
                      </div>
                      {idx < STATUS_STEPS.length - 2 && (
                        <div className={`h-0.5 flex-1 mx-0.5 rounded-full ${stepIdx < currentIdx ? "bg-blue-500" : "bg-gray-200"}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-2 flex-wrap">
                {pedido.cbm_total && (
                  <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    📐 {pedido.cbm_total.toFixed(3)} m³
                  </span>
                )}
                {pedido.valor_total_brl && (
                  <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    R$ {pedido.valor_total_brl.toLocaleString("pt-BR", {minimumFractionDigits: 2})}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {pedidos.length > 3 && (
          <p className="text-xs text-gray-400 text-center">+{pedidos.length - 3} pedidos no módulo China</p>
        )}
      </CardContent>
    </Card>
  );
}