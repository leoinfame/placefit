const tipoPorAssinatura = (b: Uint8Array) => {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  return null;
};

// Nem satori nem resvg-wasm decodificam WebP (muitas fotos de fornecedor sao
// .webp). Decodifica com libwebp em wasm.
let prontoWebp: Promise<void> | null = null;
const garantirWebp = () =>
  (prontoWebp ??= fetch(WEBP_WASM_URL)
    .then((r) => r.arrayBuffer())
    .then((buf) => WebAssembly.compile(buf))
    .then((mod) => initWebp(mod))
    .then(() => undefined));

async function decodificar(bytes: Uint8Array): Promise<Image | null> {
  const tipo = tipoPorAssinatura(bytes);
  if (tipo === 'image/webp') {
    await garantirWebp();
    const rgba = await decodeWebp(bytes.slice().buffer);
    if (!rgba?.width) return null;
    const img = new Image(rgba.width, rgba.height);
    img.bitmap.set(rgba.data);
    return img;
  }
  if (tipo === 'image/png' || tipo === 'image/jpeg') return (await Image.decode(bytes)) as Image;
  return null;
}

// Fundo artistico: so baixa e embute (sem tratamento).
export async function imagemParaDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const tipo = tipoPorAssinatura(bytes);
    if (tipo === 'image/webp') {
      const img = await decodificar(bytes);
      return img ? `data:image/png;base64,${toBase64(await img.encode())}` : null;
    }
    return tipo ? `data:${tipo};base64,${toBase64(bytes)}` : null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------- cores

type RGB = [number, number, number];

const hexParaRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;

const luminancia = ([r, g, b]: RGB) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(hexParaRgb(a)), luminancia(hexParaRgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Todo texto do card e grande e em negrito (>= 24px), onde 3:1 ja e legivel
// (WCAG AA texto grande). Prefere branco; cai para quase-preto se nao der.
export const corDeTexto = (fundo: string) => (contraste(fundo, '#ffffff') >= 3 ? '#ffffff' : '#111111');

// ---------------------------------------------------------------- tratamento de imagem

// Torna transparente o fundo claro que encosta na borda (flood fill a partir
// das bordas) e suaviza o contorno. So age se ao menos 3 cantos forem claros,
// para nao estragar foto com cenario.
function removerFundoClaro(img: Image) {
  const w = img.width, hgt = img.height, px = img.bitmap, n = w * hgt;
  const claro = (p: number) => {
    const i = p * 4;
    return px[i + 3] < 16 || (px[i] >= 228 && px[i + 1] >= 228 && px[i + 2] >= 228);
  };
  if ([0, w - 1, (hgt - 1) * w, n - 1].filter(claro).length < 3) return;

  const fundo = new Uint8Array(n);
  const fila = new Int32Array(n);
  let ini = 0, fim = 0;
  const marcar = (p: number) => {
    if (!fundo[p] && claro(p)) { fundo[p] = 1; fila[fim++] = p; }
  };
  for (let x = 0; x < w; x++) { marcar(x); marcar((hgt - 1) * w + x); }
  for (let y = 0; y < hgt; y++) { marcar(y * w); marcar(y * w + w - 1); }
  while (ini < fim) {
    const p = fila[ini++], x = p % w;
    if (x > 0) marcar(p - 1);
    if (x < w - 1) marcar(p + 1);
    if (p >= w) marcar(p - w);
    if (p < n - w) marcar(p + w);
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
}

// Corta as margens transparentes.
function aparar(img: Image): Image {
  const w = img.width, hgt = img.height, px = img.bitmap;
  let x0 = w, y0 = hgt, x1 = -1, y1 = -1;
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? img : img.crop(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

// Logo que some no fundo (ex.: simbolo laranja sobre laranja) vira
// monocromatica na cor do texto. Brancos internos viram vazados.
function tingirSePoucoContraste(img: Image, fundo: string, cor: string) {
  const px = img.bitmap, bg = hexParaRgb(fundo), c = hexParaRgb(cor);
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
}

export type ImagemPreparada = { uri: string; w: number; h: number };

export async function prepararImagem(
  url: string | null,
  opcoes: { removerFundo?: boolean; tingir?: { fundo: string; cor: string } } = {},
): Promise<ImagemPreparada | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let img = await decodificar(bytes);
    if (!img) {
      const tipo = tipoPorAssinatura(bytes); // gif: usa como veio
      return tipo ? { uri: `data:${tipo};base64,${toBase64(bytes)}`, w: 0, h: 0 } : null;
    }
    if (Math.max(img.width, img.height) > 1400) {
      if (img.width >= img.height) img.resize(1400, Image.RESIZE_AUTO);
      else img.resize(Image.RESIZE_AUTO, 1400);
    }
    if (opcoes.removerFundo) {
      removerFundoClaro(img);
      img = aparar(img);
    }
    if (opcoes.tingir) tingirSePoucoContraste(img, opcoes.tingir.fundo, opcoes.tingir.cor);
    return { uri: `data:image/png;base64,${toBase64(await img.encode())}`, w: img.width, h: img.height };
  } catch (e) {
    console.error('prepararImagem falhou:', url, (e as Error)?.message);
    return null;
  }
}

// ---------------------------------------------------------------- layout

const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}) =>
  ({ type, props: { style, children, ...extra } });

