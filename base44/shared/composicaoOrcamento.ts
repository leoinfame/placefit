// ─── Composição de itens do orçamento (item 009 / spec 5.2) ─────────────────
// Transforma as linhas do pedido do dono em itens do catálogo, sem chute:
//  - descrição que casa com UM produto → item direto (regra do óbvio com suposição visível);
//  - faixa de peso ("dumbbell montado 12 a 20 kg") → um item por peso da família, somados;
//  - kit + suporte pedido junto → o kit "+ Suporte" do catálogo, sem somar o suporte de novo;
//  - "não achei" só depois de buscar por composição e por palavra-chave; quando há
//    alternativa próxima, vira pergunta numerada com a opção sugerida entre aspas;
//  - sugestão sempre do MESMO tipo de produto (anilha nunca vira dumbbell); combinação que não
//    existe ("Sport Pintada com inox") é explicada e oferece a linha certa (B2);
//  - barra de ~2,2 m sem tipo dito: pergunta olímpica (sugerida) x maciça (B3).
// Puro (sem banco): o preço vem do ItemCatalogo (SupplierProduct.preco via vitrine).

import {
  type ItemCatalogo, resolverItem, normalizar, palavrasDe, itensComPalavras, extrasDoItem, buscarNoCatalogo
} from './catalogoRespondedor.ts';

export type LinhaPedido = { descricao: string; quantidade: number; quantidade_informada?: boolean; unidade_pedida?: string };
export type ItemComposto = { item: ItemCatalogo; quantidade: number; origem: string };
export type Composicao = { itens: ItemComposto[]; perguntas: string[]; suposicoes: string[]; composicoes: string[] };

const FAIXA = /\b(\d+(?:\.\d+)?) (?:a|ate) (\d+(?:\.\d+)?)\b/;
const kg = (n: number) => String(n).replace('.', ',');
const nomeFamilia = (nome: string) => String(nome || '').replace(/\s*\d+(?:[.,]\d+)?\s*kg\b/ig, '').replace(/\s+/g, ' ').trim();

