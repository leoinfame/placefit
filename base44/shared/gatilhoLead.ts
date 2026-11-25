// ─── Gatilho útil do vendedor automático do 7206 (Etapa 1, 24/11/2026) ───────
// O vendedor só age quando o cliente mandou CONTEÚDO NOVO. Evento vazio, sticker, reação,
// mídia que o robô não lê, cumprimento e "no aguardo" não reabrem pergunta antiga.
// Funções puras. Não participa da boas-vindas, que segue igual.

import { normalizar, palavrasDe } from './catalogoRespondedor.ts';

export const JANELA_RAJADA_MS = 20000;
const ECO_PDF_MS = 180000;
const DIAS_REPETIDO = 7;

/** created_date do banco vem em UTC, com ou sem "Z". */
export const quandoMs = (m: any) => {
  const s = String(m?.created_date || '');
  return Date.parse(s + (/Z$/.test(s) ? '' : 'Z'));
};

const MARCADOR = /^\[(m[ií]dia|mensagem n[aã]o textual|audio|áudio)\]?\s*$/i;
const SO_ARQUIVO = /^[^\n]*\.(pdf|xlsx?|docx?|csv|jpe?g|png|webp|heic|mp4|mp3|ogg|opus|zip)$/i;
const SO_LINK = /^(https?:\/\/\S+\s*)+$/i;

/** Tem texto que o robô consegue ler? Nome de arquivo, link solto e emoji não contam. */
export function conteudoUtil(texto: unknown): boolean {
  const t = String(texto ?? '').trim();
  if (!t || MARCADOR.test(t) || /^\[(m[ií]dia|mensagem n[aã]o textual)/i.test(t)) return false;
  if (SO_ARQUIVO.test(t) || SO_LINK.test(t)) return false;
  return Boolean(normalizar(t).replace(/[^a-z0-9]/g, ''));
}

const CORTESIA = new Set(('oi ola opa oie e ai eai bom boa dia tarde noite tudo bem td joia blz beleza ok okay certo ta ' +
  'obrigado obrigada obg valeu vlw perfeito show aguardo aguardando no estou to fico leo com voce vc').split(' '));
/** Só cumprimento, agradecimento ou "no aguardo". */
export function soCortesia(texto: string): boolean {
  const toks = normalizar(texto).replace(/\./g, ' ').split(' ').filter(Boolean);
  return toks.length > 0 && toks.every((t) => CORTESIA.has(t));
}

const semelhante = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);
/** Pelo menos metade das palavras de `frase` aparece em `fonte`. */
export function veioDe(frase: string, fonte: string): boolean {
  const ps = palavrasDe(frase);
  const toks = normalizar(fonte).split(' ').filter((t) => t.length >= 3);
  if (!ps.length) return normalizar(fonte).includes(normalizar(frase));
  return ps.filter((p) => toks.some((t) => semelhante(t, p))).length * 2 >= ps.length;
}

const COMERCIAL = /\b(precos?\b|valor|quant|orcament|cota[cr]|frete|prazo|entreg|pagament|parcel|cartao|boleto|pix|descont|tabela|catalog|atacad|revend|vend|compr|fabric|estoque|garant|pedido|produt|anilha|halter|dumb|kettle|querobel|kerobel|barra|puxador|tijol|piso|tatame|kit|suporte|academia|caneleira|colchonete|step|jump)/;
/** Pergunta de compra (a única que recebe "estou conferindo"). */
export const ehComercial = (pergunta: string) => COMERCIAL.test(normalizar(pergunta));

/** [Mídia] enviada pelo dono no celular. O eco do PDF do sistema (sem legenda) não conta. */
export function midiaHumana(m: any, msgs: any[]): boolean {
  if (m?.direcao !== 'enviada' || m?.origem !== 'waha' || !/^\[m[ií]dia\]/i.test(String(m.conteudo || ''))) return false;
  const t = quandoMs(m);
  const pdfs = msgs.filter((s) => s.origem === 'sistema' && s.direcao === 'enviada' &&
    t - quandoMs(s) >= 0 && t - quandoMs(s) <= ECO_PDF_MS);
  // Cada envio do sistema explica um eco: se o eco com texto já apareceu, esta mídia é de uma pessoa
  return pdfs.every((s) => msgs.some((e) => e !== m && e.origem === 'waha' && e.direcao === 'enviada' && conteudoUtil(e.conteudo) &&
    String(s.conteudo).includes(String(e.conteudo).slice(0, 40))));
}

/**
 * Mensagens do cliente ainda não tratadas, em ordem. `bvId` = boas-vindas (não conta como resposta).
 * Gatilho com texto: tudo depois da nossa última resposta + a rajada dele (cobre mensagem que chegou
 * enquanto a resposta era montada). Gatilho vazio: só se fecha uma rajada de texto ainda sem resposta.
 */
export function mensagensNovas(msgs: any[], bv: any, gatilho: any): any[] {
  const t = quandoMs(gatilho);
  const resposta = Math.max(0, ...msgs.filter((m) => m.origem === 'sistema' && m.direcao === 'enviada' && m.status !== 'erro' &&
    m.id !== bv?.id && quandoMs(m) > quandoMs(bv)).map(quandoMs));
  const uteis = msgs.filter((m) => m.direcao === 'recebida' && conteudoUtil(m.conteudo) && quandoMs(m) <= t);
  const inicio = quandoMs(bv) - 10 * 60000;
  const depois = uteis.filter((m) => quandoMs(m) >= inicio && quandoMs(m) > resposta);
  const naRajada = (m: any) => t - quandoMs(m) <= JANELA_RAJADA_MS;
  const r = conteudoUtil(gatilho?.conteudo)
    ? uteis.filter((m) => depois.includes(m) || m.id === gatilho.id || (quandoMs(m) >= inicio && naRajada(m)))
    : (depois.some(naRajada) ? depois : []);
  return [...r].sort((a, b) => quandoMs(a) - quandoMs(b));
}

/** Com itens já lidos antes: a mensagem nova traz algo (número, item, documento, resposta ao que pedimos)? */
export function temNovidade(pedido: any, textoNovo: string, pedimosDados: boolean): boolean {
  if (pedimosDados || /\d/.test(textoNovo)) return true;
  if ((pedido?.itens || []).some((i: any) => veioDe(i?.descricao || '', textoNovo))) return true;
  const p = String(pedido?.pergunta || '').trim();
  return Boolean(p && veioDe(p, textoNovo));
}

/** A mesma dúvida gera a mesma chave, qualquer que seja a mensagem que a trouxe. */
export const chaveDuvida = (conversaId: string, motivos: string[], resumo: string) =>
  `duvida:${conversaId}:${normalizar([...motivos, resumo].join(' ')).slice(0, 180)}`;

/** Já avisado: alerta igual ainda aberto, ou dos últimos 7 dias. */
export const jaAvisado = (alertas: any[], chave: string, agora = Date.now()) =>
  (alertas || []).some((a) => a.chave === chave && (a.status === 'aberto' || agora - quandoMs(a) < DIAS_REPETIDO * 86400000));

/** Motivos em que o vendedor decidiu ficar quieto: o atendente genérico também não responde. */
export const SILENCIO = new Set(['sem_conteudo', 'cortesia', 'sem_novidade', 'repetido', 'alerta_discreto', 'humano']);
