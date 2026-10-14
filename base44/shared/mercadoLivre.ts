// Integracao com a API do Mercado Livre para exportacao de produtos do revendedor.
//
// OAuth: cada revendedor conecta sua propria conta ML (client_id/secret globais
// da PlaceFit, mas o token e por usuario). O access_token expira em 6h e e
// renovado automaticamente com o refresh_token.
//
// Categoria: mapeamento automatico via domain_discovery do ML -- passa o titulo
// do produto e o ML devolve a categoria mais provavel.
//
// Anuncio: Novo, Clássico (gold_special), sem frete gratis (custom + local_pick_up).

import { computeStorePrice } from "./loja.ts";

const ML_API = "https://api.mercadolibre.com";
const ML_AUTH = "https://auth.mercadolivre.com.br";
const APP_ID = "68c9d5dd3cf0f8fd8a834875";

// URL publica de callback do OAuth -- a mesma que deve estar cadastrada no ML.
const REDIRECT_URI =
  Deno.env.get("ML_REDIRECT_URI") ||
  `https://base44.app/api/apps/${APP_ID}/functions/mlAuth`;

const APP_URL = () =>
  (Deno.env.get("APP_PUBLIC_URL") || "https://placefit.base44.app").replace(/\/+$/, "");

// ── state do OAuth ASSINADO (HMAC-SHA256 com o client secret do app) ──
// Formato: <revendedor_id>.<emitido_em_ms>.<assinatura_hex>. Vale 30 min.
// Sem a assinatura, qualquer um poderia montar um state com o id de outra revenda
// e ligar a própria conta do ML na loja dela.
const STATE_VALIDADE_MS = 30 * 60 * 1000;

async function hmacHex(msg: string): Promise<string> {
  const segredo = Deno.env.get("ML_CLIENT_SECRET") || "";
  if (!segredo) throw new Error("ML_CLIENT_SECRET ausente");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("mlstate:" + segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function assinarState(revendedorId: string): Promise<string> {
  const base = `${revendedorId}.${Date.now()}`;
  return `${base}.${await hmacHex(base)}`;
}

// Devolve o revendedor_id se o state for autêntico e recente; senão null.
export async function validarState(state: string): Promise<string | null> {
  const partes = String(state || "").split(".");
  if (partes.length !== 3) return null;
  const [rev, ts, sig] = partes;
  if (!rev || !/^\d+$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  if (Math.abs(Date.now() - Number(ts)) > STATE_VALIDADE_MS) return null;
  const esperado = await hmacHex(`${rev}.${ts}`);
  let dif = 0; // comparação em tempo constante
  for (let i = 0; i < 64; i++) dif |= esperado.charCodeAt(i) ^ sig.charCodeAt(i);
  return dif === 0 ? rev : null;
}

export async function mlAuthUrl(revendedorId: string): Promise<string> {
  const state = await assinarState(revendedorId);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: Deno.env.get("ML_APP_ID") || "",
    redirect_uri: REDIRECT_URI,
    state,
  });
  return `${ML_AUTH}/authorization?${params}`;
}

export { APP_URL, REDIRECT_URI };

export async function exchangeCodeForToken(code: string) {
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: Deno.env.get("ML_APP_ID") || "",
      client_secret: Deno.env.get("ML_CLIENT_SECRET") || "",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao trocar codigo: ${await res.text()}`);
  return await res.json();
}

export async function refreshToken(refresh_token: string) {
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_APP_ID") || "",
      client_secret: Deno.env.get("ML_CLIENT_SECRET") || "",
      refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao renovar token: ${await res.text()}`);
  return await res.json();
}

// Obtem um access_token valido, renovando automaticamente se estiver expirando.
export async function getValidToken(base44, config: any): Promise<string> {
  if (!config.ml_access_token) throw new Error("Mercado Livre nao conectado");

  const expiresAt = config.ml_expires_at ? new Date(config.ml_expires_at).getTime() : 0;
  const now = Date.now();

  // Token ainda valido (margem de 5 min)
  if (now < expiresAt - 5 * 60 * 1000) {
    return config.ml_access_token;
  }

  // Renovar
  if (!config.ml_refresh_token) {
    // 13/10: o ML só devolve refresh_token quando o app PlaceFit no ML Developers tem a permissão
    // "offline_access". Sem ela a conexão vale só 6 h e cai sozinha, por isso o token "sumia".
    throw new Error("Refresh token ausente - o Mercado Livre não devolveu o token de renovação. Ative a permissão offline_access no app do ML Developers e reconecte o Mercado Livre");
  }

  const tokens = await refreshToken(config.ml_refresh_token);
  await base44.asServiceRole.entities.LojaConfig.update(config.id, {
    ml_access_token: tokens.access_token,
    ml_refresh_token: tokens.refresh_token || config.ml_refresh_token,
    ml_expires_at: new Date(Date.now() + (tokens.expires_in || 21600) * 1000).toISOString(),
  });

  return tokens.access_token;
}