/** Faixa "12 a 20" na descrição: limites e a descrição sem a faixa. */
export function lerFaixa(descricao: string): { de: number; ate: number; base: string } | null {
  const n = normalizar(descricao);
  const m = n.match(FAIXA);
  if (!m) return null;
  const de = Number(m[1]);
  const ate = Number(m[2]);
  if (!(ate > de)) return null;
  const base = n.replace(m[0], ' ').replace(/\b(kg|de|do|da)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return { de, ate, base };
}

type Familia = { nome: string; itens: ItemCatalogo[]; extras: number };

/** Famílias (mesmo nome sem o peso) com um item por peso dentro da faixa, melhor primeiro. */
function familiasNaFaixa(candidatos: ItemCatalogo[], de: number, ate: number, base: string): Familia[] {
  const grupos = new Map<string, ItemCatalogo[]>();
  for (const it of candidatos) {
    if (!(it.peso_kg && it.peso_kg >= de && it.peso_kg <= ate)) continue;
    const k = nomeFamilia(it.nome);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(it);
  }
  const familias = [...grupos.entries()].map(([nome, itens]) => {
    const porPeso = new Map<number, ItemCatalogo>();
    for (const it of [...itens].sort((a, b) => a.preco - b.preco)) {
      if (!porPeso.has(it.peso_kg!)) porPeso.set(it.peso_kg!, it);
    }
    const lista = [...porPeso.values()].sort((a, b) => a.peso_kg! - b.peso_kg!);
    return { nome, itens: lista, extras: extrasDoItem(lista[0], base) };
  });
  // Mais pesos cobertos primeiro; empate → a versão com menos palavras a mais (a padrão)
  return familias.sort((a, b) => b.itens.length - a.itens.length || a.extras - b.extras);
}

const mesmoNivel = (a?: Familia, b?: Familia) => Boolean(a && b && a.itens.length === b.itens.length && a.extras === b.extras);

// ── Tipo do produto (anilha, barra, dumbbell, kit...) ──
const primeiraPalavra = (nome: string) => palavrasDe(nome)[0] || '';
const mesmoTipo = (a: string, b: string) => Boolean(a && b && (a.startsWith(b) || b.startsWith(a)));

/** Tipo pedido = primeira palavra da descrição que é o início do nome de algum item do catálogo. */
function tipoDoPedido(catalogo: ItemCatalogo[], descricao: string): string {
  const tipos = [...new Set(catalogo.map((i) => primeiraPalavra(i.nome)).filter(Boolean))];
  return palavrasDe(descricao).find((p) => tipos.some((t) => mesmoTipo(t, p))) || '';
}
const doTipo = (itens: ItemCatalogo[], tipo: string) => (tipo ? itens.filter((i) => mesmoTipo(primeiraPalavra(i.nome), tipo)) : itens);

/** Entre opções empatadas: menos palavras a mais; depois a injetada (regra do óbvio); depois a mais barata. */
function melhor(opcoes: ItemCatalogo[], descricao: string): ItemCatalogo {
  return [...opcoes].sort((a, b) =>
    extrasDoItem(a, descricao) - extrasDoItem(b, descricao) ||
    Number(/\binjetad/.test(b.chave)) - Number(/\binjetad/.test(a.chave)) ||
    a.preco - b.preco)[0];
}

const numerosDe = (chave: string) => new Set(chave.split(' ').filter((w) => /^\d+(\.\d+)?$/.test(w)).map(Number));

/** B3: "barra (recartilhada) 2,2 m" sem dizer olímpica nem maciça → pergunta, com a olímpica cromada 4 rolamentos sugerida. */
function barraComprida(catalogo: ItemCatalogo[], l: LinhaPedido, res: Composicao): boolean {
  const n = normalizar(l.descricao);
  if (!/^barr/.test(palavrasDe(l.descricao)[0] || '') || /\b(olimpic|macic)/.test(n)) return false;
  const m = n.match(/(\d+(?:\.\d+)?) m\b/);
  const compr = m ? Number(m[1]) : 0;
  if (!(compr >= 1.8 && compr <= 2.4)) return false;
  const barras = catalogo.filter((i) => /^barra\b/.test(i.chave) && numerosDe(i.chave).has(compr));
  const olimpicas = barras.filter((i) => /\bolimpic/.test(i.chave) && /\bcromad/.test(i.chave) && /\b4 rolament/.test(i.chave))
    .sort((a, b) => Number(/\b20 kg\b/.test(b.chave)) - Number(/\b20 kg\b/.test(a.chave)) || a.preco - b.preco);
  const recartilhada = /\brecartilh/.test(n);
  const macicas = barras.filter((i) => /\bmacic/.test(i.chave) && (!recartilhada || /\brecartilh/.test(i.chave)))
    .sort((a, b) => a.preco - b.preco);
  if (!olimpicas.length || !macicas.length) return false;
  const o = olimpicas[0];
  const mc = macicas[0];
  res.perguntas.push(`"${l.descricao}": barra de ${String(compr).replace('.', ',')} m pode ser olímpica ou maciça. ` +
    `Usar "${o.nome}"${o.cod ? ` (${o.cod})` : ''}? Outra opção: "${mc.nome}"${mc.cod ? ` (${mc.cod})` : ''}.`);
  return true;
}

/**
 * B2: combinação que não existe. Tira palavras que nenhum item do tipo tem ("parte", "interna");
 * se ainda não existir, tira 1 ou 2 características e mostra o que existe, preferindo manter o
 * que veio depois de "com" (o requisito do cliente). Nunca sai do tipo pedido.
 */
function explicarFalta(catalogo: ItemCatalogo[], l: LinhaPedido, qtd: number, res: Composicao): boolean {
  const tipo = tipoDoPedido(catalogo, l.descricao);
  if (!tipo) return false;
  const base = doTipo(catalogo, tipo);
  const toks = normalizar(l.descricao).split(' ').filter(Boolean);
  const sig = [...new Set(toks.filter((t) => !/^\d/.test(t) && palavrasDe(t).length))];
  const ruido = sig.filter((t) => !itensComPalavras(base, palavrasDe(t)).length);
  const uteis = sig.filter((t) => !ruido.includes(t) && !mesmoTipo(palavrasDe(t)[0], tipo));
  const sem = (fora: string[]) => toks.filter((t) => !ruido.includes(t) && !fora.includes(t)).join(' ');

  if (ruido.length) {
    const r = resolverItem(base, sem([]));
    if (r.status === 'ok') {
      res.itens.push({ item: r.item, quantidade: qtd, origem: l.descricao });
      res.suposicoes.push(`"${l.descricao}": entendi como "${r.item.nome}"${r.item.cod ? ` (${r.item.cod})` : ''}.` + (r.suposicao ? ` ${r.suposicao}` : ''));
      return true;
    }
    if (r.status === 'ambiguo') {
      const ops = [...r.opcoes].sort((a, b) => (melhor([a, b], sem([])) === a ? -1 : 1));
      res.perguntas.push(`"${l.descricao}": usar "${ops[0].nome}"${ops[0].cod ? ` (${ops[0].cod})` : ''}?` +
        (ops.length > 1 ? ` Outras: ${ops.slice(1, 4).map((o) => `"${o.nome}"`).join('; ')}.` : ''));
      return true;
    }
  }

  const iCom = toks.indexOf('com');
  const requisitos = iCom >= 0 ? toks.slice(iCom + 1) : [];
  const combos: string[][] = uteis.map((t) => [t]);
  for (let i = 0; i < uteis.length; i++) for (let j = i + 1; j < uteis.length; j++) combos.push([uteis[i], uteis[j]]);
  const opcoes: { fora: string[]; item: ItemCatalogo; mantem: boolean }[] = [];
  for (const fora of combos) {
    const desc = sem(fora);
    const r = resolverItem(base, desc);
    const item = r.status === 'ok' ? r.item : r.status === 'ambiguo' ? melhor(r.opcoes, desc) : null;
    if (item && !opcoes.some((o) => o.item.product_id === item.product_id)) {
      opcoes.push({ fora, item, mantem: !fora.some((f) => requisitos.includes(f)) });
    }
  }
  if (!opcoes.length) return false;
  opcoes.sort((a, b) => Number(b.mantem) - Number(a.mantem) || a.fora.length - b.fora.length);
  const o1 = opcoes[0];
  const o2 = opcoes.find((o) => o.fora.join(' ') !== o1.fora.join(' '));
  const motivo = o2 && o2.fora.every((f) => !o1.fora.includes(f))
    ? `"${o1.fora.join(' ')}" não vem com "${o2.fora.join(' ')}"`
    : `não existe com "${o1.fora.join(' ')}"`;
  res.perguntas.push(`Não tem "${l.descricao}": ${motivo}. Usar "${o1.item.nome}"${o1.item.cod ? ` (${o1.item.cod})` : ''}?` +
    (o2 ? ` Outra opção: "${o2.item.nome}"${o2.item.cod ? ` (${o2.item.cod})` : ''}.` : ''));
  return true;
}

function resolverLinha(catalogo: ItemCatalogo[], l: LinhaPedido, res: Composicao) {
  const informada = l.quantidade_informada !== false && Number(l.quantidade) > 0;
  const qtd = informada ? Number(l.quantidade) : 1;
  if (!informada) res.suposicoes.push(`"${l.descricao}": quantidade não informada, considerei 1${lerFaixa(l.descricao) ? ' de cada peso' : ''}.`);

  if (barraComprida(catalogo, l, res)) return;
  const r = resolverItem(catalogo, l.descricao);
  if (r.status === 'ok') {
    res.itens.push({ item: r.item, quantidade: qtd, origem: l.descricao });
    if (r.suposicao) res.suposicoes.push(`"${l.descricao}": ${r.suposicao}`);
    return;
  }
  if (r.status === 'ambiguo') {
    const ops = [...r.opcoes].sort((a, b) => extrasDoItem(a, l.descricao) - extrasDoItem(b, l.descricao));
    res.perguntas.push(`"${l.descricao}" tem mais de um produto. Usar "${ops[0].nome}"${ops[0].cod ? ` (${ops[0].cod})` : ''}?` +
      (ops.length > 1 ? ` Outras: ${ops.slice(1, 4).map((o) => `"${o.nome}"`).join('; ')}.` : ''));
    return;
  }

  // Composição por faixa de peso
  const faixa = lerFaixa(l.descricao);
  if (faixa) {
    const palavras = palavrasDe(faixa.base);
    const fams = familiasNaFaixa(itensComPalavras(catalogo, palavras), faixa.de, faixa.ate, faixa.base);
    if (fams.length) {
      const f = fams[0];
      if (!mesmoNivel(fams[0], fams[1])) {
        for (const it of f.itens) res.itens.push({ item: it, quantidade: qtd, origem: l.descricao });
        res.composicoes.push(`${f.nome} ${kg(faixa.de)} a ${kg(faixa.ate)} kg = ${f.itens.map((i) => kg(i.peso_kg!)).join('/')} kg, ${kg(qtd)} de cada`);
        if (fams.length > 1) res.suposicoes.push(`"${l.descricao}": considerei "${f.nome}" — se for ${fams.slice(1, 3).map((x) => `"${x.nome}"`).join(' / ')}, me avisa.`);
        return;
      }
      res.perguntas.push(`"${l.descricao}": usar "${f.nome} ${kg(faixa.de)} a ${kg(faixa.ate)} kg"? Outra opção: "${fams[1].nome}".`);
      return;
    }
    // Família exata não existe: tira uma palavra por vez e sugere a mais próxima
    const vistas = new Set<string>();
    const alternativas: Familia[] = [];
    const tipo = tipoDoPedido(catalogo, faixa.base);
    for (const fora of palavras) {
      if (mesmoTipo(fora, tipo)) continue; // nunca troca o tipo do produto (anilha não vira dumbbell)
      const pal = palavras.filter((p) => p !== fora);
      if (!pal.length) continue;
      for (const f of familiasNaFaixa(itensComPalavras(catalogo, pal), faixa.de, faixa.ate, faixa.base)) {
        if (!vistas.has(f.nome)) { vistas.add(f.nome); alternativas.push(f); }
      }
    }
    alternativas.sort((a, b) => b.itens.length - a.itens.length || a.extras - b.extras);
    if (alternativas.length) {
      const f = alternativas[0];
      res.perguntas.push(`Não tem "${l.descricao}" no catálogo. Usar "${f.nome} ${kg(faixa.de)} a ${kg(faixa.ate)} kg" ` +
        `(${f.itens.map((i) => kg(i.peso_kg!)).join('/')} kg, ${kg(qtd)} de cada)?`);
      return;
    }
  }

  // Combinação inexistente: explica e oferece a linha certa do mesmo tipo
  if (explicarFalta(catalogo, l, qtd, res)) return;

  // Palavra-chave: a melhor alternativa DO MESMO TIPO vira sugestão; "não achei" só sem nenhuma
  const tipo = tipoDoPedido(catalogo, l.descricao);
  let sugestoes = doTipo(r.sugestoes.length ? r.sugestoes : buscarNoCatalogo(catalogo, l.descricao), tipo);
  // Peso/medida pedidos são obrigatórios na sugestão: "anilha de 10kg" nunca vira anilha de 1 kg
  const pedidos = [...numerosDe(normalizar(l.descricao))];
  if (pedidos.length) {
    const temNumeros = (i: ItemCatalogo) => {
      const ns = numerosDe(i.chave);
      if (i.peso_kg) ns.add(i.peso_kg);
      return pedidos.every((n) => ns.has(n));
    };
    sugestoes = sugestoes.filter(temNumeros);
    if (!sugestoes.length && tipo) {
      sugestoes = doTipo(catalogo, tipo).filter(temNumeros).sort((a, b) => extrasDoItem(a, l.descricao) - extrasDoItem(b, l.descricao));
    }
    if (!sugestoes.length && tipo) {
      const pesos = [...new Set(doTipo(catalogo, tipo).map((i) => i.peso_kg).filter((p): p is number => Boolean(p)))].sort((a, b) => a - b);
      const nomeTipo = normalizar(l.descricao).split(' ').find((t) => mesmoTipo(palavrasDe(t)[0] || '', tipo)) || tipo;
      res.perguntas.push(`Não tem "${l.descricao}" no catálogo: nenhuma ${nomeTipo} de ${pedidos.map(kg).join(' / ')}.` +
        (pesos.length ? ` Pesos que existem: ${pesos.slice(0, 12).map(kg).join(', ')} kg.` : '') + ' Qual produto usar?');
      return;
    }
  }
  sugestoes = sugestoes.slice(0, 4);
  if (sugestoes.length) {
    res.perguntas.push(`Não tem "${l.descricao}" no catálogo. Usar "${sugestoes[0].nome}"${sugestoes[0].cod ? ` (${sugestoes[0].cod})` : ''}?` +
      (sugestoes.length > 1 ? ` Outras: ${sugestoes.slice(1).map((o) => `"${o.nome}"`).join('; ')}.` : ''));
  } else {
    res.perguntas.push(`Não achei "${l.descricao}" no catálogo (busquei por composição e por palavra-chave). Qual é o produto?`);
  }
}

/** Resolve todas as linhas do pedido em itens do catálogo, perguntas e suposições. */
export function comporPedido(catalogo: ItemCatalogo[], linhas: LinhaPedido[]): Composicao {
  const res: Composicao = { itens: [], perguntas: [], suposicoes: [], composicoes: [] };
  const n = (d: string) => normalizar(d);
  let restantes = [...(linhas || [])].filter((l) => String(l?.descricao || '').trim());

  // Kit com suporte incluso: reconhecido como kit, o suporte não é somado de novo
  let suportes = restantes.filter((l) => /^suporte\b/.test(n(l.descricao)));
  for (const kit of restantes.filter((l) => /\bkit\b/.test(n(l.descricao)))) {
    const kitComSuporte = /\bsuporte\b/.test(n(kit.descricao));
    if (!suportes.length && !kitComSuporte) continue;
    const r = resolverItem(catalogo, kitComSuporte ? kit.descricao : `${kit.descricao} com suporte`);
    if (r.status !== 'ok' || !/\b(suporte|sup)\b/.test(n(r.item.nome))) continue;
    const qtd = Number(kit.quantidade) > 0 && kit.quantidade_informada !== false ? Number(kit.quantidade) : 1;
    res.itens.push({ item: r.item, quantidade: qtd, origem: kit.descricao });
    if (r.suposicao) res.suposicoes.push(`"${kit.descricao}": ${r.suposicao}`);
    if (suportes.length) {
      res.suposicoes.push(`${suportes.map((s) => `"${s.descricao}"`).join(', ')}: considerei incluso no ${r.item.cod || r.item.nome} (kit com suporte), sem somar o suporte de novo.`);
    }
    restantes = restantes.filter((l) => l !== kit && !suportes.includes(l));
    suportes = [];
  }

  for (const l of restantes) resolverLinha(catalogo, l, res);
  return res;
}
