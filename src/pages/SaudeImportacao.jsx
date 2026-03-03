import React from "react";
import SaudeImportacaoDashboard from "@/components/china/SaudeImportacaoDashboard";

export default function SaudeImportacao() {
  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🚢 Saúde da Importação</h1>
          <p className="text-gray-500 mt-1">Monitoramento em tempo real dos pedidos internacionais PlaceFit</p>
        </div>
        <SaudeImportacaoDashboard />
      </div>
    </div>
  );
}