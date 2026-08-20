// Monta o catalogo de um revendedor no formato da Meta (WhatsApp / Commerce Manager).
//
// Fonte da verdade: exatamente a mesma do e-commerce (getStoreData) --
// SupplierProduct do revendedor com disponivel !== false, juntado ao ProductTemplate ativo.
// "Ativou no PlaceFit" => "aparece no WhatsApp". Nao existe segunda lista pra manter.
//
// Regra de escopo definida com o Leandro (16/08/2026): so entra item com FOTO real.
// A Meta rejeita item sem image_link, entao publicar sem foto sujaria o catalogo inteiro.
// Os que ficam de fora sao contados em stats.sem_foto e aparecem no painel do revendedor.

import { computeStorePrice } from "./loja.ts";

// Colunas do feed da Meta (catalogo do WhatsApp / Commerce Manager).
export const FEED_COLUMNS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "brand",
  "item_group_id",
  "product_type",
  "google_product_category",
  "quantity_to_sell_on_facebook",
];

// Colunas do feed do Google Merchant Center.
// Duas diferencas que importam em relacao ao da Meta:
//   - sem `quantity_to_sell_on_facebook`, que e campo da Meta;
//   - com `mpn` + `identifier_exists`. O Google exige gtin OU mpn; quando o produto
//     nao tem nenhum dos dois, `identifier_exists: no` e OBRIGATORIO, senao ele
//     reprova o item por "identificador ausente". Nenhum ProductTemplate tem gtin hoje.
export const FEED_COLUMNS_GOOGLE = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "brand",
  "item_group_id",
  "product_type",
  "google_product_category",
  "gtin",
  "mpn",
  "identifier_exists",
];

export const fetchAllPaged = async (fn, sort = "-created_date", pageSize = 500) => {
  let all = [];
  let skip = 0;
  while (true) {
    const batch = await fn(sort, pageSize, skip);
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
};

// Mesma normalizacao de nome/agrupamento do getStoreData, para que a variacao de peso
// caia sob o mesmo item_group_id no catalogo da Meta.
const baseName = (nome) => (nome || "").replace(/\s+\d+([.,]\d+)?\s*kg$/i, "").trim();

const groupKey = (t) =>
  [
    baseName(t.nome),
    t.categoria,
    t.subcategoria,
    t.tipo_anilha,
    t.tipo_furo,
    t.acabamento,
    t.pegada,
    t.barra_acabamento,
    t.bojo_formato,
    t.dumbell_tipo,
    t.piso_formato,
    t.tijolinho_tipo,
  ]
    .map((v) => v ?? "")
    .join("|");

// djb2 -> base36. item_group_id precisa ser curto, estavel e sem caractere exotico.
const shortHash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "g" + h.toString(36);
};

