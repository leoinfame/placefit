import { createClientFromRequest } from "npm:@base44/sdk";

const GRAPH_VERSION = "v23.0";
const normalize = (value: string) => String(value || "").replace(/\D/g, "");

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge") || "";
      if (mode !== "subscribe" || !token) return new Response("Forbidden", { status: 403 });

      const envToken = Deno.env.get("WPP_VERIFY");
      if (envToken && token === envToken) return new Response(challenge);
      const users = await base44.asServiceRole.entities.User.list();
      const valid = (users || []).some((user: any) => user.whatsapp_webhook_token && user.whatsapp_webhook_token === token);
      return valid ? new Response(challenge) : new Response("Forbidden", { status: 403 });
    }

    if (req.method !== "POST") return new Response("ok");
    const body = await req.json();
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = String(value?.metadata?.phone_number_id || "");
    if (!phoneNumberId) return new Response("ok");

    const users = await base44.asServiceRole.entities.User.list();
    const owner = (users || []).find((user: any) => String(user.whatsapp_phone_number_id || "") === phoneNumberId);
    if (!owner) {
      console.log("[CRM_WEBHOOK] Conta não encontrada para phone_number_id", phoneNumberId);
      return new Response("ok");
    }

    for (const statusEvent of value?.statuses || []) {
      const rows = await base44.asServiceRole.entities.CRMMensagem.filter({ meta_message_id: statusEvent.id });
      for (const row of rows || []) {
        const mapped = statusEvent.status === "failed" ? "erro" : statusEvent.status === "sent" ? "enviada" : statusEvent.status === "delivered" ? "entregue" : statusEvent.status === "read" ? "lida" : row.status;
        await base44.asServiceRole.entities.CRMMensagem.update(row.id, { status: mapped });
      }
    }

    for (const message of value?.messages || []) {
      const phone = normalize(message.from);
      const contactName = value?.contacts?.[0]?.profile?.name || phone;
      const messageText = message?.text?.body || message?.button?.text || message?.interactive?.button_reply?.title || "[Mensagem não textual]";

      let conversations = await base44.asServiceRole.entities.CRMConversa.filter({ owner_id: owner.id, telefone: phone });
      let conversation = conversations?.[0];
      if (!conversation) {
        const customers = await base44.asServiceRole.entities.Cliente.filter({ fornecedor_id: owner.id, telefone: { "$regex": phone.slice(-8) } });
        const customer = customers?.[0];
        conversation = await base44.asServiceRole.entities.CRMConversa.create({
          owner_id: owner.id,
          cliente_id: customer?.id || "",
          nome_contato: customer?.nome || contactName,
          telefone: phone,
          etapa: "novo",
          ultima_mensagem: messageText,
          ultima_interacao: new Date().toISOString(),
          nao_lidas: 1,
          origem: "whatsapp",
          ativo: true
        });
      } else {
        await base44.asServiceRole.entities.CRMConversa.update(conversation.id, {
          nome_contato: conversation.nome_contato || contactName,
          ultima_mensagem: messageText,
          ultima_interacao: new Date().toISOString(),
          nao_lidas: Number(conversation.nao_lidas || 0) + 1
        });
      }

      await base44.asServiceRole.entities.CRMMensagem.create({
        owner_id: owner.id,
        conversa_id: conversation.id,
        telefone: phone,
        direcao: "recebida",
        tipo: message.type === "text" ? "texto" : "sistema",
        conteudo: messageText,
        status: "recebida",
        meta_message_id: message.id
      });

      if (owner.whatsapp_atendente_ativo && owner.whatsapp_access_token) {
        try {
          const configs = await base44.asServiceRole.entities.IAConfig.filter({ revendedor_id: owner.id });
          const config = configs?.[0];
          const prompt = "Você é o atendente comercial da empresa " + (owner.empresa || owner.full_name || "PlaceFit") + ". Responda em português do Brasil, de forma curta, cordial e útil. Não invente preços ou prazos. Se faltar informação, peça os dados necessários. Instruções adicionais: " + (config?.regras || owner.instrucoes_agente_ia || "") + "\n\nMensagem do cliente: " + messageText;
          const ai = await base44.integrations.Core.InvokeLLM({ prompt });
          const reply = String(ai || "").trim();
          if (reply) {
            const response = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + phoneNumberId + "/messages", {
              method: "POST",
              headers: { Authorization: "Bearer " + owner.whatsapp_access_token, "Content-Type": "application/json" },
              body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { preview_url: false, body: reply } })
            });
            const data = await response.json();
            await base44.asServiceRole.entities.CRMMensagem.create({
              owner_id: owner.id,
              conversa_id: conversation.id,
              telefone: phone,
              direcao: "enviada",
              tipo: "texto",
              conteudo: reply,
              status: response.ok ? "enviada" : "erro",
              meta_message_id: data?.messages?.[0]?.id || "",
              erro: response.ok ? "" : (data?.error?.message || "Falha no envio automático")
            });
            await base44.asServiceRole.entities.CRMConversa.update(conversation.id, {
              ultima_mensagem: reply,
              ultima_interacao: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error("[CRM_WEBHOOK] Falha no atendente automático", error);
        }
      }
    }

    return new Response("ok");
  } catch (error) {
    console.error("[CRM_WEBHOOK]", error);
    return new Response("ok");
  }
});
