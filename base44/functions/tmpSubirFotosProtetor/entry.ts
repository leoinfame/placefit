// TEMPORARIA (10/10/2026) -- apagar depois de usada.
// Baixa as 8 fotos aprovadas pelo Leandro para os produtos que estavam com a foto
// do "Protetor de Barra" e guarda no armazenamento do proprio app (sem hotlink).
// Lista fixa: nao aceita URL vinda de fora. Nao altera nenhum ProductTemplate.
//
// GET ?info=1          -> so o build
// GET ?run=<TOKEN>     -> baixa e sobe, devolve { chave: url_no_app }

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";

const BUILD = "2026-10-10-fotos-protetor-v1";
const TOKEN = "pf-fotos-2026-10-10-7c2e91b4";

const AHB = "https://anilhasehalteresbrasil.com.br/wp-content/uploads";
const FOTOS: Record<string, string> = {
  powerbag: `${AHB}/2020/02/20200218_145633.jpg`,
  corda_naval_emborrachada: `${AHB}/2019/03/corda-naval.jpg`,
  corda_naval_revestida: `${AHB}/2020/02/20200204_151956-1.jpg`,
  cinto_tracao: `${AHB}/2019/03/Sem-titulo.jpeg`,
  corda_escalada: "https://crossrigs.com.br/wp-content/uploads/2026/02/corda-nautica-usada-.jpeg",
  fita_trx: `${AHB}/2019/07/060920036413828.jpg`,
  slide_board: `${AHB}/2019/03/slideboard-1.png`,
  elastico_pegada_dupla: `${AHB}/2019/07/El%C3%A1stico-Extensor-com-Pegada-Dupla-Imagem-06.jpg`,
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("info")) return Response.json({ build: BUILD });
  if (url.searchParams.get("run") !== TOKEN) return Response.json({ error: "token" }, { status: 403 });

  const base44 = createClientFromRequest(req);
  const out: Record<string, unknown> = {};
  for (const [chave, src] of Object.entries(FOTOS)) {
    try {
      const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } });
      const tipo = r.headers.get("content-type") || "";
      if (!r.ok || !tipo.startsWith("image/")) { out[chave] = { erro: `${r.status} ${tipo}` }; continue; }
      const bytes = new Uint8Array(await r.arrayBuffer());
      const ext = tipo.includes("png") ? "png" : "jpg";
      const file = new File([bytes], `${chave}.${ext}`, { type: tipo });
      const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      out[chave] = { url: up.file_url, bytes: bytes.length, origem: src };
    } catch (e) {
      out[chave] = { erro: String(e) };
    }
  }
  return Response.json({ build: BUILD, fotos: out });
});
