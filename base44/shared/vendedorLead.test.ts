// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/vendedorLead.test.ts
// Item 023 fase 2: vendedor automático do lead. IA, motor, gravação e PDF simulados; regras reais.
import { decidir, humanoAssumiu, legendaOrcamento, observacoesCliente, atenderLead, MSG_PEDIR_DADOS, MSG_PEDIR_LISTA, MSG_CONFERINDO } from './vendedorLead.ts';
import { montarHtmlPedido } from './pedidoPdfHtml.js';

function ok(c: boolean, m: string) { if (!c) throw new Error('falhou: ' + m); }
const item = (d = 'anilha vazada pintada 25kg', q = 2) => ({ descricao: d, quantidade: q });
const rOk = () => ({ pronto: true, perguntas: [], nao_cotados: [], frete: 450, frete_origem: 'tabela MG piso até 500 kg, 50 kg', ressalvas: [], total: 791, itens: [{ nome: 'Anilha', quantidade: 2, subtotal: 341 }], cliente: { id: 'cl1', nome: 'MIC', cidade: 'Belo Horizonte', estado: 'MG' }, composicoes: [], suposicoes: [], peso_total: 50 });

Deno.test('decidir: lista sem documento pede dados; documento sem lista pede lista; nada = silêncio', () => {
  ok(decidir({ itens: [item()], cliente: {} }, null).acao === 'pedir_dados', 'pede CNPJ');
  ok(decidir({ itens: [], cliente: { cpf_cnpj: '05594733000115' } }, null).acao === 'pedir_lista', 'pede lista');
  ok(decidir({ itens: [], cliente: {} }, null).acao === 'nada', 'só conversa');
  ok(decidir({ itens: [], cliente: {}, pergunta: 'Vocês parcelam?' }, null).acao === 'escalar', 'pergunta vai pro dono');
});

Deno.test('decidir: só envia sozinho quando está tudo claro', () => {
  const ped = { itens: [item()], cliente: { cpf_cnpj: '05594733000115' } };
  ok(decidir(ped, rOk()).acao === 'enviar', 'claro → envia');
  ok(decidir(ped, { ...rOk(), nao_cotados: ['esteira'] }).acao === 'escalar', 'item fora do catálogo → dono');
  ok(decidir(ped, { ...rOk(), frete: null, frete_origem: '', pronto: false, perguntas: ['Sem tabela de frete pra AM. Qual o valor do frete?'] }).acao === 'escalar', 'sem frete → dono');
  ok(decidir(ped, { ...rOk(), perguntas: ['"anilha 25": usar "Anilha Vazada Pintado 25kg"?'], pronto: false }).acao === 'escalar', 'item ambíguo → dono');
  const pf = { itens: [item()], cliente: { cpf_cnpj: '12345678901' } };
  ok(decidir(pf, { ...rOk(), pronto: false, perguntas: ['Cliente novo, sem cadastro público. Me passa: cidade/UF ou CEP.'] }).acao === 'pedir_dados', 'pessoa física sem CEP → pede ao cliente');
});

Deno.test('humano assumiu: mensagem digitada no celular para o robô; eco do sistema não', () => {
  const bv = '2026-11-03T10:00:00';
  const sis = { origem: 'sistema', direcao: 'enviada', conteudo: 'Olá! Aqui é o Léo da MuscularFit, obrigado pelo contato.', created_date: bv };
  ok(!humanoAssumiu([sis, { origem: 'waha', direcao: 'enviada', conteudo: 'Olá! Aqui é o Léo da MuscularFit, obrigado pelo contato.', created_date: '2026-11-03T10:00:01' }], bv), 'eco não conta');
  ok(!humanoAssumiu([sis, { origem: 'waha', direcao: 'enviada', conteudo: '[Mídia]', created_date: '2026-11-03T10:00:01' }], bv), 'eco do PDF não conta');
  ok(humanoAssumiu([sis, { origem: 'waha', direcao: 'enviada', conteudo: 'Oi Carlos, te ligo já', created_date: '2026-11-03T10:05:00' }], bv), 'pessoa digitou');
});

