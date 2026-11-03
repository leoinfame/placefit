// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/monitorCrm.test.ts
// Item 023: Monitor do CRM — regras e execução com banco em memória.
import { precosSuspeitos, alertasDoFunil, alertasBoasVindas, textoResumo, foraDaJanela, horaBR, familiaDoNome, rodarMonitor, entregarPendentes } from './monitorCrm.ts';

function ok(c: boolean, m: string) { if (!c) throw new Error('falhou: ' + m); }
const H = 3600000;
const ago = (h: number, base = Date.parse('2026-11-03T15:00:00Z')) => new Date(base - h * H).toISOString();

Deno.test('tabela: dumbbell de 50 kg a R$ 15,87 é suspeito; família coerente não', () => {
  const itens = [10, 20, 30, 40].map((kg) => ({ id: 'd' + kg, nome: `Dumbbell Montado Pegada Emborrachada ${kg}kg`, peso_kg: kg, preco: kg * 15.87 }));
  itens.push({ id: 'd50', nome: 'Dumbbell Montado Pegada Emborrachada 50kg', peso_kg: 50, preco: 15.87 });
  const s = precosSuspeitos(itens);
  ok(s.length === 1 && s[0].id === 'd50', 'só o de 50 kg');
  ok(familiaDoNome('Anilha Sport 25kg') === 'anilha sport', 'família sem o peso');
  ok(precosSuspeitos(itens.slice(0, 2)).length === 0, 'família pequena não acusa');
  const sozinho = precosSuspeitos([{ id: 'x', nome: 'Dumbbell Montado Sport Pegada Emborrachada 50kg', peso_kg: 50, preco: 15.87 }]);
  ok(sozinho.length === 1, 'abaixo de R$ 3/kg acusa mesmo sozinho (caso real da tabela)');
});

Deno.test('funil: conversa pessoal nunca vira alerta; lead sem resposta vira', () => {
  const agora = Date.parse('2026-11-03T15:00:00Z');
  const c = { id: 'c1', etapa: 'novo', nome_contato: 'Ana' };
  const msgs = [{ direcao: 'recebida', created_date: ago(3), conteudo: 'quero 10 anilhas' }];
  ok(alertasDoFunil(c, msgs, false, null, agora).length === 0, 'sem boas-vindas = pessoal, silêncio');
  const a = alertasDoFunil(c, msgs, true, null, agora);
  ok(a.length === 1 && a[0].chave === 'lead_sem_resposta:c1', 'lead sem resposta');
  ok(alertasDoFunil(c, [{ direcao: 'recebida', created_date: ago(1) }], true, null, agora).length === 0, 'menos de 2 h não alerta');
  ok(alertasDoFunil({ ...c, etapa: 'negociacao' }, msgs, false, null, agora)[0].chave === 'negociacao_sem_resposta:c1', 'negociação parada');
});

Deno.test('funil: orçamento sem retorno em 24 h e 72 h; com resposta, nada', () => {
  const agora = Date.parse('2026-11-03T15:00:00Z');
  const c = { id: 'c2', etapa: 'orcamento', nome_contato: 'Carlos' };
  const orc = (h: number) => ({ id: 'o1', numero: 'ORC-1', total: 791, created_date: ago(h) });
  ok(alertasDoFunil(c, [], false, orc(10), agora).length === 0, 'antes de 24 h nada');
  ok(alertasDoFunil(c, [], false, orc(30), agora)[0].chave === 'orcamento_24h:c2:o1', '24 h');
  ok(alertasDoFunil(c, [], false, orc(80), agora)[0].chave === 'orcamento_72h:c2:o1', '72 h');
  ok(alertasDoFunil(c, [{ direcao: 'recebida', created_date: ago(5) }], false, orc(30), agora).length === 0, 'cliente respondeu');
});

