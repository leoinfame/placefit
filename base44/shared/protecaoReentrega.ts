// ─── Proteção contra reentrega de eventos (webhook do 7206 via WAHA) ─────────
// Item 030 (17/11/2026). Contexto: em 16/11 a sessão WAHA do 7206 caiu
// (401 device_removed) e vai ser reconectada. Em 03/11 uma reconexão reentregou
// ~100 eventos antigos; parte se perdeu em silêncio porque o webhook respondia
// 200 mesmo em erro (o WAHA não tenta de novo e o limite é 140 req/min).
//
// Regras puras usadas por crm-whatsapp-webhook/entry.ts:
//  1. mensagem antiga em relação ao recebimento = histórico (backlog/importada);
//  2. mesmo id do payload nunca é processado duas vezes;
//  3. boas-vindas só para lead realmente novo, nunca repetida;
//  4. falha transitória responde erro (nunca 200 silencioso).
//
// Testes offline (sem rede, sem WAHA, nada é enviado): protecaoReentrega.test.ts

/** Tolerância entre a data da mensagem e o recebimento antes de tratar como histórico. */
export const MINUTOS_REENTREGA = 5;
/** Janela em que uma conversa conta como aberta agora (lead novo de verdade). */
export const MINUTOS_CONVERSA_NOVA = 10;

/**
 * Data original da mensagem em milissegundos.
 * O WAHA manda `timestamp` em segundos; alguns eventos trazem em `_data.t`.
 * Devolve null quando o payload não informa — aí não há como classificar.
 */
export function timestampDaMensagem(payload: any): number | null {
  const fontes = [payload?.timestamp, payload?._data?.t, payload?._data?.messageTimestamp, payload?.t];
  for (const fonte of fontes) {
    const n = Number(fonte);
    if (!Number.isFinite(n) || n <= 0) continue;
    return n > 1e12 ? n : n * 1000;
  }
  return null;
}

/** Mensagem mais velha que a tolerância: reentrega de backlog após (re)conexão, ou importada. */
export function ehHistorico(enviadaEm: number | null, recebidoEm: number, minutos = MINUTOS_REENTREGA): boolean {
  if (enviadaEm === null || enviadaEm === undefined) return false;
  if (!Number.isFinite(enviadaEm) || !Number.isFinite(recebidoEm)) return false;
  return recebidoEm - enviadaEm > minutos * 60000;
}

/** Id estável do evento (aceita string e o formato { _serialized }). */
export function idDoPayload(payload: any): string {
  const bruto = payload?.id ?? payload?._data?.id;
  if (!bruto) return "";
  if (typeof bruto === "object") return String(bruto._serialized || bruto.id || "").trim();
  return String(bruto).trim();
}

/** O mesmo evento já foi gravado? (reentrega do WAHA não grava nem envia de novo) */
export function eventoJaGravado(existentes: any[], messageId: string): boolean {
  if (!messageId) return false;
  return (existentes || []).some((m: any) => String(m?.meta_message_id || "") === String(messageId));
}

/** Conversa aberta neste evento? Sem isso o contato já tinha conversa no CRM. */
export function conversaRecemCriada(conversa: any, recebidoEm: number, minutos = MINUTOS_CONVERSA_NOVA): boolean {
  if (!conversa?._nova) return false;
  const criada = new Date(conversa?.created_date || 0).getTime();
  if (!criada) return true; // criada agora, sem data legível
  return recebidoEm - criada <= minutos * 60000;
}

/**
 * Já houve qualquer boas-vindas de sistema para este contato?
 * Mensagem de sistema com status "erro" não conta: é justamente a tentativa
 * que falhou e precisa poder ser refeita.
 */
export async function jaTeveBoasVindas(db: any, ownerId: string, conversaId: string, telefone: string): Promise<boolean> {
  const daConversa = (await db.CRMMensagem.filter(
    { owner_id: ownerId, conversa_id: conversaId, origem: "sistema" }, "-created_date", 10
  )) || [];
  if (daConversa.some((m: any) => m?.status !== "erro")) return true;
  if (!telefone) return false;
  const doContato = (await db.CRMMensagem.filter(
    { owner_id: ownerId, telefone, origem: "sistema" }, "-created_date", 10
  )) || [];
  return doContato.some((m: any) => m?.status !== "erro");
}

/** A conversa já tinha mensagem antes desta? Então o contato não é lead novo. */
export async function contatoJaConhecido(db: any, ownerId: string, conversaId: string, messageId: string): Promise<boolean> {
  const anteriores = (await db.CRMMensagem.filter({ owner_id: ownerId, conversa_id: conversaId }, "-created_date", 10)) || [];
  return anteriores.some((m: any) => String(m?.meta_message_id || "") !== String(messageId || ""));
}

export type DecisaoBoasVindas = { ok: boolean; motivo: string };

/**
 * Boas-vindas exatamente uma vez e só para lead realmente novo.
 * Mantém as travas antigas (fromMe, conversa nova, cliente existente, CRM_BOAS_VINDAS)
 * e acrescenta: histórico/backlog nunca recebe, contato que já tem conversa não recebe
 * e quem já recebeu boas-vindas de sistema não recebe de novo. Teto por hora fica no webhook.
 */
export async function decideBoasVindas(ctx: {
  db: any;
  ownerId: string;
  conversa: any;
  fromMe: boolean;
  chave: string;
  telefone: string;
  messageId: string;
  recebidoEm: number;
  historico: boolean;
  minutosConversaNova?: number;
}): Promise<DecisaoBoasVindas> {
  const { db, ownerId, conversa, fromMe, chave, telefone, messageId, recebidoEm, historico } = ctx;
  if (historico) return { ok: false, motivo: "historico" };
  if (fromMe) return { ok: false, motivo: "from_me" };
  if (String(chave || "").trim().toLowerCase() === "off") return { ok: false, motivo: "desligado" };
  if (!conversa?.id) return { ok: false, motivo: "sem_conversa" };
  if (conversa?.cliente_id) return { ok: false, motivo: "cliente_existente" };
  if (!conversaRecemCriada(conversa, recebidoEm, ctx.minutosConversaNova)) {
    return { ok: false, motivo: "conversa_existente" };
  }
  if (await jaTeveBoasVindas(db, ownerId, conversa.id, telefone)) return { ok: false, motivo: "ja_enviada" };
  if (await contatoJaConhecido(db, ownerId, conversa.id, messageId)) return { ok: false, motivo: "contato_conhecido" };
  return { ok: true, motivo: "" };
}

/**
 * Resposta para falha transitória (banco, WAHA fora, limite de requisições):
 * erro, para o WAHA reentregar. Nunca 200 — 200 faz o WAHA desistir em silêncio.
 */
export function respostaDeErro(detalhe: string): { status: number; body: string } {
  return {
    status: 500,
    body: JSON.stringify({ erro: "falha_transitoria", detalhe: String(detalhe || "").slice(0, 300) })
  };
}