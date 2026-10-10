// Desenho do card de produto (PNG) no navegador, com Canvas 2D.
// Um so renderizador para todos os destinos (PROPORCOES): 1:1, 4:5 e 9:16.
//
// Recebe o pacote da funcao gerarCardProduto: dados ja verificados no servidor
// (nome, peso, preco com margem, cores, WhatsApp) e imagens embutidas em data
// URI. Aqui nao ha IA nem calculo de preco: so layout deterministico.
// Formato "video" (premium, futuro) entra como outro renderizador em RENDERIZADORES.

const MARGEM = 64; // margem lateral segura (todos os destinos tem 1080 de largura)
const LARGURA_UTIL = 1080 - 2 * MARGEM;
const ALTURA_LINHA_NOME = 1.06;
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

// ---------------------------------------------------------------- cores

const hexParaRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const luminancia = ([r, g, b]) => {
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

  for (let p = 0; p < n; p++) if (fundo[p]) px[p * 4 + 3] = 0;
  // contorno: pixels claros vizinhos do fundo ficam semitransparentes (sem halo branco)
  for (let p = 0; p < n; p++) {
    if (fundo[p]) continue;
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

// Logo que some no fundo (ex.: simbolo laranja sobre laranja) vira
// monocromatica na cor do texto. Brancos internos viram vazados.
function tingirSePoucoContraste(canvas, fundo, cor) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = dados.data, bg = hexParaRgb(fundo), c = hexParaRgb(cor);
  let opacos = 0, perto = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    opacos++;
    if (Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]) < 90) perto++;
  }
  if (!opacos || perto / opacos < 0.08) return;
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
// (Reels/Stories/TikTok/Status cobrem ~250px em cima e ~300px embaixo); nome,
// preco e contato ficam sempre dentro da zona segura. "ui" escala tipografia,
// raios e espacamentos de forma proporcional (mesmo grid em todos).
export const PROPORCOES = {
  quadrado: { largura: 1080, altura: 1080, topo: 56, base: 56, ui: 1 },
  retrato: { largura: 1080, altura: 1350, topo: 56, base: 56, ui: 1.05 },
  vertical: { largura: 1080, altura: 1920, topo: 250, base: 300, ui: 1.3 },
};

const LATERAL = 56;
const TAMANHOS_NOME = [56, 52, 48, 44, 40, 36, 34, 32, 30, 28];
const VERDE_WHATSAPP = "#25D366";

