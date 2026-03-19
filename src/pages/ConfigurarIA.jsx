import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, AlertCircle } from "lucide-react";

export default function ConfigurarIA() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iaConfig, setIaConfig] = useState(null);
  const [formData, setFormData] = useState({
    agent_name: "Assistente",
    regras: "",
    ativo: true,
    plano: "starter",
    mensagem_boas_vindas: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Buscar IAConfig do revendedor
      const configs = await base44.entities.IAConfig.filter({
        revendedor_id: currentUser.id
      });

      if (configs && configs.length > 0) {
        const config = configs[0];
        setIaConfig(config);
        setFormData({
          agent_name: config.agent_name || "Assistente",
          regras: config.regras || "",
          ativo: config.ativo !== false,
          plano: config.plano || "starter",
          mensagem_boas_vindas: config.mensagem_boas_vindas || ""
        });
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações.",
        variant: "destructive"
      });
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.agent_name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do agente é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (iaConfig) {
        // Atualizar configuração existente
        await base44.entities.IAConfig.update(iaConfig.id, {
          revendedor_id: user.id,
          ...formData
        });
        toast({
          title: "Sucesso!",
          description: "Configuração atualizada com sucesso."
        });
      } else {
        // Criar nova configuração
        const newConfig = await base44.entities.IAConfig.create({
          revendedor_id: user.id,
          ...formData
        });
        setIaConfig(newConfig);
        toast({
          title: "Sucesso!",
          description: "Configuração criada com sucesso."
        });
      }
      
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurar Agente IA</h1>
          <p className="text-gray-600 mt-2">
            Personalize o assistente de WhatsApp automático para sua empresa
          </p>
        </div>

        {/* Info Banner */}
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Estas configurações definem o comportamento do agente IA que responde mensagens de WhatsApp automaticamente.
          </AlertDescription>
        </Alert>

        {/* Formulário */}
        <Card className="bg-white shadow-lg">
          <CardHeader>
            <CardTitle>Configurações do Agente</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome do Agente */}
              <div>
                <Label htmlFor="agent_name">Nome do Agente *</Label>
                <Input
                  id="agent_name"
                  value={formData.agent_name}
                  onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                  placeholder="Ex: Assistente PlaceFit"
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Este nome aparecerá nas mensagens do agente
                </p>
              </div>

              {/* Plano */}
              <div>
                <Label htmlFor="plano">Plano de Serviço</Label>
                <Select value={formData.plano} onValueChange={(value) => setFormData({ ...formData, plano: value })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">
                      <div className="font-medium">Starter</div>
                      <p className="text-xs text-gray-500">Até 100 mensagens/mês</p>
                    </SelectItem>
                    <SelectItem value="pro">
                      <div className="font-medium">Pro</div>
                      <p className="text-xs text-gray-500">Até 1.000 mensagens/mês</p>
                    </SelectItem>
                    <SelectItem value="unlimited">
                      <div className="font-medium">Unlimited</div>
                      <p className="text-xs text-gray-500">Mensagens ilimitadas</p>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mensagem de Boas-vindas */}
              <div>
                <Label htmlFor="mensagem_boas_vindas">Mensagem de Boas-vindas</Label>
                <Textarea
                  id="mensagem_boas_vindas"
                  value={formData.mensagem_boas_vindas}
                  onChange={(e) => setFormData({ ...formData, mensagem_boas_vindas: e.target.value })}
                  placeholder="Ex: Olá! Bem-vindo à PlaceFit. Como posso ajudá-lo?"
                  rows={3}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enviada quando um cliente inicia a conversa
                </p>
              </div>

              {/* Regras e Instruções */}
              <div>
                <Label htmlFor="regras">Regras e Instruções *</Label>
                <Textarea
                  id="regras"
                  value={formData.regras}
                  onChange={(e) => setFormData({ ...formData, regras: e.target.value })}
                  placeholder={`Ex: 
- Sempre saudação com emojis apropriados
- Respostas máximo 3 parágrafos
- Se não souber, ofereça falar com um atendente
- Foque em vender produtos de qualidade
- Informar que aceita PIX e cartão`}
                  rows={6}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Defina as principais regras de comportamento do agente
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <div>
                  <Label className="font-medium cursor-pointer">
                    {formData.ativo ? "Agente Ativo" : "Agente Desativado"}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {formData.ativo
                      ? "O agente está respondendo mensagens"
                      : "O agente não está respondendo no momento"}
                  </p>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Configurações
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg">💡 Dica</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700">
              Quanto mais detalhadas as regras, melhor o agente consegue responder de forma alinhada com sua marca.
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-lg">⚙️ Integração</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700">
              O agente usa a IA mais avançada para gerar respostas naturais e personalizadas.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}