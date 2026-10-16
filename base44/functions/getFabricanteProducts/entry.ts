import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Item 008 (16/10/2026): passa a ler o catalogo padronizado (SupplierProduct + ProductTemplate),
// a mesma fonte do Catalogo Geral e do menu Fabricantes da revenda. Antes lia a entidade antiga Product.
// Aceita fabricante_id como ID da entidade Fabricante OU ID do User vinculado (user_id).
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        let fabricante_id;
        try {
            const body = await req.json();
            fabricante_id = body.fabricante_id;
        } catch {
            const { searchParams } = new URL(req.url);
            fabricante_id = searchParams.get('fabricante_id');
        }
        if (!fabricante_id) {
            return Response.json({ error: 'fabricante_id é obrigatório' }, { status: 400 });
        }

        const sr = base44.asServiceRole.entities;

        // Resolve os dois lados: entidade Fabricante e User vinculado
        const fabIds = new Set<string>([fabricante_id]);
        const userIds = new Set<string>([fabricante_id]);
        try {
            const porId = await sr.Fabricante.filter({ id: fabricante_id });
            for (const f of porId) { fabIds.add(f.id); if (f.user_id) userIds.add(f.user_id); }
            const porUser = await sr.Fabricante.filter({ user_id: fabricante_id });
            for (const f of porUser) { fabIds.add(f.id); }
        } catch (_) { /* segue com o id recebido */ }

        const [spsFab, spsUser] = await Promise.all([
            sr.SupplierProduct.filter({ fabricante_id: { $in: [...fabIds] } }, null, 10000),
            sr.SupplierProduct.filter({ supplier_id: { $in: [...userIds] } }, null, 10000),
        ]);
        const vistos = new Set<string>();
        const sps = [...spsFab, ...spsUser].filter((sp: any) => {
            if (!sp.product_id || vistos.has(sp.product_id)) return false;
            if (sp.disponivel === false || !(Number(sp.preco) > 0)) return false;
            vistos.add(sp.product_id);
            return true;
        });

        const ids = sps.map((sp: any) => sp.product_id);
        const templates = ids.length
            ? await sr.ProductTemplate.filter({ id: { $in: ids }, ativo: true }, 'cod', 10000)
            : [];
        const tById = new Map(templates.map((t: any) => [t.id, t]));

        const products = sps
            .map((sp: any) => {
                const t: any = tById.get(sp.product_id);
                if (!t) return null;
                return {
                    id: t.id,
                    supplier_product_id: sp.id,
                    nome: t.nome,
                    cod: t.cod,
                    categoria: t.categoria,
                    und: t.und,
                    foto: t.foto || '',
                    peso: t.peso_kg ?? null,
                    dimensoes: '',
                    preco_fabricante: Number(sp.preco),
                    cod_origem: sp.cod_origem || null,
                    aprovado_produto: true,
                    ativo: true,
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));

        return Response.json({ products });
    } catch (error) {
        console.error('Erro ao buscar produtos do fabricante:', error);
        return Response.json({
            error: 'Erro ao buscar produtos',
            details: error.message
        }, { status: 500 });
    }
});
