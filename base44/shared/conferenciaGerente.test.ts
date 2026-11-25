// deno test --no-lock -A --no-check base44/shared/conferenciaGerente.test.ts   (offline)
// Agente do 8509: conferência e PDF só para o dono.
import { tratarOrcamentoGerente, pedidoDePdf, confirmados } from './orcamentoGerente.ts';
import { responderSeCabivel } from './respondedorLeo.ts';
import { htmlDoOrcamento } from './pdfGerente.ts';

function ok(c: boolean, m: string) { if (!c) throw new Error('falhou: ' + m); }
const DONO = '5537999990001', CLIENTE = '5531988887777';

function base(tenant: string, ia: any[], extra: any = {}) {
  const t: any = {
    Cliente: [{ id: 'cl1', fornecedor_id: tenant, nome: 'Academia Teste', cpf_cnpj: '05594733000115', telefone: CLIENTE, endereco: 'Rua A, 1', cidade: 'Betim', estado: 'MG', cep: '32600000' }],
    ClienteFiscal: [], Pedido: [], CRMConversa: [{ id: 'conv', telefone: DONO }], CRMMensagem: [], whatsapp_webhook_events: [{ id: 'ev' }], CRMBotPausa: [], VinculoGerenteWhatsApp: [],
    User: [{ id: tenant, empresa: 'Loja', condicoes_pagamento: '3x sem juros' }], TabelaFrete: [{ id: 'f', estado: 'MG', valor_minimo: 450, peso_limite: 500, preco_kg_capital: 1, preco_kg_interior: 1, ativo: true }],
    ProductTemplate: [], SupplierProduct: [], ...extra
  };
  for (const [i, [nome, cod, peso]] of ([['Anilha Vazada Pintado 10kg', 'AVP10', 10], ['Barra Hexagonal Maciça Preta', 'BAR-038', 10], ['Barra Hexagonal Tubular Preta', 'BAR-040', 10]] as any).entries()) {
    t.ProductTemplate.push({ id: 'pt' + i, nome, cod, peso_kg: peso, und: 'peça', ativo: true });
    t.SupplierProduct.push({ id: 'sp' + i, supplier_id: tenant, product_id: 'pt' + i, preco: 100, margem: 0, disponivel: true });
  }
  let n = 0;
  const casa = (r: any, q: any) => Object.entries(q).every(([k, v]: any) => v && typeof v === 'object' && '$in' in v ? v.$in.includes(r[k]) : r[k] === v);
  const ent = (e: string) => ({
    filter: async (q: any, _s?: string, lim = 50, skip = 0) => (t[e] || []).filter((r: any) => casa(r, q)).slice(skip, skip + lim),
    get: async (id: string) => (t[e] || []).find((r: any) => r.id === id) || null,
    create: async (d: any) => { const r = { id: e + ++n, created_date: new Date(Date.now() + n).toISOString(), ...d }; t[e].push(r); return r; },
    update: async (id: string, d: any) => { const r = t[e].find((x: any) => x.id === id); if (r) Object.assign(r, d); return r; }
  });
  const fila = [...ia];
  const chamadas = { n: 0 };
  const base44 = { asServiceRole: { entities: new Proxy({}, { get: (_x, e: string) => ent(e) }), integrations: { Core: { InvokeLLM: async () => { chamadas.n++; return structuredClone(fila.shift()); } } } } };
  return { base44, t, chamadas };
}
const pedido = (itens: any[]) => ({ acao: 'orcamento', cliente: { cpf_cnpj: '05594733000115', nome: '', cidade: '', estado: '', telefone: '', cep: '' }, cep_entrega: '', itens, frete_informado: -1 });
const anilha = { descricao: 'Anilha Vazada Pintado 10kg', quantidade: 4, quantidade_informada: true, unidade_pedida: '' };
const hexa = { descricao: 'barra hexagonal preta', quantidade: 3, quantidade_informada: true, unidade_pedida: '', tipo: 'barra', requisitos: ['hexagonal'] };
const conversa = (t: any) => t.CRMConversa[0];

