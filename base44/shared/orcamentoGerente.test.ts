// Rodar a partir da raiz do app:  deno test -A base44/shared/orcamentoGerente.test.ts
// Fluxo completo do orçamento do gerente contra um banco em memória; a IA (interpretador)
// e a BrasilAPI são simuladas. Nada toca o banco real nem a internet.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { tratarOrcamentoGerente } from './orcamentoGerente.ts';

const TENANT = 't1';
type Rec = Record<string, any>;
function criarBase(respostasIA: Rec[]) {
  const tabelas: Record<string, Rec[]> = {
    Cliente: [], ClienteFiscal: [], Pedido: [], CRMConversa: [{ id: 'conv1' }],
    TabelaFrete: [
      { id: 'f1', estado: 'MG', valor_minimo: 450, peso_limite: 500, preco_kg_capital: 1.2, preco_kg_interior: 1.3, ativo: true },
      { id: 'f3', estado: 'RJ', valor_minimo: 550, peso_limite: 500, preco_kg_capital: 1.3, preco_kg_interior: 1.5, ativo: true },
      { id: 'f2', estado: 'AM', valor_minimo: 950, peso_limite: 500, preco_kg_capital: 3.4, preco_kg_interior: 3.8, ativo: true }
    ],
    ProductTemplate: [], SupplierProduct: []
  };
  let n = 0;
  const produto = (nome: string, cod: string, peso: number | null, und: string, preco: number) => {
    const id = 'pt' + (++n);
    tabelas.ProductTemplate.push({ id, nome, cod, peso_kg: peso, und, ativo: true });
    tabelas.SupplierProduct.push({ id: 'sp' + n, supplier_id: TENANT, product_id: id, preco, margem: 0, disponivel: true, preco_fabricante: 1 });
  };
  produto('Kit Halter Sextavado Injetado 1 a 10kg + Suporte', 'KHSI110S', 110, 'kit', 1890);
  produto('Kit Halter Sextavado Injetado Pegada Inox 1 A 10 kg (10 Pares)', 'AF-098', null, 'kit', 2100);
  produto('Suporte Dumbbell Sextavado para 10 Pares', 'SUP-056', null, 'peça', 600);
  for (let p = 10; p <= 30; p += 2) produto(`Dumbbell Montado Anilha Vazada Injetado Pegada Injetada ${p}kg`, `DMOAVIIN${p}`, p, 'par', p * 20);

  const casa = (r: Rec, q: Rec) => Object.entries(q).every(([k, v]) =>
    v && typeof v === 'object' && '$in' in v ? (v as any).$in.includes(r[k]) : r[k] === v);
  const entidade = (nome: string) => ({
    filter: async (q: Rec, _s?: string, limite = 50, skip = 0) => tabelas[nome].filter((r) => casa(r, q)).slice(skip, skip + limite),
    create: async (d: Rec) => { const r = { id: nome + (tabelas[nome].length + 1), created_date: new Date().toISOString(), ...d }; tabelas[nome].push(r); return r; },
    update: async (id: string, d: Rec) => { const r = tabelas[nome].find((x) => x.id === id); Object.assign(r!, d); return r; }
  });
  const fila = [...respostasIA];
  const base44 = {
    asServiceRole: {
      entities: new Proxy({}, { get: (_t, nome: string) => entidade(nome) }),
      integrations: { Core: { InvokeLLM: async () => fila.shift() } }
    }
  };
  return { base44, tabelas };
}

globalThis.fetch = (async (url: string) => {
  if (String(url).includes('/cnpj/v1/51969252000164')) {
    return new Response(JSON.stringify({ razao_social: 'CLINICA DE FISIOTERAPIA E LONGEVIDADE RENATO CARAN LTDA', nome_fantasia: 'CLINICA RENATO CARAN', logradouro: 'VIRGINIA', descricao_tipo_de_logradouro: 'RUA', numero: '438', bairro: 'CARLOS PRATES', municipio: 'BELO HORIZONTE', uf: 'MG', cep: '30710290' }));
  }
  return new Response('{}', { status: 404 });
}) as any;

const pedido15_10 = {
  acao: 'orcamento',
  cliente: { cpf_cnpj: '51969252000164', nome: '', cidade: '', estado: '', telefone: '', cep: '' },
  cep_entrega: '',
  itens: [
    { descricao: 'kit halter sextavado injetado 1 a 10', quantidade: 1, quantidade_informada: true, unidade_pedida: '' },
    { descricao: 'dumbbell montado anilha injetada 12 a 20 kg', quantidade: 1, quantidade_informada: false, unidade_pedida: '' },
    { descricao: 'suporte para 10 pares', quantidade: 1, quantidade_informada: true, unidade_pedida: '' }
  ],
  frete_informado: -1
};
const TEXTO = 'Criar orçamento para 51969252000164 com um kit de halter sextavado injetado de 1 a 10 e Dumbbell montado anilha injetada de 12 a 20kg mais suporte para 10 pares';

