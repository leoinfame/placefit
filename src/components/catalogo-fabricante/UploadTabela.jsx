import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";
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

export default function UploadTabela({ open, onClose, onComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const validTypes = [".csv", ".xlsx", ".xls", ".json", ".pdf"];
    const ext = selected.name.substring(selected.name.lastIndexOf(".")).toLowerCase();
    if (!validTypes.includes(ext)) {
      toast({
        title: "Formato inválido",
        description: "Use CSV, Excel (.xlsx), JSON ou PDF.",
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
      // 1. Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploading(false);
      setProcessing(true);

      // 2. Chamar backend para processar
      const response = await processSupplierTableUpload({ file_url });
      const data = response.data;
      setResult(data);
      toast({
        title: "Tabela processada!",
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

  const handleDownloadTemplate = () => {
    const csv = "descricao,categoria,peso,acabamento,tipo_furo,preco\n" +
      "Anilha Olímpica Emborrachada 10kg,Anilhas,10,Emborrachado,Olímpico (Furo 50mm),45.00\n" +
      "Anilha Olímpica Emborrachada 20kg,Anilhas,20,Emborrachado,Olímpico (Furo 50mm),75.00\n" +
      "Halter Hexagonal 15kg,Halteres,15,Injetado,,120.00\n" +
      "Kettlebell 8kg,Kettlebells,8,Pintado,,65.00";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_tabela_placefit.csv";
    a.click();
    URL.revokeObjectURL(url);
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
            Envie sua tabela de produtos (CSV, Excel, PDF ou JSON) e o sistema fará o match automático com o catálogo padronizado, vinculando seus preços.
          </DialogDescription>
        </DialogHeader>

        {!result && !processing && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json,.pdf"
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
                  <p className="text-xs text-gray-400">CSV, Excel (.xlsx), PDF ou JSON</p>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="w-full text-gray-600"
            >
              <Download className="w-3 h-3 mr-1" /> Baixar modelo de tabela
            </Button>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>Importante:</strong> A tabela deve conter pelo menos: descrição do produto e preço. 
                Inclua também categoria, peso e acabamento quando possível para melhor precisão no match automático.
              </p>
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
                {uploading ? "Enviando..." : "Processar Tabela"}
              </Button>
            </div>
          </div>
        )}

        {processing && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
            <div>
              <p className="font-medium text-gray-900">Processando sua tabela...</p>
              <p className="text-sm text-gray-500">A IA está casando seus produtos com o catálogo padronizado.</p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-900">Tabela processada com sucesso!</p>
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

            <Button onClick={handleClose} className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white">
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}