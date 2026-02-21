import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Truck, CheckCircle, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PLACEFIT_LOGO = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c9d5dd3cf0f8fd8a834875/b1ab9fc90_WhatsAppImage2025-10-16at023605.jpeg";

export default function PublicRegisterTransportador() {
  const [formData, setFormData] = useState({
    empresa: "",
    cnpj: "",
    endereco: "",
    whatsapp: "",
    site: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      localStorage.setItem('transportador_registration_data', JSON.stringify({
        ...formData,
        tipo_usuario: 'transportador',
        aprovado: false
      }));

      await base44.auth.redirectToLogin(window.location.origin + '/Dashboard');
    } catch (err) {
      console.error("Erro ao iniciar cadastro:", err);
      setError("Erro ao iniciar cadastro. Tente novamente.");
      setLoading(false);
    }
  };

  const formatCNPJ = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  };

  const formatWebsite = (value) => {
    if (!value) return '';
    let url = value.trim();
    
    url = url.replace(/\s/g, '');
    
    if (url && !url.match(/^https?:\/\//i)) {
      url = 'http://' + url;
    }
    
    if (url && !url.match(/^https?:\/\/www\./i) && !url.match(/^https?:\/\/[^.]+\.[^.]+$/)) {
      url = url.replace(/^(https?:\/\/)/, '$1www.');
    }
    
    return url;
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Enviado!</h2>
            <p className="text-gray-600 mb-6">
              Seu cadastro foi recebido e está em análise. Em breve você receberá um e-mail com as instruções de acesso.
            </p>
            <Button
              onClick={() => window.location.href = '/'}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600"
            >
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src={PLACEFIT_LOGO}
            alt="PlaceFit"
            className="w-16 h-16 mx-auto mb-4 object-contain"
          />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
            Cadastro de Transportadora
          </h1>
          <p className="text-gray-600 text-lg">
            Otimize suas rotas e conecte-se com fornecedores
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <Card className="bg-white shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Truck className="w-6 h-6 text-orange-600" />
                Dados da Transportadora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="empresa">Nome da Transportadora *</Label>
                  <Input
                    id="empresa"
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                    required
                    placeholder="Ex: TransFit Logística"
                  />
                </div>

                <div>
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => {
                      const formatted = formatCNPJ(e.target.value);
                      setFormData({ ...formData, cnpj: formatted });
                    }}
                    required
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div>
                  <Label htmlFor="endereco">Endereço Completo *</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    required
                    placeholder="Rua, número, bairro, cidade - UF"
                  />
                </div>

                <div>
                  <Label htmlFor="whatsapp">WhatsApp *</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setFormData({ ...formData, whatsapp: formatted });
                    }}
                    required
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <Label htmlFor="site">Site (opcional)</Label>
                  <Input
                    id="site"
                    value={formData.site}
                    onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                    onBlur={(e) => setFormData({ ...formData, site: formatWebsite(e.target.value) })}
                    placeholder="suatransportadora.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Digite apenas o domínio, ex: suatransportadora.com
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-6 text-lg"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      Continuar com Google
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Ao continuar, você concorda com nossos termos de uso
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Benefits */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white border-0">
              <CardContent className="p-6">
                <h3 className="text-2xl font-bold mb-4">Por que se cadastrar?</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Publique suas rotas</h4>
                      <p className="text-sm text-white/90">
                        Divulgue suas rotas disponíveis e fretes de complemento
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Conecte-se com fornecedores</h4>
                      <p className="text-sm text-white/90">
                        Encontre cargas de retorno e otimize sua rentabilidade
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">Gestão simplificada</h4>
                      <p className="text-sm text-white/90">
                        Plataforma completa para gerenciar suas ofertas de frete
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-6 h-6 flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-semibold mb-1">100% Gratuito</h4>
                      <p className="text-sm text-white/90">
                        Sem mensalidades ou taxas ocultas
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-orange-200">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  Próximos Passos
                </h3>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </span>
                    <span className="text-sm text-gray-700">
                      Preencha os dados da sua transportadora
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </span>
                    <span className="text-sm text-gray-700">
                      Autentique com sua conta Google
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </span>
                    <span className="text-sm text-gray-700">
                      Aguarde aprovação (geralmente em 24h)
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold">
                      4
                    </span>
                    <span className="text-sm text-gray-700">
                      Comece a publicar suas rotas!
                    </span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}