const clean = (s, max) => {
  const out = String(s ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return max && out.length > max ? out.slice(0, max - 1).trim() + "…" : out;
};

const isHttps = (u) => typeof u === "string" && /^https:\/\/\S+$/i.test(u.trim());

// Preco de venda ao cliente final, ANTES da promocao (preco de fabrica + margem do revendedor).
const precoCheio = (sp) => {
  const base = Number(sp.preco) || 0;
  const margem = Number(sp.margem) || 0;
  return Math.round(base * (1 + margem / 100) * 100) / 100;
};

// Motivos pelos quais um vinculo NAO vira item de catalogo.
export const MOTIVO = {
  OK: "ok",
  INDISPONIVEL: "indisponivel",
  TEMPLATE_INATIVO: "template_inativo",
  SEM_PRECO: "sem_preco",
  SEM_FOTO: "sem_foto",
};

/**
 * Converte UM par (SupplierProduct, ProductTemplate) em item de catalogo Meta.
 * Retorna { item: null, motivo } quando o produto nao pode ser publicado.
 * Usada tanto pelo feed quanto pelo push instantaneo, para que os dois nunca divirjam.
 */
export function buildItemMeta(sp, t, config, baseUrl) {
  if (!sp || sp.disponivel === false || !sp.product_id) {
    return { item: null, motivo: MOTIVO.INDISPONIVEL };
  }
  if (!t || t.ativo === false) return { item: null, motivo: MOTIVO.TEMPLATE_INATIVO };

  const cheio = precoCheio(sp);
  const efetivo = computeStorePrice(sp);
  if (!cheio || cheio <= 0 || !efetivo || efetivo <= 0) {
    return { item: null, motivo: MOTIVO.SEM_PRECO };
  }
  if (!isHttps(t.foto)) return { item: null, motivo: MOTIVO.SEM_FOTO };

  // Pagina do produto: rota /loja/:slug/produto/:cod em App.jsx, onde :cod e o COD DO
  // TEMPLATE (LojaProduto.jsx casa com v.cod), nao o id do SupplierProduct.
  // Sem o cod nao ha pagina individual -- cai na vitrine, entao mandamos para a loja.
  const loja = `${baseUrl}/loja/${config.slug}`;
  const link = t.cod ? `${loja}/produto/${encodeURIComponent(t.cod)}` : loja;
  const marca = clean(sp.fabricante_nome || config.nome_loja || "PlaceFit", 100);

  // O nome do fabricante NAO vai na descricao que o cliente final le (Leandro, 16/08/2026).
  // Alem de nao montar mais o trecho, removemos ele de descricao_padrao que ja o tenha,
  // por casamento literal com o nome do fabricante -- nada de regex, que comeria
  // razao social com ponto no meio ("Ind. e Com. Ltda").
  const semFabricante = (s) => {
    let out = String(s ?? "");
    if (sp.fabricante_nome) {
      for (const alvo of [`Fabricante: ${sp.fabricante_nome}.`, `Fabricante: ${sp.fabricante_nome}`]) {
        out = out.split(alvo).join(" ");
      }
    }
    return out;
  };

  const descricao = clean(
    semFabricante(
      t.descricao_padrao || [t.nome, `Vendido por ${config.nome_loja}`].filter(Boolean).join(". "),
    ),
    9000,
  );

  // price = preco cheio; sale_price = promocional, so quando realmente menor.
  // A Meta mostra o riscado corretamente e o preco efetivo bate com a vitrine.
  const temPromo = efetivo < cheio;

  return {
    motivo: MOTIVO.OK,
    item: {
      id: sp.id,
      title: clean(t.nome, 200),
      description: descricao,
      availability: "in stock",
      condition: "new",
      price: `${cheio.toFixed(2)} BRL`,
      sale_price: temPromo ? `${efetivo.toFixed(2)} BRL` : "",
      link,
      image_link: t.foto.trim(),
      brand: marca,
      item_group_id: shortHash(groupKey(t)),
      product_type: clean([t.categoria, t.subcategoria].filter(Boolean).join(" > "), 750),
      google_product_category: clean(t.google_category || "", 250),
      quantity_to_sell_on_facebook: "100",
      // Identificadores para o Google. O cod_origem e o SKU do proprio fabricante,
      // que e exatamente o que o campo mpn quer dizer.
      gtin: clean(t.gtin || "", 50),
      mpn: clean(sp.cod_origem || "", 70),
      identifier_exists: t.gtin || sp.cod_origem ? "yes" : "no",
    },
  };
}

/**
 * Constroi os itens do catalogo Meta de um revendedor.
 *
 * @param base44   cliente Base44 (usar asServiceRole)
 * @param config   registro LojaConfig do revendedor
 * @param baseUrl  origem publica do app, sem barra final (ex: https://placefit.base44.app)
 * @returns { items, stats }
 */
export async function buildCatalogoMeta(base44, config, baseUrl) {
  const stats = {
    vinculos: 0,
    indisponiveis: 0,
    template_inativo: 0,
    sem_preco: 0,
    sem_foto: 0,
    publicados: 0,
  };

  const sps = await fetchAllPaged((sort, limit, skip) =>
    base44.asServiceRole.entities.SupplierProduct.filter(
      { supplier_id: config.revendedor_id },
      sort,
      limit,
      skip,
    )
  );
  stats.vinculos = sps.length;

  const available = sps.filter((sp) => {
    if (!sp.product_id) return false;
    if (sp.disponivel === false) {
      stats.indisponiveis++;
      return false;
    }
    return true;
  });

  const productIds = [...new Set(available.map((sp) => sp.product_id))];
  const templates = productIds.length
    ? await fetchAllPaged((sort, limit, skip) =>
        base44.asServiceRole.entities.ProductTemplate.filter(
          { id: { $in: productIds } },
          sort,
          limit,
          skip,
        )
      )
    : [];
  const tplById = {};
  for (const t of templates) tplById[t.id] = t;

  const items = [];
  const semFoto = [];

  for (const sp of available) {
    const t = tplById[sp.product_id];
    const { item, motivo } = buildItemMeta(sp, t, config, baseUrl);
    if (item) {
      items.push(item);
      continue;
    }
    if (motivo === MOTIVO.TEMPLATE_INATIVO) stats.template_inativo++;
    else if (motivo === MOTIVO.SEM_PRECO) stats.sem_preco++;
    else if (motivo === MOTIVO.SEM_FOTO) {
      stats.sem_foto++;
      if (semFoto.length < 200 && t) {
        semFoto.push({ cod: t.cod, nome: t.nome, product_id: t.id });
      }
    } else stats.indisponiveis++;
  }

  stats.publicados = items.length;
  return { items, stats, semFoto };
}

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function itemsToCsv(items, colunas = FEED_COLUMNS) {
  const linhas = [colunas.join(",")];
  for (const it of items) linhas.push(colunas.map((c) => csvCell(it[c])).join(","));
  return linhas.join("\n") + "\n";
}

const xmlEsc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function itemsToXml(items, nomeLoja, colunas = FEED_COLUMNS) {
  const entradas = items
    .map((it) => {
      const campos = colunas.filter((c) => it[c] !== "" && it[c] != null)
        .map((c) => `      <g:${c}>${xmlEsc(it[c])}</g:${c}>`)
        .join("\n");
      return `    <item>\n${campos}\n    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEsc(nomeLoja)}</title>
    <link>https://www.facebook.com/business/help</link>
    <description>Catalogo PlaceFit</description>
${entradas}
  </channel>
</rss>
`;
}

// Formato do endpoint POST /{catalog_id}/items_batch (item_type PRODUCT_ITEM),
// que usa os mesmos nomes de campo do feed, com "id" fazendo papel de retailer_id.
export function itemsToBatchRequests(items, method = "UPDATE") {
  return items.map((it) => {
    const data = { ...it };
    for (const k of Object.keys(data)) if (data[k] === "" || data[k] == null) delete data[k];
    return { method, data };
  });
}
