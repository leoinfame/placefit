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

export function mlAuthUrl(revendedorId: string, slug: string): string {
  const state = `${revendedorId}|${slug}`;
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
    throw new Error("Refresh token ausente - reconecte o Mercado Livre");
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

// Monta o payload do anuncio no ML a partir de um SupplierProduct + ProductTemplate.
// Retorna null quando o produto nao pode ser exportado (sem foto ou sem preco).
export function buildItemML(sp: any, t: any, config: any, categoryId: string) {
  const preco = computeStorePrice(sp);
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
    title: clean(t.nome, 60),
    category_id: categoryId,
    price: Number(preco.toFixed(2)),
    currency_id: "BRL",
    available_quantity: 50,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "gold_special", // Clássico
    description: { plain_text: descricao },
    pictures: [{ source: t.foto.trim() }],
    shipping: {
      mode: "custom",
      local_pick_up: true, // Sem frete gratis - combinado com o vendedor
    },
  };
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
    const msg =
      data.message ||
      (Array.isArray(data.cause) && data.cause[0]?.message) ||
      `HTTP ${res.status}`;
    return { success: false, error: msg };
  }
  return { success: true, item_id: data.id, permalink: data.permalink };
}

export async function getUserInfo(accessToken: string) {
  const res = await fetch(`${ML_API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}