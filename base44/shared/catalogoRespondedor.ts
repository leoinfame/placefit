// ─── Catálogo para o respondedor automático ─────────────────────────────────
// Busca por palavra-chave no catálogo do tenant (SupplierProduct + ProductTemplate)
// e devolve só os itens relevantes para entrar no prompt.
//
// Preço: o MESMO da vitrine (computeStorePrice: sale_price ou preco × margem).
// Nunca expõe custo de fábrica (Product.preco_fabricante não é lido aqui) nem
// o nome do fabricante — o cliente fala com o hub PlaceFit.

import { computeStorePrice } from './loja.ts';

const CACHE_MS = 10 * 60 * 1000;
const MAX_ITENS = 12;
const cache: Record<string, { em: number; itens: ItemCatalogo[] }> = {};

export type ItemCatalogo = {
  product_id: string; // id do ProductTemplate (o mesmo que o painel grava em Pedido.itens)
  nome: string;
  cod: string;
  categoria: string;
  subcategoria: string;
  und: string;
  peso_kg: number | null;
  detalhes: string;
  preco: number;
  busca: string; // texto normalizado para a busca
};

const STOP = new Set([
  'que', 'qual', 'quais', 'quanto', 'quanta', 'quantos', 'custa', 'custam', 'valor', 'preco', 'precos',
  'tem', 'vcs', 'voce', 'voces', 'para', 'pra', 'com', 'sem', 'uma', 'umas', 'uns', 'dos', 'das',
  'por', 'favor', 'mais', 'menos', 'esse', 'essa', 'este', 'esta', 'isso', 'aqui', 'ola', 'bom',
  'dia', 'tarde', 'noite', 'queria', 'quero', 'gostaria', 'saber', 'sobre', 'tambem', 'ainda',
  'vende', 'vendem', 'venda', 'comprar', 'compra', 'peca', 'pecas', 'unidade', 'und', 'kg', 'quilo', 'quilos'
]);

export function normalizar(t: string) {
  return String(t || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2') // "1x1" → "1 x 1", "avp10" → "avp 10"
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();
}

// Plural e gênero: "injetadas" e "injetado" viram "injetad"
const raiz = (p: string) => {
  let r = p.length > 4 ? p.replace(/(es|s)$/, '') : p;
  if (r.length > 5) r = r.replace(/[ao]$/, '');
  return r;
};

async function buscarTodos(fn: (skip: number) => Promise<any[]>) {
  let todos: any[] = [];
  for (let skip = 0; skip < 10000; skip += 500) {
    const lote = await fn(skip);
    todos = todos.concat(lote || []);
    if (!lote || lote.length < 500) break;
  }
  return todos;
}

export async function carregarCatalogo(base44: any, tenantId: string): Promise<ItemCatalogo[]> {
  const c = cache[tenantId];
  if (c && Date.now() - c.em < CACHE_MS) return c.itens;

  const sps = await buscarTodos((skip) =>
    base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: tenantId }, '-created_date', 500, skip)
  );
  const disponiveis = sps.filter((sp: any) => sp.disponivel !== false && sp.product_id);
  const ids = [...new Set(disponiveis.map((sp: any) => sp.product_id))];
  const templates: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const parte = ids.slice(i, i + 200);
    templates.push(...await buscarTodos((skip) =>
      base44.asServiceRole.entities.ProductTemplate.filter({ id: { $in: parte } }, '-created_date', 500, skip)
    ));
  }
  const porId: Record<string, any> = {};
  for (const t of templates) porId[t.id] = t;

  const itens: ItemCatalogo[] = [];
  for (const sp of disponiveis) {
    const t = porId[sp.product_id];
    if (!t || t.ativo === false) continue;
    const preco = computeStorePrice(sp);
    if (!preco || preco <= 0) continue;
    const detalhes = [t.tipo_anilha, t.tipo_furo, t.acabamento, t.pegada, t.barra_acabamento,
      t.dumbell_tipo, t.piso_formato, t.piso_espessura_mm ? t.piso_espessura_mm + ' mm' : '',
      String(t.descricao_padrao || '').slice(0, 160)]
      .filter(Boolean).join(' · ');
    const peso = Number(t.peso_kg) > 0 ? Number(t.peso_kg) : null;
    itens.push({
      product_id: String(t.id),
      nome: String(t.nome || ''),
      cod: String(t.cod || ''),
      categoria: String(t.categoria || ''),
      subcategoria: String(t.subcategoria || ''),
      und: String(t.und || 'peça'),
      peso_kg: peso,
      detalhes,
      preco,
      busca: normalizar([t.nome, t.cod, t.categoria, t.subcategoria, detalhes, sp.cod_origem].join(' '))
    });
  }
  cache[tenantId] = { em: Date.now(), itens };
  return itens;
}

