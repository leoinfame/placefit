import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verificar se usuário está autenticado
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Buscar todos os usuários usando service role
        // Service role funciona independente de quem está logado
        const allUsers = await base44.asServiceRole.entities.User.list();
        const fabricantes = allUsers.filter(u => {
            // Deve ser aprovado
            if (u.aprovado !== true) return false;
            
            // É fabricante se:
            // 1. Tem tipo_usuario === 'fabricante' OU
            // 2. NÃO é transportador E NÃO é admin E tem empresa preenchida (revendedor ou fabricante sem tipo_usuario definido)
            const isFabricante = u.tipo_usuario === 'fabricante';
            const isTransportador = u.tipo_usuario === 'transportador';
            const isAdmin = u.role === 'admin';
            const hasEmpresa = u.empresa && u.empresa.trim() !== '';
            
            // Se for explicitamente fabricante, retorna
            if (isFabricante) return true;
            
            // Se não é transportador, não é admin, e tem empresa = pode ser fabricante ou revendedor
            // Para diferenciar, consideramos que fabricantes geralmente têm CNPJ formatado
            if (!isTransportador && !isAdmin && hasEmpresa) {
                return true; // Retorna todos que têm empresa e não são transportadores/admins
            }
            
            return false;
        });

        return Response.json({ fabricantes });
    } catch (error) {
        console.error('Erro ao buscar fabricantes:', error);
        return Response.json({ 
            error: 'Erro ao buscar fabricantes',
            details: error.message 
        }, { status: 500 });
    }
});