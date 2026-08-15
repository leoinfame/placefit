import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { cliente_id, cep, endereco, numero, complemento, bairro, cidade, estado } = body;
    if (!cliente_id) return Response.json({ error: 'cliente_id obrigatorio' }, { status: 400 });

    const atualizado = await base44.asServiceRole.entities.LojaCliente.update(cliente_id, {
      cep, endereco, numero, complemento, bairro, cidade, estado,
    });

    return Response.json({ ok: true, cliente: { id: atualizado.id, cep: atualizado.cep, endereco: atualizado.endereco, numero: atualizado.numero, complemento: atualizado.complemento, bairro: atualizado.bairro, cidade: atualizado.cidade, estado: atualizado.estado } });
  } catch (error) {
    console.error('updateClienteEndereco:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}