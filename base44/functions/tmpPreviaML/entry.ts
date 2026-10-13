// TEMPORÁRIA (13/10/2026) — teste SÓ LEITURA da prévia de comissão do ML com a conta real.
// Protegida por chave (x-tmp-key = TMP_ML_KEY). Não cria anúncio, não grava MLAnuncio. Apagar após o teste.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { fetchAllPaged } from "../../shared/metaCatalog.ts";
import { computeStorePrice } from "../../shared/loja.ts";
import { getValidToken, predictCategory, consultarTarifa, precoComComissao, tituloML } from "../../shared/mercadoLivre.ts";

export default async function (req) {
  const chave = Deno.env.get("TMP_ML_KEY") || "";
  if (!chave || req.headers.get("x-tmp-key") !== chave) return Response.json({ error: "no" }, { status: 403 });
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const config = (await db.LojaConfig.filter({ slug: "muscularfitcombr" }))[0];
    const token = await getValidToken(base44, config);
    // resposta crua de 1 consulta (sem token no retorno)
    const cru = await fetch(`https://api.mercadolibre.com/sites/MLB/listing_prices?price=49.9&listing_type_id=gold_special&category_id=MLB123095&currency_id=BRL`, { headers: { Authorization: `Bearer ${token}` } });
    const cruJson = await cru.json().catch(() => null);
    const tpls = await fetchAllPaged((s, l, k) => db.ProductTemplate.filter({ grupo_variacao: { $in: ["Caneleira (Par)", "Barra Maciça Cromada Recartilhada Reta c/ Lock Press Mini"] } }, s, l, k));
    const ids = tpls.map((t) => t.id);
    const sps = await fetchAllPaged((s, l, k) => db.SupplierProduct.filter({ supplier_id: config.revendedor_id, product_id: { $in: ids } }, s, l, k));
    const byId = Object.fromEntries(tpls.map((t) => [t.id, t]));
    const amostra = sps.filter((sp) => sp.disponivel !== false).slice(0, 8);
    const linhas = [];
    const cats = {};
    for (const sp of amostra) {
      const t = byId[sp.product_id];
      const g = t.grupo_variacao || t.nome;
      cats[g] = cats[g] ?? (await predictCategory(token, g));
      const base = computeStorePrice(sp);
      linhas.push({ titulo: tituloML(t), categoria: cats[g], base, ...(await precoComComissao(token, cats[g], base, null)) });
    }
    const outras = {};
    for (const c of ["MLB12219", "MLB260546", "MLB272148", "MLB67502"]) outras[c] = await consultarTarifa(token, c, 150);
    return Response.json({ status_cru: cru.status, cru: cruJson, linhas, outras });
  } catch (e) {
    return Response.json({ error: String((e as any)?.message || e) }, { status: 500 });
  }
}
