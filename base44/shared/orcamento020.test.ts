// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/orcamento020.test.ts
// Item 020 (28/10): licitação de Manaus (Anexo A da fila) contra um banco em memória. Catálogo com os
// nomes e preços reais do ORC-1793232459580 (Mari) e os concorrentes que confundiram o gerente
// (suporte de kettlebell, SUP-005 p/ 200 kg, barra maciça 2,2 m, barra 1,62 m). A IA é simulada com a
// ficha que o interpretador deve devolver; nada toca o banco real.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { tratarOrcamentoGerente } from './orcamentoGerente.ts';
import { comporPedido } from './composicaoOrcamento.ts';
import { normalizar, pesoPeloNome, type ItemCatalogo } from './catalogoRespondedor.ts';

const TENANT = 't1';
type Rec = Record<string, any>;
const PRODUTOS: [string, string, number | null, number][] = [];
const p = (nome: string, cod: string, peso: number | null, preco: number) => PRODUTOS.push([nome, cod, peso, preco]);

for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) p(`Halter Sextavado Emborrachado ${k}kg`, `HSEE${k}`, k, Math.round(k * 9.55 * 100) / 100);
for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) p(`Halter Sextavado Pintado ${k}kg`, `HSPP${k}`, k, k * 8);
const dmoaser: Record<number, number> = { 10: 125.2, 12: 150.24, 14: 175.28, 16: 200.32, 18: 225.36, 20: 250.4, 22: 275.44 };
for (const [k, v] of Object.entries(dmoaser)) p(`Dumbbell Montado Anilha Sport Emborrachado Pegada Recartilhada ${k}kg`, `DMOASER${k}`, Number(k), v);
for (const k of [12, 14, 16, 18, 20]) p(`Dumbbell Montado Anilha Vazada Emborrachado Pegada Emborrachada ${k}kg`, `DMOAVEEB${k}`, k, k * 15.87);
for (const k of [12, 14, 16, 18, 20]) p(`Dumbbell Montado Anilha Vazada Pintado Pegada Recartilhada ${k}kg`, `DMOAVPR${k}`, k, k * 10);
const aspo: Record<number, number> = { 5: 46.7, 10: 93.4, 15: 140.1, 20: 186.8, 25: 233.5 };
for (const [k, v] of Object.entries(aspo)) p(`Anilha Sport Pintado Olímpica ${k}kg`, `ASPO${k}`, Number(k), v);
for (const k of [5, 10, 15, 20, 25]) p(`Anilha Sport Pintado ${k}kg`, `ASP${k}`, k, k * 8);
for (const k of [5, 10, 15, 20, 25]) p(`Anilha Vazada Injetado Olímpica ${k}kg`, `AVIO${k}`, k, k * 9);
for (const k of [5, 10, 15, 20]) p(`Anilha Bumper Olímpica ${k}kg`, `ABO${k}`, k, k * 20);
const kp: Record<number, number> = { 4: 31.24, 6: 46.86, 8: 62.48, 10: 78.1, 12: 93.72, 14: 109.34, 16: 124.96, 18: 140.58, 20: 156.2, 24: 187.44 };
for (const [k, v] of Object.entries(kp)) p(`Kettlebell Pintado ${k}kg`, `KP${k}`, Number(k), v);
for (const k of [4, 6, 8, 10, 12, 14, 16, 18, 20]) p(`Kettlebell Sem acabamento ${k}kg`, `KBR${k}`, k, k * 6);
for (const k of [6, 8, 10, 12, 16, 20]) p(`Kettlebell Emborrachado ${k}kg`, `KE${k}`, k, k * 11);
// Barras: peso só no nome da BAR-042 (testa o peso pelo nome no frete); W sem peso
p('Barra Olímpica 20kg 2.2m 4 Rolamentos Cromada', 'BAR-042', null, 1055.57);
p('Barra Olímpica 40lbs 2.2m 4 Rolamentos Cromada', 'BAR-062', 40, 1000);
p('Barra Olímpica 20kg 2.2m 4 Rolamentos Zinco Preto', 'BAR-046', 20, 900);
p('Barra Maciça Cromada Recartilhada Reta 2,2m c/ Presilha Espiral', 'BAR-008', null, 345.5);
p('Barra Olímpica 20lbs 1.62m 4 Rolamentos Zinco Extra', 'BAR-074', 20, 438.34);
p('Barra Olímpica "W" Cromada c/ Rolamento', 'BAR-060', null, 472.85);
p('Barra Olímpica "H" Cromada c/ Rolamento', 'BAR-061', null, 480);
// Suportes
p('Suporte Dumbbell Sextavado para 10 Pares', 'SUP-056', null, 1054);
p('Suporte Halter Torre 3" 10 Pares', 'SUP-018', null, 495.55);
p('Suporte Halter 5 Pares', 'SUP-017', null, 300);
p('Suporte Kettlebell', 'SUP-028', null, 250);
p('Suporte Anilha "T" + 8 Barras p/ 200kg', 'SUP-005', null, 484.62);
p('Suporte 3x1 (Anilha, Barra e Halter)', 'SUP-033', null, 558);
p('Suporte 3 em 1 (Anilha - Halter - Barra)', 'AF-068', null, 700);
p('Suporte para Anilhas 500kg', 'SUP-035', null, 900);
// Acessórios que NÃO podem virar linha
p('Puxador Tríceps "V" - Preto', 'PUX-N012', null, 124.2);
p('Presilha Lock Press - Para Barras Olímpicas', 'BAR-N021', null, 71.73);

