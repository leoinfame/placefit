// Testes do mapeamento PlaceFit -> catalogo Meta (WhatsApp).
// Rodar (o Node do sandbox e v20 e nao carrega .ts direto; freteLoja.ts ainda tem
// anotacao de tipo, entao o esbuild resolve tudo de uma vez):
//
//   cd /app && mkdir -p /tmp/mc \
//     && npx esbuild base44/shared/metaCatalog.test.mjs --bundle --format=esm \
//          --platform=node --outfile=/tmp/mc/bundle.mjs \
//     && node /tmp/mc/bundle.mjs
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
  itemsToXml,
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

// A marca e a loja, nunca o fabricante -- vale mesmo quando o vinculo tem fabricante.
eq("marca e a loja", buildItemMeta(S(), T(), cfg, base).item.brand, "MuscularFit");
eq(
  "marca ignora o fabricante do vinculo",
  buildItemMeta(S({ fabricante_nome: "Metal Forma" }), T(), cfg, base).item.brand,
  "MuscularFit",
);

// Frete: mesma tabela da vitrine, tarifa minima do estado (faixa ate 500kg).
{
  const it = buildItemMeta(S(), T({ peso_kg: 20 }), cfg, base).item;
  const sp = it.shipping.find((s) => s.region === "SP");
  const am = it.shipping.find((s) => s.region === "AM");
  eq("frete SP vem da tabela", sp.price, "450.00 BRL");
  eq("frete AM vem da tabela", am.price, "950.00 BRL");
  eq("frete cobre os 27 estados", it.shipping.length, 27);
  eq("peso do envio declarado", it.shipping_weight, "20 kg");
  eq("produto sem peso nao declara peso", buildItemMeta(S(), T({ peso_kg: 0 }), cfg, base).item.shipping_weight, "");

  // CSV: grupos pais:regiao:servico:preco numa celula so, entre aspas.
  const linha = itemsToCsv([it], FEED_COLUMNS_GOOGLE).split("\n")[1];
  eq("CSV traz o grupo de frete de SP", linha.includes("BR:SP::450.00 BRL"), true);

  // XML: bloco aninhado e repetido.
  const xml = itemsToXml([it], "MuscularFit", FEED_COLUMNS_GOOGLE);
  eq("XML repete o bloco de frete por estado", (xml.match(/<g:shipping>/g) || []).length, 27);
  eq("XML aninha regiao dentro do frete", xml.includes("<g:region>SP</g:region>"), true);

  // O batch da Meta nao pode levar campo do Google (shipping e array, quebraria).
  const data = itemsToBatchRequests([it])[0].data;
  eq("batch da Meta sem shipping", "shipping" in data, false);
  eq("batch da Meta sem mpn", "mpn" in data, false);
  eq("batch da Meta mantem o preco", data.price, "100.00 BRL");
}

eq("titulo cortado em 200", buildItemMeta(S(), T({ nome: "A".repeat(400) }), cfg, base).item.title.length <= 200, true);

console.log(falhas === 0 ? "\nTODOS OS TESTES PASSARAM" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
