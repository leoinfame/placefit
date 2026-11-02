// ─── Identidade do contato na entrada do 7206 (WAHA, engine NOWEB) ──────────
// Item 022 (02/11/2026). Funções puras (testáveis) + uma consulta somente leitura ao WAHA.
//
// Regras:
//  - o identificador opaco do WhatsApp (LID, "...@lid") NUNCA vira telefone;
//  - telefone só vem de um JID de telefone (@c.us / @s.whatsapp.net) que o próprio WhatsApp
//    entregou (remoteJidAlt / senderPn do evento) ou da tabela LID→telefone do WAHA;
//  - nome do contato só do perfil de quem MANDOU a mensagem (nunca nas enviadas pelo dono,
//    que trazem o nome do próprio dono), nunca o número;
//  - grupos, status, listas de transmissão, canais, o próprio número (self-chat) e a lista
//    de ignorados não entram no CRM.

export type TipoJid = 'telefone' | 'lid' | 'grupo' | 'broadcast' | 'canal' | 'outro' | 'vazio';

const digitos = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** Números/LIDs que nunca viram conversa no CRM (doc da fila, B8: assistente do dono). */
export const IGNORADOS_FIXOS = ['23949492670633'];

export function tipoJid(jid: unknown): TipoJid {
  const s = String(jid ?? '').trim().toLowerCase();
  if (!s) return 'vazio';
  if (s.endsWith('@g.us')) return 'grupo';
  if (s.includes('broadcast')) return 'broadcast';
  if (s.endsWith('@newsletter')) return 'canal';
  if (s.endsWith('@lid')) return 'lid';
  if (s.endsWith('@c.us') || s.endsWith('@s.whatsapp.net')) return 'telefone';
  return 'outro';
}

/** Dígitos do usuário do JID, sem o sufixo de dispositivo (":85"). */
export function usuarioJid(jid: unknown): string {
  const user = String(jid ?? '').split('@')[0].split(':')[0];
  return digitos(user);
}

/** Telefone brasileiro plausível: 55 + DDD + 8/9 dígitos. Qualquer outra coisa não é exibida como telefone. */
export function pareceTelefoneBR(valor: unknown): boolean {
  const d = digitos(valor);
  return d.startsWith('55') && (d.length === 12 || d.length === 13);
}

/** Telefone de um JID só quando o JID é de telefone. LID nunca vira telefone. */
export function telefoneDoJid(jid: unknown): string {
  return tipoJid(jid) === 'telefone' ? usuarioJid(jid) : '';
}

/**
 * Lado do contato na mensagem (o outro, não o dono).
 * Recebida: "from". Enviada pelo celular (fromMe): "to"; quando falta ou aponta para o próprio
 * número, usa a chave crua do evento (_data.key.remoteJid), que no NOWEB é sempre o chat.
 */
export function chatDoContato(payload: any, meusIds: string[]): string {
  const fromMe = Boolean(payload?.fromMe);
  const key = payload?._data?.key || {};
  const candidatos = fromMe
    ? [payload?.to, key.remoteJid, payload?.chatId]
    : [payload?.from, key.remoteJid, payload?.chatId];
  for (const c of candidatos) {
    const s = String(c ?? '').trim();
    if (!s) continue;
    if (meusIds.includes(usuarioJid(s))) continue;
    return s;
  }
  // Conversa consigo mesmo (self-chat): todos os candidatos são o próprio número
  const algum = candidatos.map((c) => String(c ?? '').trim()).find(Boolean) || '';
  return algum;
}

/** Telefone real que o próprio evento já traz para um contato LID (sem consultar nada). */
export function telefoneAlternativo(payload: any, meusIds: string[]): string {
  const key = payload?._data?.key || {};
  const fromMe = Boolean(payload?.fromMe);
  const alts = [key.remoteJidAlt, key.participantAlt, fromMe ? '' : key.senderPn, payload?._data?.remoteJidAlt];
  for (const a of alts) {
    const tel = telefoneDoJid(a);
    if (tel && !meusIds.includes(tel) && pareceTelefoneBR(tel)) return tel;
  }
  return '';
}

