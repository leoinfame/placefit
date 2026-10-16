import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Item 005 (aprovado pelo Sr. Leo em 14/10 16:18; executado em 16/10/2026):
// a lista de fabricantes passa a vir da ENTIDADE Fabricante (aprovado=true e ativo=true),
// e nao mais da entidade User. Fabricante aprovado aparece MESMO SEM conta de usuario.
// Fabricante de teste (aprovado=false) nao aparece, mesmo que o User dele esteja aprovado.
// Saida normalizada para as telas: id = ID da entidade Fabricante; empresa/full_name = nome comercial.
// legacy_id = user_id (quando existir) para manter dados antigos gravados com o ID do usuario
// (acordos de comissao, base de conhecimento e historico do agente).
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const lista = await base44.asServiceRole.entities.Fabricante.filter(
            { aprovado: true, ativo: true }, 'nome_fantasia', 5000
        );

        const fabricantes = lista.map((f: any) => {
            const nome = (f.nome_fantasia || f.razao_social || '').trim();
            return {
                id: f.id,
                fabricante_id: f.id,
                user_id: f.user_id || null,
                legacy_id: f.user_id || f.id,
                empresa: nome,
                full_name: nome,
                nome_fantasia: f.nome_fantasia || '',
                razao_social: f.razao_social || '',
                cnpj: f.cnpj || '',
                email: f.email || '',
                whatsapp: f.whatsapp || '',
                telefone: f.telefone || '',
                site: f.site || '',
                endereco: f.endereco || '',
                cidade: f.cidade || '',
                estado: f.estado || '',
                logomarca: f.logomarca || '',
                historia_empresa: f.historia_empresa || '',
                formas_pagamento: f.formas_pagamento || '',
                condicoes_pagamento: f.condicoes_pagamento || '',
                prazo_entrega: f.prazo_entrega || '',
                prazo_producao: f.prazo_producao || '',
                informacoes_frete: f.informacoes_frete || '',
                politica_troca: f.politica_troca || '',
                instrucoes_agente_ia: f.instrucoes_agente_ia || '',
                tipo_usuario: 'fabricante',
                aprovado: true,
            };
        }).sort((a: any, b: any) => a.empresa.localeCompare(b.empresa, 'pt-BR'));

        return Response.json({ fabricantes });
    } catch (error) {
        console.error('Erro ao buscar fabricantes:', error);
        return Response.json({
            error: 'Erro ao buscar fabricantes',
            details: error.message
        }, { status: 500 });
    }
});
