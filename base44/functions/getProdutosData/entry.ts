import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { loadMargemMap, applyMargem } from "../../shared/margem.ts";

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

// Performance (13/10): busca as páginas em ondas paralelas (4 por vez) em vez de uma após a outra.
// Com ~2.500 templates e ~4.000+ SupplierProducts eram ~15 idas e voltas em sequência.
const PARALLEL_PAGES = 4;
const fetchAll = async (fn, sort = '-created_date', pageSize = 500) => {
  let all = [];
  let skip = 0;
  while (true) {
    const skips = Array.from({ length: PARALLEL_PAGES }, (_, i) => skip + i * pageSize);
    const batches = await Promise.all(skips.map(s => fn(sort, pageSize, s)));
    let done = false;
    for (const batch of batches) {
      all = all.concat(batch);
      if (batch.length < pageSize) { done = true; break; }
    }
    if (done) break;
    skip += PARALLEL_PAGES * pageSize;
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

    // Performance (13/10): os três blocos abaixo são independentes e agora rodam em paralelo.
    // 1. Buscar SupplierProducts do usuário atual
    const loadMySps = async () => {
      const mySpsRaw = await fetchAll((sort, limit, skip) =>
        base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id }, sort, limit, skip)
      );
      return mySpsRaw.map(sp => {
        const out = {};
        for (const f of SP_FIELDS) {
          const v = sp[f];
          if (v !== null && v !== undefined) out[f] = v;
        }
        return out;
      });
    };

    // 2. Buscar templates (no modo "meus" depende dos SupplierProducts do usuário)
    const loadTemplates = async (mySpsPromise) => {
      if (mode === 'meus') {
        const mySps = await mySpsPromise;
        const productIds = [...new Set(mySps.map(sp => sp.product_id))];
        if (productIds.length === 0) return [];
        const matchingTemplates = await fetchAll((sort, limit, skip) =>
          base44.asServiceRole.entities.ProductTemplate.filter({ id: { $in: productIds } }, sort, limit, skip)
        );
        return matchingTemplates.map(t => projectEntityShort(t, TEMPLATE_FIELDS));
      }
      const tplFields = isFabricante ? TEMPLATE_FIELDS_FABRICANTE : TEMPLATE_FIELDS;
      const allTemplatesRaw = await fetchAll((sort, limit, skip) =>
        base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }, 'cod', limit, skip)
      );
      return allTemplatesRaw.map(t => projectEntityShort(t, tplFields));
    };

    // 3. pricesByProduct — apenas para revendedores
    const loadPrices = async () => {
      const pricesByProduct = {};
      if (!(mode === 'catalogo' && !isFabricante)) return pricesByProduct;
      // Carrega fabricantes-usuário (subiram preço com login próprio via supplier_id)
      const [fabricanteUsers, fabricanteEntities, margemMaps, allSpsRaw] = await Promise.all([
        base44.asServiceRole.entities.User.filter({ tipo_usuario: 'fabricante' }),
        base44.asServiceRole.entities.Fabricante.list(),
        loadMargemMap(base44),
        fetchAll((sort, limit, skip) =>
          base44.asServiceRole.entities.SupplierProduct.list(sort, limit, skip)
        ),
      ]);
      const fabNameByUserId = {};
      const fabIds = new Set();
      for (const u of fabricanteUsers) {
        fabNameByUserId[u.id] = u.empresa || u.full_name || 'Fabricante';
        fabIds.add(u.id);
      }
      // Fabricante entity (importadas pelo admin via fabricante_id, sem user_id)
      const fabNameByEntityId = {};
      // 14/10 (item 005): id da entidade Fabricante a partir da conta, para o menu Fabricantes
      // do revendedor casar preços por id (antes era só por nome)
      const entityIdByUserId = {};
      for (const f of fabricanteEntities) {
        fabNameByEntityId[f.id] = f.nome_fantasia || f.razao_social || 'Fabricante';
        if (f.user_id && !entityIdByUserId[f.user_id]) entityIdByUserId[f.user_id] = f.id;
      }

      for (const sp of allSpsRaw) {
        // Resolve o nome do fabricante: supplier_id (user) ou fabricante_id (entidade)
        let fabNome = null;
        if (sp.supplier_id && fabIds.has(sp.supplier_id)) {
          fabNome = fabNameByUserId[sp.supplier_id];
        } else if (sp.fabricante_id && fabNameByEntityId[sp.fabricante_id]) {
          fabNome = fabNameByEntityId[sp.fabricante_id];
        }
        if (!fabNome) continue;
        if (!sp.preco || sp.preco <= 0) continue;
        if (!pricesByProduct[sp.product_id]) pricesByProduct[sp.product_id] = [];
        pricesByProduct[sp.product_id].push({
          preco: applyMargem(sp.preco, margemMaps, sp.fabricante_id, sp.supplier_id),
          fabricante_nome: fabNome,
          fab_id: (sp.fabricante_id && fabNameByEntityId[sp.fabricante_id]) ? sp.fabricante_id : (entityIdByUserId[sp.supplier_id] || null),
          preco_origem: sp.preco,
        });
      }
      return pricesByProduct;
    };

    const mySpsPromise = loadMySps();
    const [mySps, templates, pricesByProduct] = await Promise.all([
      mySpsPromise,
      loadTemplates(mySpsPromise),
      loadPrices(),
    ]);

    return Response.json({
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
