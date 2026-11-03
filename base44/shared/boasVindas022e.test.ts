// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/boasVindas022e.test.ts
// Item 022e: resposta automática ao lead novo, Orçamento → Negociação, venda → Ganho.
import { textoBoasVindas, deveMandarBoasVindas } from './conversaWaha.ts';
import { etapaDepoisDaResposta, moverLeadParaGanho } from './funilCrm.js';
import { base64 } from './tabelaAtacado.ts';
import { htmlSuaTabela } from './tabelaPdf.ts';
import { itensDaRevenda } from './tabelaPdfHtml.js';

function ok(c: boolean, m: string) { if (!c) throw new Error('falhou: ' + m); }

Deno.test('boas-vindas: só conversa nova, mensagem do cliente, sem cadastro, chave ligada', () => {
  ok(deveMandarBoasVindas({ _nova: true, cliente_id: '' }, false, ''), 'lead novo recebe');
  ok(!deveMandarBoasVindas({ _nova: true }, true, ''), 'mensagem do dono não dispara');
  ok(!deveMandarBoasVindas({ cliente_id: '' }, false, ''), 'conversa antiga não recebe de novo');
  ok(!deveMandarBoasVindas({ _nova: true, cliente_id: 'c1' }, false, ''), 'cliente já cadastrado não recebe');
  ok(!deveMandarBoasVindas({ _nova: true }, false, 'OFF'), 'CRM_BOAS_VINDAS=off desliga');
  ok(!deveMandarBoasVindas(null, false, ''), 'sem conversa não dispara');
});

Deno.test('boas-vindas: texto com primeiro nome, link da tabela e pedido de lista + CNPJ', () => {
  const t = textoBoasVindas('MuscularFit', 'Carlos Silva', 'https://app.placefit.com.br/PublicTable?supplier=x');
  ok(t.startsWith('Olá, Carlos!'), 'saudação com primeiro nome');
  ok(t.includes('https://app.placefit.com.br/PublicTable?supplier=x'), 'link da tabela');
  ok(t.includes('CNPJ') && t.includes('quantidades'), 'pede lista e CNPJ');
  ok(!/base44/i.test(t), 'nunca link base44');
  ok(textoBoasVindas('', '', 'L').startsWith('Olá! Aqui é da MuscularFit'), 'sem nome nem empresa');
});

Deno.test('negociação: só sai de Orçamento', () => {
  ok(etapaDepoisDaResposta('orcamento') === 'negociacao', 'orcamento → negociacao');
  for (const e of ['novo', 'atendimento', 'negociacao', 'ganho', 'perdido', '', undefined]) ok(etapaDepoisDaResposta(e as any) === '', 'não mexe em ' + e);
});

Deno.test('ganho: venda leva a conversa do cliente para Ganho', async () => {
  const rows = [
    { id: 'a', owner_id: 'o', cliente_id: 'c1', telefone: '5531972070371', etapa: 'negociacao', ativo: true },
    { id: 'b', owner_id: 'o', cliente_id: 'c2', telefone: '5531900000000', etapa: 'orcamento', ativo: true }
  ];
  const entities = { CRMConversa: {
    async filter(q: any) { return rows.filter((r: any) => Object.entries(q).every(([k, v]) => typeof v === 'object' && v && '$regex' in (v as any) ? new RegExp((v as any).$regex).test(String(r[k] ?? '')) : (r[k] ?? '') === v)).map((r) => ({ ...r })); },
    async update(id: string, p: any) { Object.assign(rows.find((r) => r.id === id)!, p); }
  } };
  await moverLeadParaGanho(entities, 'o', { id: 'c1', telefone: '5531972070371' });
  ok(rows[0].etapa === 'ganho', 'cliente da venda em ganho');
  ok(rows[1].etapa === 'orcamento', 'outro cliente intacto');
  await moverLeadParaGanho(entities, 'o', null);
});

Deno.test('022f: legenda do PDF sem link; plano B com link', () => {
  const leg = textoBoasVindas('MuscularFit', 'Ana', '');
  ok(leg.includes('Segue em anexo') && !leg.includes('http'), 'legenda sem link');
  ok(textoBoasVindas('MuscularFit', 'Ana', 'https://app.placefit.com.br/x').includes('https://app.placefit.com.br/x'), 'plano B com link');
});

Deno.test('022f: HTML do PDF é o da Sua Tabela (logo, contatos, agrupamento por peso, sem preço de fábrica)', () => {
  const produtos = [
    { id: 't1', nome: 'Anilha Vazada Pintado 1kg', cod: 'AVP1', categoria: 'Anilhas', und: 'peça', peso_kg: 1, foto: 'https://x/f.png' },
    { id: 't2', nome: 'Anilha Vazada Pintado 2kg', cod: 'AVP2', categoria: 'Anilhas', und: 'peça', peso_kg: 2, foto: '' },
    { id: 't3', nome: 'Step EVA', cod: 'ACE-N031', categoria: 'Acessórios', und: 'peça' }
  ];
  const sps = [
    { product_id: 't1', preco: 5, margem: 20 }, { product_id: 't2', preco: 10, margem: 20 },
    { product_id: 't3', preco: 100, margem: 0, sale_price: 134.6 }, { product_id: 'x', preco: 0 }
  ];
  const itens = itensDaRevenda(produtos, sps);
  ok(itens.length === 2, 'agrupa os pesos numa linha só');
  const html = htmlSuaTabela({ empresa: 'MuscularFit', whatsapp: '37 99914-7206', endereco: 'Rua A, Cláudio/MG', logomarca: 'https://x/logo.png' }, itens);
  ok(html.includes('MuscularFit') && html.includes('Rua A, Cláudio/MG') && html.includes('https://x/logo.png'), 'cabeçalho com logo e endereço');
  ok(html.includes('R$ 6.00/kg') && html.includes('R$ 134.60'), 'preço final (margem / promocional)');
  ok(html.includes('window.__pronto') && html.includes('var(--pf-primary'), 'cores da logo calculadas na impressão');
  ok(!html.includes('preco_fabricante') && !/R\$ 5\.00\b/.test(html), 'sem preço de fábrica');
  ok(base64(new Uint8Array([1, 2, 3])) === 'AQID', 'base64');
});

Deno.test('022g: prévia do link com o nome da empresa, em português, sem dado interno', async () => {
  const { htmlPreviaTabela, linkDaTabela } = await import('./linkTabela.ts');
  ok(linkDaTabela('https://app.placefit.com.br/', 'abc') === 'https://app.placefit.com.br/functions/tabela?supplier=abc', 'link no domínio do app');
  const h = htmlPreviaTabela('https://app.placefit.com.br', 'abc', { empresa: 'MuscularFit', cidade: 'Cláudio', estado: 'MG' });
  ok(h.includes('<meta property="og:title" content="MuscularFit — Tabela de atacado">'), 'título com a empresa');
  ok(h.includes('Cláudio/MG') && !/Public Table/i.test(h), 'português');
  ok(h.includes('/PublicTable?supplier=abc') && !/base44\.app/.test(h), 'vai para a tabela no domínio do app');
  const x = htmlPreviaTabela('https://app.placefit.com.br', 'abc', { empresa: '<script>"' });
  ok(!x.includes('<script>"') , 'escapa o nome');
  ok(htmlPreviaTabela('https://app.placefit.com.br', 'zzz', null).includes('url=https://app.placefit.com.br"'), 'id inválido vai para o início');
});
