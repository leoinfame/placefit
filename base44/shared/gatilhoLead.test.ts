// deno test -A --no-check base44/shared/gatilhoLead.test.ts   (offline: nada é enviado)
import { conteudoUtil, soCortesia, ehComercial, midiaHumana, mensagensNovas } from './gatilhoLead.ts';
import { atenderLead, MSG_CONFERINDO, MSG_PEDIR_DADOS } from './vendedorLead.ts';

function ok(c: boolean, m: string) { if (!c) throw new Error('falhou: ' + m); }
const T0 = Date.now() - 6 * 86400000;
const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '');
// [segundos, quem, texto]: c = cliente, s = sistema, h = celular do dono
type L = [number, 'c' | 's' | 'h', string];
const DIA = 86400;
const BV: L = [5, 's', '[PDF: Tabela.pdf]\nOlá! Aqui é o Léo da MuscularFit'];
const ECO: L = [6, 'h', 'Olá! Aqui é o Léo da MuscularFit'];

function cena(linhas: L[], lido: any, r: any = null, alertas: any[] = []) {
  const msgs = linhas.map(([s, q, conteudo], i) => ({
    id: 'm' + i, conversa_id: 'c1', direcao: q === 'c' ? 'recebida' : 'enviada', origem: q === 's' ? 'sistema' : 'waha',
    conteudo, status: 'enviada', meta_message_id: 'w' + i, created_date: iso(T0 + s * 1000)
  }));
  const t: any = { CRMMensagem: msgs, CRMAlerta: [...alertas], CRMConversa: [{ id: 'c1' }], Cliente: [], Pedido: [] };
  const db: any = {};
  for (const e of Object.keys(t)) db[e] = {
    async filter(q: any, sort = 'created_date', lim = 1000) {
      const d = sort.startsWith('-') ? -1 : 1;
      return t[e].filter((x: any) => Object.entries(q).every(([k, v]) => (x[k] ?? '') === v))
        .sort((a: any, b: any) => (a.created_date < b.created_date ? -1 : 1) * d).slice(0, lim);
    },
    async create(x: any) { const n = { id: e + t[e].length, created_date: iso(Date.now()), ...x }; t[e].push(n); return n; },
    async update() {}
  };
  const out: any = { textos: [], avisos: [], ia: 0 };
  const ctx: any = {
    db, base44: {}, owner: { id: 'u' }, conversa: { id: 'c1', etapa: 'novo', telefone: '5531972070371', nome_contato: 'X' },
    messageId: msgs.filter((m) => m.direcao === 'recebida').at(-1)!.meta_message_id,
    enviarTexto: async (x: string) => { out.textos.push(x); return { ok: true, id: 'o', error: '' }; },
    enviarPdf: async () => ({ ok: true, id: 'p', error: '' }), pdfCfg: {}, avisarDono: async (a: any[]) => { out.avisos.push(...a); }, esperar: async () => {},
    deps: { ler: async () => { out.ia++; return structuredClone(lido); }, montar: async () => r }
  };
  return { ctx, out, t };
}
const perg = (pergunta: string) => ({ itens: [], cliente: {}, pergunta, endereco: '' });
async function silencio(nome: string, linhas: L[], lido: any, motivo?: string, alertas: any[] = []) {
  const { ctx, out, t } = cena(linhas, lido, null, alertas);
  const n = t.CRMAlerta.length;
  const res = await atenderLead(ctx);
  ok(out.textos.length === 0, `${nome}: mandou texto (${res.motivo})`);
  ok(out.avisos.length === 0 && (motivo === 'alerta_discreto' || t.CRMAlerta.length === n), `${nome}: criou alerta (${res.motivo})`);
  if (motivo) ok(res.motivo === motivo, `${nome}: esperava ${motivo}, veio ${res.motivo}`);
  return out;
}

Deno.test('conteúdo útil', () => {
  for (const x of ['', '  ', '[Mídia]', '[Mensagem não textual]', '👍', 'ORÇAMENTO 12.pdf', 'https://share.google/abc']) ok(!conteudoUtil(x), x);
  for (const x of ['10 anilhas', 'Fitclass', '05594733000115', 'veja https://x.com preço?']) ok(conteudoUtil(x), x);
  for (const x of ['Oi', 'Opa Leo', 'Olá bom dia', 'Ok', 'Estou no aguardo', 'Boa tarde', 'Obrigada']) ok(soCortesia(x), x);
  for (const x of ['10 anilhas', 'sim', 'quanto custa', 'bom dia, quero preço']) ok(!soCortesia(x), x);
});

