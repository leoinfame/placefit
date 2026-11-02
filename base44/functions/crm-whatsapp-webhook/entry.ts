import { createClientFromRequest } from "npm:@base44/sdk";
import { identificar, meusIdsDoCorpo, resolverLidNoWaha, ignorado } from "../../shared/identidadeWaha.ts";
import { conversaDoContato, garantirCliente, textoBoasVindas, deveMandarBoasVindas } from "../../shared/conversaWaha.ts";
import { etapaDepoisDaResposta } from "../../shared/funilCrm.js";

// ─── Webhook do CRM WhatsApp (WAHA) ───────────────────────────────────────────
// Recebe os eventos do servidor WAHA. Assina apenas "message.any", que entrega
// tanto o que o cliente manda quanto o que o dono responde pelo próprio celular
// — é isso que permite organizar os leads sem atrapalhar o uso normal do
// WhatsApp. Assinar "message" junto duplicaria as recebidas.

const onlyDigits = (value: string) => String(value || "").replace(/\D/g, "");

const env = (nome: string) => String(Deno.env.get(nome) || "").trim();

/** Mesma regra da function crm-whatsapp: a sessão carrega o id do dono. */
const sessionDoUsuario = (id: string) =>
  "u" + String(id || "").replace(/[^A-Za-z0-9]/g, "").slice(-24);

// Item 006: sessao propria por conta; "default" nunca identifica revendedor.
const sessionDe = (owner: any) => {
  const custom = String(owner.whatsapp_waha_session || "").trim();
  return custom && custom.toLowerCase() !== "default" ? custom : sessionDoUsuario(owner.id);
};

/** Servidor do app (variável de ambiente) com o campo do usuário como escape. */
// Item 006: servidor so pelo secret do app (nada do cadastro do usuario).
const baseUrlDe = (_owner: any) => env("WAHA_URL").replace(/\/+$/, "");
const isGroup = (chatId: string) => String(chatId || "").endsWith("@g.us");
const isBroadcast = (chatId: string) => String(chatId || "").includes("broadcast");

/** Janela em que uma resposta humana suspende o atendente automático. */
const HUMAN_TAKEOVER_MINUTES = 60;

const ACK_TO_STATUS: Record<string, string> = {
  "-1": "erro",
  "0": "pendente",
  "1": "enviada",
  "2": "entregue",
  "3": "lida",
  "4": "lida"
};

/** Valida a assinatura HMAC-SHA512 que o WAHA envia em X-Webhook-Hmac. */
async function hmacValid(rawBody: string, key: string, provided: string) {
  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(key),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return expected === String(provided || "").trim().toLowerCase();
  } catch (error) {
    console.error("[CRM_WEBHOOK] Falha ao validar HMAC", error);
    return false;
  }
}

