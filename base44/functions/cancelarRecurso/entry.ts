// Cancela uma assinatura/recurso do usuário logado.
// Marca status como "cancelado" e registra data/motivo.
//
// POST { assinatura_id, motivo }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const BUILD = "2026-08-23-cancelar-recurso";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { assinatura_id, motivo } = body;

    if (!assinatura_id) {
      return Response.json({ error: "assinatura_id obrigatório" }, { status: 400 });
    }

    // Verificar que a assinatura pertence ao usuário
    const assinaturas = await base44.entities.AssinaturaUsuario.filter({
      id: assinatura_id,
      usuario_id: user.id,
    });

    if (assinaturas.length === 0) {
      return Response.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    const hoje = new Date().toISOString().slice(0, 10);

    await base44.asServiceRole.entities.AssinaturaUsuario.update(assinatura_id, {
      status: "cancelado",
      data_cancelamento: hoje,
      motivo_cancelamento: motivo || "",
      cobranca_automatica: false,
    });

    return Response.json({
      success: true,
      assinatura_id,
      data_cancelamento: hoje,
      build: BUILD,
    });
  } catch (error) {
    console.error("cancelarRecurso:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}