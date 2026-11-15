import { createClientFromRequest } from "npm:@base44/sdk";

// O telefone é normalizado sem confundir um LID com número telefônico.
// Remove máscara e DDI 55 somente quando o número tem formato E.164 brasileiro.
function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function phoneKey(value: unknown): string {
  const raw = digits(value);
  if ((raw.length === 12 || raw.length === 13) && raw.startsWith("55")) {
    return raw.slice(2);
  }
  return raw;
}

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
    connection_id: c.connection_id || "",
    contato_lid: c.contato_lid || "",
    listas: Array.isArray(c.listas) ? c.listas : []
  };
}

function safeCustomer(c: any) {
  if (!c) return null;
  return {
    id: c.id,
    nome: c.nome || "",
    email: c.email || "",
    telefone: c.telefone || "",
    cpf_cnpj: c.cpf_cnpj || "",
    endereco: c.endereco || "",
    cidade: c.cidade || "",
    estado: c.estado || "",
    cep: c.cep || "",
    observacoes: c.observacoes || "",
    ativo: c.ativo !== false
  };
}

function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonError("METHOD_NOT_ALLOWED", 405);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return jsonError("AUTH_REQUIRED", 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // A conta/tenant vem exclusivamente da sessão e do vínculo de equipe.
    const memberships = await base44.asServiceRole.entities.CRMEquipe.filter({
      user_id: user.id,
      ativo: true
    });
    const ownMembership = (memberships || []).find((m: any) =>
      m.owner_id === user.id && m.papel === "dono"
    );

    let ownerId = ownMembership?.owner_id || "";
    let role = ownMembership?.papel || "";

    if (!ownerId && memberships?.length === 1) {
      ownerId = memberships[0].owner_id;
      role = memberships[0].papel || "atendente";
    } else if (!ownerId && memberships?.length > 1) {
      return jsonError("MULTIPLE_WORKSPACES", 409, {
        workspaces: memberships.map((m: any) => ({
          owner_id: m.owner_id,
          nome: m.nome || "",
          papel: m.papel || "atendente"
        }))
      });
    }

    // Compatibilidade com contas antigas sem linha CRMEquipe.
    if (!ownerId) {
      const ownConversations = await base44.asServiceRole.entities.CRMConversa.filter({
        owner_id: user.id
      }, "-ultima_interacao", 1);
      if (ownConversations?.length) {
        ownerId = user.id;
        role = "dono";
      }
    }
    if (!ownerId) return jsonError("CRM_ACCESS_NOT_CONFIGURED", 403);

    if (action === "me") {
      return Response.json({
        authenticated: true,
        user: { id: user.id, email: user.email, full_name: user.full_name || "" },
        workspace: { owner_id: ownerId, papel: role }
      });
    }

    const isAdmin = user.role === "admin";
    // Espelha o RLS atual de CRMConversa: owner_id, atendente_id ou admin.
    // Papel supervisor, sozinho, não contorna o RLS.
    const canAccessConversation = (conversation: any) => {
      if (!conversation || conversation.owner_id !== ownerId) return false;
      return isAdmin || user.id === ownerId || conversation.atendente_id === user.id;
    };

    const canEditConversation = (conversation: any) => {
      if (!conversation || conversation.owner_id !== ownerId) return false;
      // A edição segue o RLS de CRMConversa: dono, atendente atribuído ou admin.
      return isAdmin || user.id === ownerId || conversation.atendente_id === user.id;
    };

    const getConversation = async (id: string) => {
      if (!id) return null;
      const row = await base44.asServiceRole.entities.CRMConversa.get(id).catch(() => null);
      return canEditConversation(row) ? row : null;
    };

    const loadCustomerIfAllowed = async (customerId: string) => {
      if (!customerId) return null;
      const row = await base44.asServiceRole.entities.Cliente.get(customerId).catch(() => null);
      // Replica as permissões atuais de Cliente. Ser membro da equipe, por si só,
      // NÃO concede acesso ao cadastro do cliente.
      if (!row) return null;
      const allowed = isAdmin || row.fornecedor_id === user.id || row.created_by_id === user.id;
      if (!allowed || row.fornecedor_id !== ownerId) return null;
      return row;
    };

    if (action === "contact.lookup") {
      const rawPhone = String(body.phone || "");
      const wantedPhone = phoneKey(rawPhone);
      const wantedLid = digits(body.lid);

      if (rawPhone && (wantedPhone.length < 10 || wantedPhone.length > 11)) {
        // Números brasileiros já sem DDI devem ter 10 ou 11 dígitos.
        // E.164 com DDI é reduzido a 10/11 dígitos em phoneKey.
        return jsonError("INVALID_PHONE", 400);
      }
      if (!rawPhone && !wantedLid) return jsonError("IDENTIFIER_REQUIRED", 400);
      if (wantedLid && (wantedLid.length < 5 || wantedLid.length > 30)) {
        return jsonError("INVALID_LID", 400);
      }

      // O filtro é limitado ao tenant. O valor recebido é somente uma chave
      // de busca; jamais participa da decisão de autorização.
      const rows = await base44.asServiceRole.entities.CRMConversa.filter(
        { owner_id: ownerId, ativo: true },
        "-ultima_interacao",
        2000
      );

      const visibleRows = (rows || []).filter(canAccessConversation);
      const lidMatches = wantedLid
        ? visibleRows.filter((c: any) => digits(c.contato_lid) === wantedLid)
        : [];
      const phoneMatches = wantedPhone
        ? visibleRows.filter((c: any) => phoneKey(c.telefone) === wantedPhone)
        : [];

      let matches: any[] = [];
      let matchedBy = "";
      if (lidMatches.length) {
        matches = lidMatches;
        matchedBy = "lid";
        // Se telefone e LID apontam para conversas diferentes, não escolher.
        if (phoneMatches.length && !phoneMatches.some((p: any) => lidMatches.some((l: any) => l.id === p.id))) {
          return Response.json({ status: "ambiguous", reason: "IDENTIFIERS_DISAGREE" });
        }
      } else if (wantedPhone) {
        matches = phoneMatches;
        matchedBy = "phone";
      }

      if (!matches.length) return Response.json({ status: "not_found" });
      if (matches.length > 1) {
        return Response.json({ status: "ambiguous", count: matches.length, matched_by: matchedBy });
      }

      const conversation = matches[0];
      const customer = await loadCustomerIfAllowed(conversation.cliente_id);
      return Response.json({
        status: "matched",
        matched_by: matchedBy,
        conversation: safeConversation(conversation),
        customer: safeCustomer(customer)
      });
    }

    if (action === "conversation.update") {
      const conversationId = String(body.conversation_id || "");
      if (!conversationId) return jsonError("CONVERSATION_REQUIRED", 400);
      const conversation = await getConversation(conversationId);
      if (!conversation) return jsonError("NOT_FOUND_OR_FORBIDDEN", 404);

      const input = body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)
        ? body.fields : {};
      const allowedFields = ["etapa", "observacoes", "pendencia", "nome_contato"];
      const patch: Record<string, string> = {};

      for (const key of allowedFields) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
        const value = String(input[key] ?? "").trim();
        const max = key === "observacoes" ? 5000 : 1000;
        if (value.length > max) return jsonError("FIELD_TOO_LONG", 400, { field: key, max });
        patch[key] = value;
      }

      if (!Object.keys(patch).length) return jsonError("NO_ALLOWED_FIELDS", 400);
      if (Object.prototype.hasOwnProperty.call(patch, "etapa")) {
        if (!/^[a-z0-9_-]{1,60}$/i.test(patch.etapa)) return jsonError("INVALID_STAGE", 400);
        const stages = await base44.asServiceRole.entities.CRMEtapa.filter({ owner_id: ownerId, ativo: true });
        const validKeys = (stages || []).map((s: any) => s.chave);
        const standardKeys = ["novo", "atendimento", "orcamento", "aguardando_resposta", "negociacao", "ganho", "perdido"];
        if (validKeys.length && !validKeys.includes(patch.etapa) && !standardKeys.includes(patch.etapa)) {
          return jsonError("STAGE_NOT_FOUND", 400);
        }
      }

      await base44.asServiceRole.entities.CRMConversa.update(conversationId, patch);
      const updated = await base44.asServiceRole.entities.CRMConversa.get(conversationId);
      return Response.json({ ok: true, conversation: safeConversation(updated) });
    }

    if (action === "customer.update") {
      const customerId = String(body.customer_id || "");
      if (!customerId) return jsonError("CUSTOMER_REQUIRED", 400);
      const customer = await base44.asServiceRole.entities.Cliente.get(customerId).catch(() => null);
      if (!customer || customer.fornecedor_id !== ownerId) return jsonError("NOT_FOUND", 404);

      // Replica exatamente o RLS de Cliente: fornecedor dono, criador original
      // ou admin. Papel de supervisor/atendente não amplia esse direito.
      const canEditCustomer = isAdmin || customer.fornecedor_id === user.id || customer.created_by_id === user.id;
      if (!canEditCustomer) return jsonError("FORBIDDEN", 403);

      const input = body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)
        ? body.fields : {};
      const allowedFields = [
        "nome", "email", "telefone", "cpf_cnpj", "endereco",
        "cidade", "estado", "cep", "observacoes", "ativo"
      ];
      const patch: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
        const value = key === "ativo" ? Boolean(input[key]) : String(input[key] ?? "").trim();
        const max = key === "observacoes" || key === "endereco" ? 5000 : 500;
        if (typeof value === "string" && value.length > max) {
          return jsonError("FIELD_TOO_LONG", 400, { field: key, max });
        }
        patch[key] = value;
      }
      if (!Object.keys(patch).length) return jsonError("NO_ALLOWED_FIELDS", 400);
      if (typeof patch.nome === "string" && !patch.nome) return jsonError("NAME_REQUIRED", 400);

      await base44.asServiceRole.entities.Cliente.update(customerId, patch);
      const updated = await base44.asServiceRole.entities.Cliente.get(customerId);
      return Response.json({ ok: true, customer: safeCustomer(updated) });
    }

    if (action === "lists.list") {
      const rows = await base44.asServiceRole.entities.CRMLista.filter(
        { owner_id: ownerId, ativo: true },
        "ordem",
        300
      );
      const visible = (rows || []).filter((list: any) => {
        if (isAdmin || user.id === ownerId) return true;
        return Array.isArray(list.equipe_ids) && list.equipe_ids.includes(user.id);
      });
      return Response.json({
        lists: visible.map((l: any) => ({
          id: l.id, nome: l.nome || "", descricao: l.descricao || "",
          tipo: l.tipo || "segmento", cor: l.cor || "", ordem: l.ordem || 0
        }))
      });
    }

    if (action === "stages.list") {
      // O RLS de CRMEtapa permite dono/admin; não ampliar para atendente/supervisor.
      if (!isAdmin && user.id !== ownerId) return jsonError("FORBIDDEN", 403);
      const rows = await base44.asServiceRole.entities.CRMEtapa.filter(
        { owner_id: ownerId, ativo: true },
        "ordem",
        100
      );
      return Response.json({
        stages: (rows || []).map((s: any) => ({
          id: s.id, chave: s.chave, nome: s.nome, cor: s.cor || "", ordem: s.ordem || 0
        }))
      });
    }

    return jsonError("UNKNOWN_ACTION", 400);
  } catch (error) {
    console.error("[CRM_COMPANION]", error);
    return jsonError("INTERNAL_ERROR", 500);
  }
});