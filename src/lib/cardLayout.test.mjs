// Teste do layout em 3 faixas (sem DOM). Rodar: deno run src/lib/cardLayout.test.mjs
import { calcularLayout, ESPACO } from "./cardLayout.js";

const MOLDURAS = {
  quadrado: { W: 1080, H: 1080, topo: ESPACO.g, base: ESPACO.g, ui: 1 },
  retrato: { W: 1080, H: 1350, topo: ESPACO.g, base: ESPACO.g, ui: 1.05 },
  vertical: { W: 1080, H: 1920, topo: 250, base: 300, ui: 1.3 },
};
const FOTOS = { deitada: { w: 1400, h: 480 }, alta: { w: 500, h: 1400 }, quadrada: { w: 900, h: 900 } };
const LOGOS = { quadrada: { w: 286, h: 264 }, larga: { w: 1200, h: 200 }, nenhuma: null };

let casos = 0, falhas = 0;
for (const [nm, m] of Object.entries(MOLDURAS)) {
  for (const [nf, foto] of Object.entries(FOTOS)) {
    for (const [nl, logo] of Object.entries(LOGOS)) {
      for (const linhas of [1, 2, 3]) {
        for (const aoLado of [true, false]) {
          casos++;
          const f = Math.round(48 * m.ui);
          const l = calcularLayout({
            W: m.W, H: m.H, topo: m.topo, base: m.base, alturaTopo: Math.round(112 * m.ui),
            logo, badge: { w: Math.round(170 * m.ui), h: Math.round(60 * m.ui) }, foto,
            reservaSombra: Math.round(32 * m.ui), alturaNome: Math.round(linhas * f * 1.1),
            preco: { w: Math.round(520 * m.ui), h: Math.round(92 * m.ui * 1.05) },
            contato: { w: Math.round(330 * m.ui), h: Math.round(40 * m.ui) }, contatoAoLado: aoLado,
          });
          if (l.violacoes.length) { falhas++; console.log("FALHA", nm, nf, nl, linhas, aoLado, l.violacoes); }
          // foto ocupa o maximo da faixa: encosta na largura OU na altura util
          const mi = l.faixas.miolo, fo = l.caixas.foto;
          if (fo && !(Math.abs(fo.w - mi.w) < 1 || Math.abs(fo.h - (mi.h - Math.round(32 * m.ui))) < 1 || fo.w >= foto.w * 4 - 1)) {
            falhas++; console.log("FALHA foto nao maximizada", nm, nf, nl);
          }
        }
      }
    }
  }
}
console.log(`casos=${casos} falhas=${falhas}`);
if (falhas) Deno.exit(1);
