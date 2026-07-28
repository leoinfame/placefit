import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * ANÁLISE de uma tabela de preços em CSV. Não grava nada.
 *
 * Devolve um plano linha a linha para o usuário conferir. A gravação acontece
 * depois, em confirmarImportacaoTabela, só com o que foi aprovado.
 *
 * Classificação de cada linha:
 *   verde    — de-para já confirmado, SKU exato ou nome exato. Pode aplicar direto.
 *   amarelo  — casou por semelhança, ou o preço foi interpretado como por quilo. Confira.
 *   vermelho — sem correspondência, ou empate entre candidatos. Precisa escolher.
 */

// ---------------------------------------------------------------- normalização

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

/**
 * Extrai o peso do texto ORIGINAL, antes de normalizar a pontuação.
 * Na ordem inversa, pesos fracionados quebravam: "1,5kg" virava "1 5kg".
 */
const extractWeight = (text: string): number | null => {
  if (!text) return null;
  const m = stripAccents(String(text).toLowerCase()).match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
};

/** Nome sem o peso, usado para agrupar variações irmãs. Mesma ordem corrigida. */
const getBaseKey = (name: string) => {
  if (!name) return '';
  const semPeso = stripAccents(String(name).toLowerCase())
    .replace(/\d+(?:[.,]\d+)?\s*kg\b/g, ' ');
  let n = semPeso.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, sub] of SINONIMOS) n = n.replace(re, sub);
  return n;
};

const getTokens = (name: string) => normalizeName(name).split(' ').filter((w) => w.length > 1);
const normalizeNameTokens = (name: string) => getTokens(name).sort().join(' ');

const levenshtein = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[b.length][a.length];
};

const tokensSimilar = (a: string, b: string) => {
  if (a === b) return true;
  if (/^\d/.test(a) || /^\d/.test(b)) return a === b; // números batem exatamente
  if (a.length < 4 || b.length < 4) return a === b;
  return levenshtein(a, b) <= 2;
};

const scoreTokens = (csvTokens: string[], tmplTokens: string[]) => {
  if (!csvTokens.length || !tmplTokens.length) return 0;
  let matches = 0;
  const used = new Set<number>();
  for (const ct of csvTokens) {
    for (let i = 0; i < tmplTokens.length; i++) {
      if (used.has(i)) continue;
      if (tokensSimilar(ct, tmplTokens[i])) { matches++; used.add(i); break; }
    }
  }
  return matches / Math.max(csvTokens.length, tmplTokens.length);
};

const SCORE_MINIMO = 0.70;   // abaixo disso não é candidato
const MARGEM_MINIMA = 0.08;  // vantagem mínima sobre o 2º colocado; senão é empate

// ---------------------------------------------------------------- CSV

const parseCsv = (text: string) => {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.split(/\r?\n/)[0] || '';
  let delimiter = ',';
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (semis >= commas && semis >= tabs && semis > 0) delimiter = ';';
  else if (tabs > commas && tabs > 0) delimiter = '\t';

  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { current.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (field || current.length > 0) { current.push(field); rows.push(current); current = []; field = ''; }
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else field += ch;
    }
  }
  if (field || current.length > 0) { current.push(field); rows.push(current); }
  return rows;
};

