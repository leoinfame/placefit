// Feed de produtos do revendedor no formato da Meta (Commerce Manager / catalogo do WhatsApp).
//
// ESTA FUNCAO PRECISA ESTAR MARCADA COMO PUBLICA no painel do Base44 --
// quem chama e o crawler da Meta, sem sessao. O segredo e o parametro ?token=,
// guardado em LojaConfig.wa_feed_token (nao e adivinhavel a partir do slug).
//
// GET /functions/lojaFeedMeta?slug=<slug>&token=<token>&format=csv|xml
//
// A Meta busca esta URL no intervalo configurado (recomendado: HORARIO).
// Cada busca regrava os contadores em LojaConfig, entao o painel do revendedor
// mostra quando a Meta passou aqui pela ultima vez e quantos itens foram entregues.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { buildCatalogoMeta, itemsToCsv, itemsToXml } from "../../shared/metaCatalog.ts";

// CUIDADO: dentro da funcao, req.url e o endereco INTERNO do dispatcher
// (base44-dispatcher-production...workers.dev/run/<hash>), que responde 401 pra quem
// vem de fora. Nao da pra derivar a URL publica dele -- por isso as duas constantes.
const APP_ID = "68c9d5dd3cf0f8fd8a834875";
const FEED_URL_PUBLICA =
  Deno.env.get("APP_FEED_BASE_URL") ||
  `https://base44.app/api/apps/${APP_ID}/functions/lojaFeedMeta`;
const LOJA_URL_PUBLICA = (Deno.env.get("APP_PUBLIC_URL") || "https://placefit.base44.app").replace(
  /\/+$/,
  "",
);

export default async function (req) {
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const param = (k, def = "") =>
      String(body[k] ?? url.searchParams.get(k) ?? def).trim();

    // Modo info: devolve APENAS a URL publica desta propria funcao, para o painel do
    // revendedor montar o link do feed sem precisar adivinhar o dominio do app.
    // Nao expoe token nem dado de loja, entao pode ser publico.
    if (param("info")) {
      return Response.json({ feed_base_url: FEED_URL_PUBLICA });
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

    const { items, stats } = await buildCatalogoMeta(base44, config, LOJA_URL_PUBLICA);

    // Registra a passagem da Meta para o painel do revendedor.
    try {
      await base44.asServiceRole.entities.LojaConfig.update(config.id, {
        wa_ultima_sync: new Date().toISOString(),
        wa_itens_publicados: stats.publicados,
        wa_itens_sem_foto: stats.sem_foto,
      });
    } catch (e) {
      console.error("lojaFeedMeta: falha ao gravar contadores", e);
    }

    const headersComuns = {
      "Cache-Control": "public, max-age=300",
      "X-PlaceFit-Itens": String(stats.publicados),
      "X-PlaceFit-Sem-Foto": String(stats.sem_foto),
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
    console.error("lojaFeedMeta:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
