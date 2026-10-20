// Rodar a partir da raiz do app:  deno test base44/shared/composicaoOrcamento.test.ts
// Catálogo de teste montado com os NOMES reais do ProductTemplate (preços fictícios).
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { comporPedido, lerFaixa } from './composicaoOrcamento.ts';
import { normalizar, type ItemCatalogo } from './catalogoRespondedor.ts';
import { dadosDoCnpj } from './cnpjPublico.ts';

let seq = 0;
const item = (nome: string, cod: string, peso: number | null, und: string, preco: number, categoria = ''): ItemCatalogo => ({
  product_id: 'p' + (++seq), nome, cod, categoria, subcategoria: '', und, peso_kg: peso, detalhes: '', preco,
  busca: normalizar([nome, cod, categoria].join(' ')), chave: normalizar([nome, cod, categoria].join(' '))
});

const catalogo: ItemCatalogo[] = [
  item('Kit Halter Sextavado Injetado 1 a 10kg + Suporte', 'KHSI110S', 110, 'kit', 1890),
  item('Kit Halter Sextavado Injetado Pegada Inox 1 A 10 kg (10 Pares)', 'AF-098', null, 'kit', 2100),
  item('Kit Halter Sextavado Injetado Pegada Inox 1 A 10 kg + Suporte Universal', 'AF-097', null, 'kit', 2500),
  item('Kit Halter Sextavado Injetado Pegada Cromada Ou Eletrostática 1 A 10 kg + Sup Universal', 'KIT-N021', null, 'kit', 2300),
  item('Kit Halter Sextavado Injetado Pegada Cromada Ou Eletrostática 1 A 10 kg (10 Pares)', 'KIT-N027', null, 'kit', 1950),
  item('Suporte Dumbbell Sextavado para 10 Pares', 'SUP-056', null, 'peça', 600),
  item('Barra Cromada Recartilhada Montada Anilha Injetada 20Kg', 'ANI-N050', 20, 'peça', 300)
];
for (const [fam, sig] of [['Injetado Pegada Injetada', 'IIN'], ['Injetado Pegada Pintada', 'IPT'], ['Injetado Pegada Recartilhada', 'IR'], ['Pintado Pegada Pintada', 'PPT']]) {
  for (let p = 10; p <= 30; p += 2) {
    catalogo.push(item(`Dumbbell Montado Anilha Vazada ${fam} ${p}kg`, `DMOAV${sig}${p}`, p, 'par', p * 20, 'Dumbbells'));
  }
}
for (const p of [10, 12, 14, 16, 18, 20, 22]) {
  catalogo.push(item(`Dumbbell Montado Anilha Sport Pintado Pegada Emborrachada ${p}kg`, `DMOASPEB${p}`, p, 'par', p * 22, 'Dumbbells'));
}

Deno.test('faixa: lê limites e tira a faixa da descrição', () => {
  const f = lerFaixa('dumbbell montado anilha injetada de 12 a 20kg');
  assertEquals([f?.de, f?.ate], [12, 20]);
  assertEquals(f?.base, 'dumbbell montado anilha injetada');
  assertEquals(lerFaixa('anilha 20kg'), null);
});

Deno.test('pedido de 15/10: kit com suporte reconhecido e dumbbell 12 a 20 composto peso a peso', () => {
  const r = comporPedido(catalogo, [
    { descricao: 'kit halter sextavado injetado 1 a 10', quantidade: 1, quantidade_informada: true },
    { descricao: 'dumbbell montado anilha injetada 12 a 20 kg', quantidade: 1, quantidade_informada: false },
    { descricao: 'suporte para 10 pares', quantidade: 1, quantidade_informada: true }
  ]);
  assertEquals(r.perguntas, []);
  const cods = r.itens.map((i) => i.item.cod);
  assertEquals(cods[0], 'KHSI110S');
  assert(!cods.includes('SUP-056'), 'suporte não pode ser somado de novo');
  assertEquals(cods.slice(1), ['DMOAVIIN12', 'DMOAVIIN14', 'DMOAVIIN16', 'DMOAVIIN18', 'DMOAVIIN20']);
  assert(r.composicoes[0].includes('12/14/16/18/20'));
  assert(r.suposicoes.some((s) => s.includes('incluso no KHSI110S')));
  assert(r.suposicoes.some((s) => s.includes('quantidade não informada')));
});

Deno.test('faixa sem a família exata vira pergunta com a opção sugerida, nunca chute', () => {
  const r = comporPedido(catalogo, [{ descricao: 'dumbbell montado anilha sport injetada 12 a 20 kg', quantidade: 2, quantidade_informada: true }]);
  assertEquals(r.itens.length, 0);
  assertEquals(r.perguntas.length, 1);
  assert(/Usar "Dumbbell Montado Anilha/.test(r.perguntas[0]), r.perguntas[0]);
});

Deno.test('resposta "Sim" com o texto sugerido resolve a composição', () => {
  const r = comporPedido(catalogo, [{ descricao: 'Dumbbell Montado Anilha Sport Pintado Pegada Emborrachada 12 a 20 kg', quantidade: 10, quantidade_informada: true }]);
  assertEquals(r.perguntas, []);
  assertEquals(r.itens.map((i) => i.item.peso_kg), [12, 14, 16, 18, 20]);
  assert(r.itens.every((i) => i.quantidade === 10));
});

Deno.test('kit sem suporte pedido continua sendo perguntado com opção sugerida', () => {
  const r = comporPedido(catalogo, [{ descricao: 'kit halter sextavado injetado 1 a 10', quantidade: 1, quantidade_informada: true }]);
  assertEquals(r.itens.length, 0);
  assert(r.perguntas[0].includes('Usar "'));
});

Deno.test('CNPJ público: endereço sem número cadastra com ressalva', () => {
  const d = dadosDoCnpj({ razao_social: 'ACADEMIA X LTDA', nome_fantasia: 'X FIT', logradouro: 'RUA A', numero: 'S/N', bairro: 'CENTRO', municipio: 'DIVINOPOLIS', uf: 'mg', cep: '35500000' });
  assertEquals(d?.numero_ausente, true);
  assertEquals(d?.estado, 'MG');
  assertEquals(d?.cep, '35500-000');
  assertEquals(d?.endereco, 'RUA A, S/N - CENTRO');
  assertEquals(dadosDoCnpj({}), null);
});
