import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

const fetchAll = async (fn, sort = '-created_date', pageSize = 500) => {
  let all = []; let skip = 0;
  while (true) {
    const batch = await fn(sort, pageSize, skip);
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { slug, cliente_id, token } = body;
    if (!slug || !cliente_id || !token) return Response.json({ error: 'slug, cliente_id e token obrigatorios' }, { status: 400 });

    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ slug: String(slug).trim().toLowerCase() });
    const config = configs[0];
    if (!config) return Response.json({ error: 'Loja nao encontrada' }, { status: 404 });

    const cliente = await base44.asServiceRole.entities.LojaCliente.get(cliente_id).catch(() => null);
    if (!cliente) return Response.json({ error: 'Cliente nao encontrado' }, { status: 404 });
    if (cliente.token !== token) return Response.json({ error: 'Sessao invalida. Faca login novamente.' }, { status: 401 });
    if (cliente.revendedor_id !== config.revendedor_id) return Response.json({ error: 'Cliente nao pertence a esta loja' }, { status: 403 });

    const pedidos = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.LojaPedido.filter({ revendedor_id: config.revendedor_id, cliente_id }, sort, limit, skip)
    );

    return Response.json({
      cliente: {
        id: cliente.id, nome: cliente.nome, email: cliente.email, cpf: cliente.cpf, telefone: cliente.telefone,
        cep: cliente.cep, endereco: cliente.endereco, numero: cliente.numero, complemento: cliente.complemento,
        bairro: cliente.bairro, cidade: cliente.cidade, estado: cliente.estado,
      },
      pedidos: pedidos.map((p) => ({
        id: p.id, numero_pedido: p.numero_pedido, created_date: p.created_date,
        itens: p.itens, subtotal: p.subtotal, frete: p.frete, total: p.total,
        status: p.status, pagamento_status: p.pagamento_status, pagamento_metodo: p.pagamento_metodo,
        endereco_entrega: p.endereco_entrega, observacoes: p.observacoes,
      })),
    });
  } catch (error) {
    console.error('getClienteArea:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}