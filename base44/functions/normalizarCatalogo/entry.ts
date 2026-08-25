// Manutencao pontual: normaliza a GRAFIA dos nomes do catalogo (ProductTemplate).
//
// POR QUE EXISTE: em 25/08/2026 o catalogo tinha a mesma palavra escrita de tres
// jeitos -- "Dumbell" (1.049), "Dumbbells" (34) e "Dumbbell" (21) -- e a categoria
// gravada como "Dumbells". Isso nao gerava registro duplicado, mas quebrava qualquer
// casamento por igualdade exata (tabela de fabricante, foto de site, feed) e tirava a
// credibilidade do dado. O update_entities do MCP nao faz replace de string: como cada
// nome e unico, a correcao sairia em ~1.083 chamadas. Aqui sai numa varredura so.
//
// GET /functions/normalizarCatalogo                 -> simulacao (nao grava nada)
// GET /functions/normalizarCatalogo?apply=<TOKEN>   -> grava
// GET /functions/normalizarCatalogo?info=1          -> so o build
//
// E IDEMPOTENTE: cada regra so casa o que ainda esta errado, entao rodar de novo
// depois de gravar devolve 0 alteracoes. Pode ser chamada em lotes (?limit=N).
//
// DESCARTAVEL: terminada a normalizacao, esta funcao pode ser apagada.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";

const BUILD = "2026-08-25-normalizacao-dumbbell-v1";

// Gate simples por token. A funcao nao aceita regra vinda de fora -- ela so sabe
// aplicar a lista fixa abaixo --, entao o token existe para impedir que alguem
// dispare a gravacao, nao para proteger um parametro perigoso.
const APPLY_TOKEN = "pf-norm-2026-08-25-9f3c1a7e42";

const PAGE = 500;

const fetchAllPaged = async (fn, sort = "cod", pageSize = PAGE) => {
  const out = [];
  for (let skip = 0; ; skip += pageSize) {
    const page = await fn(sort, pageSize, skip);
    if (!page?.length) break;
    out.push(...page);
    if (page.length < pageSize) break;
  }
  return out;
};

// Troca uma palavra inteira, preservando o resto do nome. Sem regex montada em
// runtime a partir de entrada externa: as regras sao constantes deste arquivo.
const trocarPalavra = (texto, de, para) =>
  texto.replace(new RegExp(`\\b${de}\\b`, "g"), para);

// ---------------------------------------------------------------------------
// Regras de nome. Ordem importa: a de grafia roda antes da de numero.
// ---------------------------------------------------------------------------
function nomeCorrigido(tpl) {
  let n = tpl.nome ?? "";

  // 1. Grafia: "Dumbell" e "Dumbells" estao errados em ingles. So o "b" muda --
  //    o numero (singular/plural) fica como esta, porque em "Kit Dumbbells ..."
  //    o plural e o correto em portugues.
  n = trocarPalavra(n, "Dumbells", "Dumbbells");
  n = trocarPalavra(n, "Dumbell", "Dumbbell");

  // 2. Numero, so na categoria de produto unitario: um template e UMA peca, entao
  //    "Dumbbells Sextavado Pintado 14Kg" vira singular. Nao vale para Kits nem
  //    Suportes, onde o plural descreve o conjunto.
  if ((tpl.categoria === "Dumbells" || tpl.categoria === "Dumbbells") && /^Dumbbells\b/.test(n)) {
    n = n.replace(/^Dumbbells\b/, "Dumbbell");
  }

  // 3. Acentos que ficaram pela metade no cadastro.
  n = trocarPalavra(n, "Macico", "Maciço");
  n = trocarPalavra(n, "Eletrostatica", "Eletrostática");

  return n;
}

function subcategoriaCorrigida(tpl) {
  let s = tpl.subcategoria ?? "";
  if (!s) return s;
  s = trocarPalavra(s, "Dumbells", "Dumbbells");
  s = trocarPalavra(s, "Dumbell", "Dumbbell");
  return s;
}

// Categoria: o enum tinha "Dumbells" (grafia errada), um registro na inexistente
// "Funcional" e um sem categoria nenhuma.
const CATEGORIA_DE_PARA = {
  "Dumbells": "Dumbbells",
  "Funcional": "Acessórios",
  "": "Acessórios",
};

export default async function (req) {
  try {
    const url = new URL(req.url);
    const param = (k, def = "") => String(url.searchParams.get(k) ?? def).trim();

    if (param("info")) return Response.json({ build: BUILD });

    const apply = param("apply");
    const gravar = apply.length > 0;
    if (gravar && apply !== APPLY_TOKEN) {
      return Response.json({ error: "token invalido" }, { status: 403 });
    }
    const limite = Math.min(parseInt(param("limit", "0"), 10) || 100000, 100000);

    const base44 = createClientFromRequest(req);
    const todos = await fetchAllPaged((sort, limit, skip) =>
      base44.asServiceRole.entities.ProductTemplate.filter({}, sort, limit, skip)
    );

    const pendentes = [];
    for (const t of todos) {
      const patch = {};
      const nome = nomeCorrigido(t);
      if (nome && nome !== t.nome) patch.nome = nome;

      const sub = subcategoriaCorrigida(t);
      if (sub && sub !== t.subcategoria) patch.subcategoria = sub;

      const catAtual = t.categoria ?? "";
      if (catAtual in CATEGORIA_DE_PARA) patch.categoria = CATEGORIA_DE_PARA[catAtual];

      if (Object.keys(patch).length) {
        pendentes.push({ id: t.id, cod: t.cod, antes: t.nome, patch });
      }
    }

    const alvo = pendentes.slice(0, limite);
    const resumo = {
      build: BUILD,
      modo: gravar ? "gravando" : "simulacao",
      templates_no_catalogo: todos.length,
      pendentes: pendentes.length,
      nesta_chamada: alvo.length,
      restantes_depois: pendentes.length - alvo.length,
      por_campo: {
        nome: pendentes.filter((p) => "nome" in p.patch).length,
        subcategoria: pendentes.filter((p) => "subcategoria" in p.patch).length,
        categoria: pendentes.filter((p) => "categoria" in p.patch).length,
      },
      amostra: pendentes.slice(0, 12).map((p) => ({ cod: p.cod, antes: p.antes, patch: p.patch })),
    };

    if (!gravar) return Response.json(resumo);

    let ok = 0;
    const erros = [];
    for (const p of alvo) {
      try {
        await base44.asServiceRole.entities.ProductTemplate.update(p.id, p.patch);
        ok++;
      } catch (e) {
        erros.push({ cod: p.cod, erro: String(e?.message ?? e) });
        if (erros.length > 20) break;
      }
    }

    return Response.json({ ...resumo, gravados: ok, erros });
  } catch (error) {
    return Response.json({ error: String(error?.message ?? error) }, { status: 500 });
  }
}
