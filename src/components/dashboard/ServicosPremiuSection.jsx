import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Zap, CheckCircle, ArrowRight } from "lucide-react";

export default function ServicosPremiuSection({ user }) {
  const [planos, setPlanos] = useState([]);
  const [assinaturas, setAssinaturas] = useState([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const [planosData, assinsData] = await Promise.all([
      base44.entities.PlanoServico.filter({ ativo: true }),
      base44.entities.AssinaturaUsuario.filter({ usuario_id: user.id, status: "ativo" })
    ]);
    setPlanos(planosData.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0)));
    setAssinaturas(assinsData);
  };

  const isAtivo = (slug) => assinaturas.some(a => a.plano_slug === slug);

  if (planos.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-900">Serviços Premium</h2>
        </div>
        <Link to={createPageUrl("Servicos")}>
          <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700">
            Ver todos <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {planos.map((plano) => {
          const ativo = isAtivo(plano.slug);
          return (
            <Card
              key={plano.id}
              className={`relative overflow-hidden border-2 transition-all duration-300 hover:shadow-lg ${
                ativo
                  ? "border-purple-400 bg-gradient-to-br from-purple-50 to-indigo-50"
                  : plano.destaque
                  ? "border-purple-200 bg-white hover:border-purple-300"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {plano.destaque && !ativo && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  DESTAQUE
                </div>
              )}
              {ativo && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> ATIVO
                </div>
              )}

              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{plano.icone || "⭐"}</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{plano.nome}</h3>
                    <p className="text-purple-600 font-semibold text-sm">
                      R$ {plano.preco_mensal?.toFixed(2).replace(".", ",")}/mês
                    </p>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{plano.descricao}</p>

                {plano.beneficios?.slice(0, 3).map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                    <Zap className="w-3 h-3 text-purple-500 flex-shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}

                <div className="mt-4">
                  <Link to={createPageUrl("Servicos")}>
                    <Button
                      size="sm"
                      className={`w-full ${
                        ativo
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                      } text-white`}
                    >
                      {ativo ? "Gerenciar" : "Contratar"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}