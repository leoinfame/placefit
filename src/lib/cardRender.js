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

// Maior corpo do nome que caiba em 2 linhas; abaixo disso, corta com reticencias.
function medirNome(ctx, nome) {
  for (const f of [84, 76, 68, 60, 54, 48]) {
    ctx.font = fonte(800, f);
    const linhas = quebrarLinhas(ctx, nome, LARGURA_UTIL);
    if (linhas.length <= 2) return { fonteNome: f, linhas };
  }
  const f = 44;
  ctx.font = fonte(800, f);
  const linhas = quebrarLinhas(ctx, nome, LARGURA_UTIL).slice(0, 2);
  while (ctx.measureText(`${linhas[1]}…`).width > LARGURA_UTIL && linhas[1].length > 1) linhas[1] = linhas[1].slice(0, -1);
  linhas[1] = `${linhas[1].trimEnd()}…`;
  return { fonteNome: f, linhas };
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

// Destinos: so muda a moldura (tamanho e zona segura). Topo/base = faixa que a
// interface do app cobre (Reels/Stories/TikTok/Status cobrem ~250px em cima e
// ~300px embaixo); nome, preco e contato ficam sempre dentro da zona segura.
export const PROPORCOES = {
  quadrado: { largura: 1080, altura: 1080, topo: MARGEM, base: MARGEM },
  retrato: { largura: 1080, altura: 1350, topo: MARGEM, base: MARGEM },
  vertical: { largura: 1080, altura: 1920, topo: 250, base: 300 },
};

export async function renderCardImagem(pacote, proporcao = pacote.proporcao) {
  const { dados: d, imagens = {} } = pacote;
  const moldura = PROPORCOES[proporcao] || PROPORCOES.quadrado;
  const W = moldura.largura, H = moldura.altura;
  const c1 = d.marca.cor_primaria, c2 = d.marca.cor_secundaria;
  const temFundo = !!imagens.fundo;
  const texto = temFundo ? "#ffffff" : corDeTexto(c1);
  const textoSuave = texto === "#ffffff" ? "rgba(255,255,255,0.86)" : "rgba(17,17,17,0.78)";
  const veu = texto === "#ffffff" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.10)";
  const fundoCard = temFundo ? "#111111" : c1;

  await carregarFontes();
  const [foto, logo, fundo] = await Promise.all([
    prepararImagem(imagens.foto, { removerFundo: true }),
    prepararImagem(imagens.logo, { removerFundo: true, tingir: { fundo: fundoCard, cor: texto } }),
    carregarImagem(imagens.fundo),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";

  // Hierarquia: nome (maior) > preco (segundo) > peso (badge discreto)
  const { fonteNome, linhas } = medirNome(ctx, d.nome);
  const fontePreco = Math.max(44, Math.min(64, fonteNome - 12));
  const seloFundo = contraste(c2, c1) >= 1.8 ? c2 : texto;
  const seloTexto = corDeTexto(seloFundo);

  // Grade vertical dentro da zona segura: cabecalho | produto | nome | preco+contato
  const topoCabecalho = moldura.topo, alturaCabecalho = 92;
  const fimSeguro = H - moldura.base;
  const alturaLinhaPreco = fontePreco + 36;
  const alturaNome = Math.round(linhas.length * fonteNome * ALTURA_LINHA_NOME);
  const topoNome = fimSeguro - alturaLinhaPreco - 24 - alturaNome;
  const topoProduto = topoCabecalho + alturaCabecalho + 16;
  const baseProduto = topoNome - 36;
  const alturaProduto = baseProduto - topoProduto;

  // Fundo (preenche o quadro inteiro, inclusive fora da zona segura)
  ctx.fillStyle = fundoCard;
  ctx.fillRect(0, 0, W, H);
  if (fundo) {
    const s = Math.max(W / fundo.naturalWidth, H / fundo.naturalHeight);
    const fw = fundo.naturalWidth * s, fh = fundo.naturalHeight * s;
    ctx.drawImage(fundo, (W - fw) / 2, (H - fh) / 2, fw, fh);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0.2)");
    g.addColorStop(0.35, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    // brilho suave atras do produto para dar profundidade a cor chapada
    elipseRadial(ctx, W / 2, topoProduto + alturaProduto / 2, 460, Math.max(400, alturaProduto / 2 + 100), "255,255,255", 0.3);
  }

  // Produto: maior possivel na area, apoiado no "chao" com sombra
  if (foto) {
    const escala = Math.min((LARGURA_UTIL * 0.9) / foto.width, (alturaProduto - 24) / foto.height, 3);
    const pw = Math.round(foto.width * escala), ph = Math.round(foto.height * escala);
    const larguraSombra = Math.max(220, Math.round(pw * 0.85));
    elipseRadial(ctx, W / 2, baseProduto - 24, larguraSombra / 2, 28, "0,0,0", 0.32);
    ctx.drawImage(foto, (W - pw) / 2, baseProduto - 24 - ph, pw, ph);
  } else {
    ctx.fillStyle = textoSuave;
    ctx.font = fonte(500, 36);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Foto indisponível", W / 2, topoProduto + alturaProduto / 2);
    ctx.textAlign = "left";
  }

  // Cabecalho: logo grande sem caixa + peso discreto
  ctx.textBaseline = "middle";
  const meioCabecalho = topoCabecalho + alturaCabecalho / 2;
  if (logo) {
    const s = Math.min(alturaCabecalho / logo.height, 420 / logo.width);
    const lw = logo.width * s, lh = logo.height * s;
    ctx.drawImage(logo, MARGEM, meioCabecalho - lh / 2, lw, lh);
  } else if (d.marca.nome) {
    ctx.fillStyle = texto;
    ctx.font = fonte(800, 44);
    ctx.fillText(d.marca.nome, MARGEM, meioCabecalho);
  }
  if (d.peso_texto) {
    ctx.font = fonte(700, 30);
    const bw = ctx.measureText(d.peso_texto).width + 52, bh = 54;
    retanguloArredondado(ctx, W - MARGEM - bw, meioCabecalho - bh / 2, bw, bh, bh / 2);
    ctx.fillStyle = veu;
    ctx.fill();
    ctx.fillStyle = texto;
    ctx.fillText(d.peso_texto, W - MARGEM - bw + 26, meioCabecalho + 1);
  }

  // Nome (maior elemento)
  ctx.fillStyle = texto;
  ctx.font = fonte(800, fonteNome);
  ctx.textBaseline = "alphabetic";
  const passo = fonteNome * ALTURA_LINHA_NOME;
  linhas.forEach((linha, i) => ctx.fillText(linha, MARGEM, topoNome + passo * i + fonteNome * 0.86));

  // Preco (chamada) + contato
  const topoLinha = fimSeguro - alturaLinhaPreco;
  const meioLinha = topoLinha + alturaLinhaPreco / 2;
  ctx.font = fonte(800, fontePreco);
  const wPreco = ctx.measureText(d.preco_texto).width;
  const sufixo = `/${d.und || "unid."}`;
  ctx.font = fonte(700, 26);
  const wSufixo = ctx.measureText(sufixo).width;
  const pillH = fontePreco + 28, pillW = 30 + wPreco + 10 + wSufixo + 30;
  retanguloArredondado(ctx, MARGEM, meioLinha - pillH / 2, pillW, pillH, 22);
  ctx.fillStyle = seloFundo;
  ctx.fill();
  const basePreco = meioLinha + fontePreco * 0.36;
  ctx.fillStyle = seloTexto;
  ctx.font = fonte(800, fontePreco);
  ctx.fillText(d.preco_texto, MARGEM + 30, basePreco);
  ctx.globalAlpha = 0.8;
  ctx.font = fonte(700, 26);
  ctx.fillText(sufixo, MARGEM + 30 + wPreco + 10, basePreco);
  ctx.globalAlpha = 1;

  if (d.marca.whatsapp) {
    ctx.font = fonte(700, 34);
    ctx.textBaseline = "middle";
    const wNum = ctx.measureText(d.marca.whatsapp).width;
    const xNum = W - MARGEM - wNum;
    ctx.fillStyle = texto;
    ctx.fillText(d.marca.whatsapp, xNum, meioLinha + 1);
    ctx.save();
    ctx.translate(xNum - 14 - 40, meioLinha - 20);
    ctx.scale(40 / 24, 40 / 24);
    ctx.fill(new Path2D(WHATSAPP_PATH));
    ctx.restore();
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
