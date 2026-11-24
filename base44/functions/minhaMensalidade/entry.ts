import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Diz ao proprio usuario se o acesso dele esta suspenso. Quem nao tem mensalidade do site nunca e bloqueado.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ bloqueado: false });
  if (user.role === 'admin') return Response.json({ bloqueado: false });
  const lista = await base44.asServiceRole.entities.MensalidadePlaceFit.filter({ cliente_email: String(user.email || '').toLowerCase() });
  if (lista.length === 0 || lista.some((m) => m.status === 'ativa')) return Response.json({ bloqueado: false });
  const m = lista.find((x) => x.status === 'bloqueada');
  return Response.json({ bloqueado: true, cancelada: !m, link: m?.link_url || '' });
}
