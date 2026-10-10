// Teste das cores do card (sem DOM). Rodar: deno run src/lib/cardCores.test.mjs
import { extrairCoresDePixels, resolverPaleta, contraste, ESTILOS_FUNDO, hexParaRgb } from "./cardCores.js";

let ok = 0, falhas = 0;
const t = (c, m) => { if (c) ok++; else { falhas++; console.log("FALHA", m); } };

// logo sintetica: pixels RGBA de cada cor na quantidade dada (+ branco e transparente)
const logo = (cores) => {
  const px = [];
  for (const [hex, n] of cores) { const [r, g, b] = hexParaRgb(hex); for (let i = 0; i < n; i++) px.push(r, g, b, 255); }
  for (let i = 0; i < 3000; i++) px.push(255, 255, 255, 255);
  for (let i = 0; i < 3000; i++) px.push(0, 0, 0, 0);
  return new Uint8ClampedArray(px);
};
const perto = (a, b) => Math.hypot(...hexParaRgb(a).map((v, i) => v - hexParaRgb(b)[i])) < 30;

const mf = extrairCoresDePixels(logo([["#ec673c", 900], ["#0c5f6d", 500]]));
t(perto(mf.principal, "#ec673c") && perto(mf.secundaria, "#0c5f6d"), `laranja+azul petroleo -> ${JSON.stringify(mf)}`);
const pf = extrairCoresDePixels(logo([["#111111", 2000], ["#d32f2f", 300]]));
t(perto(pf.principal, "#d32f2f") && perto(pf.secundaria, "#111111"), `preto+vermelho: cor viva vence -> ${JSON.stringify(pf)}`);
const mono = extrairCoresDePixels(logo([["#222222", 800]]));
t(mono && perto(mono.principal, "#222222"), `logo sem cor -> ${JSON.stringify(mono)}`);
t(extrairCoresDePixels(logo([])) === null, "logo vazia -> null");

// contraste garantido em todos os estilos e varias marcas
const marcas = [["#ec673c", "#0c5f6d"], ["#1e40af", "#059669"], ["#facc15", "#1f2937"], ["#111111", "#d32f2f"], ["#f5f5f5", "#e11d48"], ["#22c55e", "#86efac"]];
for (const estilo of ESTILOS_FUNDO) {
  for (const [p, s] of marcas) {
    const pal = resolverPaleta({ principal: p, secundaria: s, estilo });
    const tag = `${estilo} ${p}/${s}`;
    t(contraste(pal.painelTexto, pal.painel) >= 3, `${tag}: texto do rodape`);
    t(contraste(pal.precoCor, pal.painel) >= 3, `${tag}: preco`);
    t(contraste(pal.badgeTexto, pal.badgeFundo) >= 3, `${tag}: badge`);
    t(contraste(pal.textoTopo, pal.base) >= 2.5, `${tag}: texto no fundo`);
    t(pal.paradas.length === 3, `${tag}: gradiente`);
  }
}
t(resolverPaleta({ estilo: "xadrez" }).principal === "#1e40af", "sem cores e estilo invalido -> padrao");
console.log(`ok=${ok} falhas=${falhas}`);
if (falhas) Deno.exit(1);
