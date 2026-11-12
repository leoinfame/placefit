// Regras do orçamento do atendente (12/11/2026): furação olímpica única, par não é unidade,
// sanidade de quantidade antes de gravar e nunca negar uma opção já oferecida.
// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/orcamentoRegras.test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { comporPedido, unificarFuracao } from './composicaoOrcamento.ts';
import { sanidadeQuantidades, opcoesOferecidas } from './orcamentoGerente.ts';
import { normalizar, type ItemCatalogo } from './catalogoRespondedor.ts';

let seq = 0;
const item = (nome: string, cod: string, peso: number | null, und: string, preco: number): ItemCatalogo => ({
  product_id: 'p' + (++seq), nome, cod, categoria: '', subcategoria: '', und, peso_kg: peso, detalhes: '', preco,
  busca: normalizar([nome, cod].join(' ')), chave: normalizar([nome, cod].join(' '))
});

const catalogo: ItemCatalogo[] = [
  item('Anilha Sport Pintado 10kg', 'ASP10', 10, 'peça', 80),
  item('Anilha Sport Pintado Olímpica 10kg', 'ASPO10', 10, 'peça', 95),
  item('Anilha Sport Pintado 20kg', 'ASP20', 20, 'peça', 176),
  item('Anilha Sport Pintado Olímpica 20kg', 'ASPO20', 20, 'peça', 190),
  item('Anilha Sport Pintado 5kg', 'ASP5', 5, 'peça', 40),
  item('Barra Olímpica 20kg 2.2m 4 Rolamentos Cromada', 'BAR-042', null, 'peça', 900),
  item('Barra Maciça Cromada Recartilhada Reta 2,2m', 'BAR-008', null, 'peça', 320)
];

Deno.test('regra 2: furo olímpico em uma linha torna todas as anilhas e barras olímpicas', () => {
  const linhas: any[] = [
    { descricao: 'anilha olímpica 20 kg', quantidade: 4, requisitos: ['olimpica'] },
    { descricao: 'anilha 10 kg', quantidade: 6 },
    { descricao: 'barra 1,5 m', quantidade: 1 },
    { descricao: 'barra W', quantidade: 1 },
    { descricao: 'anilha 5 kg furo padrão', quantidade: 2 }
  ];
  const mudadas = unificarFuracao(linhas);
  assertEquals(mudadas, ['anilha 10 kg', 'barra 1,5 m', 'barra W']);
  assert(linhas[1].requisitos.includes('olimpica'));
  assert(linhas[2].requisitos.includes('olimpica'));
  assert(linhas[3].requisitos.includes('olimpica'));
  // furo padrão pedido explicitamente não é trocado
  assertEquals(linhas[4].requisitos, undefined);
  // sem nenhuma olímpica no pedido, nada muda
  assertEquals(unificarFuracao([{ descricao: 'anilha 10 kg', quantidade: 1 }] as any[]), []);
});

Deno.test('regra 2 no orçamento: anilha sem furo entra na versão olímpica, com o peso certo', () => {
  const r = comporPedido(catalogo, [
    { descricao: 'anilha olímpica 20 kg', quantidade: 4, quantidade_informada: true, requisitos: ['olimpica'] },
    { descricao: 'anilha 10 kg', quantidade: 6, quantidade_informada: true }
  ]);
  assertEquals(r.perguntas, []);
  const cods = r.itens.map((i) => i.item.cod).sort();
  assertEquals(cods, ['ASPO10', 'ASPO20']);
  assertEquals(r.itens.find((i) => i.item.cod === 'ASPO10')!.quantidade, 6);
  assert(r.suposicoes.some((s) => s.includes('Furação olímpica em todo o orçamento') && s.includes('anilha 10 kg')), r.suposicoes.join(' | '));
});

Deno.test('regra 3: 3 pares de anilha de 5 kg = 6 unidades', () => {
  const r = comporPedido(catalogo, [
    { descricao: 'anilha 5 kg', quantidade: 3, quantidade_informada: true, por_par: true, unidade_pedida: 'par' }
  ]);
  assertEquals(r.itens.length, 1);
  assertEquals(r.itens[0].quantidade, 6);
  assert(r.suposicoes.some((s) => s.includes('3 par(es) = 6 unidades')), r.suposicoes.join(' | '));
});

Deno.test('regra 3: unidade "pares" também vira unidade, mas kit com "10 pares" no nome não dobra', () => {
  const r = comporPedido(catalogo, [
    { descricao: 'anilha 5 kg', quantidade: 2, quantidade_informada: true, unidade_pedida: 'pares' },
    { descricao: 'kit halter 10 pares', quantidade: 1, quantidade_informada: true }
  ]);
  assertEquals(r.itens.find((i) => i.item.cod === 'ASP5')!.quantidade, 4);
  const kit = r.itens.find((i) => /kit/i.test(i.item.nome));
  if (kit) assert(kit.quantidade === 1);
});

Deno.test('regra 5: quantidade que não existe no pedido não passa (66 x 4.356)', () => {
  const erro = sanidadeQuantidades([{ descricao: 'anilha 20 kg', quantidade: 4356 }], '66 anilhas de 20 kg pro cliente X');
  assertEquals(erro.length, 1);
  assert(erro[0].includes('4.356') && erro[0].includes('quantidade certa'), erro[0]);
  // o número do pedido passa
  assertEquals(sanidadeQuantidades([{ descricao: 'anilha 20 kg', quantidade: 66 }], '66 anilhas de 20 kg'), []);
  // quantidade que já estava no rascunho não é reperguntada
  assertEquals(sanidadeQuantidades([{ descricao: 'anilha 20 kg', quantidade: 40 }], 'troca o de 2 kg por 30', [{ descricao: 'anilha 20 kg', quantidade: 40 }]), []);
  // 10 pares = 20 unidades: 20 não está no texto, mas a metade está
  assertEquals(sanidadeQuantidades([{ descricao: 'anilha 5 kg', quantidade: 20 }], '10 pares de anilha 5 kg'), []);
  // quantidade escrita em palavra também conta
  assertEquals(sanidadeQuantidades([{ descricao: 'anilha 5 kg', quantidade: 10 }], 'dez anilhas de 5 kg'), []);
});

Deno.test('regra 5: montagem não pode explodir em relação ao rascunho', () => {
  const erro = sanidadeQuantidades(
    [{ descricao: 'anilha 20 kg', quantidade: 66 }, { descricao: 'anilha 10 kg', quantidade: 400 }],
    '10 e 66', [{ descricao: 'anilha 20 kg', quantidade: 66 }]
  );
  assert(erro.some((e) => e.includes('Conferência de quantidade')), erro.join(' | '));
});

Deno.test('regra 7: opção já oferecida é reconhecida para não dizer que não existe', () => {
  const oferecidas = opcoesOferecidas([
    'Não tem "presilha" no catálogo. Usar "Presilha Espiral Cromada"? Outra opção: "Presilha Lock Press Mini".',
    '"puxador" tem mais de um produto. Usar "Puxador Triângulo Cromado"?'
  ]);
  const chaves = oferecidas.map((o) => o.chave);
  assert(chaves.includes(normalizar('Presilha Espiral Cromada')));
  assert(chaves.includes(normalizar('Presilha Lock Press Mini')));
  assert(chaves.includes(normalizar('Puxador Triângulo Cromado')));
  // a descrição pedida não é uma opção oferecida
  assert(!chaves.includes(normalizar('presilha')));
});