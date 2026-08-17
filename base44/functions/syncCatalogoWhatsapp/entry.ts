// FASE 2 -- push instantaneo do produto para o catalogo Meta do revendedor.
//
// Mesmo padrao do syncToGoogleMerchant: e um webhook de entidade, disparado em
// create/update/delete de SupplierProduct, recebendo { event, data, old_data }.
//
// Enquanto a loja nao tiver wa_push_ativo + wa_catalog_id, a funcao nao faz nada --
// o feed agendado (lojaFeedMeta) ja mantem o catalogo em dia de hora em hora.
// Este push so encurta a latencia de ~1h para ~2s.
//
// PRE-REQUISITOS PARA LIGAR:
//   1. O revendedor compartilha o catalogo dele com o Business da PlaceFit
//      (Business Manager > Parceiros > acesso ao catalogo).
//   2. Secret META_CATALOG_TOKEN = token de system user com catalog_management,
//      ou LojaConfig.wa_access_token para um token proprio daquela loja.
//   3. LojaConfig.wa_catalog_id preenchido e wa_push_ativo = true.
//
// ATENCAO: o formato de /items_batch (nomes de campo e formato de preco) diverge do
// endpoint /products de item unico. Antes de ligar em producao, rodar UMA loja e
// conferir o retorno em `resposta_meta` -- ele vem no retorno da funcao de proposito.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { buildItemMeta, itemsToBatchRequests, MOTIVO } from "../../shared/metaCatalog.ts";

const GRAPH = "https://graph.facebook.com/v21.0";

// Campos cuja mudanca precisa chegar ao catalogo. Qualquer outro update e ignorado.
const CAMPOS_RELEVANTES = ["preco", "margem", "sale_price", "disponivel", "product_id"];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();
    const tipo = event?.type;

    if (!data?.supplier_id || !data?.id) {
      return Response.json({ skipped: "sem supplier_id/id" });
    }

    if (tipo === "update" && old_data) {
      const mudou = CAMPOS_RELEVANTES.some((c) => old_data[c] !== data[c]);
      if (!mudou) return Response.json({ skipped: "sem mudanca relevante" });
    }

    // A loja do revendedor dono do vinculo.
    const configs = await base44.asServiceRole.entities.LojaConfig.filter({
      revendedor_id: data.supplier_id,
    });
    const config = configs[0];
    if (!config) return Response.json({ skipped: "revendedor sem loja" });
    if (!config.wa_push_ativo || !config.wa_catalog_id) {
      return Response.json({ skipped: "push instantaneo desligado nesta loja" });
    }

    const token = config.wa_access_token || Deno.env.get("META_CATALOG_TOKEN");
    if (!token) return Response.json({ skipped: "META_CATALOG_TOKEN nao configurado" });

    const baseUrl = (Deno.env.get("APP_PUBLIC_URL") || "https://placefit.base44.app").replace(
      /\/+$/,
      "",
    );

    let requests;
    if (tipo === "delete") {
      requests = [{ method: "DELETE", data: { id: data.id } }];
    } else {
      let template = null;
      try {
        template = await base44.asServiceRole.entities.ProductTemplate.get(data.product_id);
      } catch (_) {
        /* template sumiu: cai no DELETE abaixo */
      }
      const { item, motivo } = buildItemMeta(data, template, config, baseUrl);
      if (item) {
        requests = itemsToBatchRequests([item], "UPDATE");
      } else {
        // Desativado, sem preco, sem foto ou template inativo => sai do catalogo.
        // Nao e erro: e a mesma regra do feed, aplicada na hora.
        requests = [{ method: "DELETE", data: { id: data.id } }];
        console.log(`syncCatalogoWhatsapp: removendo ${data.id} (${motivo})`);
      }
    }

    const resp = await fetch(`${GRAPH}/${config.wa_catalog_id}/items_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        item_type: "PRODUCT_ITEM",
        requests,
      }),
    });

    const resposta_meta = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("syncCatalogoWhatsapp: Meta recusou", JSON.stringify(resposta_meta));
      return Response.json(
        { success: false, sp_id: data.id, requests, resposta_meta },
        { status: 502 },
      );
    }

    try {
      await base44.asServiceRole.entities.LojaConfig.update(config.id, {
        wa_ultimo_push: new Date().toISOString(),
      });
    } catch (_) {
      /* contador e informativo, nao bloqueia */
    }

    return Response.json({
      success: true,
      sp_id: data.id,
      metodo: requests[0].method,
      resposta_meta,
    });
  } catch (error) {
    console.error("syncCatalogoWhatsapp:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
