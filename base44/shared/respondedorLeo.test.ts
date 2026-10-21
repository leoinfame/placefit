// Rodar a partir da raiz do app:  deno test -A base44/shared/respondedorLeo.test.ts
// B4 (rajada) e B5 (limite de uso da IA), com banco em memória.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { juntarRajada } from './respondedorLeo.ts';
import { invocarIA } from './iaComRetry.ts';

const semEspera = async () => {};
const base = (msgs: any[]) => ({
  asServiceRole: { entities: { CRMMensagem: { filter: async () => [...msgs].reverse() } } }
});

// Mesma rajada de 20/10 21:01 (9 mensagens do dono em 5 s), depois de uma resposta nossa
const rajada = [
  { direcao: 'enviada', conteudo: 'resposta anterior', meta_message_id: 'x0' },
  ...['Queria uma barra com recartilhado', '220cm', 'preciso de', 'e queria anilhas com a parte interna de inox',
    '4 pares de 1kg,1 par de 5kg, 1 par de 10kg, e 3 pares de 20kg então', 'Letelba Ferreira Neto',
    'Avenida nossa senhora de copacabana 777 apt1102', '22050002', 'ANI-N062']
    .map((conteudo, i) => ({ direcao: 'recebida', conteudo, meta_message_id: 'm' + (i + 1) }))
];

Deno.test('B4: só a última mensagem da rajada responde, com o texto de todas', async () => {
  for (let i = 1; i <= 8; i++) {
    const r = await juntarRajada(base(rajada), 'c1', 'm' + i, semEspera);
    assertEquals(r.ultima, false, 'm' + i);
  }
  const ultima = await juntarRajada(base(rajada), 'c1', 'm9', semEspera);
  assertEquals(ultima.ultima, true);
  assertEquals(ultima.texto.split('\n').length, 9);
  assert(ultima.texto.startsWith('Queria uma barra com recartilhado\n220cm'));
  assert(ultima.texto.endsWith('ANI-N062'));
  assert(!ultima.texto.includes('resposta anterior'));
});

Deno.test('B5: limite de uso da IA tenta de novo; outro erro sobe na hora', async () => {
  let chamadas = 0;
  const ia = (falhas: number, erro = 'Rate limit exceeded') => ({
    asServiceRole: { integrations: { Core: { InvokeLLM: async () => { chamadas++; if (chamadas <= falhas) throw new Error(erro); return 'ok'; } } } }
  });
  chamadas = 0;
  assertEquals(await invocarIA(ia(2), {}, semEspera), 'ok');
  assertEquals(chamadas, 3);
  chamadas = 0;
  await assertRejects(() => invocarIA(ia(1, 'schema inválido'), {}, semEspera));
  assertEquals(chamadas, 1);
});

// ── Botão "Atendente IA" também no 8509 (decisão do dono, 21/10) ──
import { responderSeCabivel, atendenteLigado } from './respondedorLeo.ts';

function baseComBotao(ativo: boolean, confirmado: boolean) {
  const marcacoes: any[] = [];
  const entidade = (nome: string) => ({
    filter: async () => [],
    get: async () => (nome === 'User' ? { id: 't1', whatsapp_atendente_ativo: ativo, whatsapp_atendente_confirmado: confirmado } : null),
    update: async (_id: string, d: any) => { if (nome === 'whatsapp_webhook_events') marcacoes.push(d); return d; },
    create: async (d: any) => ({ id: 'n', ...d })
  });
  return {
    marcacoes,
    base44: { asServiceRole: { entities: new Proxy({}, { get: (_t, n: string) => entidade(n) }), integrations: { Core: { InvokeLLM: async () => { throw new Error('IA não deveria ser chamada'); } } } } }
  };
}
const evento = () => ({ record: { id: 'ev1', event_key: 'k1' }, dedup: false });
const msgDe = (from: string) => ({ id: 'w1', from, type: 'text', text: { body: 'quanto custa a anilha de 10?' }, timestamp: String(Math.floor(Date.now() / 1000)) });

Deno.test('botão Atendente IA desligado: cliente no 8509 não recebe resposta automática', async () => {
  Deno.env.set('RESPONDEDOR_ATIVO', 'true');
  Deno.env.set('RESPONDEDOR_ALLOWLIST', '');
  Deno.env.set('OWNER_PHONE', '553799147206');
  for (const [ativo, confirmado] of [[false, false], [true, false], [false, true]]) {
    const { base44, marcacoes } = baseComBotao(ativo, confirmado);
    await responderSeCabivel(base44, { id: 'c', tenant_id: 't1', phone_number_id: 'p' }, evento(), msgDe('5531999990000'), { id: 'conv' });
    assertEquals(marcacoes[0], { reply_status: 'ignorado', reply_reason: 'atendente_desligado' });
  }
});

Deno.test('botão desligado não trava o modo gerente do dono', async () => {
  const { base44, marcacoes } = baseComBotao(false, false);
  await responderSeCabivel(base44, { id: 'c', tenant_id: 't1', phone_number_id: 'p' }, evento(), msgDe('553799147206'), { id: 'conv' });
  assert(!marcacoes.some((m) => m.reply_reason === 'atendente_desligado'), JSON.stringify(marcacoes));
  assertEquals(marcacoes[0], { reply_status: 'respondendo' });
});

Deno.test('leitura do botão que falha conta como desligado', async () => {
  const quebrado = { asServiceRole: { entities: { User: { get: async () => { throw new Error('fora do ar'); } } } } };
  assertEquals(await atendenteLigado(quebrado, 't1'), false);
  assertEquals(await atendenteLigado(baseComBotao(true, true).base44, 't1'), true);
});

