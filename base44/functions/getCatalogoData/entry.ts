import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    // Buscar fabricantes e seus SupplierProducts em paralelo (service role)
    const [allUsers, allSps] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ tipo_usuario: 'fabricante' }),
      base44.asServiceRole.entities.SupplierProduct.list('-created_date', 2000),
    ]);

    const fabIds = new Set(allUsers.map(u => u.id));
    const fabNameById = {};
    for (const u of allUsers) {
      fabNameById[u.id] = u.empresa || u.full_name || 'Fabricante';
    }

    // Agrupar preços de fabricantes por product_id
    const pricesByProduct = {};
    for (const sp of allSps) {
      if (!fabIds.has(sp.supplier_id)) continue;
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
    return Response.json({ error: error.message }, { status: 500 });
  }
});