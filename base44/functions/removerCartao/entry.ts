// Remove/desativa o cartão salvo do usuário logado.
// Desanexa o payment method no Stripe e marca MetodoPagamento como inativo.
// Desativa cobrança automática em todas as assinaturas.
//
// POST {} (usa usuário logado)

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const BUILD = "2026-08-23-remover-cartao";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const metodos = await base44.asServiceRole.entities.MetodoPagamento.filter({
      usuario_id: user.id,
      ativo: true,
    });

    if (metodos.length === 0) {
      return Response.json({ error: "Nenhum cartão ativo" }, { status: 404 });
    }

    const metodo = metodos[0];

    // Desanexar payment method no Stripe
    const stripeKey = secrets.get("STRIPE_SECRET_KEY");
    try {
      await fetch(
        `https://api.stripe.com/v1/payment_methods/${metodo.stripe_payment_method_id}/detach`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Stripe-Version": "2025-10-29.clover",
            "Idempotency-Key": crypto.randomUUID(),
          },
        },
      );
    } catch (stripeErr) {
      console.warn("Erro ao desanexar PM no Stripe:", stripeErr.message);
    }

    // Marcar como inativo
    await base44.asServiceRole.entities.MetodoPagamento.update(metodo.id, {
      ativo: false,
    });

    // Desativar cobrança automática em todas as assinaturas
    const assinaturas = await base44.asServiceRole.entities.AssinaturaUsuario.filter({
      usuario_id: user.id,
    });
    for (const ass of assinaturas) {
      if (ass.cobranca_automatica) {
        await base44.asServiceRole.entities.AssinaturaUsuario.update(ass.id, {
          cobranca_automatica: false,
        });
      }
    }

    return Response.json({ success: true, build: BUILD });
  } catch (error) {
    console.error("removerCartao:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}