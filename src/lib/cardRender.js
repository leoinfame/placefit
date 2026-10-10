// Desenho do card de produto (PNG) no navegador, com Canvas 2D.
// Um so renderizador para todos os destinos (PROPORCOES): 1:1, 4:5 e 9:16.
//
// Recebe o pacote da funcao gerarCardProduto: dados ja verificados no servidor
// (nome, peso, preco com margem, cores, WhatsApp) e imagens embutidas em data
// URI. Aqui nao ha IA nem calculo de preco: so layout deterministico.
// Formato "video" (premium, futuro) entra como outro renderizador em RENDERIZADORES.

import { calcularLayout, ESPACO } from "./cardLayout.js";
import { hexParaRgb, luminancia, hexValido, extrairCoresDePixels, resolverPaleta } from "./cardCores.js";

export { contraste, corDeTexto } from "./cardCores.js";

const FAMILIA = "CardInter";

const FONTES = [500, 700, 800].map((peso) => ({
  peso,
  url: `https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-${peso}-normal.woff2`,
}));

// Icone do WhatsApp (Simple Icons, CC0), viewBox 24x24.
const WHATSAPP_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

// ---------------------------------------------------------------- recursos

let fontesProntas = null;
export function carregarFontes() {
  return (fontesProntas ??= Promise.all(
    FONTES.map(async (f) => {
      try {
        const face = new FontFace(FAMILIA, `url(${f.url}) format("woff2")`, { weight: String(f.peso) });
        await face.load();
        document.fonts.add(face);
      } catch (_) {
        // sem a fonte, cai para a sans-serif do sistema
      }
    }),
  ));
}

const fonte = (peso, px) => `${peso} ${px}px ${FAMILIA}, Inter, "Helvetica Neue", Arial, sans-serif`;

function carregarImagem(uri) {
  if (!uri) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = uri;
  });
}

// ---------------------------------------------------------------- tratamento de imagem

