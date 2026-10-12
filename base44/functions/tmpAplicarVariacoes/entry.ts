// TEMPORÁRIA (12/10/2026) — APAGAR logo após o uso.
// Grava grupo_variacao + variacao_rotulo nos 186 ProductTemplate aprovados pelo Leandro
// (grupos G01–G51). Só aceita esses dois campos e só os IDs da lista fixa abaixo.
// Protegida por chave aleatória (segredo TMP_APLICAR_KEY).

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";


export default async function (req: Request) {
  const chave = String(Deno.env.get("TMP_APLICAR_KEY") || "");
  if (!chave || req.headers.get("x-tmp-key") !== chave) return Response.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const base44 = createClientFromRequest(req);
    const PERMITIDOS = new Set<string>(JSON.parse(Deno.env.get("TMP_APLICAR_IDS") || "[]"));
    if (PERMITIDOS.size !== 186) return Response.json({ error: `lista de ids aprovados com ${PERMITIDOS.size} itens` }, { status: 500 });
    const lista = await req.json();
    if (!Array.isArray(lista) || lista.length !== 186) return Response.json({ error: "esperava 186 itens" }, { status: 400 });
    for (const x of lista) {
      if (!PERMITIDOS.has(x.id)) return Response.json({ error: `id fora da lista aprovada: ${x.id}` }, { status: 400 });
      if (!x.grupo_variacao || !x.variacao_rotulo) return Response.json({ error: `campos vazios em ${x.id}` }, { status: 400 });
    }
    const ok: string[] = [];
    const falhas: Array<{ id: string; erro: string }> = [];
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (const x of lista) {
      let erro = "";
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        try {
          await base44.asServiceRole.entities.ProductTemplate.update(x.id, {
            grupo_variacao: String(x.grupo_variacao),
            variacao_rotulo: String(x.variacao_rotulo),
          });
          erro = "";
          break;
        } catch (e) {
          erro = String((e as any)?.message || e).slice(0, 200);
          await espera(2000 * (tentativa + 1));
        }
      }
      if (erro) falhas.push({ id: x.id, erro }); else ok.push(x.id);
      await espera(350);
    }
    return Response.json({ gravados: ok.length, falhas });
  } catch (e) {
    return Response.json({ erro: String((e as any)?.message || e).slice(0, 500) }, { status: 500 });
  }
}
