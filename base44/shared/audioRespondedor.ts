// ─── Áudio → texto para o respondedor automático ────────────────────────────
// 1. GET /{media-id} na Graph API (META_ACCESS_TOKEN) → URL temporária da mídia
// 2. GET na URL com o mesmo token → bytes do áudio
// 3. OpenAI /v1/audio/transcriptions (OPENAI_API_KEY), language=pt + prompt de
//    vocabulário do negócio. O áudio vai direto pra OpenAI, sem passar por storage.
// Sem OPENAI_API_KEY, não transcreve (nunca cai num motor que alucina): o fluxo
// pede pro cliente mandar por texto.
// Nunca lança: devolve { ok, texto, erro } para o fluxo seguir.

const GRAPH_VERSION = 'v21.0';
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const MODELO_PADRAO = 'gpt-4o-transcribe';

const CONTEXTO_TRANSCRICAO =
  'Conversa de vendas de equipamentos de academia, português do Brasil, sotaque mineiro. ' +
  'Vocabulário: anilhas, halteres, kettlebell, piso emborrachado, orçamento, PlaceFit, MuscularFit, revenda.';

// Frases que o Whisper costuma "inventar" em áudio mudo ou com ruído
const ALUCINACOES_CONHECIDAS = /amara\.org|legendas? (pela|por|da)|obrigad[oa] por assistir|inscreva-se no canal|♪/i;

const env = (nome: string) => String(Deno.env.get(nome) || '').trim();

async function baixarMidia(mediaId: string) {
  const token = env('META_ACCESS_TOKEN');
  if (!token) throw new Error('META_ACCESS_TOKEN ausente');
  const auth = { Authorization: `Bearer ${token}` };

  const meta = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, { headers: auth });
  const info: any = await meta.json().catch(() => ({}));
  if (!meta.ok || !info?.url) throw new Error(`media ${meta.status}: ${info?.error?.message || 'sem url'}`);
  if (Number(info.file_size) > TAMANHO_MAXIMO) throw new Error('áudio grande demais');

  const arq = await fetch(info.url, { headers: auth });
  if (!arq.ok) throw new Error(`download ${arq.status}`);
  const bytes = new Uint8Array(await arq.arrayBuffer());
  if (!bytes.length) throw new Error('áudio vazio');
  if (bytes.length > TAMANHO_MAXIMO) throw new Error('áudio grande demais');
  const mime = String(info.mime_type || 'audio/ogg').split(';')[0].trim();
  return { bytes, mime };
}

async function transcreverOpenAI(bytes: Uint8Array, mime: string, nome: string) {
  const chave = env('OPENAI_API_KEY');
  if (!chave) throw new Error('OPENAI_API_KEY ausente');
  const form = new FormData();
  form.append('file', new File([bytes], nome, { type: mime }));
  form.append('model', env('OPENAI_TRANSCRIBE_MODEL') || MODELO_PADRAO);
  form.append('language', 'pt');
  form.append('prompt', CONTEXTO_TRANSCRICAO);
  form.append('response_format', 'json');
  form.append('temperature', '0');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}` },
    body: form
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`openai ${res.status}: ${data?.error?.message || 'falha na transcrição'}`);
  return String(data?.text || '').trim();
}

export async function transcreverAudio(_base44: any, msg: any): Promise<{ ok: boolean; texto: string; erro: string }> {
  try {
    const mediaId = String(msg?.audio?.id || '');
    if (!mediaId) return { ok: false, texto: '', erro: 'áudio sem media id' };

    const { bytes, mime } = await baixarMidia(mediaId);
    const ext = mime.includes('mpeg') ? 'mp3' : mime.includes('mp4') ? 'm4a' : mime.includes('amr') ? 'amr' : 'ogg';
    const texto = (await transcreverOpenAI(bytes, mime, `whatsapp-${mediaId}.${ext}`)).slice(0, 2000);

    if (!texto) return { ok: false, texto: '', erro: 'transcrição vazia' };
    if (ALUCINACOES_CONHECIDAS.test(texto)) return { ok: false, texto: '', erro: 'transcrição descartada (padrão de alucinação): ' + texto.slice(0, 80) };
    return { ok: true, texto, erro: '' };
  } catch (e) {
    return { ok: false, texto: '', erro: String((e as any)?.message || e).slice(0, 300) };
  }
}
