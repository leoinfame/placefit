// Checkout Integrado da InfinitePay. Mesmo modelo da PlaceHouse, com uma unica conta (PlaceFit).
const API = 'https://api.checkout.infinitepay.io';

export async function configInfinitePay(db: any) {
  const todas = await db.entities.ConfigPagamento.filter({ provider: 'infinitepay' });
  const config = todas[0] || null;
  return { config, ativa: !!config?.ativo };
}

export const limparTag = (tag: any) => String(tag || '').trim().replace(/^\$/, '');

/** Cria o link e registra a cobranca. A API Key vem sempre dos secrets, nunca do chamador. */
export async function criarCobrancaInfinitePay(db: any, dados: any) {
  const { apiKey, webhookUrl, config, valor, descricao, referenciaTipo, cliente, redirectUrl } = dados;
  if (!apiKey) throw new Error('INFINITEPAY_API_KEY nao configurada');
  if (!webhookUrl) throw new Error('INFINITEPAY_WEBHOOK_URL nao configurada');

  const centavos = Math.round(Number(valor) * 100);
  if (!(centavos > 0)) throw new Error('Valor invalido');

  const orderNsu = `pf-${crypto.randomUUID()}`;
  const parcelas = config?.taxa_parcelamento === 'loja'
    ? Math.min(12, Math.max(0, Number(config.parcelas_sem_juros_assumidas) || 0))
    : 0;
  const pix = Number(config?.desconto_pix_pct) || 0;
  const pixValido = pix > 0 && pix < 100;

  const resposta = await fetch(`${API}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      order_nsu: orderNsu,
      items: [{ quantity: 1, price: centavos, description: String(descricao).slice(0, 120) }],
      ...(redirectUrl ? { redirect_url: redirectUrl } : {}),
      webhook: { url: webhookUrl, events: ['paid', 'settled', 'refunded', 'canceled'] },
      ...(cliente ? { customer: { name: cliente.nome, email: cliente.email } } : {}),
      options: {
        payment_methods_enabled: ['credit_card', 'pix'],
        single_payment: true,
        assured_installments: parcelas,
        ...(pixValido ? { discounts: { pix } } : {}),
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const retorno = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(retorno?.message || retorno?.error || 'InfinitePay recusou a criacao do link');

  const checkoutUrl = retorno.checkout_url || retorno.url || retorno.link;
  if (!checkoutUrl) throw new Error('A InfinitePay nao retornou o link do checkout');

  const cheio = centavos / 100;
  await db.entities.CobrancaInfinitePay.create({
    order_nsu: orderNsu,
    referencia_tipo: referenciaTipo === 'inscricao' ? 'inscricao' : 'manual',
    descricao: String(descricao).slice(0, 200),
    valor: cheio,
    valor_minimo: Number((cheio * (1 - (pixValido ? pix : 0) / 100)).toFixed(2)),
    checkout_url: checkoutUrl,
    invoice_slug: retorno.slug || null,
    status: 'criada',
    cliente_nome: cliente?.nome || null,
    cliente_email: cliente?.email || null,
    cliente_whatsapp: cliente?.whatsapp || null,
  });
  return { order_nsu: orderNsu, checkout_url: checkoutUrl };
}

/** Pergunta direto a InfinitePay se a cobranca foi paga. */
export async function conferirPagamento(apiKey: string, handle: string, corpo: any) {
  const resposta = await fetch(`${API}/payment_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      ...(handle ? { handle } : {}),
      order_nsu: corpo.order_nsu,
      ...(corpo.transaction_nsu ? { transaction_nsu: String(corpo.transaction_nsu) } : {}),
      ...(corpo.invoice_slug || corpo.slug ? { slug: String(corpo.invoice_slug || corpo.slug) } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) return null;
  return await resposta.json().catch(() => null);
}
