import { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, QrCode, FileText, Copy, Check, ArrowLeft, ExternalLink } from "lucide-react";

const fmtPreco = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
};

export default function PagarDialog({ assinatura, planos, open, onOpenChange }) {
  const { toast } = useToast();
  const [metodo, setMetodo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagamento, setPagamento] = useState(null);
  const [copied, setCopied] = useState(false);

  const preco =
    planos.find((p) => p.slug === assinatura?.plano_slug)?.preco_mensal || 0;

  const gerar = async (m) => {
    setMetodo(m);
    setLoading(true);
    setPagamento(null);
    try {
      const resp = await base44.functions.invoke("gerarCobrancaPixBoleto", {
        assinatura_id: assinatura.id,
        metodo: m,
      });
      setPagamento(resp);
    } catch (e) {
      toast({
        title: "Erro ao gerar cobrança",
        description: e.message,
        variant: "destructive",
      });
      setMetodo(null);
    }
    setLoading(false);
  };

  const voltar = () => {
    setMetodo(null);
    setPagamento(null);
  };

  const copiarPix = () => {
    if (pagamento?.qr_code_data) {
      navigator.clipboard.writeText(pagamento.qr_code_data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = (v) => {
    if (!v) {
      setMetodo(null);
      setPagamento(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar {assinatura?.plano_nome}</DialogTitle>
          <DialogDescription>
            Valor: <strong>{fmtPreco(preco)}</strong> • Vencimento:{" "}
            {assinatura?.data_vencimento}
          </DialogDescription>
        </DialogHeader>

        {/* Seleção de método */}
        {!metodo && (
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => gerar("pix")}
              className="flex flex-col gap-2 h-28 bg-green-600 hover:bg-green-700"
            >
              <QrCode className="w-7 h-7" />
              <span className="font-semibold">PIX</span>
              <span className="text-xs opacity-90">Aprovação imediata</span>
            </Button>
            <Button
              onClick={() => gerar("boleto")}
              variant="outline"
              className="flex flex-col gap-2 h-28"
            >
              <FileText className="w-7 h-7" />
              <span className="font-semibold">Boleto</span>
              <span className="text-xs text-gray-500">1-3 dias úteis</span>
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-sm text-gray-500">Gerando cobrança...</p>
          </div>
        )}

        {/* PIX QR Code */}
        {pagamento && metodo === "pix" && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={voltar} className="gap-1">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            </div>
            <div className="text-center space-y-3">
              {pagamento.qr_code_url ? (
                <img
                  src={pagamento.qr_code_url}
                  alt="QR Code PIX"
                  className="w-48 h-48 mx-auto border rounded-lg"
                />
              ) : (
                <div className="w-48 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                  <QrCode className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <p className="font-semibold text-green-700">Escaneie o QR Code</p>
              <p className="text-sm text-gray-500">
                Abra o app do seu banco e escaneie o código ou copie a chave abaixo
              </p>
            </div>
            {pagamento.qr_code_data && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  PIX Copia e Cola
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={pagamento.qr_code_data}
                    className="text-xs font-mono"
                  />
                  <Button size="sm" onClick={copiarPix} className="gap-1">
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            )}
            {pagamento.expires_at && (
              <p className="text-xs text-gray-500 text-center">
                Expira em: {fmtData(pagamento.expires_at)}
              </p>
            )}
          </div>
        )}

        {/* Boleto */}
        {pagamento && metodo === "boleto" && !loading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={voltar} className="gap-1">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            </div>
            <div className="text-center space-y-3 py-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8 text-gray-600" />
              </div>
              <p className="font-semibold text-gray-900">Boleto gerado!</p>
              {pagamento.boleto_number && (
                <p className="text-sm text-gray-500">
                  Linha digitável: <br />
                  <span className="font-mono text-xs">{pagamento.boleto_number}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {pagamento.boleto_url && (
                <Button asChild className="gap-2">
                  <a
                    href={pagamento.boleto_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver boleto
                  </a>
                </Button>
              )}
              {pagamento.boleto_pdf && (
                <Button asChild variant="outline" className="gap-2">
                  <a
                    href={pagamento.boleto_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileText className="w-4 h-4" />
                    Baixar PDF
                  </a>
                </Button>
              )}
            </div>
            {pagamento.expires_at && (
              <p className="text-xs text-gray-500 text-center">
                Vencimento: {fmtData(pagamento.expires_at)}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}