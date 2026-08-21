// Feed de produtos do revendedor no formato da Meta (Commerce Manager / catalogo do WhatsApp).
//
// POR QUE ESTA FUNCAO EXISTE, SENDO IGUAL A lojaFeedMeta:
// em 20/08/2026 o deploy da lojaFeedMeta congelou -- nem alteracao no proprio entry.ts
// subia, e ela seguia servindo o link antigo (/loja/:slug?produto=<sp_id>, que caia na
// vitrine em vez da pagina do produto). Funcao NOVA deploya na primeira publicacao,
// entao o feed passou a ser servido por aqui. A lojaFeedMeta fica como esta ate o app
// ser republicado; quando isso acontecer, as duas respondem igual e uma pode sair.
//
// GET /functions/catalogoFeedMeta?slug=<slug>&token=<token>&format=csv|xml|json
//
// A Meta busca esta URL de hora em hora. Cada busca regrava os contadores em LojaConfig,
// entao o painel do revendedor mostra quando a Meta passou aqui e quantos itens levou.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { buildCatalogoMeta, itemsToCsv, itemsToXml } from "../../shared/metaCatalog.ts";

// Marcador de versao. E o unico jeito confiavel de saber, de fora, se o deploy pegou
// a ultima alteracao -- inclusive a do modulo compartilhado.
const BUILD = "2026-08-20-link-produto";

// CUIDADO: dentro da funcao, req.url e o endereco INTERNO do dispatcher
// (base44-dispatcher-production...workers.dev/run/<hash>), que responde 401 pra quem
// vem de fora. Nao da pra derivar a URL publica dele -- por isso as constantes abaixo.
const APP_ID = "68c9d5dd3cf0f8fd8a834875";
const FEED_URL_PUBLICA =
  Deno.env.get("APP_FEED_BASE_URL") ||
  `https://base44.app/api/apps/${APP_ID}/functions/catalogoFeedMeta`;
const LOJA_URL_PUBLICA = (Deno.env.get("APP_PUBLIC_URL") || "https://placefit.base44.app").replace(
  /\/+$/,
  "",
);

export default async function (req) {
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const param = (k, def = "") => String(body[k] ?? url.searchParams.get(k) ?? def).trim();

    // Modo info: devolve APENAS a URL publica desta funcao e o build. Sem token,
    // sem dado de loja -- pode ser publico.
    if (param("info")) {
      return Response.json({ feed_base_url: FEED_URL_PUBLICA, build: BUILD });
    }

    const slug = param("slug").toLowerCase();
    const token = param("token");
    const format = param("format", "csv").toLowerCase();

    if (!slug) return Response.json({ error: "slug obrigatorio" }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ slug });
    const config = configs[0];
    if (!config) return Response.json({ error: "Loja nao encontrada" }, { status: 404 });

    if (!config.wa_feed_token) {
      return Response.json(
        { error: "Catalogo do WhatsApp nao ativado para esta loja" },
        { status: 403 },
      );
    }
    if (token !== config.wa_feed_token) {
      return Response.json({ error: "token invalido" }, { status: 403 });
    }
    if (config.wa_sync_ativo === false) {
      return Response.json({ error: "Sincronizacao pausada pelo revendedor" }, { status: 403 });
    }

    // Dominio reivindicavel do revendedor; cai no dominio da plataforma se nao houver.
    // A Meta (assim como o Google) exige que o link do produto aponte para um dominio
    // proprio verificado pelo lojista -- base44.app nao pode ser reivindicado.
    const baseUrl = (config.dominio_loja || LOJA_URL_PUBLICA).replace(/\/+$/, "");
    const { items, stats } = await buildCatalogoMeta(base44, config, baseUrl);

    // Registra a passagem da Meta para o painel do revendedor.
    try {
      await base44.asServiceRole.entities.LojaConfig.update(config.id, {
        wa_ultima_sync: new Date().toISOString(),
        wa_itens_publicados: stats.publicados,
        wa_itens_sem_foto: stats.sem_foto,
      });
    } catch (e) {
      console.error("catalogoFeedMeta: falha ao gravar contadores", e);
    }

    const headersComuns = {
      "Cache-Control": "public, max-age=300",
      "X-PlaceFit-Itens": String(stats.publicados),
      "X-PlaceFit-Sem-Foto": String(stats.sem_foto),
      "X-PlaceFit-Build": BUILD,
    };

    if (format === "json") {
      return Response.json({ stats, items }, { headers: headersComuns });
    }

    if (format === "xml") {
      return new Response(itemsToXml(items, config.nome_loja), {
        headers: {
          ...headersComuns,
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `inline; filename="placefit-${slug}.xml"`,
        },
      });
    }

    return new Response(itemsToCsv(items), {
      headers: {
        ...headersComuns,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `inline; filename="placefit-${slug}.csv"`,
      },
    });
  } catch (error) {
    console.error("catalogoFeedMeta:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}