/** Itens do catálogo mais relevantes para o texto (vazio se nada casar). */
export function buscarNoCatalogo(itens: ItemCatalogo[], texto: string): ItemCatalogo[] {
  const termos = [...new Set(normalizar(texto).split(' ').filter(Boolean))];
  const palavras = termos.filter((t) => !/^\d/.test(t) && t.length >= 3 && !STOP.has(t)).map(raiz);
  const numeros = termos.filter((t) => /^\d+(\.\d+)?$/.test(t)).map(Number);
  if (!palavras.length) return [];

  const pontuados = itens.map((item) => {
    const doItem = item.busca.split(' ');
    let pontos = 0;
    for (const p of palavras) {
      if (doItem.some((w) => w.startsWith(p) || (w.length >= 4 && p.startsWith(w)))) pontos += 2;
    }
    if (pontos > 0) {
      for (const n of numeros) {
        if (item.peso_kg === n || doItem.includes(String(n))) pontos += 1;
      }
    }
    return { item, pontos };
  }).filter((x) => x.pontos > 0);

  pontuados.sort((a, b) => b.pontos - a.pontos || a.item.preco - b.item.preco);
  return pontuados.slice(0, MAX_ITENS).map((x) => x.item);
}

export type ResolucaoItem =
  | { status: 'ok'; item: ItemCatalogo }
  | { status: 'ambiguo'; opcoes: ItemCatalogo[] }
  | { status: 'nao_encontrado'; sugestoes: ItemCatalogo[] };

/**
 * Resolve UMA descrição de item para UM produto do catálogo, sem chute:
 * - todas as palavras da descrição precisam aparecer no produto;
 * - todos os números (peso, medida) precisam bater;
 * - um único candidato → ok; vários → ambíguo; nenhum → não encontrado (com sugestões).
 */
export function resolverItem(itens: ItemCatalogo[], descricao: string): ResolucaoItem {
  const termos = [...new Set(normalizar(descricao).split(' ').filter(Boolean))];
  const palavras = termos.filter((t) => !/^\d/.test(t) && t.length >= 3 && !STOP.has(t)).map(raiz);
  const numeros = termos.filter((t) => /^\d+(\.\d+)?$/.test(t)).map(Number);
  if (!palavras.length) return { status: 'nao_encontrado', sugestoes: [] };

  const avaliados = itens.map((item) => {
    const doItem = item.busca.split(' ');
    const numsItem = new Set(doItem.filter((w) => /^\d+(\.\d+)?$/.test(w)).map(Number));
    if (item.peso_kg) numsItem.add(item.peso_kg);
    const casadas = palavras.filter((p) => doItem.some((w) => w.startsWith(p) || (w.length >= 4 && p.startsWith(w)))).length;
    const numerosOk = numeros.every((n) => numsItem.has(n));
    return { item, cobertura: casadas / palavras.length, numerosOk };
  });

  const exatos = avaliados.filter((a) => a.cobertura === 1 && a.numerosOk).map((a) => a.item);
  if (exatos.length === 1) return { status: 'ok', item: exatos[0] };
  if (exatos.length > 1) {
    // Nome idêntico ao pedido desempata (ex.: dono escolheu uma opção da lista)
    const alvo = normalizar(descricao);
    const identico = exatos.filter((i) => normalizar(i.nome) === alvo);
    if (identico.length === 1) return { status: 'ok', item: identico[0] };
    return { status: 'ambiguo', opcoes: exatos.slice(0, 5) };
  }
  const sugestoes = avaliados
    .filter((a) => a.cobertura >= 0.5)
    .sort((a, b) => (Number(b.numerosOk) - Number(a.numerosOk)) || (b.cobertura - a.cobertura))
    .slice(0, 4).map((a) => a.item);
  return { status: 'nao_encontrado', sugestoes };
}

const brl = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');

export function catalogoParaPrompt(itens: ItemCatalogo[]): string {
  if (!itens.length) return 'Nenhum item do catálogo corresponde ao que foi falado.';
  return itens.map((i) =>
    `- ${i.nome}${i.cod ? ` (cód ${i.cod})` : ''} | ${i.categoria}${i.subcategoria ? ' / ' + i.subcategoria : ''}` +
    `${i.peso_kg ? ` | ${String(i.peso_kg).replace('.', ',')} kg` : ''} | ${brl(i.preco)} por ${i.und}` +
    `${i.detalhes ? ` | ${i.detalhes}` : ''} | disponível`
  ).join('\n');
}