Deno.test('legenda e observações do PDF do cliente (sem nota interna)', () => {
  const l = legendaOrcamento('Carlos Silva', 'ORC-1', 791, 'Belo Horizonte', 'MG');
  ok(l.startsWith('Carlos, segue o seu orçamento ORC-1.') && l.includes('R$ 791,00') && l.includes('Belo Horizonte/MG'), 'legenda');
  const o = observacoesCliente({ condicoes_pagamento: '3x sem juros', prazo_producao: 'até 15 dias' }, rOk());
  ok(o.includes('3x sem juros') && o.includes('Belo Horizonte/MG') && !/gerente|Ressalva|Suposi|Receita/i.test(o), 'só condições');
  const html = montarHtmlPedido({ pedido: { numero_pedido: 'ORC-1', data_pedido: '2026-11-03', itens: [{ cod: 'AVP25', nome: 'Anilha', quantidade: 2, preco_unitario: 170.5, subtotal: 341 }], subtotal: 341, frete: 450, total: 791, observacoes: o },
    user: { empresa: 'MuscularFit', logomarca: 'https://x/logo.png' }, cliente: { nome: 'MIC TRANSPORTES', observacoes: '' }, tipo: 'orcamento', pesoTotal: 50, colors: { primary: 'var(--pf-primary, #1e3a5f)' }, extraHead: '<script>window.__pronto=true</script>' });
  ok(html.includes('ORÇAMENTO') && html.includes('MIC TRANSPORTES') && html.includes('R$ 791,00') && html.includes('window.__pronto'), 'PDF do painel com o pedido');
});

// ── fluxo completo com banco em memória ──
function banco(seed: Record<string, any[]>) {
  const t: Record<string, any[]> = {};
  let n = 0;
  const casa = (r: any, q: any) => Object.entries(q).every(([k, v]) => (r[k] ?? '') === v);
  const db: any = {};
  for (const e of ['CRMMensagem', 'CRMConversa', 'CRMAlerta', 'Cliente', 'Pedido']) {
    t[e] = (seed[e] || []).map((r) => ({ ...r }));
    db[e] = {
      async filter(q: any, sort?: string, lim = 1000) {
        let rows = t[e].filter((r) => casa(r, q));
        if (sort) { const d = sort.startsWith('-'); const f = sort.replace('-', ''); rows = [...rows].sort((a, b) => (String(a[f]) < String(b[f]) ? -1 : 1) * (d ? -1 : 1)); }
        return rows.slice(0, lim).map((r) => ({ ...r }));
      },
      async create(dd: any) { const r = { id: e + ++n, created_date: new Date(Date.now() + n).toISOString().replace('Z', ''), ...dd }; t[e].push(r); return { ...r }; },
      async update(id: string, p: any) { Object.assign(t[e].find((r) => r.id === id) || {}, p); }
    };
  }
  return { db, t };
}

function cenario(textos: string[], pedidoLido: any, r: any) {
  const base = Date.now() - 60000;
  const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '');
  const msgs = [
    { id: 'm0', conversa_id: 'c1', direcao: 'recebida', origem: 'waha', conteudo: 'quero a tabela de atacado', meta_message_id: 'w0', created_date: iso(base) },
    { id: 'bv', conversa_id: 'c1', direcao: 'enviada', origem: 'sistema', conteudo: '[PDF: Tabela.pdf]\nOlá!', created_date: iso(base + 2000) },
    ...textos.map((x, i) => ({ id: 'r' + i, conversa_id: 'c1', direcao: 'recebida', origem: 'waha', conteudo: x, meta_message_id: 'w' + (i + 1), created_date: iso(base + 10000 + i * 1000) }))
  ];
  const { db, t } = banco({ CRMMensagem: msgs, CRMConversa: [{ id: 'c1', etapa: 'novo' }], Cliente: [{ id: 'cl1', nome: 'MIC TRANSPORTES', observacoes: 'Telefone da Receita: 3133333333' }] });
  const out: any = { textos: [], pdfs: [], avisos: [], gravou: 0, html: '' };
  const ctx: any = {
    db, base44: {}, owner: { id: 'u1', empresa: 'MuscularFit', condicoes_pagamento: '3x' },
    conversa: { id: 'c1', etapa: 'novo', telefone: '5531972070371', nome_contato: 'Carlos' }, messageId: 'w' + textos.length,
    enviarTexto: async (x: string) => { out.textos.push(x); return { ok: true, id: 'out' + out.textos.length, error: '' }; },
    enviarPdf: async (_b: Uint8Array, nome: string, leg: string) => { out.pdfs.push({ nome, leg }); return { ok: true, id: 'pdf1', error: '' }; },
    pdfCfg: { url: 'x', user: 'u', pass: 'p' },
    avisarDono: async (a: any[]) => { out.avisos.push(...a); },
    esperar: async () => {},
    deps: {
      ler: async (prompt: string) => { out.prompt = prompt; return structuredClone(pedidoLido); },
      montar: async () => r,
      gravar: async () => { out.gravou++; return { pedido: { id: 'p1', numero_pedido: 'ORC-9', cliente_id: 'cl1', total: 791, itens: [], subtotal: 341, frete: 450, data_pedido: '2026-11-03' }, divergencias: [] }; },
      pdf: async (html: string) => { out.html = html; return new Uint8Array([37, 80, 68, 70]); }
    }
  };
  return { ctx, out, t };
}

