// Renderizador de cards de produto FORA do navegador (Node + @napi-rs/canvas).
// Usa exatamente o mesmo desenho de src/lib/cardRender.js (mesmo layout, cores
// e fontes da tela "Gerar card"), so trocando as APIs do navegador por polyfills.
// Motivo: o runtime de funcoes do Base44 bloqueia WebAssembly, entao o PNG nao
// pode ser desenhado no servidor; a automacao de campanhas roda isto no sandbox.
//
// Uso:
//   cd automacao && npm i --no-save @napi-rs/canvas@0.1.65 && node render-card.mjs jobs.json saida/
// jobs.json: [{ id, proporcao, nome, peso_kg, und, preco_final, foto_url,
//               marca: { nome, logo_url, cor_primaria, cor_secundaria, estilo_fundo, whatsapp } }]
import fs from "node:fs";
import path from "node:path";
import { createCanvas, Image as NImage, GlobalFonts, Path2D } from "@napi-rs/canvas";

// ---------------- polyfills do navegador ----------------
function novoCanvas() {
  const c = createCanvas(1, 1);
  c.toBlob = (cb, tipo = "image/png") => {
    const buffer = c.toBuffer(tipo === "image/jpeg" ? "image/jpeg" : "image/png");
    cb({ buffer, type: tipo });
  };
  return c;
}
globalThis.document = {
  createElement: (tag) => {
    if (tag !== "canvas") throw new Error(`createElement(${tag}) nao suportado`);
    return novoCanvas();
  },
  fonts: { add() {} },
};
// O Image nativo do @napi-rs/canvas ja aceita data URI, onload/onerror e naturalWidth.
globalThis.Image = NImage;
globalThis.Path2D = Path2D;
globalThis.FontFace = class FontFace {
  constructor(familia, src) {
    this.familia = familia;
    this.url = /url\(([^)]+)\)/.exec(src)?.[1];
  }
  async load() {
    const r = await fetch(this.url);
    if (!r.ok) throw new Error(`fonte ${r.status}`);
    GlobalFonts.register(Buffer.from(await r.arrayBuffer()), this.familia);
  }
};

// ---------------- mesmo pacote que gerarCardProduto monta ----------------
const formatarPreco = (v) => "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const formatarPeso = (kg) => (Number.isInteger(kg) ? String(kg) : String(kg).replace(".", ",")) + " kg";

async function dataUri(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    const tipo =
      b[0] === 0x89 && b[1] === 0x50 ? "image/png" :
      b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" :
      b[0] === 0x47 && b[1] === 0x49 ? "image/gif" :
      b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 ? "image/webp" : null;
    return tipo ? `data:${tipo};base64,${b.toString("base64")}` : null;
  } catch {
    return null;
  }
}

async function montarPacote(j) {
  const [foto, logo] = await Promise.all([dataUri(j.foto_url), dataUri(j.marca.logo_url)]);
  return {
    proporcao: j.proporcao,
    dados: {
      nome: j.nome,
      peso_kg: j.peso_kg ?? null,
      und: j.und ?? null,
      preco_final: j.preco_final,
      preco_texto: formatarPreco(j.preco_final),
      peso_texto: j.peso_kg != null ? formatarPeso(j.peso_kg) : null,
      marca: {
        nome: j.marca.nome,
        cor_primaria: j.marca.cor_primaria ?? null,
        cor_secundaria: j.marca.cor_secundaria ?? null,
        estilo_fundo: j.marca.estilo_fundo || "gradiente",
        whatsapp: j.marca.whatsapp ?? null,
      },
    },
    imagens: { foto, logo, fundo: null },
  };
}

// ---------------- execucao ----------------
const [, , arqJobs, pastaSaida = "saida"] = process.argv;
const { renderCardImagem } = await import("../src/lib/cardRender.js");
const jobs = JSON.parse(fs.readFileSync(arqJobs, "utf8"));
fs.mkdirSync(pastaSaida, { recursive: true });
const resultado = [];
for (const j of jobs) {
  try {
    const pacote = await montarPacote(j);
    const blob = await renderCardImagem(pacote, j.proporcao);
    const arq = path.join(pastaSaida, `${j.id}-${j.proporcao}.png`);
    fs.writeFileSync(arq, blob.buffer);
    resultado.push({ id: j.id, proporcao: j.proporcao, arquivo: arq, bytes: blob.buffer.length, foto: !!pacote.imagens.foto, logo: !!pacote.imagens.logo, violacoes: blob.violacoes || [] });
  } catch (e) {
    resultado.push({ id: j.id, proporcao: j.proporcao, erro: e.message });
  }
}
console.log(JSON.stringify(resultado, null, 1));
