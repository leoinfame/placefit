import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { UploadFile } from "@/integrations/Core";
import { Save, Upload, Building, FileText, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    empresa: "",
    cnpj: "",
    endereco: "",
    whatsapp: "",
    site: "",
    logomarca: ""
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setFormData({
        full_name: currentUser.full_name || "",
        email: currentUser.email || "",
        empresa: currentUser.empresa || "",
        cnpj: currentUser.cnpj || "",
        endereco: currentUser.endereco || "",
        whatsapp: currentUser.whatsapp || "",
        site: currentUser.site || "",
        logomarca: currentUser.logomarca || ""
      });
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    
    try {
      // Atualizar apenas campos customizados (não built-in)
      await base44.entities.User.update(user.id, {
        empresa: formData.empresa,
        cnpj: formData.cnpj,
        endereco: formData.endereco,
        whatsapp: formData.whatsapp,
        site: formData.site,
        logomarca: formData.logomarca
      });
      
      setMessage("Dados salvos com sucesso!");
      await loadUser(); // Recarregar dados
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Erro ao salvar dados:", error);
      setMessage("Erro ao salvar dados. Tente novamente.");
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData({ ...formData, logomarca: file_url });
    } catch (error) {
      console.error("Erro ao fazer upload da logo:", error);
    }
    setUploadingLogo(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage("");

    // Validações
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordMessage("Preencha todos os campos de senha.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage("A nova senha e a confirmação não coincidem.");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setChangingPassword(true);
    try {
      await base44.auth.updateMe({
        password: passwordData.newPassword
      });
      
      setPasswordMessage("Senha alterada com sucesso!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setTimeout(() => setPasswordMessage(""), 3000);
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      setPasswordMessage("Erro ao alterar senha. Verifique a senha atual.");
    }
    setChangingPassword(false);
  };

  const formatCNPJ = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatWhatsApp = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="max-w-2xl space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Perfil da Empresa</h1>
          <p className="text-gray-600">Configure os dados da sua empresa</p>
        </div>

        {/* Status da Aprovação */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  user?.aprovado ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Status da Conta</p>
                  <p className="text-sm text-gray-600">
                    {user?.role === 'admin' ? 'Administrador' : 'Revendedor'}
                  </p>
                </div>
              </div>
              <Badge variant={user?.aprovado ? "success" : "secondary"} className={
                user?.aprovado 
                  ? "bg-green-100 text-green-700 border-green-200" 
                  : "bg-amber-100 text-amber-700 border-amber-200"
              }>
                {user?.aprovado ? "Aprovado" : "Aguardando Aprovação"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Formulário Principal */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dados da Empresa */}
            <div className="lg:col-span-2">
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="w-5 h-5" />
                    Dados da Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="full_name">Nome do Responsável</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        disabled
                        className="bg-gray-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Nome vinculado à conta Google (não editável)
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled
                        className="bg-gray-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        E-mail vinculado à conta Google (não editável)
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="empresa">Nome da Empresa *</Label>
                      <Input
                        id="empresa"
                        value={formData.empresa}
                        onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                        placeholder="Ex: FitTech Equipamentos Ltda"
                        required
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
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="endereco">Endereço Completo</Label>
                    <Input
                      id="endereco"
                      value={formData.endereco}
                      onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                      placeholder="Rua, número, bairro, cidade, estado, CEP"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input
                        id="whatsapp"
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: formatWhatsApp(e.target.value) })}
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="site">Website</Label>
                      <Input
                        id="site"
                        type="url"
                        value={formData.site}
                        onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                        placeholder="https://www.suaempresa.com.br"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Logomarca */}
            <div>
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Logomarca
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preview da Logo */}
                  <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-200">
                    {formData.logomarca ? (
                      <img
                        src={formData.logomarca}
                        alt="Logo da empresa"
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Nenhuma logo enviada</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Upload */}
                  <div>
                    <Label htmlFor="logo-upload" className="text-sm font-medium">
                      Enviar Nova Logo
                    </Label>
                    <div className="mt-2">
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
                        className="w-full"
                      >
                        {uploadingLogo ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Selecionar Arquivo
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Formatos aceitos: JPG, PNG, SVG (máx. 5MB)
                    </p>
                  </div>
                  
                  {/* URL Manual */}
                  <div>
                    <Label htmlFor="logomarca" className="text-sm font-medium">
                      Ou insira a URL da logo
                    </Label>
                    <Input
                      id="logomarca"
                      type="url"
                      value={formData.logomarca}
                      onChange={(e) => setFormData({ ...formData, logomarca: e.target.value })}
                      placeholder="https://exemplo.com/logo.png"
                      className="mt-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Mensagem de Feedback */}
          {message && (
            <Alert className={message.includes('sucesso') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={message.includes('sucesso') ? 'text-green-800' : 'text-red-800'}>
                {message}
              </AlertDescription>
            </Alert>
          )}

          {/* Botão Salvar Dados */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white px-8 py-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Alteração de Senha */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Label htmlFor="currentPassword">Senha Atual</Label>
                    <Input
                      id="currentPassword"
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder="Digite sua senha atual"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Digite a nova senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Confirme a nova senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {passwordMessage && (
                  <Alert className={passwordMessage.includes('sucesso') ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                    <AlertDescription className={passwordMessage.includes('sucesso') ? 'text-green-800' : 'text-red-800'}>
                      {passwordMessage}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={changingPassword}
                    variant="outline"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    {changingPassword ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Alterando...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        Alterar Senha
                      </>
                    )}
                  </Button>
                  </div>
                  </form>
                  </CardContent>
                  </Card>
      </div>
    </div>
  );
}