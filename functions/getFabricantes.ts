import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verificar se usuário está autenticado
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Usar service role para acessar todos os fabricantes aprovados
        const allUsers = await base44.asServiceRole.entities.User.list();
        const fabricantes = allUsers.filter(u => 
            u.tipo_usuario === 'fabricante' && 
            u.aprovado === true
        );

        return Response.json({ fabricantes });
    } catch (error) {
        console.error('Erro ao buscar fabricantes:', error);
        return Response.json({ 
            error: 'Erro ao buscar fabricantes',
            details: error.message 
        }, { status: 500 });
    }
});