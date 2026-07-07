import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    // Determinar tipo de usuário (frontend envia isFabricante no body)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const isFabricante = user.tipo_usuario === 'fabricante' || body.isFabricante === true;

    // Helper de paginação interna
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

    // 1. Buscar todos os templates ativos (projeção compacta)
    let allTemplates = [];
    {
      let skip = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }, 'cod', 500, skip);
        allTemplates = allTemplates.concat(batch);
        if (batch.length < 500) break;
        skip += 500;
      }
    }

    // 2. Buscar SupplierProducts do usuário atual
    let mySps = [];
    {
      let skip = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id }, '-created_date', 500, skip);
        mySps = mySps.concat(batch);
        if (batch.length < 500) break;
        skip += 500;
      }
    }

    // 3. Buscar fabricantes para construir pricesByProduct
    const fabricantes = await base44.asServiceRole.entities.User.filter({ tipo_usuario: 'fabricante' });
    const fabNameById = {};
    const fabIds = new Set();
    for (const u of fabricantes) {
      fabNameById[u.id] = u.empresa || u.full_name || 'Fabricante';
      fabIds.add(u.id);
    }

    // 4. Buscar TODOS os SupplierProducts para preços de fabricantes
    let allSps = [];
    {
      let skip = 0;
      while (true) {
        const batch = await base44.asServiceRole.entities.SupplierProduct.list('-created_date', 500, skip);
        allSps = allSps.concat(batch);
        if (batch.length < 500) break;
        skip += 500;
      }
    }

    // Construir pricesByProduct (preços de fabricantes por product_id)
    const pricesByProduct = {};
    for (const sp of allSps) {
      if (!fabIds.has(sp.supplier_id)) continue;
      if (!sp.preco || sp.preco <= 0) continue;
      if (!pricesByProduct[sp.product_id]) pricesByProduct[sp.product_id] = [];
      pricesByProduct[sp.product_id].push({
        preco: sp.preco,
        fabricante_nome: fabNameById[sp.supplier_id] || 'Fabricante',
      });
    }

    // Projeção compacta de templates — apenas campos usados pelo frontend
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
    const templatesCompact = allTemplates.map(t => {
      const out = {};
      for (const f of TEMPLATE_FIELDS) out[f] = t[f];
      return out;
    });

    // Projeção compacta de mySps — apenas campos usados
    const SP_FIELDS = ['id', 'product_id', 'preco', 'margem', 'fabricante_nome', 'disponivel', 'supplier_id', 'sale_price', 'cod_origem', 'observacoes'];
    const mySpsCompact = mySps.map(sp => {
      const out = {};
      for (const f of SP_FIELDS) out[f] = sp[f];
      return out;
    });

    return Response.json({
      templates: templatesCompact,
      mySupplierProducts: mySpsCompact,
      pricesByProduct,
      totalTemplates: allTemplates.length,
      totalSupplierProducts: allSps.length,
      totalFabricantes: fabricantes.length,
    });
  } catch (error) {
    console.error('Erro getProdutosData:', error);
    return Response.json({ error: error.message, templates: [], mySupplierProducts: [], pricesByProduct: {} }, { status: 500 });
  }
});