Deno.test('reconhece pedido de PDF sem engolir pedido com itens', () => {
  for (const x of ['manda o pdf', 'PDF', 'me passa o PDF do ORC-1795547374844', 'gera o pdf por favor']) ok(pedidoDePdf(x).pediu, x);
  for (const x of ['faz orçamento de 10 anilhas e manda o pdf', 'não manda o pdf', 'oi', 'o pdf ficou com a cor errada, troca as anilhas por injetadas e refaz o frete']) ok(!pedidoDePdf(x).pediu, x);
  ok(pedidoDePdf('manda o pdf pro cliente').paraCliente, 'cliente');
});
Deno.test('confirmação só quando é só confirmação', () => {
  const p = ['a', 'b'];
  ok(confirmados('1. Sim 2. Sim', p)!.length === 2, 'dois'); ok(confirmados('1 ok', p)!.join() === 'a', 'um'); ok(confirmados('tudo certo', p)!.length === 2, 'tudo');
  for (const x of ['sim', '1. Sim 2. trocar por BAR-040', '2 sim 3 sim', '3 anilhas', 'ok']) ok(confirmados(x, p) === null, x);
  ok(confirmados('sim', ['a'])!.length === 1, 'sim com um só');
});
Deno.test('nada a conferir: grava pendente e devolve o PDF', async () => {
  const { base44, t } = base('ta', [pedido([anilha])]);
  const r = await tratarOrcamentoGerente(base44, 'ta', conversa(t), '4 anilhas vazada pintado 10kg pro cnpj 05594733000115', '');
  ok(r.pdf === t.Pedido[0].id && t.Pedido[0].status === 'pendente' && !r.resposta.includes('Confira antes'), r.resposta);
});
Deno.test('a conferir: grava, mostra no topo, sem PDF; "1. Sim" libera sem IA e sem regravar', async () => {
  const { base44, t, chamadas } = base('tb', [pedido([hexa])]);
  const c = conversa(t);
  const r = await tratarOrcamentoGerente(base44, 'tb', c, '3 barra hexagonal preta pro cnpj 05594733000115', '');
  ok(!r.pdf && t.Pedido.length === 1 && r.resposta.split('\n')[2].startsWith('*Confira antes de enviar*'), r.resposta);
  const antes = JSON.stringify(t.Pedido);
  const s = await tratarOrcamentoGerente(base44, 'tb', c, '1. Sim', '');
  ok(s.pdf === t.Pedido[0].id && chamadas.n === 1 && JSON.stringify(t.Pedido) === antes, s.resposta);
});
Deno.test('"1. trocar por X" atualiza o MESMO orçamento e libera o PDF', async () => {
  const { base44, t } = base('tc', [pedido([hexa]), pedido([{ ...hexa, descricao: 'Barra Hexagonal Tubular Preta' }])]);
  const c = conversa(t);
  await tratarOrcamentoGerente(base44, 'tc', c, '3 barra hexagonal preta pro cnpj 05594733000115', '');
  const r = await tratarOrcamentoGerente(base44, 'tc', c, '1. trocar por Barra Hexagonal Tubular Preta', 'Dono: 3 barra hexagonal preta pro cnpj 05594733000115');
  ok(t.Pedido.length === 1 && t.Pedido[0].itens[0].cod === 'BAR-040' && r.pdf === t.Pedido[0].id, r.resposta);
});
Deno.test('"manda o pdf": último gravado avisa o que falta; ORC de outra conta não sai', async () => {
  const { base44, t } = base('td', [pedido([hexa])]);
  const c = conversa(t);
  ok(!(await tratarOrcamentoGerente(base44, 'td', c, 'manda o pdf', '')).pdf, 'sem orçamento');
  await tratarOrcamentoGerente(base44, 'td', c, '3 barra hexagonal preta pro cnpj 05594733000115', '');
  const r = await tratarOrcamentoGerente(base44, 'td', c, 'manda o pdf pro cliente', '');
  ok(Boolean(r.pdf) && r.resposta.includes('falta conferir') && r.resposta.includes('só pra você'), r.resposta);
  t.Pedido.push({ id: 'alheio', fornecedor_id: 'outra', numero_pedido: 'ORC-1234567890' });
  ok(!(await tratarOrcamentoGerente(base44, 'td', c, 'pdf do ORC-1234567890', '')).pdf, 'outra conta');
});
Deno.test('PDF sem nota interna', () => {
  const h = htmlDoOrcamento({ numero_pedido: 'ORC-1', data_pedido: '2026-11-24', itens: [], subtotal: 0, frete: 0, total: 0, observacoes: 'Criado pelo WhatsApp (modo gerente). Suposições: x' }, { empresa: 'Loja', condicoes_pagamento: '3x sem juros' }, { nome: 'A', cidade: 'Betim', estado: 'MG', observacoes: 'interno' }, '');
  ok(h.includes('3x sem juros') && !/modo gerente|Suposi|interno/.test(h), 'limpo');
});

