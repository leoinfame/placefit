import { createClientFromRequest } from "npm:@base44/sdk";

// ─── CRM WhatsApp via WAHA ────────────────────────────────────────────────────
// Motor não-oficial (https://waha.devlike.pro) pareado por QR Code como
// dispositivo vinculado: o celular do dono do número continua funcionando
// normalmente. Substitui a Cloud API da Meta, que exigia registrar o número e
// o desconectava do aplicativo.
//
// Consequência aceita: não existe template aprovado pela Meta nem janela de 24h
// — qualquer mensagem sai como texto livre. Em troca, o risco é de banimento do
// número se houver disparo em massa. Esta integração é para organizar conversas,
// não para campanha.

const onlyDigits = (value: string) => String(value || "").replace(/\D/g, "");

/** Normaliza para MSISDN brasileiro (55 + DDD + número). */
const toMsisdn = (value: string) => {
  const digits = onlyDigits(value);
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return digits.length >= 10 ? "55" + digits : digits;
};

type Waha = {
  baseUrl: string;
  apiKey: string;
  hmac: string;
  session: string;
  configured: boolean;
  compartilhado: boolean;
};

const env = (nome: string) => String(Deno.env.get(nome) || "").trim();

/**
 * Nome da sessão derivado do id do usuário. Dois fornecedores nunca colidem e
 * ninguém precisa inventar (nem digitar) um nome.
 */
const sessionDoUsuario = (id: string) =>
  "u" + String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(-24);

/**
 * O servidor WAHA é do app, não do usuário: configurado uma única vez nas
 * variáveis de ambiente (WAHA_URL / WAHA_API_KEY / WAHA_HMAC_KEY). Assim o
 * fornecedor abre a tela e só precisa ler o QR Code.
 * Os campos por usuário continuam valendo como escape, para quem quiser
 * apontar para um servidor próprio.
 */
const wahaConfig = (owner: any): Waha => {
  const envUrl = env("WAHA_URL");
  const compartilhado = Boolean(envUrl);
  const baseUrl = (envUrl || String(owner.whatsapp_waha_url || "")).trim().replace(/\/+$/, "");
  return {
    baseUrl,
    apiKey: env("WAHA_API_KEY") || String(owner.whatsapp_waha_api_key || ""),
    hmac: env("WAHA_HMAC_KEY") || String(owner.whatsapp_waha_hmac || ""),
    session: String(owner.whatsapp_waha_session || "").trim() || sessionDoUsuario(owner.id),
    configured: Boolean(baseUrl),
    compartilhado
  };
};

/** URL pública do webhook, montada sozinha a partir do endereço do app. */
const webhookPadrao = () => {
  const base = (env("APP_PUBLIC_URL") || "https://placefit.base44.app").replace(/\/+$/, "");
  return base + "/functions/crm-whatsapp-webhook";
};

