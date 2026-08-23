// Cobra um cartão salvo para uma assinatura ativa. Cria um PaymentIntent
// off_session (sem interação do usuário) e registra a fatura.
//
// POST { assinatura_id }
// Chamado por automação agendada (cobrança recorrente mensal).

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const BUILD = "2026-08-23-charge-card";

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
    const body = await req.json();
    const { assinatura_id } = body;

    if (!assinatura_id) {
      return Response.json({ error: "assinatura_id obrigatório" }, { status: 400 });
    }

    // Buscar assinatura
    const ass = await base44.asServiceRole.entities.AssinaturaUsuario.get(assinatura_id);
    if (!ass) {
      return Response.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }
    if (ass.status === "cancelado") {
      return Response.json({ error: "Assinatura cancelada" }, { status: 400 });
    }

    // Buscar cartão salvo
    const metodos = await base44.asServiceRole.entities.MetodoPagamento.filter({
      usuario_id: ass.usuario_id,
      ativo: true,
    });
    if (metodos.length === 0) {
      return Response.json({ error: "Sem cartão cadastrado" }, { status: 400 });
    }
    const pm = metodos[0];

    // Buscar preço do plano
    const planos = await base44.asServiceRole.entities.PlanoServico.filter({
      slug: ass.plano_slug,
    });
    const plano = planos[0];
    if (!plano) {
      return Response.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    const valorCentavos = Math.round((plano.preco_mensal || 0) * 100);
    if (valorCentavos <= 0) {
      return Response.json({ error: "Plano sem preço definido" }, { status: 400 });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const refMes = new Date().toISOString().slice(0, 7);

    // Criar PaymentIntent off_session
    let pi;
    try {
      pi = await stripeFetch("/payment_intents", {
        method: "POST",
        body: new URLSearchParams({
          amount: String(valorCentavos),
          currency: "brl",
          customer: pm.stripe_customer_id,
          payment_method: pm.stripe_payment_method_id,
          off_session: "true",
          confirm: "true",
          "metadata[base44_app_id]": process.env.BASE44_APP_ID || "",
          "metadata[assinatura_id]": assinatura_id,
          "metadata[usuario_id]": ass.usuario_id,
          "metadata[plano_slug]": ass.plano_slug,
          "metadata[referencia_mes]": refMes,
        }),
      });
    } catch (stripeErr) {
      // Registrar fatura como pendente/erro
      await base44.asServiceRole.entities.FaturaAssinatura.create({
        usuario_id: ass.usuario_id,
        assinatura_id,
        plano_slug: ass.plano_slug,
        plano_nome: ass.plano_nome,
        valor: plano.preco_mensal,
        status: "pendente",
        data_emissao: hoje,
        data_vencimento: ass.data_vencimento || hoje,
        metodo_pagamento: "cartao",
        referencia_mes: refMes,
        observacoes: `Erro Stripe: ${stripeErr.message}`,
      });
      return Response.json({ error: stripeErr.message, status: "charge_failed" });
    }

    if (pi.status === "succeeded") {
      // Fatura paga
      await base44.asServiceRole.entities.FaturaAssinatura.create({
        usuario_id: ass.usuario_id,
        assinatura_id,
        plano_slug: ass.plano_slug,
        plano_nome: ass.plano_nome,
        valor: plano.preco_mensal,
        status: "pago",
        data_emissao: hoje,
        data_pagamento: hoje,
        data_vencimento: hoje,
        metodo_pagamento: "cartao",
        gateway_id: pi.id,
        referencia_mes: refMes,
      });

      // Atualizar vencimento para +1 mês
      const novoVenc = new Date();
      novoVenc.setMonth(novoVenc.getMonth() + 1);
      await base44.asServiceRole.entities.AssinaturaUsuario.update(assinatura_id, {
        status: "ativo",
        data_vencimento: novoVenc.toISOString().slice(0, 10),
      });

      return Response.json({
        success: true,
        payment_intent_id: pi.id,
        status: "succeeded",
      });
    } else {
      // Pagamento falhou
      await base44.asServiceRole.entities.FaturaAssinatura.create({
        usuario_id: ass.usuario_id,
        assinatura_id,
        plano_slug: ass.plano_slug,
        plano_nome: ass.plano_nome,
        valor: plano.preco_mensal,
        status: "pendente",
        data_emissao: hoje,
        data_vencimento: ass.data_vencimento || hoje,
        metodo_pagamento: "cartao",
        gateway_id: pi.id,
        referencia_mes: refMes,
        observacoes: `Status: ${pi.status}`,
      });

      return Response.json({
        success: false,
        payment_intent_id: pi.id,
        status: pi.status,
        error: pi.last_payment_error?.message || "Pagamento falhou",
      });
    }
  } catch (error) {
    console.error("chargeSavedCard:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}