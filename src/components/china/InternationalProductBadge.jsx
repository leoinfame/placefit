import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

export default function InternationalProductBadge({ product, taxaCambio = { RMB: 0.77, USD: 5.8 } }) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Determinar se é produto chinês (tem campo origem_china no futuro, por ora via fabricante_nome)
  const isChinese = product?.fabricante_china_id || product?.origem === "china";
  if (!isChinese) return null;

  const precoUSD = product.preco_fabricante || 0;
  const freteLCL = product.peso ? (product.peso * 3.5) : 0; // estimativa USD/kg para LCL
  const taxaConsolidacao = (product.taxa_consolidacao || 8) / 100;
  const impostoII = 0.20; // II = 20% para NCM 9506.91.00
  const impostoIPI = 0.10;
  const impostoICMS = 0.12;
  const impostosPF = impostoII + impostoIPI + impostoICMS;

  const custoOrigemBRL = precoUSD * (taxaCambio.USD || 5.8);
  const freteIntlBRL = freteLCL * (taxaCambio.USD || 5.8);
  const consolidacaoBRL = custoOrigemBRL * taxaConsolidacao;
  const impostosBRL = (custoOrigemBRL + freteIntlBRL) * impostosPF;
  const totalEstimado = custoOrigemBRL + freteIntlBRL + consolidacaoBRL + impostosBRL;

  return (
    <div className="relative inline-flex items-center gap-1.5 flex-wrap">
      <Badge className="bg-red-50 text-red-700 border border-red-200 gap-1 text-xs">
        🇨🇳 Fabricante Internacional
      </Badge>
      <button
        className="text-gray-400 hover:text-blue-500 transition-colors"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {showTooltip && (
        <div className="absolute z-50 left-0 top-7 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-xs">
          <p className="font-bold text-gray-800 mb-2">📦 Estimativa de Custos (USD)</p>
          <div className="space-y-1.5 text-gray-600">
            <div className="flex justify-between">
              <span>Custo de origem:</span>
              <span className="font-medium text-gray-800">R$ {custoOrigemBRL.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Frete LCL estimado:</span>
              <span className="font-medium text-gray-800">R$ {freteIntlBRL.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa consolidação ({(taxaConsolidacao * 100).toFixed(0)}%):</span>
              <span className="font-medium text-gray-800">R$ {consolidacaoBRL.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-orange-600">
              <span>Impostos estimados (II+IPI+ICMS):</span>
              <span className="font-medium">R$ {impostosBRL.toFixed(2)}</span>
            </div>
            <div className="h-px bg-gray-100 my-1" />
            <div className="flex justify-between font-bold text-gray-900">
              <span>Total estimado:</span>
              <span className="text-green-700">R$ {totalEstimado.toFixed(2)}</span>
            </div>
          </div>
          <p className="mt-2 text-gray-400 text-[10px]">* Valores estimados. NCM 9506.91.00</p>
        </div>
      )}
    </div>
  );
}