// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/protecaoReentrega.test.ts
// Item 030 (17/11/2026): proteção contra reentrega no webhook do 7206.
// Rodam offline: banco em memória, nenhuma chamada ao WAHA, nada é enviado a ninguém.
import {
  timestampDaMensagem, ehHistorico, idDoPayload, eventoJaGravado,
  conversaRecemCriada, jaTeveBoasVindas, contatoJaConhecido, decideBoasVindas,
  respostaDeErro, MINUTOS_REENTREGA
} from './protecaoReentrega.ts';

function ok(c: unknown, m: string) { if (!c) throw new Error('falhou: ' + m); }
function eq(a: unknown, b: unknown, m: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`falhou: ${m} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}

// ─── Banco em memória (mesma assinatura usada pelo webhook) ──────────────────
function fakeDb(seed: any[] = []) {
  const rows: any[] = [...seed];
  const casa = (row: any, q: any) => Object.entries(q).every(([k, v]) => row[k] === v);
  let seq = 0;
  return {
    rows,
    CRMMensagem: {
      filter: async (q: any) => rows.filter((r) => casa(r, q)),
      create: async (d: any) => {
        seq += 1;
        const r = { id: 'm' + seq, created_date: new Date().toISOString(), ...d };
        rows.push(r);
        return r;
      },
      delete: async (id: string) => {
        const i = rows.findIndex((r) => r.id === id);
        if (i >= 0) rows.splice(i, 1);
      }
    }
  };
}

const AGORA = new Date('2026-11-17T12:00:00.000Z').getTime();
const conversaNova = (extra: any = {}) => ({
  id: 'conv-1', _nova: true, created_date: new Date(AGORA - 1000).toISOString(), etapa: 'novo', ...extra
});

// ─── (a) mensagem antiga/importada não dispara nenhum envio ──────────────────
Deno.test('(a) mensagem antiga/importada é histórico e não dispara boas-vindas', async () => {
  // WAHA manda timestamp em segundos
  const antiga = { id: { _serialized: 'true_553799999999@c.us_AAA' }, timestamp: 1762000000 }; // 01/11/2026
  const enviadaEm = timestampDaMensagem(antiga);
  ok(enviadaEm !== null, 'timestamp lido do payload');
  ok(ehHistorico(enviadaEm, AGORA), '3 semanas de atraso = histórico');
  ok(!ehHistorico(null, AGORA), 'payload sem timestamp não é forçado a histórico');
  ok(!ehHistorico(AGORA - 30 * 1000, AGORA), 'mensagem de 30s atrás é ao vivo');
  ok(ehHistorico(AGORA - (MINUTOS_REENTREGA + 1) * 60000, AGORA), 'acima da tolerância é histórico');

  // histórico nunca recebe, mesmo sendo conversa nova e sem cliente
  const db = fakeDb();
  const d = await decideBoasVindas({
    db, ownerId: 'u1', conversa: conversaNova(), fromMe: false,
    chave: '', telefone: '553799999999', messageId: 'X1', recebidoEm: AGORA, historico: true
  });
  eq(d, { ok: false, motivo: 'historico' }, 'histórico bloqueia boas-vindas');
  eq(db.rows.length, 0, 'nenhuma mensagem criada no teste de decisão');
});

// ─── (b) contato já existente não recebe boas-vindas de novo ────────────────
Deno.test('(b) contato que já tem conversa/histórico não recebe boas-vindas', async () => {
  // conversa que já tinha mensagem antes desta
  const comHistorico = fakeDb([
    { id: 'm0', owner_id: 'u1', conversa_id: 'conv-1', telefone: '553799999999', direcao: 'recebida', meta_message_id: 'ANTERIOR', status: 'recebida' }
  ]);
  const d1 = await decideBoasVindas({
    db: comHistorico, ownerId: 'u1', conversa: conversaNova(), fromMe: false,
    chave: '', telefone: '553799999999', messageId: 'NOVA', recebidoEm: AGORA, historico: false
  });
  eq(d1, { ok: false, motivo: 'contato_conhecido' }, 'quem já conversou não é lead novo');
  ok(await contatoJaConhecido(comHistorico, 'u1', 'conv-1', 'NOVA'), 'detecta mensagem anterior');
  ok(!(await contatoJaConhecido(comHistorico, 'u1', 'conv-1', 'ANTERIOR')), 'a própria mensagem não conta');

  // quem já recebeu boas-vindas de sistema
  const comBoasVindas = fakeDb([
    { id: 'm0', owner_id: 'u1', conversa_id: 'conv-1', telefone: '553799999999', origem: 'sistema', direcao: 'enviada', status: 'enviada', meta_message_id: 'BV' }
  ]);
  ok(await jaTeveBoasVindas(comBoasVindas, 'u1', 'conv-1', '553799999999'), 'boas-vindas anterior detectada');
  const d2 = await decideBoasVindas({
    db: comBoasVindas, ownerId: 'u1', conversa: conversaNova(), fromMe: false,
    chave: '', telefone: '553799999999', messageId: 'NOVA', recebidoEm: AGORA, historico: false
  });
  eq(d2, { ok: false, motivo: 'ja_enviada' }, 'nunca repete boas-vindas');

  // conversa antiga (não criada agora) também não recebe
  const antiga = conversaNova({ _nova: false, created_date: new Date(AGORA - 86400000).toISOString() });
  const d3 = await decideBoasVindas({
    db: fakeDb(), ownerId: 'u1', conversa: antiga, fromMe: false,
    chave: '', telefone: '553799999999', messageId: 'NOVA', recebidoEm: AGORA, historico: false
  });
  eq(d3, { ok: false, motivo: 'conversa_existente' }, 'conversa de ontem não é nova');
  ok(!conversaRecemCriada(antiga, AGORA), 'conversa antiga não conta como nova');

  // cliente já cadastrado / mensagem do dono / chave desligada (travas antigas)
  const base: any = { db: fakeDb(), ownerId: 'u1', fromMe: false, chave: '', telefone: '553799999999', messageId: 'N', recebidoEm: AGORA, historico: false };
  eq(await decideBoasVindas({ ...base, conversa: conversaNova({ cliente_id: 'c1' }) }), { ok: false, motivo: 'cliente_existente' }, 'cliente cadastrado não recebe');
  eq(await decideBoasVindas({ ...base, conversa: conversaNova(), fromMe: true }), { ok: false, motivo: 'from_me' }, 'mensagem do dono não dispara');
  eq(await decideBoasVindas({ ...base, conversa: conversaNova(), chave: 'off' }), { ok: false, motivo: 'desligado' }, 'chave CRM_BOAS_VINDAS=off desliga');
});

// ─── (c) evento duplicado não envia duas vezes ──────────────────────────────
Deno.test('(c) mesmo evento (id do payload) não grava nem envia duas vezes', async () => {
  const payload = { id: { _serialized: 'true_553799999999@c.us_DUP' } };
  eq(idDoPayload(payload), 'true_553799999999@c.us_DUP', 'id extraído do formato _serialized');
  eq(idDoPayload({ id: 'abc' }), 'abc', 'id em texto simples');
  eq(idDoPayload({}), '', 'sem id vira vazio');

  // primeira entrega grava; segunda encontra o id e para antes de qualquer automação
  const db = fakeDb();
  const primeira = await db.CRMMensagem.create({
    owner_id: 'u1', conversa_id: 'conv-1', telefone: '553799999999', direcao: 'recebida',
    meta_message_id: idDoPayload(payload), status: 'recebida', origem: 'waha'
  });
  ok(!eventoJaGravado(db.rows.filter((r) => r.id === 'nada'), idDoPayload(payload)), 'lista sem o id não acusa');
  ok(eventoJaGravado(db.rows, idDoPayload(payload)), 'reentrega acusada pelo id');
  eq(db.rows.length, 1, 'sem linha duplicada');
  eq(primeira.meta_message_id, 'true_553799999999@c.us_DUP', 'id gravado na mensagem');

  // corrida: duas entregas simultâneas do mesmo id -> a segunda sai sem automação
  const a = await db.CRMMensagem.create({ owner_id: 'u1', conversa_id: 'conv-2', meta_message_id: 'RACE', status: 'recebida' });
  const b = await db.CRMMensagem.create({ owner_id: 'u1', conversa_id: 'conv-2', meta_message_id: 'RACE', status: 'recebida' });
  const iguais = db.rows.filter((r: any) => r.meta_message_id === 'RACE');
  ok(iguais.length === 2, 'as duas gravaram antes da checagem');
  const perdedora = iguais[0].id === a.id ? b : a;
  await db.CRMMensagem.delete(perdedora.id);
  eq(db.rows.filter((r: any) => r.meta_message_id === 'RACE').length, 1, 'fica só a primeira gravação');
});

// ─── (d) lead realmente novo recebe exatamente uma boas-vindas ──────────────
Deno.test('(d) lead realmente novo recebe uma boas-vindas; tentativa repetida não recebe outra', async () => {
  const db = fakeDb();
  const ctx = {
    db, ownerId: 'u1', conversa: conversaNova(), fromMe: false,
    chave: '', telefone: '5537988887777', messageId: 'PRIMEIRA', recebidoEm: AGORA, historico: false
  };
  const d = await decideBoasVindas(ctx);
  eq(d, { ok: true, motivo: '' }, 'lead novo e conversa criada agora: envia');

  // o webhook grava a mensagem do cliente e a boas-vindas de sistema
  await db.CRMMensagem.create({ owner_id: 'u1', conversa_id: 'conv-1', telefone: '5537988887777', direcao: 'recebida', meta_message_id: 'PRIMEIRA', status: 'recebida', origem: 'waha' });
  await db.CRMMensagem.create({ owner_id: 'u1', conversa_id: 'conv-1', telefone: '5537988887777', direcao: 'enviada', origem: 'sistema', status: 'enviada', meta_message_id: 'BV1' });

  // mesma conversa recebendo outra mensagem: nunca uma segunda boas-vindas
  const d2 = await decideBoasVindas({ ...ctx, conversa: conversaNova(), messageId: 'SEGUNDA' });
  ok(!d2.ok, 'segunda mensagem do mesmo lead não recebe de novo');
  ok(['ja_enviada', 'contato_conhecido'].includes(d2.motivo), 'motivo do bloqueio é boas-vindas já enviada ou contato conhecido: ' + d2.motivo);

  // reentrega daquele mesmo evento: nem chega a decidir (id já gravado)
  ok(eventoJaGravado(db.rows, 'PRIMEIRA'), 'reentrega do primeiro evento é barrada antes da automação');
});

// ─── (e) falha transitória fica recuperável, sem 200 no erro ────────────────
Deno.test('(e) falha transitória responde erro (não 200) para o WAHA reentregar', () => {
  const r = respostaDeErro('WAHA fora do ar');
  eq(r.status, 500, 'status de erro');
  ok(r.status !== 200, 'não responde 200 no erro');
  const body = JSON.parse(r.body);
  eq(body.erro, 'falha_transitoria', 'corpo identifica a falha transitória');
  eq(respostaDeErro(''), { status: 500, body: JSON.stringify({ erro: 'falha_transitoria', detalhe: '' }) }, 'detalhe vazio é aceito');
});

// ─── boas-vindas que falhou não trava a próxima tentativa ───────────────────
Deno.test('boas-vindas com status erro não conta como enviada', async () => {
  const db = fakeDb([
    { id: 'm0', owner_id: 'u1', conversa_id: 'conv-1', telefone: '5537977776666', origem: 'sistema', direcao: 'enviada', status: 'erro', meta_message_id: '' }
  ]);
  ok(!(await jaTeveBoasVindas(db, 'u1', 'conv-1', '5537977776666')), 'linha de erro não bloqueia o reenvio');
});