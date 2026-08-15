import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { computeStorePrice } from "../../shared/loja.ts";
import { computeFreteLoja } from "../../shared/freteLoja.ts";

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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { slug, cliente_id, token, itens, endereco, pagamento_metodo, frete, observacoes } = body;

    if (!slug) return Response.json({ error: 'slug obrigatorio' }, { status: 400 });
    if (!cliente_id || !token) return Response.json({ error: 'Voce precisa estar logado para comprar. Faca login na sua conta.' }, { status: 401 });
    if (!Array.isArray(itens) || itens.length === 0) return Response.json({ error: 'Carrinho vazio' }, { status: 400 });

    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ slug });
    const config = configs[0];
    if (!config || !config.ativo) return Response.json({ error: 'Loja nao encontrada ou inativa' }, { status: 404 });

    // Validar sessao do cliente
    const cliente = await base44.asServiceRole.entities.LojaCliente.get(cliente_id).catch(() => null);
    if (!cliente) return Response.json({ error: 'Cliente nao encontrado' }, { status: 404 });
    if (cliente.token !== token) return Response.json({ error: 'Sessao expirada. Faca login novamente.' }, { status: 401 });
    if (cliente.revendedor_id !== config.revendedor_id) return Response.json({ error: 'Cliente nao pertence a esta loja' }, { status: 403 });

    // Validar itens e precos contra os SupplierProducts reais do revendedor
    const sps = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: config.revendedor_id }, sort, limit, skip)
    );
    const spById = {};
    for (const sp of sps) spById[sp.id] = sp;
    const tplIds = [...new Set(Object.values(spById).map(sp => sp.product_id).filter(Boolean))];
    const templates = tplIds.length > 0
      ? await fetchAll((sort, limit, skip) =>
          base44.asServiceRole.entities.ProductTemplate.filter({ id: { $in: tplIds } }, sort, limit, skip)
        )
      : [];
    const tplById = {}; for (const t of templates) tplById[t.id] = t;

    const orderItens = [];
    let subtotal = 0;
    let pesoTotal = 0;
    for (const it of itens) {
      const sp = spById[it.sp_id];
      if (!sp) continue;
      const t = tplById[sp.product_id];
      if (!t) continue;
      const price = computeStorePrice(sp);
      const qty = Number(it.quantidade) || 0;
      if (qty <= 0) continue;
      const line = Math.round(price * qty * 100) / 100;
      subtotal += line;
      pesoTotal += (Number(t.peso_kg) || 0) * qty;
      orderItens.push({
        sp_id: sp.id, product_id: sp.product_id, nome: t.nome, cod: t.cod, und: t.und,
        quantidade: qty, preco_unitario: price, subtotal: line,
      });
    }
    if (orderItens.length === 0) return Response.json({ error: 'Itens invalidos' }, { status: 400 });

    // Frete recalculado server-side pela tabela MuscularFit (estado + peso). Sem frete gratis.
    const freteVal = computeFreteLoja(endereco?.estado, pesoTotal, endereco?.cidade);
    if (freteVal == null) return Response.json({ error: 'Frete nao disponivel para o estado informado. Contate o revendedor.' }, { status: 400 });
    const total = Math.round((subtotal + freteVal) * 100) / 100;

    // Atualizar endereco do cliente a partir do checkout
    const clienteId = cliente.id;
    await base44.asServiceRole.entities.LojaCliente.update(clienteId, {
      cpf: cliente.cpf, telefone: cliente.telefone,
      cep: endereco?.cep, endereco: endereco?.logradouro, numero: endereco?.numero,
      complemento: endereco?.complemento, bairro: endereco?.bairro, cidade: endereco?.cidade, estado: endereco?.estado,
    });

    // Sincronizar os dados no cadastro de "Meus Clientes" (entidade Cliente) espelhado do cliente da loja
    try {
      const clienteInternoId = cliente.cliente_interno_id;
      if (clienteInternoId) {
        const enderecoCompleto = [endereco?.logradouro, endereco?.numero, endereco?.bairro].filter(Boolean).join(', ');
        await base44.asServiceRole.entities.Cliente.update(clienteInternoId, {
          cpf_cnpj: cliente.cpf || '',
          telefone: cliente.telefone || '',
          cep: endereco?.cep || '',
          endereco: enderecoCompleto,
          cidade: endereco?.cidade || '',
          estado: endereco?.estado || '',
        });
      }
    } catch (e) {
      console.error('Erro ao sincronizar cliente em Meus Clientes:', e);
    }

    const numero_pedido = 'LOJA-' + Date.now().toString().slice(-8);
    const pedido = await base44.asServiceRole.entities.LojaPedido.create({
      revendedor_id: config.revendedor_id,
      numero_pedido,
      cliente_id: clienteId,
      cliente_nome: cliente.nome,
      cliente_email: cliente.email,
      cliente_telefone: cliente.telefone,
      cliente_cpf: cliente.cpf,
      itens: orderItens,
      subtotal,
      frete: freteVal,
      total,
      status: 'pendente',
      pagamento_metodo: pagamento_metodo || 'pix',
      pagamento_status: 'pendente',
      endereco_entrega: endereco || {},
      observacoes: observacoes || '',
    });

    // Gerar o orcamento interno (Pedido tipo=orcamento) para o revendedor
    let pedidoInternoId = null;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const itensPedido = orderItens.map((it) => ({
        product_id: it.product_id, cod: it.cod, nome: it.nome,
        quantidade: it.quantidade, preco_unitario: it.preco_unitario, subtotal: it.subtotal,
      }));
      const pedidoInterno = await base44.asServiceRole.entities.Pedido.create({
        fornecedor_id: config.revendedor_id,
        cliente_id: clienteId,
        cliente_nome: cliente.nome,
        numero_pedido,
        data_pedido: today,
        tipo: 'orcamento',
        itens: itensPedido,
        subtotal,
        frete: freteVal,
        total,
        status: 'pendente',
        observacoes: 'Pedido via loja online ' + numero_pedido,
      });
      pedidoInternoId = pedidoInterno.id;
      await base44.asServiceRole.entities.LojaPedido.update(pedido.id, { pedido_interno_id: pedidoInternoId });
    } catch (e) {
      console.error('Erro ao gerar orcamento interno:', e);
    }

    return Response.json({ pedido_id: pedido.id, numero_pedido, total, pedido_interno_id: pedidoInternoId });
  } catch (error) {
    console.error('createStoreOrder:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}