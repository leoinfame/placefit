import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  MessageCircle, CheckCircle, AlertCircle, ExternalLink, Eye, EyeOff,
  Loader2, Wifi, WifiOff, ChevronRight, ChevronDown, Info, Save, RefreshCw
} from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "Crie uma conta Meta Business",
    icon: "🏢",
    description: "Acesse o Meta Business Suite para criar sua conta de negócios.",
    help: "Você precisará de uma conta Meta Business para usar a API oficial do WhatsApp.",
    link: "https://business.facebook.com/",
    linkLabel: "Acessar Meta Business →",
    fields: [],
  },
  {
    id: 2,
    title: "Crie um App na Meta for Developers",
    icon: "⚙️",
    description: "Crie um aplicativo do tipo 'Business' no painel de desenvolvedores da Meta.",
    help: "No painel, clique em 'Create App' → selecione tipo 'Business' → siga o assistente.",
    link: "https://developers.facebook.com/apps/",
    linkLabel: "Acessar Meta Developers →",
    fields: [],
  },
  {
    id: 3,
    title: "Ative o produto WhatsApp no App",
    icon: "📱",
    description: "Dentro do seu app, adicione o produto 'WhatsApp' e configure um número de teste.",
    help: "No painel do app → clique em 'Add Product' → selecione 'WhatsApp' → configure o número de teste gratuito fornecido pela Meta.",
    link: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    linkLabel: "Ver guia oficial →",
    fields: [],
  },
  {
    id: 4,
    title: "Obtenha o Phone Number ID",
    icon: "🔢",
    description: "No painel do WhatsApp Business API, copie o 'Phone Number ID' do número configurado.",
    help: "No painel da Meta → WhatsApp → API Setup → copie o 'Phone Number ID' (ex: 123456789012345). Este é o ID do número de telefone que enviará as mensagens.",
    link: "https://developers.facebook.com/apps/",
    linkLabel: "Ir para o painel →",
    fields: [
      {
        key: "phone_number_id",
        label: "Phone Number ID",
        placeholder: "Ex: 123456789012345",
        type: "text",
        help: "Onde achar: Meta Developers → seu App → WhatsApp → API Setup → 'Phone Number ID'",
      },
    ],
  },
  {
    id: 5,
    title: "Obtenha o Token de Acesso",
    icon: "🔑",
    description: "Gere um token de acesso permanente para autenticar as chamadas à API.",
    help: "Para token temporário de teste: Meta Developers → WhatsApp → API Setup → 'Temporary access token'. Para produção: gere um token permanente via System User no Meta Business Suite.",
    link: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started",
    linkLabel: "Guia de tokens →",
    fields: [
      {
        key: "access_token",
        label: "Access Token",
        placeholder: "EAAxxxxxxxx...",
        type: "password",
        help: "Onde achar: Meta Developers → seu App → WhatsApp → API Setup → 'Temporary access token' (ou gere um permanente no Meta Business)",
      },
    ],
  },
  {
    id: 6,
    title: "Configure o Webhook",
    icon: "🔗",
    description: "Configure um Webhook para receber mensagens dos seus clientes em tempo real.",
    help: "O webhook permite que o PlaceFit receba as mensagens enviadas para o seu número do WhatsApp. Você precisará de uma URL pública (pode usar o ngrok para testes) ou contratar um servidor.",
    link: "https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks",
    linkLabel: "Guia de Webhook →",
    fields: [
      {
        key: "webhook_verify_token",
        label: "Webhook Verify Token",
        placeholder: "Crie uma senha secreta sua (ex: minha_chave_secreta_123)",
        type: "text",
        help: "Crie qualquer texto secreto. Você vai precisar colocar este mesmo valor no campo 'Verify Token' ao configurar o webhook na Meta.",
      },
      {
        key: "waba_id",
        label: "WhatsApp Business Account ID (WABA ID)",
        placeholder: "Ex: 987654321098765",
        type: "text",
        help: "Onde achar: Meta Business Suite → Configurações → WhatsApp Accounts → ID da conta. Ou no painel da Meta for Developers ao configurar o WhatsApp.",
      },
    ],
  },
];

function FieldInput({ field, value, onChange }) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-gray-700">{field.label}</Label>
      <div className="relative">
        <Input
          type={field.type === "password" && !showPassword ? "password" : "text"}
          value={value || ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="pr-10 font-mono text-sm"
        />
        {field.type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      <p className="text-xs text-blue-600 flex items-start gap-1">
        <Info className="w-3 h-3 shrink-0 mt-0.5" />
        {field.help}
      </p>
    </div>
  );
}

