// ─── Respondedor automático "Léo da Muscular" (Cloud API) ───────────────────
// Responde mensagens de texto recebidas no número dedicado do CRM pela Cloud
// API oficial. Roda inline na whatsappWebhook, depois que o evento e a
// mensagem já foram gravados.
//
// Travas, todas obrigatórias:
//  1. chave geral: segredo RESPONDEDOR_ATIVO === "true" (sem ele, nada sai);
//  2. allowlist: se RESPONDEDOR_ALLOWLIST tiver números, só eles recebem resposta;
//  3. só texto, só evento novo e só mensagem com menos de 5 min;
//  4. humano assumiu: silêncio por 60 min após envio não automático na conversa;
//  5. teto de respostas automáticas por conversa por hora;
//  6. reply_status = "respondendo" é gravado ANTES da IA: reentrega nunca duplica.

import { onlyDigits } from './whatsappCoexistence.ts';

const GRAPH_VERSION = 'v21.0';
const IDADE_MAXIMA_MIN = 5;
const HUMAN_TAKEOVER_MINUTES = 60;
const TETO_POR_HORA = 15;
const HISTORICO = 10;

const env = (nome: string) => String(Deno.env.get(nome) || '').trim();

export const SAUDACAO_PLACEFIT = 'Fala aí! Você quer empreender no mercado fitness ou tá atrás de equipamento?';

export const PROMPT_LEO = `Você é o Léo, da equipe PlaceFit, atendendo pelo WhatsApp oficial do PlaceFit.
Você fala em nome do PlaceFit ("a gente", "aqui no PlaceFit"), não em nome de uma loja.

SAUDAÇÃO
- Se a última mensagem do cliente for só um cumprimento (oi, olá, bom dia, e aí...),
  responda exatamente: "${SAUDACAO_PLACEFIT}"
- Se ele já chegou com uma pergunta ou pedido, pule a saudação e responda direto.

COMO FALAR
- Papo reto, incisivo, frases curtas. Português do Brasil informal, sem formalidade de robô.
- Zero novelinha: nada de "Olá! Tudo bem? Que bom ter você aqui 😊". Vai direto ao ponto.
- No máximo 3 frases por mensagem. Uma pergunta por vez.
- Emoji só se fizer sentido, e no máximo um.

SOBRE O QUE VOCÊ FALA
- PlaceFit é um hub de revendas de equipamentos fitness: liga quem quer revender ou
  empreender no mercado fitness ao polo fabricante de Cláudio/MG (fábricas, fundições,
  distribuição, transporte), com o curso "Empreenda no Mercado Fitness" e o app PlaceFit.
- Perguntas sobre a empresa, a plataforma ou "quem são vocês": a resposta é o PlaceFit.
- Equipamentos (anilhas, halteres, barras, puxadores, acessórios, aparelhos): o PlaceFit
  atende pelo hub, com as fábricas e revendas parceiras.
- MuscularFit só aparece como exemplo de revenda que opera dentro do hub. Nunca se
  apresente como MuscularFit nem fale como se fosse a loja.
- Duas frentes, descubra cedo qual é: (1) quer empreender/revender; (2) quer comprar
  equipamento.
- Assunto fora disso: responde em uma linha que aqui é sobre o PlaceFit e puxa de volta.

REGRAS DURAS
- Nunca invente preço, prazo, frete, estoque ou condição de pagamento. Se perguntarem,
  pegue o que precisa (produto, quantidade, CEP/cidade) e diga que o time confirma.
- Nunca prometa nada em nome da empresa.
- Se o cliente pedir humano, reclamar ou o assunto for pedido/entrega já feita:
  diga que vai passar pro time agora e pare de vender.
- Se perguntarem se você é robô/IA, não negue: é o atendimento automático do PlaceFit,
  e alguém do time assume quando precisar.
- Objetivo de toda conversa: entender o que a pessoa quer e deixar o próximo passo
  claro (dados para orçamento, interesse no curso, ou passar pro time).

Responda só com o texto da mensagem, sem aspas nem explicações.`;

async function marcar(base44: any, eventId: string, patch: any) {
  await base44.asServiceRole.entities.whatsapp_webhook_events.update(eventId, patch);
}

async function ignorar(base44: any, eventId: string, motivo: string) {
  await marcar(base44, eventId, { reply_status: 'ignorado', reply_reason: motivo });
  console.log('[RESPONDEDOR] ignorado:', motivo);
}

async function enviarTexto(phoneNumberId: string, para: string, texto: string) {
  const token = env('META_ACCESS_TOKEN');
  if (!token) return { ok: false, id: '', error: 'META_ACCESS_TOKEN ausente' };
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: para,
      type: 'text',
      text: { preview_url: false, body: texto }
    })
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, id: '', error: `HTTP ${res.status}: ${data?.error?.message || 'falha no envio'}` };
  }
  return { ok: true, id: String(data?.messages?.[0]?.id || ''), error: '' };
}

/**
 * Avalia e, se todas as travas passarem, responde a mensagem `msg` do evento `ev`.
 * Nunca lança: qualquer falha vira reply_status "erro" no evento.
 */
