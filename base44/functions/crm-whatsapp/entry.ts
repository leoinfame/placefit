import { createClientFromRequest } from "npm:@base44/sdk";

const GRAPH_VERSION = "v23.0";
const normalizePhone = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return digits.length >= 10 ? "55" + digits : digits;
};

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

    const phoneNumberId = owner.whatsapp_phone_number_id || "";
    const wabaId = owner.whatsapp_waba_id || "";
    const accessToken = owner.whatsapp_access_token || "";
    const configured = Boolean(phoneNumberId && accessToken);

    if (action === "status") {
      return Response.json({
        configured,
        active: Boolean(owner.whatsapp_atendente_ativo),
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        owner: { id: owner.id, name: owner.empresa || owner.full_name || owner.email }
      });
    }

    if (!configured) return Response.json({ error: "Configure o Phone Number ID e o token do WhatsApp antes de continuar." }, { status: 400 });

    if (action === "test") {
      const response = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + phoneNumberId, {
        headers: { Authorization: "Bearer " + accessToken }
      });
      const data = await response.json();
      if (!response.ok) return Response.json({ error: data?.error?.message || "Falha na conexão com a Meta" }, { status: 400 });
      return Response.json({ ok: true, display_phone_number: data.display_phone_number || data.verified_name || data.id });
    }

    if (action === "sync_templates") {
      if (!wabaId) return Response.json({ error: "Informe o WABA ID para sincronizar templates." }, { status: 400 });
      const response = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + wabaId + "/message_templates?limit=100", {
        headers: { Authorization: "Bearer " + accessToken }
      });
      const data = await response.json();
      if (!response.ok) return Response.json({ error: data?.error?.message || "Falha ao buscar templates" }, { status: 400 });

      const existing = await base44.asServiceRole.entities.CRMTemplate.filter({ owner_id: ownerId });
      const byMetaId = new Map((existing || []).filter((x: any) => x.meta_id).map((x: any) => [x.meta_id, x]));
      const synced = [];
      for (const item of data.data || []) {
        const bodyComponent = (item.components || []).find((component: any) => component.type === "BODY");
        const record = {
          owner_id: ownerId,
          nome: item.name,
          titulo: item.name.replace(/_/g, " "),
          categoria: item.category || "UTILITY",
          idioma: item.language || "pt_BR",
          conteudo: bodyComponent?.text || item.name,
          status: item.status || "PENDING",
          meta_id: item.id,
          origem: "meta",
          ativo: item.status !== "REJECTED"
        };
        const current = byMetaId.get(item.id);
        synced.push(current
          ? await base44.asServiceRole.entities.CRMTemplate.update(current.id, record)
          : await base44.asServiceRole.entities.CRMTemplate.create(record));
      }
      return Response.json({ ok: true, count: synced.length, templates: synced });
    }

    if (action === "send_text" || action === "send_template") {
      const to = normalizePhone(body.to);
      if (!to) return Response.json({ error: "Telefone inválido" }, { status: 400 });
      let payload: any;
      let messageType = "texto";
      let content = String(body.text || "");

      if (action === "send_template") {
        const template = await base44.asServiceRole.entities.CRMTemplate.get(String(body.template_id || ""));
        if (!template || template.owner_id !== ownerId) return Response.json({ error: "Template não encontrado" }, { status: 404 });
        if (template.origem !== "meta" || template.status !== "APPROVED") {
          return Response.json({ error: "Somente templates aprovados pela Meta podem iniciar conversas fora da janela de 24 horas." }, { status: 400 });
        }
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: { name: template.nome, language: { code: template.idioma || "pt_BR" } }
        };
        messageType = "template";
        content = template.conteudo;
      } else {
        if (!content.trim()) return Response.json({ error: "Digite a mensagem" }, { status: 400 });
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: content.trim() }
        };
      }

      const response = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + phoneNumberId + "/messages", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      const messageId = data?.messages?.[0]?.id || "";
      const status = response.ok ? "enviada" : "erro";

      if (body.conversa_id) {
        await base44.asServiceRole.entities.CRMMensagem.create({
          owner_id: ownerId,
          conversa_id: String(body.conversa_id),
          telefone: to,
          direcao: "enviada",
          tipo: messageType,
          conteudo: content,
          status,
          meta_message_id: messageId,
          template_nome: action === "send_template" ? String(body.template_name || "") : "",
          erro: response.ok ? "" : (data?.error?.message || "Falha no envio")
        });
        await base44.asServiceRole.entities.CRMConversa.update(String(body.conversa_id), {
          ultima_mensagem: content,
          ultima_interacao: new Date().toISOString()
        });
      }

      if (!response.ok) return Response.json({ error: data?.error?.message || "Falha ao enviar mensagem", details: data }, { status: 400 });
      return Response.json({ ok: true, message_id: messageId });
    }

    return Response.json({ error: "Ação desconhecida" }, { status: 400 });
  } catch (error) {
    console.error("[CRM_WHATSAPP]", error);
    return Response.json({ error: error?.message || "Erro interno" }, { status: 500 });
  }
});
