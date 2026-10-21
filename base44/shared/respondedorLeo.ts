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
//  6. reply_status = "respondendo" é gravado ANTES da IA: reentrega nunca duplica;
//  7. modo vendedor (cliente) só com o botão "Atendente IA" do painel ligado na conta
//     (whatsapp_atendente_ativo E whatsapp_atendente_confirmado, as mesmas chaves do 7206).
//     O modo gerente (dono do número / revendedor verificado) não depende do botão.

import { onlyDigits } from './whatsappCoexistence.ts';
import { carregarCatalogo, buscarNoCatalogo, catalogoParaPrompt } from './catalogoRespondedor.ts';
import { transcreverAudio } from './audioRespondedor.ts';
import { montarResumoGerente, PROMPT_GERENTE } from './gerenteRespondedor.ts';
import { tratarOrcamentoGerente, statusRascunho } from './orcamentoGerente.ts';
import { clienteDaConversa, atualizarCadastro } from './cadastroCliente.ts';
import {
  revendedorDoTelefone, tentarAtivacao, ehMensagemDeAtivacao, ehTentativaDeAtivacao, FORMATO_ATIVAR,
  contaCadastradaDoTelefone, orientacaoAtivacao, PREFIXO_ORIENTACAO
} from './vinculoRevendedor.ts';
import { invocarIA } from './iaComRetry.ts';

// A consulta do gerente não grava nada; se a IA afirmar que gravou/criou, a frase é trocada.
const AFIRMA_GRAVACAO = /(j[aá] (est[aá]|foi|ficou|t[aá]) (no painel|gravad|criad|salv|lan[cç]ad|registrad))|(or[cç]amento (j[aá] |foi |est[aá] |j[aá] foi |j[aá] est[aá] )(gravado|criado|salvo|lan[cç]ado|registrado))|(gravei|criei|lancei|salvei)/i;
const NADA_GRAVADO = 'Nada foi gravado agora. Pra criar um orçamento: "orçamento pro CNPJ <CNPJ> de <quantidade> <produto>"; eu puxo o cadastro, monto itens e frete e gravo como pendente, sem enviar ao cliente.';

// B4: a consulta não pode voltar ao padrão antigo de mandar o dono pro painel por preço/frete.
const MANDA_PRO_PAINEL = /(consult\w*[^.\n]{0,60}painel|n[aã]o aparece\w* no (meu )?resumo|n[aã]o consigo puxar|s[oó] pelo painel)/i;
export const PEDIR_PEDIDO = 'Preço e frete eu monto aqui: me manda o cliente (CNPJ) e os itens que eu faço o orçamento.';

export const PEDIR_TEXTO = 'Não consegui ouvir teu áudio aqui. Manda por texto pra mim?';

const GRAPH_VERSION = 'v21.0';
const IDADE_MAXIMA_MIN = 5;
const HUMAN_TAKEOVER_MINUTES = 60;
const TETO_POR_HORA = 15;
const TETO_DONO_POR_HORA = 60;
const HISTORICO = 10;
// B4: mensagens do dono que chegam em sequência (encaminhadas, picadas) viram UM pedido
const JANELA_RAJADA_MS = 6000;
// Item 016: a orientação de ativação não se repete na mesma conversa antes disso
const ORIENTACAO_A_CADA_MIN = 360;

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
  escreveu) e passe a usar. Com o nome já cadastrado, não pergunte de novo.

CADASTRO DO CLIENTE
- Veja a linha CADASTRO no fim. O cadastro se completa aos poucos: não peça todos os dados de
  uma vez. Só peça CPF/CNPJ, cidade/UF ou endereço quando fizer falta pro atendimento (ex.:
  orçamento ou frete), um dado por vez, e nunca peça o que já está preenchido.
- Tudo que a pessoa informar sobre ela nesta conversa vai em "dados_cliente".

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
- "nome_cliente": o nome que a pessoa disse ser o dela, nesta mensagem ou numa anterior;
  "" se ela não disse. Nunca o nome do perfil do WhatsApp.
