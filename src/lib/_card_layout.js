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
