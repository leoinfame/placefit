import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building, Mail, Phone, MapPin, CheckCircle, Package, Upload, Image } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PLACEFIT_LOGO = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c9d5dd3cf0f8fd8a834875/b1ab9fc90_WhatsAppImage2025-10-16at023605.jpeg";

export default function PublicRegisterFabricante() {
  const [formData, setFormData] = useState({
    empresa: "",
    cnpj: "",
    endereco: "",
    whatsapp: "",
    site: "",
    logomarca: "",
    historia_empresa: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Salvar dados temporários no localStorage
      localStorage.setItem('fabricante_registration_data', JSON.stringify(formData));
      
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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, logomarca: file_url });
      toast({
        title: "Logo enviada!",
        description: "Logo da empresa carregada com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar logo. Tente novamente.",
        variant: "destructive"
      });
    }
    setUploadingLogo(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src={PLACEFIT_LOGO} 
            alt="PlaceFit" 
            className="w-16 h-16 mx-auto mb-4 object-contain"
          />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            PlaceFit
          </h1>
          <p className="text-xl text-gray-700 font-semibold">Cadastro de Fabricantes</p>
          <p className="text-gray-600 mt-2">Cadastre seus produtos no marketplace B2B fitness</p>
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
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                Ir para Login
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white shadow-2xl border-0">
            <CardHeader className="pb-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
              <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
                <Package className="w-6 h-6 text-purple-600" />
                Cadastro de Fabricante
              </CardTitle>
              <p className="text-center text-gray-600 text-sm mt-2">
                Cadastre sua empresa fabricante e comece a vender no marketplace PlaceFit
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
                  {/* Logo Upload */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                    <Label className="flex items-center gap-2 mb-3">
                      <Image className="w-4 h-4" />
                      Logo da Empresa
                    </Label>
                    {formData.logomarca && (
                      <div className="mb-3 flex justify-center">
                        <div className="w-32 h-32 bg-white rounded-lg overflow-hidden border-2 border-purple-200 shadow-sm">
                          <img 
                            src={formData.logomarca} 
                            alt="Logo" 
                            className="w-full h-full object-contain p-2" 
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        disabled={uploadingLogo}
                        className="flex-1 border-purple-300 hover:bg-purple-100"
                      >
                        {uploadingLogo ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload de Logo
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-purple-700 mt-2">
                      Envie a logo da sua empresa (PNG, JPG ou SVG)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="empresa" className="flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Nome da Empresa Fabricante *
                    </Label>
                    <Input
                      id="empresa"
                      value={formData.empresa}
                      onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                      placeholder="Ex: TechFit Indústria de Equipamentos Ltda"
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="whatsapp" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      WhatsApp *
                    </Label>
                    <Input
                      id="whatsapp"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: formatWhatsApp(e.target.value) })}
                      placeholder="(11) 99999-9999"
                      maxLength={15}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="endereco" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Endereço da Fábrica *
                    </Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      placeholder="Rua, número, bairro, cidade, estado"
                      required
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
                      value={formData.site}
                      onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                      onBlur={(e) => setFormData({ ...formData, site: formatWebsite(e.target.value) })}
                      placeholder="suafabrica.com.br"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Digite apenas o domínio, ex: suafabrica.com.br
                    </p>
                  </div>

                  {/* História da Empresa */}
                  <div>
                    <Label htmlFor="historia_empresa" className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      História da Empresa *
                    </Label>
                    <Textarea
                      id="historia_empresa"
                      value={formData.historia_empresa}
                      onChange={(e) => setFormData({ ...formData, historia_empresa: e.target.value })}
                      rows={6}
                      placeholder="Conte sobre sua empresa: quando foi fundada, missão, valores, diferenciais, principais produtos, mercados que atende..."
                      required
                      className="mt-1 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Este texto será exibido no seu perfil e ajudará fornecedores a conhecer sua empresa
                    </p>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Vantagens para Fabricantes:
                  </h3>
                  <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
                    <li>Cadastre seus produtos diretamente na plataforma</li>
                    <li>Alcance centenas de fornecedores em todo Brasil</li>
                    <li>Defina seus preços sugeridos</li>
                    <li>Gestão completa do seu catálogo</li>
                    <li>Sem custos de cadastro</li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !formData.empresa || !formData.cnpj || !formData.whatsapp || !formData.endereco || !formData.historia_empresa}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-6 text-lg"
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
                  Ao se cadastrar como fabricante, você concorda com nossos termos de uso
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Benefícios */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Fácil Gestão", desc: "Cadastre e gerencie produtos" },
            { title: "Sem Custos", desc: "100% gratuito" },
            { title: "Alcance Nacional", desc: "Fornecedores em todo Brasil" }
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