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
import { useToast } from "@/components/ui/use-toast";
import { CreditCard, Plus, Trash2, Loader2, ShieldCheck, Zap } from "lucide-react";
import CardSetupForm from "./CardSetupForm";

const BRAND_LABELS = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
  jcb: "JCB",
  discover: "Discover",
};

const BRAND_COLORS = {
  visa: "bg-blue-600",
  mastercard: "bg-orange-500",
  amex: "bg-blue-800",
  elo: "bg-yellow-600",
  hipercard: "bg-red-600",
};

export default function PagamentoTab({ metodoPagamento, onCardChanged }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleSaved = (resp) => {
    setShowForm(false);
    toast({ title: "Cartão salvo!", description: "Cobrança recorrente ativada." });
    onCardChanged();
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await base44.functions.invoke("removerCartao", {});
      toast({ title: "Cartão removido", description: "Cobrança automática desativada." });
      setConfirmRemove(false);
      onCardChanged();
    } catch (e) {
      toast({
        title: "Erro ao remover",
        description: e.message,
        variant: "destructive",
      });
    }
    setRemoving(false);
  };

  if (showForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Adicionar cartão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardSetupForm
            onSuccess={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </CardContent>
      </Card>
    );
  }

  if (!metodoPagamento) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Método de pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Nenhum cartão cadastrado</p>
              <p className="text-sm text-gray-500 mt-1">
                Adicione um cartão para ativar a cobrança recorrente automática das suas
                assinaturas.
              </p>
            </div>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar cartão
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const brand = metodoPagamento.card_brand || "card";
  const brandLabel = BRAND_LABELS[brand] || brand;
  const brandColor = BRAND_COLORS[brand] || "bg-gray-700";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Cartão salvo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Visual do cartão */}
          <div
            className={`${brandColor} text-white rounded-xl p-5 shadow-lg max-w-sm mb-4`}
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-xs uppercase opacity-80">{brandLabel}</span>
              <CreditCard className="w-6 h-6 opacity-80" />
            </div>
            <p className="font-mono text-lg tracking-wider mb-4">
              •••• •••• •••• {metodoPagamento.card_last4}
            </p>
            <div className="flex items-center justify-between text-xs">
              <div>
                {metodoPagamento.card_holder_name && (
                  <p className="uppercase opacity-90">{metodoPagamento.card_holder_name}</p>
                )}
              </div>
              <p className="opacity-90">
                {String(metodoPagamento.card_exp_month).padStart(2, "0")}/
                {String(metodoPagamento.card_exp_year).slice(-2)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-green-100 text-green-700">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Ativo para cobrança
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => setConfirmRemove(true)}
              disabled={removing}
            >
              {removing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Remover cartão
            </Button>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Com o cartão salvo, suas assinaturas são cobradas automaticamente todo mês. Você
              pode cancelar a qualquer momento na aba <strong>Assinaturas</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              A cobrança automática será desativada para todas as suas assinaturas. Você
              precisará adicionar um novo cartão para reativar a cobrança recorrente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover cartão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}