// Cache em memoria de categorias por titulo (uma chamada de exportacao roda no
// mesmo processo, entao evita repetir a mesma predicao para nomes iguais).
const categoryCache: Record<string, string> = {};

export async function predictCategory(accessToken: string, title: string): Promise<string | null> {
  const cleanTitle = String(title || "").slice(0, 255).trim();
  if (!cleanTitle) return null;
  if (categoryCache[cleanTitle]) return categoryCache[cleanTitle];

  const url = `${ML_API}/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(cleanTitle)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].category_id) {
      categoryCache[cleanTitle] = data[0].category_id;
      return data[0].category_id;
    }
  } catch (e) {
    console.error("predictCategory:", e);
  }
  return null;
}

const clean = (s: any, max?: number) => {
  const out = String(s ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return max && out.length > max ? out.slice(0, max - 1).trim() + "…" : out;
};

const isHttps = (u: string) => typeof u === "string" && /^https:\/\/\S+$/i.test((u || "").trim());

// Título do anúncio: 1 anúncio por variação (a conta está no modelo antigo do ML,
// que não aceita variação de peso/medida com preço próprio). Pai + rótulo, até 60
// caracteres, cortando o nome do pai e nunca o rótulo.
export function tituloML(t: any): string {
  const rot = clean(t?.variacao_rotulo);
  const pai = clean(t?.grupo_variacao);
  if (!pai || !rot) return clean(t?.nome, 60);
  const espaco = 60 - rot.length - 1;
  let paiCurto = pai;
  // Longo demais: primeiro tira o trecho entre parênteses, depois corta na última palavra inteira.
  if (paiCurto.length > espaco) paiCurto = clean(paiCurto.replace(/\s*\([^)]*\)/g, " "));
  if (paiCurto.length > espaco) {
    const corte = paiCurto.slice(0, Math.max(espaco, 10) + 1);
    const ult = corte.lastIndexOf(" ");
    paiCurto = (ult > 10 ? corte.slice(0, ult) : corte.slice(0, -1)).replace(/[\s,.;:–-]+$/, "").trim();
  }
  return clean(`${paiCurto} ${rot}`, 60);
}

// ── Comissão do ML (tarifa de venda) ──
// GET /sites/MLB/listing_prices?price=&listing_type_id=gold_special&category_id=
// (exige token). Clássico, sem frete grátis: o vendedor paga só a tarifa de venda
// (percentual da categoria + tarifa fixa por unidade em itens baratos).
const tarifaCache: Record<string, any> = {};

export async function consultarTarifa(accessToken: string, categoryId: string, preco: number) {
  const p = Number(preco.toFixed(2));
  const chave = `${categoryId}|${p}`;
  if (tarifaCache[chave]) return tarifaCache[chave];
  const url = `${ML_API}/sites/MLB/listing_prices?price=${p}&listing_type_id=gold_special&category_id=${encodeURIComponent(categoryId)}&currency_id=BRL`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return { ok: false, erro: data?.message || `HTTP ${res.status}` };
    const lp = Array.isArray(data) ? data.find((x) => x?.listing_type_id === "gold_special") || data[0] : data;
    const det = lp?.sale_fee_details || {};
    const total = Number(lp?.sale_fee_amount);
    let pct = Number(det.percentage_fee ?? det.meli_percentage_fee);
    let fixa = Number(det.fixed_fee) || 0;
    if (!Number.isFinite(pct) && Number.isFinite(total)) pct = ((total - fixa) / p) * 100;
    if (!Number.isFinite(pct) || pct < 0 || pct >= 60) return { ok: false, erro: "Resposta de tarifa sem percentual" };
    const out = { ok: true, pct, fixa, total: Number.isFinite(total) ? total : p * pct / 100 + fixa };
    tarifaCache[chave] = out;
    return out;
  } catch (e) {
    return { ok: false, erro: String((e as any)?.message || e) };
  }
}

// Preço final para o revendedor receber o preço PlaceFit depois da comissão:
// final - (final*pct + fixa) = base  →  final = (base + fixa) / (1 - pct).
// A tarifa fixa depende da faixa de preço do PRÓPRIO preço final, então reconsulta
// no preço calculado até estabilizar (no máx. 3 voltas).
export async function precoComComissao(accessToken: string | null, categoryId: string | null, base: number, pctManual: number | null) {
  const calc = (pct: number, fixa: number) => Math.ceil(((base + fixa) / (1 - pct / 100)) * 100) / 100;
  if (accessToken && categoryId) {
    let t = await consultarTarifa(accessToken, categoryId, base);
    if (t.ok) {
      let final = calc(t.pct, t.fixa);
      for (let i = 0; i < 3; i++) {
        const t2 = await consultarTarifa(accessToken, categoryId, final);
        if (!t2.ok) break;
        const novo = calc(t2.pct, t2.fixa);
        t = t2;
        if (Math.abs(novo - final) < 0.01) { final = novo; break; }
        final = novo;
      }
      return { ok: true, fonte: "api", pct: t.pct, fixa: t.fixa, comissao: Number((final - base).toFixed(2)), preco_final: final };
    }
    if (pctManual == null) return { ok: false, erro: `Comissão não consultada: ${t.erro}` };
  }
  if (pctManual == null || !(pctManual >= 0 && pctManual < 60)) return { ok: false, erro: "Sem comissão da API e sem percentual manual" };
  const final = calc(pctManual, 0);
  return { ok: true, fonte: "manual", pct: pctManual, fixa: 0, comissao: Number((final - base).toFixed(2)), preco_final: final };
}

// Monta o payload do anuncio no ML a partir de um SupplierProduct + ProductTemplate.
// Retorna null quando o produto nao pode ser exportado (sem foto ou sem preco).
// precoFinal: preço já com a comissão (da prévia); sem ele usa o preço da loja.
export function buildItemML(sp: any, t: any, config: any, categoryId: string, precoFinal?: number, atributos?: any[]) {
  const preco = precoFinal || computeStorePrice(sp);
  if (!preco || preco <= 0) return null;
  if (!isHttps(t.foto)) return null;

  // Remove o nome do fabricante da descricao (mesma regra do feed Meta/Google).
  const semFabricante = (s: string) => {
    let out = String(s ?? "");
    if (sp.fabricante_nome) {
      for (const alvo of [`Fabricante: ${sp.fabricante_nome}.`, `Fabricante: ${sp.fabricante_nome}`]) {
        out = out.split(alvo).join(" ");
      }
    }
    return out;
  };

  const descricao = clean(
    semFabricante(t.descricao_padrao || [t.nome, `Vendido por ${config.nome_loja}`].filter(Boolean).join(". ")),
    50000,
  );

  return {
    title: tituloML(t),
    category_id: categoryId,
    price: Number(preco.toFixed(2)),
    currency_id: "BRL",
    available_quantity: 50,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "gold_special", // Clássico
    description: { plain_text: descricao },
    pictures: [{ source: t.foto.trim() }],
    ...(atributos && atributos.length ? { attributes: atributos } : {}),
    shipping: {
      mode: "custom",
      local_pick_up: true, // Sem frete gratis - combinado com o vendedor
    },
  };
}

// ── Atributos obrigatórios da categoria (13/10) ──
// O ML recusa o anúncio quando falta atributo obrigatório (na categoria Anilhas MLB67502: Marca e
// Peso total; GTIN/motivo e quantidade por embalagem são condicionais). Busca a lista da categoria
// e preenche o que dá a partir do cadastro; o que não dá volta como motivo claro de falha.
const attrCache: Record<string, any[]> = {};
export async function atributosDaCategoria(categoryId: string): Promise<any[]> {
  if (attrCache[categoryId]) return attrCache[categoryId];
  try {
    const res = await fetch(`${ML_API}/categories/${encodeURIComponent(categoryId)}/attributes`);
    const data = res.ok ? await res.json() : [];
    attrCache[categoryId] = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("atributosDaCategoria:", e);
    attrCache[categoryId] = [];
  }
  return attrCache[categoryId];
}

const pesoKg = (t: any): number | null => {
  const n = Number(t?.peso_kg);
  if (Number.isFinite(n) && n > 0) return n;
  const m = String(t?.variacao_rotulo || t?.nome || "").replace(",", ".").match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  return m ? Number(m[1]) : null;
};

export function montarAtributos(t: any, config: any, attrs: any[]): { atributos: any[]; faltando: string[] } {
  const atributos: any[] = [];
  const faltando: string[] = [];
  const tem = (id: string) => attrs.some((a) => a.id === id);
  const obrig = (a: any) => a?.tags?.required || a?.tags?.catalog_required;
  const nomeTxt = `${t?.nome || ""} ${t?.variacao_rotulo || ""}`;

  const marca = clean(t?.marca) || clean(config?.nome_loja) || "Genérica";
  if (tem("BRAND")) atributos.push({ id: "BRAND", value_name: marca });
  if (tem("MODEL")) atributos.push({ id: "MODEL", value_name: clean(t?.grupo_variacao || t?.nome, 255) });

  const peso = pesoKg(t);
  // Só o peso do produto (não embalagem, não espessura)
  for (const id of ["TOTAL_WEIGHT", "WEIGHT"]) {
    if (peso && tem(id)) atributos.push({ id, value_name: `${peso} kg` });
  }

  if (tem("UNITS_PER_PACK")) atributos.push({ id: "UNITS_PER_PACK", value_name: /\(par\)|\bpar\b/i.test(nomeTxt) ? "2" : "1" });

  const gtin = clean(t?.gtin);
  if (gtin && tem("GTIN")) atributos.push({ id: "GTIN", value_name: gtin });
  else if (tem("EMPTY_GTIN_REASON")) {
    const motivo = attrs.find((a) => a.id === "EMPTY_GTIN_REASON")?.values?.find((v: any) => /não tem código|no tiene código/i.test(v.name));
    if (motivo) atributos.push({ id: "EMPTY_GTIN_REASON", value_id: String(motivo.id) });
  }

  const preenchidos = new Set(atributos.map((a) => a.id));
  for (const a of attrs) {
    if (obrig(a) && !preenchidos.has(a.id)) faltando.push(a.name || a.id);
  }
  return { atributos, faltando };
}

// Mensagem legível a partir do erro da API do ML (todas as causas, não só a primeira).
const CAUSAS_CONHECIDAS: Record<string, string> = {
  address_pending: "a conta do Mercado Livre está sem endereço cadastrado (cadastre em Minha conta > Meus dados > Endereços no ML)",
};
export function mensagemErroML(data: any, status: number): string {
  const causas = Array.isArray(data?.cause) ? data.cause : [];
  const partes = causas
    .map((c: any) => (typeof c === "string" ? CAUSAS_CONHECIDAS[c] || c : c?.message || c?.code))
    .filter(Boolean);
  const base = data?.message === "seller.unable_to_list" ? "Conta do ML impedida de anunciar" : data?.message || `HTTP ${status}`;
  return partes.length ? `${base}: ${partes.join("; ")}` : base;
}

export async function createListing(accessToken: string, item: any) {
  const res = await fetch(`${ML_API}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = mensagemErroML(data, res.status);
    // 13/10: grava o erro completo no log (antes nada ficava registrado e não dava para saber o motivo)
    console.error("ML createListing falhou:", res.status, item?.title, JSON.stringify(data).slice(0, 2000));
    return { success: false, error: msg };
  }
  return { success: true, item_id: data.id, permalink: data.permalink };
}

