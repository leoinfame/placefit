// Exporta produtos selecionados do revendedor para sua conta do Mercado Livre.
//
// POST /functions/mlExportarProdutos
//   { revendedor_id: "...", sp_ids: ["sp_id1", "sp_id2", ...] }
//
// Para cada SupplierProduct selecionado:
//   1. Busca o ProductTemplate (nome, foto, descricao, categoria)
//   2. Prediz a categoria do ML a partir do titulo (domain_discovery)
//   3. Monta o anuncio (Novo, Classico, sem frete gratis)
//   4. POST /items no ML
//
// Retorna { total, sucessos, falhas, results: [...] }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { fetchAllPaged } from "../../shared/metaCatalog.ts";
import {
  getValidToken,
  predictCategory,
  buildItemML,
  createListing,
} from "../../shared/mercadoLivre.ts";

const BUILD = "2026-08-21-ml-export";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { revendedor_id, sp_ids } = body;

    if (!revendedor_id || !Array.isArray(sp_ids) || sp_ids.length === 0) {
      return Response.json(
        { error: "revendedor_id e sp_ids[] obrigatorios" },
        { status: 400 },
      );
    }

    // Buscar config da loja
    const configs = await base44.asServiceRole.entities.LojaConfig.filter({
      revendedor_id,
    });
    const config = configs[0];
    if (!config) {
      return Response.json({ error: "Loja nao encontrada" }, { status: 404 });
    }

    // Obter token valido (renova se expirado)
    const accessToken = await getValidToken(base44, config);

    // Buscar SupplierProducts selecionados
    const sps = await fetchAllPaged((sort, limit, skip) =>
      base44.asServiceRole.entities.SupplierProduct.filter(
        { supplier_id: revendedor_id, id: { $in: sp_ids } },
        sort,
        limit,
        skip,
      ),
    );

    // Buscar templates
    const productIds = [...new Set(sps.map((sp) => sp.product_id).filter(Boolean))];
    const templates = productIds.length
      ? await fetchAllPaged((sort, limit, skip) =>
          base44.asServiceRole.entities.ProductTemplate.filter(
            { id: { $in: productIds } },
            sort,
            limit,
            skip,
          ),
        )
      : [];
    const tplById = {};
    for (const t of templates) tplById[t.id] = t;

    const results = [];
    let sucessos = 0;
    let falhas = 0;

    for (const sp of sps) {
      const t = tplById[sp.product_id];
      if (!t) {
        results.push({ sp_id: sp.id, nome: "?", success: false, error: "Template nao encontrado" });
        falhas++;
        continue;
      }

      // Prever categoria no ML
      const categoryId = await predictCategory(accessToken, t.nome);
      if (!categoryId) {
        results.push({
          sp_id: sp.id,
          nome: t.nome,
          success: false,
          error: "Categoria nao encontrada no ML para este titulo",
        });
        falhas++;
        continue;
      }

      // Montar anuncio
      const item = buildItemML(sp, t, config, categoryId);
      if (!item) {
        results.push({
          sp_id: sp.id,
          nome: t.nome,
          success: false,
          error: "Produto sem foto HTTPS ou preco invalido",
        });
        falhas++;
        continue;
      }

      // Criar anuncio no ML
      const result = await createListing(accessToken, item);
      results.push({ sp_id: sp.id, nome: t.nome, ...result });

      if (result.success) sucessos++;
      else falhas++;

      // Pequeno delay para respeitar rate limit do ML
      await new Promise((r) => setTimeout(r, 200));
    }

    // Atualizar config com stats da exportacao
    try {
      await base44.asServiceRole.entities.LojaConfig.update(config.id, {
        ml_ultima_exportacao: new Date().toISOString(),
        ml_itens_exportados: sucessos,
      });
    } catch (e) {
      console.error("Erro ao atualizar config:", e);
    }

    return Response.json({
      success: true,
      total: sps.length,
      sucessos,
      falhas,
      results,
      build: BUILD,
    });
  } catch (error) {
    console.error("mlExportarProdutos:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}