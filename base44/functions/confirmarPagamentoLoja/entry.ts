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
    const { loja_pedido_id } = body;

    if (!loja_pedido_id) return Response.json({ error: 'loja_pedido_id obrigatorio' }, { status: 400 });

    const loja = await base44.asServiceRole.entities.LojaPedido.get(loja_pedido_id).catch(() => null);
    if (!loja) return Response.json({ error: 'Pedido da loja nao encontrado' }, { status: 404 });
    if (loja.pagamento_status === 'pago') return Response.json({ error: 'Pagamento ja confirmado' }, { status: 400 });

    // 1. Marcar pedido da loja como pago
    await base44.asServiceRole.entities.LojaPedido.update(loja_pedido_id, {
      status: 'pago',
      pagamento_status: 'pago',
    });

    // 2. Converter o Pedido interno (orcamento) em venda
    const pedidoInternoId = loja.pedido_interno_id;
    if (pedidoInternoId) {
      await base44.asServiceRole.entities.Pedido.update(pedidoInternoId, {
        tipo: 'venda',
        status: 'confirmado',
      });
    }

    // 3. Criar pedidos de compra por fabricante (preco de fabrica)
    const itens = loja.itens || [];
    const spIds = itens.map((i) => i.sp_id).filter(Boolean);
    const sps = spIds.length
      ? await fetchAll((sort, limit, skip) =>
          base44.asServiceRole.entities.SupplierProduct.filter({ id: { $in: spIds } }, sort, limit, skip)
        )
      : [];
    const spById = {};
    for (const sp of sps) spById[sp.id] = sp;

    const byFab = {};
    for (const it of itens) {
      const sp = spById[it.sp_id];
      if (!sp || !sp.fabricante_id) continue; // sem fabricante vinculado: nao gera pedido de compra
      const fabId = sp.fabricante_id;
      if (!byFab[fabId]) byFab[fabId] = { fabricante_id: fabId, fabricante_nome: sp.fabricante_nome || '', itens: [], total: 0 };
      const factoryPrice = Number(sp.preco) || 0;
      const qty = Number(it.quantidade) || 0;
      const line = Math.round(factoryPrice * qty * 100) / 100;
      byFab[fabId].itens.push({
        product_id: it.product_id, cod: it.cod, nome: it.nome,
        quantidade: qty, preco_unitario: factoryPrice, subtotal: line,
      });
      byFab[fabId].total = Math.round((byFab[fabId].total + line) * 100) / 100;
    }

    // Nome do revendedor para os pedidos de compra
    let revendedorNome = '';
    try {
      const u = await base44.asServiceRole.entities.User.get(loja.revendedor_id);
      revendedorNome = u?.empresa || u?.full_name || '';
    } catch (e) { /* ignora */ }

    const today = new Date().toISOString().slice(0, 10);
    const pedidosCompraIds = [];
    for (const fabId of Object.keys(byFab)) {
      const g = byFab[fabId];
      const pc = await base44.asServiceRole.entities.PedidoCompra.create({
        revendedor_id: loja.revendedor_id,
        revendedor_nome: revendedorNome,
        fabricante_id: g.fabricante_id,
        fabricante_nome: g.fabricante_nome,
        venda_id: pedidoInternoId || loja_pedido_id,
        numero_pedido: 'PC-' + Date.now().toString().slice(-8) + '-' + fabId.slice(-4),
        data_pedido: today,
        itens: g.itens,
        total: g.total,
        status: 'pendente',
        observacoes: 'Gerado automaticamente do pedido da loja ' + loja.numero_pedido,
      });
      pedidosCompraIds.push(pc.id);
    }

    // 4. Vincular os pedidos de compra ao pedido da loja
    await base44.asServiceRole.entities.LojaPedido.update(loja_pedido_id, {
      pedidos_compra_ids: pedidosCompraIds,
    });

    return Response.json({
      ok: true,
      pedido_interno_id: pedidoInternoId,
      pedidos_compra_ids: pedidosCompraIds,
      total_pedidos_compra: pedidosCompraIds.length,
    });
  } catch (error) {
    console.error('confirmarPagamentoLoja:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}