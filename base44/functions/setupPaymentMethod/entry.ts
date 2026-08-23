// Cria (ou reutiliza) um Customer no Stripe e um SetupIntent para salvar
// o cartão do usuário sem cobrar imediatamente. Retorna o client_secret
// para o Stripe.js confirmar no frontend, o customer_id e a publishable key.
//
// POST {} (usa usuário logado)

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const BUILD = "2026-08-23-setup-payment";

async function stripeFetch(path, init) {
  const key = secrets.get("STRIPE_SECRET_KEY");
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Stripe-Version": "2025-10-29.clover",
    ...(init.headers || {}),
  };
  if (init.method === "POST" && !headers["Idempotency-Key"]) {
    headers["Idempotency-Key"] = crypto.randomUUID();
  }
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

    // Verificar se já existe um customer Stripe para este usuário
    const existing = await base44.asServiceRole.entities.MetodoPagamento.filter({
      usuario_id: user.id,
    });

    let customerId = existing[0]?.stripe_customer_id;

    if (!customerId) {
      // Criar customer no Stripe
      const customer = await stripeFetch("/customers", {
        method: "POST",
        body: new URLSearchParams({
          email: user.email || "",
          name: user.empresa || user.full_name || "",
          "metadata[base44_app_id]": process.env.BASE44_APP_ID || "",
          "metadata[user_id]": user.id,
        }),
      });
      customerId = customer.id;
    }

    // Criar SetupIntent
    const setupIntent = await stripeFetch("/setup_intents", {
      method: "POST",
      body: new URLSearchParams({
        customer: customerId,
        "payment_method_types[]": "card",
        usage: "off_session",
        "metadata[base44_app_id]": process.env.BASE44_APP_ID || "",
        "metadata[user_id]": user.id,
      }),
    });

    return Response.json({
      client_secret: setupIntent.client_secret,
      customer_id: customerId,
      publishable_key: secrets.get("STRIPE_PUBLISHABLE_KEY"),
      build: BUILD,
    });
  } catch (error) {
    console.error("setupPaymentMethod:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}