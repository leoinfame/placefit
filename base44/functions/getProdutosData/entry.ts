import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Short field name mapping to reduce response size (~70% smaller payload)
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
const TEMPLATE_FIELDS_FABRICANTE = TEMPLATE_FIELDS.filter(f => f !== 'foto' && f !== 'ativo');

const SP_FIELDS = ['id', 'product_id', 'preco', 'margem', 'fabricante_nome', 'disponivel', 'supplier_id', 'sale_price', 'cod_origem', 'observacoes'];

const projectEntityShort = (entity, fields) => {
  const out = {};
  for (const f of fields) {
    const v = entity[f];
    if (v !== null && v !== undefined) out[FIELD_MAP[f]] = v;
  }
  return out;
};

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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const isFabricante = user.tipo_usuario === 'fabricante' || body.isFabricante === true;
    const mode = body.mode || 'catalogo';

    // 1. Buscar SupplierProducts do usuário atual
    const mySpsRaw = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id }, sort, limit, skip)
    );
    const mySps = mySpsRaw.map(sp => {
      const out = {};
      for (const f of SP_FIELDS) {
        const v = sp[f];
        if (v !== null && v !== undefined) out[f] = v;
      }
      return out;
    });

    // 2. Buscar templates
    let templates = [];
    if (mode === 'meus') {
      const productIds = [...new Set(mySps.map(sp => sp.product_id))];
      if (productIds.length > 0) {
        const matchingTemplates = await fetchAll((sort, limit, skip) =>
          base44.asServiceRole.entities.ProductTemplate.filter({ id: { $in: productIds } }, sort, limit, skip)
        );
        templates = matchingTemplates.map(t => projectEntityShort(t, TEMPLATE_FIELDS));
      }
    } else {
      const tplFields = isFabricante ? TEMPLATE_FIELDS_FABRICANTE : TEMPLATE_FIELDS;
      const allTemplatesRaw = await fetchAll((sort, limit, skip) =>
        base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }, 'cod', limit, skip)
      );
      templates = allTemplatesRaw.map(t => projectEntityShort(t, tplFields));
    }

    // 3. pricesByProduct — apenas para revendedores
    let pricesByProduct = {};
    if (mode === 'catalogo' && !isFabricante) {
      const fabricantes = await base44.asServiceRole.entities.User.filter({ tipo_usuario: 'fabricante' });
      const fabNameById = {};
      const fabIds = new Set();
      for (const u of fabricantes) {
        fabNameById[u.id] = u.empresa || u.full_name || 'Fabricante';
        fabIds.add(u.id);
      }

      const allSpsRaw = await fetchAll((sort, limit, skip) =>
        base44.asServiceRole.entities.SupplierProduct.list(sort, limit, skip)
      );

      for (const sp of allSpsRaw) {
        if (!fabIds.has(sp.supplier_id)) continue;
        if (!sp.preco || sp.preco <= 0) continue;
        if (!pricesByProduct[sp.product_id]) pricesByProduct[sp.product_id] = [];
        pricesByProduct[sp.product_id].push({
          preco: sp.preco,
          fabricante_nome: fabNameById[sp.supplier_id] || 'Fabricante',
        });
      }
    }

    // Debug: count templates and check for KP4
    const kp4Template = templates.find(t => t.c === 'KP4');
    const kp4Sp = mySps.find(sp => sp.product_id === '6a3fd72af902fe48947f7969');

    return Response.json({
      _debug: {
        totalTemplates: templates.length,
        totalSps: mySps.length,
        kp4InTemplates: !!kp4Template,
        kp4InSps: !!kp4Sp,
        kp4TemplateCod: kp4Template?.c || null,
        kp4SpPreco: kp4Sp?.preco || null,
        userId: user.id,
      },
      templates,
      mySupplierProducts: mySps,
      pricesByProduct,
      isFabricante,
      fieldMap: FIELD_MAP,
    });
  } catch (error) {
    console.error('Erro getProdutosData:', error);
    return Response.json({ error: error.message, templates: [], mySupplierProducts: [], pricesByProduct: {} }, { status: 500 });
  }
});