// ── Item 016: ninguém com cadastro ou tentando ATIVAR fica em silêncio ──
import { _limparCacheContas, ehTentativaDeAtivacao, ehMensagemDeAtivacao } from './vinculoRevendedor.ts';

function base016(opts: { enviadasAntes?: any[] } = {}) {
  const marcacoes: any[] = [];
  const enviadas: string[] = [];
  const usuarios = [
    { id: 'u-marcelo', full_name: 'Marcelo Ferraz', empresa: 'leonfit', whatsapp: '(37) 99969-7818', aprovado: true },
    { id: 't1', full_name: 'fornecedor', empresa: 'MuscularFit', whatsapp: '(37) 99914-7206', whatsapp_atendente_ativo: false }
  ];
  const entidade = (nome: string) => ({
    filter: async (q: any) => {
      if (nome === 'User') return usuarios;
      if (nome === 'CRMMensagem' && q?.direcao === 'enviada') return opts.enviadasAntes || [];
      return [];
    },
    get: async (id: string) => usuarios.find((u) => u.id === id) || null,
    update: async (_id: string, d: any) => { if (nome === 'whatsapp_webhook_events') marcacoes.push(d); return d; },
    create: async (d: any) => { if (nome === 'CRMMensagem') enviadas.push(d.conteudo); return { id: 'n', ...d }; }
  });
  return {
    marcacoes, enviadas,
    base44: { asServiceRole: { entities: new Proxy({}, { get: (_t, n: string) => entidade(n) }), integrations: { Core: { InvokeLLM: async () => { throw new Error('IA não deveria ser chamada'); } } } } }
  };
}
const conexao = { id: 'c', tenant_id: 't1', phone_number_id: 'p' };
const texto = (from: string, body: string) => ({ id: 'w' + Math.random(), from, type: 'text', text: { body }, timestamp: String(Math.floor(Date.now() / 1000)) });

function preparar() {
  Deno.env.set('RESPONDEDOR_ATIVO', 'true');
  Deno.env.set('RESPONDEDOR_ALLOWLIST', '553799147206');
  Deno.env.set('OWNER_PHONE', '553799147206');
  Deno.env.set('META_ACCESS_TOKEN', 'teste');
  globalThis.fetch = (async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.ok' }] }))) as any;
  _limparCacheContas();
}

Deno.test('016: formato do ATIVAR — só "ATIVAR 123456" ativa; o resto é tentativa', () => {
  for (const t of ['ativar 8509', 'ATIVAR', 'ATIVAR 8509', 'Ativar', 'ativar']) {
    assert(ehTentativaDeAtivacao(t), t);
    assert(!ehMensagemDeAtivacao(t), t);
  }
  assert(ehMensagemDeAtivacao('ATIVAR 123456'));
  assert(!ehTentativaDeAtivacao('ATIVAR 123456'));
  assert(!ehTentativaDeAtivacao('quero ativar depois'));
});

Deno.test('016: caso real do Marcelo (fora da allowlist) recebe o caminho de ativação, não silêncio', async () => {
  preparar();
  const { base44, marcacoes, enviadas } = base016();
  await responderSeCabivel(base44, conexao, evento(), texto('553799697818', 'Quero comprar:\n10 anilhas de 10kg'), { id: 'conv-m' });
  assertEquals(enviadas.length, 1);
  assert(enviadas[0].startsWith('Oi, Marcelo! Seu número está no cadastro do PlaceFit (leonfit)'), enviadas[0]);
  assert(enviadas[0].includes('ATIVAR + o código de 6 números'));
  assertEquals(marcacoes.at(-1).reply_reason, 'orientacao_ativacao:u-marcelo');
});

Deno.test('016: orientação não se repete em menos de 6 h (cai na allowlist de novo)', async () => {
  preparar();
  const { base44, marcacoes, enviadas } = base016({ enviadasAntes: [{ conteudo: 'Oi, Marcelo! Seu número está no cadastro do PlaceFit (leonfit)...', created_date: new Date().toISOString() }] });
  await responderSeCabivel(base44, conexao, evento(), texto('553799697818', 'boa noite'), { id: 'conv-m' });
  assertEquals(enviadas.length, 0);
  assertEquals(marcacoes.at(-1), { reply_status: 'ignorado', reply_reason: 'fora_allowlist' });
});

Deno.test('016: "ATIVAR 8509" de qualquer número recebe o formato certo', async () => {
  preparar();
  for (const from of ['553799697818', '5511988887777']) {
    const { base44, marcacoes, enviadas } = base016();
    await responderSeCabivel(base44, conexao, evento(), texto(from, 'ATIVAR 8509'), { id: 'conv' });
    assertEquals(enviadas.length, 1, from);
    assert(enviadas[0].startsWith('Pra ativar o gerente'), enviadas[0]);
    assertEquals(marcacoes.at(-1).reply_reason, 'ativar_formato');
  }
});

Deno.test('016: número desconhecido sem cadastro continua sem resposta automática', async () => {
  preparar();
  const { base44, marcacoes, enviadas } = base016();
  await responderSeCabivel(base44, conexao, evento(), texto('5511988887777', 'quanto custa a anilha?'), { id: 'conv' });
  assertEquals(enviadas.length, 0);
  assertEquals(marcacoes.at(-1).reply_reason, 'fora_allowlist');
});

Deno.test('016: o dono não recebe orientação (segue no modo gerente)', async () => {
  preparar();
  const { base44, marcacoes, enviadas } = base016();
  await responderSeCabivel(base44, conexao, evento(), texto('553799147206', 'oi'), { id: 'conv' }).catch(() => {});
  assert(!enviadas.some((e) => e.includes('Seu número está no cadastro')), JSON.stringify(enviadas));
  assertEquals(marcacoes[0], { reply_status: 'respondendo' });
});
