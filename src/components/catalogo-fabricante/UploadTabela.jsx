import React, { useState, useRef, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle, AlertCircle,
  FileDown, ArrowLeft, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { processSupplierTableUpload } from "@/functions/processSupplierTableUpload";
import { processDirectCsvUpload } from "@/functions/processDirectCsvUpload";
import { confirmarImportacaoTabela } from "@/functions/confirmarImportacaoTabela";

const formatBRL = (v) =>
  v != null ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const STATUS_META = {
  verde: {
    label: "Pode aplicar",
    badge: "bg-green-100 text-green-800 border-green-200",
    row: "border-green-200",
  },
  amarelo: {
    label: "Confira",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    row: "border-amber-200",
  },
  vermelho: {
    label: "Precisa escolher",
    badge: "bg-red-100 text-red-800 border-red-200",
    row: "border-red-200",
  },
};

export default function UploadTabela({ open, onClose, onComplete }) {
  const [etapa, setEtapa] = useState("upload"); // upload | conferencia | concluido
  const [mode, setMode] = useState("csv");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [plano, setPlano] = useState(null);
  const [decisoes, setDecisoes] = useState({});
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [templates, setTemplates] = useState([]);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setEtapa("upload");
      setMode("csv");
      setFile(null);
      setPlano(null);
      setDecisoes({});
      setResultado(null);
      setError(null);
      setFiltroStatus("todos");
    }
  }, [open]);

  const getValidTypes = () =>
    mode === "ia" ? [".csv", ".xlsx", ".xls", ".json", ".pdf"] : [".csv"];

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const ext = selected.name.substring(selected.name.lastIndexOf(".")).toLowerCase();
    if (!getValidTypes().includes(ext)) {
      toast({
        title: "Formato inválido",
        description: mode === "ia" ? "Use CSV, Excel, JSON ou PDF." : "Use apenas arquivo CSV.",
        variant: "destructive",
      });
      return;
    }
    setFile(selected);
    setError(null);
  };

  // ------------------------------------------------------------ etapa 1: analisar

  const handleAnalisar = async () => {
    if (!file) return;
    setBusy(true);
    setBusyLabel("Enviando arquivo...");
    setError(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setBusyLabel(
        mode === "ia"
          ? "A IA está lendo sua tabela e comparando com o catálogo..."
          : "Comparando sua tabela com o catálogo..."
      );

      const response =
        mode === "ia"
          ? await processSupplierTableUpload({ file_url })
          : await processDirectCsvUpload({ file_url });

      const data = response.data;
      if (data?.error) throw new Error(data.error);

      const itens = data.itens || [];
      const iniciais = {};
      for (const it of itens) {
        // Verde entra marcado. Amarelo entra marcado, salvo quando o preço foi
        // interpretado como por quilo — esse caso exige opt-in explícito, porque
        // multiplica o valor por todas as faixas de peso. Vermelho entra desmarcado.
        const incluir =
          it.status === "verde" ||
          (it.status === "amarelo" && !it.preco_kg_inferido);
        iniciais[it.linha] = {
          incluir,
          product_id: it.match?.product_id || "",
          tipo_preco: it.tipo_preco || "unitario",
          preco: it.preco ?? "",
        };
      }

      setPlano(data);
      setDecisoes(iniciais);
      setEtapa("conferencia");

      // Catálogo carregado uma vez, para permitir corrigir um casamento errado.
      if (templates.length === 0) {
        base44.entities.ProductTemplate.filter({ ativo: true })
          .then((tpls) =>
            setTemplates(
              tpls.map((t) => ({
                product_id: t.id, cod: t.cod, nome: t.nome,
                categoria: t.categoria, peso_kg: t.peso_kg,
              }))
            )
          )
          .catch(() => {});
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || "Erro ao analisar o arquivo.");
    }
    setBusy(false);
    setBusyLabel("");
  };

  // ------------------------------------------------------------ etapa 2: confirmar

  const itensFiltrados = useMemo(() => {
    if (!plano?.itens) return [];
    if (filtroStatus === "todos") return plano.itens;
    return plano.itens.filter((it) => it.status === filtroStatus);
  }, [plano, filtroStatus]);

  const selecionadas = useMemo(
    () => Object.values(decisoes).filter((d) => d.incluir && d.product_id).length,
    [decisoes]
  );

  const variacoesEstimadas = useMemo(() => {
    if (!plano?.itens) return 0;
    return plano.itens.reduce((acc, it) => {
      const d = decisoes[it.linha];
      if (!d?.incluir || !d.product_id) return acc;
      return acc + (d.tipo_preco === "kg" ? it.variacoes_afetadas || 1 : 1);
    }, 0);
  }, [plano, decisoes]);

  const setDecisao = (linha, patch) =>
    setDecisoes((prev) => ({ ...prev, [linha]: { ...prev[linha], ...patch } }));

  const marcarTodos = (status, incluir) => {
    setDecisoes((prev) => {
      const next = { ...prev };
      for (const it of plano.itens) {
        if (it.status !== status) continue;
        if (incluir && !next[it.linha]?.product_id) continue;
        next[it.linha] = { ...next[it.linha], incluir };
      }
      return next;
    });
  };

  const handleConfirmar = async () => {
    const payload = [];
    for (const it of plano.itens) {
      const d = decisoes[it.linha];
      if (!d?.incluir || !d.product_id) continue;
      const preco = Number(d.preco);
      if (!preco || preco <= 0) continue;
      payload.push({
        product_id: d.product_id,
        preco,
        tipo_preco: d.tipo_preco,
        disponivel: it.disponivel !== false,
        cod_origem: it.cod_origem,
        descricao_origem: it.descricao_origem,
        origem_match: it.origem_match || "manual",
        salvar_mapeamento: true,
      });
    }

    if (payload.length === 0) {
      toast({
        title: "Nada selecionado",
        description: "Marque ao menos uma linha para aplicar.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    setBusyLabel("Aplicando preços e salvando os mapeamentos...");
    try {
      const response = await confirmarImportacaoTabela({ decisoes: payload });
      const data = response.data;
      if (data?.error) throw new Error(data.error);
      setResultado(data);
      setEtapa("concluido");
      toast({
        title: "Tabela atualizada!",
        description: `${data.criados + data.atualizados} preços gravados.`,
      });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || "Erro ao aplicar as alterações.");
    }
    setBusy(false);
    setBusyLabel("");
  };

  const handleClose = () => {
    const houveGravacao = !!resultado;
    setFile(null);
    setPlano(null);
    setDecisoes({});
    setResultado(null);
    setError(null);
    setEtapa("upload");
    onClose();
    if (houveGravacao) onComplete();
  };

  // ------------------------------------------------------------ modelo CSV

  const escapeCsv = (val) => {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const renderTemplateDetails = (p) => {
    const d = [];
    if (p.subcategoria) d.push(p.subcategoria);
    if (p.acabamento && p.acabamento !== "N/A") d.push(p.acabamento);
    if (p.peso_kg) d.push(`${p.peso_kg}kg`);
    if (p.tipo_furo && p.tipo_furo !== "N/A") d.push(p.tipo_furo);
    if (p.bojo_formato && p.bojo_formato !== "N/A") d.push(p.bojo_formato);
    if (p.dumbell_tipo && p.dumbell_tipo !== "N/A") d.push(p.dumbell_tipo);
    if (p.und) d.push(`und:${p.und}`);
    return d.join(" · ");
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const tpls = await base44.entities.ProductTemplate.filter({ ativo: true });
      const sorted = [...tpls].sort((a, b) =>
        a.categoria !== b.categoria
          ? String(a.categoria).localeCompare(String(b.categoria))
          : String(a.cod || "").localeCompare(String(b.cod || ""))
      );
      const header = "codigo,nome,categoria,detalhes,preco,tipo_preco,disponivel";
      const rows = sorted.map((t) =>
        [t.cod || "", t.nome || "", t.categoria || "", renderTemplateDetails(t), "", "unitario", "SIM"]
          .map(escapeCsv)
          .join(",")
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo_catalogo_placefit.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Modelo baixado!",
        description: `${sorted.length} produtos. Preencha "preco" e envie de volta.`,
      });
    } catch {
      toast({ title: "Erro", description: "Não foi possível gerar o modelo.", variant: "destructive" });
    }
    setDownloadingTemplate(false);
  };

  // ------------------------------------------------------------ render

  const larguraDialog = etapa === "conferencia" ? "max-w-5xl" : "max-w-lg";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className={`${larguraDialog} max-h-[92vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            {etapa === "conferencia" ? "Confira antes de aplicar" : "Upload de Tabela de Produtos"}
          </DialogTitle>
          <DialogDescription>
            {etapa === "conferencia"
              ? "Nada foi gravado ainda. Revise as linhas abaixo e aplique só o que estiver correto."
              : "Envie sua tabela para vincular preços ao catálogo padronizado."}
          </DialogDescription>
        </DialogHeader>

        {/* ---------------------------------------------------- etapa upload */}
        {etapa === "upload" && !busy && (
          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              {["csv", "ia"].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setFile(null); }}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === m ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m === "csv" ? "CSV Direto" : "Tabela (IA)"}
                </button>
              ))}
            </div>

            {mode === "csv" ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>CSV Direto:</strong> mais rápido e preciso. Precisa das colunas{" "}
                    <code className="bg-blue-100 px-1 rounded">nome</code> ou{" "}
                    <code className="bg-blue-100 px-1 rounded">codigo</code>, e{" "}
                    <code className="bg-blue-100 px-1 rounded">preco</code>. A coluna{" "}
                    <code className="bg-blue-100 px-1 rounded">tipo_preco</code> aceita{" "}
                    <code className="bg-blue-100 px-1 rounded">unitario</code> ou{" "}
                    <code className="bg-blue-100 px-1 rounded">kg</code>.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  {downloadingTemplate
                    ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    : <FileDown className="w-3 h-3 mr-1" />}
                  {downloadingTemplate ? "Gerando modelo..." : "Baixar modelo CSV do catálogo"}
                </Button>
              </>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Leitura por IA:</strong> envie PDF, Excel, CSV ou JSON com descrições e preços.
                  A IA propõe o casamento com o catálogo — você confere antes de aplicar.
                </p>
              </div>
            )}

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
                    {mode === "ia" ? "CSV, Excel, PDF ou JSON" : "Apenas CSV"}
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
              <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleAnalisar}
                disabled={!file}
                className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white"
              >
                Analisar tabela
              </Button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- carregando */}
        {busy && (
          <div className="py-10 text-center space-y-4">
            <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
            <p className="font-medium text-gray-900">{busyLabel}</p>
            <p className="text-sm text-gray-500">Isso pode levar alguns segundos.</p>
          </div>
        )}

        {/* ---------------------------------------------------- etapa conferência */}
        {etapa === "conferencia" && plano && !busy && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: "todos", n: plano.resumo.total, label: "Linhas", cls: "bg-gray-100 text-gray-700" },
                { k: "verde", n: plano.resumo.verde, label: "Pode aplicar", cls: "bg-green-100 text-green-700" },
                { k: "amarelo", n: plano.resumo.amarelo, label: "Confira", cls: "bg-amber-100 text-amber-700" },
                { k: "vermelho", n: plano.resumo.vermelho, label: "Escolher", cls: "bg-red-100 text-red-700" },
              ].map((c) => (
                <button
                  key={c.k}
                  onClick={() => setFiltroStatus(c.k)}
                  className={`${c.cls} rounded-lg p-3 text-center transition-all ${
                    filtroStatus === c.k ? "ring-2 ring-offset-1 ring-blue-500" : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <p className="text-2xl font-bold">{c.n}</p>
                  <p className="text-xs">{c.label}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">Ações rápidas:</span>
              <Button size="sm" variant="outline" onClick={() => marcarTodos("amarelo", true)}>
                Aceitar todos os amarelos
              </Button>
              <Button size="sm" variant="outline" onClick={() => marcarTodos("amarelo", false)}>
                Desmarcar amarelos
              </Button>
            </div>

            <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
              {itensFiltrados.map((it) => {
                const d = decisoes[it.linha] || {};
                const meta = STATUS_META[it.status];
                const opcoes = [
                  ...(it.match ? [it.match] : []),
                  ...(it.candidatos || []).filter((c) => c.product_id !== it.match?.product_id),
                ];
                return (
                  <div key={it.linha} className={`border rounded-lg p-3 ${meta.row} bg-white`}>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={!!d.incluir}
                        disabled={!d.product_id}
                        onCheckedChange={(v) => setDecisao(it.linha, { incluir: !!v })}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {it.descricao_origem || it.cod_origem || `Linha ${it.linha}`}
                            </p>
                            <p className="text-xs text-gray-400">
                              linha {it.linha}
                              {it.cod_origem ? ` · código do fornecedor: ${it.cod_origem}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className={`${meta.badge} shrink-0`}>
                            {meta.label}
                          </Badge>
                        </div>

                        <p className="text-xs text-gray-600">{it.motivo}</p>

                        {opcoes.length > 0 ? (
                          <Select
                            value={d.product_id || ""}
                            onValueChange={(v) => setDecisao(it.linha, { product_id: v, incluir: true })}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Escolha o produto do catálogo" />
                            </SelectTrigger>
                            <SelectContent>
                              {opcoes.map((c) => (
                                <SelectItem key={c.product_id} value={c.product_id}>
                                  {c.cod} — {c.nome}
                                  {c.score != null ? ` (${Math.round(c.score * 100)}%)` : ""}
                                </SelectItem>
                              ))}
                              {templates.slice(0, 300).map((t) =>
                                opcoes.some((o) => o.product_id === t.product_id) ? null : (
                                  <SelectItem key={t.product_id} value={t.product_id}>
                                    {t.cod} — {t.nome}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-red-600">
                            Sem candidatos no catálogo. Cadastre o produto ou ajuste a descrição na planilha.
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Preço</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={d.preco ?? ""}
                              onChange={(e) => setDecisao(it.linha, { preco: e.target.value })}
                              className="h-8 w-28 text-xs"
                            />
                          </div>
                          <Select
                            value={d.tipo_preco || "unitario"}
                            onValueChange={(v) => setDecisao(it.linha, { tipo_preco: v })}
                          >
                            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unitario">Preço unitário</SelectItem>
                              <SelectItem value="kg">Preço por quilo</SelectItem>
                            </SelectContent>
                          </Select>
                          {d.tipo_preco === "kg" && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-xs">
                              multiplica por {it.variacoes_afetadas || 1} faixas de peso
                            </Badge>
                          )}
                          {it.ja_existe && (
                            <span className="text-xs text-gray-400">
                              preço atual: {formatBRL(it.preco_atual)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {itensFiltrados.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma linha nesta faixa.</p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>{selecionadas}</strong> linha(s) selecionada(s), afetando{" "}
                <strong>{variacoesEstimadas}</strong> produto(s) da sua tabela. Cada linha confirmada
                fica memorizada — na próxima importação ela casa sozinha.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEtapa("upload")} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={handleConfirmar}
                disabled={selecionadas === 0}
                className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 text-white"
              >
                Aplicar {selecionadas} linha(s)
              </Button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- etapa concluída */}
        {etapa === "concluido" && resultado && !busy && (
          <div className="space-y-4">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-900">Tabela atualizada!</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{resultado.criados}</p>
                <p className="text-xs text-green-700">Novos</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{resultado.atualizados}</p>
                <p className="text-xs text-blue-700">Atualizados</p>
              </div>
              <div className="bg-purple-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-700">{resultado.mapeamentos_salvos}</p>
                <p className="text-xs text-purple-700">Mapeamentos</p>
              </div>
            </div>

            {resultado.ignoradas?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase">Linhas ignoradas</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {resultado.ignoradas.map((u, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-gray-50 rounded p-2">
                      <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-700">{u.cod_origem || "—"}</p>
                        <p className="text-gray-400">{u.motivo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white"
            >
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
