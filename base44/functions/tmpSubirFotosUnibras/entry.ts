// TEMPORARIA (10/10/2026) -- apagar depois de usada.
// Rehospeda no app as 7 fotos da Fundicao Unibras que estavam como hotlink
// (o site responde 403 fora do navegador). As imagens chegam no corpo do POST,
// baixadas antes pelo admin; a funcao so aceita os 7 arquivos cujo SHA-256 esta
// fixo abaixo. Nao altera nenhum ProductTemplate.
//
// GET  ?info=1                           -> so o build
// POST ?run=<TOKEN>  {nome, b64}         -> sobe 1 arquivo, devolve a url no app

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";

const BUILD = "2026-10-10-fotos-unibras-v1";
const TOKEN = "pf-unibras-2026-10-10-4d81a3c6";

const PERMITIDOS: Record<string, string> = {
  "ANILHA-COMUM_2.jpg": "71c2258ca350b3373bd04e45022981590f1ce91081e09b796c1a0c2e9ae6df3f",
  "BOLA-DE-ARREMESSO_.jpg": "bc3fbd438aae8a87155dae4f2380e3c92e80e06367464779e4edbf484afc9d16",
  "HALTER-BOLA_TEXTURIZADO_.jpg": "f217a470c7820048ce538603e9bab07127ea1d91c08c6519bc3f37d0b6809c40",
  "KETTLEBELL_TEXTURIZADO.jpg": "6c854d046eef304d63995945a5a5ff231ab3ffef2ac98a816bc12df535c0c2cd",
  "LUVINHA_PINTADA.jpg": "6695061bccccd91b1eeb96a5e8a4a82e89ece707780eda18c9efbac13da44972",
  "LUVINHA_REVESTIDA.jpg": "1f170ccbdb205942db67b7ee0d2b8f8d676acfe9a2efa22bb8afeb6970ea73f4",
  "TIJOLINHO-BATMAN_PINTADO.jpg": "3e8f9149acb9b2032852e73f0f6eb589770fccfa3be9c395e778ec48641e6ee0",
};

const sha256 = async (b: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)))
    .map((x) => x.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("info")) return Response.json({ build: BUILD });
  if (req.method !== "POST" || url.searchParams.get("run") !== TOKEN) {
    return Response.json({ error: "token" }, { status: 403 });
  }
  const { nome, b64 } = await req.json();
  const esperado = PERMITIDOS[nome];
  if (!esperado) return Response.json({ error: "arquivo nao permitido" }, { status: 400 });

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const hash = await sha256(bytes);
  if (hash !== esperado) return Response.json({ error: "hash diferente", hash }, { status: 400 });

  const base44 = createClientFromRequest(req);
  const file = new File([bytes], `unibras_${nome}`, { type: "image/jpeg" });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return Response.json({ build: BUILD, nome, url: up.file_url, bytes: bytes.length, sha256: hash });
});
