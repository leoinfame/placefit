import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { mapaAprovacoes, aprovadoComo } from '../../shared/aprovacao.ts';

// Duas origens:
// - { origem: 'entidade' } (menu Fabricantes do revendedor, item 005 de 14/10): lista a entidade
//   Fabricante com aprovado=true e ativo=true, com ou sem conta de usuário. Fabricante só é gravável
//   por admin (RLS), então "aprovado" ali é decisão do admin. Cada item vem com:
//     id        = id da entidade Fabricante (SupplierProduct.fabricante_id, AcordoFabricante)
//     user_id   = conta do fabricante, quando existe (SupplierProduct.supplier_id, chat/IA, comissão)
//     empresa   = nome de exibição (nome_fantasia || razao_social)
//     nome_conta= empresa gravada na conta do usuário (compatível com acordos antigos)
// - padrão (sem origem): contas de usuário aprovadas pelo admin (AprovacaoUsuario). Mantido para
//   MyProducts e FabricantesParaFabricantes, que trabalham com o id da conta.

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        let body: any = {};
        try { body = await req.json(); } catch { body = {}; }

        if (body?.origem === 'entidade') {
            const [entidades, usuarios] = await Promise.all([
                base44.asServiceRole.entities.Fabricante.list(),
                base44.asServiceRole.entities.User.filter({ tipo_usuario: 'fabricante' }),
            ]);
            const contaPorId = new Map((usuarios || []).map((u: any) => [u.id, u]));
            const fabricantes = (entidades || [])
                .filter((f: any) => f?.aprovado === true && f?.ativo === true)
                .map((f: any) => {
                    const conta: any = f.user_id ? contaPorId.get(f.user_id) : null;
                    const nome = (f.nome_fantasia || f.razao_social || conta?.empresa || 'Fabricante').trim();
                    return {
                        id: f.id,
                        fabricante_id: f.id,
                        user_id: f.user_id || null,
                        empresa: nome,
                        nome_fantasia: f.nome_fantasia || null,
                        razao_social: f.razao_social || null,
                        nome_conta: conta?.empresa ? String(conta.empresa).trim() : null,
                        full_name: conta?.full_name || null,
                        cnpj: f.cnpj || null,
                        email: f.email || null,
                        whatsapp: f.whatsapp || f.telefone || null,
                        site: f.site || null,
                        endereco: f.endereco || [f.cidade, f.estado].filter(Boolean).join(' - ') || null,
                        cidade: f.cidade || null,
                        estado: f.estado || null,
                        logomarca: f.logomarca || null,
                        historia_empresa: f.historia_empresa || null,
                        formas_pagamento: f.formas_pagamento || f.condicoes_pagamento || null,
                        prazo_entrega: f.prazo_entrega || null,
                        politica_troca: f.politica_troca || null,
                        instrucoes_agente_ia: f.instrucoes_agente_ia || null,
                    };
                })
                .sort((a: any, b: any) => a.empresa.localeCompare(b.empresa, 'pt-BR'));
            return Response.json({ fabricantes, origem: 'entidade' });
        }

        // Origem padrão: contas de usuário aprovadas pelo admin
        const [allUsers, aprovacoes] = await Promise.all([
            base44.asServiceRole.entities.User.list(),
            mapaAprovacoes(base44.asServiceRole),
        ]);
        const fabricantes = allUsers.filter(u => aprovadoComo(aprovacoes, u, 'fabricante'));

        return Response.json({ fabricantes });
    } catch (error) {
        console.error('Erro ao buscar fabricantes:', error);
        return Response.json({
            error: 'Erro ao buscar fabricantes',
            details: error.message
        }, { status: 500 });
    }
});
