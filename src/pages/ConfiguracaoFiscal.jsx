import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, Upload } from "lucide-react";
import { toast } from "sonner";

export default function ConfiguracaoFiscal() {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    cnpj: "",
    razao_social: "",
    nome_fantasia: "",
    inscricao_estadual: "",
    regime_tributario: "Simples Nacional",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "SP",
    cep: "",
    telefone: "",
    email: "",
    cfop_padrao: "5102",
    ambiente_nfe: "homologacao",
    serie_nfe: "1",
    proximo_numero: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const configs = await base44.entities.ConfiguracaoFiscal.filter({ user_id: currentUser.id });
      
      if (configs && configs.length > 0) {
        setConfig(configs[0]);
        setFormData(configs[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar configuração:", error);
    } finally {
      setLoading(false);
    }
  };

  const buscarCNPJ = async () => {
    try {
      const cnpj = formData.cnpj.replace(/\D/g, '');
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      
      if (res.ok) {
        const data = await res.json();
        setFormData({
          ...formData,
          razao_social: data.razao_social || "",
          nome_fantasia: data.nome_fantasia || "",
          email: data.email || "",
          telefone: data.ddd_telefone_1 || "",
          endereco: data.logradouro || "",
          numero: data.numero || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          cidade: data.municipio || "",
          estado: data.uf || "SP",
          cep: data.cep || ""
        });
        toast.success("Dados do CNPJ carregados");
      } else {
        toast.error("CNPJ não encontrado");
      }
    } catch (error) {
      toast.error("Erro ao buscar CNPJ");
    }
  };

  const buscarCEP = async () => {
    try {
      const cep = formData.cep.replace(/\D/g, '');
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setFormData({
            ...formData,
            endereco: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "SP"
          });
          toast.success("Endereço carregado");
        }
      }
    } catch (error) {
      toast.error("Erro ao buscar CEP");
    }
  };

  const handleSave = async () => {
    if (!formData.cnpj || !formData.razao_social) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const configData = {
        ...formData,
        user_id: user.id
      };

      if (config) {
        await base44.entities.ConfiguracaoFiscal.update(config.id, configData);
        toast.success("Configuração atualizada!");
      } else {
        await base44.entities.ConfiguracaoFiscal.create(configData);
        toast.success("Configuração salva!");
      }

      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl shadow-lg">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações Fiscais</h1>
            <p className="text-gray-600">Dados da empresa e certificado digital</p>
          </div>
        </div>

        {/* Dados da Empresa */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CNPJ */}
            <div className="space-y-2">
              <Label>CNPJ *</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                  placeholder="00.000.000/0000-00"
                />
                <Button onClick={buscarCNPJ} variant="outline">
                  Buscar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Razão Social *</Label>
                <Input
                  value={formData.razao_social}
                  onChange={(e) => setFormData({...formData, razao_social: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input
                  value={formData.nome_fantasia}
                  onChange={(e) => setFormData({...formData, nome_fantasia: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Inscrição Estadual</Label>
                <Input
                  value={formData.inscricao_estadual}
                  onChange={(e) => setFormData({...formData, inscricao_estadual: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Regime Tributário</Label>
                <Select value={formData.regime_tributario} onValueChange={(value) => setFormData({...formData, regime_tributario: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                    <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>CEP</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.cep}
                  onChange={(e) => setFormData({...formData, cep: e.target.value})}
                  placeholder="00000-000"
                />
                <Button onClick={buscarCEP} variant="outline">
                  Buscar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Logradouro</Label>
                <Input
                  value={formData.endereco}
                  onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => setFormData({...formData, numero: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={formData.bairro}
                  onChange={(e) => setFormData({...formData, bairro: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input
                  value={formData.complemento}
                  onChange={(e) => setFormData({...formData, complemento: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={formData.cidade}
                  onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input
                  value={formData.estado}
                  onChange={(e) => setFormData({...formData, estado: e.target.value})}
                  maxLength={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurações NF-e */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações NF-e</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CFOP Padrão</Label>
                <Input
                  value={formData.cfop_padrao}
                  onChange={(e) => setFormData({...formData, cfop_padrao: e.target.value})}
                  placeholder="5102"
                />
              </div>
              <div className="space-y-2">
                <Label>Série NF-e</Label>
                <Input
                  value={formData.serie_nfe}
                  onChange={(e) => setFormData({...formData, serie_nfe: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Próximo Número</Label>
                <Input
                  type="number"
                  value={formData.proximo_numero}
                  onChange={(e) => setFormData({...formData, proximo_numero: Number(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={formData.ambiente_nfe} onValueChange={(value) => setFormData({...formData, ambiente_nfe: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 bg-yellow-50 p-4 rounded-lg">
              <Label>Certificado Digital A1</Label>
              <p className="text-sm text-gray-600 mb-2">
                ⚠️ Upload de certificado digital será implementado com API de NF-e
              </p>
              <Button variant="outline" disabled>
                <Upload className="w-4 h-4 mr-2" />
                Upload Certificado (.pfx)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </div>
  );
}