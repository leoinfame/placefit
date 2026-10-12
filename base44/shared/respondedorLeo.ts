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
import { carregarCatalogo, buscarNoCatalogo, catalogoParaPrompt } from './catalogoRespondedor.ts';
import { transcreverAudio } from './audioRespondedor.ts';
import { montarResumoGerente, PROMPT_GERENTE } from './gerenteRespondedor.ts';
import { tratarOrcamentoGerente, statusRascunho } from './orcamentoGerente.ts';

// A consulta do gerente não grava nada; se a IA afirmar que gravou/criou, a frase é trocada.
const AFIRMA_GRAVACAO = /(j[aá] (est[aá]|foi|ficou|t[aá]) (no painel|gravad|criad|salv|lan[cç]ad|registrad))|(or[cç]amento (j[aá] )?(foi |est[aá] )?(gravado|criado|salvo|lan[cç]ado|registrado))|(gravei|criei|lancei|salvei)/i;
const NADA_GRAVADO = 'Nada foi gravado. Pra criar um orçamento: "faz um orçamento pro cliente <CNPJ ou nome> de <quantidade> <produto>"; eu mostro o resumo e só gravo quando você responder "grava".';

export const PEDIR_TEXTO = 'Não consegui ouvir teu áudio aqui. Manda por texto pra mim?';

const GRAPH_VERSION = 'v21.0';
const IDADE_MAXIMA_MIN = 5;
const HUMAN_TAKEOVER_MINUTES = 60;
const TETO_POR_HORA = 15;
const TETO_DONO_POR_HORA = 60;
const HISTORICO = 10;

const env = (nome: string) => String(Deno.env.get(nome) || '').trim();

export const SAUDACAO_PLACEFIT = 'Fala aí! Você quer empreender no mercado fitness ou tá atrás de equipamento?';

export const PROMPT_LEO = `Você é o Léo, da equipe PlaceFit, atendendo pelo WhatsApp oficial do PlaceFit.
Você fala em nome do PlaceFit ("a gente", "aqui no PlaceFit"), não em nome de uma loja.

SAUDAÇÃO
- Veja a linha CONVERSA EM ANDAMENTO no fim.
- Se for "não", o NOME DO CONTATO já estiver confirmado e a última mensagem do cliente for só
  um cumprimento (oi, olá, bom dia, tudo bem...), responda exatamente: "${SAUDACAO_PLACEFIT}"
  Sem nome confirmado, vale a regra de NOME DO CONTATO abaixo.
- Se for "sim", NUNCA repita a saudação: responda o cumprimento em poucas palavras e
  retome o último assunto da conversa.
- Se ele já chegou com uma pergunta ou pedido, pule a saudação e responda direto.
- Nunca chame ninguém de "chefe" (nem patrão, mestre, querido...). Sem vocativo de tratamento.

NOME DO CONTATO
- Veja a linha NOME DO CONTATO no fim. O nome do perfil do WhatsApp NÃO conta como nome:
  nunca chame a pessoa por ele e nunca deduza nome pelo número.
- Se o nome ainda não foi informado, a primeira pergunta da conversa é o nome:
  - só cumprimento + conversa nova: responda exatamente "Fala aí! Aqui é o Léo, do PlaceFit. Qual teu nome?"
    (a pergunta "empreender ou equipamento" vem logo depois que ela disser o nome);
  - se já chegou com pedido: responda o pedido e pergunte o nome junto, no fim
    ("E já te cadastro aqui: qual teu nome?").
- Pergunte o nome no máximo duas vezes na conversa; se ela não disser, siga sem.
- Quando a pessoa disser o próprio nome, preencha "nome_cliente" com ele (só o nome, como ela
  escreveu) e passe a usar. Com o nome já confirmado, não pergunte de novo.

ÁUDIO TRANSCRITO
- Veja a linha ORIGEM DA ÚLTIMA MENSAGEM no fim. Se for "áudio transcrito", o texto veio de
  transcrição automática e pode estar errado.
- Se a transcrição parecer sem sentido, contraditória, cortada, curta demais ou fora do
  contexto da conversa, NÃO responda em cima dela: confirme antes, em uma frase, por exemplo
  "Entendi que você perguntou <X>, é isso?". Nesse caso "pendencia" fica vazia.
- Se estiver clara e coerente com a conversa, responda normalmente.

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

CATÁLOGO
- Preço, disponibilidade e especificação de produto: só o que estiver na lista CATÁLOGO
  que vem junto com a conversa. Ela é a única fonte. Preço é por unidade indicada (peça, par, kg...).
- Pode citar preço e especificação exatamente como estão na lista. Se o cliente não disse
  qual variação (peso, modelo), mostre no máximo 3 opções e pergunte qual.
- Se o que ele pediu NÃO está na lista (produto, variação, preço, ou qualquer dado de
  frete, prazo, estoque em quantidade, desconto ou forma de pagamento), responda com
  "deixa eu confirmar com o time e já te retorno" e preencha "pendencia".
- Nunca calcule desconto nem total com frete. Multiplicar preço × quantidade pode.

REGRAS DURAS
- Nunca invente preço, prazo, frete, estoque ou condição de pagamento. O que não está
  no CATÁLOGO vira pendência para o time.
- Nunca prometa nada em nome da empresa.
- Se o cliente pedir humano, reclamar ou o assunto for pedido/entrega já feita:
  diga que vai passar pro time agora e pare de vender.
- Se perguntarem se você é robô/IA, não negue: é o atendimento automático do PlaceFit,
  e alguém do time assume quando precisar.
- Objetivo de toda conversa: entender o que a pessoa quer e deixar o próximo passo
  claro (dados para orçamento, interesse no curso, ou passar pro time).

FORMATO DA RESPOSTA (JSON)
- "resposta": o texto da mensagem para o cliente, sem aspas nem explicações.
- "nome_cliente": o nome que a pessoa disse ser o dela, nesta mensagem ou numa anterior ainda
  não confirmada; "" se ela não disse. Nunca o nome do perfil do WhatsApp.
- "pendencia": vazio ("") se você respondeu tudo. Se prometeu confirmar algo com o time,
  uma linha curta dizendo o que o cliente quer saber (ex.: "preço anilha olímpica 25 kg, 4 un,
  frete pra Divinópolis").`;

