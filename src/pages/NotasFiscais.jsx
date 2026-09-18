import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, Settings, ArrowLeft, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";

const STATUS_LABELS = {
  "RASCUNHO": "Rascunho",
  "PENDENTE_CONFIGURACAO": "Pendente Configuração",
  "PRONTA_HOMOLOGACAO": "Pronta para Homologação",
  "EM_PROCESSAMENTO": "Em Processamento",
  "AUTORIZADA": "Autorizada",
  "REJEITADA": "Rejeitada",
  "DENEGADA": "Denegada",
  "CANCELADA": "Cancelada",
  "INUTILIZADA": "Inutilizada",
  "CONTINGENCIA_PENDENTE": "Contingência Pendente",
};

const STATUS_COLORS = {
  "RASCUNHO": "bg-gray-100 text-gray-800",
  "PENDENTE_CONFIGURACAO": "bg-yellow-100 text-yellow-800",
  "PRONTA_HOMOLOGACAO": "bg-blue-100 text-blue-800",
  "EM_PROCESSAMENTO": "bg-indigo-100 text-indigo-800",
  "AUTORIZADA": "bg-green-100 text-green-800",
  "REJEITADA": "bg-red-100 text-red-800",
  "DENEGADA": "bg-red-100 text-red-800",
  "CANCELADA": "bg-gray-100 text-gray-800",
  "INUTILIZADA": "bg-gray-100 text-gray-800",
  "CONTINGENCIA_PENDENTE": "bg-orange-100 text-orange-800",
};

export default function NotasFiscais() {
  const [rascunhos, setRascunhos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      const data = await base44.entities.NotaFiscal.filter(
        { tenant_id: currentUser.id },
        "-created_date"
      );
      setRascunhos(data || []);
    } catch (error) {
      console.error("Erro ao carregar rascunhos fiscais:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = rascunhos.filter(r => {
    const term = searchTerm.toLowerCase();
    return r.pedido_id?.toLowerCase().includes(term) ||
           r.status?.toLowerCase().includes(term) ||
           r.serie?.toLowerCase().includes(term);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notas Fiscais</h1>
              <p className="text-gray-600">Rascunhos fiscais — NF-e modelo 55</p>
            </div>
          </div>
          <Link to="/FinanceiroFiscal">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>

        {/* Aviso de homologação */}
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-yellow-900">
                  Nenhuma NF-e foi emitida. Fluxo em preparação para homologação.
                </p>
                <p className="text-sm text-yellow-800">
                  Os registros abaixo são rascunhos fiscais sem valor legal. Nenhuma chave de acesso,
                  protocolo ou XML foi gerado. A emissão real exige certificado digital A1,
                  credenciamento SEFAZ e confirmação das regras tributárias pelo contador.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Link para configuração */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Configuração Fiscal</p>
                <p className="text-sm text-blue-700">
                  Configure CNPJ, IE, regime, série e certificado antes de homologar
                </p>
              </div>
            </div>
            <Link to="/ConfiguracaoFiscal">
              <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                Configurar
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Busca */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por pedido, status ou série..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista de rascunhos */}
        <div className="grid gap-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhum rascunho fiscal encontrado</p>
                <p className="text-sm text-gray-500 mt-1">
                  Acesse Pedidos de Venda e clique em "Preparar Rascunho Fiscal"
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((rascunho) => (
              <Card key={rascunho.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold">
                          Rascunho {rascunho.modelo || "55"} · Série {rascunho.serie || "—"}
                        </h3>
                        <Badge className={STATUS_COLORS[rascunho.status] || "bg-gray-100 text-gray-800"}>
                          {STATUS_LABELS[rascunho.status] || rascunho.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        Pedido: <span className="font-mono">{rascunho.pedido_id?.slice(-8) || "—"}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        Preparado em: {rascunho.data_preparacao
                          ? new Date(rascunho.data_preparacao).toLocaleString("pt-BR")
                          : "—"}
                      </p>
                      <p className="text-sm text-gray-500">
                        Ambiente: {rascunho.ambiente === "homologacao" ? "Homologação" : "Produção"}
                      </p>
                      {!rascunho.chave_acesso && !rascunho.protocolo && (
                        <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded inline-block">
                          Sem chave de acesso · Sem protocolo · Não transmitido à SEFAZ
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}