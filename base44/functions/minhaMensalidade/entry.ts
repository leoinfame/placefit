import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Diz ao proprio usuario se o acesso dele esta suspenso. Quem nao tem mensalidade do site nunca e bloqueado.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ bloqueado: false });
  if (user.role === 'admin') return Response.json({ bloqueado: false });
  const lista = await base44.asServiceRole.entities.MensalidadePlaceFit.filter({ cliente_email: String(user.email || '').toLowerCase() });
  const ativa = lista.find((x) => x.status === 'ativa');
  if (lista.length === 0) return Response.json({ bloqueado: false });
  if (ativa) {
    const link = ativa.link_vencimento === ativa.proximo_vencimento ? ativa.link_url || '' : '';
    return Response.json({ bloqueado: false, mensalidade: { valor: ativa.valor || 250, vencimento: ativa.proximo_vencimento, link } });
  }
  const m = lista.find((x) => x.status === 'bloqueada');
  return Response.json({ bloqueado: true, cancelada: !m, link: m?.link_url || '' });
}