const SCHEMA_RESPOSTA = {
  type: 'object',
  properties: {
    resposta: { type: 'string' },
    pendencia: { type: 'string' },
    nome_cliente: { type: 'string' }
  },
  required: ['resposta', 'pendencia', 'nome_cliente']
};

function lerSaidaIA(ai: any): { resposta: string; pendencia: string; nome: string } {
  let obj: any = ai;
  if (typeof ai === 'string') {
    try { obj = JSON.parse(ai); } catch { obj = { resposta: ai, pendencia: '' }; }
  }
  return {
    resposta: String(obj?.resposta || '').trim().replace(/^["“]|["”]$/g, '').slice(0, 1500),
    pendencia: String(obj?.pendencia || '').trim().slice(0, 300),
    nome: String(obj?.nome_cliente || '').trim().slice(0, 80)
  };
}

/** Nome plausível: letras, espaços, apóstrofo e hífen; 2 a 60 caracteres. */
function nomeValido(n: string) {
  return /^[\p{L}][\p{L}' .-]{1,59}$/u.test(n) && !/\d/.test(n);
}

async function registrarPendencia(base44: any, conversa: any, pendencia: string) {
  const agora = new Date();
  const carimbo = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const anterior = String(conversa.pendencia || '').trim();
  const texto = ((anterior ? anterior + '\n' : '') + `[${carimbo}] ${pendencia}`).slice(-1500);
  await base44.asServiceRole.entities.CRMConversa.update(conversa.id, {
    pendencia: texto,
    pendencia_em: agora.toISOString()
  });
}

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

/** Envia pela Cloud API e registra no CRM (mensagem + conversa). */
async function enviarERegistrar(base44: any, connection: any, conversa: any, cliente: string, texto: string) {
  const envio = await enviarTexto(connection.phone_number_id, cliente, texto);
  const quando = new Date().toISOString();
  await base44.asServiceRole.entities.CRMMensagem.create({
    owner_id: connection.tenant_id,
    conversa_id: conversa.id,
    telefone: cliente,
    direcao: 'enviada',
    tipo: 'texto',
    conteudo: texto,
    status: envio.ok ? 'enviada' : 'erro',
    meta_message_id: envio.id,
    erro: envio.error,
    origem: 'respondedor_ia',
    enviada_em: quando
  });
  if (envio.ok) {
    await base44.asServiceRole.entities.CRMConversa.update(conversa.id, {
      ultima_mensagem: texto.slice(0, 200),
      ultima_interacao: quando
    });
  }
  return { ...envio, quando };
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

    // 3. só texto ou áudio, e nada de fila antiga
    const ehAudio = msg?.type === 'audio';
    if (!ehAudio && (msg?.type !== 'text' || !String(msg?.text?.body || '').trim())) {
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
      { conversa_id: conversa.id, direcao: 'enviada' }, '-created_date', 80
    );
    const agora = Date.now();
    const minutosDesde = (m: any) => (agora - new Date(m.created_date).getTime()) / 60000;
    const humano = (enviadas || []).find((m: any) => m.origem !== 'respondedor_ia');
    if (humano && minutosDesde(humano) < HUMAN_TAKEOVER_MINUTES) {
      return await ignorar(base44, eventId, 'humano_assumiu');
    }
    // Conversa em andamento: respondemos há menos de 6 h → nada de saudação de novo
    const ultimaNossa = (enviadas || [])[0];
    const emAndamento = Boolean(ultimaNossa) && minutosDesde(ultimaNossa) < 360;
    const linhaAndamento = (emAndamento
      ? `\n\nCONVERSA EM ANDAMENTO: sim (última resposta nossa há ${Math.round(minutosDesde(ultimaNossa))} min)`
      : '\n\nCONVERSA EM ANDAMENTO: não') +
      `\nORIGEM DA ÚLTIMA MENSAGEM: ${ehAudio ? 'áudio transcrito automaticamente (pode ter erro)' : 'texto digitado'}`;
    const naUltimaHora = (enviadas || []).filter(
      (m: any) => m.origem === 'respondedor_ia' && minutosDesde(m) < 60
    ).length;
    // O teto protege contra loop com outro robô/cliente; o dono (OWNER_PHONE) tem teto maior
    const ehDono = Boolean(onlyDigits(env('OWNER_PHONE'))) && cliente === onlyDigits(env('OWNER_PHONE'));
    if (naUltimaHora >= (ehDono ? TETO_DONO_POR_HORA : TETO_POR_HORA)) return await ignorar(base44, eventId, 'teto_hora');

    // 6. trava o evento antes de gastar IA
    await marcar(base44, eventId, { reply_status: 'respondendo' });

    // Áudio: transcreve e grava a transcrição na mensagem recebida.
    // Falhou ou veio vazio → pede texto, sem travar o fluxo.
    let textoCliente = String(msg?.text?.body || '');
    if (ehAudio) {
      const t = await transcreverAudio(base44, msg);
      if (!t.ok) {
        const envio = await enviarERegistrar(base44, connection, conversa, cliente, PEDIR_TEXTO);
        await marcar(base44, eventId, envio.ok
          ? { reply_status: 'respondido', reply_reason: 'audio_nao_transcrito', reply_error: t.erro, reply_wamid: envio.id, replied_at: envio.quando }
          : { reply_status: 'erro', reply_reason: 'audio_nao_transcrito', reply_error: `${t.erro} | envio: ${envio.error}` });
        return;
      }
      textoCliente = t.texto;
      const recebidas = await base44.asServiceRole.entities.CRMMensagem.filter(
        { owner_id: connection.tenant_id, meta_message_id: String(msg.id) }, '-created_date', 1
      );
      if (recebidas?.[0]) {
        await base44.asServiceRole.entities.CRMMensagem.update(recebidas[0].id, { conteudo: '[áudio] ' + t.texto });
      }
      await base44.asServiceRole.entities.CRMConversa.update(conversa.id, { ultima_mensagem: ('[áudio] ' + t.texto).slice(0, 200) });
    }

    // Modo gerente: só o OWNER_PHONE, e "#cliente" no início força o modo vendedor.
    const dono = onlyDigits(env('OWNER_PHONE'));
    const forcaCliente = /^\s*#cliente\b/i.test(textoCliente);
    if (forcaCliente) textoCliente = textoCliente.replace(/^\s*#cliente\b\s*/i, '');
    const modoGerente = Boolean(dono) && cliente === dono && !forcaCliente;

    const historico = await base44.asServiceRole.entities.CRMMensagem.filter(
      { conversa_id: conversa.id }, '-created_date', HISTORICO
    );
    const conversaTexto = (historico || []).reverse()
      .map((m: any) => (m.direcao === 'recebida' ? (modoGerente ? 'Dono: ' : 'Cliente: ') : (modoGerente ? 'Gerente: ' : 'Léo: ')) +
        String(m.conteudo || '').replace(/^\s*#cliente\b\s*/i, ''))
      .join('\n');

    if (modoGerente) {
      // Orçamento assistido: único caminho de escrita do gerente, e só com "grava" explícito do dono.
      let orc: { tratou: boolean; resposta: string; gravou?: string } = { tratou: false, resposta: '' };
      try {
        orc = await tratarOrcamentoGerente(base44, connection.tenant_id, conversa, textoCliente, conversaTexto);
      } catch (e) {
        console.error('[RESPONDEDOR] orçamento gerente falhou', e);
        orc = { tratou: true, resposta: 'Deu erro montando o orçamento, nada foi gravado. Tenta de novo ou faz pelo painel.' };
        await marcar(base44, eventId, { reply_error: String((e as any)?.message || e).slice(0, 300) });
      }
      if (orc.tratou) {
        const envioO = await enviarERegistrar(base44, connection, conversa, dono, orc.resposta.slice(0, 3900));
        await marcar(base44, eventId, envioO.ok
          ? { reply_status: 'respondido', reply_reason: orc.gravou ? `orcamento_gravado:${orc.gravou}` : 'orcamento_gerente', reply_wamid: envioO.id, replied_at: envioO.quando }
          : { reply_status: 'erro', reply_reason: 'orcamento_gerente', reply_error: envioO.error });
        return;
      }

      // Consulta: somente leitura; a resposta vai exclusivamente para o dono (cliente === dono).
      const resumo = await montarResumoGerente(base44, connection.tenant_id, dono, statusRascunho(conversa));
      const promptGerente = PROMPT_GERENTE +
        `\n\nRESUMO DO CRM (dados reais, lidos agora):\n${resumo}` +
        `\n\nCONVERSA ATÉ AGORA (mais antiga primeiro):\n${conversaTexto}` +
        linhaAndamento +
        `\n\nResponda à última mensagem do dono.`;
      const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: promptGerente });
      let respostaGerente = String(ai || '').trim().replace(/^["“]|["”]$/g, '').slice(0, 3000);
      // Trava: a consulta nunca grava, então nunca pode dizer que gravou
      if (AFIRMA_GRAVACAO.test(respostaGerente)) respostaGerente = NADA_GRAVADO;
      if (!respostaGerente) {
        await marcar(base44, eventId, { reply_status: 'erro', reply_reason: 'modo_gerente', reply_error: 'IA devolveu vazio' });
        return;
      }
      const envioG = await enviarERegistrar(base44, connection, conversa, dono, respostaGerente);
      await marcar(base44, eventId, envioG.ok
        ? { reply_status: 'respondido', reply_reason: 'modo_gerente', reply_wamid: envioG.id, replied_at: envioG.quando, reply_error: '' }
        : { reply_status: 'erro', reply_reason: 'modo_gerente', reply_error: envioG.error });
      return;
    }

    // Catálogo: busca pelas últimas falas do cliente (a atual pesa junto com o contexto)
    let catalogoTexto = 'Catálogo indisponível agora: trate qualquer pergunta de produto como pendência.';
    try {
      const falasCliente = (historico || []).filter((m: any) => m.direcao === 'recebida')
        .slice(-3).map((m: any) => String(m.conteudo || '')).join(' ');
      const itens = await carregarCatalogo(base44, connection.tenant_id);
      catalogoTexto = catalogoParaPrompt(buscarNoCatalogo(itens, falasCliente + ' ' + textoCliente));
    } catch (e) {
      console.error('[RESPONDEDOR] catálogo falhou', e);
    }

    // Nome: só vale o que a pessoa disse (nome_confirmado); o do perfil do WhatsApp não conta
    const linhaNome = conversa.nome_confirmado && conversa.nome_contato
      ? `\n\nNOME DO CONTATO: ${conversa.nome_contato} (confirmado pela pessoa)`
      : '\n\nNOME DO CONTATO: ainda não informado pela pessoa (o nome do perfil do WhatsApp não conta; pergunte)';

    const prompt = PROMPT_LEO +
      linhaNome +
      `\n\nCATÁLOGO (itens que casam com a conversa):\n${catalogoTexto}` +
      `\n\nCONVERSA ATÉ AGORA (mais antiga primeiro):\n${conversaTexto}` +
      linhaAndamento +
      `\n\nEscreva a próxima mensagem do Léo, respondendo à última mensagem do cliente.`;

    const ai = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: SCHEMA_RESPOSTA });
    const { resposta, pendencia, nome } = lerSaidaIA(ai);
    if (!resposta) {
      await marcar(base44, eventId, { reply_status: 'erro', reply_error: 'IA devolveu vazio' });
      return;
    }

    const envio = await enviarERegistrar(base44, connection, conversa, cliente, resposta);
    const quando = envio.quando;
    if (!envio.ok) {
      await marcar(base44, eventId, { reply_status: 'erro', reply_error: envio.error });
      console.error('[RESPONDEDOR] falha no envio', envio.error);
      return;
    }
    if (pendencia) {
      try { await registrarPendencia(base44, conversa, pendencia); }
      catch (e) { console.error('[RESPONDEDOR] falha ao registrar pendência', e); }
    }
    // Nome informado pela própria pessoa vira a chave do cadastro do contato
    if (nome && !conversa.nome_confirmado && nomeValido(nome)) {
      try {
        await base44.asServiceRole.entities.CRMConversa.update(conversa.id, { nome_contato: nome, nome_confirmado: true });
      } catch (e) { console.error('[RESPONDEDOR] falha ao gravar nome', e); }
    }
    await marcar(base44, eventId, { reply_status: 'respondido', reply_wamid: envio.id, replied_at: quando, reply_error: '' });
    console.log('[RESPONDEDOR] respondido', envio.id);
  } catch (error) {
    console.error('[RESPONDEDOR] erro', error);
    try {
      await marcar(base44, eventId, { reply_status: 'erro', reply_error: String((error as any)?.message || error).slice(0, 500) });
    } catch (_) { /* nada a fazer */ }
  }
}
