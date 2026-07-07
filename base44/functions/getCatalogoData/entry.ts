import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    // Buscar apenas fabricantes (muito mais rápido que listar todos os usuários)
    const fabricantes = await base44.asServiceRole.entities.User.filter({ tipo_usuario: 'fabricante' });
    const fabNameById = {};
    for (const u of fabricantes) {
      fabNameById[u.id] = u.empresa || u.full_name || 'Fabricante';
    }
    const fabIds = new Set(Object.keys(fabNameById));

    // Buscar TODOS os SupplierProducts com paginação
    let allSps = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.SupplierProduct.list('-created_date', 500, skip);
      allSps = allSps.concat(batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    // Agrupar preços de fabricantes por product_id
    // Resposta compacta: apenas preco e fabricante_nome (frontend não usa id/supplier_id)
    const pricesByProduct = {};
    for (const sp of allSps) {
      if (!fabIds.has(sp.supplier_id)) continue;
      if (!sp.preco || sp.preco <= 0) continue;
      if (!pricesByProduct[sp.product_id]) pricesByProduct[sp.product_id] = [];
      pricesByProduct[sp.product_id].push({
        preco: sp.preco,
        fabricante_nome: fabNameById[sp.supplier_id] || 'Fabricante',
      });
    }

    return Response.json({ pricesByProduct });
  } catch (error) {
    console.error('Erro getCatalogoData:', error);
    return Response.json({ error: error.message, pricesByProduct: {} }, { status: 500 });
  }
});