function paraCanvas(img, maior = 1400) {
  const s = Math.min(1, maior / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Torna transparente o fundo claro que encosta na borda (flood fill a partir
// das bordas) e os vazados brancos internos grandes, e suaviza o contorno.
// So age se ao menos 3 cantos forem claros, para nao estragar foto com cenario.
function removerFundoClaro(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const w = canvas.width, h = canvas.height, n = w * h;
  const dados = ctx.getImageData(0, 0, w, h);
  const px = dados.data;
  const claro = (p) => {
    const i = p * 4;
    return px[i + 3] < 16 || (px[i] >= 228 && px[i + 1] >= 228 && px[i + 2] >= 228);
  };
  if ([0, w - 1, (h - 1) * w, n - 1].filter(claro).length < 3) return;

  const fundo = new Uint8Array(n);
  const fila = new Int32Array(n);
  let ini = 0, fim = 0;
  const marcar = (p) => {
    if (!fundo[p] && claro(p)) { fundo[p] = 1; fila[fim++] = p; }
  };
  for (let x = 0; x < w; x++) { marcar(x); marcar((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { marcar(y * w); marcar(y * w + w - 1); }
  while (ini < fim) {
    const p = fila[ini++], x = p % w;
    if (x > 0) marcar(p - 1);
    if (x < w - 1) marcar(p + 1);
    if (p >= w) marcar(p - w);
    if (p < n - w) marcar(p + w);
  }

  // fundo externo (encosta na borda): unica origem permitida para a sombra de chao
  const externo = fundo.slice();

  // vazados internos (furo da anilha etc.): manchas brancas uniformes e grandes
  const branco = (p) => {
    const i = p * 4;
    return px[i + 3] >= 16 && px[i] >= 242 && px[i + 1] >= 242 && px[i + 2] >= 242;
  };
  const areaMinima = Math.max(150, Math.round(n * 0.0012));
  const visto = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    if (fundo[s] || visto[s] || !branco(s)) continue;
    ini = 0; fim = 0;
    visto[s] = 1; fila[fim++] = s;
    while (ini < fim) {
      const p = fila[ini++], x = p % w;
      const viz = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
      for (const q of viz) if (q >= 0 && !visto[q] && !fundo[q] && branco(q)) { visto[q] = 1; fila[fim++] = q; }
    }
    if (fim >= areaMinima) for (let k = 0; k < fim; k++) fundo[fila[k]] = 1;
  }

  // bolsoes da cor do fundo (ou mais claros) presos no chao (entre pes, sombra e base):
  // so no quarto inferior da foto, para nao furar cromados do produto
  let somaFundo = 0, qtdFundo = 0;
  for (let p = 0; p < n; p += 7) if (fundo[p] && px[p * 4 + 3] >= 16) { somaFundo += (px[p * 4] + px[p * 4 + 1] + px[p * 4 + 2]) / 3; qtdFundo++; }
  const nivelFundo = qtdFundo ? somaFundo / qtdFundo : 255;
  const corDeFundo = (p) => {
    const i = p * 4, mn = Math.min(px[i], px[i + 1], px[i + 2]), mx = Math.max(px[i], px[i + 1], px[i + 2]);
    return px[i + 3] >= 16 && mx - mn <= 8 && (px[i] + px[i + 1] + px[i + 2]) / 3 >= nivelFundo - 10;
  };
  const linhaChao = Math.floor(h * 0.75) * w;
  const vistoChao = new Uint8Array(n);
  for (let s = linhaChao; s < n; s++) {
    if (fundo[s] || vistoChao[s] || !corDeFundo(s)) continue;
    ini = 0; fim = 0;
    vistoChao[s] = 1; fila[fim++] = s;
    while (ini < fim) {
      const p = fila[ini++], x = p % w;
      const viz = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
      for (const q of viz) if (q >= linhaChao && !vistoChao[q] && !fundo[q] && corDeFundo(q)) { vistoChao[q] = 1; fila[fim++] = q; }
    }
    if (fim >= 12) for (let k = 0; k < fim; k++) fundo[fila[k]] = 1;
  }

  // sombra de chao da foto: vira sombra transparente de verdade em vez de
  // mancha cinza sobre a cor da marca. Sombra escurece GRADUALMENTE a partir do
  // fundo; a borda de um cromado e abrupta. Por isso o preenchimento so avanca
  // por passos suaves (<= 6 niveis), sem cor, na metade de baixo da foto.
  const media = (p) => (px[p * 4] + px[p * 4 + 1] + px[p * 4 + 2]) / 3;
  const semCor = (p) => {
    const i = p * 4;
    return px[i + 3] >= 16 && Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) <= 14;
  };
  const inicioChao = Math.floor(h * 0.5) * w;
  const sombra = new Uint8Array(n);
  ini = 0; fim = 0;
  for (let p = inicioChao; p < n; p++) if (externo[p]) fila[fim++] = p;
  while (ini < fim) {
    const p = fila[ini++], x = p % w, vp = media(p);
    const viz = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < n - w ? p + w : -1];
    for (const q of viz) {
      if (q < inicioChao || fundo[q] || sombra[q] || !semCor(q)) continue;
      const vq = media(q);
      if (vq >= 120 && Math.abs(vq - vp) <= 6) { sombra[q] = 1; fila[fim++] = q; }
    }
  }
  // trava: sombra de chao e pequena perto do produto. Se a regiao passou de 8%
  // do produto, ela invadiu uma superficie lisa (ex.: face cromada) - desfaz.
  let qtdSombra = 0, qtdProduto = 0;
  for (let p = 0; p < n; p++) {
    if (sombra[p]) qtdSombra++;
    else if (!fundo[p] && px[p * 4 + 3] >= 16) qtdProduto++;
  }
  if (qtdSombra > qtdProduto * 0.08) sombra.fill(0);
  for (let p = 0; p < n; p++) {
    if (!sombra[p]) continue;
    const i = p * 4, v = media(p);
    px[i] = 0; px[i + 1] = 0; px[i + 2] = 0;
    px[i + 3] = Math.max(0, Math.min(255, Math.round((nivelFundo - v) * 1.4)));
  }

  for (let p = 0; p < n; p++) if (fundo[p]) px[p * 4 + 3] = 0;
  // contorno: pixels claros vizinhos do fundo ficam semitransparentes (sem halo branco)
  for (let p = 0; p < n; p++) {
    if (fundo[p] || sombra[p]) continue;
    const x = p % w;
    const vizinho = (x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) || (p >= w && fundo[p - w]) || (p < n - w && fundo[p + w]);
    if (!vizinho) continue;
    const i = p * 4, m = Math.min(px[i], px[i + 1], px[i + 2]);
    if (m > 170) px[i + 3] = Math.round(px[i + 3] * Math.min(1, (255 - m) / 85));
  }
  ctx.putImageData(dados, 0, 0);
}

// Corta as margens transparentes.
function aparar(canvas) {
  const w = canvas.width, h = canvas.height;
  const px = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return canvas;
  const c = document.createElement("canvas");
  c.width = x1 - x0 + 1;
  c.height = y1 - y0 + 1;
  c.getContext("2d").drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

// Logo com pouco contraste com o fundo (simbolo laranja sobre laranja, logo
// preta sobre azul escuro) vira monocromatica na cor do texto. Brancos
// internos viram vazados.
function tingirSePoucoContraste(canvas, fundo, cor) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = dados.data, c = hexParaRgb(cor);
  const lumFundo = luminancia(hexParaRgb(fundo));
  let opacos = 0, fracos = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    opacos++;
    const l = luminancia([px[i], px[i + 1], px[i + 2]]);
    if ((Math.max(l, lumFundo) + 0.05) / (Math.min(l, lumFundo) + 0.05) < 1.8) fracos++;
  }
  // logo e grafico, nao texto: so tinge se uma parte relevante (>= 8%) quase
  // some no fundo (< 1.8:1); logo colorida legivel fica com as cores originais
  if (!opacos || fracos / opacos < 0.08) return;
  for (let i = 0; i < px.length; i += 4) {
    if (Math.min(px[i], px[i + 1], px[i + 2]) >= 228) px[i + 3] = 0;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
  ctx.putImageData(dados, 0, 0);
}

async function prepararImagem(uri, { removerFundo = false, tingir = null } = {}) {
  const img = await carregarImagem(uri);
  if (!img || !img.naturalWidth) return null;
  let c = paraCanvas(img);
  try {
    if (removerFundo) { removerFundoClaro(c); c = aparar(c); }
    if (tingir) tingirSePoucoContraste(c, tingir.fundo, tingir.cor);
  } catch (e) {
    console.warn("cardRender: tratamento de imagem falhou, usando original", e);
    c = paraCanvas(img);
  }
  return c;
}

function coresDoCanvas(canvas) {
  const px = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
  return extrairCoresDePixels(px);
}

// Sugestao de identidade a partir da logo (data URI ou URL com CORS).
export async function sugerirCoresDaLogo(uri) {
  const c = await prepararImagem(uri, { removerFundo: true });
  return c ? coresDoCanvas(c) : null;
}

// ---------------------------------------------------------------- texto

function quebrarLinhas(ctx, texto, largura) {
  const linhas = [];
  let atual = "";
  for (const palavra of String(texto).split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (atual && ctx.measureText(tentativa).width > largura) { linhas.push(atual); atual = palavra; }
    else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function elipseRadial(ctx, cx, cy, rx, ry, cor, alfa) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${cor},${alfa})`);
  g.addColorStop(1, `rgba(${cor},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

// ---------------------------------------------------------------- layout

// Destinos: so muda a moldura. Topo/base = faixa que a interface do app cobre
// (Reels/Stories/TikTok/Status cobrem ~250px em cima e ~300px embaixo). "ui"
// escala so a tipografia; o espacamento (ESPACO) e o mesmo em todos.
export const PROPORCOES = {
  quadrado: { largura: 1080, altura: 1080, topo: ESPACO.g, base: ESPACO.g, ui: 1 },
  retrato: { largura: 1080, altura: 1350, topo: ESPACO.g, base: ESPACO.g, ui: 1.05 },
  vertical: { largura: 1080, altura: 1920, topo: 250, base: 300, ui: 1.3 },
};

const TAMANHOS_NOME = [56, 52, 48, 44, 40, 36, 34, 32, 30, 28];
const VERDE_WHATSAPP = "#25D366";


// Nome completo, nunca truncado: maior corpo que caiba em 2 linhas; se nem o
// menor couber, aceita mais linhas.
function medirNomeCompleto(ctx, nome, largura, ui) {
  for (const base of TAMANHOS_NOME) {
    const f = Math.round(base * ui);
    ctx.font = fonte(800, f);
    const linhas = quebrarLinhas(ctx, nome, largura);
    if (linhas.length <= 2) return { fonteNome: f, linhas };
  }
  const f = Math.round(TAMANHOS_NOME[TAMANHOS_NOME.length - 1] * ui);
  ctx.font = fonte(800, f);
  return { fonteNome: f, linhas: quebrarLinhas(ctx, nome, largura) };
}

// Linhas diagonais bem sutis no fundo, apagadas perto do produto.
function texturaDiagonal(ctx, W, H, cor, cx, cy, raioLivre) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  x.strokeStyle = cor;
  x.lineWidth = 2;
  for (let i = -H; i < W; i += 28) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + H, H);
    x.stroke();
  }
  x.globalCompositeOperation = "destination-out";
  const g = x.createRadialGradient(cx, cy, raioLivre * 0.55, cx, cy, raioLivre * 1.35);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  ctx.drawImage(c, 0, 0);
}

export async function renderCardImagem(pacote, proporcao = pacote.proporcao) {
  const { dados: d, imagens = {} } = pacote;
  const moldura = PROPORCOES[proporcao] || PROPORCOES.quadrado;
  const W = moldura.largura, H = moldura.altura, ui = moldura.ui;
  const RAIO = Math.round(24 * ui);
  const temFundo = !!imagens.fundo;

  await carregarFontes();
  const [foto, logo, fundo] = await Promise.all([
    prepararImagem(imagens.foto, { removerFundo: true }),
    prepararImagem(imagens.logo, { removerFundo: true }),
    carregarImagem(imagens.fundo),
  ]);

  // Identidade: cores configuradas pelo revendedor; se nao houver, extraidas da logo
  let principal = d.marca.cor_primaria, secundaria = d.marca.cor_secundaria;
  if (!hexValido(principal) || !hexValido(secundaria)) {
    const daLogo = logo ? coresDoCanvas(logo) : null;
    if (!hexValido(principal)) principal = daLogo?.principal;
    if (!hexValido(secundaria)) secundaria = daLogo?.secundaria;
  }
  const pal = resolverPaleta({ principal, secundaria, estilo: d.marca.estilo_fundo });
  const { painel, painelTexto, precoCor } = pal;
  const textoTopo = temFundo ? "#ffffff" : pal.textoTopo;
  if (logo) tingirSePoucoContraste(logo, temFundo ? "#111111" : pal.base, textoTopo);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";

  // ---------------- medidas de texto (alimentam o layout) ----------------
  const larguraTexto = W - 2 * ESPACO.g - 2 * ESPACO.m;
  const { fonteNome, linhas } = medirNomeCompleto(ctx, d.nome, larguraTexto, ui);
  const entrelinha = fonteNome * 1.1;
  const alturaNome = Math.round(linhas.length * entrelinha);

  const sufixo = `/${d.und || "unid."}`;
  const fonteContato = Math.round(34 * ui), icone = Math.round(40 * ui);
  ctx.font = fonte(700, fonteContato);
  const contato = d.marca.whatsapp ? { w: icone + 12 + ctx.measureText(d.marca.whatsapp).width, h: icone } : null;

  // preco: maior elemento do rodape; contato ao lado se couber, senao embaixo
  const minimoPreco = Math.max(fonteNome + Math.round(16 * ui), Math.round(64 * ui));
  const medirPreco = (f) => {
    ctx.font = fonte(800, f);
    const wv = ctx.measureText(d.preco_texto).width;
    const fs = Math.round(f * 0.34);
    ctx.font = fonte(700, fs);
    return { f, fs, wv, w: wv + 10 + ctx.measureText(sufixo).width, h: Math.round(f * 1.05) };
  };
  let preco = null, contatoAoLado = false;
  for (let f = Math.round(92 * ui); f >= minimoPreco; f -= 4) {
    const m = medirPreco(f);
    if (!contato || m.w + ESPACO.m + contato.w <= larguraTexto) { preco = m; contatoAoLado = !!contato; break; }
  }
  if (!preco) {
    for (let f = Math.round(92 * ui); f >= Math.round(40 * ui); f -= 4) {
      preco = medirPreco(f);
      if (preco.w <= larguraTexto) break;
    }
  }

  let badge = null;
  const fonteBadge = Math.round(32 * ui), padBadge = Math.round(24 * ui);
  if (d.peso_texto) {
    ctx.font = fonte(800, fonteBadge);
    badge = { w: ctx.measureText(d.peso_texto).width + 2 * padBadge, h: Math.round(60 * ui) };
  }

  // ---------------- layout em 3 faixas ----------------
  const layout = calcularLayout({
    W, H, topo: moldura.topo, base: moldura.base,
    alturaTopo: Math.round(112 * ui),
    logo: logo ? { w: logo.width, h: logo.height } : null,
    badge,
    foto: foto ? { w: foto.width, h: foto.height } : null,
    reservaSombra: Math.round(32 * ui),
    alturaNome, preco: { w: preco.w, h: preco.h }, contato, contatoAoLado,
  });
  if (layout.violacoes.length) console.warn("cardRender: layout com problemas", layout.violacoes);
  const { faixas, caixas } = layout;
  const cxFoto = caixas.foto ? caixas.foto.x + caixas.foto.w / 2 : W / 2;
  const cyFoto = caixas.foto ? caixas.foto.y + caixas.foto.h / 2 : faixas.miolo.y + faixas.miolo.h / 2;

  // ---------------- fundo com profundidade ----------------
  if (fundo) {
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, W, H);
    const s = Math.max(W / fundo.naturalWidth, H / fundo.naturalHeight);
    const fw = fundo.naturalWidth * s, fh = fundo.naturalHeight * s;
    ctx.drawImage(fundo, (W - fw) / 2, (H - fh) / 2, fw, fh);
  } else {
    const raioFundo = Math.hypot(W, H) * 0.62;
    const g = ctx.createRadialGradient(cxFoto, cyFoto, 0, cxFoto, cyFoto, raioFundo);
    g.addColorStop(0, pal.paradas[0]);
    g.addColorStop(0.45, pal.paradas[1]);
    g.addColorStop(1, pal.paradas[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const tam = caixas.foto ? Math.max(caixas.foto.w, caixas.foto.h) : 400;
    texturaDiagonal(ctx, W, H, pal.textura, cxFoto, cyFoto, tam * 0.6);
  }
  const vin = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  vin.addColorStop(0, "rgba(0,0,0,0)");
  vin.addColorStop(1, `rgba(0,0,0,${temFundo ? 0.28 : pal.vinheta})`);
  ctx.fillStyle = vin;
  ctx.fillRect(0, 0, W, H);

  // ---------------- faixa 2: spotlight, sombra de contato e foto ----------------
  if (caixas.foto) {
    const f = caixas.foto, s = caixas.sombra;
    const tam = Math.max(f.w, f.h);
    elipseRadial(ctx, cxFoto, cyFoto, tam * 0.62 + 80, tam * 0.55 + 60, pal.luz[0], pal.luz[1]);
    const base = f.y + f.h;
    elipseRadial(ctx, s.x + s.w / 2, base - 2, s.w * 0.5, s.h * 0.5, "0,0,0", 0.35);
    elipseRadial(ctx, s.x + s.w / 2, base - 1, s.w * 0.38, s.h * 0.18, "0,0,0", 0.55);
    ctx.drawImage(foto, f.x, f.y, f.w, f.h);
  } else {
    ctx.fillStyle = textoTopo;
    ctx.font = fonte(700, Math.round(36 * ui));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Foto indisponível", cxFoto, cyFoto);
    ctx.textAlign = "left";
  }

  // ---------------- faixa 3: rodape solido ----------------
  const p = caixas.painel;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  retanguloArredondado(ctx, p.x, p.y, p.w, p.h, RAIO);
  ctx.fillStyle = painel;
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = painelTexto;
  ctx.font = fonte(800, fonteNome);
  linhas.forEach((linha, i) => ctx.fillText(linha, caixas.nome.x, caixas.nome.y + entrelinha * i + fonteNome * 0.9));

  const basePreco = caixas.preco.y + preco.f * 0.86;
  ctx.fillStyle = precoCor;
  ctx.font = fonte(800, preco.f);
  ctx.fillText(d.preco_texto, caixas.preco.x, basePreco);
  ctx.fillStyle = painelTexto;
  ctx.font = fonte(700, preco.fs);
  ctx.fillText(sufixo, caixas.preco.x + preco.wv + 10, basePreco);

  if (caixas.contato) {
    const c = caixas.contato, meio = c.y + c.h / 2;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(icone / 24, icone / 24);
    ctx.fillStyle = VERDE_WHATSAPP;
    ctx.fill(new Path2D(WHATSAPP_PATH));
    ctx.restore();
    ctx.fillStyle = painelTexto;
    ctx.font = fonte(700, fonteContato);
    ctx.textBaseline = "middle";
    ctx.fillText(d.marca.whatsapp, c.x + icone + 12, meio + 1);
  }

  // ---------------- faixa 1: logo + peso ----------------
  ctx.textBaseline = "middle";
  if (caixas.logo) {
    ctx.drawImage(logo, caixas.logo.x, caixas.logo.y, caixas.logo.w, caixas.logo.h);
  } else if (d.marca.nome) {
    ctx.fillStyle = textoTopo;
    ctx.font = fonte(800, Math.round(48 * ui));
    ctx.fillText(d.marca.nome, faixas.topo.x, faixas.topo.y + faixas.topo.h / 2);
  }
  if (caixas.badge) {
    const b = caixas.badge;
    retanguloArredondado(ctx, b.x, b.y, b.w, b.h, RAIO * 0.75);
    ctx.fillStyle = pal.badgeFundo;
    ctx.fill();
    ctx.fillStyle = pal.badgeTexto;
    ctx.font = fonte(800, fonteBadge);
    ctx.fillText(d.peso_texto, b.x + padBadge, b.y + b.h / 2 + 1);
  }

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar o PNG"))), "image/png"),
  );
  blob.violacoes = layout.violacoes;
  return blob;
}

// Ponto de extensao: formato -> renderizador. "video" entra aqui na fase premium.
export const RENDERIZADORES = {
  imagem: renderCardImagem,
};
