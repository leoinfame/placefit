import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Ship, Package, Globe, Truck, CheckCircle, Clock, TrendingUp,
  AlertTriangle, Box, DollarSign, Factory
} from "lucide-react";

const STATUS_CONFIG = {
  em_producao: { label: "Em Produção", color: "bg-yellow-500", icon: Factory, pct: 15 },
  pronto_embarque: { label: "Pronto p/ Embarque", color: "bg-blue-400", icon: Package, pct: 35 },
  em_transito: { label: "Em Trânsito (Mar)", color: "bg-purple-500", icon: Ship, pct: 60 },
  chegou_brasil: { label: "Chegou ao Brasil", color: "bg-orange-500", icon: Truck, pct: 80 },
  entregue: { label: "Entregue", color: "bg-green-500", icon: CheckCircle, pct: 100 },
};

const HUB_FLAG = {
  Shandong: "🗺️",
  Ningbo: "⚓",
  Shenzhen: "🏙️",
  Guangzhou: "🌆",
};

function ProgressBar({ value, color }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export default function SaudeImportacaoDashboard() {
  const [pedidos, setPedidos] = useState([]);
  const [fabricantes, setFabricantes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [peds, fabs] = await Promise.all([
      base44.entities.PedidoChina.list("-created_date"),
      base44.entities.FabricanteChina.list(),
    ]);
    setPedidos(peds);
    setFabricantes(fabs);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
      </div>
    );
  }

  const ativos = pedidos.filter(p => !["entregue", "cancelado"].includes(p.status));
  const cbmTotal = ativos.reduce((s, p) => s + (p.cbm_total || 0), 0);
  const valorTotal = ativos.reduce((s, p) => s + (p.valor_total_brl || 0), 0);
  const CBM_CONTAINER = 25;
  const cbmPct = Math.min((cbmTotal / CBM_CONTAINER) * 100, 100);

  // Agrupamento por status
  const porStatus = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    key, ...cfg,
    count: ativos.filter(p => p.status === key).length,
  }));

  // Por HUB
  const porHub = fabricantes.reduce((acc, f) => {
    const pedsFab = ativos.filter(p => p.fabricante_china_id === f.id);
    if (pedsFab.length > 0) {
      acc[f.hub] = (acc[f.hub] || 0) + pedsFab.length;
    }
    return acc;
  }, {});

  // Alertas
  const alertas = [];
  if (cbmTotal < CBM_CONTAINER * 0.5 && ativos.length > 0) {
    alertas.push(`Container com ${cbmPct.toFixed(0)}% de ocupação — adicione mais itens para economizar no frete`);
  }
  const emProducaoHa20d = ativos.filter(p =>
    p.status === "em_producao" && p.data_pedido &&
    (new Date() - new Date(p.data_pedido)) / 86400000 > 20
  );
  if (emProducaoHa20d.length > 0) {
    alertas.push(`${emProducaoHa20d.length} pedido(s) em produção há mais de 20 dias — verifique com o fabricante`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-red-600" />
        <h2 className="text-lg font-bold text-gray-900">Saúde da Importação 🇨🇳</h2>
        <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">
          {ativos.length} pedido{ativos.length !== 1 ? "s" : ""} ativo{ativos.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Ship className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-500">Em Trânsito</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">
              {ativos.filter(p => p.status === "em_transito").length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Box className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">CBM Total</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{cbmTotal.toFixed(1)} m³</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">Valor em Trânsito</span>
            </div>
            <p className="text-xl font-bold text-green-700">
              R$ {(valorTotal / 1000).toFixed(0)}k
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Factory className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-gray-500">Fábricas Ativas</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">
              {fabricantes.filter(f => f.ativo).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ocupação do Container */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">Consolidação de Carga — HUB China</span>
            </div>
            <span className="text-sm font-bold text-blue-700">{cbmTotal.toFixed(2)} / {CBM_CONTAINER} m³</span>
          </div>
          <ProgressBar value={cbmPct} color={cbmPct > 80 ? "bg-green-500" : cbmPct > 50 ? "bg-blue-500" : "bg-amber-400"} />
          <p className="text-xs text-gray-400 mt-1.5">
            {cbmPct < 50
              ? `💡 Faltam ${(CBM_CONTAINER - cbmTotal).toFixed(1)} m³ para otimizar o container — adicionar mais produtos reduz o custo de frete proporcionalmente`
              : cbmPct < 80
              ? `📦 Boa ocupação — ainda há espaço para ${(CBM_CONTAINER - cbmTotal).toFixed(1)} m³`
              : `✅ Container bem aproveitado! Excelente otimização de frete`
            }
          </p>
        </CardContent>
      </Card>

      {/* Pipeline de status */}
      {ativos.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm text-gray-700">Pipeline de Importação</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {porStatus.filter(s => s.count > 0).map(s => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{s.label}</span>
                      <span className="text-xs font-bold text-gray-900">{s.count}</span>
                    </div>
                    <ProgressBar value={s.pct} color={s.color} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Por Hub */}
      {Object.keys(porHub).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(porHub).map(([hub, count]) => (
            <Badge key={hub} className="bg-gray-100 text-gray-700 border-gray-200 px-3 py-1.5 text-xs">
              {HUB_FLAG[hub] || "📍"} {hub}: {count} pedido{count > 1 ? "s" : ""}
            </Badge>
          ))}
        </div>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{a}</p>
            </div>
          ))}
        </div>
      )}

      {ativos.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Ship className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum pedido internacional ativo no momento</p>
        </div>
      )}
    </div>
  );
}