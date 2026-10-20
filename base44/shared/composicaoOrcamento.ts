// ─── Composição de itens do orçamento (item 009 / spec 5.2) ─────────────────
// Transforma as linhas do pedido do dono em itens do catálogo, sem chute:
//  - descrição que casa com UM produto → item direto (regra do óbvio com suposição visível);
//  - faixa de peso ("dumbbell montado 12 a 20 kg") → um item por peso da família, somados;
//  - kit + suporte pedido junto → o kit "+ Suporte" do catálogo, sem somar o suporte de novo;
//  - "não achei" só depois de buscar por composição e por palavra-chave; quando há
//    alternativa próxima, vira pergunta numerada com a opção sugerida entre aspas.
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

function resolverLinha(catalogo: ItemCatalogo[], l: LinhaPedido, res: Composicao) {
  const informada = l.quantidade_informada !== false && Number(l.quantidade) > 0;
  const qtd = informada ? Number(l.quantidade) : 1;
  if (!informada) res.suposicoes.push(`"${l.descricao}": quantidade não informada, considerei 1${lerFaixa(l.descricao) ? ' de cada peso' : ''}.`);

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
    for (const fora of palavras) {
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

  // Palavra-chave: a melhor alternativa vira sugestão; "não achei" só sem nenhuma
  const sugestoes = r.sugestoes.length ? r.sugestoes : buscarNoCatalogo(catalogo, l.descricao).slice(0, 4);
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
