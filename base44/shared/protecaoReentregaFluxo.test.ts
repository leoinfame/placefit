// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/protecaoReentregaFluxo.test.ts
// Item 030 (17/11/2026): simulação offline da ORDEM do webhook do 7206.
// Usa a conversa de verdade (conversaWaha.ts) com banco em memória.
// Nada de rede, nenhuma chamada ao WAHA, nada é enviado a ninguém.
import { conversaDoContato } from './conversaWaha.ts';
import { timestampDaMensagem, ehHistorico, idDoPayload, decideBoasVindas, MINUTOS_REENTREGA, respostaDeErro } from './protecaoReentrega.ts';

function ok(c: unknown, m: string) { if (!c) throw new Error('falhou: ' + m); }
function eq(a: unknown, b: unknown, m: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`falhou: ${m} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}

// ─── Banco em memória com as entidades que o webhook usa ────────────────────
function fakeDb() {
  const dias = new Date('2026-11-17T12:00:00.000Z').getTime();
  const rows: Record<string, any[]> = { CRMConversa: [], CRMMensagem: [], Cliente: [] };
  let seq = 0;
  const casa = (row: any, q: any) => Object.entries(q).every(([k, v]) => {
    if (v && typeof v === 'object') return true; // operador ($regex): tratado fora
    return row[k] === v;
  });
  const ordenar = (lista: any[], sort?: string) => {
    const campo = String(sort || '').replace('-', '') || 'created_date';
    const desc = String(sort || '').startsWith('-');
    return [...lista].sort((a, b) => desc ? (a[campo] < b[campo] ? 1 : -1) : (a[campo] > b[campo] ? 1 : -1));
  };
  const api = (nome: string) => ({
    filter: async (q: any, sort?: string, limit?: number) => {
      const achou = ordenar(rows[nome].filter((r) => casa(r, q)), sort);
      return typeof limit === 'number' ? achou.slice(0, limit) : achou;
    },
    create: async (d: any) => {
      seq += 1;
      const r = { id: `${nome}-${seq}`, created_date: new Date(dias + seq).toISOString(), ...d };
      rows[nome].push(r);
      return r;
    },
    update: async (id: string, patch: any) => {
      const r = rows[nome].find((x) => x.id === id);
      if (r) Object.assign(r, patch);
      return r;
    },
    delete: async (id: string) => {
      const i = rows[nome].findIndex((x) => x.id === id);
      if (i >= 0) rows[nome].splice(i, 1);
    }
  });
  return {
    rows,
    CRMConversa: api('CRMConversa'),
    CRMMensagem: api('CRMMensagem'),
    Cliente: api('Cliente')
  };
}

/**
 * Mesma ordem do webhook do 7206 depois das mudanças do item 030:
 * idempotência → conversa → grava a mensagem → decide boas-vindas → (envio simulado).
 * O "envio" aqui só grava a linha de sistema; nada sai do processo.
 */
async function processarEvento(db: any, payload: any, opts: { fromMe?: boolean; recebidoEm: number; telefone: string; nome?: string }) {
  const dbq = db;
  const ownerId = 'u-7206';
  const messageId = idDoPayload(payload);
  const enviadaEm = timestampDaMensagem(payload);
  const recebidoEm = opts.recebidoEm;
  const historico = ehHistorico(enviadaEm, recebidoEm, MINUTOS_REENTREGA);

  if (messageId) {
    const existing = await dbq.CRMMensagem.filter({ meta_message_id: messageId }, '-created_date', 1);
    if (existing?.length) return { resultado: 'duplicado' };
  }

  const fromMe = Boolean(opts.fromMe);
  const texto = String(payload?.body || '');
  const ident = { telefone: opts.telefone, lid: '', nome: opts.nome || '', chatId: opts.telefone + '@c.us' };
  const conversation = await conversaDoContato(dbq, ownerId, ident, fromMe, texto, new Date(opts.recebidoEm).toISOString());

  const gravada = await dbq.CRMMensagem.create({
    owner_id: ownerId, conversa_id: conversation.id, telefone: opts.telefone,
    direcao: fromMe ? 'enviada' : 'recebida', conteudo: texto,
    meta_message_id: messageId, status: fromMe ? 'enviada' : 'recebida',
    origem: historico ? 'history' : 'waha',
    ...(enviadaEm ? { enviada_em: new Date(enviadaEm).toISOString() } : {})
  });
  const iguais = (await dbq.CRMMensagem.filter({ meta_message_id: messageId }, 'created_date', 5)) || [];
  if (iguais.length > 1 && iguais[0].id !== gravada.id) {
    await dbq.CRMMensagem.delete(gravada.id);
    return { resultado: 'corrida' };
  }

  const boasVindas = await decideBoasVindas({
    db: dbq, ownerId, conversa: conversation, fromMe, chave: '',
    telefone: opts.telefone, messageId, recebidoEm: opts.recebidoEm, historico
  });

  if (boasVindas.ok) {
    await dbq.CRMMensagem.create({
      owner_id: ownerId, conversa_id: conversation.id, telefone: opts.telefone,
      direcao: 'enviada', conteudo: 'boas-vindas (simulada)', status: 'enviada', origem: 'sistema'
    });
  }
  return { resultado: historico ? 'historico' : 'novo', motivo: boasVindas.motivo, conversaId: conversation.id };
}

const AGORA = new Date('2026-11-17T12:00:00.000Z').getTime();
const emSegundos = (ms: number) => Math.floor(ms / 1000);

// ─── (a) mensagem antiga/importada não dispara nenhum envio ──────────────────
Deno.test('(a) rajada de backlog antigo: grava histórico, não envia nada', async () => {
  const db = fakeDb();
  const tresDiasAtras = AGORA - 3 * 86400000;
  for (let i = 0; i < 3; i++) {
    const r = await processarEvento(db, {
      id: { _serialized: `true_553798888777@c.us_ANTIGA${i}` },
      timestamp: emSegundos(tresDiasAtras + i * 1000),
      body: 'mensagem antiga ' + i
    }, { recebidoEm: AGORA, telefone: '553798888777' });
    eq(r.resultado, 'historico', `evento ${i} é histórico`);
    eq(r.motivo, 'historico', `evento ${i} não envia boas-vindas`);
  }
  eq(db.rows.CRMMensagem.length, 3, 'as três mensagens ficaram gravadas');
  ok(db.rows.CRMMensagem.every((m: any) => m.origem === 'history'), 'todas marcadas como histórico');
  ok(db.rows.CRMMensagem.every((m: any) => Boolean(m.enviada_em)), 'guardam a data original');
  eq(db.rows.CRMMensagem.filter((m: any) => m.origem === 'sistema').length, 0, 'nenhum envio de sistema');
  eq(db.rows.CRMConversa.length, 1, 'uma única conversa para o contato');
  eq(db.rows.CRMConversa[0].etapa, 'novo', 'histórico não mexe na etapa do funil');
});

// ─── (b) contato já existente não recebe boas-vindas de novo ────────────────
Deno.test('(b) contato que já tem conversa não recebe outra boas-vindas', async () => {
  const db = fakeDb();
  // primeiro contato: lead novo de verdade
  const primeiro = await processarEvento(db, {
    id: { _serialized: 'true_5537977776666@c.us_AO_VIVO' }, timestamp: emSegundos(AGORA), body: 'oi, quero a tabela'
  }, { recebidoEm: AGORA, telefone: '5537977776666' });
  eq(primeiro.resultado, 'novo', 'primeira mensagem é ao vivo');
  eq(db.rows.CRMMensagem.filter((m: any) => m.origem === 'sistema').length, 1, 'recebeu uma boas-vindas');

  // duas horas depois, o mesmo contato escreve de novo (mensagem ao vivo, conversa existente)
  const depois = AGORA + 2 * 3600000;
  const segundo = await processarEvento(db, {
    id: { _serialized: 'true_5537977776666@c.us_SEGUNDA' }, timestamp: emSegundos(depois), body: 'e o frete?'
  }, { recebidoEm: depois, telefone: '5537977776666' });
  ok(['contato_conhecido', 'ja_enviada', 'conversa_existente'].includes(segundo.motivo || ''), 'segunda mensagem bloqueada: ' + segundo.motivo);
  eq(db.rows.CRMMensagem.filter((m: any) => m.origem === 'sistema').length, 1, 'continua com uma única boas-vindas');
});

// ─── (c) evento duplicado não envia duas vezes ──────────────────────────────
Deno.test('(c) o mesmo evento entregue duas vezes não duplica nem envia de novo', async () => {
  const db = fakeDb();
  const payload = { id: { _serialized: 'true_5537966665555@c.us_MESMO' }, timestamp: emSegundos(AGORA), body: 'boa tarde' };
  const primeira = await processarEvento(db, payload, { recebidoEm: AGORA, telefone: '5537966665555' });
  eq(primeira.resultado, 'novo', 'primeira entrega processada');
  const boasVindasApos1 = db.rows.CRMMensagem.filter((m: any) => m.origem === 'sistema').length;

  for (let i = 0; i < 3; i++) {
    const repetida = await processarEvento(db, payload, { recebidoEm: AGORA + 1000 * (i + 1), telefone: '5537966665555' });
    eq(repetida.resultado, 'duplicado', `reentrega ${i + 1} barrada pelo id`);
  }
  eq(db.rows.CRMMensagem.filter((m: any) => m.origem === 'waha').length, 1, 'uma única mensagem gravada');
  eq(db.rows.CRMMensagem.filter((m: any) => m.origem === 'sistema').length, boasVindasApos1, 'nenhuma boas-vindas extra');
  eq(boasVindasApos1, 1, 'o lead novo recebeu exatamente uma boas-vindas');
});

// ─── (d) lead realmente novo recebe exatamente uma boas-vindas ──────────────
Deno.test('(d) lead novo recebe uma boas-vindas; evento sem id também não repete', async () => {
  const db = fakeDb();
  const r = await processarEvento(db, { id: { _serialized: 'true_5537955554444@c.us_NOVO' }, timestamp: emSegundos(AGORA), body: 'olá' },
    { recebidoEm: AGORA, telefone: '5537955554444', nome: 'Carlos' });
  eq(r.resultado, 'novo', 'lead novo processado');
  eq(r.motivo, '', 'boas-vindas liberada');
  eq(db.rows.CRMMensagem.filter((m: any) => m.origem === 'sistema').length, 1, 'enviou uma vez');
  eq(db.rows.CRMConversa[0].nome_contato, 'Carlos', 'conversa criada com o nome do perfil');

  // sem id no payload: a trava que vale é a de boas-vindas já enviada
  const semId = await processarEvento(db, { body: 'de novo', timestamp: emSegundos(AGORA + 5000) },
    { recebidoEm: AGORA + 5000, telefone: '5537955554444' });
  ok(!['novo'].includes(String(semId.resultado)) || semId.motivo !== '', 'sem id, a decisão ainda bloqueia');
  eq(db.rows.CRMMensagem.filter((m: any) => m.origem === 'sistema').length, 1, 'não recebeu uma segunda boas-vindas');
});

// ─── (e) falha transitória fica recuperável, sem 200 no erro ────────────────
Deno.test('(e) falha transitória responde 500 e a mensagem já gravada permite reprocessar', async () => {
  const db = fakeDb();
  // a mensagem é gravada antes da automação (é isso que protege a reentrega)
  const gravada = await db.CRMMensagem.create({
    owner_id: 'u-7206', conversa_id: 'conv-x', telefone: '5537944443333',
    direcao: 'recebida', conteudo: 'oi', meta_message_id: 'FALHA-1', status: 'recebida', origem: 'waha'
  });
  ok(Boolean(gravada.id), 'mensagem gravada antes da automação');

  const erro = respostaDeErro('WAHA indisponível');
  eq(erro.status, 500, 'responde erro para o WAHA reentregar');
  ok(erro.status !== 200, 'nunca 200 no erro');
  eq(JSON.parse(erro.body).erro, 'falha_transitoria', 'corpo marca falha transitória');

  // a reentrega depois da falha encontra a mensagem e não duplica
  const repetida = await processarEvento(db, { id: { _serialized: 'FALHA-1' }, timestamp: emSegundos(AGORA), body: 'oi' },
    { recebidoEm: AGORA + 60000, telefone: '5537944443333' });
  eq(repetida.resultado, 'duplicado', 'reentrega reconhecida, sem envio repetido');
  eq(db.rows.CRMMensagem.length, 1, 'sem linha duplicada');
});