/** Nome do perfil de quem mandou. Nas enviadas pelo dono o nome é dele, então não serve. */
export function nomeDoPerfil(payload: any): string {
  if (payload?.fromMe) return '';
  const bruto = String(
    payload?._data?.pushName || payload?._data?.notifyName || payload?.notifyName || payload?.pushName || ''
  ).trim();
  if (!bruto || /^\+?[\d\s().-]+$/.test(bruto)) return '';
  return bruto.slice(0, 80);
}

/** Ids do próprio dono (telefone e LID) a partir do corpo do webhook ("me"). */
export function meusIdsDoCorpo(body: any): string[] {
  const me = body?.me || {};
  return [usuarioJid(me.id), usuarioJid(me.lid), usuarioJid(me.jid)].filter(Boolean);
}

export function ignorado(chave: string, extras: string[] = []): boolean {
  const d = digitos(chave);
  if (!d) return false;
  return [...IGNORADOS_FIXOS, ...extras.map(digitos)].filter(Boolean).includes(d);
}

/**
 * Consulta SOMENTE LEITURA à tabela LID→telefone do WAHA (GET /api/{sessao}/lids/{lid}).
 * Qualquer falha, timeout ou resposta sem telefone válido = '' (contato segue não identificado).
 */
export async function resolverLidNoWaha(
  baseUrl: string, apiKey: string, sessao: string, lidJid: string,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  if (!baseUrl || !sessao || tipoJid(lidJid) !== 'lid') return '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers['X-Api-Key'] = apiKey;
    const lid = usuarioJid(lidJid) + '@lid';
    const res = await fetchFn(
      `${baseUrl}/api/${encodeURIComponent(sessao)}/lids/${encodeURIComponent(lid)}`,
      { method: 'GET', headers, signal: ctrl.signal }
    );
    if (!res.ok) return '';
    const data: any = await res.json().catch(() => null);
    const tel = telefoneDoJid(data?.pn || data?.phone || '');
    return pareceTelefoneBR(tel) ? tel : '';
  } catch (_) {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export interface Identidade {
  ignorar: string;            // motivo; vazio = segue
  chatId: string;             // JID do chat (para responder/ack)
  telefone: string;           // telefone real verificado ou ''
  lid: string;                // dígitos do LID ou ''
  nome: string;               // nome do perfil ou ''
}

/** Identidade do contato a partir do evento (sem rede). A consulta ao WAHA é feita por quem chama. */
export function identificar(payload: any, meusIds: string[], ignoradosExtras: string[] = []): Identidade {
  const chatId = chatDoContato(payload, meusIds);
  const tipo = tipoJid(chatId);
  const base: Identidade = { ignorar: '', chatId, telefone: '', lid: '', nome: nomeDoPerfil(payload) };
  if (tipo === 'vazio') return { ...base, ignorar: 'sem_contato' };
  if (tipo === 'grupo') return { ...base, ignorar: 'grupo' };
  if (tipo === 'broadcast') return { ...base, ignorar: 'broadcast' };
  if (tipo === 'canal') return { ...base, ignorar: 'canal' };
  if (tipo === 'outro') return { ...base, ignorar: 'jid_desconhecido' };
  const usuario = usuarioJid(chatId);
  if (meusIds.includes(usuario)) return { ...base, ignorar: 'self_chat' };
  if (tipo === 'telefone') {
    if (ignorado(usuario, ignoradosExtras)) return { ...base, ignorar: 'lista_ignorados' };
    return { ...base, telefone: usuario };
  }
  // LID
  const tel = telefoneAlternativo(payload, meusIds);
  if (ignorado(usuario, ignoradosExtras) || (tel && ignorado(tel, ignoradosExtras))) {
    return { ...base, ignorar: 'lista_ignorados' };
  }
  return { ...base, lid: usuario, telefone: tel };
}
