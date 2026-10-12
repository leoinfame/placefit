// TEMPORÁRIA (13/10/2026) — SOMENTE LEITURA — APAGAR logo após o uso.
// Diagnóstico do Mercado Livre da MuscularFit: modelo da conta (tags do usuário) e,
// por domínio, quais atributos o ML marca como PARENT_PK / CHILD_PK / variação.
// Usa o token da loja só aqui dentro; NUNCA devolve token. Protegida por chave (TMP_ML_KEY).

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { getValidToken } from "../../shared/mercadoLivre.ts";

const ML_API = "https://api.mercadolibre.com";
const DOMINIOS = ["MLB-ANKLE_AND_WRIST_WEIGHTS", "MLB-GYM_BARS", "MLB-GYM_HANDLES", "MLB-GYM_WEIGHT_AND_BAR_RACKS", "MLB-WEIGHT_PLATES"];

export default async function (req: Request) {
  const chave = String(Deno.env.get("TMP_ML_KEY") || "");
  if (!chave || req.headers.get("x-tmp-key") !== chave) return Response.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const base44 = createClientFromRequest(req);
    const config = (await base44.asServiceRole.entities.LojaConfig.filter({ revendedor_id: "697aeaf8e4420021ed5caeb1" }))?.[0];
    if (!config) return Response.json({ erro: "loja não encontrada" });
    const token = await getValidToken(base44, config);
    const get = async (path: string) => {
      const r = await fetch(`${ML_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      const t = await r.text();
      let j: any = null; try { j = JSON.parse(t); } catch (_) {}
      return { status: r.status, json: j, texto: j ? null : t.slice(0, 200) };
    };

    const me = await get("/users/me");
    const conta = { status: me.status, id: me.json?.id, site: me.json?.site_id, tags: me.json?.tags || [], user_type: me.json?.user_type };

    const dominios: any = {};
    for (const d of DOMINIOS) {
      const r = await get(`/domains/${d}/technical_specs`);
      // varre a estrutura e junta atributos com tags de PK/variação
      const achados: Record<string, any> = {};
      const varrer = (o: any) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) { o.forEach(varrer); return; }
        if (o.id && (o.tags || o.attribute_tags)) {
          const tags = [].concat(o.tags || [], o.attribute_tags || []).map((x: any) => (typeof x === "string" ? x : JSON.stringify(x)));
          if (tags.some((t: string) => /pk|variation|family/i.test(t))) achados[o.id] = { nome: o.name, tags };
        }
        for (const v of Object.values(o)) varrer(v);
      };
      varrer(r.json);
      dominios[d] = { status: r.status, atributos: achados, erro: r.status !== 200 ? (r.json?.message || r.texto) : null };
    }
    return Response.json({ conta, dominios });
  } catch (e) {
    return Response.json({ erro: String((e as any)?.message || e).slice(0, 400) }, { status: 500 });
  }
}
