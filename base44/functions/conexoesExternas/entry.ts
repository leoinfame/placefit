// Área "Conexões externas" — SOMENTE LEITURA.
//
// POST /functions/conexoesExternas  { revendedor_id?: "..." }  (admin pode olhar outra revenda)
//
// Monta o status de cada canal de publicação da revenda a partir do que os canos
// já gravam em LojaConfig (wa_*, google_*, ml_*), da mesma regra do feed
// (buildCatalogoMeta) e, no Google, do status por produto na Merchant API da conta
// PlaceFit (GOOGLE_MERCHANT_ID), filtrado pelos itens da revenda (offerId = SupplierProduct.id).
//
// Não grava nada, não chama os feeds, não altera sincronização e NUNCA devolve tokens.
// Alertas são calculados (sem log de erro gravado — isso é a fase (b), com schema).

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { buildCatalogoMeta } from "../../shared/metaCatalog.ts";

const BUILD = "2026-10-12-conexoes-v1";
const LOJA_URL_PADRAO = (Deno.env.get("APP_PUBLIC_URL") || "https://placefit.base44.app").replace(/\/+$/, "") + "/loja";

// Limites combinados com o Leandro (12/10/2026)
const LIMITE_WA_HORAS = 3;      // feed da Meta é horário
const LIMITE_GOOGLE_HORAS = 36; // feed do Google é diário

const horasDesde = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : null);
const fmtHoras = (h: number) => (h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`);

type Alerta = { nivel: "erro" | "aviso"; msg: string; em?: string | null };
type Canal = {
  id: string;
  nome: string;
  status: "desconectado" | "conectado" | "ativo" | "pausado" | "erro" | "em_breve";
  ultima_sync: string | null;
  ultima_sync_label: string;
  contagem: number | null;
  contagem_label: string;
  alertas: Alerta[];
  detalhes?: Record<string, unknown>;
  em_breve?: boolean;
};

// ── Google: token da conta de serviço (mesmo padrão do código antigo, escopo content) ──
function b64url(s: string | Uint8Array) {
  const str = typeof s === "string" ? btoa(s) : btoa(String.fromCharCode(...s));
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function tokenGoogle(cred: any) {
  const now = Math.floor(Date.now() / 1000);
  const entrada = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: cred.client_email, scope: "https://www.googleapis.com/auth/content",
    aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now,
  }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(cred.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(entrada)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${entrada}.${b64url(sig)}` }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`token Google ${res.status}: ${data.error_description || data.error || "falhou"}`);
  return data.access_token as string;
}

