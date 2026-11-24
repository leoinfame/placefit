import { acaoDoDia, hojeBR, maisUmMes, maisUmAno, somarDias, diasDeAtraso, DIAS_TOLERANCIA } from './mensalidadeRegras.ts';
import { configInfinitePay, criarCobrancaInfinitePay } from './infinitepayCheckout.ts';
import { avisarVenda } from './avisoVenda.ts';

const VALOR = 250;
const VALOR_ANUAL = 2700;
const br = (d: string) => d.split('-').reverse().join('/');

/** True so para o primeiro a pegar esta chave (evita aviso repetido). */
export async function travar(db: any, chave: string, espera = 1500) {
  const minha = await db.entities.BaixaInfinitePay.create({ order_nsu: chave });
  await new Promise((ok) => setTimeout(ok, espera));
  const todas = await db.entities.BaixaInfinitePay.filter({ order_nsu: chave });
  const primeira = todas.map((t: any) => String(t.id)).sort()[0];
  return !primeira || primeira === String(minha.id);
}

/** Inscricao paga: primeira mensalidade vence em 30 dias. */
export async function abrirMensalidade(db: any, cobranca: any, agora = new Date()) {
  const email = String(cobranca.cliente_email || '').toLowerCase();
  if (!email) return;
  const existentes = await db.entities.MensalidadePlaceFit.filter({ cliente_email: email });
  if (existentes.some((m: any) => m.status !== 'cancelada')) return;
  await db.entities.MensalidadePlaceFit.create({
    cliente_email: email,
    cliente_nome: cobranca.cliente_nome || '',
    cliente_whatsapp: cobranca.cliente_whatsapp || '',
    valor: VALOR,
    proximo_vencimento: somarDias(hojeBR(agora), 30),
    status: 'ativa',
    inscricao_nsu: cobranca.order_nsu,
  });
}

/** Mensalidade paga: anda um mes e libera o acesso. Vencimento ja passado recomeca de hoje. */
export async function pagarMensalidade(db: any, mensalidadeId: string, agora = new Date()) {
  const m = (await db.entities.MensalidadePlaceFit.filter({ id: mensalidadeId }))[0];
  if (!m || m.status === 'cancelada') return;
  const hoje = hojeBR(agora);
  const base = m.status === 'bloqueada' ? hoje : m.proximo_vencimento;
  await db.entities.MensalidadePlaceFit.update(m.id, {
    status: 'ativa', proximo_vencimento: maisUmMes(base), ultimo_pagamento: hoje, link_url: '', link_vencimento: '',
  });
}

/** Link do plano anual (cartao). So para quem ja tem mensalidade aberta pela inscricao. */
export async function linkAnual(db: any, email: string, cred: any) {
  const m = (await db.entities.MensalidadePlaceFit.filter({ cliente_email: email })).find((x: any) => x.status !== 'cancelada');
  if (!m) return { erro: 'Nao achamos inscricao paga com este e-mail. Faca a inscricao primeiro ou chame no WhatsApp.', status: 404 };
  const { config, ativa } = await configInfinitePay(db);
  if (!ativa) return { erro: 'Pagamento online indisponivel no momento.', status: 503 };
  const aberta = (await db.entities.CobrancaInfinitePay.filter({ referencia_id: m.id, referencia_tipo: 'anual', status: 'criada' }, '-created_date', 1))[0];
  if (aberta?.checkout_url && Date.now() - new Date(aberta.created_date).getTime() < 30 * 60 * 1000) return { checkout_url: aberta.checkout_url };
  const { checkout_url } = await criarCobrancaInfinitePay(db, {
    ...cred,
    // O desconto de 10% ja esta no valor; parcelas com a taxa do cliente.
    config: { ...config, desconto_pix_pct: 0, taxa_parcelamento: 'cliente', parcelas_sem_juros_assumidas: 0 },
    metodos: ['credit_card'],
    valor: VALOR_ANUAL,
    descricao: 'PlaceFit - plano anual (12 meses)',
    referenciaTipo: 'anual',
    referenciaId: m.id,
    cliente: { nome: m.cliente_nome || m.cliente_email, email: m.cliente_email, whatsapp: m.cliente_whatsapp },
    redirectUrl: 'https://www.placefit.com.br/obrigado.html',
  });
  return { checkout_url };
}

/** Anual pago: vencimento anda 1 ano e o acesso e liberado. */
export async function pagarAnual(db: any, mensalidadeId: string, agora = new Date()) {
  const m = (await db.entities.MensalidadePlaceFit.filter({ id: mensalidadeId }))[0];
  if (!m || m.status === 'cancelada') return;
  const hoje = hojeBR(agora);
  await db.entities.MensalidadePlaceFit.update(m.id, {
    status: 'ativa', plano: 'anual', proximo_vencimento: maisUmAno(m.status === 'bloqueada' ? hoje : m.proximo_vencimento),
    ultimo_pagamento: hoje, link_url: '', link_vencimento: '',
  });
}

/** Anual estornado: volta para o mensal, vencendo hoje. */
export async function estornarAnual(db: any, mensalidadeId: string, agora = new Date()) {
  const m = (await db.entities.MensalidadePlaceFit.filter({ id: mensalidadeId }))[0];
  if (!m || m.status === 'cancelada') return;
  await db.entities.MensalidadePlaceFit.update(m.id, { plano: 'mensal', proximo_vencimento: hojeBR(agora), link_url: '', link_vencimento: '' });
}

