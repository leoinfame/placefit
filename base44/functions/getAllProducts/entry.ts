import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Buscar todos os dados usando service role (sem exigir autenticação)
        const [allProducts, allSupplierProducts, allUsers] = await Promise.all([
            base44.asServiceRole.entities.Product.list(),
            base44.asServiceRole.entities.SupplierProduct.list(),
            base44.asServiceRole.entities.User.list()
        ]);

        // Filtrar apenas revendedores aprovados (sem expor dados sensíveis)
        const suppliers = allUsers
            .filter(u => u.aprovado === true && u.role === 'user' && (!u.tipo_usuario || (u.tipo_usuario !== 'fabricante' && u.tipo_usuario !== 'transportador')))
            .map(u => ({
                id: u.id,
                full_name: u.full_name,
                empresa: u.empresa,
                logomarca: u.logomarca,
                whatsapp: u.whatsapp,
                email: u.email,
                site: u.site,
                endereco: u.endereco,
                cidade: u.cidade,
                estado: u.estado
            }));

        return Response.json({ products: allProducts, supplierProducts: allSupplierProducts, suppliers });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        return Response.json({ 
            error: 'Erro ao buscar produtos',
            details: error.message 
        }, { status: 500 });
    }
});