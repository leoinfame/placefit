import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { secrets } from 'base44:runtime';
import { configInfinitePay, conferirPagamento, limparTag } from '../../shared/infinitepayCheckout.ts';

// Publica: chamada pela InfinitePay. Exige o token da URL e confirma o pagamento direto
// na InfinitePay. O corpo do aviso nunca basta para marcar como pago.
export default async function (req) {
  try {
    const apiKey = secrets.get('INFINITEPAY_API_KEY');
    let token = null;
    try { token = new URL(secrets.get('INFINITEPAY_WEBHOOK_URL') || '').searchParams.get('token'); } catch (_) { /* sem URL */ }
    const url = new URL(req.url);
    if (!token || !apiKey || url.searchParams.get('token') !== token) {
      return Response.json({ error: 'nao autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const orderNsu = body.order_nsu ? String(body.order_nsu) : '';
    if (!orderNsu) return Response.json({ error: 'order_nsu ausente' }, { status: 400 });

    const db = createClientFromRequest(req).asServiceRole;
    const cobranca = (await db.entities.CobrancaInfinitePay.filter({ order_nsu: orderNsu }))[0];
    if (!cobranca) return Response.json({ error: 'cobranca nao encontrada' }, { status: 404 });

    const evento = String(body.event || body.event_type || body.status || url.searchParams.get('event') || '').toLowerCase();
    if (evento.includes('refund')) {
      await db.entities.CobrancaInfinitePay.update(cobranca.id, { status: 'estornada' });
      return Response.json({ ok: true, refunded: true });
    }
    if (evento.includes('cancel')) {
      if (cobranca.status === 'criada') await db.entities.CobrancaInfinitePay.update(cobranca.id, { status: 'cancelada' });
      return Response.json({ ok: true, canceled: true });
    }

    // Aviso repetido (paid e depois settled): ja tratado.
    if (cobranca.status === 'paga' || cobranca.status === 'estornada') return Response.json({ ok: true, repetido: true });

    const { config } = await configInfinitePay(db);
    const conferido = await conferirPagamento(apiKey, limparTag(config?.infinite_tag), { ...body, order_nsu: orderNsu });
    if (!conferido) return Response.json({ error: 'falha ao confirmar o pagamento' }, { status: 400 });
    if (conferido.paid !== true) return Response.json({ ok: true, paid: false });

    const pago = (Number(conferido.paid_amount) || Number(conferido.amount) || 0) / 100;
    const confere = pago + 0.01 >= Number(cobranca.valor_minimo ?? cobranca.valor);

    await db.entities.CobrancaInfinitePay.update(cobranca.id, {
      status: confere ? 'paga' : 'divergente',
      transaction_nsu: body.transaction_nsu ? String(body.transaction_nsu) : null,
      capture_method: conferido.capture_method || null,
      parcelas: Number(conferido.installments) || null,
      paid_amount: pago,
      receipt_url: body.receipt_url ? String(body.receipt_url) : null,
      pago_em: new Date().toISOString(),
    });

    // Inscricao paga: deixa o cadastro pronto para o primeiro login (inscreverApp).
    if (confere && cobranca.referencia_tipo === 'inscricao' && cobranca.cliente_email) {
      const pendentes = await db.entities.InscricaoApp.filter({ email: cobranca.cliente_email, processado: false });
      if (pendentes.length === 0) {
        await db.entities.InscricaoApp.create({
          nome: cobranca.cliente_nome || cobranca.cliente_email,
          email: cobranca.cliente_email,
          whatsapp: cobranca.cliente_whatsapp || '',
          cupom: 'INSCRICAO_PAGA',
          processado: false,
        });
      }
    }
    return Response.json({ ok: true, paid: confere });
  } catch (error) {
    console.error('webhookInfinitePay:', error);
    return Response.json({ error: 'erro interno' }, { status: 500 });
  }
}
