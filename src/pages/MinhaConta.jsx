import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Plus,
  Package,
} from "lucide-react";

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
  trial: { label: "Trial", variant: "default", className: "bg-blue-100 text-blue-700" },
  ativo: { label: "Ativo", variant: "default", className: "bg-green-100 text-green-700" },
  suspenso: { label: "Suspenso", variant: "default", className: "bg-yellow-100 text-yellow-700" },
  cancelado: { label: "Cancelado", variant: "default", className: "bg-gray-100 text-gray-600" },
  pendente: { label: "Pendente", variant: "default", className: "bg-yellow-100 text-yellow-700" },
  pago: { label: "Pago", variant: "default", className: "bg-green-100 text-green-700" },
  atrasado: { label: "Atrasado", variant: "default", className: "bg-red-100 text-red-700" },
  estornado: { label: "Estornado", variant: "default", className: "bg-gray-100 text-gray-600" },
};

export default function MinhaConta() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assinaturas, setAssinaturas] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [ativando, setAtivando] = useState(false);
  const [contratando, setContratando] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const u = await base44.auth.me();
      setUser(u);

      // Ativar assinatura (processa InscricaoApp se houver)
      setAtivando(true);
      try {
        await base44.functions.invoke("inscreverApp", {
          ativar: true,
          user_id: u.id,
          user_email: u.email,
          user_nome: u.full_name,
        });
      } catch (e) {
        console.error("Ativacao:", e);
      }
      setAtivando(false);

      // Carregar dados
      const [ass, fats, pls] = await Promise.all([
        base44.entities.AssinaturaUsuario.filter({ usuario_id: u.id }),
        base44.entities.FaturaAssinatura.filter({ usuario_id: u.id }),
        base44.entities.PlanoServico.filter({ ativo: true }),
      ]);

      setAssinaturas(ass);
      setFaturas(fats);
      setPlanos(pls);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const contratar = async (plano) => {
    setContratando(plano.slug);
    try {
      await base44.functions.invoke("contratarRecurso", {
        user_id: user.id,
        user_email: user.email,
        user_nome: user.full_name,
        plano_slug: plano.slug,
      });
      toast({ title: "Recurso contratado!", description: `${plano.nome} adicionado à sua conta.` });
      // Recarregar
      const ass = await base44.entities.AssinaturaUsuario.filter({ usuario_id: user.id });
      setAssinaturas(ass);
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setContratando(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const assinaturaBase = assinaturas.find((a) => a.plano_slug === "mensalidade_padrao");
  const recursosAtivos = assinaturas.filter((a) => a.plano_slug !== "mensalidade_padrao");
  const planosDisponiveis = planos.filter(
    (p) => p.slug !== "mensalidade_padrao" && !assinaturas.some((a) => a.plano_slug === p.slug),
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Conta</h1>
        <p className="text-gray-500 text-sm">
          {user?.full_name} • {user?.email}
        </p>
      </div>

      {ativando && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Ativando sua assinatura...
        </div>
      )}

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
                <Badge className={STATUS_STYLE[assinaturaBase.status]?.className}>
                  {STATUS_STYLE[assinaturaBase.status]?.label || assinaturaBase.status}
                </Badge>
              </div>
              {assinaturaBase.status === "trial" && (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                  <Clock className="w-4 h-4" />
                  Você está em período de teste. Sua mensalidade será cobrada após{" "}
                  {fmtData(assinaturaBase.data_vencimento)}.
                </div>
              )}
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
                    </p>
                  </div>
                  <Badge className={STATUS_STYLE[a.status]?.className}>
                    {STATUS_STYLE[a.status]?.label || a.status}
                  </Badge>
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
                      onClick={() => contratar(p)}
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

      {/* Faturas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Faturas e pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {faturas.length === 0 ? (
            <p className="text-gray-500 text-sm">
              Nenhuma fatura gerada ainda. Suas faturas aparecerão aqui.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Plano</th>
                    <th className="pb-2 pr-4">Referência</th>
                    <th className="pb-2 pr-4">Valor</th>
                    <th className="pb-2 pr-4">Vencimento</th>
                    <th className="pb-2 pr-4">Pagamento</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{f.plano_nome}</td>
                      <td className="py-3 pr-4 text-gray-600">{f.referencia_mes}</td>
                      <td className="py-3 pr-4">{fmtPreco(f.valor)}</td>
                      <td className="py-3 pr-4 text-gray-600">{fmtData(f.data_vencimento)}</td>
                      <td className="py-3 pr-4 text-gray-600">{fmtData(f.data_pagamento)}</td>
                      <td className="py-3">
                        <Badge className={STATUS_STYLE[f.status]?.className}>
                          {STATUS_STYLE[f.status]?.label || f.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}