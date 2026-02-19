
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building, Mail, Phone, MapPin, CheckCircle } from "lucide-react";

const PLACEFIT_LOGO = "https://storage.googleapis.com/base44-platform-prod-uploaded-files/apps/fitconnect/fitconnect-email-files/0ffca2ca-85c4-4a4e-a0bc-e6c8ce5e7d1c.png";

export default function PublicRegister() {
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
      // Redirecionar para login do Google
      const redirectUrl = window.location.origin + '/Dashboard';
      await base44.auth.redirectToLogin(redirectUrl);
    } catch (error) {
      console.error("Erro ao iniciar cadastro:", error);
      setError("Erro ao iniciar cadastro. Tente novamente.");
    }
    setLoading(false);
  };

  const formatCNPJ = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatWhatsApp = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src={PLACEFIT_LOGO} 
            alt="PlaceFit" 
            className="w-16 h-16 mx-auto mb-4 object-contain"
          />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">
            PlaceFit
          </h1>
          <p className="text-xl text-gray-700 font-semibold">Plataforma de Fornecedores</p>
          <p className="text-gray-600 mt-2">Cadastre-se e comece a vender equipamentos fitness</p>
        </div>

        {success ? (
          <Card className="bg-white shadow-2xl border-0">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Cadastro Iniciado!</h2>
              <p className="text-gray-600 mb-6">
                Você será redirecionado para fazer login com sua conta Google.
                Após o login, complete seus dados no perfil.
              </p>
              <Button
                onClick={() => window.location.href = '/'}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              >
                Ir para Login
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white shadow-2xl border-0">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="text-2xl font-bold text-center">
                Cadastro de Fornecedor
              </CardTitle>
              <p className="text-center text-gray-600 text-sm">
                Preencha os dados da sua empresa e faça login com Google
              </p>
            </CardHeader>
            <CardContent className="p-8">
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="empresa" className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Nome da Empresa *
                    </Label>
                    <Input
                      id="empresa"
                      value={formData.empresa}
                      onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                      placeholder="Ex: FitTech Equipamentos Ltda"
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="whatsapp" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      WhatsApp
                    </Label>
                    <Input
                      id="whatsapp"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: formatWhatsApp(e.target.value) })}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endereco" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Endereço
                    </Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      placeholder="Rua, número, bairro, cidade, estado"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="site" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Website
                    </Label>
                    <Input
                      id="site"
                      type="url"
                      value={formData.site}
                      onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                      placeholder="https://www.suaempresa.com.br"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Próximos Passos:
                  </h3>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Faça login com sua conta Google</li>
                    <li>Complete os dados do seu perfil</li>
                    <li>Aguarde aprovação da FitPlace</li>
                    <li>Selecione produtos e defina preços</li>
                    <li>Gere sua tabela personalizada</li>
                  </ol>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !formData.empresa}
                  className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold py-6 text-lg"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      Continuar com Google
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-gray-500">
                  Ao se cadastrar, você concorda com nossos termos de uso e política de privacidade
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Benefícios */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Fácil e Rápido", desc: "Cadastro em minutos" },
            { title: "Sem Custos", desc: "100% gratuito" },
            { title: "Profissional", desc: "Tabelas personalizadas" }
          ].map((benefit, index) => (
            <div key={index} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg">
              <h3 className="font-semibold text-gray-900 mb-1">{benefit.title}</h3>
              <p className="text-sm text-gray-600">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
