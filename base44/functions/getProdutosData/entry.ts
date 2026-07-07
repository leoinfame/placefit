import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const TEMPLATE_FIELDS = [
  'id', 'nome', 'cod', 'categoria', 'subcategoria',
  'tipo_anilha', 'tipo_furo', 'acabamento',
  'barra_tipo', 'barra_acabamento', 'bojo_formato', 'dumbell_tipo',
  'piso_espessura_mm', 'piso_formato', 'tijolinho_tipo', 'tijolinho_torre',
  'suporte_modelo', 'suporte_estrutura', 'suporte_degraus',
  'suporte_capacidade_pares', 'suporte_capacidade_unidades',
  'suporte_torre_capacidade', 'suporte_torre_tipo',
  'pegada', 'peso_faixa', 'peso_kg', 'und', 'foto', 'ativo'
];

const SP_FIELDS = ['id', 'product_id', 'preco', 'margem', 'fabricante_nome', 'disponivel', 'supplier_id', 'sale_price', 'cod_origem', 'observacoes'];

const projectEntity = (entity, fields) => {
  const out = {};
  for (const f of fields) {
    const v = entity[f];
    if (v !== null && v !== undefined) out[f] = v;
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
    const mode = body.mode || 'catalogo'; // 'catalogo' | 'meus'

    // 1. Buscar SupplierProducts do usuário atual (sempre necessário)
    const mySpsRaw = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id }, sort, limit, skip)
    );
    const mySps = mySpsRaw.map(sp => projectEntity(sp, SP_FIELDS));

    // 2. Buscar templates — no modo "meus", buscar apenas os que o usuário tem
    let templates = [];
    if (mode === 'meus') {
      const productIds = [...new Set(mySps.map(sp => sp.product_id))];
      if (productIds.length > 0) {
        const matchingTemplates = await base44.asServiceRole.entities.ProductTemplate.filter({ id: { $in: productIds } });
        templates = matchingTemplates.map(t => projectEntity(t, TEMPLATE_FIELDS));
      }
    } else {
      // Modo catálogo: buscar todos os templates ativos
      const allTemplatesRaw = await fetchAll((sort, limit, skip) =>
        base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }, 'cod', limit, skip)
      );
      templates = allTemplatesRaw.map(t => projectEntity(t, TEMPLATE_FIELDS));
    }

    // 3. pricesByProduct — apenas no modo catálogo
    let pricesByProduct = {};
    if (mode === 'catalogo') {
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

    return Response.json({
      templates,
      mySupplierProducts: mySps,
      pricesByProduct,
      isFabricante,
    });
  } catch (error) {
    console.error('Erro getProdutosData:', error);
    return Response.json({ error: error.message, templates: [], mySupplierProducts: [], pricesByProduct: {} }, { status: 500 });
  }
});