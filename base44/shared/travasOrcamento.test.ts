// deno test --no-lock -A --no-check base44/shared/travasOrcamento.test.ts   (offline)
// Etapa 2: nenhuma peça errada sai sozinha. Nomes reais do catálogo, preços fictícios.
import { comporPedido, paresEmUnidades } from './composicaoOrcamento.ts';
import { decidir } from './vendedorLead.ts';
import { normalizar, type ItemCatalogo } from './catalogoRespondedor.ts';

function ok(c: boolean, m: string) { if (!c) throw new Error('falhou: ' + m); }
let n = 0;
const it = (nome: string, cod: string, peso: number | null, preco: number, und = 'peça'): ItemCatalogo => ({
  product_id: 'p' + ++n, nome, cod, categoria: '', subcategoria: '', und, peso_kg: peso, detalhes: '', preco,
  busca: normalizar(nome + ' ' + cod), chave: normalizar(nome + ' ' + cod)
});
const cat: ItemCatalogo[] = [];
for (const p of [2, 5, 10, 15, 20]) cat.push(
  it(`Anilha Vazada Injetado ${p}kg`, 'AVI' + p, p, p * 8.5), it(`Anilha Sport Emborrachada ${p}kg`, 'ASR' + p, p, p * 8.9),
  it(`Anilha Vazada Pintado ${p}kg`, 'AVP' + p, p, p * 6.8));
for (const p of [1, 2, 10]) cat.push(it(`Halter Sextavado Pintado ${p}kg`, 'HSPP' + p, p, p * 9), it(`Halter Bola Pintado ${p}kg`, 'HBP' + p, p, p * 8));
for (const p of [10, 30]) cat.push(it(`Kettlebell Pintado ${p}kg`, 'KP' + p, p, p * 7.8), it(`Kettlebell Emborrachado ${p}kg`, 'KE' + p, p, p * 9));
cat.push(
  it('Barra Hexagonal Maciça Preta - Pegada Cromada Recartilhada', 'BAR-038', null, 400), it('Barra Hexagonal Tubular Olímpica Preta', 'BAR-041', null, 500),
  it('Barra Olímpica 20lbs 1.62m 4 Rolamentos Cromada', 'BAR-072', null, 300), it('Barra Olímpica 20kg 2.2m 4 Rolamentos Cromada', 'BAR-042', null, 900),
  it('Barra Olímpica 40lbs 2.2m 4 Rolamentos Cromada', 'BAR-062', null, 850), it('Barra Maciça Cromada Recartilhada Reta 2,2m c/ Presilha Espiral', 'BAR-008', null, 320),
  it('Caneleira 1kg (Par)', 'CAN-01-KG', 1, 58.8, 'par'), it('Dumbbell Sextavado Pintado Pegada Pintada 20kg', 'DSX20', 20, 171, 'par'),
  it('Suporte 3x1 (Anilha, Barra e Halter)', 'SUP-033', null, 558));
const C = (a: number[][]) => a.map(([quantidade, peso_kg]) => ({ quantidade, peso_kg }));
const L = (descricao: string, quantidade: number, o: any = {}) => ({ descricao, quantidade, quantidade_informada: true, ...o });
const um = (l: any) => comporPedido(cat, [l]);
const cods = (r: any) => r.itens.map((i: any) => i.item.cod).join();

