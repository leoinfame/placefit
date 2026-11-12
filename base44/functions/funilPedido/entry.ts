import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { aplicarFunilDoPedido, etapaAlvoDoPedido } from '../../shared/funilCrm.js';

// Item 028: aplica a etapa automática do funil do CRM a partir de um Pedido.
// Chamada pelo workflow "Etapa do funil por pedido" (gatilho de entidade) — não é
// acionada por tela. Só move a conversa que já existe: nunca cria conversa nova.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const pedidoId = body?.pedido_id || body?.entity_id;
    if (!pedidoId) return Response.json({ error: 'pedido_id is required' }, { status: 400 });

    // Relê o pedido no banco: o payload do gatilho pode vir nulo em registros grandes.
    const pedido = await base44.asServiceRole.entities.Pedido
      .get(pedidoId)
      .catch((e: any) => (e?.status === 404 ? null : Promise.reject(e)));
    if (!pedido) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

    const movidas = await aplicarFunilDoPedido(base44.asServiceRole.entities, pedido);
    return Response.json({ ok: true, etapa_alvo: etapaAlvoDoPedido(pedido), movidas });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}