/** Status por produto na Merchant API (conta PlaceFit), só dos offerIds da revenda. */
async function statusMerchant(offerIds: Set<string>) {
  const merchantId = Deno.env.get("GOOGLE_MERCHANT_ID");
  const credJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!merchantId || !credJson) return { ok: false, erro: "GOOGLE_MERCHANT_ID ou GOOGLE_SERVICE_ACCOUNT_JSON não configurados" };
  const token = await tokenGoogle(JSON.parse(credJson));

  let aprovados = 0, reprovados = 0, pendentes = 0, encontrados = 0;
  const motivos: Record<string, number> = {};
  const reprovadosLista: Array<{ offer_id: string; titulo: string; motivos: string[] }> = [];
  let pageToken = "";
  for (let pagina = 0; pagina < 50; pagina++) {
    const url = new URL(`https://merchantapi.googleapis.com/products/v1/accounts/${merchantId}/products`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, erro: `Merchant API ${res.status}: ${data?.error?.message || "sem acesso"}` };

    for (const p of data.products || []) {
      const offer = String(p.offerId || "");
      if (!offerIds.has(offer)) continue;
      encontrados++;
      const st = p.productStatus || {};
      const destinos = st.destinationStatuses || [];
      const temReprovado = destinos.some((d: any) => (d.disapprovedCountries || []).length);
      const temAprovado = destinos.some((d: any) => (d.approvedCountries || []).length);
      // Motivo da reprovação: os problemas que reprovam; se a API não marcar, todos os que impactam
      const todos = (st.itemLevelIssues || []).filter((i: any) => i.severity !== "NOT_IMPACTED");
      const reprovam = todos.filter((i: any) => i.severity === "DISAPPROVED");
      const problemas = reprovam.length ? reprovam : todos;
      if (temReprovado && !temAprovado) {
        reprovados++;
        const descr = [...new Set(problemas.map((i: any) => String(i.description || i.code || "motivo não informado")))] as string[];
        for (const d of descr) motivos[d] = (motivos[d] || 0) + 1;
        if (reprovadosLista.length < 100) {
          reprovadosLista.push({ offer_id: offer, titulo: String(p.productAttributes?.title || p.attributes?.title || ""), motivos: descr });
        }
      } else if (temAprovado) aprovados++;
      else pendentes++;
    }
    pageToken = data.nextPageToken || "";
    if (!pageToken) break;
  }
  const motivosOrdenados = Object.entries(motivos).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([motivo, qtd]) => ({ motivo, qtd }));
  return { ok: true, encontrados, aprovados, reprovados, pendentes, motivos: motivosOrdenados, reprovados_lista: reprovadosLista };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);

    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Não autorizado" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const revendedorId = body?.revendedor_id || me.id;
    if (revendedorId !== me.id && me.role !== "admin") {
      return Response.json({ error: "Loja de outra revenda" }, { status: 403 });
    }

    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ revendedor_id: revendedorId });
    const config = configs?.[0];
    if (!config) return Response.json({ build: BUILD, loja: null, canais: [] });

    const alertasGerais: Alerta[] = [];
    if (!config.dominio_loja) {
      alertasGerais.push({ nivel: "aviso", msg: "Sem domínio próprio: o Google e a Meta reprovam links em placefit.base44.app. Configure em Minha Loja." });
    }

    // Mesma regra do feed: o que está indo e o que fica de fora (e por quê)
    const baseUrl = (config.dominio_loja || `${LOJA_URL_PADRAO}/${config.slug}`).replace(/\/+$/, "");
    const { items, stats, semFoto } = await buildCatalogoMeta(base44, config, baseUrl);
    const offerIds = new Set(items.map((i: any) => String(i.id)));

    // ── WhatsApp (catálogo Meta via feed) ──
    const hWa = horasDesde(config.wa_ultima_sync);
    let stWa: Canal["status"] = "desconectado";
    const alWa: Alerta[] = [];
    if (config.wa_feed_token) {
      if (config.wa_sync_ativo === false) stWa = "pausado";
      else if (hWa === null) stWa = "conectado";
      else if (hWa > LIMITE_WA_HORAS) {
        stWa = "erro";
        alWa.push({ nivel: "erro", msg: `A Meta não busca o feed há ${fmtHoras(hWa)} (o normal é de hora em hora).`, em: config.wa_ultima_sync });
      } else stWa = "ativo";
      if (stats.sem_foto) alWa.push({ nivel: "aviso", msg: `${stats.sem_foto} produto(s) ativo(s) fora do catálogo por falta de foto.` });
      if (stats.sem_preco) alWa.push({ nivel: "aviso", msg: `${stats.sem_preco} produto(s) fora por estarem sem preço.` });
    }
    const zap = String(config.whatsapp_contato || "").replace(/\D/g, "");
    const canalWa: Canal = {
      id: "whatsapp",
      nome: "WhatsApp — catálogo",
      status: stWa,
      ultima_sync: config.wa_ultima_sync || null,
      ultima_sync_label: "Última busca da Meta",
      contagem: config.wa_feed_token ? (config.wa_itens_publicados ?? null) : null,
      contagem_label: "produtos no catálogo",
      alertas: [...alWa, ...(config.wa_feed_token ? alertasGerais : [])],
      detalhes: {
        indo_agora: stats.publicados,
        sem_foto: stats.sem_foto,
        sem_foto_lista: semFoto.slice(0, 200),
        link_catalogo: zap ? `https://wa.me/c/${zap.length <= 11 ? "55" + zap : zap}` : null,
        push_instantaneo: Boolean(config.wa_push_ativo && config.wa_catalog_id),
        ultimo_push: config.wa_ultimo_push || null,
      },
    };

    // ── Google Produtos (feed + Merchant API da conta PlaceFit) ──
    const hG = horasDesde(config.google_ultima_sync);
    let stG: Canal["status"] = "desconectado";
    const alG: Alerta[] = [];
    if (config.wa_feed_token && hG !== null) {
      if (config.wa_sync_ativo === false) stG = "pausado";
      else if (hG > LIMITE_GOOGLE_HORAS) {
        stG = "erro";
        alG.push({ nivel: "erro", msg: `O Google não busca o feed há ${fmtHoras(hG)} (o normal é diário).`, em: config.google_ultima_sync });
      } else stG = "ativo";
    }
    let merchant: any = null;
    if (stG !== "desconectado") {
      try { merchant = await statusMerchant(offerIds); }
      catch (e) { merchant = { ok: false, erro: String((e as any)?.message || e).slice(0, 300) }; }
      if (merchant?.ok && merchant.reprovados > 0) {
        if (stG === "ativo") stG = "erro";
        alG.push({ nivel: "erro", msg: `${merchant.reprovados} produto(s) reprovado(s) no Google.`, em: new Date().toISOString() });
      }
      if (merchant && !merchant.ok) alG.push({ nivel: "aviso", msg: `Status por produto indisponível: ${merchant.erro}` });
    }
    const canalGoogle: Canal = {
      id: "google",
      nome: "Google Produtos",
      status: stG,
      ultima_sync: config.google_ultima_sync || null,
      ultima_sync_label: "Última busca do Google",
      contagem: config.google_itens_publicados ?? null,
      contagem_label: "produtos no feed",
      alertas: [...alG, ...(stG !== "desconectado" ? alertasGerais : [])],
      detalhes: { merchant },
    };

    // ── Mercado Livre (card presente, integração na próxima etapa) ──
    const conectadoMl = Boolean(config.ml_user_id);
    const alMl: Alerta[] = [];
    if (conectadoMl && config.ml_expires_at && new Date(config.ml_expires_at).getTime() < Date.now() && !config.ml_refresh_token) {
      alMl.push({ nivel: "erro", msg: "Token do Mercado Livre vencido. Reconecte a conta.", em: config.ml_expires_at });
    }
    const canalMl: Canal = {
      id: "mercadolivre",
      nome: "Mercado Livre",
      status: "em_breve",
      em_breve: true,
      ultima_sync: config.ml_ultima_exportacao || null,
      ultima_sync_label: "Última exportação",
      contagem: conectadoMl ? (config.ml_itens_exportados ?? null) : null,
      contagem_label: "itens exportados",
      alertas: alMl,
      detalhes: { conectado: conectadoMl, apelido: config.ml_nickname || null },
    };

    return Response.json({
      build: BUILD,
      gerado_em: new Date().toISOString(),
      loja: { slug: config.slug, nome: config.nome_loja || config.slug, dominio_proprio: Boolean(config.dominio_loja) },
      canais: [canalWa, canalGoogle, canalMl],
    });
  } catch (error) {
    console.error("conexoesExternas:", error);
    return Response.json({ error: String((error as any)?.message || error) }, { status: 500 });
  }
}
