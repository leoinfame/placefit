import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Image as ImageIcon, Download, Share2, Sparkles, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RENDERIZADORES } from "@/lib/cardRender";

// Card de produto para Instagram/WhatsApp (PNG 1080x1080). A funcao
// gerarCardProduto le nome, peso e preco do banco (nunca de IA) e o PNG e
// desenhado aqui no navegador por src/lib/cardRender.js.
export default function GerarCardModal({ group, onClose }) {
  const variacoes = (group?.variations || []).filter(v => v.sp?.preco > 0);
  const [spId, setSpId] = useState(variacoes[0]?.sp.id || "");
  const [camada, setCamada] = useState("padrao");
  const [config, setConfig] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState(null); // { dataUrl, file, nome_arquivo }
  const [erro, setErro] = useState("");

  useEffect(() => {
    base44.functions.invoke("gerarCardProduto", { acao: "config" })
      .then(r => setConfig(r.data))
      .catch(() => setConfig({ arte_disponivel: false }));
  }, []);

  const gerar = async () => {
    setGerando(true);
    setErro("");
    setResultado(null);
    try {
      const r = await base44.functions.invoke("gerarCardProduto", { supplier_product_id: spId, camada, formato: "imagem" });
      const pacote = r.data;
      const blob = await RENDERIZADORES[pacote.formato || "imagem"](pacote);
      const file = new File([blob], pacote.nome_arquivo, { type: "image/png" });
      const dataUrl = await new Promise((resolve) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.readAsDataURL(blob);
      });
      setResultado({ dataUrl, file, nome_arquivo: pacote.nome_arquivo });
    } catch (e) {
      setErro(e?.response?.data?.error || e?.message || "Erro ao gerar a imagem.");
    }
    setGerando(false);
  };

  const baixar = () => {
    const a = document.createElement("a");
    a.href = resultado.dataUrl;
    a.download = resultado.nome_arquivo;
    a.click();
  };

  const podeCompartilhar = resultado && typeof navigator !== "undefined" && navigator.canShare?.({ files: [resultado.file] });

  const compartilhar = async () => {
    try {
      await navigator.share({ files: [resultado.file], title: group.baseName });
    } catch (e) {
      if (e?.name !== "AbortError") setErro("Não foi possível compartilhar. Use o botão Baixar.");
    }
  };

  const rotuloVariacao = (v) => {
    const preco = (v.sp.preco || 0) * (1 + (v.sp.margem || 0) / 100);
    const peso = v.tmpl.peso_kg != null ? `${v.tmpl.peso_kg} kg · ` : "";
    return `${peso}${v.tmpl.nome} · ${preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" /> Gerar imagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm font-semibold text-gray-900">{group.baseName}</p>

          {variacoes.length === 0 ? (
            <p className="text-sm text-gray-500">Este produto ainda não tem preço definido.</p>
          ) : (
            <>
              {variacoes.length > 1 && (
                <div>
                  <Label className="flex items-center gap-1"><Weight className="w-3.5 h-3.5" /> Variação</Label>
                  <Select value={spId} onValueChange={(v) => { setSpId(v); setResultado(null); }}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {variacoes.map(v => <SelectItem key={v.sp.id} value={v.sp.id}>{rotuloVariacao(v)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setCamada("padrao"); setResultado(null); }}
                  className={`rounded-lg border p-3 text-left transition ${camada === "padrao" ? "border-blue-500 ring-1 ring-blue-200 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <p className="text-sm font-semibold">Card padrão</p>
                  <p className="text-xs text-gray-500">Sua marca e cores. Sem custo.</p>
                </button>
                <button
                  type="button"
                  disabled={!config?.arte_disponivel}
                  onClick={() => { setCamada("artistica"); setResultado(null); }}
                  className={`rounded-lg border p-3 text-left transition disabled:opacity-60 disabled:cursor-not-allowed ${camada === "artistica" ? "border-purple-500 ring-1 ring-purple-200 bg-purple-50" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <p className="text-sm font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Card artístico
                  </p>
                  <p className="text-xs text-gray-500">
                    {config?.arte_disponivel ? "Fundo criado por IA. Usa crédito de IA." : "Em breve"}
                  </p>
                </button>
              </div>

              <Button onClick={gerar} disabled={gerando || !spId} className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                {gerando ? "Gerando..." : resultado ? "Gerar de novo" : "Gerar imagem"}
              </Button>
            </>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          {resultado && (
            <div className="space-y-3">
              <img src={resultado.dataUrl} alt={`Card de ${group.baseName}`} className="w-full rounded-lg border" />
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">1080×1080 · Instagram e WhatsApp</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={baixar}>
                  <Download className="w-4 h-4 mr-2" /> Baixar PNG
                </Button>
                <Button variant="outline" onClick={compartilhar} disabled={!podeCompartilhar} title={podeCompartilhar ? "" : "Compartilhamento direto disponível no celular"}>
                  <Share2 className="w-4 h-4 mr-2" /> Compartilhar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
