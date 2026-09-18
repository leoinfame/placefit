import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save } from "lucide-react";
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
    regime_tributario: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    telefone: "",
    email: "",
    modelo: "55",
    ambiente: "homologacao",
    serie: "",
    proximo_numero: 1,
    status_credenciamento: "pendente",
    certificado_status: "pendente",
    cfop_confirmado: false,
    ncm_confirmado: false,
    icms_st_confirmado: false,
    difal_confirmado: false,
    frete_confirmado: false,
    numeracao_confirmada: false,
  });
  const [pendencias, setPendencias] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const calcularPendencias = (dados) => {
    const pends = [];
    if (!dados.cnpj) pends.push("Confirmar CNPJ do emissor");
    if (!dados.razao_social) pends.push("Confirmar razão social");
    if (!dados.inscricao_estadual) pends.push("Confirmar Inscrição Estadual");
    if (!dados.regime_tributario) pends.push("Confirmar regime tributário");
    if (!dados.estado) pends.push("Confirmar UF do emissor");
    if (!dados.serie) pends.push("Confirmar série da NF-e");
    if (dados.certificado_status !== "configurado") pends.push("Configurar certificado digital A1");
    if (dados.status_credenciamento !== "ativo") pends.push("Credenciamento na SEFAZ/UF");
    if (!dados.cfop_confirmado) pends.push("Confirmar CFOP por operação");
    if (!dados.ncm_confirmado) pends.push("Confirmar NCM por produto");
    if (!dados.icms_st_confirmado) pends.push("Confirmar ICMS/ST");
    if (!dados.difal_confirmado) pends.push("Confirmar DIFAL (se aplicável)");
    if (!dados.frete_confirmado) pends.push("Confirmar regras de frete");
    if (!dados.numeracao_confirmada) pends.push("Confirmar numeração");
    setPendencias(pends);
    return pends;
  };

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const configs = await base44.entities.ConfiguracaoFiscal.filter({ tenant_id: currentUser.id });
      
      if (configs && configs.length > 0) {
        setConfig(configs[0]);
        setFormData(prev => ({ ...prev, ...configs[0] }));
        calcularPendencias({ ...formData, ...configs[0] });
      } else {
        calcularPendencias(formData);
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
      const pendenciasAtualizadas = calcularPendencias(formData);
      const configData = {
        ...formData,
        tenant_id: user.id,
        cnpj: formData.cnpj ? formData.cnpj.replace(/\D/g, "") : "",
      };
      configData.pronta_homologacao = pendenciasAtualizadas.length === 0;

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

        {/* Configurações NF-e modelo 55 */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações NF-e (Modelo 55)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Série</Label>
                <Input
                  value={formData.serie || ""}
                  onChange={(e) => setFormData({...formData, serie: e.target.value})}
                  placeholder="A confirmar pelo contador"
                />
              </div>
              <div className="space-y-2">
                <Label>Próximo Número</Label>
                <Input
                  type="number"
                  value={formData.proximo_numero || 1}
                  onChange={(e) => setFormData({...formData, proximo_numero: Number(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={formData.ambiente || "homologacao"} onValueChange={(value) => setFormData({...formData, ambiente: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Credenciamento SEFAZ/UF</Label>
                <Select value={formData.status_credenciamento || "pendente"} onValueChange={(value) => setFormData({...formData, status_credenciamento: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Certificado Digital A1</Label>
                <Select value={formData.certificado_status || "pendente"} onValueChange={(value) => setFormData({...formData, certificado_status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="configurado">Configurado</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Nenhum certificado ou senha é armazenado nesta fase.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist de pendências do contador */}
        <Card>
          <CardHeader>
            <CardTitle>Checklist do Contador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Itens que precisam ser confirmados antes da homologação. Regras tributárias
              (CFOP, NCM, ICMS/ST, DIFAL) não são fixadas — aguardam confirmação do contador.
            </p>
            <div className="space-y-2">
              {[
                { key: "cfop_confirmado", label: "CFOP confirmado por operação" },
                { key: "ncm_confirmado", label: "NCM confirmado por produto" },
                { key: "icms_st_confirmado", label: "ICMS/ST confirmado" },
                { key: "difal_confirmado", label: "DIFAL confirmado (se aplicável)" },
                { key: "frete_confirmado", label: "Regras de frete confirmadas" },
                { key: "numeracao_confirmada", label: "Numeração confirmada" },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData[item.key])}
                    onChange={(e) => setFormData({...formData, [item.key]: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>

            {pendencias.length > 0 ? (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <p className="font-semibold text-yellow-900 mb-2">
                  Pendências restantes ({pendencias.length}):
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                  {pendencias.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                <p className="font-semibold text-green-900">
                  ✓ Todas as pendências resolvidas. Pronta para homologação.
                </p>
              </div>
            )}
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