const MARGEM = 64; // area segura do feed
const LARGURA_UTIL = CARD_LADO - 2 * MARGEM;
const ALTURA_LINHA_NOME = 1.06;

// Icone do WhatsApp (Simple Icons, CC0).
const WHATSAPP_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z';

const iconeWhatsapp = (cor: string) =>
  'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${cor}" d="${WHATSAPP_PATH}"/></svg>`);

// Estimativa de linhas (Inter 800 ~ 0.56em por caractere) para escolher o
// maior corpo do nome que caiba em 2 linhas na largura util.
const linhasEstimadas = (texto: string, fonte: number, largura: number) => {
  const porLinha = Math.max(1, Math.floor(largura / (fonte * 0.56)));
  let linhas = 1, atual = 0;
  for (const palavra of texto.split(/\s+/)) {
    const t = palavra.length + (atual ? 1 : 0);
    if (atual + t > porLinha && atual) { linhas++; atual = palavra.length; } else atual += t;
  }
  return linhas;
};

export const escolherFonteNome = (nome: string) => {
  for (const f of [84, 76, 68, 60, 54, 48]) if (linhasEstimadas(nome, f, LARGURA_UTIL) <= 2) return f;
  return 44;
};

function montarArvore(d: DadosCard, foto: ImagemPreparada | null, logo: ImagemPreparada | null, fundo: string | null) {
  const L = CARD_LADO;
  const c1 = d.marca.cor_primaria, c2 = d.marca.cor_secundaria;
  const texto = fundo ? '#ffffff' : corDeTexto(c1);
  const textoSuave = texto === '#ffffff' ? 'rgba(255,255,255,0.86)' : 'rgba(17,17,17,0.78)';
  const veu = texto === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)';

  // Hierarquia: nome (maior) > preco (segundo) > peso (badge discreto)
  const fonteNome = escolherFonteNome(d.nome);
  const linhasNome = Math.min(2, linhasEstimadas(d.nome, fonteNome, LARGURA_UTIL));
  const fontePreco = Math.max(44, Math.min(64, fonteNome - 12));
  const seloFundo = contraste(c2, c1) >= 1.8 ? c2 : texto;
  const seloTexto = corDeTexto(seloFundo);

  // Grade vertical: cabecalho | produto | nome | preco+contato
  const topoCabecalho = MARGEM, alturaCabecalho = 92;
  const alturaLinhaPreco = fontePreco + 36;
  const alturaNome = Math.round(linhasNome * fonteNome * ALTURA_LINHA_NOME);
  const topoNome = L - MARGEM - alturaLinhaPreco - 24 - alturaNome;
  const topoProduto = topoCabecalho + alturaCabecalho + 16;
  const baseProduto = topoNome - 36;
  const alturaProduto = baseProduto - topoProduto;

  const camadas: unknown[] = [];

  if (fundo) {
    camadas.push(h('img', { position: 'absolute', top: 0, left: 0, width: L, height: L, objectFit: 'cover' }, undefined, { src: fundo }));
    camadas.push(h('div', { position: 'absolute', top: 0, left: 0, width: L, height: L, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.7) 100%)' }));
  } else {
    // brilho suave atras do produto para dar profundidade a cor chapada
    camadas.push(h('div', {
      position: 'absolute', left: L / 2 - 460, top: topoProduto + alturaProduto / 2 - 400, width: 920, height: 800, display: 'flex',
      backgroundImage: 'radial-gradient(closest-side, rgba(255,255,255,0.30), rgba(255,255,255,0))',
    }));
  }

  // Produto: maior possivel na area, apoiado no "chao" com sombra
  if (foto && foto.w > 0) {
    const escala = Math.min(LARGURA_UTIL / foto.w, (alturaProduto - 24) / foto.h, 3);
    const pw = Math.round(foto.w * escala), ph = Math.round(foto.h * escala);
    const topo = baseProduto - 24 - ph;
    const larguraSombra = Math.max(220, Math.round(pw * 0.85));
    camadas.push(h('div', {
      position: 'absolute', left: (L - larguraSombra) / 2, top: baseProduto - 52, width: larguraSombra, height: 56, display: 'flex',
      backgroundImage: 'radial-gradient(closest-side, rgba(0,0,0,0.32), rgba(0,0,0,0))',
    }));
    camadas.push(h('img', { position: 'absolute', left: (L - pw) / 2, top: topo, width: pw, height: ph }, undefined, { src: foto.uri }));
  } else if (foto) {
    camadas.push(h('img', { position: 'absolute', left: MARGEM, top: topoProduto, width: LARGURA_UTIL, height: alturaProduto, objectFit: 'contain' }, undefined, { src: foto.uri }));
  } else {
    camadas.push(h('div', { position: 'absolute', left: MARGEM, top: topoProduto, width: LARGURA_UTIL, height: alturaProduto, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textoSuave, fontSize: 36, fontWeight: 500 }, 'Foto indisponível'));
  }

  // Cabecalho: logo grande sem caixa + peso discreto
  const cabecalho: unknown[] = [];
  if (logo && logo.w > 0) {
    const s = Math.min(alturaCabecalho / logo.h, 420 / logo.w);
    cabecalho.push(h('img', { width: Math.round(logo.w * s), height: Math.round(logo.h * s) }, undefined, { src: logo.uri }));
  } else if (logo) {
    cabecalho.push(h('img', { height: alturaCabecalho, maxWidth: 420, objectFit: 'contain' }, undefined, { src: logo.uri }));
  } else {
    cabecalho.push(h('div', { display: 'flex', color: texto, fontSize: 44, fontWeight: 800 }, d.marca.nome));
  }
  cabecalho.push(d.peso_kg != null
    ? h('div', { display: 'flex', alignItems: 'center', background: veu, color: texto, fontSize: 30, fontWeight: 700, borderRadius: 999, padding: '10px 26px' }, formatarPeso(d.peso_kg))
    : h('div', { display: 'flex' }, ''));
  camadas.push(h('div', { position: 'absolute', left: MARGEM, top: topoCabecalho, width: LARGURA_UTIL, height: alturaCabecalho, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, cabecalho));

  // Nome (maior elemento)
  camadas.push(h('div', {
    position: 'absolute', left: MARGEM, top: topoNome, width: LARGURA_UTIL, display: 'flex',
    color: texto, fontSize: fonteNome, fontWeight: 800, lineHeight: ALTURA_LINHA_NOME, letterSpacing: -1, lineClamp: 2,
  }, d.nome));

  // Preco (chamada) + contato
  const linhaPreco: unknown[] = [
    h('div', { display: 'flex', alignItems: 'baseline', background: seloFundo, borderRadius: 22, padding: '14px 30px' }, [
      h('div', { display: 'flex', color: seloTexto, fontSize: fontePreco, fontWeight: 800, lineHeight: 1, letterSpacing: -1 }, formatarPreco(d.preco_final)),
      h('div', { display: 'flex', color: seloTexto, opacity: 0.8, fontSize: 26, fontWeight: 700, marginLeft: 10 }, `/${d.und || 'unid.'}`),
    ]),
  ];
  if (d.marca.whatsapp) {
    linhaPreco.push(h('div', { display: 'flex', alignItems: 'center' }, [
      h('img', { width: 40, height: 40, marginRight: 14 }, undefined, { src: iconeWhatsapp(texto) }),
      h('div', { display: 'flex', color: texto, fontSize: 34, fontWeight: 700 }, d.marca.whatsapp),
    ]));
  }
  camadas.push(h('div', {
    position: 'absolute', left: MARGEM, top: L - MARGEM - alturaLinhaPreco, width: LARGURA_UTIL, height: alturaLinhaPreco,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }, linhaPreco));

  return h('div', { width: L, height: L, display: 'flex', position: 'relative', fontFamily: 'Inter', background: fundo ? '#111111' : c1 }, camadas);
}

// ---------------------------------------------------------------- renderizadores

export type OpcoesRender = { fundoUrl?: string | null };

export async function renderCardImagem(d: DadosCard, opcoes: OpcoesRender = {}): Promise<Uint8Array> {
  const fundoCard = opcoes.fundoUrl ? '#111111' : d.marca.cor_primaria;
  const corTexto = opcoes.fundoUrl ? '#ffffff' : corDeTexto(d.marca.cor_primaria);
  const [fontes, foto, logo, fundo] = await Promise.all([
    carregarFontes(),
    prepararImagem(d.foto, { removerFundo: true }),
    prepararImagem(d.marca.logo, { removerFundo: true, tingir: { fundo: fundoCard, cor: corTexto } }),
    imagemParaDataUri(opcoes.fundoUrl || null),
    garantirWasm(),
  ]);
  const svg = await satori(montarArvore(d, foto, logo, fundo) as any, { width: CARD_LADO, height: CARD_LADO, fonts: fontes });
  return new Resvg(svg, { fitTo: { mode: 'width', value: CARD_LADO } }).render().asPng();
}

// Ponto de extensao: formato -> renderizador. "video" entra aqui na fase premium.
export const RENDERIZADORES: Record<string, ((d: DadosCard, o?: OpcoesRender) => Promise<Uint8Array>) | undefined> = {
  imagem: renderCardImagem,
};

export { toBase64 };
