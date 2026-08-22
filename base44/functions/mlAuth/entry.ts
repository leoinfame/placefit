// OAuth do Mercado Livre -- dois modos:
//
// 1. info=1: devolve a URL de autorizacao para o frontend redirecionar o browser.
//    POST /functions/mlAuth  { info: 1, revendedor_id, slug }
//    -> { auth_url: "https://auth.mercadolivre.com.br/authorization?..." }
//
// 2. callback: o ML redireciona o browser de volta para esta URL com ?code=...&state=...
//    A funcao troca o code por tokens, grava na LojaConfig do revendedor e redireciona
//    o browser de volta para o painel /LojaRevendedor?ml_connected=1.
//
// O state carrega revendedor_id|slug para sabermos qual LojaConfig atualizar.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import {
  mlAuthUrl,
  exchangeCodeForToken,
  getUserInfo,
  APP_URL,
} from "../../shared/mercadoLivre.ts";

const BUILD = "2026-08-21-ml-auth";

export default async function (req) {
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const param = (k: string, def = "") =>
      String(body[k] ?? url.searchParams.get(k) ?? def).trim();

    // Modo info: devolve a URL de autorizacao
    if (param("info")) {
      const revendedorId = param("revendedor_id");
      const slug = param("slug");
      if (!revendedorId) {
        return Response.json({ error: "revendedor_id obrigatorio" }, { status: 400 });
      }
      return Response.json({ auth_url: mlAuthUrl(revendedorId, slug), build: BUILD });
    }

    // Callback do OAuth: ML redireciona com code e state
    const code = param("code");
    const state = param("state");

    if (!code) {
      return Response.json({ error: "code ou info obrigatorio" }, { status: 400 });
    }

    // Trocar code por tokens
    const tokens = await exchangeCodeForToken(code);

    // Parse do state: revendedor_id|slug
    const [revendedorId] = state.split("|");
    if (!revendedorId) {
      return Response.json({ error: "state invalido" }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const configs = await base44.asServiceRole.entities.LojaConfig.filter({
      revendedor_id: revendedorId,
    });
    const config = configs[0];

    if (!config) {
      return Response.json({ error: "LojaConfig nao encontrado" }, { status: 404 });
    }

    // Buscar nickname do vendedor no ML
    let nickname = "";
    try {
      const userInfo = await getUserInfo(tokens.access_token);
      nickname = userInfo?.nickname || "";
    } catch (e) {
      console.error("getUserInfo:", e);
    }

    // Salvar tokens na LojaConfig
    await base44.asServiceRole.entities.LojaConfig.update(config.id, {
      ml_access_token: tokens.access_token,
      ml_refresh_token: tokens.refresh_token,
      ml_expires_at: new Date(
        Date.now() + (tokens.expires_in || 21600) * 1000,
      ).toISOString(),
      ml_user_id: String(tokens.user_id || ""),
      ml_nickname: nickname,
    });

    // Redirecionar de volta para o painel do revendedor
    return new Response(null, {
      status: 302,
      headers: { Location: `${APP_URL()}/LojaRevendedor?ml_connected=1` },
    });
  } catch (error) {
    console.error("mlAuth:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: `${APP_URL()}/LojaRevendedor?ml_error=1` },
    });
  }
}