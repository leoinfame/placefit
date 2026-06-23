import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle, AlertCircle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { processSupplierTableUpload } from "@/functions/processSupplierTableUpload";
import { processDirectCsvUpload } from "@/functions/processDirectCsvUpload";

export default function UploadTabela({ open, onClose, onComplete }) {
  const [mode, setMode] = useState("csv");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setMode("csv");
      setFile(null);
      setResult(null);
      setError(null);
    }
  }, [open]);

  const getValidTypes = () =>
    mode === "ia"
      ? [".csv", ".xlsx", ".xls", ".json", ".pdf"]
      : [".csv"];

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const validTypes = getValidTypes();
    const ext = selected.name.substring(selected.name.lastIndexOf(".")).toLowerCase();
    if (!validTypes.includes(ext)) {
      toast({
        title: "Formato inválido",
        description: mode === "ia"
          ? "Use CSV, Excel (.xlsx), JSON ou PDF."
          : "Use apenas arquivo CSV.",
        variant: "destructive",
      });
      return;
    }
    setFile(selected);
    setResult(null);
    setError(null);
  };

  const handleProcess = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploading(false);
      setProcessing(true);

      const response = mode === "ia"
        ? await processSupplierTableUpload({ file_url })
        : await processDirectCsvUpload({ file_url });

      const data = response.data;
      setResult(data);
      toast({
        title: mode === "ia" ? "Tabela processada!" : "CSV processado!",
        description: `${data.created + data.updated} produtos vinculados, ${data.unmatched} sem correspondência.`,
      });
    } catch (err) {
      console.error("Erro:", err);
      setError(err.response?.data?.error || err.message || "Erro ao processar arquivo.");
    }
    setUploading(false);
    setProcessing(false);
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setError(null);
    onClose();
    if (result) onComplete();
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const templates = await base44.entities.ProductTemplate.filter({ ativo: true });
      const sorted = [...templates].sort((a, b) => {
        if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
        return (a.cod || "").localeCompare(b.cod || "");
      });

      const header = "codigo,nome,categoria,detalhes,preco,disponivel";
      const rows = sorted.map((t) => {
        const detalhes = renderTemplateDetails(t);
        return [
          t.cod || "",
          t.nome || "",
          t.categoria || "",
          detalhes,
          "",
          "SIM",
        ].map(escapeCsv).join(",");
      });
      const csv = [header, ...rows].join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo_catalogo_placefit.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Modelo baixado!",
        description: `${sorted.length} produtos no catálogo. Preencha a coluna preco e faça upload.`,
      });
    } catch (err) {
      console.error("Erro ao baixar template:", err);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o modelo.",
        variant: "destructive",
      });
    }
    setDownloadingTemplate(false);
  };

  const renderTemplateDetails = (p) => {
    const details = [];
    if (p.subcategoria) details.push(p.subcategoria);
    if (p.acabamento && p.acabamento !== "N/A") details.push(p.acabamento);
    if (p.peso_kg) details.push(`${p.peso_kg}kg`);
    if (p.tipo_furo && p.tipo_furo !== "N/A") details.push(p.tipo_furo);
    if (p.bojo_formato && p.bojo_formato !== "N/A") details.push(p.bojo_formato);
    if (p.barra_tipo && p.barra_tipo !== "N/A") details.push(p.barra_tipo);
    if (p.dumbell_tipo && p.dumbell_tipo !== "N/A") details.push(p.dumbell_tipo);
    if (p.piso_espessura_mm) details.push(`${p.piso_espessura_mm}mm`);
    if (p.piso_formato && p.piso_formato !== "N/A") details.push(p.piso_formato);
    if (p.tijolinho_tipo && p.tijolinho_tipo !== "N/A") details.push(p.tijolinho_tipo);
    if (p.suporte_capacidade_pares) details.push(`${p.suporte_capacidade_pares} pares`);
    if (p.suporte_capacidade_unidades) details.push(`${p.suporte_capacidade_unidades} unid`);
    if (p.suporte_degraus) details.push(`${p.suporte_degraus} degraus`);
    if (p.und) details.push(`und:${p.und}`);
    return details.join(" · ");
  };

  const escapeCsv = (val) => {
    const s = String(val || "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Upload de Tabela de Produtos
          </DialogTitle>
          <DialogDescription>
            Envie sua tabela de produtos para vincular preços ao catálogo padronizado.
          </DialogDescription>
        </DialogHeader>

        {!result && !processing && (
          <div className="space-y-4">
            {/* Seletor de modo */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => { setMode("csv"); setFile(null); }}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === "csv" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                CSV Direto
              </button>
              <button
                onClick={() => { setMode("ia"); setFile(null); }}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === "ia" ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Tabela (IA)
              </button>
            </div>

            {mode === "csv" && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>CSV Direto:</strong> mais rápido e preciso. O CSV deve ter as colunas{" "}
                    <code className="bg-blue-100 px-1 rounded">codigo</code> e{" "}
                    <code className="bg-blue-100 px-1 rounded">preco</code>. Baixe o modelo abaixo,
                    preencha os preços e envie.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="w-full text-gray-600 border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {downloadingTemplate ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <FileDown className="w-3 h-3 mr-1" />
                  )}
                  {downloadingTemplate ? "Gerando modelo..." : "Baixar modelo CSV do catálogo"}
                </Button>
              </>
            )}

            {mode === "ia" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Match por IA:</strong> envie qualquer formato (PDF, Excel, CSV, JSON) com descrições e preços.
                  A IA casará automaticamente cada produto com o catálogo padronizado.
                </p>
              </div>
            )}

            {/* Área de upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={getValidTypes().join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-10 h-10 text-green-600 mx-auto" />
                  <p className="font-medium text-sm text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">Clique para trocar o arquivo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="font-medium text-sm text-gray-700">Clique para selecionar o arquivo</p>
                  <p className="text-xs text-gray-400">
                    {mode === "ia" ? "CSV, Excel (.xlsx), PDF ou JSON" : "Apenas CSV"}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleProcess}
                disabled={!file || uploading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
              >
                {uploading ? "Enviando..." : mode === "ia" ? "Processar Tabela" : "Processar CSV"}
              </Button>
            </div>
          </div>
        )}

        {processing && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
            <div>
              <p className="font-medium text-gray-900">
                {mode === "ia" ? "Processando sua tabela..." : "Processando seu CSV..."}
              </p>
              <p className="text-sm text-gray-500">
                {mode === "ia"
                  ? "A IA está casando seus produtos com o catálogo padronizado."
                  : "Vinculando preços aos produtos do catálogo."}
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-900">
                  {mode === "ia" ? "Tabela processada com sucesso!" : "CSV processado com sucesso!"}
                </p>
                <p className="text-sm text-gray-600 mt-1">{result.total_extracted} produtos encontrados</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                <p className="text-xs text-green-700">Novos</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                <p className="text-xs text-blue-700">Atualizados</p>
              </div>
              <div className="bg-gray-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-600">{result.unmatched}</p>
                <p className="text-xs text-gray-600">Sem match</p>
              </div>
            </div>

            {result.details.unmatched.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase">Produtos sem correspondência:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.details.unmatched.map((u, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-gray-50 rounded p-2">
                      <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-700">{u.descricao}</p>
                        <p className="text-gray-400">{u.motivo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.details.divergencias && result.details.divergencias.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-600 uppercase">Divergências encontradas:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {result.details.divergencias.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-amber-50 rounded p-2">
                      <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-700">{d.descricao}</p>
                        <p className="text-gray-400">{d.motivo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
            >
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}