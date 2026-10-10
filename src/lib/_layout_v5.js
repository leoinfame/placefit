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
