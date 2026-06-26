import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Buscar dados usando service role (sem exigir autenticação)
        const [templates, supplierProducts, allUsers] = await Promise.all([
            base44.asServiceRole.entities.ProductTemplate.list(),
            base44.asServiceRole.entities.SupplierProduct.list(),
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

        // Fabricante IDs aprovados para filtrar SupplierProducts
        const fabricanteIds = new Set(fabricantes.map(f => f.id));

        // Templates ativos
        const activeTemplates = templates.filter(t => t.ativo !== false);

        // SupplierProducts de fabricantes aprovados, com preço e disponíveis
        const validSupplierProducts = supplierProducts.filter(sp => {
            if (sp.disponivel === false) return false;
            if (!fabricanteIds.has(sp.supplier_id)) return false;
            if (!sp.preco || sp.preco <= 0) return false;
            return true;
        });

        // Templates que possuem pelo menos um SupplierProduct válido
        const templatesWithPrices = new Set(validSupplierProducts.map(sp => sp.product_id));

        // Produtos para o marketplace: apenas templates que têm preços
        const products = activeTemplates
            .filter(t => templatesWithPrices.has(t.id))
            .map(t => ({
                id: t.id,
                nome: t.nome,
                cod: t.cod,
                categoria: t.categoria,
                und: t.und,
                peso: t.peso_kg,
                foto: t.foto
            }));

        return Response.json({ products, fabricantes, supplierProducts: validSupplierProducts });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        return Response.json({ 
            error: 'Erro ao buscar produtos',
            details: error.message 
        }, { status: 500 });
    }
});