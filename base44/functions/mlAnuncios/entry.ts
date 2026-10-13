// Mercado Livre — prévia de preço e exportação (1 anúncio por variação).
// Substitui mlExportarProdutos (que criava anúncio sem guardar o id e duplicava).
//
// POST /functions/mlAnuncios
//   { acao: "previa",   sp_ids: [...], pct_manual?: number }
//   { acao: "exportar", sp_ids: [...], pct_manual?: number, precos: { [sp_id]: preco_final_da_previa } }
//   (admin pode mandar revendedor_id de outra revenda)
//
// Prévia (não grava nada, não cria anúncio): por variação → título, categoria do ML,
// preço PlaceFit, comissão (API listing_prices, Clássico, sem frete grátis; se a
// consulta falhar usa pct_manual), preço final e a ação (criar / atualizar preço).
//
// Exportar: recalcula tudo no servidor; se o preço final mudou desde a prévia, NÃO
// envia aquele item (pede nova prévia). Se a variação já tem MLAnuncio → só atualiza
// o preço do anúncio existente (nunca duplica). Senão cria e grava o mapa em MLAnuncio.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { fetchAllPaged } from "../../shared/metaCatalog.ts";
import { computeStorePrice, fotosPorGrupo, comFotoDoGrupo } from "../../shared/loja.ts";
import {
  getValidToken,
  predictCategory,
  buildItemML,
  createListing,
  updateListingPrice,
  getItem,
  precoComComissao,
  tituloML,
} from "../../shared/mercadoLivre.ts";