// Situação da conta: se o ML permite anunciar e, se não, por quê.
export function contaPodeAnunciar(userInfo: any): { ok: boolean; motivo?: string } {
  const list = userInfo?.status?.list;
  if (!list || list.allow !== false) return { ok: true };
  const codigos: string[] = Array.isArray(list.codes) ? list.codes : [];
  return { ok: false, motivo: mensagemErroML({ message: "seller.unable_to_list", cause: codigos }, 403) };
}

// Atualiza preço de um anúncio que já existe (não mexe em título, foto nem status:
// título não pode mudar depois de ter venda, e pausa feita no ML é respeitada).
export async function updateListingPrice(accessToken: string, itemId: string, price: number) {
  const res = await fetch(`${ML_API}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ price: Number(price.toFixed(2)) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = mensagemErroML(data, res.status);
    console.error("ML updateListingPrice falhou:", res.status, itemId, JSON.stringify(data).slice(0, 2000));
    return { success: false, error: msg };
  }
  return { success: true, item_id: data.id, permalink: data.permalink, status: data.status };
}

export async function getItem(accessToken: string, itemId: string) {
  const res = await fetch(`${ML_API}/items/${encodeURIComponent(itemId)}?attributes=id,status,permalink,price,title`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function getUserInfo(accessToken: string) {
  const res = await fetch(`${ML_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}