function criarBase(respostasIA: Rec[]) {
  const tabelas: Record<string, Rec[]> = {
    Cliente: [{ id: 'cli1', fornecedor_id: TENANT, nome: 'M F PEREIRA DA SILVA', cpf_cnpj: '52481604000109', endereco: 'RUA X, 1', cidade: 'MANAUS', estado: 'AM', cep: '69067-370', telefone: '' }],
    ClienteFiscal: [], Pedido: [], CRMConversa: [{ id: 'conv1' }],
    TabelaFrete: [{ id: 'f2', estado: 'AM', valor_minimo: 950, peso_limite: 500, preco_kg_capital: 3.4, preco_kg_interior: 3.8, ativo: true }],
    ProductTemplate: [], SupplierProduct: []
  };
  PRODUTOS.forEach(([nome, cod, peso, preco], n) => {
    tabelas.ProductTemplate.push({ id: 'pt' + n, nome, cod, peso_kg: peso, und: 'peça', ativo: true });
    tabelas.SupplierProduct.push({ id: 'sp' + n, supplier_id: TENANT, product_id: 'pt' + n, preco, margem: 0, disponivel: true, preco_fabricante: 1 });
  });
  const casa = (r: Rec, q: Rec) => Object.entries(q).every(([k, v]) =>
    v && typeof v === 'object' && '$in' in v ? (v as any).$in.includes(r[k]) : r[k] === v);
  const entidade = (nome: string) => ({
    filter: async (q: Rec, _s?: string, limite = 50, skip = 0) => tabelas[nome].filter((r) => casa(r, q)).slice(skip, skip + limite),
    create: async (d: Rec) => { const r = { id: nome + (tabelas[nome].length + 1), ...d }; tabelas[nome].push(r); return r; },
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
globalThis.fetch = (async () => new Response('{}', { status: 404 })) as any;

const vazia = { pesos_kg: [], por_par: false, composicao: [], comprimento_m: 0, capacidade_kg: 0, capacidade_pares: 0, capacidade_barras: 0, armazena: [], requisitos: [], preferencias: [] };
const it = (descricao: string, tipo: string, quantidade: number, ficha: Rec = {}) =>
  ({ descricao, quantidade, quantidade_informada: true, unidade_pedida: 'un', tipo, ...vazia, ...ficha });

// Ficha esperada do interpretador para o Anexo A (23 itens)
const LICITACAO = {
  acao: 'orcamento',
  cliente: { cpf_cnpj: '52.481.604/0001-09', nome: '', cidade: '', estado: '', telefone: '', cep: '' },
  cep_entrega: '',
  itens: [
    it('Abdutora e adutora conjugada', 'abdutora', 1),
    it('Extensora e flexora conjugada', 'extensora', 1),
    it('Leg press 45 graus', 'leg press', 1),
    it('Estação multifuncional tipo Cross Smith', 'estacao multifuncional', 1),
    it('Puxada alta e remada baixa conjugada', 'puxada', 1),
    it('Chest press e shoulder press conjugados', 'chest press', 1),
    it('Banco ajustável', 'banco', 2),
    it('Banco reto', 'banco', 1),
    it('Conjunto de halteres 10 pares de 2 a 20 kg', 'halter', 1, { pesos_kg: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20], por_par: true, preferencias: ['emborrachado', 'pvc'] }),
    it('Suporte para halteres (20 halteres)', 'suporte', 1, { armazena: ['halter'], capacidade_pares: 10 }),
    it('Barra olímpica reta de 2,20 m', 'barra', 2, { requisitos: ['olimpica', 'reta'], comprimento_m: 2.2 }),
    it('Barra olímpica curva tipo W ou EZ', 'barra', 1, { requisitos: ['olimpica', 'w|ez'], preferencias: ['cromado'] }),
    it('Conjunto de anilhas olímpicas com 220 kg', 'anilha', 1, { requisitos: ['olimpica'], preferencias: ['pintado', 'emborrachado'], composicao: [{ quantidade: 4, peso_kg: 5 }, { quantidade: 6, peso_kg: 10 }, { quantidade: 4, peso_kg: 15 }, { quantidade: 4, peso_kg: 20 }] }),
    it('Conjunto de kettlebells', 'kettlebell', 1, { pesos_kg: [6, 8, 10, 12, 16, 20], preferencias: ['pintado', 'revestido'] }),
    it('Suporte para barras e anilhas', 'suporte', 1, { armazena: ['barra', 'anilha'], capacidade_kg: 220, capacidade_barras: 4 }),
    it('Esteira ergométrica', 'esteira', 2),
    it('Bicicleta ergométrica vertical', 'bicicleta', 1),
    it('Elíptico', 'eliptico', 1),
    it('Bicicleta de ciclismo indoor', 'bicicleta', 1),
    it('Eletroestimulador multicanal', 'eletroestimulador', 1),
    it('Ultrassom terapêutico', 'ultrassom', 1),
    it('Equipamento de fotobiomodulação Laser e LED', 'fotobiomodulacao', 1),
    it('Equipamento para ondas de choque radial', 'ondas de choque', 1)
  ],
  frete_informado: -1
};
const TEXTO = 'Abdutora e adutora conjugada ... Conjunto de halteres 10 pares nos pesos de 2, 4, 6, 8, 10, 12, 14, 16, 18 e 20 kg ' +
  'Suporte para halteres Barra olímpica reta de 2,20 m Barra olímpica curva tipo W ou EZ Conjunto de anilhas olímpicas com 220 kg ' +
  'Conjunto de kettlebells Suporte para barras e anilhas Esteira ergométrica Bicicleta ergométrica vertical Elíptico ' +
  'Bicicleta de ciclismo indoor Eletroestimulador multicanal Ultrassom terapêutico Equipamento de fotobiomodulação Laser e LED ' +
  'Equipamento para ondas de choque radial Leg press 45 graus Estação multifuncional tipo Cross Smith Puxada alta e remada baixa ' +
  'Extensora e flexora conjugada Chest press e shoulder press conjugados Banco ajustável Banco reto 52.481.604/0001-09';

Deno.test('020 (a): licitação de Manaus no padrão do ORC-1793232459580', async () => {
  const { base44, tabelas } = criarBase([LICITACAO]);
  const r = await tratarOrcamentoGerente(base44, TENANT, tabelas.CRMConversa[0], TEXTO, '');
  if (Deno.env.get('MOSTRAR')) console.log(r.resposta);
  assert(r.gravou, r.resposta);
  const ped = tabelas.Pedido[0];
  const linhas = Object.fromEntries(ped.itens.map((i: any) => [i.cod, i.quantidade]));

  // Halteres: 10 pares = 20 unidades; 2–10 kg sextavado emborrachado, 12–20 kg dumbbell emborrachado
  for (const k of [2, 4, 6, 8, 10]) assertEquals(linhas[`HSEE${k}`], 2, `HSEE${k}`);
  for (const k of [12, 14, 16, 18, 20]) assertEquals(linhas[`DMOASER${k}`], 2, `DMOASER${k}`);
  // Suporte de halteres para 10 pares (nunca suporte de kettlebell)
  const supHalter = ped.itens.filter((i: any) => ['SUP-056', 'SUP-018'].includes(i.cod));
  assertEquals(supHalter.length, 1);
  // 2 barras olímpicas 2,2 m cromadas 4 rolamentos 20 kg; W olímpica; nunca maciça nem 1,62 m
  assertEquals(linhas['BAR-042'], 2);
  assertEquals(linhas['BAR-060'], 1);
  for (const cod of ['BAR-008', 'BAR-074', 'SUP-028', 'SUP-005', 'PUX-N012', 'BAR-N021']) assert(!(cod in linhas), cod + ' não pode entrar');
  // Anilhas 220 kg: 4x5 + 6x10 + 4x15 + 4x20, olímpicas
  assertEquals([linhas.ASPO5, linhas.ASPO10, linhas.ASPO15, linhas.ASPO20], [4, 6, 4, 4]);
  // Kettlebells 6/8/10/12/16/20, 1 de cada, pintados
  for (const k of [6, 8, 10, 12, 16, 20]) assertEquals(linhas[`KP${k}`], 1, `KP${k}`);
  // Suporte de barras e anilhas: capacidade não confirmada no cadastro → ressalva; SUP-005 (200 kg) fora
  assertEquals(linhas['SUP-033'], 1);
  assert(ped.observacoes.includes('SUP-005 (200 kg) fica fora'), ped.observacoes);
  assert(ped.observacoes.includes('confirmar com o fabricante'), ped.observacoes);

  // Peso total real 552 kg (BAR-042 pelo nome) → frete AM capital 552 × 3,40
  assert(ped.observacoes.includes('Peso pelo nome do produto (sem peso cadastrado): BAR-042 20 kg'), ped.observacoes);
  assert(ped.observacoes.includes('BAR-060'), 'barra W sem peso tem que ser sinalizada');
  assertEquals(ped.frete, 1876.8);
  assert(r.resposta.includes('552 kg'), r.resposta);

  // Subtotal e total refeitos a partir das linhas
  const soma = Math.round(ped.itens.reduce((s: number, i: any) => s + i.preco_unitario * i.quantidade, 0) * 100) / 100;
  assertEquals(ped.subtotal, soma);
  assertEquals(ped.total, Math.round((soma + 1876.8) * 100) / 100);

  // Itens 1–8, 16–23: não cotados, com motivo, na resposta e nas observações
  for (const d of ['Abdutora', 'Extensora', 'Leg press', 'Cross Smith', 'Puxada alta', 'Chest press', 'Banco ajustável', 'Banco reto',
    'Esteira', 'Bicicleta ergométrica', 'Elíptico', 'ciclismo indoor', 'Eletroestimulador', 'Ultrassom', 'fotobiomodulação', 'ondas de choque']) {
    assert(r.resposta.split('Não cotados')[1]?.includes(d), 'não cotado na resposta: ' + d);
    assert(ped.observacoes.split('Não cotados')[1]?.includes(d), 'não cotado nas observações: ' + d);
  }
  assert(!r.resposta.includes('Falta só'), 'nada para perguntar: ' + r.resposta);
  assert(!r.resposta.includes('quantidade não informada'), r.resposta);
  assert(!/base44/i.test(r.resposta));
});

Deno.test('020: item vazado do histórico (dumbbell 12 a 20 de 15/10) é ignorado e avisado', async () => {
  const comVazado = { ...LICITACAO, itens: [it('Dumbbell montado 12 a 20 kg', 'dumbbell', 1), ...LICITACAO.itens] };
  const { base44, tabelas } = criarBase([comVazado]);
  const historico = ['Dono: Criar orçamento para 51969252000164 com Dumbbell montado anilha injetada de 12 a 20kg',
    'Gerente: Orçamento ORC-1 gravado. Dumbbell Montado Anilha Vazada Emborrachado 12 a 20 kg',
    'Dono: quantos leads hoje?', 'Dono: e o Rodson?', 'Dono: vou mandar uma licitação'].join('\n');
  const r = await tratarOrcamentoGerente(base44, TENANT, tabelas.CRMConversa[0], TEXTO, historico);
  assert(r.resposta.includes('Ignorei "Dumbbell montado 12 a 20 kg"'), r.resposta);
  assertEquals(tabelas.Pedido[0].itens.filter((i: any) => i.cod === 'DMOASER12')[0].quantidade, 2);
});

Deno.test('020: \"kettlebell\" sem ficha pergunta um kettlebell, nunca o suporte', () => {
  let n = 0;
  const cat: ItemCatalogo[] = PRODUTOS.map(([nome, cod, peso, preco]) => ({
    product_id: 'p' + (n++), nome, cod, categoria: '', subcategoria: '', und: 'peça', peso_kg: peso, detalhes: '', preco,
    busca: normalizar(nome + ' ' + cod), chave: normalizar(nome + ' ' + cod)
  }));
  const r = comporPedido(cat, [{ descricao: 'Kettlebell', quantidade: 1, quantidade_informada: false }]);
  assertEquals(r.itens.length, 0);
  assert(/Usar "Kettlebell/.test(r.perguntas[0]), r.perguntas[0]);
  assert(!r.perguntas[0].startsWith('"Kettlebell" tem mais de um produto. Usar "Suporte'), r.perguntas[0]);
});

Deno.test('020: peso pelo nome só quando é peso do produto', () => {
  assertEquals(pesoPeloNome('Barra Olímpica 20kg 2.2m 4 Rolamentos Cromada'), 20);
  assertEquals(pesoPeloNome('Suporte Anilha "T" + 8 Barras p/ 200kg'), null);
  assertEquals(pesoPeloNome('Kit Halter Sextavado Injetado 1 a 10kg + Suporte'), null);
  assertEquals(pesoPeloNome('Anilha Raios Niquel - Cromada -Anel Inox 5 A 25 kg'), null);
  assertEquals(pesoPeloNome('Barra Olímpica "W" Cromada c/ Rolamento'), null);
});
