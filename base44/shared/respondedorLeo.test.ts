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