async function ponta(tenant: string, falhaPdf = false) {
  const { base44, t } = base(tenant, [pedido([anilha])]);
  Deno.env.set('RESPONDEDOR_ATIVO', 'true'); Deno.env.set('RESPONDEDOR_ALLOWLIST', DONO); Deno.env.set('OWNER_PHONE', DONO); Deno.env.set('META_ACCESS_TOKEN', 'x');
  Deno.env.set('PDF_SERVICE_URL', 'https://pdf.teste'); Deno.env.set('PDF_SERVICE_USER', 'u'); Deno.env.set('PDF_SERVICE_PASS', 'p');
  const destinos: string[] = [], tipos: string[] = [], textos: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (u: string, o: any) => {
    u = String(u);
    if (u.includes('/forms/chromium')) return falhaPdf ? new Response('', { status: 500 }) : new Response(new Uint8Array([37, 80]));
    if (u.endsWith('/media')) return new Response(JSON.stringify({ id: 'mid' }));
    if (u.endsWith('/messages')) { const b = JSON.parse(o.body); destinos.push(b.to); tipos.push(b.type); if (b.text) textos.push(b.text.body); return new Response(JSON.stringify({ messages: [{ id: 'wamid' }] })); }
    return new Response('{}', { status: 404 });
  }) as any;
  t.CRMMensagem.push({ id: 'm', conversa_id: 'conv', direcao: 'recebida', origem: 'cloud_api', conteudo: '4 anilhas vazada pintado 10kg pro cnpj 05594733000115', meta_message_id: 'w1', created_date: new Date().toISOString() });
  try {
    await responderSeCabivel(base44, { id: 'c', tenant_id: tenant, phone_number_id: 'p' }, { record: { id: 'ev', event_key: 'k' } },
      { id: 'w1', from: DONO, type: 'text', text: { body: '4 anilhas vazada pintado 10kg pro cnpj 05594733000115' }, timestamp: String(Math.floor(Date.now() / 1000)) }, conversa(t));
  } finally { globalThis.fetch = real; }
  return { destinos, tipos, textos, t };
}
Deno.test('ponta a ponta: texto e PDF só no número do dono, nunca no do cliente', async () => {
  const { destinos, tipos, t } = await ponta('te');
  ok(tipos.join() === 'text,document', tipos.join()); ok(destinos.every((d) => d === DONO) && !destinos.includes(CLIENTE), destinos.join());
  ok(t.CRMMensagem.some((m: any) => m.tipo === 'documento'), 'registrado');
});
Deno.test('PDF fora do ar: orçamento fica gravado e o dono é avisado', async () => {
  const { tipos, textos, t } = await ponta('tf', true);
  ok(t.Pedido.length === 1 && tipos.join() === 'text,text' && textos[1].includes('Não consegui gerar o PDF'), tipos.join());
});
