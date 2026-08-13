import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { loadMargemMap, applyMargem } from "../../shared/margem.ts";

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Buscar dados usando service role (sem exigir autenticação)
        const [templates, supplierProducts, allUsers, allFabricantes, margemMaps] = await Promise.all([
            base44.asServiceRole.entities.ProductTemplate.list(),
            base44.asServiceRole.entities.SupplierProduct.list(),
            base44.asServiceRole.entities.User.list(),
            base44.asServiceRole.entities.Fabricante.list(),
            loadMargemMap(base44)
        ]);

        // Fabricantes aprovados da entidade User (com login próprio)
        const fabricanteUsers = allUsers
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

        // IDs de Users fabricantes já incluídos (para evitar duplicação com entidades)
        const fabricanteUserIds = new Set(fabricanteUsers.map(f => f.id));

        // Fabricantes aprovados da entidade Fabricante (gerenciados pelo admin, sem login próprio)
        // Inclui apenas entidades SEM user_id vinculado a um User fabricante já listado
        const fabricanteEntities = allFabricantes
            .filter(f => f.aprovado === true && f.ativo !== false)
            .filter(f => !f.user_id || !fabricanteUserIds.has(f.user_id))
            .map(f => ({
                id: f.id,
                full_name: f.nome_fantasia || f.razao_social,
                empresa: f.nome_fantasia || f.razao_social,
                logomarca: f.logomarca,
                whatsapp: f.whatsapp,
                email: f.email,
                site: f.site,
                endereco: f.endereco,
                cidade: f.cidade,
                estado: f.estado
            }));

        const fabricantes = [...fabricanteUsers, ...fabricanteEntities];

        // IDs de entidades fabricantes aprovadas
        const fabricanteEntityIds = new Set(fabricanteEntities.map(f => f.id));

        // Templates ativos
        const activeTemplates = templates.filter(t => t.ativo !== false);

        // SupplierProducts de fabricantes aprovados, com preço e disponíveis
        // Aceita SPs vinculados a um User fabricante (supplier_id) ou a uma entidade Fabricante (fabricante_id)
        // Aplica a margem da PlaceFit quando o acordo do fabricante é do tipo "margem"
        const validSupplierProducts = supplierProducts
          .filter(sp => {
              if (sp.disponivel === false) return false;
              if (!sp.preco || sp.preco <= 0) return false;
              const hasUser = sp.supplier_id && fabricanteUserIds.has(sp.supplier_id);
              const hasEntity = sp.fabricante_id && fabricanteEntityIds.has(sp.fabricante_id);
              if (!hasUser && !hasEntity) return false;
              return true;
          })
          .map(sp => ({
              ...sp,
              preco: applyMargem(sp.preco, margemMaps, sp.fabricante_id, sp.supplier_id),
          }));

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
                subcategoria: t.subcategoria,
                tipo_anilha: t.tipo_anilha,
                tipo_furo: t.tipo_furo,
                acabamento: t.acabamento,
                pegada: t.pegada,
                barra_acabamento: t.barra_acabamento,
                bojo_formato: t.bojo_formato,
                dumbell_tipo: t.dumbell_tipo,
                piso_formato: t.piso_formato,
                tijolinho_tipo: t.tijolinho_tipo,
                suporte_modelo: t.suporte_modelo,
                suporte_para: t.suporte_para,
                descricao_padrao: t.descricao_padrao,
                peso_faixa: t.peso_faixa,
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