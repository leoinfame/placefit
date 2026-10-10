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

  // Cores: rodape solido que contrasta com a marca
  const marcaEscura = luminancia(hexParaRgb(c1)) < 0.2;
  const marcaClara = luminancia(hexParaRgb(c1)) > 0.45;
  const painel = marcaEscura ? "#ffffff" : misturar(c1, "#000000", 0.84);
  const painelTexto = corDeTexto(painel);
  const precoCor = contraste(c1, painel) >= 3 ? c1 : painelTexto;
  const textoTopo = temFundo ? "#ffffff" : corDeTexto(c1);

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
    g.addColorStop(0, misturar(c1, "#ffffff", marcaClara ? 0.35 : 0.22));
    g.addColorStop(0.45, c1);
    g.addColorStop(1, misturar(c1, "#000000", marcaClara ? 0.22 : 0.38));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const tam = caixas.foto ? Math.max(caixas.foto.w, caixas.foto.h) : 400;
    texturaDiagonal(ctx, W, H, marcaClara ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", cxFoto, cyFoto, tam * 0.6);
  }
  const vin = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  vin.addColorStop(0, "rgba(0,0,0,0)");
  vin.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vin;
  ctx.fillRect(0, 0, W, H);

  // ---------------- faixa 2: spotlight, sombra de contato e foto ----------------
  if (caixas.foto) {
    const f = caixas.foto, s = caixas.sombra;
    const tam = Math.max(f.w, f.h);
    elipseRadial(ctx, cxFoto, cyFoto, tam * 0.62 + 80, tam * 0.55 + 60, "255,255,255", marcaClara ? 0.45 : 0.32);
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
    ctx.fillStyle = painel;
    ctx.fill();
    ctx.fillStyle = painelTexto;
    ctx.font = fonte(800, fonteBadge);
    ctx.fillText(d.peso_texto, b.x + padBadge, b.y + b.h / 2 + 1);
  }

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar o PNG"))), "image/png"),
  );
  blob.violacoes = layout.violacoes;
  return blob;
}
