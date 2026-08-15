import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { computeStorePrice } from "../../shared/loja.ts";

const fetchAll = async (fn, sort = '-created_date', pageSize = 500) => {
  let all = []; let skip = 0;
  while (true) {
    const batch = await fn(sort, pageSize, skip);
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const slug = (body.slug || '').trim().toLowerCase();
    if (!slug) return Response.json({ error: 'slug obrigatorio' }, { status: 400 });

    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ slug });
    const config = configs[0];
    if (!config || !config.ativo) return Response.json({ error: 'Loja nao encontrada ou inativa' }, { status: 404 });

    const sps = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: config.revendedor_id }, sort, limit, skip)
    );
    const available = sps.filter(sp => sp.disponivel !== false && sp.product_id);

    const productIds = [...new Set(available.map(sp => sp.product_id))];
    const templates = productIds.length > 0
      ? await fetchAll((sort, limit, skip) =>
          base44.asServiceRole.entities.ProductTemplate.filter({ id: { $in: productIds } }, sort, limit, skip)
        )
      : [];
    const tplById = {};
    for (const t of templates) tplById[t.id] = t;

    const products = available.map(sp => {
      const t = tplById[sp.product_id];
      if (!t || t.ativo === false) return null;
      const price = computeStorePrice(sp);
      if (!price || price <= 0) return null;
      return {
        id: sp.id,
        product_id: sp.product_id,
        nome: t.nome,
        cod: t.cod,
        categoria: t.categoria,
        subcategoria: t.subcategoria,
        foto: t.foto,
        und: t.und,
        peso_kg: t.peso_kg,
        descricao: t.descricao_padrao,
        preco: price,
        cod_origem: sp.cod_origem,
      };
    }).filter(Boolean);

    return Response.json({
      config: {
        nome_loja: config.nome_loja,
        logo_url: config.logo_url,
        banner_url: config.banner_url,
        cor_primaria: config.cor_primaria || '#1e40af',
        cor_secundaria: config.cor_secundaria || '#059669',
        descricao: config.descricao,
        frete_fixo_valor: Number(config.frete_fixo_valor) || 0,
        frete_gratis_valor: Number(config.frete_gratis_valor) || 0,
        aceita_pix: config.aceita_pix !== false,
        aceita_cartao: !!config.aceita_cartao,
        aceita_boleto: !!config.aceita_boleto,
        aceita_dinheiro: !!config.aceita_dinheiro,
        whatsapp_contato: config.whatsapp_contato,
        slug: config.slug,
      },
      products,
    });
  } catch (error) {
    console.error('getStoreData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}