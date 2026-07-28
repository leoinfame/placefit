import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * ANÁLISE de tabela de preços em formato livre (PDF, Excel, JSON, CSV) via IA.
 * Não grava nada — devolve um plano para conferência, igual ao caminho do CSV.
 *
 * O de-para do fornecedor (SupplierSkuMap) tem precedência sobre a sugestão da
 * IA: se aquele código já foi resolvido antes, não se pergunta de novo.
 *
 * A gravação acontece em confirmarImportacaoTabela.
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

/** Peso extraído do texto ORIGINAL, antes de normalizar pontuação. */
const extractWeight = (text: string): number | null => {
  if (!text) return null;
  const m = stripAccents(String(text).toLowerCase()).match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
};

/** Nome sem o peso, para agrupar variações irmãs. */
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

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    const [templates, skuMaps, existingSps] = await Promise.all([
      base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }),
      base44.asServiceRole.entities.SupplierSkuMap.filter({ supplier_id: user.id, ativo: true }),
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id }),
    ]);

    const templateById = new Map(templates.map((t: any) => [t.id, t]));
    const templateByCod = new Map<string, any>();
    for (const t of templates) {
      const c = normalizeCod(t.cod);
      if (c && !templateByCod.has(c)) templateByCod.set(c, t);
    }

    const existingByPid = new Map(existingSps.map((sp: any) => [sp.product_id, sp]));
    const mapByChave = new Map<string, any>();
    for (const m of skuMaps) if (m.chave) mapByChave.set(m.chave, m);

    const findWeightSiblings = (template: any) => {
      if (!template || template.peso_kg == null) return [];
      const baseKey = getBaseKey(template.nome);
      if (!baseKey) return [];
      return templates.filter(
        (t: any) => t.peso_kg != null && t.categoria === template.categoria && getBaseKey(t.nome) === baseKey
      );
    };

    const templateList = templates.map((t: any) => {
      const parts = [t.id, t.cod || '', t.nome || '', t.categoria || ''];
      if (t.peso_kg) parts.push(`${t.peso_kg}kg`);
      if (t.acabamento) parts.push(t.acabamento);
      if (t.tipo_furo) parts.push(t.tipo_furo);
      if (t.und) parts.push(t.und);
      return parts.join('|');
    }).join('\n');

    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analise o arquivo enviado (tabela de preços de equipamentos de fitness) e extraia todos os produtos com seus preços.
Para cada produto, case com o template mais similar do catálogo abaixo.

CATÁLOGO (id|codigo|nome|categoria|atributos):
${templateList}