Deno.test('os 8 eventos sem texto da lista: zero texto, zero alerta, zero IA', async () => {
  const casos: [string, L[]][] = [
    ['4462', [[0, 'c', 'Eu preciso de ajuda'], BV, ECO, [30, 's', MSG_CONFERINDO], [4 * DIA, 'c', '[Mensagem não textual]']]],
    ['5104 mídia sozinha', [[0, 'c', 'qual seria a proposta de vocês?'], BV, ECO, [30, 's', MSG_CONFERINDO], [5 * DIA, 'c', '[Mídia]']]],
    ['8766', [[0, 'c', 'https://www.instagram.com/p/x'], BV, ECO, [5 * DIA, 'c', '[Mídia]']]],
    ['9294', [[0, 'c', 'Quero saber mais sobre a Churrasqueira Zafira.'], BV, ECO, [28, 's', MSG_CONFERINDO], [40, 'c', '[Mensagem não textual]']]],
    ['8510', [[0, 'c', 'Quero saber mais sobre a Churrasqueira Zafira.'], BV, ECO, [28, 's', MSG_CONFERINDO], [640, 'c', '[Mensagem não textual]']]],
    ['1971', [[0, 'c', 'Solicito orçamento dos materiais abaixo.'], BV, ECO, [28, 's', MSG_CONFERINDO], [40, 'c', '[Mídia]']]],
    ['1826', [[0, 'c', 've se vc pode fazer alguma coisa por mim'], BV, ECO, [28, 's', MSG_CONFERINDO], [60, 'c', '[Mídia]']]],
    ['Vitor', [[0, 'c', 'Vcs fabricam tijolinho?'], BV, ECO, [28, 's', MSG_CONFERINDO], [5 * 3600, 'c', '[Mídia]']]]
  ];
  for (const [n, l] of casos) ok((await silencio(n, l, perg('qual o preço?'), 'sem_conteudo')).ia === 0, n + ': gastou IA');
});

Deno.test('cumprimento, cobrança e "no aguardo" não mandam "estou conferindo"', async () => {
  const velha: L[] = [[0, 'c', 'Oi você conseguiu ver?'], BV, ECO, [140, 's', MSG_CONFERINDO]];
  await silencio('Opa Leo', [...velha, [5 * DIA, 'c', 'Opa Leo']], perg('Oi você conseguiu ver?'), 'cortesia');
  await silencio('bom dia', [...velha, [DIA, 'c', 'Olá bom dia']], perg('x'), 'cortesia');
  await silencio('aguardo', [...velha, [DIA, 'c', 'Ok'], [DIA + 6, 'c', 'Estou no aguardo']], perg('x'), 'cortesia');
  const { ctx, t } = cena([...velha, [4 * DIA, 'c', 'Opa bom conseguiu']], perg('Oi você conseguiu ver?'));
  ok((await atenderLead(ctx)).motivo === 'alerta_discreto', 'cobrança: só painel');
  ok(t.CRMAlerta[0].whatsapp_status === 'so_painel', 'sem WhatsApp ao dono');
  ok((await atenderLead(ctx)).motivo === 'repetido' && t.CRMAlerta.length === 1, 'mesma dúvida não avisa duas vezes');
});

Deno.test('pergunta antiga não volta; lista antiga não é remontada', async () => {
  const b: L[] = [[0, 'c', 'Qual o prazo de entrega?'], BV, ECO, [30, 's', MSG_CONFERINDO]];
  await silencio('antiga', [...b, [DIA, 'c', 'Meu nome é Carlos']], perg('Qual o prazo de entrega?'), 'nada');
  const l: L[] = [[0, 'c', '10 anilhas 25kg'], BV, ECO, [30, 's', MSG_CONFERINDO]];
  await silencio('lista', [...l, [DIA, 'c', 'fico esperando vocês']], { itens: [{ descricao: 'anilha 25kg', quantidade: 10 }], cliente: {}, pergunta: '' }, 'sem_novidade');
});

Deno.test('ofertas e robôs de terceiros: sem texto', async () => {
  for (const x of ['Podemos conversar?', 'Tem interesse?', 'Deseja continuar o atendimento?', 'Eu preciso de ajuda', 'Poderia me direcionar ao responsável pela área de logística ou transportes?', 'C vem na cidade hj ???']) {
    ok(!ehComercial(x), x);
    await silencio(x, [[0, 'c', 'Olá, bom dia'], BV, ECO, [40, 'c', x]], perg(x), 'alerta_discreto');
  }
});