async function sendText(owner: any, chatId: string, text: string) {
  const baseUrl = baseUrlDe(owner);
  const apiKey = env("WAHA_API_KEY");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;
  const response = await fetch(baseUrl + "/api/sendText", {
    method: "POST",
    headers,
    body: JSON.stringify({
      session: sessionDe(owner),
      chatId,
      text
    })
  });
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    id: String(data?.id?._serialized || data?.id || ""),
    error: response.ok ? "" : (data?.message || data?.error || "Falha no envio automático")
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Handshake no formato da Meta — mantido para as URLs já cadastradas
    // continuarem validando.
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge") || "";
      if (mode !== "subscribe" || !token) return new Response("Forbidden", { status: 403 });

      const envToken = Deno.env.get("WPP_VERIFY");
      if (envToken && token === envToken) return new Response(challenge);
      const users = await base44.asServiceRole.entities.User.list();
      const valid = (users || []).some(
        (user: any) => user.whatsapp_webhook_token && user.whatsapp_webhook_token === token
      );
      return valid ? new Response(challenge) : new Response("Forbidden", { status: 403 });
    }

    if (req.method !== "POST") return new Response("ok");

    // Corpo lido cru: o HMAC é calculado sobre os bytes originais.
    const rawBody = await req.text();
    let body: any = null;
    try { body = JSON.parse(rawBody); } catch { return new Response("ok"); }

    const event = String(body?.event || "");
    const sessionName = String(body?.session || "");
    const payload = body?.payload || {};
    if (!event || !sessionName) return new Response("ok");

    const users = await base44.asServiceRole.entities.User.list();
    // A sessão pode vir do nome derivado do id (padrão) ou de um nome próprio
    // que o usuário tenha configurado à mão.
    const owner = (users || []).find((user: any) => sessionDe(user) === sessionName);
    if (!owner) {
      console.log("[CRM_WEBHOOK] Conta não encontrada para a sessão", sessionName);
      return new Response("ok");
    }

    const hmacKey = env("WAHA_HMAC_KEY");
    if (hmacKey) {
      const provided = req.headers.get("x-webhook-hmac") || "";
      if (!(await hmacValid(rawBody, hmacKey, provided))) {
        console.warn("[CRM_WEBHOOK] Assinatura HMAC inválida na sessão", sessionName);
        return new Response("Forbidden", { status: 403 });
      }
    }

    // ── Confirmação de entrega/leitura ───────────────────────────────────────
    if (event === "message.ack") {
      const messageId = String(payload?.id?._serialized || payload?.id || "");
      if (!messageId) return new Response("ok");
      const mapped = ACK_TO_STATUS[String(payload?.ack)];
      if (!mapped) return new Response("ok");
      const rows = await base44.asServiceRole.entities.CRMMensagem.filter({ meta_message_id: messageId });
      for (const row of rows || []) {
        await base44.asServiceRole.entities.CRMMensagem.update(row.id, { status: mapped });
      }
      return new Response("ok");
    }

    if (event === "session.status") {
      console.log("[CRM_WEBHOOK] Sessão", sessionName, "→", payload?.status);
      return new Response("ok");
    }

    if (event !== "message.any" && event !== "message") return new Response("ok");

    // ── Mensagem ─────────────────────────────────────────────────────────────
    const fromMe = Boolean(payload?.fromMe);
    const db = base44.asServiceRole.entities;

    // Item 022: identidade do contato. Grupo, status, canal, self-chat e ignorados não entram;
    // LID nunca vira telefone; nome só do perfil de quem mandou.
    const meusIds = [...meusIdsDoCorpo(body), onlyDigits(owner.whatsapp || "")].filter((x) => x.length >= 10);
    const extrasIgnorados = env("CRM_IGNORAR_NUMEROS").split(",").map(onlyDigits).filter(Boolean);
    const ident: any = identificar(payload, meusIds, extrasIgnorados);
    if (ident.ignorar) {
      if (ident.ignorar === "sem_contato" || ident.ignorar === "jid_desconhecido") {
        // Diagnóstico sem conteúdo: só os nomes dos campos, para entender o formato do evento
        console.log("[CRM_WEBHOOK] evento sem contato reconhecível", ident.ignorar, "fromMe=" + fromMe,
          "campos=" + Object.keys(payload || {}).join(","), "key=" + Object.keys(payload?._data?.key || {}).join(","));
      }
      return new Response("ok");
    }
    if (ident.lid && !ident.telefone) {
      ident.telefone = await resolverLidNoWaha(baseUrlDe(owner), env("WAHA_API_KEY"), sessionName, ident.chatId);
      if (ident.telefone && ignorado(ident.telefone, extrasIgnorados)) return new Response("ok");
      if (ident.telefone && meusIds.includes(ident.telefone)) return new Response("ok");
    }
    const counterpartChatId = ident.chatId;

    const messageId = String(payload?.id?._serialized || payload?.id || "");

    // O WAHA reentrega em caso de falha; sem isso a conversa duplica.
    if (messageId) {
      const existing = await db.CRMMensagem.filter({ meta_message_id: messageId });
      if (existing?.length) return new Response("ok");
    }

    // Chave gravada na mensagem: telefone real, ou o LID quando o contato não foi identificado
    const phone = ident.telefone || ident.lid;
    const messageText = String(payload?.body || "") || (payload?.hasMedia ? "[Mídia]" : "[Mensagem não textual]");
    const now = new Date().toISOString();

    const conversation = await conversaDoContato(db, owner.id, ident, fromMe, messageText, now);
    // Item 022e: cliente respondeu com o lead em "Orçamento" => "Negociação"
    if (!fromMe) {
      const proxima = etapaDepoisDaResposta(conversation.etapa);
      if (proxima) {
        try {
          await db.CRMConversa.update(conversation.id, { etapa: proxima });
          conversation.etapa = proxima;
        } catch (e) {
          console.error("[CRM_WEBHOOK] mudança de etapa falhou", e);
        }
      }
    }

    // Item 022b: telefone real + nome do perfil => cliente em Meus Clientes (sem duplicar)
    try {
      const r = await garantirCliente(db, owner.id, conversation);
      if (r) console.log("[CRM_WEBHOOK]", r, conversation.id);
    } catch (e) {
      console.error("[CRM_WEBHOOK] cadastro do cliente falhou", e);
    }

    // Item 022e: resposta automática ao lead NOVO com a tabela de atacado (uma vez por contato).
    // Desliga com o segredo CRM_BOAS_VINDAS=off. Teto de 20 por hora por conta (proteção do número).
    if (deveMandarBoasVindas(conversation, fromMe, env("CRM_BOAS_VINDAS")) && baseUrlDe(owner)) {
      try {
        const umaHora = new Date(Date.now() - 3600000).toISOString();
        const recentes = await db.CRMMensagem.filter(
          { owner_id: owner.id, origem: "sistema", direcao: "enviada", created_date: { "$gte": umaHora } }, "-created_date", 25
        );
        if ((recentes || []).length >= 20) {
          console.warn("[CRM_WEBHOOK] boas-vindas: teto por hora atingido, não enviada", conversation.id);
        } else {
          const painel = (env("PAINEL_URL") && !/base44/i.test(env("PAINEL_URL")) ? env("PAINEL_URL") : "https://app.placefit.com.br").replace(/\/+$/, "");
          const texto = textoBoasVindas(owner.empresa || "", ident.nome || "", `${painel}/PublicTable?supplier=${owner.id}`);
          const destino = ident.telefone ? `${ident.telefone}@c.us` : counterpartChatId;
          const sent = await sendText(owner, destino, texto);
          await db.CRMMensagem.create({
            owner_id: owner.id,
            conversa_id: conversation.id,
            telefone: phone,
            direcao: "enviada",
            tipo: "texto",
            conteudo: texto,
            status: sent.ok ? "enviada" : "erro",
            meta_message_id: sent.id,
            erro: sent.error,
            origem: "sistema"
          });
          if (sent.ok) {
            await db.CRMConversa.update(conversation.id, { ultima_mensagem: texto.slice(0, 200), ultima_interacao: new Date().toISOString() });
          }
          console.log("[CRM_WEBHOOK] boas-vindas", sent.ok ? "enviada" : "falhou", conversation.id);
        }
      } catch (e) {
        console.error("[CRM_WEBHOOK] boas-vindas falhou", e);
      }
    }

    await db.CRMMensagem.create({
      owner_id: owner.id,
      conversa_id: conversation.id,
      telefone: phone,
      direcao: fromMe ? "enviada" : "recebida",
      tipo: payload?.hasMedia ? "imagem" : "texto",
      conteudo: messageText,
      status: fromMe ? "enviada" : "recebida",
      meta_message_id: messageId,
      origem: "waha"
    });

    // ── Atendente automático ─────────────────────────────────────────────────
    // Três travas, todas obrigatórias:
    //  1. nunca responder ao que o próprio dono escreveu;
    //  2. as DUAS chaves ligadas — whatsapp_atendente_confirmado é uma opção
    //     deliberada, para que uma IA nunca comece a falar com cliente real por
    //     acidente no número comercial;
    //  3. silêncio se um humano respondeu há pouco: quem assumiu, assumiu.
    if (fromMe) return new Response("ok");

    const atendenteLigado =
      Boolean(owner.whatsapp_atendente_ativo) && Boolean(owner.whatsapp_atendente_confirmado);
    if (!atendenteLigado || !baseUrlDe(owner)) return new Response("ok");

    const recentes = await base44.asServiceRole.entities.CRMMensagem.filter(
      { conversa_id: conversation.id, direcao: "enviada" },
      "-created_date",
      1
    );
    const ultimaSaida = recentes?.[0];
    if (ultimaSaida?.created_date) {
      const minutos = (Date.now() - new Date(ultimaSaida.created_date).getTime()) / 60000;
      if (minutos < HUMAN_TAKEOVER_MINUTES) {
        console.log("[CRM_WEBHOOK] Atendimento humano ativo, IA em silêncio na conversa", conversation.id);
        return new Response("ok");
      }
    }

    try {
      const configs = await base44.asServiceRole.entities.IAConfig.filter({ revendedor_id: owner.id });
      const config = configs?.[0];
      const prompt =
        "Você é o atendente comercial da empresa " +
        (owner.empresa || owner.full_name || "PlaceFit") +
        ". Responda em português do Brasil, de forma curta, cordial e útil. Não invente preços ou prazos. " +
        "Se faltar informação, peça os dados necessários. Instruções adicionais: " +
        (config?.regras || owner.instrucoes_agente_ia || "") +
        "\n\nMensagem do cliente: " +
        messageText;
      const ai = await base44.integrations.Core.InvokeLLM({ prompt });
      const reply = String(ai || "").trim();
      if (reply) {
        const sent = await sendText(owner, counterpartChatId, reply);
        await base44.asServiceRole.entities.CRMMensagem.create({
          owner_id: owner.id,
          conversa_id: conversation.id,
          telefone: phone,
          direcao: "enviada",
          tipo: "texto",
          conteudo: reply,
          status: sent.ok ? "enviada" : "erro",
          meta_message_id: sent.id,
          erro: sent.error
        });
        await base44.asServiceRole.entities.CRMConversa.update(conversation.id, {
          ultima_mensagem: reply,
          ultima_interacao: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("[CRM_WEBHOOK] Falha no atendente automático", error);
    }

    return new Response("ok");
  } catch (error) {
    console.error("[CRM_WEBHOOK]", error);
    return new Response("ok");
  }
});
