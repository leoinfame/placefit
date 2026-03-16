import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admin pode executar
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores podem executar esta ação' }, { status: 403 });
    }

    // Buscar todos os produtos
    const allProducts = await base44.asServiceRole.entities.Product.list();
    
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

    // Atualizar produtos em lotes de 10
    const batchSize = 10;
    for (let i = 0; i < productsToUpdate.length; i += batchSize) {
      const batch = productsToUpdate.slice(i, i + batchSize);
      const updatePromises = batch.map(product => 
        base44.asServiceRole.entities.Product.update(product.id, {
          categoria: 'Suportes'
        })
      );
      await Promise.all(updatePromises);
    }

    return Response.json({
      success: true,
      message: `${productsToUpdate.length} produto(s) atualizado(s) com sucesso`,
      updated: productsToUpdate.length,
      products: productsToUpdate.map(p => ({ id: p.id, nome: p.nome }))
    });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ 
      error: error.message || 'Erro ao atualizar produtos' 
    }, { status: 500 });
  }
});