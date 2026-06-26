import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    // Buscar fabricantes (service role)
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);

    // Buscar TODOS os SupplierProducts com paginação (pode haver milhares)
    let allSps = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.SupplierProduct.list('-created_date', 500, skip);
      allSps = allSps.concat(batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    // Filtrar fabricantes manualmente (mais robusto que filter por campo customizado)
    const fabricantes = allUsers.filter(u => u.tipo_usuario === 'fabricante');
    const fabIds = new Set(fabricantes.map(u => u.id));
    const fabNameById = {};
    for (const u of fabricantes) {
      fabNameById[u.id] = u.empresa || u.full_name || 'Fabricante';
    }

    // Agrupar preços de fabricantes por product_id
    const pricesByProduct = {};
    for (const sp of allSps) {
      if (!fabIds.has(sp.supplier_id)) continue;
      if (!sp.preco || sp.preco <= 0) continue;
      if (!pricesByProduct[sp.product_id]) pricesByProduct[sp.product_id] = [];
      pricesByProduct[sp.product_id].push({
        id: sp.id,
        supplier_id: sp.supplier_id,
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