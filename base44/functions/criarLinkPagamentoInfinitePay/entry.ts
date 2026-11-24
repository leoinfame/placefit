import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { secrets } from 'base44:runtime';
import { configInfinitePay, criarCobrancaInfinitePay } from '../../shared/infinitepayCheckout.ts';

// Admin: gera um link avulso (teste ou cobranca manual).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const valor = Number(body.valor);
    if (!(valor > 0)) return Response.json({ error: 'Informe um valor maior que zero' }, { status: 400 });

    const db = base44.asServiceRole;
    const { config, ativa } = await configInfinitePay(db);
    if (!ativa) return Response.json({ error: 'InfinitePay esta desligada' }, { status: 400 });
    return Response.json(await criarCobrancaInfinitePay(db, {
      apiKey: secrets.get('INFINITEPAY_API_KEY'),
      webhookUrl: secrets.get('INFINITEPAY_WEBHOOK_URL'),
      config,
      valor,
      descricao: String(body.descricao || 'Cobranca PlaceFit'),
      referenciaTipo: 'manual',
    }));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
