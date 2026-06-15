import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Buscar todos os dados usando service role (sem exigir autenticação)
        const [allProducts, allUsers] = await Promise.all([
            base44.asServiceRole.entities.Product.list(),
            base44.asServiceRole.entities.User.list()
        ]);

        // Filtrar apenas fabricantes aprovados
        const fabricantes = allUsers
            .filter(u => u.aprovado === true && u.role === 'user' && u.tipo_usuario === 'fabricante')
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

        // Fabricante IDs aprovados para filtrar produtos
        const fabricanteIds = new Set(fabricantes.map(f => f.id));

        // Produtos ativos e aprovados de fabricantes
        const activeProducts = allProducts.filter(p => {
            if (p.ativo === false) return false;
            if (p.fabricante_id) return p.aprovado_produto === true;
            return true;
        });

        return Response.json({ products: activeProducts, fabricantes });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        return Response.json({ 
            error: 'Erro ao buscar produtos',
            details: error.message 
        }, { status: 500 });
    }
});