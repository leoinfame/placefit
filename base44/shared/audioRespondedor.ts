// ─── Áudio → texto para o respondedor automático ────────────────────────────
// 1. GET /{media-id} na Graph API (META_ACCESS_TOKEN) → URL temporária da mídia
// 2. GET na URL com o mesmo token → bytes do áudio
// 3. UploadPrivateFile + CreateFileSignedUrl (URL assinada de 5 min; o áudio do
//    cliente nunca fica público)
// 4. InvokeLLM com o modelo Gemini (entende áudio) → transcrição
// Nunca lança: devolve { ok, texto, erro } para o fluxo seguir.

const GRAPH_VERSION = 'v21.0';
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const MODELO_TRANSCRICAO = 'gemini_3_flash';

const env = (nome: string) => String(Deno.env.get(nome) || '').trim();

const SCHEMA = {
  type: 'object',
  properties: {
    ouviu_fala: { type: 'boolean', description: 'true só se havia fala humana compreensível no áudio anexado' },
    transcricao: { type: 'string', description: 'transcrição literal da fala, ou vazio' }
  },
  required: ['ouviu_fala', 'transcricao']
};

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

export async function transcreverAudio(base44: any, msg: any): Promise<{ ok: boolean; texto: string; erro: string }> {
  try {
    const mediaId = String(msg?.audio?.id || '');
    if (!mediaId) return { ok: false, texto: '', erro: 'áudio sem media id' };

    const { bytes, mime } = await baixarMidia(mediaId);
    const ext = mime.includes('mpeg') ? 'mp3' : mime.includes('mp4') ? 'm4a' : mime.includes('amr') ? 'amr' : 'ogg';
    const file = new File([bytes], `whatsapp-${mediaId}.${ext}`, { type: mime });

    const up = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
    const assinado = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: up?.file_uri, expires_in: 300 });
    const url = assinado?.signed_url || assinado?.url;
    if (!url) throw new Error('sem URL assinada do upload');

    const r: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: MODELO_TRANSCRICAO,
      prompt:
        'O arquivo anexado é uma mensagem de voz de WhatsApp, em português do Brasil. ' +
        'Transcreva literalmente o que a pessoa fala, sem resumir, sem comentar e sem completar nada. ' +
        'Se você não conseguir ouvir o áudio, ou não houver fala compreensível, responda ouviu_fala=false e transcricao vazia. ' +
        'Nunca invente conteúdo.',
      file_urls: [url],
      response_json_schema: SCHEMA
    });
    const obj = typeof r === 'string' ? JSON.parse(r) : r;
    const texto = String(obj?.transcricao || '').trim().slice(0, 2000);
    if (!obj?.ouviu_fala || !texto) return { ok: false, texto: '', erro: 'transcrição vazia' };
    return { ok: true, texto, erro: '' };
  } catch (e) {
    return { ok: false, texto: '', erro: String((e as any)?.message || e).slice(0, 300) };
  }
}
