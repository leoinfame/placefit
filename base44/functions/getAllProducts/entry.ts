import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Buscar todos os dados usando service role (sem exigir autenticação)
        const [allProducts, allSupplierProducts] = await Promise.all([
            base44.asServiceRole.entities.Product.list(),
            base44.asServiceRole.entities.SupplierProduct.list()
        ]);

        return Response.json({ products: allProducts, supplierProducts: allSupplierProducts });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        return Response.json({ 
            error: 'Erro ao buscar produtos',
            details: error.message 
        }, { status: 500 });
    }
});