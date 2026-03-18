import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Crown, CheckCircle, Lock, MessageSquare, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

const COR_MAP = {
  blue: { bg: "from-blue-500 to-blue-700", light: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700", icon: "text-blue-600" },
  purple: { bg: "from-purple-500 to-purple-700", light: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-700", icon: "text-purple-600" },
  green: { bg: "from-green-500 to-green-700", light: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-700", icon: "text-green-600" },
  orange: { bg: "from-orange-500 to-orange-700", light: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700", icon: "text-orange-600" },
  pink: { bg: "from-pink-500 to-pink-700", light: "bg-pink-50 border-pink-200", badge: "bg-pink-100 text-pink-700", icon: "text-pink-600" },
  indigo: { bg: "from-indigo-500 to-indigo-700", light: "bg-indigo-50 border-indigo-200", badge: "bg-indigo-100 text-indigo-700", icon: "text-indigo-600" },
};

export default function Servicos() {
  const [user, setUser] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      const [planosData, assData] = await Promise.all([
        base44.entities.PlanoServico.filter({ ativo: true }),
        base44.entities.AssinaturaUsuario.filter({ usuario_id: currentUser.id })
      ]);
      setPlanos(planosData.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0)));
      setAssinaturas(assData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const getAssinatura = (planoId) => assinaturas.find(a => a.plano_id === planoId);

  const isAtivo = (planoId) => {
    const ass = getAssinatura(planoId);
    return ass?.status === 'ativo' || ass?.status === 'trial';
  };

  const handleSolicitar = () => {
    toast({
      title: "Solicitação enviada!",
      description: "Em breve o administrador entrará em contato para ativar seu plano.",
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const assinaturasAtivas = assinaturas.filter(a => a.status === 'ativo' || a.status === 'trial');

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Crown className="w-10 h-10 text-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-900">Serviços Premium</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Potencialize seu negócio com nossas ferramentas avançadas. Cada plano oferece funcionalidades exclusivas para aumentar suas vendas.
          </p>
        </div>

        {/* Assinaturas ativas */}
        {assinaturasAtivas.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
            <h2 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5" />
              Seus Serviços Ativos
            </h2>
            <div className="flex flex-wrap gap-2">
              {assinaturasAtivas.map(ass => (
                <Badge key={ass.id} className="bg-green-100 text-green-800 px-3 py-1 text-sm">
                  ✓ {ass.plano_nome}
                  {ass.status === 'trial' && <span className="ml-1 text-xs opacity-70">(Trial)</span>}
                  {ass.data_vencimento && <span className="ml-1 text-xs opacity-70">até {new Date(ass.data_vencimento).toLocaleDateString('pt-BR')}</span>}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Cards de planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {planos.map(plano => {
            const ativo = isAtivo(plano.id);
            const ass = getAssinatura(plano.id);
            const cores = COR_MAP[plano.cor || 'blue'];

            return (
              <Card key={plano.id} className={`relative overflow-hidden border-2 transition-all hover:shadow-xl ${ativo ? 'border-green-400 shadow-lg' : plano.destaque ? 'border-yellow-400 shadow-md' : 'border-gray-200'}`}>
                {plano.destaque && !ativo && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-yellow-100 text-yellow-700 text-xs flex items-center gap-1">
                      <Star className="w-3 h-3" />Recomendado
                    </Badge>
                  </div>
                )}
                {ativo && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />Ativo
                    </Badge>
                  </div>
                )}

                {/* Header colorido */}
                <div className={`bg-gradient-to-br ${cores.bg} p-5 text-white`}>
                  <div className="text-4xl mb-2">{plano.icone}</div>
                  <h3 className="text-xl font-bold">{plano.nome}</h3>
                  <p className="text-white/80 text-sm mt-1">{plano.descricao}</p>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Preço */}
                  <div className="text-center py-2">
                    <span className="text-3xl font-bold text-gray-900">R$ {parseFloat(plano.preco_mensal || 0).toFixed(2)}</span>
                    <span className="text-gray-500 text-sm">/mês</span>
                  </div>

                  {/* Benefícios */}
                  {plano.beneficios?.length > 0 && (
                    <ul className="space-y-2">
                      {plano.beneficios.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Botão */}
                  {ativo ? (
                    <div className={`w-full text-center py-3 rounded-lg ${cores.light} border`}>
                      <span className="text-sm font-semibold text-green-700 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Serviço Ativo
                        {ass?.status === 'trial' && " (Trial)"}
                      </span>
                    </div>
                  ) : (
                    <Button
                      className={`w-full bg-gradient-to-r ${cores.bg} hover:opacity-90 text-white`}
                      onClick={handleSolicitar}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Contratar Plano
                    </Button>
                  )}

                  {/* Info bloqueio */}
                  {!ativo && plano.slug === 'atendente_ia' && (
                    <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
                      <Lock className="w-3 h-3" />
                      Conexão WhatsApp requer este plano
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {planos.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-500">
              <Crown className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Nenhum serviço disponível no momento</p>
              <p className="text-sm">Em breve novos serviços serão lançados!</p>
            </div>
          )}
        </div>

        {/* Nota de contato */}
        <div className="text-center text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
          <MessageSquare className="w-5 h-5 mx-auto mb-2 text-gray-400" />
          Para contratar ou obter mais informações, entre em contato com o suporte PlaceFit.
        </div>
      </div>
    </div>
  );
}