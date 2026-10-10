// Gerador de card de produto para redes sociais (PNG 1080x1080).
//
// Duas camadas:
//  - DADOS (sempre deterministica, sem IA): nome, peso e preco do revendedor
//    lidos do banco no servidor e desenhados como texto sobre a imagem.
//  - ARTE (opcional): so o fundo/cena. A IA nunca escreve texto nem numero;
//    o fundo entra por baixo da mesma montagem da camada de dados.
//
// Formatos: hoje so "imagem". "video" e fase futura (premium) e entra como
// outro renderizador em RENDERIZADORES, sem mudar a funcao nem a tela.

import satori from 'npm:satori@0.10.14';
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';
import decodeWebp, { init as initWebp } from 'npm:@jsquash/webp@1.4.0/decode.js';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

export const CARD_LADO = 1080;

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm';
const WEBP_WASM_URL = 'https://cdn.jsdelivr.net/npm/@jsquash/webp@1.4.0/codec/dec/webp_dec.wasm';
const FONTES = [
  { weight: 500, url: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-500-normal.woff' },
  { weight: 700, url: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-700-normal.woff' },
  { weight: 800, url: 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-800-normal.woff' },
];

const COR_PRIMARIA_PADRAO = '#1e40af';
const COR_SECUNDARIA_PADRAO = '#059669';

export class ErroCard extends Error {
  status: number;
  constructor(mensagem: string, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

export type MarcaCard = {
  nome: string;
  logo: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  whatsapp: string | null;
};

export type DadosCard = {
  supplier_product_id: string;
  product_id: string;
  revendedor_id: string;
  nome: string;
  peso_kg: number | null;
  und: string | null;
  preco_final: number; // ja com a margem do revendedor, arredondado a centavos
  foto: string | null;
  marca: MarcaCard;
};

// ---------------------------------------------------------------- dados

const hexValido = (v: unknown, padrao: string) =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : padrao;

// Mesma conta da tela "Meus Produtos": preco de fabrica x (1 + margem/100).
export const precoRevendedor = (preco: number, margem: number) =>
  Math.round(preco * (1 + (margem || 0) / 100) * 100) / 100;

// Le tudo do banco com service role e confere que o produto e do usuario.
// O preco nunca vem do navegador.
export async function carregarDadosCard(base44: any, user: any, supplierProductId: string): Promise<DadosCard> {
  if (!supplierProductId) throw new ErroCard('supplier_product_id obrigatorio');

  const sps = await base44.asServiceRole.entities.SupplierProduct.filter({ id: supplierProductId });
  const sp = sps?.[0];
  if (!sp) throw new ErroCard('Produto nao encontrado', 404);
  if (sp.supplier_id !== user.id && user.role !== 'admin') throw new ErroCard('Produto de outro revendedor', 403);
  if (!sp.preco || sp.preco <= 0) throw new ErroCard('Produto sem preco definido');

  const tmpls = await base44.asServiceRole.entities.ProductTemplate.filter({ id: sp.product_id });
  const tmpl = tmpls?.[0];
  if (!tmpl) throw new ErroCard('Produto do catalogo nao encontrado', 404);

  const donoId = sp.supplier_id;
  const [lojas, donos] = await Promise.all([
    base44.asServiceRole.entities.LojaConfig.filter({ revendedor_id: donoId }),
    donoId === user.id ? Promise.resolve([user]) : base44.asServiceRole.entities.User.filter({ id: donoId }),
  ]);
  const loja = lojas?.[0] || {};
  const dono = donos?.[0] || {};

  return {
    supplier_product_id: sp.id,
    product_id: tmpl.id,
    revendedor_id: donoId,
    nome: String(tmpl.nome || '').trim(),
    peso_kg: typeof tmpl.peso_kg === 'number' && tmpl.peso_kg > 0 ? tmpl.peso_kg : null,
    und: tmpl.und || null,
    preco_final: precoRevendedor(Number(sp.preco), Number(sp.margem) || 0),
    foto: tmpl.foto || null,
    marca: {
      nome: String(loja.nome_loja || dono.empresa || dono.full_name || '').trim(),
      logo: loja.logo_url || dono.logomarca || null,
      cor_primaria: hexValido(loja.cor_primaria, COR_PRIMARIA_PADRAO),
      cor_secundaria: hexValido(loja.cor_secundaria, COR_SECUNDARIA_PADRAO),
      whatsapp: loja.whatsapp_contato || dono.whatsapp || null,
    },
  };
}

// ---------------------------------------------------------------- textos

export const formatarPreco = (v: number) =>
  'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const formatarPeso = (kg: number) =>
  (Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ',')) + ' kg';

// ---------------------------------------------------------------- recursos

let prontoWasm: Promise<void> | null = null;
let fontesCache: Promise<any[]> | null = null;

const garantirWasm = () => (prontoWasm ??= initWasm(fetch(WASM_URL)));
const carregarFontes = () =>
  (fontesCache ??= Promise.all(
    FONTES.map(async (f) => ({
      name: 'Inter',
      weight: f.weight,
      style: 'normal',
      data: await (await fetch(f.url)).arrayBuffer(),
    })),
  ));

const toBase64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

const tipoPorAssinatura = (b: Uint8Array) => {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  return null;
};

// Nem satori nem resvg-wasm decodificam WebP (muitas fotos de fornecedor sao
// .webp). Decodifica com libwebp em wasm e regrava como PNG.
let prontoWebp: Promise<void> | null = null;
const garantirWebp = () =>
  (prontoWebp ??= fetch(WEBP_WASM_URL)
    .then((r) => r.arrayBuffer())
    .then((buf) => WebAssembly.compile(buf))
    .then((mod) => initWebp(mod))
    .then(() => undefined));

async function webpParaPng(bytes: Uint8Array): Promise<Uint8Array | null> {
  await garantirWebp();
  const rgba = await decodeWebp(bytes.slice().buffer);
  if (!rgba?.width) return null;
  const img = new Image(rgba.width, rgba.height);
  img.bitmap.set(rgba.data);
  return await img.encode();
}

// Baixa uma imagem e devolve data URI que o satori aceita, ou null.
export async function imagemParaDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    let bytes: Uint8Array = new Uint8Array(await resp.arrayBuffer());
    let tipo = tipoPorAssinatura(bytes);
    if (tipo === 'image/webp') {
      const png = await webpParaPng(bytes);
      if (!png) return null;
      bytes = png;
      tipo = 'image/png';
    }
    if (!tipo) return null;
    return `data:${tipo};base64,${toBase64(bytes)}`;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------- layout

const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}) =>
  ({ type, props: { style, children, ...extra } });

// Tamanho do nome conforme o comprimento, para caber em ate 3 linhas.
const tamanhoNome = (nome: string) => (nome.length <= 28 ? 64 : nome.length <= 48 ? 54 : nome.length <= 72 ? 44 : 38);

function montarArvore(d: DadosCard, foto: string | null, logo: string | null, fundo: string | null) {
  const { cor_primaria: c1, cor_secundaria: c2 } = d.marca;
  const L = CARD_LADO;

  const cabecalho = h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 96 }, [
    logo
      ? h('div', { display: 'flex', alignItems: 'center', background: '#ffffff', borderRadius: 20, padding: '12px 22px', height: 96 }, [
          h('img', { height: 72, maxWidth: 360, objectFit: 'contain' }, undefined, { src: logo }),
        ])
      : h('div', { display: 'flex', color: '#ffffff', fontSize: 44, fontWeight: 800 }, d.marca.nome),
    d.peso_kg != null
      ? h('div', { display: 'flex', background: c1, color: '#ffffff', fontSize: 40, fontWeight: 800, borderRadius: 999, padding: '14px 34px' }, formatarPeso(d.peso_kg))
      : h('div', { display: 'flex' }, ''),
  ]);

  const painelFoto = h('div', {
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, width: '100%',
    background: '#ffffff', borderRadius: 36, marginTop: 28, marginBottom: 28, overflow: 'hidden',
  }, foto
    ? [h('img', { width: '88%', height: '88%', objectFit: 'contain' }, undefined, { src: foto })]
    : [h('div', { display: 'flex', color: '#9ca3af', fontSize: 36, fontWeight: 500 }, 'Foto indisponível')]);

  const rodape = h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' }, [
    h('div', { display: 'flex', flexDirection: 'column', flexShrink: 1, marginRight: 28, maxWidth: 600 }, [
      h('div', { display: 'flex', color: '#ffffff', fontSize: tamanhoNome(d.nome), fontWeight: 800, lineHeight: 1.08, lineClamp: 3 }, d.nome),
      d.marca.whatsapp
        ? h('div', { display: 'flex', color: 'rgba(255,255,255,0.85)', fontSize: 30, fontWeight: 500, marginTop: 16 }, `WhatsApp ${d.marca.whatsapp}`)
        : h('div', { display: 'flex' }, ''),
    ]),
    h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', background: c1, borderRadius: 28, padding: '18px 30px', flexShrink: 0 }, [
      h('div', { display: 'flex', color: 'rgba(255,255,255,0.9)', fontSize: 28, fontWeight: 700 }, d.und ? `por ${d.und}` : 'por unidade'),
      h('div', { display: 'flex', color: '#ffffff', fontSize: 76, fontWeight: 800, lineHeight: 1 }, formatarPreco(d.preco_final)),
    ]),
  ]);

  const camadas: unknown[] = [];
  if (fundo) {
    camadas.push(h('img', { position: 'absolute', top: 0, left: 0, width: L, height: L, objectFit: 'cover' }, undefined, { src: fundo }));
    // veu escuro para o texto branco continuar legivel sobre qualquer fundo
    camadas.push(h('div', { position: 'absolute', top: 0, left: 0, width: L, height: L, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.65) 100%)' }));
  }
  camadas.push(h('div', { position: 'absolute', top: 0, left: 0, width: L, height: L, display: 'flex', flexDirection: 'column', padding: 56 }, [cabecalho, painelFoto, rodape]));

  return h('div', {
    width: L, height: L, display: 'flex', position: 'relative', fontFamily: 'Inter',
    background: fundo ? '#111111' : `linear-gradient(160deg, ${c2} 0%, ${c2} 55%, ${c1} 160%)`,
  }, camadas);
}

// ---------------------------------------------------------------- renderizadores

export type OpcoesRender = { fundoUrl?: string | null };

export async function renderCardImagem(d: DadosCard, opcoes: OpcoesRender = {}): Promise<Uint8Array> {
  const [fontes, foto, logo, fundo] = await Promise.all([
    carregarFontes(),
    imagemParaDataUri(d.foto),
    imagemParaDataUri(d.marca.logo),
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