- "dados_cliente": o que a PRÓPRIA pessoa informou na conversa sobre ela/empresa dela
  (cpf_cnpj, email, endereco, cidade, estado em sigla UF, cep); "" no que não foi dito.
  Nunca invente nem deduza.
- "pendencia": vazio ("") se você respondeu tudo. Se prometeu confirmar algo com o time,
  uma linha curta dizendo o que o cliente quer saber (ex.: "preço anilha olímpica 25 kg, 4 un,
  frete pra Divinópolis").`;

const SCHEMA_RESPOSTA = {
  type: 'object',
  properties: {
    resposta: { type: 'string' },
    pendencia: { type: 'string' },
    nome_cliente: { type: 'string' },
    dados_cliente: {
      type: 'object',
      properties: {
        cpf_cnpj: { type: 'string' }, email: { type: 'string' }, endereco: { type: 'string' },
        cidade: { type: 'string' }, estado: { type: 'string' }, cep: { type: 'string' }
      },
      required: ['cpf_cnpj', 'email', 'endereco', 'cidade', 'estado', 'cep']
    }
  },
  required: ['resposta', 'pendencia', 'nome_cliente', 'dados_cliente']
};

function lerSaidaIA(ai: any): { resposta: string; pendencia: string; nome: string; dados: any } {
  let obj: any = ai;
  if (typeof ai === 'string') {
    try { obj = JSON.parse(ai); } catch { obj = { resposta: ai, pendencia: '' }; }
  }
  return {
    resposta: String(obj?.resposta || '').trim().replace(/^["“]|["”]$/g, '').slice(0, 1500),
    pendencia: String(obj?.pendencia || '').trim().slice(0, 300),
    nome: String(obj?.nome_cliente || '').trim().slice(0, 80),
    dados: obj?.dados_cliente || {}
  };
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

/**
 * Rajada do modo gerente (B4): espera a janela e só a ÚLTIMA mensagem recebida segue,
 * levando o texto de todas as recebidas desde a última resposta nossa. As outras saem
 * sem responder (uma resposta por pedido, sem rascunhos concorrentes).
 */
export async function juntarRajada(base44: any, conversaId: string, msgId: string, esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))) {
  await esperar(JANELA_RAJADA_MS);
  const recentes = await base44.asServiceRole.entities.CRMMensagem.filter({ conversa_id: conversaId }, '-created_date', 30);
  const ultimaRecebida = (recentes || []).find((m: any) => m.direcao === 'recebida');
  if (ultimaRecebida && msgId && String(ultimaRecebida.meta_message_id || '') !== msgId) return { ultima: false, texto: '' };
  const lote: any[] = [];
  for (const m of recentes || []) {
    if (m.direcao !== 'recebida') break;
    lote.push(m);
  }
  const texto = lote.reverse()
    .map((m) => String(m.conteudo || '').replace(/^\[áudio\]\s*/, '').replace(/^\s*#cliente\b\s*/i, '').trim())
    .filter((t) => t && t !== '[audio]')
    .join('\n');
  return { ultima: true, texto };
}

/** Já mandamos a orientação de ativação nesta conversa nas últimas 6 h? */
async function orientouRecentemente(base44: any, conversaId: string) {
  const enviadas = await base44.asServiceRole.entities.CRMMensagem.filter({ conversa_id: conversaId, direcao: 'enviada' }, '-created_date', 20);
  return (enviadas || []).some((m: any) =>
    String(m.conteudo || '').includes(PREFIXO_ORIENTACAO) &&
    (Date.now() - new Date(m.created_date).getTime()) / 60000 < ORIENTACAO_A_CADA_MIN);
}

/** Botão "Atendente IA" do painel ligado na conta? Falha na leitura = desligado (falha fechado). */
export async function atendenteLigado(base44: any, tenantId: string): Promise<boolean> {
  try {
    const conta = await base44.asServiceRole.entities.User.get(tenantId);
    return Boolean(conta?.whatsapp_atendente_ativo) && Boolean(conta?.whatsapp_atendente_confirmado);
  } catch (e) {
    console.error('[RESPONDEDOR] leitura do botão Atendente IA falhou', e);
    return false;
  }
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

    const cliente = onlyDigits(msg?.from || '');

    // Item 006: ativacao do gerente pelo revendedor ("ATIVAR 123456" do proprio celular).
    // Vem antes da allowlist porque o numero ainda nao esta liberado; so texto recente.
    const textoBruto = msg?.type === 'text' ? String(msg?.text?.body || '') : '';
    const idadeAtiv = (Date.now() - Number(msg?.timestamp || 0) * 1000) / 60000;
    if (textoBruto && ehMensagemDeAtivacao(textoBruto) && idadeAtiv <= IDADE_MAXIMA_MIN) {
      await marcar(base44, eventId, { reply_status: 'respondendo' });
      const at = await tentarAtivacao(base44, cliente, textoBruto);
      const envioA = await enviarERegistrar(base44, connection, conversa, cliente, at.resposta);
      await marcar(base44, eventId, envioA.ok
        ? { reply_status: 'respondido', reply_reason: at.userId ? 'vinculo_ativado' : 'vinculo_falhou', reply_wamid: envioA.id, replied_at: envioA.quando }
        : { reply_status: 'erro', reply_reason: 'vinculo', reply_error: envioA.error });
      return;
    }

    // Item 016: "ATIVAR" sem o código de 6 números nunca fica em silêncio: responde o formato certo
    if (textoBruto && ehTentativaDeAtivacao(textoBruto) && idadeAtiv <= IDADE_MAXIMA_MIN) {
      await marcar(base44, eventId, { reply_status: 'respondendo' });
      const envioF = await enviarERegistrar(base44, connection, conversa, cliente, FORMATO_ATIVAR);
      await marcar(base44, eventId, envioF.ok
        ? { reply_status: 'respondido', reply_reason: 'ativar_formato', reply_wamid: envioF.id, replied_at: envioF.quando }
        : { reply_status: 'erro', reply_reason: 'ativar_formato', reply_error: envioF.error });
      return;
    }

    // Item 006: revendedor com numero verificado -> gerente da PROPRIA revenda
    let vinculo: any = null;
    try { vinculo = await revendedorDoTelefone(base44, cliente); } catch (e) { console.error('[RESPONDEDOR] vinculo falhou', e); }
    const donoTel = onlyDigits(env('OWNER_PHONE'));

    // Item 016: conta do app (revendedor/fornecedor) com este celular, ainda sem vínculo verificado,
    // recebe o caminho de ativação (mensagem fixa, sem IA) em vez de silêncio; no máximo 1x a cada 6 h
    if (!vinculo && !(donoTel && cliente === donoTel) && idadeAtiv <= IDADE_MAXIMA_MIN) {
      let conta: any = null;
      try { conta = await contaCadastradaDoTelefone(base44, cliente); } catch (e) { console.error('[RESPONDEDOR] leitura do cadastro de contas falhou', e); }
      if (conta && !(await orientouRecentemente(base44, conversa.id))) {
        await marcar(base44, eventId, { reply_status: 'respondendo' });
        const envioO = await enviarERegistrar(base44, connection, conversa, cliente, orientacaoAtivacao(conta));
        await marcar(base44, eventId, envioO.ok
          ? { reply_status: 'respondido', reply_reason: `orientacao_ativacao:${conta.id}`, reply_wamid: envioO.id, replied_at: envioO.quando }
          : { reply_status: 'erro', reply_reason: 'orientacao_ativacao', reply_error: envioO.error });
        return;
      }
    }

    // 2. allowlist (numero de revendedor verificado tambem passa)
    const allow = env('RESPONDEDOR_ALLOWLIST').split(',').map(onlyDigits).filter(Boolean);
    if (allow.length && !allow.includes(cliente) && !vinculo) return await ignorar(base44, eventId, 'fora_allowlist');

    // 7. cliente só recebe resposta automática com o botão "Atendente IA" ligado (decisão do dono, 21/10)
    const podeSerGerente = (Boolean(donoTel) && cliente === donoTel) || Boolean(vinculo);
    if (!podeSerGerente && !(await atendenteLigado(base44, connection.tenant_id))) {
      return await ignorar(base44, eventId, 'atendente_desligado');
    }

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
    const ehDono = (Boolean(onlyDigits(env('OWNER_PHONE'))) && cliente === onlyDigits(env('OWNER_PHONE'))) || Boolean(vinculo);
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
    const ehDonoDoNumero = Boolean(dono) && cliente === dono;
    const modoGerente = (ehDonoDoNumero || Boolean(vinculo)) && !forcaCliente;
    // Isolamento: o dono do 8509 usa a conta do 8509; o revendedor verificado usa SO a conta dele.
    const tenantGerente = ehDonoDoNumero ? connection.tenant_id : (vinculo?.user_id || connection.tenant_id);
    const numeroGerente = cliente;

    if (modoGerente) {
      const rajada = await juntarRajada(base44, conversa.id, String(msg?.id || ''));
      if (!rajada.ultima) return await ignorar(base44, eventId, 'agrupado_na_rajada');
      if (rajada.texto) textoCliente = rajada.texto;
    }

    const historico = await base44.asServiceRole.entities.CRMMensagem.filter(
      { conversa_id: conversa.id }, '-created_date', HISTORICO
    );
    const conversaTexto = (historico || []).reverse()
      .map((m: any) => (m.direcao === 'recebida' ? (modoGerente ? 'Dono: ' : 'Cliente: ') : (modoGerente ? 'Gerente: ' : 'Léo: ')) +
        String(m.conteudo || '').replace(/^\s*#cliente\b\s*/i, ''))
      .join('\n');

    if (modoGerente) {
      // Orçamento assistido: único caminho de escrita do gerente; grava sozinho (pendente) quando o
      // pedido está completo e nunca envia ao cliente nem converte em pedido (item 009).
      let orc: { tratou: boolean; resposta: string; gravou?: string } = { tratou: false, resposta: '' };
      try {
        orc = await tratarOrcamentoGerente(base44, tenantGerente, conversa, textoCliente, conversaTexto);
      } catch (e) {
        console.error('[RESPONDEDOR] orçamento gerente falhou', e);
        orc = { tratou: true, resposta: 'Deu erro montando o orçamento, nada foi gravado. Tenta de novo ou faz pelo painel.' };
        await marcar(base44, eventId, { reply_error: String((e as any)?.message || e).slice(0, 300) });
      }
      if (orc.tratou) {
        const envioO = await enviarERegistrar(base44, connection, conversa, numeroGerente, orc.resposta.slice(0, 3900));
        await marcar(base44, eventId, envioO.ok
          ? { reply_status: 'respondido', reply_reason: orc.gravou ? `orcamento_gravado:${orc.gravou}` : 'orcamento_gerente', reply_wamid: envioO.id, replied_at: envioO.quando }
          : { reply_status: 'erro', reply_reason: 'orcamento_gerente', reply_error: envioO.error });
        return;
      }

      // Consulta: somente leitura; a resposta vai exclusivamente para o dono (cliente === dono).
      const resumo = await montarResumoGerente(base44, tenantGerente, numeroGerente, statusRascunho(conversa));
      const promptGerente = PROMPT_GERENTE +
        `\n\nRESUMO DO CRM (dados reais, lidos agora):\n${resumo}` +
        `\n\nCONVERSA ATÉ AGORA (mais antiga primeiro):\n${conversaTexto}` +
        linhaAndamento +
        `\n\nResponda à última mensagem do dono.`;
      const ai = await invocarIA(base44, { prompt: promptGerente });
      let respostaGerente = String(ai || '').trim().replace(/^["“]|["”]$/g, '').slice(0, 3000);
      // Trava: a consulta nunca grava, então nunca pode dizer que gravou
      if (AFIRMA_GRAVACAO.test(respostaGerente)) respostaGerente = NADA_GRAVADO;
      // Trava (B4): preço/frete são do fluxo de orçamento, nunca "consulte no painel"
      if (MANDA_PRO_PAINEL.test(respostaGerente)) respostaGerente = PEDIR_PEDIDO;
      if (!respostaGerente) {
        await marcar(base44, eventId, { reply_status: 'erro', reply_reason: 'modo_gerente', reply_error: 'IA devolveu vazio' });
        return;
      }
      const envioG = await enviarERegistrar(base44, connection, conversa, numeroGerente, respostaGerente);
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

    // Cadastro: cliente vinculado à conversa (ou achado pelo telefone). O nome do perfil do WhatsApp não conta.
    let clienteVinc: any = null;
    try { clienteVinc = await clienteDaConversa(base44, connection.tenant_id, conversa, cliente); }
    catch (e) { console.error('[RESPONDEDOR] leitura do cadastro falhou', e); }
    const linhaNome = clienteVinc?.nome
      ? `\n\nNOME DO CONTATO: ${clienteVinc.nome} (cadastrado)`
      : '\n\nNOME DO CONTATO: ainda não informado pela pessoa (o nome do perfil do WhatsApp não conta; pergunte)';
    const camposCadastro: Array<[string, string]> = [['cpf_cnpj', 'CPF/CNPJ'], ['cidade', 'cidade'], ['estado', 'UF'], ['endereco', 'endereço'], ['cep', 'CEP'], ['email', 'e-mail']];
    const linhaCadastro = clienteVinc
      ? `\nCADASTRO: preenchido = ${camposCadastro.filter(([k]) => clienteVinc[k]).map(([, r]) => r).join(', ') || 'nada além do nome'}; vazio = ${camposCadastro.filter(([k]) => !clienteVinc[k]).map(([, r]) => r).join(', ') || 'nada'}`
      : '\nCADASTRO: ainda não existe (é criado quando a pessoa disser o nome)';

    const prompt = PROMPT_LEO +
      linhaNome + linhaCadastro +
      `\n\nCATÁLOGO (itens que casam com a conversa):\n${catalogoTexto}` +
      `\n\nCONVERSA ATÉ AGORA (mais antiga primeiro):\n${conversaTexto}` +
      linhaAndamento +
      `\n\nEscreva a próxima mensagem do Léo, respondendo à última mensagem do cliente.`;

    const ai = await invocarIA(base44, { prompt, response_json_schema: SCHEMA_RESPOSTA });
    const { resposta, pendencia, nome, dados } = lerSaidaIA(ai);
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
    // Cadastro: cria o Cliente quando a pessoa diz o nome; completa só campos vazios
    let mudancaCadastro = '';
    try {
      mudancaCadastro = await atualizarCadastro(base44, connection.tenant_id, conversa, cliente, clienteVinc, nome, dados);
    } catch (e) { console.error('[RESPONDEDOR] falha no cadastro do cliente', e); }
    await marcar(base44, eventId, { reply_status: 'respondido', reply_wamid: envio.id, replied_at: quando, reply_error: '', ...(mudancaCadastro ? { reply_reason: mudancaCadastro } : {}) });
    console.log('[RESPONDEDOR] respondido', envio.id);
  } catch (error) {
    console.error('[RESPONDEDOR] erro', error);
    try {
      await marcar(base44, eventId, { reply_status: 'erro', reply_error: String((error as any)?.message || error).slice(0, 500) });
    } catch (_) { /* nada a fazer */ }
  }
}
