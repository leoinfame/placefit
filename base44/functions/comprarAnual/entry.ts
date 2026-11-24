import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { secrets } from 'base44:runtime';
import { linkAnual } from '../../shared/mensalidades.ts';

// Publica (site) e usada em Minha Conta. Valor fixo no servidor; so gera link para quem ja pagou a inscricao.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (body.site) return Response.json({ error: 'Dados invalidos' }, { status: 400 });
    const eu = body.email ? null : await base44.auth.me().catch(() => null);
    const email = String(body.email || eu?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Confira o e-mail.' }, { status: 400 });
    const r: any = await linkAnual(base44.asServiceRole, email, {
      apiKey: secrets.get('INFINITEPAY_API_KEY'), webhookUrl: secrets.get('INFINITEPAY_WEBHOOK_URL'),
    });
    return r.erro ? Response.json({ error: r.erro }, { status: r.status }) : Response.json(r);
  } catch (error) {
    console.error('comprarAnual:', error);
    return Response.json({ error: 'Nao foi possivel abrir o pagamento. Chame no WhatsApp.' }, { status: 500 });
  }
}
