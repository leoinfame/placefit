import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const fetchAll = async (fn, sort = '-created_date', pageSize = 500) => {
  let all = [];
  let skip = 0;
  while (true) {
    const batch = await fn(sort, pageSize, skip);
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const targetUserId = body.user_id;

    if (!targetUserId) {
      return Response.json({ error: 'user_id required' }, { status: 400 });
    }

    // 1. Buscar SupplierProducts do usuário alvo
    const mySpsRaw = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: targetUserId }, sort, limit, skip)
    );

    // 2. Buscar templates
    const productIds = [...new Set(mySpsRaw.map(sp => sp.product_id))];
    let templates = [];
    if (productIds.length > 0) {
      templates = await fetchAll((sort, limit, skip) =>
        base44.asServiceRole.entities.ProductTemplate.filter({ id: { $in: productIds } }, sort, limit, skip)
      );
    }

    // Verificar KP4
    const kp4Template = templates.find(t => t.cod === 'KP4');
    const kp4Sp = mySpsRaw.find(sp => sp.product_id === '6a3fd72af902fe48947f7969');
    const kp4ProductIdInList = productIds.includes('6a3fd72af902fe48947f7969');

    // Verificar templates sem match (product_id sem template correspondente)
    const templateIds = new Set(templates.map(t => t.id));
    const spsWithoutTemplate = mySpsRaw.filter(sp => !templateIds.has(sp.product_id));

    // Simular exatamente o que getProdutosData retorna
    const FIELD_MAP = {
      id: 'i', nome: 'n', cod: 'c', categoria: 'ca', subcategoria: 'sc',
      tipo_anilha: 'ta', tipo_furo: 'tf', acabamento: 'ac',
      barra_tipo: 'bt', barra_acabamento: 'ba', bojo_formato: 'bf', dumbell_tipo: 'dt',
      piso_espessura_mm: 'pe', piso_formato: 'pf', tijolinho_tipo: 'tt', tijolinho_torre: 'tl',
      suporte_modelo: 'sm', suporte_estrutura: 'se', suporte_degraus: 'sd',
      suporte_capacidade_pares: 'scp', suporte_capacidade_unidades: 'scu',
      suporte_torre_capacidade: 'stc', suporte_torre_tipo: 'stt',
      pegada: 'pg', peso_faixa: 'pfa', peso_kg: 'pk', und: 'u', foto: 'f', ativo: 'at'
    };
    const TEMPLATE_FIELDS = Object.keys(FIELD_MAP);
    const projectEntityShort = (entity, fields) => {
      const out = {};
      for (const f of fields) {
        const v = entity[f];
        if (v !== null && v !== undefined) out[FIELD_MAP[f]] = v;
      }
      return out;
    };
    const shortTemplates = templates.map(t => projectEntityShort(t, TEMPLATE_FIELDS));
    const kp4Short = shortTemplates.find(t => t.c === 'KP4');

    return Response.json({
      targetUserId,
      spCount: mySpsRaw.length,
      templateCount: shortTemplates.length,
      kp4Found: !!kp4Short,
      kp4Data: kp4Short,
      templates: shortTemplates,
      mySupplierProducts: mySpsRaw.map(sp => ({
        id: sp.id, product_id: sp.product_id, preco: sp.preco,
        fabricante_nome: sp.fabricante_nome, supplier_id: sp.supplier_id
      })),
      fieldMap: FIELD_MAP,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});