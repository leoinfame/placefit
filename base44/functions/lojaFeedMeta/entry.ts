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

export default async function (req) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") || "").trim().toLowerCase();
    const token = (url.searchParams.get("token") || "").trim();
    const format = (url.searchParams.get("format") || "csv").trim().toLowerCase();

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

    const baseUrl = (Deno.env.get("APP_PUBLIC_URL") || url.origin).replace(/\/+$/, "");
    const { items, stats } = await buildCatalogoMeta(base44, config, baseUrl);

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
