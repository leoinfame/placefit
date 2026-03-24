import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const products = await base44.asServiceRole.entities.Product.list();
    const toUpdate = products.filter(p => p.nome?.trim().startsWith('Suporte'));

    if (toUpdate.length === 0) {
      return Response.json({ success: true, updated: 0 });
    }

    // Atualizar sequencialmente com delay
    let count = 0;
    for (const p of toUpdate) {
      await base44.asServiceRole.entities.Product.update(p.id, { categoria: 'Suportes' });
      count++;
      await new Promise(r => setTimeout(r, 500));
    }

    return Response.json({ success: true, updated: count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});