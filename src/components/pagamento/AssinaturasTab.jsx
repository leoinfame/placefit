import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CreditCard, Package, Plus, Trash2, Zap } from "lucide-react";

const fmtData = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};

const fmtPreco = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_STYLE = {
  trial: "bg-blue-100 text-blue-700",
  ativo: "bg-green-100 text-green-700",
  suspenso: "bg-yellow-100 text-yellow-700",
  cancelado: "bg-gray-100 text-gray-600",
};

export default function AssinaturasTab({
  user,
  assinaturas,
  planos,
  onContratar,
  onCancelar,
  contratando,
}) {
  const [cancelando, setCancelando] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const assinaturaBase = assinaturas.find((a) => a.plano_slug === "mensalidade_padrao");
  const recursosAtivos = assinaturas.filter(
    (a) => a.plano_slug !== "mensalidade_padrao" && a.status !== "cancelado",
  );
  const planosDisponiveis = planos.filter(
    (p) =>
      p.slug !== "mensalidade_padrao" &&
      !assinaturas.some((a) => a.plano_slug === p.slug && a.status !== "cancelado"),
  );

  const abrirCancelamento = (assinatura) => {
    setCancelando(assinatura);
    setMotivo("");
    setConfirmOpen(true);
  };

  const confirmarCancelamento = async () => {
    if (!cancelando) return;
    try {
      await base44.functions.invoke("cancelarRecurso", {
        assinatura_id: cancelando.id,
        motivo,
      });
      onCancelar(cancelando.id);
      setConfirmOpen(false);
      setCancelando(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Assinatura base */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Assinatura PlaceFit
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assinaturaBase ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-lg">{assinaturaBase.plano_nome}</p>
                  <p className="text-sm text-gray-500">
                    Início: {fmtData(assinaturaBase.data_inicio)} • Vencimento:{" "}
                    {fmtData(assinaturaBase.data_vencimento)}
                  </p>
                </div>
                <Badge className={STATUS_STYLE[assinaturaBase.status] || ""}>
                  {assinaturaBase.status}
                </Badge>
              </div>
              {assinaturaBase.cobranca_automatica && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 p-2 rounded-lg">
                  <Zap className="w-4 h-4" />
                  Cobrança automática ativa no cartão
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 p-3 rounded-lg">
                <CreditCard className="w-4 h-4" />
                Pague anual e ganhe <strong>10% de desconto</strong>, parcelado em até 12x no cartão.
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Nenhuma assinatura ativa. Entre em contato para ativar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recursos avulsos ativos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Recursos avulsos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recursosAtivos.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum recurso avulso contratado.</p>
          ) : (
            <div className="space-y-2">
              {recursosAtivos.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{a.plano_nome}</p>
                    <p className="text-xs text-gray-500">
                      Vencimento: {fmtData(a.data_vencimento)}
                      {a.cobranca_automatica && " • Cobrança automática ativa"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_STYLE[a.status] || ""}>{a.status}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => abrirCancelamento(a)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contratar novos recursos */}
      {planosDisponiveis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Contratar recursos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {planosDisponiveis.map((p) => (
                <div key={p.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{p.nome}</p>
                      <p className="text-sm text-gray-500">{fmtPreco(p.preco_mensal)}/mês</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onContratar(p)}
                      disabled={contratando === p.slug}
                    >
                      {contratando === p.slug ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Contratar"
                      )}
                    </Button>
                  </div>
                  {p.descricao && (
                    <p className="text-xs text-gray-500 mt-2">{p.descricao}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de cancelamento */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar recurso?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelando && (
                <>
                  Você está cancelando <strong>{cancelando.plano_nome}</strong>. Esta ação
                  não pode ser desfeita. O recurso permanecerá ativo até o vencimento atual.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Motivo (opcional)
            </label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: não estou usando, muito caro, etc."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter recurso</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarCancelamento}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}