export async function responderSeCabivel(base44: any, connection: any, ev: any, msg: any, conversa: any) {
  const eventId = ev?.record?.id;
  if (!eventId || ev.dedup || !conversa) return;
  if (ev.record.reply_status) return;

  try {
    // 1. chave geral
    if (env('RESPONDEDOR_ATIVO') !== 'true') return await ignorar(base44, eventId, 'desligado');

    // 2. allowlist
    const cliente = onlyDigits(msg?.from || '');
    const allow = env('RESPONDEDOR_ALLOWLIST').split(',').map(onlyDigits).filter(Boolean);
    if (allow.length && !allow.includes(cliente)) return await ignorar(base44, eventId, 'fora_allowlist');

    // 3. só texto, e nada de fila antiga
    if (msg?.type !== 'text' || !String(msg?.text?.body || '').trim()) {
      return await ignorar(base44, eventId, 'nao_texto');
    }
    const idadeMin = (Date.now() - Number(msg.timestamp || 0) * 1000) / 60000;
    if (!(idadeMin <= IDADE_MAXIMA_MIN)) return await ignorar(base44, eventId, 'antiga');

    // Corrida rara: duas entregas simultâneas criando o mesmo evento.
    // Só o registro mais antigo com esta event_key segue.
    const gemeos = await base44.asServiceRole.entities.whatsapp_webhook_events.filter(
      { tenant_id: connection.tenant_id, connection_id: connection.id, event_key: ev.record.event_key },
      'created_date', 5
    );
    if (gemeos?.length > 1 && gemeos[0].id !== eventId) return await ignorar(base44, eventId, 'duplicado');

    // 4 e 5. humano assumiu / teto por hora
    const enviadas = await base44.asServiceRole.entities.CRMMensagem.filter(
      { conversa_id: conversa.id, direcao: 'enviada' }, '-created_date', 30
    );
    const agora = Date.now();
    const minutosDesde = (m: any) => (agora - new Date(m.created_date).getTime()) / 60000;
    const humano = (enviadas || []).find((m: any) => m.origem !== 'respondedor_ia');
    if (humano && minutosDesde(humano) < HUMAN_TAKEOVER_MINUTES) {
      return await ignorar(base44, eventId, 'humano_assumiu');
    }
    const naUltimaHora = (enviadas || []).filter(
      (m: any) => m.origem === 'respondedor_ia' && minutosDesde(m) < 60
    ).length;
    if (naUltimaHora >= TETO_POR_HORA) return await ignorar(base44, eventId, 'teto_hora');

    // 6. trava o evento antes de gastar IA
    await marcar(base44, eventId, { reply_status: 'respondendo' });

    const historico = await base44.asServiceRole.entities.CRMMensagem.filter(
      { conversa_id: conversa.id }, '-created_date', HISTORICO
    );
    const conversaTexto = (historico || []).reverse()
      .map((m: any) => (m.direcao === 'recebida' ? 'Cliente: ' : 'Léo: ') + String(m.conteudo || ''))
      .join('\n');

    const prompt = PROMPT_LEO +
      `\n\nNome do cliente no WhatsApp: ${conversa.nome_contato || 'não informado'}` +
      `\n\nCONVERSA ATÉ AGORA (mais antiga primeiro):\n${conversaTexto}` +
      `\n\nEscreva a próxima mensagem do Léo, respondendo à última mensagem do cliente.`;

    const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
    const resposta = String(ai || '').trim().replace(/^["“]|["”]$/g, '').slice(0, 1500);
    if (!resposta) {
      await marcar(base44, eventId, { reply_status: 'erro', reply_error: 'IA devolveu vazio' });
      return;
    }

    const envio = await enviarTexto(connection.phone_number_id, cliente, resposta);
    const quando = new Date().toISOString();
    await base44.asServiceRole.entities.CRMMensagem.create({
      owner_id: connection.tenant_id,
      conversa_id: conversa.id,
      telefone: cliente,
      direcao: 'enviada',
      tipo: 'texto',
      conteudo: resposta,
      status: envio.ok ? 'enviada' : 'erro',
      meta_message_id: envio.id,
      erro: envio.error,
      origem: 'respondedor_ia',
      enviada_em: quando
    });

    if (!envio.ok) {
      await marcar(base44, eventId, { reply_status: 'erro', reply_error: envio.error });
      console.error('[RESPONDEDOR] falha no envio', envio.error);
      return;
    }
    await base44.asServiceRole.entities.CRMConversa.update(conversa.id, {
      ultima_mensagem: resposta.slice(0, 200),
      ultima_interacao: quando
    });
    await marcar(base44, eventId, { reply_status: 'respondido', reply_wamid: envio.id, replied_at: quando, reply_error: '' });
    console.log('[RESPONDEDOR] respondido', envio.id);
  } catch (error) {
    console.error('[RESPONDEDOR] erro', error);
    try {
      await marcar(base44, eventId, { reply_status: 'erro', reply_error: String((error as any)?.message || error).slice(0, 500) });
    } catch (_) { /* nada a fazer */ }
  }
}
