import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Diz ao proprio usuario se ele pode usar o app. Entra quem:
//  - e admin, ou foi habilitado pelo admin (AprovacaoUsuario, tela Usuarios);
//  - pagou a inscricao pelo site e esta em dia (MensalidadePlaceFit);
//  - tem a assinatura antiga ATIVA (clientes anteriores), salvo se o admin desabilitou.
// Mensalidade do site em atraso suspende mesmo quem foi habilitado.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role === 'admin') return Response.json({ bloqueado: false });
  const db = base44.asServiceRole.entities;

  const lista = await db.MensalidadePlaceFit.filter({ cliente_email: String(user.email || '').toLowerCase() });
  const ativa = lista.find((x) => x.status === 'ativa');
  if (ativa) {
    const link = ativa.link_vencimento === ativa.proximo_vencimento ? ativa.link_url || '' : '';
    return Response.json({ bloqueado: false, mensalidade: { valor: ativa.valor || 250, vencimento: ativa.proximo_vencimento, link } });
  }
  const suspensa = lista.find((x) => x.status === 'bloqueada');
  if (suspensa) return Response.json({ bloqueado: true, motivo: 'atraso', link: suspensa.link_url || '' });
  if (lista.length > 0) return Response.json({ bloqueado: true, motivo: 'cancelada', link: '' });

  const registro = (await db.AprovacaoUsuario.filter({ user_id: user.id }, '-updated_date', 1))[0];
  if (registro) return Response.json(registro.aprovado === true ? { bloqueado: false } : { bloqueado: true, motivo: 'pendente' });

  const antigas = await db.AssinaturaUsuario.filter({ usuario_id: user.id, plano_slug: 'mensalidade_padrao', status: 'ativo' });
  return Response.json(antigas.length > 0 ? { bloqueado: false } : { bloqueado: true, motivo: 'pendente' });
}
