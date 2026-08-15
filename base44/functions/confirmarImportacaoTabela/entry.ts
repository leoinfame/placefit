import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Aplica as decisões conferidas pelo usuário na importação de tabela de preços.
 *
 * Serve aos dois caminhos de importação (CSV direto e leitura por IA): ambos
 * produzem um plano, o usuário confere, e só aqui alguma coisa é gravada.
 *
 * Entrada: { decisoes: [{ product_id, preco, tipo_preco, disponivel,
 *                         cod_origem, descricao_origem, origem_match,
 *                         salvar_mapeamento }] }
 *
 * Além de gravar o preço, registra o de-para (SupplierSkuMap) de cada linha
 * conferida — é isso que faz a próxima importação do mesmo fornecedor casar
 * direto, sem adivinhação.
 */

const stripAccents = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

const normalizeCod = (cod: string) =>
  String(cod ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const SINONIMOS: [RegExp, string][] = [
  [/\bbamper\b/g, 'bumper'],
  [/\bhalt\b/g, 'halter'],
  [/\bdumbel{1,2}\b/g, 'dumbbell'],
  [/\bkettle\s*bells?\b/g, 'kettlebell'],
  [/\banilhas\b/g, 'anilha'],
  [/\bolimpico\b/g, 'olimpica'],
];

const normalizeName = (name: string) => {
  let n = stripAccents(String(name ?? '').trim().toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, sub] of SINONIMOS) n = n.replace(re, sub);
  return n;
};

const normalizeNameTokens = (name: string) =>
  normalizeName(name).split(' ').filter((w) => w.length > 1).sort().join(' ');

/** Nome sem o peso — remove o peso do texto ORIGINAL antes de normalizar a pontuação. */
const getBaseKey = (name: string) => {
  if (!name) return '';
  const semPeso = stripAccents(String(name).toLowerCase())
    .replace(/\d+(?:[.,]\d+)?\s*kg\b/g, ' ');
  let n = semPeso.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, sub] of SINONIMOS) n = n.replace(re, sub);
  return n;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const decisoes = Array.isArray(body?.decisoes) ? body.decisoes : [];
    if (decisoes.length === 0) {
      return Response.json({ error: 'Nenhuma decisão enviada.' }, { status: 400 });
    }

    const [templates, existingSps] = await Promise.all([
      base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }),
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id }),
    ]);

    const templateById = new Map(templates.map((t: any) => [t.id, t]));
    const existingByPid = new Map(existingSps.map((sp: any) => [sp.product_id, sp]));

    const findWeightSiblings = (template: any) => {
      if (!template || template.peso_kg == null) return [];
      const baseKey = getBaseKey(template.nome);
      if (!baseKey) return [];
      return templates.filter(
        (t: any) => t.peso_kg != null && t.categoria === template.categoria && getBaseKey(t.nome) === baseKey
      );
    };

    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    const mapsToCreate: any[] = [];
    const processedPids = new Set<string>();
    const ignoradas: any[] = [];
    let variacoes = 0;

    for (const d of decisoes) {
      const tmpl = templateById.get(d?.product_id);
      const preco = Number(d?.preco);

      if (!tmpl) {
        ignoradas.push({ cod_origem: d?.cod_origem, motivo: 'Produto do catálogo não encontrado' });
        continue;
      }
      if (!preco || preco <= 0) {
        ignoradas.push({ cod_origem: d?.cod_origem, motivo: 'Preço inválido' });
        continue;
      }

      // Apenas categorias vendidas por peso usam preço por kg; Pisos, Tijolinhos,
      // Colchonetes, Kits etc. são sempre por unidade, mesmo com peso_kg no template.
      const WEIGHT_CATEGORIES = ['Anilhas', 'Halteres', 'Dumbells', 'Kettlebells'];
      const isWeightCategory = tmpl.categoria && WEIGHT_CATEGORIES.includes(tmpl.categoria);
      const porKg = isWeightCategory && d?.tipo_preco === 'kg';
      const disponivel = d?.disponivel !== false;
      const codOrigem = d?.cod_origem || null;
      const descricaoOrigem = d?.descricao_origem || null;

      const irmas = porKg ? findWeightSiblings(tmpl) : [];
      const variants = porKg && irmas.length > 0 ? irmas : [tmpl];

      for (const variant of variants) {
        if (processedPids.has(variant.id)) continue;
        processedPids.add(variant.id);
        variacoes++;

        const precoVariante = porKg && variant.peso_kg
          ? Math.round(preco * variant.peso_kg * 100) / 100
          : preco;

        const campos: any = { preco: precoVariante, disponivel };
        if (codOrigem) campos.cod_origem = codOrigem;

        const existing = existingByPid.get(variant.id);
        if (existing) toUpdate.push({ id: existing.id, ...campos });
        else toCreate.push({ supplier_id: user.id, product_id: variant.id, ...campos });
      }

      if (d?.salvar_mapeamento !== false) {
        const chaveCod = codOrigem ? normalizeCod(codOrigem) : '';
        const chaveNome = descricaoOrigem ? normalizeNameTokens(descricaoOrigem) : '';
        const base = {
          supplier_id: user.id,
          cod_origem: codOrigem,
          descricao_origem: descricaoOrigem,
          product_id: tmpl.id,
          origem_match: d?.origem_match || 'manual',
          confirmado_por: user.email,
          ativo: true,
        };
        if (chaveCod) mapsToCreate.push({ ...base, chave: chaveCod, tipo_chave: 'codigo' });
        if (chaveNome) mapsToCreate.push({ ...base, chave: chaveNome, tipo_chave: 'nome' });
      }
    }

    if (toCreate.length) await base44.asServiceRole.entities.SupplierProduct.bulkCreate(toCreate);
    if (toUpdate.length) await base44.asServiceRole.entities.SupplierProduct.bulkUpdate(toUpdate);

    // Um de-para por chave: remove os anteriores das mesmas chaves antes de gravar.
    let mapeamentosSalvos = 0;
    if (mapsToCreate.length) {
      const chaves = [...new Set(mapsToCreate.map((m) => m.chave))];
      const antigos = await base44.asServiceRole.entities.SupplierSkuMap.filter({
        supplier_id: user.id,
        chave: { $in: chaves },
      });
      if (antigos.length) {
        await base44.asServiceRole.entities.SupplierSkuMap.deleteMany({
          _id: { $in: antigos.map((m: any) => m.id) },
        });
      }
      await base44.asServiceRole.entities.SupplierSkuMap.bulkCreate(mapsToCreate);
      mapeamentosSalvos = mapsToCreate.length;
    }

    return Response.json({
      success: true,
      criados: toCreate.length,
      atualizados: toUpdate.length,
      variacoes_afetadas: variacoes,
      mapeamentos_salvos: mapeamentosSalvos,
      ignoradas,
    });
  } catch (error) {
    console.error('Erro confirmarImportacaoTabela:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});