import React, { useState, useRef } from "react";
import { UploadFile } from "@/integrations/Core";
import { processDirectCsvUpload } from "@/functions/processDirectCsvUpload";
import { Upload, FileSpreadsheet, Eye, Loader2, CheckCircle, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIAS = [
  "Anilhas","Halteres","Dumbells","Barras Montadas",
  "Tijolinhos","Pisos","Kettlebells","Suportes","Outros"
];

function parseCSV(text) {
  // Remover BOM (Byte Order Mark) comum em exports do Excel
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // Detectar delimitador: ponto e vírgula (Excel BR), vírgula ou tab
  const firstLine = text.split(/\r?\n/)[0] || "";
  let delimiter = ',';
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (semis >= commas && semis >= tabs && semis > 0) delimiter = ';';
  else if (tabs > commas && tabs > 0) delimiter = '\t';

  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { current.push(field); field = ""; }
      else if (ch === '\n' || ch === '\r') {
        if (field || current.length > 0) { current.push(field); rows.push(current); current = []; field = ""; }
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else field += ch;
    }
  }
  if (field || current.length > 0) { current.push(field); rows.push(current); }
  return rows;
}

const parsePreco = (val) => {
  if (!val) return null;
  let s = String(val).replace(/[R$\s]/g, "").trim();
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const formatBRL = (v) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

export default function ImportarTabela({ user }) {
  const [categoria, setCategoria] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview([]);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast({ title: "CSV vazio", description: "O arquivo não tem dados.", variant: "destructive" });
        return;
      }
      const headers = rows[0].map(h => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const idxCod = headers.findIndex(h => h === "codigo" || h === "sku" || h === "cod");
      const idxPreco = headers.findIndex(h => h === "preco" || h === "preço" || h === "valor" || h === "preco_unitario");
      const idxNome = headers.findIndex(h => h === "nome" || h === "descricao" || h === "produto");
      if (idxCod === -1 && idxNome === -1) {
        toast({ title: "Coluna obrigatória", description: 'CSV deve ter ao menos uma coluna "nome" ou "codigo".', variant: "destructive" });
        return;
      }
      const data = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cod = idxCod !== -1 ? (row[idxCod] || "").trim() : "";
        const nome = idxNome !== -1 ? (row[idxNome] || "").trim() : "";
        if (!cod && !nome) continue;
        data.push({
          cod,
          nome,
          preco: idxPreco !== -1 ? parsePreco(row[idxPreco]) : null,
        });
      }
      setPreview(data);
    };
    reader.readAsText(f);
  };

  // Normaliza código removendo tudo que não é alfanumérico, para matching flexível
  const normalizeCod = (cod) => (cod || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    try {
      const { file_url } = await UploadFile({ file });
      const res = await processDirectCsvUpload({ file_url });
      setResult(res.data);
      toast({ title: "Importação concluída!", description: `${(res.data?.created || 0) + (res.data?.updated || 0)} produtos processados.` });
    } catch (e) {
      toast({ title: "Erro", description: e?.message || "Erro ao processar CSV.", variant: "destructive" });
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Arquivo CSV</Label>
              <div className="mt-1 flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  {file ? file.name : "Selecionar arquivo CSV"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreview(p => [...p])} disabled={!file || preview.length === 0}>
              <Eye className="w-4 h-4 mr-2" /> Preview
            </Button>
            <Button
              onClick={handleProcess}
              disabled={!file || processing}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
            >
              {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processando...</> : <><Upload className="w-4 h-4 mr-2" />Processar e Importar</>}
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-medium mb-1">Formato esperado do CSV:</p>
            <p>O arquivo deve conter ao menos a coluna <code className="bg-blue-100 px-1 rounded">nome</code> (descrição do produto) e <code className="bg-blue-100 px-1 rounded">preco</code> (valor numérico).</p>
            <p className="mt-1">A coluna "codigo" é opcional — se presente, será guardada como código de origem para referência. O sistema casa seus produtos ao catálogo padronizado automaticamente.</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Preview — {preview.length} linhas</h3>
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código de Origem</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 100).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{row.cod || "—"}</TableCell>
                        <TableCell className="text-gray-600">{row.nome || "—"}</TableCell>
                        <TableCell className="text-right">{row.preco != null ? formatBRL(row.preco) : <span className="text-red-500">sem preço</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {preview.length > 100 && <p className="text-xs text-gray-400 mt-2">Mostrando as primeiras 100 linhas de {preview.length}.</p>}
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {result && (
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Importação Concluída</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.created || 0}</p>
                <p className="text-xs text-gray-600">Criados</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.updated || 0}</p>
                <p className="text-xs text-gray-600">Atualizados</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{result.unmatched || 0}</p>
                <p className="text-xs text-gray-600">Não encontrados</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-600">{(result.created || 0) + (result.updated || 0)}</p>
                <p className="text-xs text-gray-600">Total importados</p>
              </div>
            </div>
            {result.unmatched > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{result.unmatched} produtos não foram encontrados no catálogo. Verifique se os nomes no CSV correspondem aos produtos do catálogo padronizado.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}