export async function cancelarPorEstorno(db: any, cobranca: any) {
  const lista = await db.entities.MensalidadePlaceFit.filter({ inscricao_nsu: cobranca.order_nsu });
  for (const m of lista) await db.entities.MensalidadePlaceFit.update(m.id, { status: 'cancelada' });
}

async function garantirLink(db: any, m: any, cred: any) {
  if (m.link_url && m.link_vencimento === m.proximo_vencimento) return m.link_url;
  const { config, ativa } = await configInfinitePay(db);
  if (!ativa) throw new Error('InfinitePay desligada');
  const { checkout_url } = await criarCobrancaInfinitePay(db, {
    ...cred,
    // Mensalidade: valor cheio, sem desconto no Pix e sem parcelas assumidas.
    config: { ...config, desconto_pix_pct: 0, taxa_parcelamento: 'cliente', parcelas_sem_juros_assumidas: 0 },
    valor: m.valor || VALOR,
    descricao: `Mensalidade PlaceFit - vencimento ${br(m.proximo_vencimento)}`,
    referenciaTipo: 'mensalidade',
    referenciaId: m.id,
    cliente: { nome: m.cliente_nome || m.cliente_email, email: m.cliente_email, whatsapp: m.cliente_whatsapp },
  });
  await db.entities.MensalidadePlaceFit.update(m.id, { link_url: checkout_url, link_vencimento: m.proximo_vencimento });
  return checkout_url;
}

const TEXTO: any = {
  lembrete: (m: any) => [`Sua mensalidade PlaceFit vence em ${br(m.proximo_vencimento)}`, 'O link de pagamento esta abaixo.'],
  vence_hoje: () => ['Sua mensalidade PlaceFit vence hoje', 'O link de pagamento esta abaixo.'],
  atrasada: (m: any) => [`Sua mensalidade PlaceFit venceu em ${br(m.proximo_vencimento)}`, `Pague ate ${br(somarDias(m.proximo_vencimento, DIAS_TOLERANCIA))} para manter o acesso.`],
  ultimo_aviso: (m: any) => ['Ultimo aviso: mensalidade PlaceFit em aberto', `Sem o pagamento ate ${br(somarDias(m.proximo_vencimento, DIAS_TOLERANCIA))}, o acesso ao sistema sera suspenso.`],
  bloquear: () => ['Acesso PlaceFit suspenso', 'A mensalidade nao foi paga em ate 5 dias do vencimento. Pague pelo link abaixo e o acesso volta sozinho.'],
};

/** Roda todo dia. Repetir no mesmo dia nao repete aviso. */
export async function rodarMensalidades(db: any, cred: any, agora = new Date(), espera = 1500) {
  const hoje = hojeBR(agora);
  const ativas = await db.entities.MensalidadePlaceFit.filter({ status: 'ativa' }, '-created_date', 500);
  const relatorio: any[] = [];
  for (const m of ativas) {
    const acao = acaoDoDia(m, hoje);
    if (!acao) continue;
    const chave = `mens:${m.id}:${m.proximo_vencimento}:${acao}:${hoje}`;
    try {
      if (!(await travar(db, chave, espera))) continue;
      // Sem link ainda nao bloqueia: o cliente precisa ter como pagar.
      const link = await garantirLink(db, m, cred);
      if (acao === 'bloquear') await db.entities.MensalidadePlaceFit.update(m.id, { status: 'bloqueada' });

      const [assunto, frase] = TEXTO[acao](m);
      let emailOk = false;
      try {
        await db.integrations.Core.SendEmail({
          to: m.cliente_email, subject: assunto, from_name: 'PlaceFit',
          body: `Ola!<br><br>${frase}<br><br>Valor: R$ ${Number(m.valor || VALOR).toFixed(2).replace('.', ',')}<br><br><a href="${link}">${link}</a>`,
        });
        emailOk = true;
      } catch (_) { /* e-mail pode nao ser de usuario do app; o dono e avisado abaixo */ }

      const fone = String(m.cliente_whatsapp || '').replace(/\D/g, '');
      if (!emailOk || acao === 'bloquear' || acao === 'ultimo_aviso') {
        await avisarVenda(db, `Mensalidade: ${acao.replace('_', ' ')} - ${m.cliente_nome || m.cliente_email}`, [
          `Vencimento: ${br(m.proximo_vencimento)} (${diasDeAtraso(m.proximo_vencimento, hoje)} dias)`,
          `E-mail ao cliente: ${emailOk ? 'enviado' : 'NAO enviado, avise pelo WhatsApp'}`,
          ...(fone ? [`WhatsApp: https://wa.me/${fone.startsWith('55') ? fone : '55' + fone}`] : []),
          `Link de pagamento: ${link}`,
        ]);
      }
      relatorio.push({ id: m.id, acao, emailOk });
    } catch (e) {
      console.error('rodarMensalidades:', m.id, acao, e?.message);
      relatorio.push({ id: m.id, acao, erro: true });
    }
  }
  return relatorio;
}