Deno.test('continua respondendo: pergunta de compra, lista, texto seguido de evento vazio', async () => {
  for (const x of ['Vocês tem preço para atacado/revenda?', 'Vc tem anilhas bumpers?', 'Quero calcular a quantidade de piso para minha academia.', 'Quanto tá saindo seu kerobell de 30?']) {
    const { ctx, out } = cena([[0, 'c', 'Oi'], BV, ECO, [40, 'c', x]], perg(x));
    ok((await atenderLead(ctx)).motivo === 'escalou' && out.textos[0] === MSG_CONFERINDO && out.avisos.length === 1, x);
  }
  const lista = { itens: [{ descricao: 'anilha 25kg', quantidade: 10 }], cliente: {}, pergunta: '' };
  for (const fim of [[[41, 'c', '[Mensagem não textual]']], []] as L[][]) {
    const { ctx, out } = cena([[0, 'c', 'Oi'], BV, ECO, [40, 'c', '10 anilhas 25kg'], ...fim], lista);
    ok((await atenderLead(ctx)).motivo === 'pedir_dados' && out.textos[0] === MSG_PEDIR_DADOS, 'lista' + fim.length);
  }
});

Deno.test('lista chegou enquanto a resposta era montada: não se perde', async () => {
  const { ctx, out } = cena([[0, 'c', 'Oi'], BV, ECO, [40, 'c', 'qual o preço da anilha?'], [58, 'c', 'serão 197 metros'], [62, 's', MSG_CONFERINDO]],
    { itens: [{ descricao: 'piso 15mm', quantidade: 197 }], cliente: {}, pergunta: '' });
  ctx.deps.ler = async () => ({ itens: [{ descricao: 'metros', quantidade: 197 }], cliente: {}, pergunta: '' });
  ok((await atenderLead(ctx)).motivo === 'pedir_dados' && out.textos.length === 1, 'tratou a mensagem');
});

Deno.test('dados sem número depois do nosso pedido são novidade; pergunta junto da lista não some', async () => {
  const { ctx, t } = cena([[0, 'c', '10 anilhas 25kg. Parcelam no boleto?'], BV, ECO, [30, 's', MSG_PEDIR_DADOS], [90, 'c', 'Maria Souza, Rua das Flores, Centro']],
    { itens: [{ descricao: 'anilhas 25kg', quantidade: 10 }], cliente: { cpf_cnpj: '05594733000115', nome: 'Maria' }, pergunta: 'Parcelam no boleto?', endereco: '' },
    { pronto: false, perguntas: ['qual anilha?'], nao_cotados: [], ressalvas: [], itens: [], frete: 1, frete_origem: 'tabela', total: 0 });
  ok((await atenderLead(ctx)).motivo === 'escalou', 'seguiu');
  ok(t.CRMAlerta.length === 1, 'avisou');
});

Deno.test('mídia enviada pelo dono = humano assumiu; eco do PDF não', async () => {
  const m = (id: string, s: number, origem: string, conteudo: string) => ({ id, origem, direcao: 'enviada', conteudo, created_date: iso(T0 + s * 1000) });
  const pdf = m('a', 0, 'sistema', '[PDF: T]\nOlá tabela'), eco = m('b', 1, 'waha', 'Olá tabela'), mid = m('c', 120, 'waha', '[Mídia]');
  ok(!midiaHumana(m('d', 1, 'waha', '[Mídia]'), [pdf]), 'eco sem legenda');
  ok(midiaHumana(mid, [pdf, eco, mid]), 'eco já veio: é pessoa');
  ok(midiaHumana(m('e', 999, 'waha', '[Mídia]'), [pdf]), 'bem depois: é pessoa');
  await silencio('humano', [[0, 'c', 'oi'], BV, ECO, [120, 'h', '[Mídia]'], [DIA, 'c', 'qual o preço da anilha?']], perg('qual o preço da anilha?'), 'humano');
});

Deno.test('mensagensNovas não considera a boas-vindas como resposta', () => {
  const g = { id: 'x', direcao: 'recebida', conteudo: '10 anilhas', created_date: iso(T0) };
  ok(mensagensNovas([g], { id: 'bv', created_date: iso(T0 + 5000) }, g).length === 1, '1ª mensagem conta');
});