Retorne JSON com produtos encontrados. Regras:
- Extraia TODOS os produtos com preço que encontrar
- preco: apenas números (45.90, não "R$ 45,90")
- codigo_fornecedor: o código do produto na tabela do fornecedor, se houver
- descricao_original: a descrição do produto exatamente como aparece na tabela
- template_id: ID exato do catálogo casado, ou null se não houver
- confianca: número de 0 a 1 indicando o quanto você tem certeza do casamento
- preco_por_kg: true se a tabela indicar que o preço é por quilo, false caso contrário
- Use o código exato se houver match, senão compare nome/peso/acabamento/tipo`,
      file_urls: [file_url],
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          produtos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                descricao_original: { type: 'string' },
                codigo_fornecedor: { type: 'string' },
                template_id: { type: 'string' },
                preco: { type: 'number' },
                confianca: { type: 'number' },
                preco_por_kg: { type: 'boolean' },
                motivo: { type: 'string' },
              },
            },
          },
        },
      },
    });

    if (!llmResult.produtos || llmResult.produtos.length === 0) {
      return Response.json({ error: 'Nenhum produto encontrado no arquivo.' }, { status: 400 });
    }

    const resumoTmpl = (t: any) => ({
      product_id: t.id, cod: t.cod, nome: t.nome, categoria: t.categoria, peso_kg: t.peso_kg,
    });

    const itens: any[] = [];
    let linha = 1;

    for (const p of llmResult.produtos) {
      linha++;
      const descricao = p.descricao_original || null;
      const codigo = p.codigo_fornecedor || null;

      const item: any = {
        linha,
        cod_origem: codigo,
        descricao_origem: descricao,
        candidatos: [],
      };

      const preco = Number(p.preco);
      if (!preco || preco <= 0) {
        itens.push({ ...item, status: 'vermelho', motivo: 'Produto sem preço na tabela' });
        continue;
      }
      item.preco = preco;
      item.disponivel = true;

      // ---- casamento: de-para tem precedência sobre a IA
      let template: any = null;
      let via = '';

      const chaveCod = codigo ? normalizeCod(codigo) : '';
      const chaveNome = descricao ? normalizeNameTokens(descricao) : '';

      const hit = (chaveCod && mapByChave.get(chaveCod)) || (chaveNome && mapByChave.get(chaveNome));
      if (hit && templateById.has(hit.product_id)) {
        template = templateById.get(hit.product_id);
        via = 'de_para';
      }

      if (!template && chaveCod && templateByCod.has(chaveCod)) {
        template = templateByCod.get(chaveCod);
        via = 'sku_exato';
      }

      if (!template && p.template_id && templateById.has(p.template_id)) {
        template = templateById.get(p.template_id);
        via = 'ia';
        item.score = typeof p.confianca === 'number' ? Math.round(p.confianca * 100) / 100 : null;
      }

      if (!template) {
        itens.push({
          ...item,
          status: 'vermelho',
          motivo: p.motivo || 'A IA não encontrou correspondência no catálogo',
        });
        continue;
      }

      // ---- preço unitário ou por quilo
      const pesoNaLinha = extractWeight(descricao) ?? extractWeight(codigo);
      const irmas = findWeightSiblings(template);

      let tipoPreco: 'unitario' | 'kg' = 'unitario';
      let precoKgInferido = false;
      if (p.preco_por_kg === true) {
        tipoPreco = 'kg';
      } else if (pesoNaLinha == null && template.peso_kg != null && irmas.length > 1) {
        tipoPreco = 'kg';
        precoKgInferido = true;
      }

      item.match = resumoTmpl(template);
      item.via = via;
      item.tipo_preco = tipoPreco;
      item.preco_kg_inferido = precoKgInferido;
      item.variacoes_afetadas = tipoPreco === 'kg' ? Math.max(irmas.length, 1) : 1;
      item.ja_existe = existingByPid.has(template.id);
      item.preco_atual = existingByPid.get(template.id)?.preco ?? null;
      item.origem_match = (via === 'de_para' || via === 'sku_exato') ? 'sku_exato' : 'fuzzy_confirmado';

      const deterministico = via === 'de_para' || via === 'sku_exato';
      if (deterministico && !precoKgInferido) {
        item.status = 'verde';
        item.motivo = via === 'de_para'
          ? 'Mapeamento já confirmado numa importação anterior'
          : 'Código bate exatamente com o catálogo';
      } else {
        item.status = 'amarelo';
        item.motivo = precoKgInferido
          ? `Preço interpretado como POR QUILO e distribuído em ${Math.max(irmas.length, 1)} faixas de peso — confira`
          : `Casamento sugerido pela IA${item.score != null ? ` (confiança ${Math.round(item.score * 100)}%)` : ''}`;
      }

      itens.push(item);
    }

    return Response.json({
      success: true,
      modo: 'analisar',
      resumo: {
        total: itens.length,
        verde: itens.filter((x) => x.status === 'verde').length,
        amarelo: itens.filter((x) => x.status === 'amarelo').length,
        vermelho: itens.filter((x) => x.status === 'vermelho').length,
      },
      itens,
    });
  } catch (error) {
    console.error('Erro processSupplierTableUpload:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
