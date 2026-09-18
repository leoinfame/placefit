import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  MessageCircle, CheckCircle, AlertCircle, ExternalLink, Eye, EyeOff,
  Loader2, Wifi, WifiOff, ChevronRight, ChevronDown, Info, Save, RefreshCw,
  QrCode, ShieldAlert, Smartphone, Power
} from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "Contrate um VPS",
    icon: "🖥️",
    description: "O WAHA roda em um servidor seu. Um VPS pequeno (2 vCPU / 4 GB) dá conta.",
    help: "Prefira um datacenter no Brasil para reduzir latência. O IP do servidor fica associado à sua sessão do WhatsApp — não compartilhe o mesmo VPS com disparadores de terceiros.",
    fields: [],
  },
  {
    id: 2,
    title: "Suba o WAHA no servidor",
    icon: "🐳",
    description: "Um contêiner Docker, com chave de API e a URL deste webhook já configuradas.",
    help: "Publique atrás de um domínio com HTTPS (Caddy ou Nginx). A porta padrão do WAHA é 3000. Guarde a chave que você definir em WAHA_API_KEY: é ela que vai no campo abaixo.",
    link: "https://waha.devlike.pro/docs/how-to/install/",
    linkLabel: "Guia de instalação do WAHA →",
    fields: [],
  },
  {
    id: 3,
    title: "Aponte o CRM para o servidor",
    icon: "🔌",
    description: "Informe o endereço público do WAHA e a chave de API.",
    help: "A URL precisa ser acessível pela internet — o CRM chama o servidor a cada envio, e o servidor chama o CRM a cada mensagem recebida.",
    fields: [
      {
        key: "waha_url",
        label: "URL do servidor WAHA",
        placeholder: "https://waha.seudominio.com.br",
        type: "text",
        help: "Endereço público, com https e sem barra no final.",
      },
      {
        key: "waha_api_key",
        label: "Chave de API (X-Api-Key)",
        placeholder: "sua-chave-secreta",
        type: "password",
        help: "O mesmo valor definido em WAHA_API_KEY ao subir o contêiner.",
      },
    ],
  },
  {
    id: 4,
    title: "Proteja o webhook",
    icon: "🔐",
    description: "Nome da sessão e assinatura HMAC das chamadas recebidas.",
    help: "O HMAC é opcional, mas recomendado: sem ele, qualquer um que descubra a URL do webhook pode injetar conversas falsas no seu CRM.",
    fields: [
      {
        key: "waha_session",
        label: "Nome da sessão",
        placeholder: "default",
        type: "text",
        help: "Deixe 'default' se você usa um número só. Este nome é como o CRM identifica de quem é a mensagem.",
      },
      {
        key: "waha_hmac",
        label: "Chave HMAC do webhook (opcional)",
        placeholder: "outra-chave-secreta",
        type: "password",
        help: "Se preencher, use o mesmo valor em WHATSAPP_HOOK_HMAC_KEY no servidor. O CRM passa a recusar qualquer chamada sem assinatura válida.",
      },
    ],
  },
];

