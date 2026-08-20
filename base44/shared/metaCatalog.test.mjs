// Testes do mapeamento PlaceFit -> catalogo Meta (WhatsApp).
// Rodar (Node < 22 nao carrega .ts direto, entao copiamos os dois modulos como .mjs):
//
//   cd /app && mkdir -p /tmp/mc \
//     && sed 's#\./loja\.ts#./loja.mjs#' base44/shared/metaCatalog.ts > /tmp/mc/metaCatalog.mjs \
//     && cp base44/shared/loja.ts /tmp/mc/loja.mjs \
//     && sed 's#\./metaCatalog\.ts#/tmp/mc/metaCatalog.mjs#' base44/shared/metaCatalog.test.mjs > /tmp/mc/t.mjs \
//     && node /tmp/mc/t.mjs
//
// (Em Node 22+ da pra rodar direto: node base44/shared/metaCatalog.test.mjs)
//
// Cobre as regras que, se quebrarem, publicam preco errado no WhatsApp do revendedor:
// preco cheio x promocional, foto obrigatoria em https, agrupamento por variacao de peso
// e escape de CSV.

import {
  buildItemMeta,
  itemsToCsv,
  itemsToBatchRequests,
  MOTIVO,
  FEED_COLUMNS_GOOGLE,
} from "./metaCatalog.ts";

const cfg = { slug: "muscularfitcombr", nome_loja: "MuscularFit" };
const base = "https://placefit.base44.app";
const T = (o) => ({
  id: "t1",
  nome: "Anilha Sport Emborrachada Olímpica 20kg",
  cod: "ASRO20",
  foto: "https://x.com/a.jpg",
  ativo: true,
  categoria: "Anilhas",
  subcategoria: "Anilha Sport",
  ...o,
});
const S = (o) => ({
  id: "sp1",
  product_id: "t1",
  preco: 100,
  margem: 0,
  disponivel: true,
  fabricante_nome: "Metal Forma",
  ...o,
});

let falhas = 0;
const eq = (nome, got, exp) => {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) {
    falhas++;
    console.log(`FALHOU: ${nome}\n  obtido: ${JSON.stringify(got)}\n  esperado: ${JSON.stringify(exp)}`);
  } else console.log("ok:", nome);
};

eq("preco sem margem", buildItemMeta(S(), T(), cfg, base).item.price, "100.00 BRL");
eq("preco com margem 30%", buildItemMeta(S({ margem: 30 }), T(), cfg, base).item.price, "130.00 BRL");

{
  const it = buildItemMeta(S({ margem: 30, sale_price: 99.9 }), T(), cfg, base).item;
  eq("promo mantem price cheio", it.price, "130.00 BRL");
  eq("promo preenche sale_price", it.sale_price, "99.90 BRL");
}

eq("sale acima do cheio nao vira promo", buildItemMeta(S({ sale_price: 150 }), T(), cfg, base).item.sale_price, "");
eq("sem foto sai do catalogo", buildItemMeta(S(), T({ foto: "" }), cfg, base).motivo, MOTIVO.SEM_FOTO);
eq("foto http simples e recusada", buildItemMeta(S(), T({ foto: "http://x.com/a.jpg" }), cfg, base).motivo, MOTIVO.SEM_FOTO);
eq("indisponivel", buildItemMeta(S({ disponivel: false }), T(), cfg, base).motivo, MOTIVO.INDISPONIVEL);
eq("template inativo", buildItemMeta(S(), T({ ativo: false }), cfg, base).motivo, MOTIVO.TEMPLATE_INATIVO);
eq("preco zero", buildItemMeta(S({ preco: 0 }), T(), cfg, base).motivo, MOTIVO.SEM_PRECO);
// O link tem que abrir a PAGINA DO PRODUTO (/loja/:slug/produto/:cod), nao a vitrine.
// :cod e o cod do template -- e assim que LojaProduto.jsx acha a variacao.
eq(
  "link abre a pagina do produto pelo cod",
  buildItemMeta(S(), T(), cfg, base).item.link,
  "https://placefit.base44.app/loja/muscularfitcombr/produto/ASRO20",
);
eq(
  "cod com caractere especial vai escapado",
  buildItemMeta(S(), T({ cod: "BAR MON/INJ" }), cfg, base).item.link,
  "https://placefit.base44.app/loja/muscularfitcombr/produto/BAR%20MON%2FINJ",
);
eq(
  "template sem cod cai na vitrine, nao em URL quebrada",
  buildItemMeta(S(), T({ cod: "" }), cfg, base).item.link,
  "https://placefit.base44.app/loja/muscularfitcombr",
);

