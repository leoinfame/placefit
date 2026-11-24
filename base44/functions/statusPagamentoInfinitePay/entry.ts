import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { secrets } from 'base44:runtime';

// Admin: diz so se as credenciais existem, nunca os valores.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const faltando = ['INFINITEPAY_API_KEY', 'INFINITEPAY_WEBHOOK_URL'].filter((nome) => !secrets.get(nome));
  return Response.json({ configurado: faltando.length === 0, faltando });
}