const misturar = (a, b, t) => {
  const x = hexParaRgb(a), y = hexParaRgb(b);
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};

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
  const c1 = d.marca.cor_primaria;
  const temFundo = !!imagens.fundo;

  // Cores: faixa inferior solida que contrasta com a marca
  const marcaEscura = luminancia(hexParaRgb(c1)) < 0.2;
  const painel = marcaEscura ? "#ffffff" : misturar(c1, "#000000", 0.84);
  const painelTexto = corDeTexto(painel);
  const precoCor = contraste(c1, painel) >= 3 ? c1 : painelTexto;
  const textoTopo = temFundo ? "#ffffff" : corDeTexto(c1);
  const marcaClara = luminancia(hexParaRgb(c1)) > 0.45;

  await carregarFontes();
  const [foto, logo, fundo] = await Promise.all([
    prepararImagem(imagens.foto, { removerFundo: true }),
    prepararImagem(imagens.logo, { removerFundo: true, tingir: { fundo: temFundo ? "#111111" : c1, cor: textoTopo } }),
    carregarImagem(imagens.fundo),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";

  // ---------------- medidas (grid) ----------------
  const larguraPainel = W - 2 * LATERAL;
  const pad = Math.round(36 * ui);
  const larguraTexto = larguraPainel - 2 * pad;
  const { fonteNome, linhas } = medirNomeCompleto(ctx, d.nome, larguraTexto, ui);
  const alturaNome = Math.round(linhas.length * fonteNome * 1.1);

  const sufixo = `/${d.und || "unid."}`;
  const fonteContato = Math.round(34 * ui), icone = Math.round(40 * ui);
  ctx.font = fonte(700, fonteContato);
  const wContato = d.marca.whatsapp ? icone + 12 + ctx.measureText(d.marca.whatsapp).width : 0;
  // preco: maior elemento do bloco; contato ao lado se couber, senao embaixo
  let fontePreco = Math.round(92 * ui), fonteSufixo, wPreco, wSufixo, contatoAoLado = false;
  const minimoPreco = Math.max(fonteNome + Math.round(16 * ui), Math.round(64 * ui));
  for (; fontePreco >= minimoPreco; fontePreco -= 4) {
    fonteSufixo = Math.round(fontePreco * 0.34);
    ctx.font = fonte(800, fontePreco);
    wPreco = ctx.measureText(d.preco_texto).width;
    ctx.font = fonte(700, fonteSufixo);
    wSufixo = ctx.measureText(sufixo).width;
    if (!d.marca.whatsapp || wPreco + 10 + wSufixo + 32 + wContato <= larguraTexto) { contatoAoLado = true; break; }
  }
  if (!contatoAoLado) {
    fontePreco = Math.round(92 * ui);
    for (; fontePreco > minimoPreco; fontePreco -= 4) {
      ctx.font = fonte(800, fontePreco);
      wPreco = ctx.measureText(d.preco_texto).width;
      fonteSufixo = Math.round(fontePreco * 0.34);
      ctx.font = fonte(700, fonteSufixo);
      wSufixo = ctx.measureText(sufixo).width;
      if (wPreco + 10 + wSufixo <= larguraTexto) break;
    }
    fonteSufixo = Math.round(fontePreco * 0.34);
  }
  const alturaPreco = Math.round(fontePreco * 1.05);
  const alturaContatoLinha = d.marca.whatsapp && !contatoAoLado ? icone + Math.round(14 * ui) : 0;
  const alturaPainel = pad + alturaNome + Math.round(14 * ui) + alturaPreco + alturaContatoLinha + pad;
  const fimSeguro = H - moldura.base;
  const topoPainel = fimSeguro - alturaPainel;

  // cabecalho
  const topoCab = moldura.topo, alturaCab = Math.round(120 * ui);
  const meioCab = topoCab + alturaCab / 2;
  let lw = 0, lh = 0;
  if (logo) {
    const s = Math.min(alturaCab / logo.height, (460 * ui) / logo.width);
    lw = logo.width * s;
    lh = logo.height * s;
  }
  const fonteBadge = Math.round(32 * ui), padBadge = Math.round(24 * ui), hBadge = Math.round(60 * ui);
  ctx.font = fonte(800, fonteBadge);
  const wBadge = d.peso_texto ? ctx.measureText(d.peso_texto).width + 2 * padBadge : 0;

  // produto: apoiado sobre a faixa; se for estreito, pode subir entre logo e badge
  const sobreposicao = Math.round(18 * ui);
  const basePro = topoPainel + sobreposicao;
  const larguraMaxPro = larguraPainel;
  let pw = 0, ph = 0;
  if (foto) {
    const caber = (topo) => {
      const s = Math.min(larguraMaxPro / foto.width, (basePro - topo) / foto.height, 4);
      return [Math.round(foto.width * s), Math.round(foto.height * s)];
    };
    const larguraLivreTopo = W - 2 * (LATERAL + Math.max(lw, wBadge) + Math.round(24 * ui));
    const [pwAlto, phAlto] = caber(topoCab + Math.round(8 * ui));
    [pw, ph] = pwAlto <= larguraLivreTopo ? [pwAlto, phAlto] : caber(topoCab + alturaCab + Math.round(20 * ui));
  }
  const centroPro = foto ? basePro - ph / 2 : (topoCab + alturaCab + topoPainel) / 2;

  // ---------------- fundo com profundidade ----------------
  if (fundo) {
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, W, H);
    const s = Math.max(W / fundo.naturalWidth, H / fundo.naturalHeight);
    const fw = fundo.naturalWidth * s, fh = fundo.naturalHeight * s;
    ctx.drawImage(fundo, (W - fw) / 2, (H - fh) / 2, fw, fh);
  } else {
    const raioFundo = Math.hypot(W, H) * 0.62;
    const g = ctx.createRadialGradient(W / 2, centroPro, 0, W / 2, centroPro, raioFundo);
    g.addColorStop(0, misturar(c1, "#ffffff", marcaClara ? 0.35 : 0.22));
    g.addColorStop(0.45, c1);
    g.addColorStop(1, misturar(c1, "#000000", marcaClara ? 0.22 : 0.38));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    texturaDiagonal(ctx, W, H, marcaClara ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", W / 2, centroPro, Math.max(pw, ph, 400) * 0.6);
  }
  // vinheta sutil
  const vin = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  vin.addColorStop(0, "rgba(0,0,0,0)");
  vin.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vin;
  ctx.fillRect(0, 0, W, H);
  // spotlight atras do produto
  if (foto) elipseRadial(ctx, W / 2, centroPro, Math.max(pw, ph) * 0.62 + 80, Math.max(pw, ph) * 0.55 + 60, "255,255,255", marcaClara ? 0.45 : 0.32);

  // ---------------- produto + sombra de contato ----------------
  if (foto) {
    // sombra larga e difusa + sombra curta e escura no ponto de apoio
    elipseRadial(ctx, W / 2, basePro - 6 * ui, pw * 0.5, 30 * ui, "0,0,0", 0.35);
    elipseRadial(ctx, W / 2, basePro - 3 * ui, pw * 0.38, 10 * ui, "0,0,0", 0.55);
    ctx.drawImage(foto, (W - pw) / 2, basePro - ph, pw, ph);
  } else {
    ctx.fillStyle = textoTopo;
    ctx.font = fonte(700, Math.round(36 * ui));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Foto indisponível", W / 2, centroPro);
    ctx.textAlign = "left";
  }

  // ---------------- faixa inferior (solida, alto contraste) ----------------
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 40 * ui;
  ctx.shadowOffsetY = 12 * ui;
  retanguloArredondado(ctx, LATERAL, topoPainel, larguraPainel, alturaPainel, RAIO);
  ctx.fillStyle = painel;
  ctx.fill();
  ctx.restore();
  // o produto fica por cima da borda da faixa (apoiado)
  if (foto && sobreposicao > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, topoPainel, W, sobreposicao + 2);
    ctx.clip();
    ctx.drawImage(foto, (W - pw) / 2, basePro - ph, pw, ph);
    ctx.restore();
  }

  const xTexto = LATERAL + pad;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = painelTexto;
  ctx.font = fonte(800, fonteNome);
  linhas.forEach((linha, i) => ctx.fillText(linha, xTexto, topoPainel + pad + fonteNome * 1.1 * i + fonteNome * 0.86));

  const topoPreco = topoPainel + pad + alturaNome + Math.round(14 * ui);
  const basePreco = topoPreco + fontePreco * 0.82;
  ctx.fillStyle = precoCor;
  ctx.font = fonte(800, fontePreco);
  ctx.fillText(d.preco_texto, xTexto, basePreco);
  ctx.fillStyle = painelTexto;
  ctx.font = fonte(700, fonteSufixo);
  ctx.fillText(sufixo, xTexto + wPreco + 10, basePreco);

  if (d.marca.whatsapp) {
    const meio = contatoAoLado ? basePreco - fontePreco * 0.33 : topoPreco + alturaPreco + Math.round(14 * ui) + icone / 2;
    const xIcone = contatoAoLado ? LATERAL + larguraPainel - pad - wContato : xTexto;
    ctx.save();
    ctx.translate(xIcone, meio - icone / 2);
    ctx.scale(icone / 24, icone / 24);
    ctx.fillStyle = VERDE_WHATSAPP;
    ctx.fill(new Path2D(WHATSAPP_PATH));
    ctx.restore();
    ctx.fillStyle = painelTexto;
    ctx.font = fonte(700, fonteContato);
    ctx.textBaseline = "middle";
    ctx.fillText(d.marca.whatsapp, xIcone + icone + 12, meio + 1);
  }

  // ---------------- cabecalho: logo grande sem caixa + peso (uma vez, nitido) ----------------
  ctx.textBaseline = "middle";
  if (logo) {
    ctx.drawImage(logo, LATERAL, meioCab - lh / 2, lw, lh);
  } else if (d.marca.nome) {
    ctx.fillStyle = textoTopo;
    ctx.font = fonte(800, Math.round(48 * ui));
    ctx.fillText(d.marca.nome, LATERAL, meioCab);
  }
  if (d.peso_texto) {
    retanguloArredondado(ctx, W - LATERAL - wBadge, meioCab - hBadge / 2, wBadge, hBadge, RAIO * 0.75);
    ctx.fillStyle = painel;
    ctx.fill();
    ctx.fillStyle = painelTexto;
    ctx.font = fonte(800, fonteBadge);
    ctx.fillText(d.peso_texto, W - LATERAL - wBadge + padBadge, meioCab + 1);
  }

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar o PNG"))), "image/png"),
  );
  return blob;
}

// Ponto de extensao: formato -> renderizador. "video" entra aqui na fase premium.
export const RENDERIZADORES = {
  imagem: renderCardImagem,
};