Deno.test('fluxo: lista + CNPJ claros → orçamento em PDF ao cliente, card para Orçamento, registro ao dono', async () => {
  const { ctx, out, t } = cenario(['10 anilhas vazadas pintadas de 25kg', '05594733000115'],
    { acao: 'orcamento', cliente: { cpf_cnpj: '05594733000115' }, itens: [item('anilha vazada pintada 25kg', 10)], pergunta: '', endereco: '' }, rOk());
  const res = await atenderLead(ctx);
  ok(res.motivo === 'orcamento_pdf', 'mandou PDF: ' + res.motivo);
  ok(out.pdfs.length === 1 && out.pdfs[0].nome === 'Orçamento ORC-9.pdf' && out.pdfs[0].leg.startsWith('Carlos, segue'), 'PDF com legenda');
  ok(out.prompt.includes('10 anilhas vazadas') && out.prompt.includes('quero a tabela'), 'leu as mensagens do cliente, incluindo a 1ª');
  ok(!out.html.includes('Telefone da Receita'), 'PDF sem observação interna do cadastro');
  ok(t.CRMMensagem.some((m) => m.origem === 'sistema' && String(m.conteudo).startsWith('[PDF orçamento: ORC-9]')), 'registrado na conversa');
  ok(out.avisos.length === 0 && t.CRMAlerta.some((a) => a.gravidade === 'info' && a.chave === 'orcamento_enviado:p1'), 'dono vê no painel, sem urgência');
  ok(t.CRMConversa[0].cliente_id === 'cl1', 'conversa ligada ao cliente');
});

Deno.test('fluxo: item fora do catálogo → nada de preço ao cliente; dono avisado na hora', async () => {
  const { ctx, out, t } = cenario(['quero 1 esteira e 2 anilhas 25kg', 'cnpj 05594733000115'],
    { acao: 'orcamento', cliente: { cpf_cnpj: '05594733000115' }, itens: [item('esteira', 1), item()], pergunta: '', endereco: '' }, { ...rOk(), nao_cotados: ['esteira'] });
  const res = await atenderLead(ctx);
  ok(res.motivo === 'escalou' && out.gravou === 0 && out.pdfs.length === 0, 'não gravou nem mandou orçamento');
  ok(out.avisos.length === 1 && out.avisos[0].gravidade === 'grave' && out.avisos[0].detalhe.includes('esteira'), 'dono avisado com o motivo');
  ok(out.textos.length === 1 && out.textos[0] === MSG_CONFERINDO, 'cliente recebe só "estou conferindo"');
  ok(t.CRMAlerta.length === 1, 'um alerta');
});

Deno.test('fluxo: lista sem CNPJ pede dados uma vez só; CNPJ sem lista pede a lista', async () => {
  const a = cenario(['10 anilhas 25kg'], { acao: 'orcamento', cliente: {}, itens: [item('anilha 25kg', 10)], pergunta: '', endereco: '' }, rOk());
  await atenderLead(a.ctx);
  ok(a.out.textos[0] === MSG_PEDIR_DADOS, 'pediu CNPJ ou dados de PF');
  a.ctx.messageId = 'w1';
  await atenderLead(a.ctx);
  ok(a.out.textos.length === 1, 'não repete o pedido');
  const b = cenario(['05594733000115'], { acao: 'orcamento', cliente: { cpf_cnpj: '05594733000115' }, itens: [], pergunta: '', endereco: '' }, rOk());
  await atenderLead(b.ctx);
  ok(b.out.textos[0] === MSG_PEDIR_LISTA, 'pediu a lista');
});

Deno.test('travas: conversa pessoal, mensagem que não é a mais nova, humano no meio, etapa já orçada', async () => {
  const p = cenario(['oi'], { acao: 'consulta', cliente: {}, itens: [] }, rOk());
  p.t.CRMMensagem.splice(1, 1); // sem boas-vindas = pessoal
  ok((await atenderLead(p.ctx)).motivo === 'nao_lead', 'pessoal');
  const v = cenario(['a', 'b'], { acao: 'consulta', cliente: {}, itens: [] }, rOk());
  v.ctx.messageId = 'w1';
  ok((await atenderLead(v.ctx)).motivo === 'mais_nova', 'só a mais nova segue');
  const h = cenario(['10 anilhas'], { acao: 'orcamento', cliente: {}, itens: [item()] }, rOk());
  h.t.CRMMensagem.push({ id: 'h', conversa_id: 'c1', direcao: 'enviada', origem: 'waha', conteudo: 'Carlos, já te mando o orçamento', created_date: new Date(Date.now() - 1000).toISOString().replace('Z', '') });
  ok((await atenderLead(h.ctx)).motivo === 'humano', 'humano assumiu');
  const e = cenario(['10 anilhas'], { acao: 'orcamento', cliente: {}, itens: [item()] }, rOk());
  e.ctx.conversa.etapa = 'orcamento';
  ok((await atenderLead(e.ctx)).motivo === 'etapa', 'já em orçamento: humano conduz');
});
