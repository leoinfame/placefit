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
    const { slug, email, cpf } = body;
    if (!slug || !email) return Response.json({ error: 'slug e email obrigatorios' }, { status: 400 });

    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ slug: String(slug).trim().toLowerCase() });
    const config = configs[0];
    if (!config) return Response.json({ error: 'Loja nao encontrada' }, { status: 404 });

    const revendedor_id = config.revendedor_id;
    const emailNorm = String(email).trim().toLowerCase();

    // Buscar cliente por email
    const clientes = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.LojaCliente.filter({ revendedor_id, email: emailNorm }, sort, limit, skip)
    );
    let cliente = clientes[0] || null;
    if (cliente && cpf) {
      const cpfNorm = String(cpf).replace(/\D/g, '');
      const cpfDb = String(cliente.cpf || '').replace(/\D/g, '');
      if (cpfDb && cpfNorm && cpfDb !== cpfNorm) return Response.json({ error: 'CPF incorreto' }, { status: 403 });
    }

    // Buscar pedidos do cliente
    const pedidos = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.LojaPedido.filter({ revendedor_id, cliente_email: emailNorm }, sort, limit, skip)
    );

    return Response.json({
      cliente: cliente ? {
        id: cliente.id, nome: cliente.nome, email: cliente.email, cpf: cliente.cpf, telefone: cliente.telefone,
        cep: cliente.cep, endereco: cliente.endereco, numero: cliente.numero, complemento: cliente.complemento,
        bairro: cliente.bairro, cidade: cliente.cidade, estado: cliente.estado,
      } : null,
      pedidos: pedidos.map((p) => ({
        id: p.id, numero_pedido: p.numero_pedido, created_date: p.created_date,
        itens: p.itens, total: p.total, status: p.status, pagamento_status: p.pagamento_status,
        pagamento_metodo: p.pagamento_metodo,
      })),
    });
  } catch (error) {
    console.error('getClienteArea:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}