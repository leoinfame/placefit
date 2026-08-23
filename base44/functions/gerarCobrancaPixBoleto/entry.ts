// Gera uma cobrança via PIX ou Boleto para uma assinatura.
// Cria um PaymentIntent no Stripe e retorna os dados do QR code (PIX)
// ou os dados do boleto para o usuário pagar.
//
// POST { assinatura_id, metodo }  — metodo: "pix" | "boleto"

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

const BUILD = "2026-08-23-cobranca-pix-boleto";

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

    const body = await req.json();
    const { assinatura_id, metodo } = body;

    if (!assinatura_id || !metodo) {
      return Response.json(
        { error: "assinatura_id e metodo são obrigatórios" },
        { status: 400 },
      );
    }

    if (!["pix", "boleto"].includes(metodo)) {
      return Response.json(
        { error: "metodo deve ser 'pix' ou 'boleto'" },
        { status: 400 },
      );
    }

    // Buscar assinatura e validar propriedade
    const ass = await base44.entities.AssinaturaUsuario.get(assinatura_id);
    if (!ass || ass.usuario_id !== user.id) {
      return Response.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

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

    // Buscar ou criar customer Stripe
    let customerId;
    const metodos = await base44.asServiceRole.entities.MetodoPagamento.filter({
      usuario_id: user.id,
    });
    if (metodos.length > 0 && metodos[0].stripe_customer_id) {
      customerId = metodos[0].stripe_customer_id;
    } else {
      const customerParams = {
        email: user.email || "",
        name: user.empresa || user.full_name || "",
        "metadata[base44_app_id]": process.env.BASE44_APP_ID || "",
        "metadata[user_id]": user.id,
      };
      const customer = await stripeFetch("/customers", {
        method: "POST",
        body: new URLSearchParams(customerParams),
      });
      customerId = customer.id;
    }

    // Criar PaymentIntent
    const piParams = {
      amount: String(valorCentavos),
      currency: "brl",
      "payment_method_types[]": metodo,
      customer: customerId,
      confirm: "true",
      "payment_method_data[type]": metodo,
      "metadata[base44_app_id]": process.env.BASE44_APP_ID || "",
      "metadata[assinatura_id]": assinatura_id,
      "metadata[usuario_id]": user.id,
      "metadata[plano_slug]": ass.plano_slug,
    };

    // Boleto exige billing details com tax_id e endereço
    if (metodo === "boleto") {
      const cnpj = (user.cnpj || "").replace(/\D/g, "");
      if (!cnpj) {
        return Response.json(
          { error: "CNPJ é obrigatório para pagamento via boleto. Atualize seu perfil." },
          { status: 400 },
        );
      }
      piParams["payment_method_data[billing_details][name]"] =
        user.empresa || user.full_name || "";
      piParams["payment_method_data[billing_details][email]"] = user.email || "";
      piParams["payment_method_data[billing_details][tax_id][type]"] = "br_cnpj";
      piParams["payment_method_data[billing_details][tax_id][value]"] = cnpj;
      piParams["payment_method_data[billing_details][address][country]"] = "BR";
      piParams["payment_method_data[billing_details][address][line1]"] =
        user.endereco || "Endereço não informado";
      piParams["payment_method_data[billing_details][address][city]"] = "São Paulo";
      piParams["payment_method_data[billing_details][address][state]"] = "SP";
      piParams["payment_method_data[billing_details][address][postal_code]"] = "01000000";
    }

    let pi;
    try {
      pi = await stripeFetch("/payment_intents", {
        method: "POST",
        body: new URLSearchParams(piParams),
      });
    } catch (stripeErr) {
      console.error("Stripe PI error:", stripeErr.message);
      return Response.json({ error: stripeErr.message }, { status: 400 });
    }

    // Criar fatura pendente
    const hoje = new Date().toISOString().slice(0, 10);
    const refMes = new Date().toISOString().slice(0, 7);
    await base44.asServiceRole.entities.FaturaAssinatura.create({
      usuario_id: user.id,
      assinatura_id,
      plano_slug: ass.plano_slug,
      plano_nome: ass.plano_nome,
      valor: plano.preco_mensal,
      status: "pendente",
      data_emissao: hoje,
      data_vencimento: ass.data_vencimento || hoje,
      metodo_pagamento: metodo,
      gateway_id: pi.id,
      referencia_mes: refMes,
    });

    // Retornar dados do pagamento
    if (metodo === "pix") {
      const pixData = pi.next_action?.pix_display_qr_code;
      return Response.json({
        success: true,
        payment_intent_id: pi.id,
        status: pi.status,
        qr_code_url: pixData?.image_url_png || pixData?.image_url_svg,
        qr_code_data: pixData?.data,
        expires_at: pixData?.expires_at,
        build: BUILD,
      });
    } else {
      const boletoData = pi.next_action?.boleto_display_details;
      return Response.json({
        success: true,
        payment_intent_id: pi.id,
        status: pi.status,
        boleto_url: boletoData?.hosted_voucher_url,
        boleto_number: boletoData?.number,
        boleto_pdf: boletoData?.pdf,
        expires_at: boletoData?.expires_at,
        build: BUILD,
      });
    }
  } catch (error) {
    console.error("gerarCobrancaPixBoleto:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}