const STATUS_LABEL = {
  WORKING: { text: "Conectado — recebendo e enviando", tone: "ok" },
  SCAN_QR_CODE: { text: "Aguardando leitura do QR Code", tone: "warn" },
  STARTING: { text: "Iniciando a sessão…", tone: "warn" },
  STOPPED: { text: "Sessão parada", tone: "off" },
  NAO_CRIADA: { text: "Ainda não conectado — toque em Conectar meu WhatsApp", tone: "off" },
  FAILED: { text: "Falhou — reinicie a sessão", tone: "bad" },
  NOT_CONFIGURED: { text: "Informe o servidor WAHA abaixo", tone: "off" },
  UNKNOWN: { text: "Não foi possível falar com o servidor", tone: "bad" },
};

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
// Conexão com a Meta (Cloud API + coexistência com o app WhatsApp Business).
// Visível apenas em homologação: renderiza nada até whatsapp_meta_homologacao
// estar ativo no usuário; o fluxo WAHA abaixo segue intacto.
function MetaConnectCard({ userId }) {
  const { toast } = useToast();
  const [meta, setMeta] = useState(null);
  const [metaBusy, setMetaBusy] = useState(false);

  useEffect(() => {
    let cancelado = false;
    base44.functions
      .invoke("crm-whatsapp", { action: "meta_status", owner_id: userId })
      .then((r) => { if (!cancelado) setMeta(r?.data || null); })
      .catch(() => { if (!cancelado) setMeta(null); });
    return () => { cancelado = true; };
  }, [userId]);

  if (!meta?.homologacao) return null;

  const carregarSdk = () => new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB);
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/pt_BR/sdk.js";
    s.async = true;
    s.onload = () => (window.FB ? resolve(window.FB) : reject(new Error("SDK do Facebook indisponível.")));
    s.onerror = () => reject(new Error("Não foi possível carregar o SDK do Facebook."));
    document.body.appendChild(s);
  });

  const conectarMeta = async () => {
    if (!meta?.preparado) return;
    setMetaBusy(true);
    const dados = {};
    const ouvinteMsg = (event) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (msg && msg.type === "WA_EMBEDDED_SIGNUP") {
          const d = msg.data || {};
          if (d.waba_id) dados.waba_id = d.waba_id;
          if (d.phone_number_id) dados.phone_number_id = d.phone_number_id;
        }
      } catch { /* ignora mensagens de outras origens */ }
    };
    try {
      const FB = await carregarSdk();
      FB.init({ appId: meta.app_id, cookie: true, xfbml: false, version: "v23.0" });
      window.addEventListener("message", ouvinteMsg);
      let resposta;
      try {
        resposta = await new Promise((resolve) => {
          FB.login((r) => resolve(r), {
            config_id: meta.config_id,
            response_type: "code",
            override_default_response_type: true,
            extras: {
              featureType: "whatsapp_business_app_onboarding",
              sessionInfoVersion: "3",
              version: "v3",
            },
          });
        });
        for (let i = 0; i < 20 && (!dados.waba_id || !dados.phone_number_id); i++) {
          await new Promise((r) => setTimeout(r, 150));
        }
      } finally {
        window.removeEventListener("message", ouvinteMsg);
      }
      const code = resposta?.authResponse?.code;
      if (!code) {
        toast({ title: "Conexão não concluída", description: "O cadastro na Meta foi fechado antes do fim. Nada foi alterado.", variant: "destructive" });
        return;
      }
      if (!dados.waba_id || !dados.phone_number_id) {
        toast({ title: "Dados incompletos", description: "A Meta não devolveu a WABA e o número. Tente de novo.", variant: "destructive" });
        return;
      }
      await base44.functions.invoke("crm-whatsapp", {
        action: "meta_embedded_signup_complete",
        owner_id: userId,
        code,
        waba_id: dados.waba_id,
        phone_number_id: dados.phone_number_id,
        session_info: dados,
      });
      toast({ title: "Número validado em homologação", description: "Conta conferida e token guardado com segurança. O envio segue pelo fluxo atual (WAHA)." });
      try {
        const rs = await base44.functions.invoke("crm-whatsapp", { action: "meta_status", owner_id: userId });
        setMeta(rs?.data || null);
      } catch { /* mantém o estado anterior */ }
    } catch (e) {
      toast({ title: "Falha ao conectar com a Meta", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setMetaBusy(false);
    }
  };

  const conexao = meta?.conexao || {};
  const conectado = conexao.status === "ativos_validados";
  return (
    <Card className="border-2 border-indigo-300 bg-indigo-50">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">Conectar com a Meta (Cloud API)</h3>
          </div>
          <Badge className="border-indigo-300 bg-white text-indigo-700">Homologação</Badge>
        </div>
        <p className="text-sm text-gray-600">
          Preparação da coexistência com o aplicativo WhatsApp Business. O fluxo atual (WAHA) continua ativo e nada é enviado pela Meta nesta etapa.
        </p>
        {conectado ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Número validado: {conexao.display_phone || conexao.phone_number_id} — WABA {conexao.waba_id || "sem id"}.
          </div>
        ) : !meta?.preparado ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Configuração pendente no servidor: {(meta?.pendencias || []).join(", ")}. Defina as variáveis do app antes de conectar.
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={!meta?.preparado || metaBusy || conectado}
            onClick={conectarMeta}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {metaBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {conectado ? "Conectado" : "Conectar com a Meta"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WhatsAppSetup({ userId, userType = "revendedor" }) {
  const [config, setConfig] = useState({
    waha_url: "",
    waha_api_key: "",
    waha_session: "default",
    waha_hmac: "",
    ativo: false,
    confirmado: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState(null);
  const [qr, setQr] = useState("");
  const [expandedStep, setExpandedStep] = useState(3);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pollRef = useRef(null);
  const { toast } = useToast();

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/functions/crm-whatsapp-webhook`
    : "";

  useEffect(() => {
    loadConfig();
    return () => clearInterval(pollRef.current);
  }, [userId]);

  // Enquanto o número não parear, o estado muda sozinho no servidor: só a
  // consulta periódica revela que o QR foi lido.
  useEffect(() => {
    clearInterval(pollRef.current);
    const s = status?.session_status;
    if (s === "SCAN_QR_CODE" || s === "STARTING") {
      pollRef.current = setInterval(() => refreshStatus(true), 5000);
    }
    return () => clearInterval(pollRef.current);
  }, [status?.session_status]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setConfig({
        waha_url: user.whatsapp_waha_url || "",
        waha_api_key: user.whatsapp_waha_api_key || "",
        waha_session: user.whatsapp_waha_session || "default",
        waha_hmac: user.whatsapp_waha_hmac || "",
        ativo: user.whatsapp_atendente_ativo || false,
        confirmado: user.whatsapp_atendente_confirmado || false,
      });
      // Sempre consulta: o servidor pode vir do app, sem nada preenchido aqui.
      await refreshStatus(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const refreshStatus = async (silent = false) => {
    if (!silent) setBusy("status");
    try {
      const response = await base44.functions.invoke("crm-whatsapp", { action: "status", owner_id: userId });
      const data = response?.data || null;
      setStatus(data);
      if (data?.session_status === "WORKING") setQr("");
      else if (data?.session_status === "SCAN_QR_CODE") await loadQr();
    } catch (e) {
      if (!silent) toast({ title: "Não foi possível consultar a sessão", description: e?.message, variant: "destructive" });
    }
    if (!silent) setBusy("");
  };

  const loadQr = async () => {
    try {
      const response = await base44.functions.invoke("crm-whatsapp", { action: "qr", owner_id: userId });
      if (response?.data?.qr) setQr(response.data.qr);
    } catch {
      /* a sessão pode ainda não ter gerado o código */
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        whatsapp_waha_url: config.waha_url.trim().replace(/\/+$/, ""),
        whatsapp_waha_api_key: config.waha_api_key,
        whatsapp_waha_session: config.waha_session.trim() || "default",
        whatsapp_waha_hmac: config.waha_hmac,
      });
      toast({ title: "Configurações salvas!", description: "Dados do servidor WAHA atualizados." });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // Um clique só: a function cria a sessão, liga o webhook, inicia e já volta
  // com o QR Code quando ele existe.
  const handleConnect = async () => {
    const servidorDoApp = Boolean(status?.compartilhado);
    if (!servidorDoApp && !config.waha_url) {
      toast({
        title: "Servidor de WhatsApp não configurado",
        description: "Peça ao administrador para definir a variável WAHA_URL do app.",
        variant: "destructive",
      });
      return;
    }
    setBusy("connect");
    try {
      // Com servidor próprio, grava os campos antes de usar.
      if (!servidorDoApp) await handleSave();
      const response = await base44.functions.invoke("crm-whatsapp", {
        action: "connect",
        owner_id: userId,
      });
      const data = response?.data || {};
      if (data.qr) setQr(data.qr);
      await refreshStatus(true);
      toast({
        title: data.session_status === "WORKING" ? "WhatsApp já conectado" : "Pronto para parear",
        description: data.session_status === "WORKING"
          ? "A sessão está ativa."
          : "Leia o QR Code abaixo com o celular do número.",
      });
    } catch (e) {
      toast({
        title: "Falha ao conectar",
        description: e?.response?.data?.error || e?.message,
        variant: "destructive",
      });
    }
    setBusy("");
  };

  const handleSessionAction = async (action) => {
    setBusy(action);
    try {
      await base44.functions.invoke("crm-whatsapp", { action, owner_id: userId });
      await refreshStatus(true);
      toast({ title: "Sessão atualizada" });
    } catch (e) {
      toast({ title: "Falha na operação", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    }
    setBusy("");
  };

  const applyAtendente = async (ativo, confirmar) => {
    setBusy("atendente");
    try {
      await base44.functions.invoke("crm-whatsapp", {
        action: "set_atendente",
        owner_id: userId,
        ativo,
        confirmar,
      });
      setConfig((c) => ({ ...c, ativo, confirmado: ativo && confirmar }));
      setConfirmOpen(false);
      await refreshStatus(true);
      toast({
        title: ativo ? "Atendente automático ligado" : "Atendente automático desligado",
        description: ativo
          ? "A IA passa a responder mensagens novas sozinha."
          : "Nenhuma resposta automática será enviada.",
      });
    } catch (e) {
      toast({ title: "Não foi possível alterar", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    }
    setBusy("");
  };

  // Servidor vindo das variáveis de ambiente do app: o usuário não preenche nada.
  const compartilhado = Boolean(status?.compartilhado);
  const isConfigured = compartilhado || Boolean(config.waha_url);
  const connected = status?.session_status === "WORKING";
  const atendenteOn = Boolean(config.ativo && config.confirmado);
  const statusInfo = STATUS_LABEL[status?.session_status] || STATUS_LABEL.UNKNOWN;
  const completedFields = [config.waha_url, config.waha_api_key, config.waha_session, config.waha_hmac].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MetaConnectCard userId={userId} />
      {/* Estado da conexão */}
      <Card className={`border-2 ${connected ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${connected ? "bg-green-100" : "bg-gray-100"}`}>
                {connected ? <Wifi className="w-6 h-6 text-green-600" /> : <WifiOff className="w-6 h-6 text-gray-400" />}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-lg">Conexão do WhatsApp</p>
                <p className="text-sm text-gray-500">
                  {isConfigured ? statusInfo.text : "Configure o servidor WAHA abaixo"}
                </p>
                {status?.me?.pushName && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Número pareado: {status.me.pushName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => refreshStatus(false)} disabled={!isConfigured || busy === "status"}>
                {busy === "status" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Atualizar
              </Button>
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={!isConfigured || busy === "connect"}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {busy === "connect" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                {connected ? "Reconectar" : "Conectar meu WhatsApp"}
              </Button>
              {connected && (
                <Button variant="outline" size="sm" onClick={() => handleSessionAction("logout")} disabled={busy === "logout"}>
                  <Power className="w-4 h-4 mr-2" />
                  Desconectar
                </Button>
              )}
            </div>
          </div>

          {!compartilhado && (
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
          )}
        </CardContent>
      </Card>

      {/* QR Code */}
      {qr && !connected && (
        <Card className="border-emerald-200 bg-white">
          <CardContent className="p-5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
              <Smartphone className="w-5 h-5" /> Leia com o celular do número
            </div>
            <img src={qr} alt="QR Code para parear o WhatsApp" className="w-64 h-64 rounded-lg border border-gray-200" />
            <p className="text-sm text-gray-600 text-center max-w-md">
              No celular: <strong>WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo</strong>.
              Seu WhatsApp continua funcionando normalmente no aparelho — o CRM entra como mais um dispositivo vinculado.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Atendente automático */}
      <Card className={`border-2 ${atendenteOn ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"}`}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className={`w-6 h-6 mt-0.5 ${atendenteOn ? "text-amber-600" : "text-gray-400"}`} />
              <div>
                <p className="font-bold text-gray-900">Atendente IA responde sozinho</p>
                <p className="text-sm text-gray-500">
                  {atendenteOn
                    ? "🟡 Ligado — a IA responde clientes reais pelo seu número"
                    : "🔒 Desligado — nenhuma resposta automática é enviada"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">{atendenteOn ? "Ativo" : "Inativo"}</span>
              <Switch
                checked={atendenteOn}
                disabled={!connected || busy === "atendente"}
                onCheckedChange={(v) => (v ? setConfirmOpen(true) : applyAtendente(false, false))}
              />
            </div>
          </div>

          {confirmOpen && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-100 p-4 space-y-3">
              <p className="font-semibold text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Confirma ligar o atendente automático?
              </p>
              <ul className="text-sm text-amber-900 list-disc ml-5 space-y-1">
                <li>A IA vai responder <strong>clientes reais</strong>, sozinha, pelo seu número comercial.</li>
                <li>Se você já respondeu na conversa há menos de 1 hora, a IA fica em silêncio — quem assumiu, assumiu.</li>
                <li>Resposta automática em volume é o principal gatilho de bloqueio do número. Comece observando.</li>
              </ul>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => applyAtendente(true, true)}
                  disabled={busy === "atendente"}
                >
                  {busy === "atendente" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Sim, ligar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {!connected && (
            <p className="text-xs text-gray-500">Conecte a sessão antes de habilitar o atendente automático.</p>
          )}
        </CardContent>
      </Card>

      {/* Como funciona */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex gap-3">
          <MessageCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Como funciona esta integração?</p>
            <p>
              O CRM entra como um <strong>dispositivo vinculado</strong> ao seu WhatsApp, igual ao WhatsApp Web.
              Seu celular continua funcionando normalmente, e tudo que entra ou sai vira conversa organizada aqui dentro —
              inclusive o que você responde pelo próprio aparelho.
            </p>
            <p className="mt-1 text-blue-600">
              Grupos e listas de transmissão são ignorados de propósito: o CRM cuida de negociação individual.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Risco */}
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-4 flex gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-semibold mb-1">Antes de conectar, entenda o risco</p>
            <p>
              Esta integração usa um cliente <strong>não-oficial</strong> do WhatsApp. Os Termos da Meta proíbem esse tipo
              de acesso, e o número pode ser bloqueado. Na prática o bloqueio acompanha o <strong>comportamento de envio</strong>:
              usar como caixa de entrada organizada é de baixo risco; disparo em massa para quem não pediu contato queima o número.
            </p>
            <p className="mt-1">Use para organizar leads e negociações. Não use para campanha.</p>
          </div>
        </CardContent>
      </Card>

      {/* Configuração técnica — só aparece para quem usa servidor próprio.
          Com o servidor do app, o usuário não precisa ver nada disso. */}
      {!compartilhado && (
      <>
      <div className="space-y-3">
        <h3 className="font-bold text-gray-900 text-lg">📋 Passo a Passo de Configuração</h3>
        {STEPS.map((step) => {
          const isExpanded = expandedStep === step.id;
          const hasFields = step.fields.length > 0;
          const stepDone = step.fields.length === 0 ? false : step.fields.every((f) => !!config[f.key]);

          return (
            <Card
              key={step.id}
              className={`border transition-all ${stepDone ? "border-green-300 bg-green-50" : isExpanded ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}
            >
              <button className="w-full text-left" onClick={() => setExpandedStep(isExpanded ? null : step.id)}>
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
                        {!isExpanded && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{step.description}</p>}
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
                    <Button size="sm" variant="outline" onClick={() => setExpandedStep(step.id + 1)} className="mt-2">
                      Próximo passo <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Webhook */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-semibold">Webhook</p>
            <p>
              O botão <strong>Conectar sessão</strong> cadastra este endereço no WAHA automaticamente, com os eventos{" "}
              <code className="bg-amber-100 px-1 rounded">message.any</code>,{" "}
              <code className="bg-amber-100 px-1 rounded">message.ack</code> e{" "}
              <code className="bg-amber-100 px-1 rounded">session.status</code>.
            </p>
            <p className="break-all">
              <strong>URL:</strong> <code className="bg-amber-100 px-1 rounded">{webhookUrl}</code>
            </p>
          </div>
        </CardContent>
      </Card>

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
      </>
      )}
    </div>
  );
}