Deno.test('Otoniel: anilha sport emborrachada nunca vira Vazada Injetado', () => {
  const r = um(L('anilhas sport emborrachadas', 1, { tipo: 'anilha', composicao: C([[4, 2], [6, 5], [6, 10], [4, 15], [4, 20]]) }));
  ok(cods(r) === 'ASR2,ASR5,ASR10,ASR15,ASR20' && !r.revisar.length, cods(r) + r.revisar);
});
Deno.test('barra hexagonal nunca vira olímpica reta, e a escolha é para conferir', () => {
  for (const o of [{ tipo: 'barra', requisitos: ['olimpica'] }, { tipo: 'barra' }]) {
    const r = um(L('Barra Hexagonal (Trap Bar)', 3, o));
    ok(!cods(r).includes('BAR-072') && !cods(r).includes('BAR-042') && cods(r) !== '', cods(r));
  }
  ok(um(L('Barra Hexagonal (Trap Bar)', 3, { tipo: 'barra' })).revisar.length > 0, 'duas hexagonais → conferir');
});
Deno.test('item por peso sem peso pergunta; peso que não existe é não cotado', () => {
  const r = um(L('Halter Sextavado Pintado', 5, { tipo: 'halter', requisitos: ['sextavado'] }));
  ok(!r.itens.length && /qual peso/.test(r.perguntas[0]), 'pergunta peso');
  const x = um(L('anilha sport emborrachada 17kg', 2, { tipo: 'anilha', requisitos: ['sport'] }));
  ok(!x.itens.length && x.naoCotados.length === 1, 'não cotado');
});
Deno.test('duas famílias: suposição visível e conferência; nome inteiro citado segue sozinho', () => {
  const r = um(L('halter 1kg', 1, { tipo: 'halter', composicao: C([[6, 1]]) }));
  ok(r.itens.length === 1 && r.suposicoes.length > 0 && r.revisar.length > 0, 'visível e para conferir');
  for (const [d, t, p] of [['anilha vazada pintada 2kg', 'anilha', 2], ['kettlebell pintados 30kg', 'kettlebell', 30]] as any) {
    const s = um(L(d, 1, { tipo: t, composicao: C([[4, p]]) }));
    ok(s.itens.length === 1 && !s.revisar.length && !s.perguntas.length, d + s.revisar);
  }
});
Deno.test('material que não existe na linha fica para conferir; alternativas do pedido não', () => {
  ok(um(L('anilha sport pintada', 1, { tipo: 'anilha', composicao: C([[4, 10]]) })).revisar.length > 0, 'sport pintada não existe aqui');
  const r = um(L('anilha sport pintada ou emborrachada', 1, { tipo: 'anilha', preferencias: ['pintado', 'emborrachado'], composicao: C([[4, 10]]) }));
  ok(cods(r) === 'ASR10', cods(r));
});
Deno.test('B3 com ficha: barra 2,2 m sem tipo pergunta a olímpica', () => {
  const r = um(L('barra com recartilhado 220cm', 1, { tipo: 'barra', comprimento_m: 2.2 }));
  ok(!r.itens.length && r.perguntas[0].includes('BAR-042'), JSON.stringify(r.perguntas));
  const o = um(L('Barra olímpica reta de 2,20 m', 2, { tipo: 'barra', comprimento_m: 2.2, requisitos: ['olimpica'] }));
  ok(cods(o) === 'BAR-042' && !o.revisar.length, 'padrão aprovado');
});
Deno.test('par: "par" é reconhecido; produto por par fica para conferir; dumbbell não', () => {
  const l: any = [L('presilha', 1, { unidade_pedida: 'par' })];
  paresEmUnidades(l);
  ok(l[0].quantidade === 2, '1 par = 2');
  ok(um(L('caneleira 1kg', 2, { tipo: 'caneleira' })).revisar.length > 0, 'caneleira');
  ok(!um(L('Dumbbell Sextavado Pintado Pegada Pintada 20kg', 2)).revisar.length, 'dumbbell');
});
Deno.test('suporte com capacidade desconhecida e quantidade não dita ficam para conferir', () => {
  ok(um(L('suporte para barras e anilhas', 1, { tipo: 'suporte', armazena: ['barra', 'anilha'], capacidade_kg: 220 })).revisar.length > 0, 'suporte');
  ok(um({ descricao: 'Anilha Vazada Pintado 10kg', quantidade: 1, quantidade_informada: false }).revisar.length > 0, 'quantidade');
});
Deno.test('decidir: com algo a conferir nunca envia sozinho', () => {
  const ped = { itens: [{}], cliente: { cpf_cnpj: '05594733000115' } };
  const r = { pronto: true, perguntas: [], nao_cotados: [], revisar: [], frete: 1, frete_origem: 'tabela MG', ressalvas: [], total: 10, itens: [{}] };
  ok(decidir(ped, r).acao === 'enviar', 'limpo envia');
  const d = decidir(ped, { ...r, revisar: ['mais de uma linha atende'] });
  ok(d.acao === 'escalar' && d.motivos[0] === 'mais de uma linha atende', 'trava');
});
