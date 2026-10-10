// Destinos: so muda a moldura. Topo/base = faixa que a interface do app cobre
// (Reels/Stories/TikTok/Status cobrem ~250px em cima e ~300px embaixo); nome,
// preco e contato ficam sempre dentro da zona segura. No 9:16 a escala da
// interface (ui) e maior, o nome pode ter 3 linhas, o contato ganha linha
// propria e o fundo recebe profundidade (peso gigante translucido + degrade).
export const PROPORCOES = {
  quadrado: { largura: 1080, altura: 1080, topo: MARGEM, base: MARGEM },
  retrato: { largura: 1080, altura: 1350, topo: MARGEM, base: MARGEM },
  vertical: {
    largura: 1080, altura: 1920, topo: 250, base: 300,
    ui: 1.3, nomeTamanhos: [112, 104, 96, 88, 80, 72, 64], nomeMaxLinhas: 3,
    contatoEmLinha: true, larguraProduto: 1000, escalaMaxProduto: 4, centralizarProduto: true, profundidade: true,
  },
};

const TAMANHOS_NOME_PADRAO = [84, 76, 68, 60, 54, 48];

export async function renderCardImagem(pacote, proporcao = pacote.proporcao) {
  const { dados: d, imagens = {} } = pacote;
  const moldura = PROPORCOES[proporcao] || PROPORCOES.quadrado;
  const W = moldura.largura, H = moldura.altura;
  const ui = moldura.ui || 1;
  const c1 = d.marca.cor_primaria, c2 = d.marca.cor_secundaria;
  const temFundo = !!imagens.fundo;
  const texto = temFundo ? "#ffffff" : corDeTexto(c1);
  const textoRgb = texto === "#ffffff" ? "255,255,255" : "17,17,17";
  const textoSuave = `rgba(${textoRgb},${texto === "#ffffff" ? 0.86 : 0.78})`;
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
  const { fonteNome, linhas } = medirNome(ctx, d.nome, moldura.nomeTamanhos || TAMANHOS_NOME_PADRAO, moldura.nomeMaxLinhas || 2);
  const fontePreco = Math.round(Math.max(44, Math.min(64 * ui, fonteNome - 12 * ui)));
  const fonteSufixo = Math.round(26 * ui), fonteContato = Math.round(34 * ui), iconeContato = Math.round(40 * ui);
  const seloFundo = contraste(c2, c1) >= 1.8 ? c2 : texto;
  const seloTexto = corDeTexto(seloFundo);

  // Grade vertical dentro da zona segura: cabecalho | produto | nome | preco | (contato)
  const topoCabecalho = moldura.topo, alturaCabecalho = Math.round(92 * ui);
  const fimSeguro = H - moldura.base;
  const alturaLinhaPreco = fontePreco + 36;
  const alturaContato = d.marca.whatsapp && moldura.contatoEmLinha ? iconeContato + 28 : 0;
  const alturaNome = Math.round(linhas.length * fonteNome * ALTURA_LINHA_NOME);
  const topoProduto = topoCabecalho + alturaCabecalho + 16;
  const topoContato = fimSeguro - alturaContato;
  const topoLinha = topoContato - alturaLinhaPreco;
  const topoNome = topoLinha - 24 - alturaNome;
  const baseArea = topoNome - 36;
  const alturaProduto = baseArea - topoProduto;

  // Produto: maior possivel na area
  const larguraMaxProduto = moldura.larguraProduto || LARGURA_UTIL * 0.9;
  const escala = foto ? Math.min(larguraMaxProduto / foto.width, (alturaProduto - 24) / foto.height, moldura.escalaMaxProduto || 3) : 0;
  const pw = foto ? Math.round(foto.width * escala) : 0, ph = foto ? Math.round(foto.height * escala) : 0;
  // apoiado no "chao" (feed) ou centralizado na area (9:16, onde sobra altura)
  const baseProduto = moldura.centralizarProduto && foto ? baseArea - Math.max(0, alturaProduto - 24 - ph) / 2 : baseArea;
  const centroProduto = foto ? baseProduto - 24 - ph / 2 : topoProduto + alturaProduto / 2;

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
    if (moldura.profundidade) {
      // degrade: escurece de leve as pontas para as faixas da interface nao ficarem chapadas
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0.16)");
      g.addColorStop(0.22, "rgba(0,0,0,0)");
      g.addColorStop(0.7, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.24)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // brilho suave atras do produto para dar profundidade a cor chapada
    elipseRadial(ctx, W / 2, centroProduto, moldura.profundidade ? 560 : 460, Math.max(400, ph / 2 + 160) * (moldura.profundidade ? 1.5 : 1), "255,255,255", 0.3);
  }

  // Peso gigante translucido atras do produto (decorativo, so 9:16)
  if (moldura.profundidade && d.peso_texto && !temFundo) {
    const marca = d.peso_texto.replace(/\s+/g, "");
    let f = 420;
    ctx.font = fonte(800, f);
    f = Math.min(f, Math.floor(f * (W * 0.92) / ctx.measureText(marca).width));
    ctx.font = fonte(800, f);
    ctx.fillStyle = `rgba(${textoRgb},0.09)`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(marca, W / 2, centroProduto);
    ctx.textAlign = "left";
  }

  if (foto) {
    const larguraSombra = Math.max(220, Math.round(pw * 0.85));
    elipseRadial(ctx, W / 2, baseProduto - 24, larguraSombra / 2, 28 * ui, "0,0,0", 0.32);
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
    const s = Math.min(alturaCabecalho / logo.height, (420 * ui) / logo.width);
    const lw = logo.width * s, lh = logo.height * s;
    ctx.drawImage(logo, MARGEM, meioCabecalho - lh / 2, lw, lh);
  } else if (d.marca.nome) {
    ctx.fillStyle = texto;
    ctx.font = fonte(800, Math.round(44 * ui));
    ctx.fillText(d.marca.nome, MARGEM, meioCabecalho);
  }
  if (d.peso_texto) {
    ctx.font = fonte(700, Math.round(30 * ui));
    const pad = Math.round(26 * ui), bh = Math.round(54 * ui);
    const bw = ctx.measureText(d.peso_texto).width + pad * 2;
    retanguloArredondado(ctx, W - MARGEM - bw, meioCabecalho - bh / 2, bw, bh, bh / 2);
    ctx.fillStyle = veu;
    ctx.fill();
    ctx.fillStyle = texto;
    ctx.fillText(d.peso_texto, W - MARGEM - bw + pad, meioCabecalho + 1);
  }

  // Nome (maior elemento)
  ctx.fillStyle = texto;
  ctx.font = fonte(800, fonteNome);
  ctx.textBaseline = "alphabetic";
  const passo = fonteNome * ALTURA_LINHA_NOME;
  linhas.forEach((linha, i) => ctx.fillText(linha, MARGEM, topoNome + passo * i + fonteNome * 0.86));

  // Preco (chamada)
  const meioLinha = topoLinha + alturaLinhaPreco / 2;
  ctx.font = fonte(800, fontePreco);
  const wPreco = ctx.measureText(d.preco_texto).width;
  const sufixo = `/${d.und || "unid."}`;
  ctx.font = fonte(700, fonteSufixo);
  const wSufixo = ctx.measureText(sufixo).width;
  const padPill = Math.round(30 * ui);
  const pillH = fontePreco + 28, pillW = padPill + wPreco + 10 + wSufixo + padPill;
  retanguloArredondado(ctx, MARGEM, meioLinha - pillH / 2, pillW, pillH, Math.round(22 * ui));
  ctx.fillStyle = seloFundo;
  ctx.fill();
  const basePreco = meioLinha + fontePreco * 0.36;
  ctx.fillStyle = seloTexto;
  ctx.font = fonte(800, fontePreco);
  ctx.fillText(d.preco_texto, MARGEM + padPill, basePreco);
  ctx.globalAlpha = 0.8;
  ctx.font = fonte(700, fonteSufixo);
  ctx.fillText(sufixo, MARGEM + padPill + wPreco + 10, basePreco);
  ctx.globalAlpha = 1;

  // Contato: icone do WhatsApp + numero (ao lado do preco, ou em linha propria no 9:16)
  if (d.marca.whatsapp) {
    ctx.font = fonte(700, fonteContato);
    ctx.textBaseline = "middle";
    const wNum = ctx.measureText(d.marca.whatsapp).width;
    const emLinha = moldura.contatoEmLinha;
    const meio = emLinha ? topoContato + alturaContato / 2 + 6 : meioLinha;
    const xIcone = emLinha ? MARGEM : W - MARGEM - wNum - 14 - iconeContato;
    ctx.fillStyle = texto;
    ctx.fillText(d.marca.whatsapp, xIcone + iconeContato + 14, meio + 1);
    ctx.save();
    ctx.translate(xIcone, meio - iconeContato / 2);
    ctx.scale(iconeContato / 24, iconeContato / 24);
    ctx.fill(new Path2D(WHATSAPP_PATH));
    ctx.restore();
  }

  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar o PNG"))), "image/png"),
  );
  return blob;
}