async function waha(cfg: Waha, path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers["X-Api-Key"] = cfg.apiKey;
  const response = await fetch(cfg.baseUrl + path, {
    ...init,
    headers: { ...headers, ...((init.headers as Record<string, string>) || {}) }
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  const error = response.ok
    ? ""
    : (data?.message || data?.error || String(data || "").slice(0, 200) || "Falha na chamada ao WAHA");
  return { ok: response.ok, status: response.status, data, error };
}

/**
 * Resolve o chatId canônico antes de enviar. Obrigatório no Brasil: números
 * anteriores a 2012 não têm o nono dígito e o envio para o chatId errado falha
 * sem erro visível.
 */
async function resolveChatId(cfg: Waha, phone: string) {
  const msisdn = toMsisdn(phone);
  if (!msisdn) return "";
  const fallback = msisdn + "@c.us";
  const result = await waha(
    cfg,
    "/api/contacts/check-exists?phone=" + msisdn + "&session=" + encodeURIComponent(cfg.session)
  );
  if (!result.ok || !result.data?.numberExists) return fallback;
  return result.data.chatId || result.data.pn || fallback;
}

const messageIdOf = (data: any) =>
  String(data?.id?._serialized || data?.id || data?._data?.id?._serialized || "");

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "Método não permitido" }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: "Autenticação obrigatória" }, { status: 401 });

    const body = await req.json();
    const action = String(body.action || "status");
    const ownerId = me.role === "admin" && body.owner_id ? String(body.owner_id) : me.id;
    const owner = await base44.asServiceRole.entities.User.get(ownerId);
    if (!owner) return Response.json({ error: "Conta responsável não encontrada" }, { status: 404 });
    if (me.role !== "admin" && owner.id !== me.id) return Response.json({ error: "Acesso negado" }, { status: 403 });

    const cfg = wahaConfig(owner);

    // O atendente automático só responde com as DUAS chaves ligadas. A segunda é
    // uma confirmação explícita e deliberada: com o número comercial real
    // pareado, uma IA respondendo sozinha é o maior risco do sistema — comercial
    // e de banimento. Ligar sem querer não pode ser possível.
    const atendenteAtivo = Boolean(owner.whatsapp_atendente_ativo) && Boolean(owner.whatsapp_atendente_confirmado);

    if (action === "status") {
      let session: any = null;
      if (cfg.configured) {
        const result = await waha(cfg, "/api/sessions/" + encodeURIComponent(cfg.session));
        session = result.ok ? result.data : { status: "UNKNOWN", error: result.error };
      }
      return Response.json({
        configured: cfg.configured,
        engine: "waha",
        // true = servidor do app, vindo das variáveis de ambiente. A tela esconde
        // os campos técnicos e mostra só o botão de conectar.
        compartilhado: cfg.compartilhado,
        session_name: cfg.session,
        session_status: session?.status || "NOT_CONFIGURED",
        connected: session?.status === "WORKING",
        me: session?.me || null,
        atendente_ativo: atendenteAtivo,
        atendente_flag: Boolean(owner.whatsapp_atendente_ativo),
        atendente_confirmado: Boolean(owner.whatsapp_atendente_confirmado),
        owner: { id: owner.id, name: owner.empresa || owner.full_name || owner.email }
      });
    }

    // Alternar o atendente automático. Exige confirmar as duas chaves na mesma
    // chamada para não reativar por acidente.
    if (action === "set_atendente") {
      const ativo = Boolean(body.ativo);
      const confirmado = ativo ? Boolean(body.confirmar) : false;
      if (ativo && !confirmado) {
        return Response.json({
          error: "Para ligar o atendente automático envie também confirmar: true. Ele passa a responder clientes reais sozinho, pelo seu número."
        }, { status: 400 });
      }
      await base44.asServiceRole.entities.User.update(ownerId, {
        whatsapp_atendente_ativo: ativo,
        whatsapp_atendente_confirmado: confirmado
      });
      return Response.json({ ok: true, atendente_ativo: ativo && confirmado });
    }

    if (!cfg.configured) {
      return Response.json({
        error: "O servidor de WhatsApp ainda não foi configurado. Defina a variável WAHA_URL nas configurações do app."
      }, { status: 400 });
    }

    // ── Ciclo de vida da sessão (pareamento por QR Code) ──────────────────────

    if (action === "test") {
      const result = await waha(cfg, "/api/sessions/" + encodeURIComponent(cfg.session));
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
      const status = result.data?.status || "UNKNOWN";
      return Response.json({
        ok: status === "WORKING",
        status,
        engine: result.data?.engine?.engine || result.data?.engine || "",
        display_phone_number: result.data?.me?.id ? onlyDigits(String(result.data.me.id).split("@")[0]) : "",
        push_name: result.data?.me?.pushName || ""
      });
    }

    if (action === "start" || action === "stop" || action === "restart" || action === "logout") {
      const result = await waha(cfg, "/api/sessions/" + encodeURIComponent(cfg.session) + "/" + action, { method: "POST" });
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ ok: true, session: result.data });
    }

    // O QR volta como data URL: o navegador não pode chamar o WAHA direto,
    // porque precisaria carregar a X-Api-Key numa tag <img>.
    async function buscarQr() {
      const headers: Record<string, string> = {};
      if (cfg.apiKey) headers["X-Api-Key"] = cfg.apiKey;
      const response = await fetch(
        cfg.baseUrl + "/api/" + encodeURIComponent(cfg.session) + "/auth/qr",
        { headers }
      );
      if (!response.ok) return "";
      const contentType = response.headers.get("content-type") || "image/png";
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return "data:" + contentType + ";base64," + btoa(binary);
    }

    // Cria (ou atualiza) a sessão já apontando o webhook para esta app, e inicia.
    async function garantirSessao(webhookUrl: string) {
      const config = {
        webhooks: [{
          url: webhookUrl,
          // Só message.any: ele já entrega as recebidas E as que o dono manda
          // pelo próprio celular. Assinar "message" junto duplicaria as recebidas.
          events: ["message.any", "message.ack", "session.status"],
          ...(cfg.hmac ? { hmac: { key: cfg.hmac } } : {}),
          retries: { policy: "exponential", delaySeconds: 2, attempts: 15 }
        }]
      };
      let result = await waha(cfg, "/api/sessions", {
        method: "POST",
        body: JSON.stringify({ name: cfg.session, start: true, config })
      });
      // Sessão já existente: atualiza a configuração e garante que está de pé.
      if (!result.ok && (result.status === 409 || result.status === 422)) {
        result = await waha(cfg, "/api/sessions/" + encodeURIComponent(cfg.session), {
          method: "PUT",
          body: JSON.stringify({ config })
        });
        if (result.ok) {
          await waha(cfg, "/api/sessions/" + encodeURIComponent(cfg.session) + "/start", { method: "POST" });
        }
      }
      return result;
    }

    // Um botão só. Cria a sessão, liga o webhook, inicia e já devolve o QR
    // quando ele existe — o usuário não digita URL, chave nem nome de sessão.
    if (action === "connect" || action === "provision") {
      const webhookUrl = String(body.webhook_url || "").trim() || webhookPadrao();
      const result = await garantirSessao(webhookUrl);
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

      // O WAHA leva alguns segundos entre STARTING e SCAN_QR_CODE.
      let status = String(result.data?.status || "");
      let qr = "";
      for (let tentativa = 0; tentativa < 6; tentativa++) {
        if (status === "SCAN_QR_CODE") {
          qr = await buscarQr();
          if (qr) break;
        }
        if (status === "WORKING" || status === "FAILED") break;
        await new Promise((r) => setTimeout(r, 1500));
        const atual = await waha(cfg, "/api/sessions/" + encodeURIComponent(cfg.session));
        status = String(atual.data?.status || status);
      }

      return Response.json({ ok: true, session_name: cfg.session, session_status: status, qr, webhook_url: webhookUrl });
    }

    if (action === "qr") {
      const qr = await buscarQr();
      if (!qr) {
        return Response.json({
          error: "Não foi possível obter o QR Code. A sessão precisa estar em SCAN_QR_CODE."
        }, { status: 400 });
      }
      return Response.json({ ok: true, qr });
    }

    // ── Envio ────────────────────────────────────────────────────────────────

    if (action === "send_text" || action === "send_template") {
      let messageType = "texto";
      let content = String(body.text || "");
      let templateName = "";

      if (action === "send_template") {
        const template = await base44.asServiceRole.entities.CRMTemplate.get(String(body.template_id || ""));
        if (!template || template.owner_id !== ownerId) {
          return Response.json({ error: "Template não encontrado" }, { status: 404 });
        }
        // No WAHA não existe aprovação da Meta nem janela de 24h: o template
        // local vira texto comum. Some a trava antiga de origem/status.
        messageType = "template";
        content = String(template.conteudo || "");
        templateName = String(template.nome || "");
      }

      if (!content.trim()) return Response.json({ error: "Digite a mensagem" }, { status: 400 });

      const chatId = await resolveChatId(cfg, body.to);
      if (!chatId) return Response.json({ error: "Telefone inválido" }, { status: 400 });
      const phone = onlyDigits(String(chatId).split("@")[0]);

      const result = await waha(cfg, "/api/sendText", {
        method: "POST",
        body: JSON.stringify({ session: cfg.session, chatId, text: content.trim() })
      });
      const messageId = messageIdOf(result.data);

      if (body.conversa_id) {
        await base44.asServiceRole.entities.CRMMensagem.create({
          owner_id: ownerId,
          conversa_id: String(body.conversa_id),
          telefone: phone,
          direcao: "enviada",
          tipo: messageType,
          conteudo: content,
          status: result.ok ? "enviada" : "erro",
          meta_message_id: messageId,
          template_nome: templateName,
          erro: result.ok ? "" : result.error
        });
        await base44.asServiceRole.entities.CRMConversa.update(String(body.conversa_id), {
          ultima_mensagem: content,
          ultima_interacao: new Date().toISOString()
        });
      }

      if (!result.ok) return Response.json({ error: result.error, details: result.data }, { status: 400 });
      return Response.json({ ok: true, message_id: messageId, chat_id: chatId });
    }

    // Marca a conversa como lida no celular também, para o CRM não deixar o
    // aplicativo do dono cheio de not-lidas fantasma.
    if (action === "mark_seen") {
      const chatId = await resolveChatId(cfg, body.to);
      if (!chatId) return Response.json({ error: "Telefone inválido" }, { status: 400 });
      const result = await waha(cfg, "/api/sendSeen", {
        method: "POST",
        body: JSON.stringify({ session: cfg.session, chatId })
      });
      if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
      return Response.json({ ok: true });
    }

    // Mantido para não quebrar a UI antiga: templates da Meta não existem mais.
    if (action === "sync_templates") {
      return Response.json({
        ok: true,
        count: 0,
        templates: [],
        aviso: "Sem templates da Meta nesta integração. Com o WAHA os modelos locais são enviados como texto comum, sem aprovação e sem janela de 24h."
      });
    }

    return Response.json({ error: "Ação desconhecida" }, { status: 400 });
  } catch (error) {
    console.error("[CRM_WHATSAPP]", error);
    return Response.json({ error: error?.message || "Erro interno" }, { status: 500 });
  }
});