export default function WhatsAppSetup({ userId, userType = "revendedor" }) {
  const [config, setConfig] = useState({
    phone_number_id: "",
    access_token: "",
    webhook_verify_token: "",
    waba_id: "",
    ativo: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [expandedStep, setExpandedStep] = useState(4);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, [userId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setConfig({
        phone_number_id: user.whatsapp_phone_number_id || "",
        access_token: user.whatsapp_access_token || "",
        webhook_verify_token: user.whatsapp_webhook_token || "",
        waba_id: user.whatsapp_waba_id || "",
        ativo: user.whatsapp_atendente_ativo || false,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        whatsapp_phone_number_id: config.phone_number_id,
        whatsapp_access_token: config.access_token,
        whatsapp_webhook_token: config.webhook_verify_token,
        whatsapp_waba_id: config.waba_id,
        whatsapp_atendente_ativo: config.ativo,
      });
      toast({ title: "Configurações salvas!", description: "Dados do WhatsApp atualizados com sucesso." });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleTestConnection = async () => {
    if (!config.phone_number_id || !config.access_token) {
      toast({ title: "Preencha os campos obrigatórios", description: "Phone Number ID e Access Token são necessários.", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // Testa chamando a API da Meta para verificar o número
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${config.phone_number_id}`,
        { headers: { Authorization: `Bearer ${config.access_token}` } }
      );
      const data = await res.json();
      if (data.error) {
        setTestResult({ ok: false, message: `Erro: ${data.error.message}` });
      } else {
        setTestResult({ ok: true, message: `Conectado! Número: ${data.display_phone_number || data.id}` });
      }
    } catch (e) {
      setTestResult({ ok: false, message: "Falha na conexão. Verifique os dados e tente novamente." });
    }
    setTesting(false);
  };

  const isConfigured = config.phone_number_id && config.access_token;
  const completedFields = [config.phone_number_id, config.access_token, config.webhook_verify_token, config.waba_id].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={`border-2 ${config.ativo && isConfigured ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${config.ativo && isConfigured ? "bg-green-100" : "bg-gray-100"}`}>
                {config.ativo && isConfigured
                  ? <Wifi className="w-6 h-6 text-green-600" />
                  : <WifiOff className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Atendente IA no WhatsApp</p>
                <p className="text-sm text-gray-500">
                  {config.ativo && isConfigured
                    ? "🟢 Conectado e ativo — respondendo mensagens automaticamente"
                    : !isConfigured
                    ? "⚠️ Configure as credenciais abaixo para ativar"
                    : "🔴 Desativado — configure e habilite para iniciar"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {config.ativo ? "Ativo" : "Inativo"}
              </span>
              <Switch
                checked={config.ativo}
                onCheckedChange={(v) => setConfig({ ...config, ativo: v })}
                disabled={!isConfigured}
              />
            </div>
          </div>

          {isConfigured && (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Testar Conexão
              </Button>
              {testResult && (
                <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg ${testResult.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                  {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {testResult.message}
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Configuração completa</span>
              <span>{completedFields}/4 campos</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                style={{ width: `${(completedFields / 4) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intro */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex gap-3">
          <MessageCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Como funciona a integração?</p>
            <p>Ao conectar o WhatsApp, seu Atendente IA responderá automaticamente as mensagens recebidas no número configurado, fazendo orçamentos, respondendo dúvidas de produtos e muito mais — 24h por dia, 7 dias por semana.</p>
            <p className="mt-1 text-blue-600">A API oficial do WhatsApp Business (Meta Cloud API) é gratuita para até 1.000 conversas por mês.</p>
          </div>
        </CardContent>
      </Card>

      {/* Passo a Passo */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-900 text-lg">📋 Passo a Passo de Configuração</h3>
        {STEPS.map((step) => {
          const isExpanded = expandedStep === step.id;
          const hasFields = step.fields.length > 0;
          const stepDone = step.fields.length === 0
            ? false
            : step.fields.every((f) => !!config[f.key]);

          return (
            <Card
              key={step.id}
              className={`border transition-all ${stepDone ? "border-green-300 bg-green-50" : isExpanded ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}
            >
              <button
                className="w-full text-left"
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${stepDone ? "bg-green-100 text-green-700" : isExpanded ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {stepDone ? <CheckCircle className="w-5 h-5 text-green-600" /> : step.icon}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${stepDone ? "text-green-800" : "text-gray-900"}`}>
                          Passo {step.id}: {step.title}
                        </p>
                        {!isExpanded && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{step.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {stepDone && <Badge className="bg-green-100 text-green-700 text-[10px]">✓ Pronto</Badge>}
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </CardContent>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                  <p className="text-sm text-gray-700">{step.description}</p>

                  <div className="bg-white rounded-lg border border-blue-100 p-3 text-sm text-blue-800 flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                    <span>{step.help}</span>
                  </div>

                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {step.linkLabel}
                    </a>
                  )}

                  {hasFields && (
                    <div className="space-y-4 pt-2">
                      {step.fields.map((field) => (
                        <FieldInput
                          key={field.key}
                          field={field}
                          value={config[field.key]}
                          onChange={(key, val) => setConfig({ ...config, [key]: val })}
                        />
                      ))}
                    </div>
                  )}

                  {step.id < STEPS.length && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedStep(step.id + 1)}
                      className="mt-2"
                    >
                      Próximo passo <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Webhook Info */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-semibold">Configuração do Webhook na Meta</p>
            <p>Após salvar, configure o webhook no painel da Meta com:</p>
            <ul className="list-disc ml-4 space-y-1">
              <li><strong>Callback URL:</strong> A URL do seu servidor que receberá as mensagens</li>
              <li><strong>Verify Token:</strong> O mesmo valor que você preencheu no campo "Webhook Verify Token" acima</li>
              <li><strong>Fields:</strong> Marque <code className="bg-amber-100 px-1 rounded">messages</code></li>
            </ul>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold hover:underline mt-1"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver documentação completa →
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}