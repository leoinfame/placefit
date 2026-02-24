import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verificar se usuário está autenticado
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Pegar fabricante_id dos parâmetros
        const { searchParams } = new URL(req.url);
        const fabricante_id = searchParams.get('fabricante_id');

        if (!fabricante_id) {
            return Response.json({ error: 'fabricante_id é obrigatório' }, { status: 400 });
        }

        // Usar service role para buscar produtos aprovados do fabricante
        const allProducts = await base44.asServiceRole.entities.Product.list();
        const products = allProducts.filter(p => 
            p.fabricante_id === fabricante_id && 
            p.aprovado_produto === true &&
            p.ativo !== false
        );

        return Response.json({ products });
    } catch (error) {
        console.error('Erro ao buscar produtos do fabricante:', error);
        return Response.json({ 
            error: 'Erro ao buscar produtos',
            details: error.message 
        }, { status: 500 });
    }
});