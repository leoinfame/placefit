// Contrata um recurso avulso (PlanoServico) para o usuario logado.
// Cria uma AssinaturaUsuario de trial (30 dias) para o plano solicitado.
//
// POST { user_id, user_email, user_nome, plano_slug }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";

const BUILD = "2026-08-23-contratar-recurso";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_id, user_email, user_nome, plano_slug } = body;

    if (!user_id || !plano_slug) {
      return Response.json(
        { error: "user_id e plano_slug obrigatorios" },
        { status: 400 },
      );
    }

    const planos = await base44.asServiceRole.entities.PlanoServico.filter({
      slug: plano_slug,
    });
    const plano = planos[0];
    if (!plano) {
      return Response.json({ error: "Plano nao encontrado" }, { status: 404 });
    }

    // Verificar se já existe
    const existing = await base44.asServiceRole.entities.AssinaturaUsuario.filter({
      usuario_id: user_id,
      plano_slug: plano_slug,
    });
    if (existing.length > 0) {
      return Response.json({ error: "Voce ja possui este recurso" }, { status: 400 });
    }

    const hoje = new Date();
    const venc = new Date();
    venc.setDate(venc.getDate() + 30);

    const assinatura = await base44.asServiceRole.entities.AssinaturaUsuario.create({
      usuario_id: user_id,
      usuario_email: user_email || "",
      usuario_nome: user_nome || "",
      plano_id: plano.id,
      plano_slug: plano_slug,
      plano_nome: plano.nome,
      status: "trial",
      data_inicio: hoje.toISOString().slice(0, 10),
      data_vencimento: venc.toISOString().slice(0, 10),
    });

    return Response.json({
      success: true,
      assinatura_id: assinatura.id,
      build: BUILD,
    });
  } catch (error) {
    console.error("contratarRecurso:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}