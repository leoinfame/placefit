import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { avisarVenda } from '../../shared/avisoVenda.ts';

// Admin: envia um aviso de teste (so ao email_aviso), sem mexer em cobranca nenhuma.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  return Response.json(await avisarVenda(base44.asServiceRole, 'TESTE: aviso de venda PlaceFit', ['Se voce recebeu isto, o aviso esta funcionando.']));
}
