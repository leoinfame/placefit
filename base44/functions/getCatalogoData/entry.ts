import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    // Buscar SupplierProducts primeiro (public read - funciona para qualquer usuário)
    const allSps = await base44.entities.SupplierProduct.list('-created_date', 2000);

    // Tentar buscar fabricantes via service role (pode falhar para não-admins)
    let fabIds = new Set();
    let fabNameById = {};
    try {
      const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const fabricantes = allUsers.filter(u => u.tipo_usuario === 'fabricante');
      fabIds = new Set(fabricantes.map(u => u.id));
      for (const u of fabricantes) {
        fabNameById[u.id] = u.empresa || u.full_name || 'Fabricante';
      }
    } catch (e) {
      // Fallback: usar fabricante_nome do próprio SupplierProduct
      console.log('User list failed, using fabricante_nome fallback:', e.message);
    }

    // Agrupar preços de fabricantes por product_id
    const pricesByProduct = {};
    for (const sp of allSps) {
      if (!sp.preco || sp.preco <= 0) continue;

      // Determinar se é fabricante: pelo User list OU pelo campo fabricante_nome
      let isFabricante = false;
      let fabName = sp.fabricante_nome || 'Fabricante';

      if (fabIds.has(sp.supplier_id)) {
        isFabricante = true;
        fabName = fabNameById[sp.supplier_id] || sp.fabricante_nome || 'Fabricante';
      } else if (sp.fabricante_nome && sp.fabricante_nome.trim() !== '') {
        // Fallback: se fabricante_nome está preenchido, incluir
        isFabricante = true;
      }

      if (!isFabricante) continue;

      if (!pricesByProduct[sp.product_id]) pricesByProduct[sp.product_id] = [];
      pricesByProduct[sp.product_id].push({
        id: sp.id,
        supplier_id: sp.supplier_id,
        preco: sp.preco,
        fabricante_nome: fabName,
      });
    }

    return Response.json({ pricesByProduct });
  } catch (error) {
    console.error('Erro getCatalogoData:', error);
    return Response.json({ error: error.message, pricesByProduct: {} }, { status: 500 });
  }
});