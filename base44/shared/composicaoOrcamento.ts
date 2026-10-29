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
// Item 020 (28/10): quando o interpretador manda a FICHA do item (tipo, pesos listados, pares,
// composição "4x5 + 6x10", comprimento, capacidade, requisitos), o casamento é por tipo + peso +
// variação, nunca por palavra solta; o que não existe no catálogo vai para "não cotados" com motivo.
// Puro (sem banco): o preço vem do ItemCatalogo (SupplierProduct.preco via vitrine).

import {
  type ItemCatalogo, resolverItem, normalizar, palavrasDe, itensComPalavras, extrasDoItem, buscarNoCatalogo, pesoPeloNome
} from './catalogoRespondedor.ts';

export type ComposicaoPeso = { quantidade: number; peso_kg: number };
export type LinhaPedido = {
  descricao: string; quantidade: number; quantidade_informada?: boolean; unidade_pedida?: string;
  // Ficha do item (item 020); vazio/0 = não informado
  tipo?: string; pesos_kg?: number[]; por_par?: boolean; composicao?: ComposicaoPeso[]; comprimento_m?: number;
  capacidade_kg?: number; capacidade_pares?: number; capacidade_barras?: number; armazena?: string[];
  requisitos?: string[]; preferencias?: string[];
};
export type ItemComposto = { item: ItemCatalogo; quantidade: number; origem: string };
export type Composicao = { itens: ItemComposto[]; perguntas: string[]; suposicoes: string[]; composicoes: string[]; naoCotados: string[] };

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
    // Palavra descartada pode ser característica de verdade ("emborrachada"): sempre pergunta, nunca entra sozinho
    if (r.status === 'ok') {
      const nomeTipo = toks.find((t) => mesmoTipo(palavrasDe(t)[0] || '', tipo)) || tipo;
      res.perguntas.push(`Não tem "${l.descricao}" do jeito que foi escrito (nenhuma ${nomeTipo} com "${ruido.join(' ')}"). ` +
        `Usar "${r.item.nome}"${r.item.cod ? ` (${r.item.cod})` : ''}?`);
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

// ── Ficha estruturada (item 020) ──
// Halter e dumbbell são o mesmo tipo de produto para o pedido (a licitação diz "halteres")
const SINONIMOS: Record<string, string[]> = {
  halter: ['halter', 'dumbbell', 'dumbell'], dumbbell: ['halter', 'dumbbell', 'dumbell'], dumbell: ['halter', 'dumbbell', 'dumbell']
};
// Palavra de descrição que não diferencia produto: nunca é requisito
const GENERICAS = new Set(['reta', 'reto', 'simples', 'comum', 'padrao', 'convencional', 'institucional', 'basico', 'basica', 'equivalente']);
const raizTipo = (t: string) => palavrasDe(t)[0] || '';
const tiposAceitos = (tipo: string) => { const r = raizTipo(tipo); return r ? (SINONIMOS[r] || [r]).map(raizTipo) : []; };
const doTipoFicha = (catalogo: ItemCatalogo[], tipo: string) => {
  const ts = tiposAceitos(tipo);
  return catalogo.filter((i) => ts.some((t) => mesmoTipo(primeiraPalavra(i.nome), t)));
};
const pesoDoItem = (i: ItemCatalogo) => i.peso_kg || pesoPeloNome(i.nome);
const nomeComCod = (i: ItemCatalogo) => `"${i.nome}"${i.cod ? ` (${i.cod})` : ''}`;

/** O nome do item tem o termo? "w|ez" = alternativas; termo curto (w, ez, h) casa só palavra inteira. */
function temTermo(i: ItemCatalogo, termo: string): boolean {
  const toks = normalizar(i.nome).split(' ');
  return String(termo || '').split('|').some((alt) => {
    const n = normalizar(alt);
    if (!n) return false;
    if (n.length < 3) return toks.includes(n);
    const ps = palavrasDe(n);
    const nums = n.split(' ').filter((w) => /^\d/.test(w));
    return ps.length > 0 && nums.every((x) => toks.includes(x)) &&
      ps.every((p) => toks.some((w) => w.startsWith(p) || (w.length >= 4 && p.startsWith(w))));
  });
}

const requisitosDe = (l: LinhaPedido) => (l.requisitos || []).filter((t) => normalizar(t) && !GENERICAS.has(normalizar(t)));

/** Usa a ficha quando ela diz algo que a descrição sozinha não resolve bem. */
function usaFicha(catalogo: ItemCatalogo[], l: LinhaPedido): boolean {
  const tipo = raizTipo(l.tipo || '');
  if (!tipo) return false;
  return Boolean(l.pesos_kg?.length || l.composicao?.length || l.comprimento_m || l.capacidade_kg || l.capacidade_pares ||
    l.capacidade_barras || requisitosDe(l).length || /^(suport|barra)/.test(tipo) || !doTipoFicha(catalogo, tipo).length);
}

/** Capacidade que o nome do suporte declara ("10 Pares", "8 Barras", "p/ 200kg", "carga máx. 290Kg"). */
function capacidadesDoNome(nome: string) {
  const n = normalizar(nome);
  const num = (re: RegExp) => { const m = n.match(re); return m ? Number(m[1]) : null; };
  let kg = num(/\b(?:p|para|max|maxima|capacidade|carga)\.? (?:max\.? )?(\d+(?:\.\d+)?) kg\b/);
  if (kg === null) {
    for (const m of n.matchAll(/(?:^|\s)(\d+(?:\.\d+)?) kg\b/g)) {
      if (!/\ba$/.test(n.slice(0, m.index).trim()) && Number(m[1]) >= 50) kg = Number(m[1]);
    }
  }
  return { kg, pares: num(/\b(\d+) pares\b/), barras: num(/\b(\d+) (?:barras|pcs)\b/) } as Record<'kg' | 'pares' | 'barras', number | null>;
}

const ROTULO_CAP = { kg: (v: number) => `${kg(v)} kg`, pares: (v: number) => `${v} pares`, barras: (v: number) => `${v} barras` };

function comporSuporte(cands: ItemCatalogo[], l: LinhaPedido, qtd: number, res: Composicao) {
  const armazena = (l.armazena || []).map(raizTipo).filter(Boolean);
  const aceita = cands.filter((i) => armazena.every((a) => (SINONIMOS[a] || [a]).some((s) => temTermo(i, s))));
  const req = { kg: Number(l.capacidade_kg) || 0, pares: Number(l.capacidade_pares) || 0, barras: Number(l.capacidade_barras) || 0 };
  const chaves = (Object.keys(req) as (keyof typeof req)[]).filter((k) => req[k] > 0);
  const avaliados = aceita.map((i) => {
    const c = capacidadesDoNome(i.nome);
    return {
      i, c,
      falha: chaves.filter((k) => c[k] !== null && c[k]! < req[k]),
      desconhecida: chaves.filter((k) => c[k] === null),
      sobra: chaves.reduce((s, k) => s + (c[k] !== null ? c[k]! - req[k] : 0), 0)
    };
  });
  const ok = avaliados.filter((a) => !a.falha.length)
    .sort((a, b) => a.desconhecida.length - b.desconhecida.length || a.sobra - b.sobra || a.i.preco - b.i.preco);
  const exigido = chaves.map((k) => ROTULO_CAP[k](req[k])).join(', ');
  if (!ok.length) {
    res.naoCotados.push(`"${l.descricao}": nenhum suporte${armazena.length ? ' para ' + (l.armazena || []).join(' e ') : ''}` +
      `${exigido ? ' com capacidade de ' + exigido : ''} no catálogo.`);
    return;
  }
  const e = ok[0];
  res.itens.push({ item: e.i, quantidade: qtd, origem: l.descricao });
  const fora = avaliados.filter((a) => a.falha.length).slice(0, 2)
    .map((a) => `${a.i.cod || a.i.nome} (${a.falha.map((k) => ROTULO_CAP[k](a.c[k]!)).join(', ')})`);
  res.suposicoes.push(`"${l.descricao}": considerei ${nomeComCod(e.i)}` +
    (e.desconhecida.length ? ` — a capacidade (${e.desconhecida.map((k) => ROTULO_CAP[k](req[k])).join(', ')}) não consta no cadastro, confirmar com o fabricante` : '') +
    (fora.length ? `; ${fora.join(', ')} fica fora: o pedido exige ${exigido}` : '') + '.');
}

/** Pesos listados um a um ou composição: uma linha unitária por peso, família por família. */
function comporPesos(cands: ItemCatalogo[], l: LinhaPedido, qtdConjunto: number, res: Composicao) {
  const porPeso = new Map<number, number>();
  if (l.composicao?.length) {
    for (const c of l.composicao) if (c.peso_kg > 0 && c.quantidade > 0) porPeso.set(c.peso_kg, (porPeso.get(c.peso_kg) || 0) + c.quantidade * qtdConjunto);
  } else {
    for (const p of l.pesos_kg || []) if (p > 0) porPeso.set(p, (l.por_par ? 2 : 1) * qtdConjunto);
  }
  if (l.por_par && !l.composicao?.length) {
    res.suposicoes.push(`"${l.descricao}": ${(l.pesos_kg || []).length * qtdConjunto} pares = ${(l.pesos_kg || []).length * qtdConjunto * 2} unidades (cotado por unidade, 2 por par).`);
  }

  const prefs = l.preferencias || [];
  const tipo = raizTipo(l.tipo || '');
  const grupos = new Map<string, Map<number, ItemCatalogo>>();
  for (const it of [...cands].sort((a, b) => a.preco - b.preco)) {
    const p = pesoDoItem(it);
    if (!p) continue;
    const k = nomeFamilia(it.nome);
    if (!grupos.has(k)) grupos.set(k, new Map());
    if (!grupos.get(k)!.has(p)) grupos.get(k)!.set(p, it);
  }
  const fams = [...grupos.entries()].map(([nome, itens]) => {
    const exemplo = [...itens.values()][0];
    return { nome, itens, pref: prefs.filter((t) => temTermo(exemplo, t)).length, exato: primeiraPalavra(nome) === tipo };
  });

  const restantes = new Set(porPeso.keys());
  const usadas: { f: typeof fams[number]; pesos: number[] }[] = [];
  while (restantes.size) {
    const opcoes = fams.map((f) => ({ f, pesos: [...restantes].filter((p) => f.itens.has(p)) })).filter((x) => x.pesos.length);
    if (!opcoes.length) break;
    const custo = (x: typeof opcoes[number]) => x.pesos.reduce((s, p) => s + x.f.itens.get(p)!.preco * porPeso.get(p)!, 0);
    opcoes.sort((a, b) => b.f.pref - a.f.pref || Number(b.f.exato) - Number(a.f.exato) || b.pesos.length - a.pesos.length || custo(a) - custo(b));
    usadas.push(opcoes[0]);
    opcoes[0].pesos.forEach((p) => restantes.delete(p));
  }

  for (const p of [...porPeso.keys()].sort((a, b) => a - b)) {
    const u = usadas.find((x) => x.pesos.includes(p));
    if (u) res.itens.push({ item: u.f.itens.get(p)!, quantidade: porPeso.get(p)!, origem: l.descricao });
  }
  for (const u of usadas) {
    const ps = u.pesos.sort((a, b) => a - b);
    res.composicoes.push(`${l.descricao}: ${u.f.nome} ${ps.map(kg).join('/')} kg (${ps.map((p) => porPeso.get(p)).join('/')} un)`);
  }
  if (usadas.length > 1) {
    const [a, ...outras] = usadas;
    res.suposicoes.push(`"${l.descricao}": ${outras.map((u) => `${u.pesos.map(kg).join('/')} kg em "${u.f.nome}"`).join('; ')}, porque "${a.f.nome}" não tem esses pesos.`);
  }
  if (restantes.size) {
    res.naoCotados.push(`"${l.descricao}": ${[...restantes].sort((a, b) => a - b).map(kg).join('/')} kg sem ${l.tipo} correspondente no catálogo.`);
  }
}

function comporPorFicha(catalogo: ItemCatalogo[], l: LinhaPedido, qtd: number, res: Composicao) {
  const tipo = raizTipo(l.tipo || '');
  const doTipoTodos = doTipoFicha(catalogo, tipo);
  if (!doTipoTodos.length) {
    res.naoCotados.push(`"${l.descricao}": não há ${l.tipo} no catálogo.`);
    return;
  }
  const reqs = requisitosDe(l);
  let cands = doTipoTodos.filter((i) => reqs.every((t) => temTermo(i, t)));
  if (l.comprimento_m) cands = cands.filter((i) => numerosDe(normalizar(i.nome)).has(Number(l.comprimento_m)));
  if (!cands.length) {
    const exige = [...reqs, l.comprimento_m ? `${kg(Number(l.comprimento_m))} m` : ''].filter(Boolean).join(', ');
    res.naoCotados.push(`"${l.descricao}": nenhum(a) ${l.tipo} ${exige} no catálogo.`);
    return;
  }
  if (/^suport/.test(tipo)) return comporSuporte(cands, l, qtd, res);
  if (l.pesos_kg?.length || l.composicao?.length) return comporPesos(cands, l, qtd, res);

  // Item único: preferências do pedido, depois a regra do óbvio (cromada, 4 rolamentos, 20 kg), depois o preço
  const prefs = l.preferencias || [];
  const obvio = (i: ItemCatalogo) => ['cromad', '4 rolamentos'].filter((t) => temTermo(i, t)).length + Number(pesoDoItem(i) === 20);
  const ordem = [...cands].sort((a, b) =>
    prefs.filter((t) => temTermo(b, t)).length - prefs.filter((t) => temTermo(a, t)).length ||
    obvio(b) - obvio(a) || a.preco - b.preco);
  const e = ordem[0];
  res.itens.push({ item: e, quantidade: qtd, origem: l.descricao });
  const alt = ordem.slice(1, 3).map((i) => `"${i.nome}"`).join(' / ');
  res.suposicoes.push(`"${l.descricao}": considerei ${nomeComCod(e)}${alt ? ` — se for ${alt}, me avisa` : ''}.`);
}

function resolverLinha(catalogo: ItemCatalogo[], l: LinhaPedido, res: Composicao) {
  const informada = l.quantidade_informada !== false && Number(l.quantidade) > 0;
  const qtd = informada ? Number(l.quantidade) : 1;
  const porPeso = Boolean(l.pesos_kg?.length || l.composicao?.length);
  if (!informada && !porPeso) res.suposicoes.push(`"${l.descricao}": quantidade não informada, considerei 1${lerFaixa(l.descricao) ? ' de cada peso' : ''}.`);

  if (usaFicha(catalogo, l)) {
    // Nome ou código idêntico (dono escolheu uma opção da lista) decide antes da ficha
    const alvo = normalizar(l.descricao);
    const identico = catalogo.filter((i) => normalizar(i.nome) === alvo || (i.cod && normalizar(i.cod) === alvo));
    if (identico.length === 1) {
      res.itens.push({ item: identico[0], quantidade: qtd, origem: l.descricao });
      return;
    }
    comporPorFicha(catalogo, l, qtd, res);
    return;
  }

  if (barraComprida(catalogo, l, res)) return;
  const tipoPedido = tipoDoPedido(catalogo, l.descricao);
  const r = resolverItem(catalogo, l.descricao);
  // Item de outro tipo (kettlebell → suporte de kettlebell) nunca entra direto
  if (r.status === 'ok' && (!tipoPedido || mesmoTipo(primeiraPalavra(r.item.nome), tipoPedido))) {
    res.itens.push({ item: r.item, quantidade: qtd, origem: l.descricao });
    if (r.suposicao) res.suposicoes.push(`"${l.descricao}": ${r.suposicao}`);
    return;
  }
  if (r.status === 'ambiguo') {
    const mesmo = doTipo(r.opcoes, tipoPedido);
    const ops = [...(mesmo.length ? mesmo : r.opcoes)].sort((a, b) => extrasDoItem(a, l.descricao) - extrasDoItem(b, l.descricao));
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
  const tipo = tipoPedido;
  const base = r.status === 'nao_encontrado' && r.sugestoes.length ? r.sugestoes : buscarNoCatalogo(catalogo, l.descricao);
  let sugestoes = doTipo(base, tipo);
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
      const unidade = /\bkg\b/.test(normalizar(l.descricao)) ? ' kg' : '';
      res.perguntas.push(`Não tem "${l.descricao}" no catálogo: nenhuma ${nomeTipo} de ${pedidos.map(kg).join(' / ')}${unidade}.` +
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
  const res: Composicao = { itens: [], perguntas: [], suposicoes: [], composicoes: [], naoCotados: [] };
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