Deno.test('boas-vindas: erro é urgente; link no lugar do PDF vira um aviso por dia', () => {
  const agora = Date.parse('2026-11-03T15:00:00Z');
  const a = alertasBoasVindas([
    { id: 'm1', status: 'erro', erro: 'HTTP 500', created_date: ago(1), conversa_id: 'c1' },
    { id: 'm2', status: 'enviada', conteudo: 'Olá! ... link', created_date: ago(2) },
    { id: 'm3', status: 'enviada', conteudo: '[PDF: x.pdf]\nOlá', created_date: ago(2) },
    { id: 'm4', status: 'erro', created_date: ago(40) }
  ], agora, '2026-11-03');
  ok(a.length === 2 && a[0].gravidade === 'grave' && a[1].chave === 'boasvindas_link:2026-11-03', 'um urgente e um de link');
});

Deno.test('texto do resumo, janela de 24 h e hora de Brasília', () => {
  const t = textoResumo('MuscularFit', [{ gravidade: 'grave', titulo: 'WhatsApp do CRM desconectado' }]);
  ok(t.includes('MuscularFit') && t.includes('🔴') && t.includes('https://app.placefit.com.br/CRMWhatsApp') && !/base44/.test(t), 'resumo');
  ok(foraDaJanela('HTTP 400 131047: Re-engagement message') && !foraDaJanela('HTTP 401 190: token'), 'janela');
  ok(horaBR(new Date('2026-11-03T11:10:00Z')).hora === 8, '11:10 UTC = 8 h em Brasília');
});

// ── execução completa com banco em memória ──
function banco(seed: Record<string, any[]>) {
  const t: Record<string, any[]> = {};
  let n = 0;
  const casa = (r: any, q: any) => Object.entries(q).every(([k, v]: [string, any]) =>
    v && typeof v === 'object' && '$in' in v ? v.$in.includes(r[k])
      : v && typeof v === 'object' && '$gte' in v ? String(r[k] ?? '').replace('Z', '') >= String(v.$gte)
      : (r[k] ?? '') === v);
  const ent = (nome: string) => {
    t[nome] = (seed[nome] || []).map((r) => ({ ...r }));
    return {
      async filter(q: any, sort?: string, lim = 1000) {
        let rows = t[nome].filter((r) => casa(r, q));
        if (sort) {
          const desc = sort.startsWith('-'); const f = sort.replace(/^-/, '');
          rows = [...rows].sort((a, b) => (String(a[f] ?? '') < String(b[f] ?? '') ? -1 : String(a[f] ?? '') > String(b[f] ?? '') ? 1 : 0) * (desc ? -1 : 1));
        }
        return rows.slice(0, lim).map((r) => ({ ...r }));
      },
      async create(d: any) { const r = { id: nome + ++n, created_date: new Date().toISOString(), ...d }; t[nome].push(r); return { ...r }; },
      async update(id: string, p: any) { Object.assign(t[nome].find((r) => r.id === id), p); }
    };
  };
  const db: any = {};
  for (const e of ['CRMConversa', 'CRMMensagem', 'CRMAlerta', 'User', 'Pedido', 'SupplierProduct', 'ProductTemplate', 'VinculoGerenteWhatsApp']) db[e] = ent(e);
  return { db, t };
}

