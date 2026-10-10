// Gerador de card de produto para redes sociais (PNG 1080x1080) - lado servidor.
//
// Duas camadas:
//  - DADOS (sempre deterministica, sem IA): nome, peso e preco do revendedor
//    lidos do banco AQUI no servidor, com checagem de dono.
//  - ARTE (opcional): so o fundo/cena. A IA nunca escreve texto nem numero.
//
// O desenho do PNG roda no navegador (src/lib/cardRender.js): o runtime de
// funcoes do Base44 proibe WebAssembly ("Wasm code generation disallowed by
// embedder"), o que inviabiliza satori/resvg aqui. O servidor entrega os dados
// verificados e as imagens ja embutidas (data URI), sem problema de CORS no
// canvas. Formato "video" (premium) entra como outro renderizador la.

export const FORMATOS = ['imagem'];
// Destinos (so muda a moldura no renderizador): 1:1 1080x1080, 4:5 1080x1350, 9:16 1080x1920
export const PROPORCOES = ['quadrado', 'retrato', 'vertical'];
export const normalizarProporcao = (v: unknown) =>
  typeof v === 'string' && PROPORCOES.includes(v) ? v : 'quadrado';
const LIMITE_IMAGEM = 8 * 1024 * 1024;

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

// ---------------------------------------------------------------- imagens

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

// Baixa a imagem e devolve como data URI (o navegador decodifica PNG/JPEG/WebP/GIF).
export async function imagemParaDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.length > LIMITE_IMAGEM) return null;
    const tipo = tipoPorAssinatura(bytes);
    return tipo ? `data:${tipo};base64,${toBase64(bytes)}` : null;
  } catch (e) {
    console.error('imagemParaDataUri falhou:', url, (e as Error)?.message);
    return null;
  }
}

// Pacote que o navegador desenha: so dados verificados + imagens embutidas.
export async function montarPacoteCard(d: DadosCard, fundoUrl: string | null = null) {
  const [foto, logo, fundo] = await Promise.all([
    imagemParaDataUri(d.foto),
    imagemParaDataUri(d.marca.logo),
    imagemParaDataUri(fundoUrl),
  ]);
  return {
    dados: {
      nome: d.nome,
      peso_kg: d.peso_kg,
      und: d.und,
      preco_final: d.preco_final,
      preco_texto: formatarPreco(d.preco_final),
      peso_texto: d.peso_kg != null ? formatarPeso(d.peso_kg) : null,
      marca: { nome: d.marca.nome, cor_primaria: d.marca.cor_primaria, cor_secundaria: d.marca.cor_secundaria, whatsapp: d.marca.whatsapp },
    },
    imagens: { foto, logo, fundo },
  };
}