{
  const a = buildItemMeta(S(), T({ nome: "Anilha Sport Emborrachada Olímpica 20kg" }), cfg, base).item;
  const b = buildItemMeta(S({ id: "sp2" }), T({ nome: "Anilha Sport Emborrachada Olímpica 5kg" }), cfg, base).item;
  eq("variacoes de peso compartilham item_group_id", a.item_group_id === b.item_group_id, true);
  const c = buildItemMeta(S({ id: "sp3" }), T({ nome: "Kettlebell Pintado 20kg", categoria: "Kettlebells" }), cfg, base).item;
  eq("produto diferente muda item_group_id", a.item_group_id !== c.item_group_id, true);
}

{
  const it = buildItemMeta(S(), T({ nome: 'Kit "Pro", 1 a 10kg', descricao_padrao: "linha1\nlinha2" }), cfg, base).item;
  const linha = itemsToCsv([it]).split("\n")[1];
  eq("CSV escapa aspas e virgula", linha.startsWith('sp1,"Kit ""Pro"", 1 a 10kg"'), true);
  eq("descricao sem quebra de linha", /\r|\n/.test(it.description), false);
}

{
  const it = buildItemMeta(S(), T({ google_category: "" }), cfg, base).item;
  const req = itemsToBatchRequests([it])[0];
  eq("batch usa UPDATE", req.method, "UPDATE");
  eq("batch omite sale_price vazio", "sale_price" in req.data, false);
  eq("batch omite google_product_category vazio", "google_product_category" in req.data, false);
}

// O cliente final nao pode ler o nome do fabricante na descricao.
{
  const semDescr = buildItemMeta(S(), T(), cfg, base).item.description;
  eq("descricao montada nao cita fabricante", /Fabricante/i.test(semDescr), false);
  eq("descricao montada mantem 'Vendido por'", semDescr, "Anilha Sport Emborrachada Olímpica 20kg. Vendido por MuscularFit");

  const comDescr = buildItemMeta(
    S(),
    T({ descricao_padrao: "Anilha 20kg. Fabricante: Metal Forma. Ideal para academia." }),
    cfg,
    base,
  ).item.description;
  eq("descricao_padrao tem o fabricante removido", /Fabricante/i.test(comDescr), false);
  eq("resto da descricao_padrao sobrevive", comDescr, "Anilha 20kg. Ideal para academia.");

  // Razao social com ponto no meio nao pode ser cortada pela metade.
  const pontos = buildItemMeta(
    S({ fabricante_nome: "Ind. e Com. Muscular Ltda" }),
    T({ descricao_padrao: "Anilha 20kg. Fabricante: Ind. e Com. Muscular Ltda. Pronta entrega." }),
    cfg,
    base,
  ).item.description;
  eq("razao social com ponto sai inteira", pontos, "Anilha 20kg. Pronta entrega.");
}

// Google Merchant Center: sem gtin nem mpn, `identifier_exists: no` e obrigatorio,
// senao ele reprova o item por identificador ausente.
{
  const semId = buildItemMeta(S({ cod_origem: "" }), T(), cfg, base).item;
  eq("sem gtin/mpn marca identifier_exists=no", semId.identifier_exists, "no");
  eq("sem gtin/mpn deixa mpn vazio", semId.mpn, "");

  const comMpn = buildItemMeta(S({ cod_origem: "MF-4477" }), T(), cfg, base).item;
  eq("cod_origem do fabricante vira mpn", comMpn.mpn, "MF-4477");
  eq("com mpn marca identifier_exists=yes", comMpn.identifier_exists, "yes");

  const comGtin = buildItemMeta(S({ cod_origem: "" }), T({ gtin: "7891234567895" }), cfg, base).item;
  eq("gtin do template entra no feed", comGtin.gtin, "7891234567895");
  eq("com gtin marca identifier_exists=yes", comGtin.identifier_exists, "yes");

  // O feed do Google nao pode carregar coluna da Meta.
  const cab = itemsToCsv([semId], FEED_COLUMNS_GOOGLE).split("\n")[0];
  eq("feed Google sem coluna da Meta", cab.includes("quantity_to_sell_on_facebook"), false);
  eq("feed Google tem identifier_exists", cab.includes("identifier_exists"), true);
  eq("feed Meta mantem a coluna dela", itemsToCsv([semId]).split("\n")[0].includes("quantity_to_sell_on_facebook"), true);
}

eq("titulo cortado em 200", buildItemMeta(S(), T({ nome: "A".repeat(400) }), cfg, base).item.title.length <= 200, true);

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