Deno.test('execução: cria alertas sem duplicar, fecha sozinho, nunca escreve para cliente', async () => {
  const agora = new Date('2026-11-03T11:10:00Z'); // 8 h em Brasília → hora do resumo
  const recente = new Date(agora.getTime() - 3 * H).toISOString();
  const { db, t } = banco({
    User: [{ id: 'u1', empresa: 'MuscularFit', tipo_usuario: 'fornecedor' }],
    CRMConversa: [
      { id: 'lead', owner_id: 'u1', ativo: true, etapa: 'novo', nome_contato: 'Lead', ultima_interacao: recente },
      { id: 'pessoal', owner_id: 'u1', ativo: true, etapa: 'novo', nome_contato: 'Família', ultima_interacao: recente }
    ],
    CRMMensagem: [
      { id: 'bv', owner_id: 'u1', conversa_id: 'lead', origem: 'sistema', direcao: 'enviada', status: 'enviada', conteudo: '[PDF: t.pdf]', created_date: new Date(agora.getTime() - 4 * H).toISOString() },
      { id: 'r1', owner_id: 'u1', conversa_id: 'lead', origem: 'waha', direcao: 'recebida', conteudo: 'quero 10 anilhas', created_date: recente },
      { id: 'p1', owner_id: 'u1', conversa_id: 'pessoal', origem: 'waha', direcao: 'recebida', conteudo: 'oi', created_date: recente }
    ],
    SupplierProduct: [10, 20, 30, 40].map((kg) => ({ id: 'sp' + kg, supplier_id: 'u1', product_id: 't' + kg, preco: kg * 10, margem: 0 }))
      .concat([{ id: 'sp50', supplier_id: 'u1', product_id: 't50', preco: 15.87, margem: 0 }]),
    ProductTemplate: [10, 20, 30, 40, 50].map((kg) => ({ id: 't' + kg, nome: `Dumbbell X ${kg}kg`, peso_kg: kg, foto: 'f' }))
  });
  const enviados: any[] = [];
  const fetchOrig = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: any) => {
    if (String(url).includes('graph.facebook.com')) { enviados.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: 'w1' }] }), { status: 200 }); }
    return new Response(JSON.stringify({ status: 'WORKING' }), { status: 200 });
  }) as any;
  try {
    const cfg = { wahaUrl: 'https://waha', wahaKey: 'k', metaToken: 'tok', phoneNumberId: 'pn', tenant8509: 'u1', ownerPhone: '5537999990000', painel: 'https://app.placefit.com.br' };
    await rodarMonitor(db, cfg, agora);
    const abertos = () => t.CRMAlerta.filter((a) => a.status === 'aberto' && a.tipo !== 'controle');
    const chaves = abertos().map((a) => a.chave).sort();
    ok(chaves.includes('lead_sem_resposta:lead'), 'lead sem resposta');
    ok(!chaves.some((k) => k.includes('pessoal')), 'conversa pessoal fora');
    ok(chaves.some((k) => k.startsWith('preco_suspeito:sp50')), 'preço suspeito');
    ok(enviados.length === 1 && enviados[0].to === '5537999990000', 'um resumo, só para o dono');
    ok(abertos().every((a) => a.whatsapp_status === 'enviado'), 'marcados como enviados');

    await rodarMonitor(db, cfg, new Date(agora.getTime() + 10 * 60000));
    ok(abertos().length === chaves.length && enviados.length === 1, 'segunda volta não duplica nem reenvia');

    t.CRMMensagem.unshift({ id: 'e1', owner_id: 'u1', conversa_id: 'lead', origem: 'waha', direcao: 'enviada', created_date: new Date(agora.getTime() + 20 * 60000).toISOString() });
    await rodarMonitor(db, cfg, new Date(agora.getTime() + 30 * 60000));
    ok(!abertos().some((a) => a.chave === 'lead_sem_resposta:lead'), 'respondeu → fecha sozinho');

    // fora da janela de 24 h: fica esperando e sai quando o dono fala com o 8509
    t.CRMAlerta.push({ id: 'x1', owner_id: 'u1', tipo: 'saude', gravidade: 'grave', chave: 'waha_desconectado', titulo: 'WhatsApp do CRM desconectado', status: 'aberto', whatsapp_status: 'aguardando_janela' });
    ok(await entregarPendentes(db, cfg, '5537999990000') === 1, 'entregue quando a janela abre');
    ok(await entregarPendentes(db, cfg, '5531900000000') === 0, 'número estranho não recebe nada');
  } finally {
    globalThis.fetch = fetchOrig;
  }
});
