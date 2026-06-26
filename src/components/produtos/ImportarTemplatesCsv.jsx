import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

const CATEGORIAS = [
  "Anilhas","Halteres","Dumbells","Barras Montadas",
  "Tijolinhos","Pisos","Kettlebells","Suportes","Outros"
];
const UNIDADES = ["peça","par","kg","m²","kit"];

const COLUNAS_OBRIGATORIAS = ["nome","cod","categoria","und"];
const COLUNAS_OPCIONAIS = [
  "subcategoria","acabamento","tipo_furo","peso_kg","peso_fracionado",
  "barra_tipo","barra_acabamento","bojo_formato","dumbell_tipo",
  "piso_espessura_mm","piso_formato","tijolinho_tipo","tijolinho_torre",
  "suporte_capacidade_pares","suporte_capacidade_unidades","suporte_modelo",
  "suporte_estrutura","suporte_degraus","suporte_torre_capacidade","suporte_torre_tipo",
  "foto","google_category","ncm","gtin","descricao_padrao","ativo"
];

const NUM_FIELDS = [
  "peso_kg","piso_espessura_mm","suporte_capacidade_pares",
  "suporte_capacidade_unidades","suporte_degraus"
];
const BOOL_FIELDS = ["peso_fracionado","ativo"];

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.split(/\r?\n/)[0] || "";
  let delimiter = ",";
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (semis >= commas && semis >= tabs && semis > 0) delimiter = ";";
  else if (tabs > commas && tabs > 0) delimiter = "\t";

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
      else if (ch === "\n" || ch === "\r") {
        if (field || current.length > 0) { current.push(field); rows.push(current); current = []; field = ""; }
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else field += ch;
    }
  }
  if (field || current.length > 0) { current.push(field); rows.push(current); }
  return rows;
}

const parseNum = (val) => {
  if (!val) return null;
  let s = String(val).trim().replace(/\s/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const parseBool = (val) => {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return ["true","sim","1","verdadeiro","yes"].includes(s);
};

export default function ImportarTemplatesCsv({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [errors, setErrors] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview([]);
    setErrors([]);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast({ title: "CSV vazio", description: "O arquivo não tem dados.", variant: "destructive" });
        return;
      }
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const missing = COLUNAS_OBRIGATORIAS.filter((c) => !headers.includes(c));
      if (missing.length > 0) {
        toast({
          title: "Colunas obrigatórias faltando",
          description: `Faltam: ${missing.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      const idx = (col) => headers.indexOf(col);
      const data = [];
      const errs = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const nome = (row[idx("nome")] || "").trim();
        const cod = (row[idx("cod")] || "").trim();
        if (!nome && !cod) continue;

        const categoria = (row[idx("categoria")] || "").trim();
        const und = (row[idx("und")] || "").trim();

        if (!nome) errs.push(`Linha ${i + 1}: nome vazio`);
        if (!cod) errs.push(`Linha ${i + 1}: código (SKU) vazio`);
        if (categoria && !CATEGORIAS.includes(categoria))
          errs.push(`Linha ${i + 1}: categoria "${categoria}" inválida`);
        if (und && !UNIDADES.includes(und))
          errs.push(`Linha ${i + 1}: unidade "${und}" inválida`);

        const obj = { nome, cod, categoria: categoria || "Outros", und: und || "peça" };

        for (const col of COLUNAS_OPCIONAIS) {
          const ci = idx(col);
          if (ci === -1) continue;
          const raw = (row[ci] || "").trim();
          if (!raw) continue;
          if (NUM_FIELDS.includes(col)) {
            const n = parseNum(raw);
            if (n !== null) obj[col] = n;
          } else if (BOOL_FIELDS.includes(col)) {
            obj[col] = parseBool(raw);
          } else {
            obj[col] = raw;
          }
        }
        if (obj.ativo === undefined) obj.ativo = true;
        if (!obj.google_category) obj.google_category = "Sporting Goods > Exercise & Fitness";
        if (!obj.ncm) obj.ncm = "9506.91.00";

        data.push(obj);
      }
      setPreview(data);
      setErrors(errs);
    };
    reader.readAsText(f);
  };

  const handleDownloadModelo = () => {
    const allCols = [...COLUNAS_OBRIGATORIAS, ...COLUNAS_OPCIONAIS];
    const sample = [
      "Anilha Olímpica Bumper 20kg",
      "ANI-OLI-EMB-020",
      "Anilhas",
      "peça",
      "",
      "Bumper",
      "Olímpico (Furo 50mm)",
      "20",
      "false",
      "N/A",
      "N/A",
      "N/A",
      "N/A",
      "",
      "N/A",
      "N/A",
      "N/A",
      "",
      "",
      "N/A",
      "N/A",
      "",
      "",
      "N/A",
      "N/A",
      "",
      "Sporting Goods > Exercise & Fitness",
      "9506.91.00",
      "",
      "Anilha bumper 20kg olímpica",
      "true",
    ];
    const csv = [allCols.join(";"), sample.join(";")].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_templates_placefit.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setProcessing(true);
    setResult(null);
    try {
      const created = await base44.entities.ProductTemplate.bulkCreate(preview);
      const count = Array.isArray(created) ? created.length : preview.length;
      setResult({ created: count, total: preview.length });
      toast({
        title: "Importação concluída!",
        description: `${count} template(s) criado(s).`,
      });
      if (onImported) onImported();
      if (onClose) onClose();
    } catch (e) {
      toast({
        title: "Erro na importação",
        description: e?.message || "Erro ao criar templates.",
        variant: "destructive",
      });
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          Importe múltiplos templates de uma vez via CSV. Colunas obrigatórias:{" "}
          <strong>nome, cod, categoria, und</strong>.
        </p>
        <Button variant="outline" size="sm" onClick={handleDownloadModelo}>
          <Download className="w-4 h-4 mr-2" /> Baixar Modelo
        </Button>
      </div>

      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" /> Selecionar arquivo CSV
        </Button>
        {file && (
          <p className="mt-2 text-sm text-gray-500 flex items-center justify-center gap-1">
            <FileSpreadsheet className="w-4 h-4" /> {file.name}
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {errors.length} aviso(s) — as linhas com erro serão puladas
                </p>
                <ul className="text-xs text-amber-700 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {errors.slice(0, 20).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {preview.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="text-sm font-medium">
                Pré-visualização ({preview.length} template{preview.length !== 1 ? "s" : ""})
              </span>
              {!result && (
                <Button
                  onClick={handleImport}
                  disabled={processing}
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4 mr-2" /> Importar {preview.length} template(s)</>
                  )}
                </Button>
              )}
            </div>
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead>Peso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{t.cod}</TableCell>
                      <TableCell className="font-medium text-sm">{t.nome}</TableCell>
                      <TableCell className="text-xs">{t.categoria}</TableCell>
                      <TableCell className="text-xs">{t.und}</TableCell>
                      <TableCell className="text-xs">{t.peso_kg || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                {result.created} de {result.total} template(s) criado(s) com sucesso!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
}