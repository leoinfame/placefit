// Feed de produtos do revendedor no formato do Google Merchant Center.
//
// Mesma fonte da verdade do catalogo do WhatsApp e da vitrine: SupplierProduct
// disponivel x ProductTemplate ativo. Muda so a lista de colunas -- ver
// FEED_COLUMNS_GOOGLE em shared/metaCatalog.ts.
//
// GET /functions/catalogoFeedGoogle?slug=<slug>&token=<token>&format=xml|csv|json
// O padrao aqui e XML (RSS 2.0 com namespace g:), que e o formato nativo do Merchant
// Center -- no feed da Meta o padrao e CSV.
//
// ATENCAO AO DOMINIO DO LINK. O Merchant Center exige que o dominio da pagina de
// destino seja um site verificado e reivindicado pelo lojista. O dominio padrao do app
// (base44.app) e da plataforma, nao do revendedor, entao NAO da para reivindicar.
// Por isso o link sai de LojaConfig.dominio_loja quando preenchido. Sem ele, o feed
// funciona mas o Google reprova os itens por landing page nao reivindicada.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import {
  buildCatalogoMeta,
  itemsToCsv,
  itemsToXml,
  FEED_COLUMNS_GOOGLE,
} from "../../shared/metaCatalog.ts";

const BUILD = "2026-08-20-google-v1";

const APP_ID = "68c9d5dd3cf0f8fd8a834875";
const FEED_URL_PUBLICA =
  Deno.env.get("APP_FEED_BASE_URL_GOOGLE") ||
  `https://base44.app/api/apps/${APP_ID}/functions/catalogoFeedGoogle`;
const LOJA_URL_PADRAO = (Deno.env.get("APP_PUBLIC_URL") || "https://placefit.base44.app").replace(
  /\/+$/,
  "",
);

export default async function (req) {
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const param = (k, def = "") => String(body[k] ?? url.searchParams.get(k) ?? def).trim();

    if (param("info")) {
      return Response.json({ feed_base_url: FEED_URL_PUBLICA, build: BUILD });
    }

    const slug = param("slug").toLowerCase();
    const token = param("token");
    const format = param("format", "xml").toLowerCase();

    if (!slug) return Response.json({ error: "slug obrigatorio" }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ slug });
    const config = configs[0];
    if (!config) return Response.json({ error: "Loja nao encontrada" }, { status: 404 });

    if (!config.wa_feed_token) {
      return Response.json({ error: "Feed nao ativado para esta loja" }, { status: 403 });
    }
    if (token !== config.wa_feed_token) {
      return Response.json({ error: "token invalido" }, { status: 403 });
    }
    if (config.wa_sync_ativo === false) {
      return Response.json({ error: "Sincronizacao pausada pelo revendedor" }, { status: 403 });
    }

    // Dominio reivindicavel do revendedor; cai no dominio da plataforma se nao houver.
    const baseUrl = (config.dominio_loja || LOJA_URL_PADRAO).replace(/\/+$/, "");
    const dominioProprio = !!config.dominio_loja;

    const { items, stats } = await buildCatalogoMeta(base44, config, baseUrl);

    try {
      await base44.asServiceRole.entities.LojaConfig.update(config.id, {
        google_ultima_sync: new Date().toISOString(),
        google_itens_publicados: stats.publicados,
      });
    } catch (e) {
      console.error("catalogoFeedGoogle: falha ao gravar contadores", e);
    }

    const headersComuns = {
      "Cache-Control": "public, max-age=300",
      "X-PlaceFit-Itens": String(stats.publicados),
      "X-PlaceFit-Sem-Foto": String(stats.sem_foto),
      "X-PlaceFit-Build": BUILD,
      // Aviso legivel de fora: se for "0", o Google vai reprovar por landing page
      // em dominio nao reivindicado, por mais que o feed esteja perfeito.
      "X-PlaceFit-Dominio-Proprio": dominioProprio ? "1" : "0",
    };

    if (format === "json") {
      return Response.json(
        { stats, dominio_loja: baseUrl, dominio_proprio: dominioProprio, items },
        { headers: headersComuns },
      );
    }

    if (format === "csv") {
      return new Response(itemsToCsv(items, FEED_COLUMNS_GOOGLE), {
        headers: {
          ...headersComuns,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `inline; filename="google-${slug}.csv"`,
        },
      });
    }

    return new Response(itemsToXml(items, config.nome_loja, FEED_COLUMNS_GOOGLE), {
      headers: {
        ...headersComuns,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `inline; filename="google-${slug}.xml"`,
      },
    });
  } catch (error) {
    console.error("catalogoFeedGoogle:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
