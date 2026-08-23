// Após o Stripe.js confirmar o SetupIntent no frontend, esta função
// recupera o payment_method, anexa ao customer e salva na entidade
// MetodoPagamento.
//
// POST { setup_intent_id, customer_id, holder_name }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const BUILD = "2026-08-23-save-payment";

async function stripeFetch(path, init) {
  const key = secrets.get("STRIPE_SECRET_KEY");
  const headers = {
    Authorization: `Bearer ${key}`,
    "Stripe-Version": "2025-10-29.clover",
    ...(init.headers || {}),
  };
  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers,
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error?.message || `Stripe API error ${resp.status}`);
  }
  return data;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { setup_intent_id, customer_id, holder_name } = body;

    if (!setup_intent_id || !customer_id) {
      return Response.json(
        { error: "setup_intent_id e customer_id obrigatórios" },
        { status: 400 },
      );
    }

    // Recuperar SetupIntent
    const si = await stripeFetch(`/setup_intents/${setup_intent_id}`, {
      method: "GET",
    });

    if (si.status !== "succeeded") {
      return Response.json(
        { error: `Setup não confirmado (status: ${si.status})` },
        { status: 400 },
      );
    }

    const pmId = si.payment_method;

    // Recuperar detalhes do payment method
    const pm = await stripeFetch(`/payment_methods/${pmId}`, {
      method: "GET",
    });

    // Verificar se já existe registro para este usuário
    const existing = await base44.asServiceRole.entities.MetodoPagamento.filter({
      usuario_id: user.id,
    });

    const cardData = {
      stripe_customer_id: customer_id,
      stripe_payment_method_id: pmId,
      card_last4: pm.card?.last4 || "",
      card_brand: pm.card?.brand || "",
      card_exp_month: pm.card?.exp_month || 0,
      card_exp_year: pm.card?.exp_year || 0,
      card_holder_name: holder_name || pm.billing_details?.name || "",
      ativo: true,
    };

    let metodo;
    if (existing.length > 0) {
      metodo = await base44.asServiceRole.entities.MetodoPagamento.update(
        existing[0].id,
        cardData,
      );
    } else {
      metodo = await base44.asServiceRole.entities.MetodoPagamento.create({
        usuario_id: user.id,
        ...cardData,
      });
    }

    // Ativar cobrança automática em todas as assinaturas ativas/trial
    const assinaturas = await base44.asServiceRole.entities.AssinaturaUsuario.filter({
      usuario_id: user.id,
    });
    for (const ass of assinaturas) {
      if (ass.status === "ativo" || ass.status === "trial") {
        await base44.asServiceRole.entities.AssinaturaUsuario.update(ass.id, {
          cobranca_automatica: true,
        });
      }
    }

    return Response.json({
      success: true,
      metodo_id: metodo.id,
      card: {
        last4: cardData.card_last4,
        brand: cardData.card_brand,
        exp_month: cardData.card_exp_month,
        exp_year: cardData.card_exp_year,
      },
      build: BUILD,
    });
  } catch (error) {
    console.error("savePaymentMethod:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}