Deno.test('pedido de 15/10: cadastra pelo CNPJ, compõe, frete da tabela, grava uma vez e confere', async () => {
  const { base44, tabelas } = criarBase([pedido15_10, { ...pedido15_10, frete_informado: 300 }]);
  const conversa = tabelas.CRMConversa[0];
  const r = await tratarOrcamentoGerente(base44, TENANT, conversa, TEXTO, '');
  assert(r.tratou && r.gravou, r.resposta);
  if (Deno.env.get('MOSTRAR')) console.log(r.resposta);

  // Cliente: criado com os dados públicos, sem pergunta
  assertEquals(tabelas.Cliente.length, 1);
  const c = tabelas.Cliente[0];
  assertEquals([c.nome, c.cidade, c.estado, c.cep], ['CLINICA DE FISIOTERAPIA E LONGEVIDADE RENATO CARAN LTDA', 'BELO HORIZONTE', 'MG', '30710-290']);
  assertEquals(c.endereco, 'RUA VIRGINIA, 438 - CARLOS PRATES');

  // Orçamento: KHSI110S + 5 pares, sem SUP-056; frete piso MG (190 kg); pendente
  assertEquals(tabelas.Pedido.length, 1);
  const p = tabelas.Pedido[0];
  assertEquals(p.itens.map((i: any) => i.cod), ['KHSI110S', 'DMOAVIIN12', 'DMOAVIIN14', 'DMOAVIIN16', 'DMOAVIIN18', 'DMOAVIIN20']);
  assertEquals([p.subtotal, p.frete, p.total, p.status, p.tipo], [3490, 450, 3940, 'pendente', 'orcamento']);
  assert(/^ORC-\d+$/.test(p.numero_pedido));
  assert(p.observacoes.includes('Composição: Dumbbell Montado Anilha Vazada Injetado Pegada Injetada 12 a 20 kg = 12/14/16/18/20 kg'), p.observacoes);
  assert(p.observacoes.includes('incluso no KHSI110S'));

  // Resposta no modelo 5.6, link só no domínio PlaceFit, nunca preço de fábrica
  assert(r.resposta.startsWith(`Orçamento ${p.numero_pedido} gravado (pendente). Nada enviado ao cliente.`), r.resposta);
  assert(r.resposta.includes(`https://app.placefit.com.br/Orcamentos?abrir=${p.id}`));
  assert(!/base44/i.test(r.resposta));
  assert(r.resposta.includes('Total: R$ 3.940,00'), r.resposta);
  assert(!r.resposta.includes('Falta só'));
  assert(!r.resposta.includes('Conferência'), r.resposta);

  // Ajuste depois de gravado: atualiza o MESMO orçamento, não cria outro nem duplica cliente
  const r2 = await tratarOrcamentoGerente(base44, TENANT, conversa, 'o frete é 300', '');
  assert(r2.resposta.includes('atualizado'), r2.resposta);
  assertEquals(tabelas.Pedido.length, 1);
  assertEquals(tabelas.Cliente.length, 1);
  assertEquals([tabelas.Pedido[0].frete, tabelas.Pedido[0].total], [300, 3790]);
});

Deno.test('falta dado: pergunta numerada com opção sugerida e NÃO grava', async () => {
  const pedido = { ...pedido15_10, itens: [{ descricao: 'kit halter sextavado injetado 1 a 10', quantidade: 1, quantidade_informada: true, unidade_pedida: '' }] };
  const { base44, tabelas } = criarBase([pedido]);
  const r = await tratarOrcamentoGerente(base44, TENANT, tabelas.CRMConversa[0], 'orçamento pro 51969252000164 de um kit de halter sextavado injetado 1 a 10', '');
  assert(!r.gravou);
  assertEquals(tabelas.Pedido.length, 0);
  assert(r.resposta.includes('Falta só (responde tipo "1. Sim 2. Sim"):\n1. '), r.resposta);
  assert(r.resposta.includes('Usar "'));
});

Deno.test('frete >= 50% da mercadoria sai com observação explicativa', async () => {
  const pedido = {
    acao: 'orcamento', cliente: { cpf_cnpj: '', nome: 'Academia Manaus', cidade: 'Manaus', estado: 'AM', telefone: '', cep: '' }, cep_entrega: '',
    itens: [{ descricao: 'suporte dumbbell sextavado para 10 pares', quantidade: 1, quantidade_informada: true, unidade_pedida: '' }], frete_informado: -1
  };
  const { base44, tabelas } = criarBase([pedido]);
  const r = await tratarOrcamentoGerente(base44, TENANT, tabelas.CRMConversa[0], 'orçamento pra Academia Manaus de 1 suporte dumbbell sextavado para 10 pares', '');
  assert(r.gravou, r.resposta);
  assertEquals(tabelas.Pedido[0].frete, 950);
  assert(tabelas.Pedido[0].observacoes.includes('Frete ≥ 50% da mercadoria'), tabelas.Pedido[0].observacoes);
  assert(r.resposta.includes('Frete ≥ 50%'));
});

Deno.test('consulta (não é orçamento) cai no fluxo normal sem gravar', async () => {
  const { base44, tabelas } = criarBase([{ acao: 'consulta', cliente: {}, cep_entrega: '', itens: [], frete_informado: -1 }]);
  const r = await tratarOrcamentoGerente(base44, TENANT, tabelas.CRMConversa[0], 'quantos leads chegaram hoje?', '');
  assertEquals(r.tratou, false);
  assertEquals(tabelas.Pedido.length, 0);
});

Deno.test('B1: código de produto no campo de documento nunca vira pergunta de CPF/CNPJ', async () => {
  const pedido = {
    acao: 'orcamento', cliente: { cpf_cnpj: 'ANI-N062', nome: 'Letelba Ferreira Neto', cidade: 'Rio de Janeiro', estado: 'RJ', telefone: '', cep: '22050002' }, cep_entrega: '',
    itens: [{ descricao: 'suporte dumbbell sextavado para 10 pares', quantidade: 1, quantidade_informada: true, unidade_pedida: '' }], frete_informado: -1
  };
  const { base44, tabelas } = criarBase([pedido]);
  const r = await tratarOrcamentoGerente(base44, TENANT, tabelas.CRMConversa[0], 'Letelba Ferreira Neto\n22050002\nANI-N062', '');
  assert(!/CPF\/CNPJ/.test(r.resposta), r.resposta);
  assert(r.gravou, r.resposta);
  assertEquals(tabelas.Cliente[0].cpf_cnpj, '');
  assertEquals(tabelas.Pedido[0].frete, 550);
});
