import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Buscar apenas produtos que começam com 'Suporte'
    const products = await base44.asServiceRole.entities.Product.list();
    const toUpdate = products.filter(p => p.nome?.trim().startsWith('Suporte'));

    if (toUpdate.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }

    // Atualizar em pequenos lotes com delay
    let count = 0;
    for (let i = 0; i < toUpdate.length; i += 3) {
      const batch = toUpdate.slice(i, i + 3);
      await Promise.all(
        batch.map(p => base44.asServiceRole.entities.Product.update(p.id, { categoria: 'Suportes' }))
      );
      count += batch.length;
      await new Promise(r => setTimeout(r, 200));
    }

    return Response.json({ success: true, updated: count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});