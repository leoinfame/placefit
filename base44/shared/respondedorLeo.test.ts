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
