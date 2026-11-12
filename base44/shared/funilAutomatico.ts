// ─── Funil automático do CRM WhatsApp ────────────────────────────────────────
// Fonte única da ordem do funil e das passagens que o sistema faz sozinho.
// Regra geral: a etapa só anda para frente e nunca volta; a troca manual no
// painel sempre vale e "perdido" só sai da mão de quem atende.
//
// Ordem: novo < atendimento < orcamento < aguardando_resposta < negociacao < ganho
// - nós respondemos numa conversa em "novo"            → atendimento
// - orçamento criado                                    → orcamento → aguardando_resposta
//   (o envio ao cliente não é rastreado, então a conversa já espera a resposta)
// - cliente responde depois do orçamento                → negociacao
// - pedido virou venda                                  → ganho (funilCrm.js, item 028)
// Nada aqui envia mensagem: só lê e grava a etapa da conversa.

export const ORDEM_FUNIL = ['novo', 'atendimento', 'orcamento', 'aguardando_resposta', 'negociacao', 'ganho'];

export const ETAPA_AGUARDANDO_RESPOSTA = 'aguardando_resposta';

const posicao = (etapa: string) => ORDEM_FUNIL.indexOf(String(etapa || 'novo'));
const acabada = (etapa: string) => etapa === 'perdido';

/** Etapa nova se o funil avança, ou '' quando a conversa fica como está. */
export function avancarPara(etapaAtual: string, alvo: string) {
  const atual = String(etapaAtual || 'novo');
  if (!alvo || atual === alvo) return '';
  if (acabada(atual)) return '';
  const de = posicao(atual);
  const para = posicao(alvo);
  if (de < 0 || para < 0 || para <= de) return '';
  return alvo;
}

/** Grava a etapa nova. Devolve true quando mudou. Nunca lança. */
async function gravar(entities: any, conversa: any, alvo: string) {
  const nova = avancarPara(conversa?.etapa, alvo);
  if (!nova || !conversa?.id) return false;
  try {
    await entities.CRMConversa.update(conversa.id, { etapa: nova });
    conversa.etapa = nova;
    return true;
  } catch (e) {
    console.error('[FUNIL] não consegui gravar a etapa', nova, e);
    return false;
  }
}

/** Nós respondemos (dono no painel, bot respondedor ou eco do WhatsApp Business). */
export async function respostaNossa(entities: any, conversa: any) {
  return gravar(entities, conversa, 'atendimento');
}

/** Mesma regra, quando quem chamou só tem o id da conversa em mãos. */
export async function respostaNossaPorId(entities: any, conversaId: string) {
  try {
    if (!conversaId) return false;
    const conversa = await entities.CRMConversa.get(conversaId);
    return await respostaNossa(entities, conversa);
  } catch (e) {
    console.error('[FUNIL] não consegui ler a conversa para marcar atendimento', conversaId, e);
    return false;
  }
}

/** O cliente respondeu depois do orçamento: em espera → negociação. */
export async function respostaDoCliente(entities: any, conversa: any) {
  const atual = String(conversa?.etapa || 'novo');
  if (atual !== 'orcamento' && atual !== ETAPA_AGUARDANDO_RESPOSTA) return false;
  return gravar(entities, conversa, 'negociacao');
}

/** Orçamento criado para o cliente: entra em orçamento e fica aguardando resposta. */
export async function orcamentoCriado(entities: any, conversa: any) {
  const mudou = await gravar(entities, conversa, 'orcamento');
  const esperando = await gravar(entities, conversa, ETAPA_AGUARDANDO_RESPOSTA);
  return mudou || esperando;
}

/**
 * Orçamento criado envia o PDF na mesma hora: a conversa entra em orçamento e já
 * fica em "aguardando resposta" só pelo id (usado por quem acabou de gravar o orçamento).
 */
export async function orcamentoCriadoPorId(entities: any, conversaId: string) {
  try {
    if (!conversaId) return false;
    const conversa = await entities.CRMConversa.get(conversaId);
    return await orcamentoCriado(entities, conversa);
  } catch (e) {
    console.error('[FUNIL] não consegui marcar o orçamento na conversa', conversaId, e);
    return false;
  }
}