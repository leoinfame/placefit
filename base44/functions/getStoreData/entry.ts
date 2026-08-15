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

    const preview = !!body.preview;
    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ slug });
    const config = configs[0];
    if (!config || (!config.ativo && !preview)) return Response.json({ error: 'Loja nao encontrada ou inativa' }, { status: 404 });

    let revendedor = null;
    try { revendedor = await base44.asServiceRole.entities.User.get(config.revendedor_id); } catch (e) {}

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

    const baseName = (nome) => (nome || '').replace(/\s+\d+([.,]\d+)?\s*kg$/i, '').trim();
    const groupKey = (t) => [baseName(t.nome), t.categoria, t.subcategoria, t.tipo_anilha, t.tipo_furo, t.acabamento, t.pegada, t.barra_acabamento, t.bojo_formato, t.dumbell_tipo, t.piso_formato, t.tijolinho_tipo].map(v => v ?? '').join('|');

    const items = available.map(sp => {
      const t = tplById[sp.product_id];
      if (!t || t.ativo === false) return null;
      const price = computeStorePrice(sp);
      if (!price || price <= 0) return null;
      return { sp_id: sp.id, product_id: sp.product_id, t, price, cod_origem: sp.cod_origem };
    }).filter(Boolean);

    const gmap = new Map();
    for (const it of items) {
      const key = groupKey(it.t);
      if (!gmap.has(key)) gmap.set(key, { id: key, nome: baseName(it.t.nome), categoria: it.t.categoria, subcategoria: it.t.subcategoria, foto: it.t.foto, und: it.t.und, descricao: it.t.descricao_padrao, variacoes: [] });
      gmap.get(key).variacoes.push({ sp_id: it.sp_id, product_id: it.product_id, peso_kg: it.t.peso_kg, preco: it.price, nome: it.t.nome, cod: it.t.cod, cod_origem: it.cod_origem });
    }
    const products = [...gmap.values()].map(g => {
      g.variacoes.sort((a, b) => (a.peso_kg || 0) - (b.peso_kg || 0));
      const WEIGHT_CATEGORIES = ["Anilhas", "Halteres", "Dumbells", "Kettlebells"];
      const isWeightCategory = WEIGHT_CATEGORIES.includes(g.categoria);
      const withWeight = isWeightCategory ? g.variacoes.filter(v => v.peso_kg > 0) : [];
      if (withWeight.length > 0) {
        g.tem_pesos = true;
        g.preco_por_kg = Math.min(...withWeight.map(v => v.preco / v.peso_kg));
      } else {
        g.tem_pesos = false;
        g.preco = g.variacoes[0].preco;
      }
      return g;
    });

    return Response.json({
      config: {
        nome_loja: config.nome_loja,
        logo_url: revendedor?.logomarca || config.logo_url || '',
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
        whatsapp_contato: revendedor?.whatsapp || config.whatsapp_contato || '',
        slug: config.slug,
      },
      products,
    });
  } catch (error) {
    console.error('getStoreData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}