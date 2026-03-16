import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admin pode executar
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem executar esta ação' }, { status: 403 });
    }

    let allProducts = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    // Buscar todos os produtos paginados
    while (hasMore) {
      const batch = await base44.asServiceRole.entities.Product.list();
      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        allProducts = allProducts.concat(batch);
        offset += limit;
      }
    }
    
    // Filtrar produtos que começam com 'Suporte'
    const productsToUpdate = allProducts.filter(p => 
      p.nome && p.nome.trim().startsWith('Suporte')
    );

    if (productsToUpdate.length === 0) {
      return Response.json({ 
        success: true,
        message: 'Nenhum produto encontrado começando com "Suporte"',
        updated: 0
      });
    }

    // Atualizar cada produto com delay para evitar rate limit
    let updated = 0;
    for (const product of productsToUpdate) {
      try {
        await base44.asServiceRole.entities.Product.update(product.id, {
          categoria: 'Suportes'
        });
        updated++;
        // Pequeno delay entre atualizações
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Erro ao atualizar ${product.id}:`, err);
      }
    }

    return Response.json({
      success: true,
      message: `${updated} de ${productsToUpdate.length} produto(s) atualizado(s)`,
      updated: updated,
      total: productsToUpdate.length
    });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ 
      error: error.message || 'Erro ao atualizar produtos' 
    }, { status: 500 });
  }
});