const parsePreco = (val: string) => {
  if (!val) return null;
  let s = String(val).replace(/[R$\s]/g, '').trim();
  if (s === '') return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

// ---------------------------------------------------------------- handler

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json();
    const file_url = body?.file_url;
    if (!file_url) return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    const [templates, skuMaps, existingSps] = await Promise.all([
      base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }),
      base44.asServiceRole.entities.SupplierSkuMap.filter({ supplier_id: user.id, ativo: true }),
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id }),
    ]);

    const templateById = new Map(templates.map((t: any) => [t.id, t]));
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

    const templateByCod = new Map<string, any>();
    const templateByTokens = new Map<string, any>();
    const templateByCleanTokens = new Map<string, any>();
    const templateTokenList: { t: any; tokens: string[] }[] = [];

    for (const t of templates) {
      const cod = normalizeCod(t.cod);
      if (cod && !templateByCod.has(cod)) templateByCod.set(cod, t);

      const tokens = normalizeNameTokens(t.nome);
      if (tokens && !templateByTokens.has(tokens)) templateByTokens.set(tokens, t);

      const clean = normalizeNameTokens(String(t.nome ?? '').replace(/\bbruto\b/gi, '').replace(/\bpintado\b/gi, ''));
      if (clean && clean !== tokens && !templateByCleanTokens.has(clean)) templateByCleanTokens.set(clean, t);

      templateTokenList.push({ t, tokens: getTokens(t.nome) });
    }

    const csvRes = await fetch(file_url);
    if (!csvRes.ok) return Response.json({ error: 'Não foi possível baixar o arquivo.' }, { status: 400 });
    const rows = parseCsv(await csvRes.text());
    if (rows.length < 2) return Response.json({ error: 'CSV vazio ou sem dados.' }, { status: 400 });

    const headers = rows[0].map((h) => stripAccents(h.trim().toLowerCase()));
    const idxCodigo = headers.findIndex((h) => ['codigo', 'sku', 'cod'].includes(h));
    const idxNome = headers.findIndex((h) => ['nome', 'produto', 'descricao', 'descricao_produto'].includes(h));
    const idxPreco = headers.findIndex((h) => ['preco', 'valor', 'preco_unitario'].includes(h));
    const idxDisponivel = headers.findIndex((h) => ['disponivel', 'disp', 'estoque'].includes(h));
    const idxTipoPreco = headers.findIndex((h) => ['tipo_preco', 'tipopreco', 'unidade_preco'].includes(h));

    if (idxNome === -1 && idxCodigo === -1) {
      return Response.json({ error: 'CSV deve ter ao menos uma coluna "nome" ou "codigo".' }, { status: 400 });
    }

    const resumoTmpl = (t: any) => ({
      product_id: t.id, cod: t.cod, nome: t.nome, categoria: t.categoria, peso_kg: t.peso_kg,
    });

    const itens: any[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const codigo = idxCodigo !== -1 ? (row[idxCodigo] || '').trim() : '';
      const nome = idxNome !== -1 ? (row[idxNome] || '').trim() : '';
      if (!codigo && !nome) continue;

      const item: any = {
        linha: i + 1,
        cod_origem: codigo || null,
        descricao_origem: nome || null,
        candidatos: [],
      };

      const preco = idxPreco !== -1 ? parsePreco(row[idxPreco]) : null;
      if (preco === null || preco <= 0) {
        itens.push({ ...item, status: 'vermelho', motivo: 'Sem preço preenchido no CSV' });
        continue;
      }
      item.preco = preco;
      item.disponivel = idxDisponivel !== -1 && row[idxDisponivel]
        ? String(row[idxDisponivel]).trim().toUpperCase() !== 'NÃO'
        : true;

      // ---- cascata de casamento
      let template: any = null;
      let via = '';

      const chaveCod = codigo ? normalizeCod(codigo) : '';
      const chaveNome = nome ? normalizeNameTokens(nome) : '';

      // 0) de-para já confirmado por este fornecedor
      const hit = (chaveCod && mapByChave.get(chaveCod)) || (chaveNome && mapByChave.get(chaveNome));
      if (hit && templateById.has(hit.product_id)) {
        template = templateById.get(hit.product_id);
        via = 'de_para';
      }

      // 1) SKU exato do catálogo
      if (!template && chaveCod && templateByCod.has(chaveCod)) {
        template = templateByCod.get(chaveCod);
        via = 'sku_exato';
      }

      // 2/3) nome exato, com e sem palavras de acabamento
      if (!template && nome) {
        if (templateByTokens.has(chaveNome)) {
          template = templateByTokens.get(chaveNome);
          via = 'nome_exato';
        } else {
          const limpo = normalizeNameTokens(nome.replace(/\bbruto\b/gi, '').replace(/\bpintado\b/gi, ''));
          const alt = templateByCleanTokens.get(limpo) || templateByTokens.get(limpo);
          if (alt) { template = alt; via = 'nome_sem_acabamento'; }
        }
      }

      // 4) semelhança, exigindo vantagem sobre o 2º colocado
      let empate = false;
      if (!template && nome) {
        const csvTokens = getTokens(nome);
        const scored = templateTokenList
          .map(({ t, tokens }) => ({ t, score: scoreTokens(csvTokens, tokens) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score);

        item.candidatos = scored.slice(0, 3).map((x) => ({
          ...resumoTmpl(x.t), score: Math.round(x.score * 100) / 100,
        }));

        const melhor = scored[0];
        const segundo = scored[1];
        if (melhor && melhor.score >= SCORE_MINIMO) {
          if (!segundo || melhor.score - segundo.score >= MARGEM_MINIMA) {
            template = melhor.t;
            via = 'semelhanca';
            item.score = Math.round(melhor.score * 100) / 100;
          } else {
            empate = true;
          }
        }
      }

      if (!template) {
        itens.push({
          ...item,
          status: 'vermelho',
          motivo: empate
            ? 'Mais de um produto do catálogo com a mesma semelhança — escolha o correto'
            : 'Nenhum produto do catálogo corresponde a esta linha',
        });
        continue;
      }

      // ---- preço unitário ou por quilo
      const tipoDeclarado = idxTipoPreco !== -1 ? String(row[idxTipoPreco] || '').trim().toLowerCase() : '';
      const pesoNaLinha = extractWeight(nome) ?? extractWeight(codigo);
      const irmas = findWeightSiblings(template);

      let tipoPreco: 'unitario' | 'kg' = 'unitario';
      let precoKgInferido = false;
      if (['kg', 'quilo', 'por_kg', 'porkg'].includes(tipoDeclarado)) {
        tipoPreco = 'kg';
      } else if (!tipoDeclarado && pesoNaLinha == null && template.peso_kg != null && irmas.length > 1) {
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

      const deterministico = via === 'de_para' || via === 'sku_exato' || via === 'nome_exato';
      if (deterministico && !precoKgInferido) {
        item.status = 'verde';
        item.motivo =
          via === 'de_para' ? 'Mapeamento já confirmado numa importação anterior'
          : via === 'sku_exato' ? 'Código bate exatamente com o catálogo'
          : 'Nome bate exatamente com o catálogo';
      } else {
        item.status = 'amarelo';
        item.motivo = precoKgInferido
          ? `Preço interpretado como POR QUILO e distribuído em ${Math.max(irmas.length, 1)} faixas de peso — confira`
          : via === 'nome_sem_acabamento' ? 'Casou ignorando o acabamento (bruto/pintado)'
          : `Casamento por semelhança (${Math.round((item.score || 0) * 100)}%)`;
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
    console.error('Erro processDirectCsvUpload:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
