// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/identidadeWaha.test.ts
// Item 022 (02/11/2026): identidade do contato na entrada do 7206 e conversa única por pessoa.
// Banco em memória; nenhuma chamada real ao WAHA nem ao Base44; nada é enviado a ninguém.
import { identificar, resolverLidNoWaha, meusIdsDoCorpo, pareceTelefoneBR } from './identidadeWaha.ts';
import { conversaDoContato, garantirCliente, nomeParaCadastro, NAO_IDENTIFICADO } from './conversaWaha.ts';

function assert(c: unknown, msg: string) { if (!c) throw new Error('falhou: ' + msg); }
function eq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`falhou: ${msg} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}

const ME = { id: '553799147206@c.us', lid: '241196957995182@lid' };
const MEUS = meusIdsDoCorpo({ me: ME });

Deno.test('ids do dono vêm do corpo do webhook (telefone e LID)', () => {
  eq(MEUS, ['553799147206', '241196957995182'], 'meusIds');
});

Deno.test('recebida de LID com telefone no próprio evento: telefone real + nome do perfil', () => {
  const r = identificar({
    fromMe: false, from: '15866045452440@lid',
    _data: { key: { remoteJid: '15866045452440@lid', remoteJidAlt: '5531988887777@s.whatsapp.net' }, pushName: 'Carlos Teste' }
  }, MEUS);
  eq(r.ignorar, '', 'não ignora');
  eq(r.lid, '15866045452440', 'lid guardado como alias');
  eq(r.telefone, '5531988887777', 'telefone real');
  eq(r.nome, 'Carlos Teste', 'nome do perfil');
});

Deno.test('recebida de LID sem telefone: não identificado, sem número inventado', () => {
  const r = identificar({ fromMe: false, from: '89005127405722@lid', _data: { key: { remoteJid: '89005127405722@lid' } } }, MEUS);
  eq(r.telefone, '', 'sem telefone');
  eq(r.lid, '89005127405722', 'lid');
  assert(!pareceTelefoneBR(r.lid), 'LID não passa como telefone');
});

Deno.test('enviada pelo celular sem "to": usa o chat da chave crua; nome do dono nunca vira nome do contato', () => {
  const r = identificar({
    fromMe: true, from: '553799147206@c.us',
    _data: { key: { remoteJid: '15866045452440@lid', fromMe: true }, pushName: 'Leo da Muscular' }
  }, MEUS);
  eq(r.ignorar, '', 'enviada entra');
  eq(r.lid, '15866045452440', 'mesma conversa do contato');
  eq(r.nome, '', 'pushName do dono descartado');
});

Deno.test('enviada pelo celular com "to" = contato', () => {
  const r = identificar({ fromMe: true, from: '553799147206@c.us', to: '5531988887777@c.us' }, MEUS);
  eq(r.telefone, '5531988887777', 'telefone do contato');
});

Deno.test('grupo, status, canal e self-chat não entram', () => {
  eq(identificar({ from: '120363000000000000@g.us' }, MEUS).ignorar, 'grupo', 'grupo');
  eq(identificar({ from: 'status@broadcast' }, MEUS).ignorar, 'broadcast', 'status');
  eq(identificar({ from: '120363335391126963@newsletter' }, MEUS).ignorar, 'canal', 'canal');
  eq(identificar({ fromMe: true, from: '553799147206@c.us', to: '553799147206@c.us' }, MEUS).ignorar, 'self_chat', 'self-chat por telefone');
  eq(identificar({ fromMe: true, to: '241196957995182@lid', _data: { key: { remoteJid: '241196957995182@lid' } } }, MEUS).ignorar, 'self_chat', 'self-chat por LID');
});

Deno.test('número da assistente (lista de ignorados) não entra', () => {
  eq(identificar({ from: '23949492670633@lid' }, MEUS).ignorar, 'lista_ignorados', 'assistente');
  eq(identificar({ from: '5531900001111@c.us' }, MEUS, ['5531900001111']).ignorar, 'lista_ignorados', 'extra por env');
});

Deno.test('consulta LID→telefone no WAHA: só leitura, falha fecha em "não identificado"', async () => {
  const chamadas: any[] = [];
  const ok = (async (url: string, init: any) => {
    chamadas.push({ url, method: init?.method });
    return new Response(JSON.stringify({ lid: '89005127405721@lid', pn: '5537999990000@c.us' }), { status: 200 });
  }) as any;
  eq(await resolverLidNoWaha('https://waha.x', 'k', 'u1', '89005127405721@lid', ok), '5537999990000', 'resolve');
  eq(chamadas[0].method, 'GET', 'só GET');
  const erro = (async () => new Response('{}', { status: 404 })) as any;
  eq(await resolverLidNoWaha('https://waha.x', 'k', 'u1', '89005127405721@lid', erro), '', '404 → vazio');
  const lixo = (async () => new Response(JSON.stringify({ pn: '89005127405721@lid' }), { status: 200 })) as any;
  eq(await resolverLidNoWaha('https://waha.x', 'k', 'u1', '89005127405721@lid', lixo), '', 'LID nunca vira telefone');
  const caiu = (async () => { throw new Error('rede'); }) as any;
  eq(await resolverLidNoWaha('https://waha.x', 'k', 'u1', '89005127405721@lid', caiu), '', 'rede caiu → vazio');
});

// ── Banco em memória que intercala as operações (simula entregas simultâneas) ──
function bancoMemoria(inicial: Record<string, any[]> = {}) {
  const tabelas: Record<string, any[]> = { CRMConversa: [], Cliente: [], ...inicial };
  let seq = 0;
  const casa = (row: any, q: any) => Object.entries(q).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && '$regex' in v) return new RegExp(v.$regex).test(String(row[k] ?? ''));
    return (row[k] ?? (k === 'ativo' ? undefined : '')) === v;
  });
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const ent = (nome: string) => ({
    async filter(q: any, _sort?: string, limit = 50) {
      await tick();
      return tabelas[nome].filter((r) => casa(r, q)).sort((a, b) => a._ordem - b._ordem).slice(0, limit).map((r) => ({ ...r }));
    },
    async create(d: any) {
      await tick();
      const r = { ...d, id: nome + '-' + (++seq), _ordem: seq, created_date: new Date().toISOString() };
      tabelas[nome].push(r); return { ...r };
    },
    async update(id: string, p: any) {
      await tick();
      const r = tabelas[nome].find((x) => x.id === id); Object.assign(r, p); return { ...r };
    }
  });
  return { tabelas, db: { CRMConversa: ent('CRMConversa'), Cliente: ent('Cliente') } };
}

Deno.test('rajada de 3 mensagens do mesmo contato novo: uma conversa ativa só', async () => {
  const { tabelas, db } = bancoMemoria();
  const ident = { telefone: '', lid: '113121301651629', nome: '' };
  const res = await Promise.all([1, 2, 3].map(() => conversaDoContato(db, 'dono', ident, false, 'oi', new Date().toISOString())));
  const ativas = tabelas.CRMConversa.filter((c) => c.ativo);
  eq(ativas.length, 1, 'uma conversa ativa');
  assert(res.every((c) => c.id === ativas[0].id), 'todas as mensagens vão para a mesma conversa');
  eq(ativas[0].telefone, '', 'sem telefone inventado');
  eq(ativas[0].nome_contato, NAO_IDENTIFICADO, 'não identificado');
  eq(tabelas.Cliente.length, 0, 'nenhum cliente criado');
});

Deno.test('contato com telefone real: liga ao cliente existente pelo telefone, nunca cria cliente', async () => {
  const { tabelas, db } = bancoMemoria({ Cliente: [{ id: 'cli-1', fornecedor_id: 'dono', nome: 'IDEALE VIX', telefone: '(27) 3327-6576', _ordem: 0 }] });
  const c = await conversaDoContato(db, 'dono', { telefone: '552733276576', lid: '', nome: 'Fulano' }, false, 'oi', new Date().toISOString());
  eq(c.cliente_id, 'cli-1', 'vínculo');
  eq(c.nome_contato, 'IDEALE VIX', 'nome do cadastro');
  eq(tabelas.Cliente.length, 1, 'nenhum cliente novo');
});

Deno.test('conversa antiga com LID no campo telefone: reaproveitada, LID vira alias e sai do telefone', async () => {
  const { tabelas, db } = bancoMemoria({ CRMConversa: [{ id: 'old', owner_id: 'dono', telefone: '15866045452440', nome_contato: '15866045452440', ativo: true, nao_lidas: 2, _ordem: 0 }] });
  const c = await conversaDoContato(db, 'dono', { telefone: '', lid: '15866045452440', nome: 'Carlos' }, false, 'oi', new Date().toISOString());
  eq(c.id, 'old', 'mesma conversa');
  eq(tabelas.CRMConversa.length, 1, 'sem conversa nova');
  eq(tabelas.CRMConversa[0].contato_lid, '15866045452440', 'alias');
  eq(tabelas.CRMConversa[0].telefone, '', 'LID não fica como telefone');
  eq(tabelas.CRMConversa[0].nome_contato, 'Carlos', 'nome do perfil no lugar do número');
});

Deno.test('mensagem enviada pelo celular cai na mesma conversa do contato, sem somar não lidas', async () => {
  const { tabelas, db } = bancoMemoria();
  const a = await conversaDoContato(db, 'dono', { telefone: '', lid: '777', nome: 'Ana' }, false, 'oi', new Date().toISOString());
  const b = await conversaDoContato(db, 'dono', { telefone: '', lid: '777', nome: '' }, true, 'resposta', new Date().toISOString());
  eq(a.id, b.id, 'mesma conversa');
  eq(tabelas.CRMConversa[0].nao_lidas, 0, 'enviada zera não lidas');
  eq(tabelas.CRMConversa[0].nome_contato, 'Ana', 'nome preservado');
});

Deno.test('022b: telefone real + nome do perfil cria o cliente e liga a conversa', async () => {
  const { tabelas, db } = bancoMemoria({ CRMConversa: [{ id: 'c1', owner_id: 'dono', telefone: '553172070371', contato_lid: '16222729036011', nome_contato: 'Carlos', cliente_id: '', ativo: true, _ordem: 0 }] });
  const r = await garantirCliente(db, 'dono', { ...tabelas.CRMConversa[0] });
  eq(r, 'cliente_criado', 'criou');
  eq(tabelas.Cliente.length, 1, 'um cliente');
  eq(tabelas.Cliente[0].nome, 'Carlos', 'nome');
  eq(tabelas.Cliente[0].telefone, '553172070371', 'telefone real');
  eq(tabelas.CRMConversa[0].cliente_id, tabelas.Cliente[0].id, 'conversa ligada');
  eq(await garantirCliente(db, 'dono', { ...tabelas.CRMConversa[0] }), '', 'segunda vez não faz nada');
  eq(tabelas.Cliente.length, 1, 'sem duplicar');
});

Deno.test('022b: cliente já existente pelo telefone é só vinculado', async () => {
  const { tabelas, db } = bancoMemoria({
    Cliente: [{ id: 'cli-9', fornecedor_id: 'dono', nome: 'Carlos Silva', telefone: '(31) 7207-0371', _ordem: 0 }],
    CRMConversa: [{ id: 'c1', owner_id: 'dono', telefone: '553172070371', nome_contato: 'Carlos', ativo: true, _ordem: 0 }]
  });
  eq(await garantirCliente(db, 'dono', { ...tabelas.CRMConversa[0] }), 'cliente_vinculado', 'vinculou');
  eq(tabelas.Cliente.length, 1, 'não criou outro');
  eq(tabelas.CRMConversa[0].nome_contato, 'Carlos Silva', 'nome do cadastro');
});

Deno.test('022b: sem telefone real ou sem nome não cria cliente', async () => {
  const { tabelas, db } = bancoMemoria({ CRMConversa: [
    { id: 'a', owner_id: 'dono', telefone: '', contato_lid: '777', nome_contato: 'Ana', ativo: true, _ordem: 0 },
    { id: 'b', owner_id: 'dono', telefone: '553199990000', nome_contato: NAO_IDENTIFICADO, ativo: true, _ordem: 1 },
    { id: 'c', owner_id: 'dono', telefone: '16222729036011', contato_lid: '16222729036011', nome_contato: 'Zé', ativo: true, _ordem: 2 },
  ] });
  for (const c of tabelas.CRMConversa) eq(await garantirCliente(db, 'dono', { ...c }), '', 'nada para ' + c.id);
  eq(tabelas.Cliente.length, 0, 'nenhum cliente');
});

Deno.test('022b: rajada não duplica cliente', async () => {
  const { tabelas, db } = bancoMemoria({ CRMConversa: [{ id: 'c1', owner_id: 'dono', telefone: '553172070371', nome_contato: 'Carlos', ativo: true, _ordem: 0 }] });
  await Promise.all([1, 2, 3].map(() => garantirCliente(db, 'dono', { ...tabelas.CRMConversa[0], cliente_id: '' })));
  eq(tabelas.Cliente.filter((c) => c.ativo !== false).length, 1, 'um cliente ativo');
});

Deno.test('022b: nome do perfil limpo de emoji', () => {
  eq(nomeParaCadastro('Carlos 🔥'), 'Carlos', 'emoji fora');
  eq(nomeParaCadastro('🔥🔥'), '', 'só emoji não é nome');
});

Deno.test('022d: o número do gerente 8509 não vira lead no 7206', () => {
  eq(identificar({ from: '553799458509@c.us' }, MEUS).ignorar, 'lista_ignorados', 'telefone');
  eq(identificar({ from: '89005127405721@lid' }, MEUS).ignorar, 'lista_ignorados', 'LID');
});
