// Cores do card (puro, sem DOM): contraste, extracao das cores da logo e a
// paleta de cada estilo de fundo. Testavel com: deno run src/lib/cardCores.test.mjs

export const COR_PRINCIPAL_PADRAO = "#1e40af";
export const COR_SECUNDARIA_PADRAO = "#059669";
export const ESTILOS_FUNDO = ["gradiente", "claro", "escuro", "neutro"];

export const hexValido = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());

export const hexParaRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const rgbParaHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

export const luminancia = ([r, g, b]) => {
  const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export const contraste = (a, b) => {
  const [x, y] = [luminancia(hexParaRgb(a)), luminancia(hexParaRgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Todo texto do card e grande e em negrito (>= 24px), onde 3:1 ja e legivel
// (WCAG AA texto grande). Prefere branco; cai para quase-preto se nao der.
export const corDeTexto = (fundo) => (contraste(fundo, "#ffffff") >= 3 ? "#ffffff" : "#111111");

export const misturar = (a, b, t) => {
  const x = hexParaRgb(a), y = hexParaRgb(b);
  return rgbParaHex(x.map((v, i) => v + (y[i] - v) * t));
};

const saturacao = ([r, g, b]) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
};
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Duas cores dominantes da logo, a partir dos pixels RGBA (logo ja sem fundo).
// Ignora transparente e quase-branco; prefere cores com saturacao (a "cor da
// marca"); preto/cinza so entram se a logo nao tiver cor nenhuma.
export function extrairCoresDePixels(px) {
  const grupos = new Map();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 200) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (Math.min(r, g, b) > 235) continue;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const gr = grupos.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    gr.n++; gr.r += r; gr.g += g; gr.b += b;
    grupos.set(k, gr);
  }
  const cores = [...grupos.values()]
    .filter((gr) => gr.n >= 8)
    .map((gr) => {
      const rgb = [gr.r / gr.n, gr.g / gr.n, gr.b / gr.n];
      const s = saturacao(rgb), v = Math.max(...rgb) / 255;
      return { rgb, n: gr.n, viva: s >= 0.3 && v >= 0.2, peso: gr.n * (0.25 + s) };
    });
  if (!cores.length) return null;

  // junta tons vizinhos (anti-aliasing / compressao) antes de escolher
  cores.sort((a, b) => b.n - a.n);
  const juntas = [];
  for (const c of cores) {
    const alvo = juntas.find((j) => distancia(j.rgb, c.rgb) < 48 && j.viva === c.viva);
    if (alvo) { alvo.peso += c.peso; alvo.n += c.n; } else juntas.push({ ...c });
  }
  const vivas = juntas.filter((c) => c.viva).sort((a, b) => b.peso - a.peso);
  const todas = [...juntas].sort((a, b) => b.n - a.n);
  const principal = (vivas[0] || todas[0]).rgb;
  const segunda = [...vivas, ...todas].find((c) => distancia(c.rgb, principal) > 80);
  return {
    principal: rgbParaHex(principal),
    secundaria: segunda ? rgbParaHex(segunda.rgb) : misturar(rgbParaHex(principal), "#000000", 0.55),
  };
}

// Paleta completa a partir de cor principal, secundaria e estilo de fundo.
// - fundo: paradas do gradiente radial (centro -> borda), vinheta, textura, luz
// - rodape: painel solido que contrasta com o fundo + cor do preco
// - badge: cor secundaria (detalhe), com texto em contraste automatico
export function resolverPaleta({ principal, secundaria, estilo }) {
  const c1 = hexValido(principal) ? principal : COR_PRINCIPAL_PADRAO;
  const c2 = hexValido(secundaria) ? secundaria : COR_SECUNDARIA_PADRAO;
  const lum = luminancia(hexParaRgb(c1));
  let p;
  switch (ESTILOS_FUNDO.includes(estilo) ? estilo : "gradiente") {
    case "claro":
      p = {
        base: "#f4f4f5",
        paradas: ["#ffffff", "#f4f4f5", misturar("#e4e4e7", c1, 0.12)],
        vinheta: 0.1, textura: "rgba(0,0,0,0.04)", luz: ["255,255,255", 0.7],
        painel: lum < 0.6 ? c1 : "#18181b",
      };
      break;
    case "escuro":
      p = {
        base: "#121417",
        paradas: [misturar("#121417", c1, 0.32), misturar("#121417", c1, 0.1), "#08090b"],
        vinheta: 0.35, textura: "rgba(255,255,255,0.04)", luz: [hexParaRgb(c1).join(","), 0.3],
        painel: "#ffffff",
      };
      break;
    case "neutro":
      p = {
        base: "#a1a1aa",
        paradas: ["#e4e4e7", "#a1a1aa", "#71717a"],
        vinheta: 0.18, textura: "rgba(0,0,0,0.04)", luz: ["255,255,255", 0.45],
        painel: "#18181b",
      };
      break;
    default: {
      const clara = lum > 0.45;
      p = {
        base: c1,
        paradas: [misturar(c1, "#ffffff", clara ? 0.35 : 0.22), c1, misturar(c1, "#000000", clara ? 0.22 : 0.38)],
        vinheta: 0.28, textura: clara ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", luz: ["255,255,255", clara ? 0.45 : 0.32],
        painel: lum < 0.2 ? "#ffffff" : misturar(c1, "#000000", 0.84),
      };
    }
  }
  const painelTexto = corDeTexto(p.painel);
  // preco: cor da marca quando legivel no painel; senao a secundaria; senao o texto
  const precoCor = contraste(c1, p.painel) >= 3 ? c1 : contraste(c2, p.painel) >= 3 ? c2 : painelTexto;
  // badge: secundaria quando se destaca do fundo; senao o painel
  const badgeFundo = contraste(c2, p.base) >= 1.4 ? c2 : p.painel;
  return {
    ...p, principal: c1, secundaria: c2,
    textoTopo: corDeTexto(p.base), painelTexto, precoCor,
    badgeFundo, badgeTexto: corDeTexto(badgeFundo),
  };
}
