import { createClientFromRequest } from "npm:@base44/sdk";
import { PROMPT_PARSER, SCHEMA_PEDIDO, montarRascunho, gravar } from "../../shared/orcamentoGerente.ts";
import { invocarIA } from "../../shared/iaComRetry.ts";

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return jsonError("METHOD_NOT_ALLOWED", 405);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
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

    const isAdmin = user.role === "admin";

    // Contas proprietárias legadas: o ID do usuário autenticado é o próprio
    // owner_id do tenant. Não exigir CRMEquipe nem depender de haver conversa
    // recente para reconhecer o dono. O isolamento continua garantido porque
    // todas as consultas seguintes usam exclusivamente ownerId.
    if (!ownerId) {
      ownerId = user.id;
      role = "dono";
    }

    if (action === "me") {
      return Response.json({
        authenticated: true,
        user: { id: user.id, email: user.email, full_name: user.full_name || "" },
        workspace: { owner_id: ownerId, papel: role }
      });
    }

    // O papel "dono" no vínculo CRMEquipe representa o proprietário funcional
    // do workspace, mesmo quando o login usa um User separado do owner_id.
    const isOwner = user.id === ownerId || role === "dono";
    // Espelha o RLS atual de CRMConversa: owner_id, atendente_id ou admin.
    // Papel supervisor, sozinho, não contorna o RLS.
    const canAccessConversation = (conversation: any) => {
      if (!conversation || conversation.owner_id !== ownerId) return false;
      return isAdmin || isOwner || conversation.atendente_id === user.id;
    };

    const canEditConversation = (conversation: any) => {
      if (!conversation || conversation.owner_id !== ownerId) return false;
      // A edição segue o RLS de CRMConversa: dono, atendente atribuído ou admin.
      return isAdmin || isOwner || conversation.atendente_id === user.id;
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
      const allowed = isAdmin || isOwner || row.created_by_id === user.id;
      if (!allowed || row.fornecedor_id !== ownerId) return null;
      return row;
    };

    if (action === "order.preview" || action === "order.confirm") {
      if (!isAdmin && !isOwner) return jsonError("FORBIDDEN", 403);
      const rawText = String(body.text || "").trim();
      if (!rawText || rawText.length > 12000) return jsonError("INVALID_ORDER_TEXT", 400);
      const requestedPhone = phoneKey(body.phone || "");
      if (body.phone && (requestedPhone.length < 10 || requestedPhone.length > 11)) {
        return jsonError("INVALID_PHONE", 400);
      }

      let conversation: any = null;
      const conversationId = String(body.conversation_id || "");
      if (conversationId) {
        conversation = await getConversation(conversationId);
        if (!conversation) return jsonError("NOT_FOUND_OR_FORBIDDEN", 404);
      }
      let phone = conversation ? phoneKey(conversation.telefone) : requestedPhone;
      if (conversation && requestedPhone && phone !== requestedPhone) {
        return jsonError("PHONE_MISMATCH", 409);
      }
      if (!phone || phone.length < 10 || phone.length > 11) return jsonError("PHONE_REQUIRED", 400);

      if (!conversation) {
        const rows = await base44.asServiceRole.entities.CRMConversa.filter(
          { owner_id: ownerId, ativo: true }, "-ultima_interacao", 2000
        );
        const matches = (rows || []).filter((row: any) => canAccessConversation(row) && phoneKey(row.telefone) === phone);
        if (matches.length > 1) return jsonError("AMBIGUOUS_CONVERSATION", 409);
        conversation = matches[0] || null;
      }

      let customer: any = null;
      const linkedCustomerId = String(conversation?.cliente_id || "");
      if (linkedCustomerId) customer = await loadCustomerIfAllowed(linkedCustomerId);
      if (!customer) {
        const customerRows: any[] = [];
        for (let skip = 0; skip < 5000; skip += 500) {
          const page = await base44.asServiceRole.entities.Cliente.filter(
            { fornecedor_id: ownerId }, "-created_date", 500, skip
          );
          customerRows.push(...(page || []));
          if (!page || page.length < 500) break;
        }
        const matches = customerRows.filter((row: any) => phoneKey(row.telefone) === phone);
        if (matches.length > 1) return jsonError("AMBIGUOUS_CUSTOMER", 409);
        if (matches.length === 1) customer = await loadCustomerIfAllowed(matches[0].id);
      }

      let pedido: any;
      if (action === "order.preview") {
        const known = customer ? {
          nome: customer.nome || "", cpf_cnpj: customer.cpf_cnpj || "", email: customer.email || "",
          endereco: customer.endereco || "", cidade: customer.cidade || "", estado: customer.estado || "",
          cep: customer.cep || ""
        } : {};
        const prompt = PROMPT_PARSER +
          "\n\nCONTEXTO DO CADASTRO EXISTENTE (não invente nem substitua o que o vendedor escreveu): " +
          JSON.stringify(known) +
          "\n\nCLIENTE INFORMADO PELO VENDEDOR: " + String(body.name || conversation?.nome_contato || customer?.nome || "") +
          "\nTELEFONE WHATSAPP: " + phone +
          "\n\nPEDIDO INFORMADO PELO VENDEDOR:\n" + rawText;
        const ai: any = await invocarIA(base44, { prompt, response_json_schema: SCHEMA_PEDIDO });
        pedido = typeof ai === "string" ? JSON.parse(ai) : ai;
        if (!pedido || pedido.acao !== "orcamento") {
          return jsonError("NOT_AN_ORDER", 422, { message: "Não consegui identificar um pedido de orçamento. Descreva os produtos e quantidades." });
        }
      } else {
        pedido = body.pedido;
        if (!pedido || typeof pedido !== "object" || !Array.isArray(pedido.itens)) {
          return jsonError("INVALID_ORDER_DRAFT", 400);
        }
      }

      const parsedClient = pedido.cliente && typeof pedido.cliente === "object" ? pedido.cliente : {};
      pedido.cliente = {
        ...parsedClient,
        nome: String(body.name || parsedClient.nome || customer?.nome || conversation?.nome_contato || "").trim(),
        telefone: phone,
        cliente_id_contato: customer?.id || linkedCustomerId || "",
        cpf_cnpj: parsedClient.cpf_cnpj || customer?.cpf_cnpj || "",
        email: parsedClient.email || customer?.email || "",
        endereco: parsedClient.endereco || customer?.endereco || "",
        cidade: parsedClient.cidade || customer?.cidade || "",
        estado: parsedClient.estado || customer?.estado || "",
        cep: parsedClient.cep || customer?.cep || ""
      };

      const preview = await montarRascunho(
        base44, ownerId, pedido, null, rawText, { somenteLeitura: true }
      );
      const publicDraft = {
        pedido: preview.pedido,
        cliente: preview.cliente,
        itens: preview.itens,
        subtotal: preview.subtotal,
        peso_total: preview.peso_total,
        frete: preview.frete,
        frete_origem: preview.frete_origem,
        frete_obs: preview.frete_obs,
        total: preview.total,
        composicoes: preview.composicoes,
        suposicoes: preview.suposicoes,
        ressalvas: preview.ressalvas,
        perguntas: preview.perguntas,
        nao_cotados: preview.nao_cotados,
        pronto: preview.pronto
      };

      if (action === "order.preview") {
        return Response.json({
          ok: true, preview: publicDraft,
          conversation_id: conversation?.id || "",
          phone, name: pedido.cliente.nome || ""
        });
      }

      if (!preview.pronto) {
        return Response.json({
          ok: false, error: "ORDER_INCOMPLETE",
          message: "O orçamento ainda tem informações pendentes. Revise os pontos abaixo e gere uma nova prévia.",
          preview: publicDraft
        }, { status: 422 });
      }

      // Só agora, após a confirmação explícita, permite completar/criar o cadastro.
      const finalDraft = await montarRascunho(base44, ownerId, pedido, null, rawText);
      if (!finalDraft.pronto) {
        return Response.json({
          ok: false, error: "ORDER_CHANGED",
          message: "O cadastro ou catálogo mudou durante a confirmação. Gere uma nova prévia.",
          preview: {
            itens: finalDraft.itens, subtotal: finalDraft.subtotal, frete: finalDraft.frete,
            total: finalDraft.total, perguntas: finalDraft.perguntas, pronto: finalDraft.pronto
          }
        }, { status: 409 });
      }
      const saved = await gravar(base44, ownerId, finalDraft);
      const savedCustomerId = String(saved.pedido?.cliente_id || finalDraft.cliente?.id || "");
      if (conversation) {
        if (savedCustomerId && conversation.cliente_id !== savedCustomerId) {
          await base44.asServiceRole.entities.CRMConversa.update(conversation.id, { cliente_id: savedCustomerId });
        }
      } else {
        conversation = await base44.asServiceRole.entities.CRMConversa.create({
          owner_id: ownerId,
          nome_contato: finalDraft.cliente?.nome || String(body.name || ""),
          telefone: phone,
          cliente_id: savedCustomerId,
          etapa: "orcamento",
          origem: "whatsapp",
          ativo: true,
          ultima_interacao: new Date().toISOString(),
          listas: []
        });
      }
      return Response.json({
        ok: true,
        saved: true,
        conversation_id: conversation?.id || "",
        customer_id: savedCustomerId,
        order: {
          id: saved.pedido?.id || "",
          numero_pedido: saved.pedido?.numero_pedido || "",
          total: finalDraft.total,
          subtotal: finalDraft.subtotal,
          frete: finalDraft.frete,
          itens: finalDraft.itens.map((item: any) => ({
            nome: item.nome, cod: item.cod, quantidade: item.quantidade,
            preco_unitario: item.preco_unitario, subtotal: item.subtotal
          }))
        },
        divergencias: saved.divergencias || []
      });
    }

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

      // O filtro é limitado ao tenant resolvido e autorizado.
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
      let customer = await loadCustomerIfAllowed(conversation.cliente_id);
      // Se o vínculo antigo estiver vazio, recupera o cadastro pelo telefone exato do WhatsApp.
      const tenantCustomers: any[] = [];
      for (let skip = 0; skip < 5000; skip += 500) {
        const page = await base44.asServiceRole.entities.Cliente.filter({ fornecedor_id: ownerId }, "-created_date", 500, skip);
        tenantCustomers.push(...(page || []));
        if (!page || page.length < 500) break;
      }
      const samePhoneCustomers = wantedPhone
        ? tenantCustomers.filter((c: any) => phoneKey(c.telefone) === wantedPhone)
        : [];
      if (!customer && samePhoneCustomers.length === 1) {
        customer = await loadCustomerIfAllowed(samePhoneCustomers[0].id);
        // Torna permanente a associação recuperada pelo telefone. Sem isso o painel
        // exibe o Cliente apenas nesta consulta, mas a conversa continua sem cliente_id.
        if (customer && conversation.cliente_id !== customer.id) {
          await base44.asServiceRole.entities.CRMConversa.update(conversation.id, {
            cliente_id: customer.id
          });
          conversation.cliente_id = customer.id;
        }
      }
      // Histórico fiscal pode estar em cadastros diferentes. Só agrega registros do mesmo tenant
      // que carregam exatamente o telefone desta conversa; o orçamento permanece intacto.
      const customerIds = Array.from(new Set([
        ...(customer?.id ? [customer.id] : []),
        ...samePhoneCustomers.filter((c: any) => isAdmin || isOwner || c.created_by_id === user.id).map((c: any) => c.id)
      ]));
      let budgets: any[] = [];
      if (customerIds.length) {
        const orderPages = await Promise.all(customerIds.map((customerId: string) =>
          base44.asServiceRole.entities.Pedido.filter(
            { fornecedor_id: ownerId, cliente_id: customerId, tipo: "orcamento" },
            "-data_pedido",
            100
          )
        ));
        const uniqueOrders = new Map<string, any>();
        for (const page of orderPages) for (const order of (page || [])) uniqueOrders.set(order.id, order);
        const orders = Array.from(uniqueOrders.values()).sort((a: any, b: any) => String(b.data_pedido || '').localeCompare(String(a.data_pedido || '')));
        budgets = orders.map((p: any) => ({
          id: p.id,
          numero_pedido: p.numero_pedido || "",
          data_pedido: p.data_pedido || "",
          status: p.status || "",
          itens: Array.isArray(p.itens) ? p.itens.map((i: any) => ({
            nome: i.nome || "",
            cod: i.cod || "",
            quantidade: Number(i.quantidade || 0),
            preco_unitario: Number(i.preco_unitario || 0),
            subtotal: Number(i.subtotal || 0)
          })) : [],
          subtotal: Number(p.subtotal || 0),
          frete: Number(p.frete || 0),
          desconto: Number(p.desconto || 0),
          total: Number(p.total || 0),
          observacoes: p.observacoes || ""
        }));
      }
      // Próximos passos são registros internos do CRM. O schema limita leitura
      // ao dono/admin; não ampliar esse acesso para atendentes.
      let nextSteps: any[] = [];
      if (isAdmin || isOwner) {
        const rows = await base44.asServiceRole.entities.CRMProximoPasso.filter(
          { owner_id: ownerId, conversa_id: conversation.id },
          "-created_date",
          30
        );
        nextSteps = (rows || []).map((row: any) => ({
          id: row.id,
          descricao: row.descricao || "",
          em: row.em || row.created_date || "",
          por: row.por || ""
        }));
      }
      const [listResult, stageResult] = await Promise.all([
        (async () => {
          const rows = await base44.asServiceRole.entities.CRMLista.filter(
            { owner_id: ownerId, ativo: true }, "ordem", 300
          );
          return (rows || []).filter((list: any) =>
            isAdmin || isOwner ||
            (Array.isArray(list.equipe_ids) && list.equipe_ids.includes(user.id))
          ).map((list: any) => ({
            id: list.id, nome: list.nome || "", tipo: list.tipo || "segmento",
            cor: list.cor || "", ordem: list.ordem || 0
          }));
        })(),
        (async () => {
          if (!isAdmin && !isOwner) return [];
          const rows = await base44.asServiceRole.entities.CRMEtapa.filter(
            { owner_id: ownerId, ativo: true }, "ordem", 100
          );
          return (rows || []).map((stage: any) => ({
            chave: stage.chave, nome: stage.nome, cor: stage.cor || ""
          }));
        })()
      ]);
      return Response.json({
        status: "matched",
        matched_by: matchedBy,
        conversation: safeConversation(conversation),
        customer: safeCustomer(customer),
        budgets,
        lists: listResult,
        stages: stageResult,
        next_steps: nextSteps,
        can_manage_next_steps: isAdmin || isOwner
      });
    }

    if (action === "contact.create") {
      if (!isAdmin && !isOwner) return jsonError("FORBIDDEN", 403);
      const rawPhone = String(body.phone || "").trim();
      const wantedPhone = phoneKey(rawPhone);
      const name = String(body.name || "").trim();
      if (wantedPhone.length < 10 || wantedPhone.length > 11) {
        return jsonError("INVALID_PHONE", 400);
      }
      if (!name) return jsonError("NAME_REQUIRED", 400);
      if (name.length > 200) return jsonError("FIELD_TOO_LONG", 400, { field: "name", max: 200 });

      // Revalida pelo tenant no servidor: não confia no estado do painel.
      const existingConversations = await base44.asServiceRole.entities.CRMConversa.filter(
        { owner_id: ownerId, ativo: true },
        "-ultima_interacao",
        2000
      );
      const samePhoneConversations = (existingConversations || []).filter(
        (row: any) => phoneKey(row.telefone) === wantedPhone
      );
      if (samePhoneConversations.length) {
        return jsonError("CONVERSATION_ALREADY_EXISTS", 409, {
          conversation_id: samePhoneConversations.length === 1 ? samePhoneConversations[0].id : ""
        });
      }

      const customerRows: any[] = [];
      for (let skip = 0; skip < 5000; skip += 500) {
        const page = await base44.asServiceRole.entities.Cliente.filter(
          { fornecedor_id: ownerId },
          "-created_date",
          500,
          skip
        );
        customerRows.push(...(page || []));
        if (!page || page.length < 500) break;
      }
      const samePhoneCustomers = customerRows.filter(
        (row: any) => phoneKey(row.telefone) === wantedPhone
      );
      if (samePhoneCustomers.length > 1) {
        return jsonError("CUSTOMER_DUPLICATE", 409);
      }

      let customer = samePhoneCustomers[0] || null;
      if (!customer) {
        customer = await base44.asServiceRole.entities.Cliente.create({
          fornecedor_id: ownerId,
          nome: name,
          telefone: rawPhone,
          ativo: true,
          observacoes: "Cadastro iniciado pelo PlaceFit Companion a partir do telefone identificado no WhatsApp."
        });
      }

      const conversation = await base44.asServiceRole.entities.CRMConversa.create({
        owner_id: ownerId,
        nome_contato: name,
        telefone: rawPhone,
        cliente_id: customer.id,
        etapa: "novo",
        origem: "whatsapp",
        ativo: true,
        ultima_interacao: new Date().toISOString(),
        listas: []
      });

      return Response.json({
        ok: true,
        created: true,
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

      if (Object.prototype.hasOwnProperty.call(patch, "pendencia")) {
        (patch as Record<string, unknown>).pendencia_em = patch.pendencia
          ? new Date().toISOString()
          : "";
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
      const canEditCustomer = isAdmin || isOwner || customer.created_by_id === user.id;
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
      // O telefone do cadastro é a identidade WhatsApp do contato. A edição dos demais
      // dados nunca pode substituir esse número por telefone fiscal ou telefone digitado.
      if (Object.prototype.hasOwnProperty.call(input, "telefone")) {
        patch.telefone = String(customer.telefone || "");
      }

      await base44.asServiceRole.entities.Cliente.update(customerId, patch);
      const updated = await base44.asServiceRole.entities.Cliente.get(customerId);
      return Response.json({ ok: true, customer: safeCustomer(updated) });
    }

    if (action === "conversation.lists.update") {
      const conversationId = String(body.conversation_id || "");
      if (!conversationId) return jsonError("CONVERSATION_REQUIRED", 400);
      const conversation = await getConversation(conversationId);
      if (!conversation) return jsonError("NOT_FOUND_OR_FORBIDDEN", 404);
      const requested: string[] = Array.isArray(body.list_ids)
        ? Array.from(new Set((body.list_ids as unknown[]).map((id: unknown) => String(id))))
        : [];
      if (requested.length > 100) return jsonError("TOO_MANY_LISTS", 400);
      const rows = await base44.asServiceRole.entities.CRMLista.filter(
        { owner_id: ownerId, ativo: true }, "ordem", 300
      );
      const allowed = (rows || []).filter((list: any) =>
        isAdmin || isOwner ||
        (Array.isArray(list.equipe_ids) && list.equipe_ids.includes(user.id))
      );
      const allowedIds = new Set(allowed.map((list: any) => list.id));
      if (requested.some((id: string) => !allowedIds.has(id))) {
        return jsonError("LIST_NOT_FOUND_OR_FORBIDDEN", 403);
      }
      // Preserva associações de listas que o usuário atual não pode visualizar
      // ou editar (ex.: listas privadas de outro atendente).
      const preserved = (Array.isArray(conversation.listas) ? conversation.listas : [])
        .filter((id: string) => !allowedIds.has(id));
      const nextListIds = [...new Set([...preserved, ...requested])];
      await base44.asServiceRole.entities.CRMConversa.update(conversationId, {
        listas: nextListIds
      });
      const updated = await base44.asServiceRole.entities.CRMConversa.get(conversationId);
      return Response.json({
        ok: true,
        conversation: safeConversation(updated),
        lists: allowed.filter((list: any) => requested.includes(list.id)).map((list: any) => ({
          id: list.id, nome: list.nome || "", tipo: list.tipo || "segmento"
        }))
      });
    }

    if (action === "nextstep.create") {
      const conversationId = String(body.conversation_id || "");
      const descricao = String(body.descricao || "").trim();
      if (!conversationId) return jsonError("CONVERSATION_REQUIRED", 400);
      if (!descricao) return jsonError("DESCRIPTION_REQUIRED", 400);
      if (descricao.length > 1000) return jsonError("FIELD_TOO_LONG", 400, { field: "descricao", max: 1000 });
      const conversation = await getConversation(conversationId);
      if (!conversation) return jsonError("NOT_FOUND_OR_FORBIDDEN", 404);
      // CRMProximoPasso segue seu RLS: somente dono/admin pode registrar.
      if (!isAdmin && !isOwner) return jsonError("FORBIDDEN", 403);
      const row = await base44.asServiceRole.entities.CRMProximoPasso.create({
        owner_id: ownerId,
        conversa_id: conversationId,
        descricao,
        em: new Date().toISOString(),
        por: user.full_name || user.email || user.id
      });
      return Response.json({
        ok: true,
        next_step: {
          id: row.id, descricao: row.descricao,
          em: row.em || row.created_date || "", por: row.por || ""
        }
      });
    }

    if (action === "lists.list") {
      const rows = await base44.asServiceRole.entities.CRMLista.filter(
        { owner_id: ownerId, ativo: true },
        "ordem",
        300
      );
      const visible = (rows || []).filter((list: any) => {
        if (isAdmin || isOwner) return true;
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
      if (!isAdmin && !isOwner) return jsonError("FORBIDDEN", 403);
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
}