const BUILD = "2026-10-13-ml-anuncios-v1";
const MAX_ITENS = 200;
const isHttps = (u: any) => typeof u === "string" && /^https:\/\/\S+$/i.test(u.trim());
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const acao = body.acao === "exportar" ? "exportar" : "previa";
    const revendedorId = body.revendedor_id || me.id;
    if (revendedorId !== me.id && me.role !== "admin") {
      return Response.json({ error: "Loja de outra revenda" }, { status: 403 });
    }
    const spIds: string[] = Array.isArray(body.sp_ids) ? [...new Set<string>(body.sp_ids.map(String))] : [];
    if (!spIds.length) return Response.json({ error: "Selecione ao menos um produto" }, { status: 400 });
    if (spIds.length > MAX_ITENS) return Response.json({ error: `Máximo de ${MAX_ITENS} variações por vez` }, { status: 400 });
    const pctManual = body.pct_manual === "" || body.pct_manual == null ? null : Number(body.pct_manual);
    if (pctManual != null && !(pctManual >= 0 && pctManual < 60)) {
      return Response.json({ error: "Percentual manual deve ficar entre 0 e 59" }, { status: 400 });
    }

    const db = base44.asServiceRole.entities;
    const config = (await db.LojaConfig.filter({ revendedor_id: revendedorId }))[0];
    if (!config) return Response.json({ error: "Loja não encontrada" }, { status: 404 });
    if (!config.ml_user_id) return Response.json({ error: "Mercado Livre não conectado" }, { status: 400 });
    const accessToken = await getValidToken(base44, config);

    const sps = await fetchAllPaged((sort, limit, skip) =>
      db.SupplierProduct.filter({ supplier_id: revendedorId, id: { $in: spIds } }, sort, limit, skip));
    const productIds = [...new Set(sps.map((sp) => sp.product_id).filter(Boolean))];
    const templates = productIds.length
      ? await fetchAllPaged((sort, limit, skip) => db.ProductTemplate.filter({ id: { $in: productIds } }, sort, limit, skip))
      : [];
    const tplById: Record<string, any> = {};
    for (const t of templates) tplById[t.id] = t;

    // Foto do grupo para variações sem foto (mesma regra do feed): precisa dos irmãos do grupo.
    const grupos = [...new Set(templates.map((t) => t.grupo_variacao).filter(Boolean))];
    const irmaos = grupos.length
      ? await fetchAllPaged((sort, limit, skip) => db.ProductTemplate.filter({ grupo_variacao: { $in: grupos } }, sort, limit, skip))
      : [];
    const fotosGrupo = fotosPorGrupo([...templates, ...irmaos]);

    const anuncios = await fetchAllPaged((sort, limit, skip) =>
      db.MLAnuncio.filter({ revendedor_id: revendedorId, supplier_product_id: { $in: spIds } }, sort, limit, skip));
    const anuncioPorSp: Record<string, any> = {};
    for (const a of anuncios) {
      // só vale o anúncio da conta ML conectada agora
      if (a.ml_item_id && (!a.ml_user_id || a.ml_user_id === String(config.ml_user_id))) anuncioPorSp[a.supplier_product_id] = a;
    }

    // Categoria: prevê pelo nome do PAI (todas as variações caem na mesma categoria).
    const catCache: Record<string, string | null> = {};
    const categoria = async (t: any) => {
      const chave = t.grupo_variacao || t.nome;
      if (!(chave in catCache)) catCache[chave] = await predictCategory(accessToken, chave);
      return catCache[chave];
    };

    const itens: any[] = [];
    for (const id of spIds) {
      const sp = sps.find((s) => s.id === id);
      const t0 = sp && tplById[sp.product_id];
      const linha: any = { sp_id: id, nome: t0?.nome || "?", grupo: t0?.grupo_variacao || null, rotulo: t0?.variacao_rotulo || null };
      if (!sp || !t0) { itens.push({ ...linha, ok: false, erro: "Produto não encontrado na sua loja" }); continue; }
      if (sp.disponivel === false || t0.ativo === false) { itens.push({ ...linha, ok: false, erro: "Produto indisponível" }); continue; }
      const t = comFotoDoGrupo(t0, fotosGrupo);
      const base = computeStorePrice(sp);
      linha.titulo = tituloML(t);
      linha.preco_placefit = base;
      linha.foto_do_grupo = t !== t0;
      if (!base || base <= 0) { itens.push({ ...linha, ok: false, erro: "Sem preço" }); continue; }
      if (!isHttps(t.foto)) { itens.push({ ...linha, ok: false, erro: "Sem foto (nem do grupo)" }); continue; }
      const cat = await categoria(t);
      linha.categoria_ml = cat;
      if (!cat) { itens.push({ ...linha, ok: false, erro: "Categoria do ML não encontrada" }); continue; }
      const p = await precoComComissao(accessToken, cat, base, pctManual);
      if (!p.ok) { itens.push({ ...linha, ok: false, erro: p.erro }); continue; }
      const existente = anuncioPorSp[id];
      itens.push({
        ...linha,
        ok: true,
        comissao_fonte: p.fonte,
        comissao_pct: Number(p.pct.toFixed(2)),
        comissao_fixa: p.fixa,
        comissao: p.comissao,
        preco_final: p.preco_final,
        acao: existente ? "atualizar" : "criar",
        ml_item_id: existente?.ml_item_id || null,
        permalink: existente?.permalink || null,
        preco_atual_ml: existente?.preco_enviado ?? null,
        _sp: sp,
        _t: t,
      });
    }

    const publico = (i: any) => { const { _sp, _t, ...r } = i; return r; };

    if (acao === "previa") {
      return Response.json({
        build: BUILD,
        acao,
        conta: config.ml_nickname || null,
        total: itens.length,
        prontos: itens.filter((i) => i.ok).length,
        itens: itens.map(publico),
      });
    }

    // ── Exportar ──
    const precosPrevia = body.precos && typeof body.precos === "object" ? body.precos : {};
    const agora = () => new Date().toISOString();
    const results: any[] = [];
    let criados = 0, atualizados = 0, falhas = 0;

    for (const i of itens) {
      if (!i.ok) { results.push({ ...publico(i), success: false, error: i.erro }); falhas++; continue; }
      const visto = Number(precosPrevia[i.sp_id]);
      if (!(Math.abs(visto - i.preco_final) < 0.01)) {
        results.push({ ...publico(i), success: false, error: `Preço mudou desde a prévia (agora R$ ${i.preco_final.toFixed(2)}). Gere a prévia de novo.` });
        falhas++;
        continue;
      }
      const registro = {
        revendedor_id: revendedorId,
        supplier_product_id: i.sp_id,
        product_id: i._sp.product_id,
        grupo_variacao: i._t.grupo_variacao || "",
        ml_user_id: String(config.ml_user_id),
        categoria_ml: i.categoria_ml,
        titulo: i.titulo,
        preco_placefit: i.preco_placefit,
        comissao_percentual: i.comissao_pct,
        comissao_fixa: i.comissao_fixa,
        comissao_fonte: i.comissao_fonte,
        ultima_sync: agora(),
      };
      const existente = anuncioPorSp[i.sp_id];

      let r: any;
      let recriar = false;
      if (existente) {
        // Anúncio fechado no ML não aceita preço novo → cria outro e troca o mapa.
        const atual = await getItem(accessToken, existente.ml_item_id);
        if (atual && atual.status === "closed") recriar = true;
        else {
          r = await updateListingPrice(accessToken, existente.ml_item_id, i.preco_final);
          if (r.success) {
            await db.MLAnuncio.update(existente.id, { ...registro, preco_enviado: i.preco_final, status: r.status || atual?.status || existente.status, permalink: r.permalink || existente.permalink, erro: "" });
            atualizados++;
          } else {
            await db.MLAnuncio.update(existente.id, { erro: String(r.error).slice(0, 500), ultima_sync: agora() }).catch(() => {});
            falhas++;
          }
          results.push({ ...publico(i), ...r, acao: "atualizar" });
          await pausa(250);
          continue;
        }
      }

      const item = buildItemML(i._sp, i._t, config, i.categoria_ml, i.preco_final);
      r = item ? await createListing(accessToken, item) : { success: false, error: "Produto sem foto HTTPS ou preço inválido" };
      if (r.success) {
        const dados = { ...registro, ml_item_id: r.item_id, permalink: r.permalink || "", preco_enviado: i.preco_final, status: "active", erro: "" };
        if (existente) await db.MLAnuncio.update(existente.id, dados);
        else await db.MLAnuncio.create(dados);
        criados++;
      } else {
        // Guarda a falha só se já existe registro (não cria linha sem anúncio).
        if (existente) await db.MLAnuncio.update(existente.id, { erro: String(r.error).slice(0, 500), ultima_sync: agora() }).catch(() => {});
        falhas++;
      }
      results.push({ ...publico(i), ...r, acao: recriar ? "recriar" : "criar" });
      await pausa(250);
    }

    // Contador do card = anúncios mapeados desta conta
    try {
      const todos = await fetchAllPaged((sort, limit, skip) =>
        db.MLAnuncio.filter({ revendedor_id: revendedorId, ml_user_id: String(config.ml_user_id) }, sort, limit, skip));
      await db.LojaConfig.update(config.id, {
        ml_ultima_exportacao: agora(),
        ml_itens_exportados: todos.filter((a) => a.ml_item_id).length,
      });
    } catch (e) {
      console.error("mlAnuncios: contador", e);
    }

    return Response.json({ build: BUILD, acao, total: itens.length, criados, atualizados, falhas, results });
  } catch (error) {
    console.error("mlAnuncios:", error);
    return Response.json({ error: String((error as any)?.message || error) }, { status: 500 });
  }
}
