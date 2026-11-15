import { createClientFromRequest } from "npm:@base44/sdk";

const digits = (value: unknown) => String(value ?? "").replace(/\\D/g, "");
const phoneKey = (value: unknown) => {
  const d = digits(value);
  return d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
};

function safeConversation(c: any) {
  return {
    id: c.id,
    nome_contato: c.nome_contato || "",
    telefone: c.telefone || "",
    etapa: c.etapa || "novo",
    observacoes: c.observacoes || "",
    pendencia: c.pendencia || "",
    ultima_interacao: c.ultima_interacao || "",
    cliente_id: c.cliente_id || "",
    atendente_id: c.atendente_id || "",
    listas: Array.isArray(c.listas) ? c.listas : []
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // Deriva o tenant exclusivamente da sessão e do vínculo CRMEquipe.
    const memberships = await base44.asServiceRole.entities.CRMEquipe.filter({ user_id: user.id, ativo: true });
    const ownMembership = (memberships || []).find((m: any) => m.owner_id === user.id && m.papel === "dono");
    let ownerId = ownMembership?.owner_id || "";
    let role = ownMembership?.papel || "";

    if (!ownerId && memberships?.length === 1) {
      ownerId = memberships[0].owner_id;
      role = memberships[0].papel || "atendente";
    } else if (!ownerId && memberships?.length > 1) {
      return Response.json({ error: "MULTIPLE_WORKSPACES", workspaces: memberships.map((m: any) => ({ owner_id: m.owner_id, nome: m.nome || "", papel: m.papel || "atendente" })) }, { status: 409 });
    }

    if (!ownerId) {
      // Compatibilidade com contas antigas em que o próprio usuário é o dono,
      // sem registro explícito em CRMEquipe.
      const ownConversations = await base44.asServiceRole.entities.CRMConversa.filter({ owner_id: user.id });
      if (ownConversations?.length) { ownerId = user.id; role = "dono"; }
    }
    if (!ownerId) return Response.json({ error: "CRM_ACCESS_NOT_CONFIGURED" }, { status: 403 });

    if (action === "me") {
      return Response.json({
        authenticated: true,
        user: { id: user.id, email: user.email, full_name: user.full_name || "" },
        workspace: { owner_id: ownerId, papel: role }
      });
    }

    const canSeeAll = role === "dono" || role === "supervisor" || user.role === "admin";

    if (action === "contact.lookup") {
      const rawPhone = String(body.phone || "");
      const wanted = phoneKey(rawPhone);
      if (wanted.length < 10 || wanted.length > 13) return Response.json({ error: "INVALID_PHONE" }, { status: 400 });

      // Pesquisa limitada ao tenant autenticado. Telefone recebido é somente
      // um identificador de busca, nunca um dado de autorização.
      const conversations = await base44.asServiceRole.entities.CRMConversa.filter({ owner_id: ownerId });
      const matches = (conversations || []).filter((c: any) =>
        phoneKey(c.telefone) === wanted &&
        (canSeeAll || c.atendente_id === user.id)
      );
      if (!matches.length) return Response.json({ status: "not_found" });
      if (matches.length > 1) return Response.json({ status: "ambiguous", count: matches.length });
      const conversation = matches[0];
      let customer = null;
      if (conversation.cliente_id) {
        const c = await base44.asServiceRole.entities.Cliente.get(conversation.cliente_id).catch(() => null);
        if (c && c.fornecedor_id === ownerId) {
          customer = {
            id: c.id, nome: c.nome || "", email: c.email || "",
            telefone: c.telefone || "", cidade: c.cidade || "", estado: c.estado || ""
          };
        }
      }
      return Response.json({ status: "matched", conversation: safeConversation(conversation), customer });
    }

    if (action === "conversation.update") {
      const conversationId = String(body.conversation_id || "");
      if (!conversationId) return Response.json({ error: "CONVERSATION_REQUIRED" }, { status: 400 });
      const conversation = await base44.asServiceRole.entities.CRMConversa.get(conversationId).catch(() => null);
      if (!conversation || conversation.owner_id !== ownerId) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
      if (!canSeeAll && conversation.atendente_id !== user.id) return Response.json({ error: "FORBIDDEN" }, { status: 403 });

      const input = body.fields && typeof body.fields === "object" ? body.fields : {};
      const allowed = ["etapa", "observacoes", "pendencia"];
      const patch: Record<string, string> = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
          const value = String(input[key] ?? "");
          if (value.length > (key === "observacoes" ? 5000 : 1000)) {
            return Response.json({ error: "FIELD_TOO_LONG", field: key }, { status: 400 });
          }
          patch[key] = value;
        }
      }
      if (!Object.keys(patch).length) return Response.json({ error: "NO_ALLOWED_FIELDS" }, { status: 400 });
      if (patch.etapa && !/^[a-z0-9_-]{1,60}$/i.test(patch.etapa)) return Response.json({ error: "INVALID_STAGE" }, { status: 400 });

      await base44.asServiceRole.entities.CRMConversa.update(conversationId, patch);
      const updated = await base44.asServiceRole.entities.CRMConversa.get(conversationId);
      return Response.json({ ok: true, conversation: safeConversation(updated) });
    }

    return Response.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (error) {
    console.error("[CRM_COMPANION]", error);
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
});