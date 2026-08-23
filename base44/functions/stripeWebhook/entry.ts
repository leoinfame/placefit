// Webhook do Stripe — recebe eventos de pagamento e atualiza as faturas.
// Chamado pelo Stripe sem auth de usuário; usa service role.
//
// POST (raw body com header stripe-signature)

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const BUILD = "2026-08-23-stripe-webhook";

async function verifySignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const signature = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !signature) {
    throw new Error("Header de assinatura inválido");
  }

  // Rejeitar timestamps muito antigos (>5 min)
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) {
    throw new Error("Timestamp muito antigo");
  }

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expectedSig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload),
  );
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex !== signature) {
    throw new Error("Assinatura inválida");
  }

  return JSON.parse(payload);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const webhookSecret = secrets.get("STRIPE_WEBHOOK_SECRET");

    const body = await req.text();
    const sig = req.headers.get("stripe-signature") || "";

    let event;
    if (webhookSecret) {
      event = await verifySignature(body, sig, webhookSecret);
    } else {
      // Modo desenvolvimento sem verificação — logar aviso
      console.warn("STRIPE_WEBHOOK_SECRET não configurado — pulando verificação");
      event = JSON.parse(body);
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const assinaturaId = pi.metadata?.assinatura_id;
        const refMes = pi.metadata?.referencia_mes;

        if (assinaturaId && refMes) {
          // Buscar fatura pendente por gateway_id e marcar como paga
          const faturas = await base44.asServiceRole.entities.FaturaAssinatura.filter({
            gateway_id: pi.id,
          });
          if (faturas.length > 0 && faturas[0].status !== "pago") {
            await base44.asServiceRole.entities.FaturaAssinatura.update(
              faturas[0].id,
              {
                status: "pago",
                data_pagamento: new Date().toISOString().slice(0, 10),
              },
            );
          }
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const faturas = await base44.asServiceRole.entities.FaturaAssinatura.filter({
          gateway_id: pi.id,
        });
        if (faturas.length > 0) {
          await base44.asServiceRole.entities.FaturaAssinatura.update(
            faturas[0].id,
            {
              status: "atrasado",
              observacoes: `Falha: ${pi.last_payment_error?.message || "payment_failed"}`,
            },
          );
        }
        break;
      }
      default:
        // Evento não tratado — ignorar
        break;
    }

    return Response.json({ received: true, type: event.type, build: BUILD });
  } catch (error) {
    console.error("stripeWebhook:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}