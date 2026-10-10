// Teste da camada de dados do card (sem rede). Rodar: deno run -A base44/shared/cardProduto.test.ts
import { carregarDadosCard, precoRevendedor, formatarPreco, formatarPeso, ErroCard, normalizarProporcao, resolverIdentidade } from './cardProduto.ts';
const db: any = {
  SupplierProduct: [{ id:'sp1', supplier_id:'u1', product_id:'t1', preco:117, margem:24 }, { id:'sp2', supplier_id:'u2', product_id:'t1', preco:50 }, { id:'sp3', supplier_id:'u1', product_id:'t1', preco:0 }],
  ProductTemplate: [{ id:'t1', nome:'Tijolinho Evolution Injetado 10kg', peso_kg:10, und:'peça', foto:'x' }],
  LojaConfig: [{ revendedor_id:'u1', nome_loja:'MuscularFit', logo_url:'', cor_primaria:'#ec673c', cor_secundaria:'nao-hex' }],
  User: [],
};
const ent = (n: string) => ({ filter: async (q: any) => db[n].filter((r: any) => Object.entries(q).every(([k,v]) => r[k] === v)) });
const b44 = { asServiceRole: { entities: new Proxy({}, { get: (_t, n: string) => ent(n) }) } };
const u1 = { id:'u1', role:'user', empresa:'X', logomarca:'L', whatsapp:'(37) 9' };
let ok = 0, falhas = 0; const t = (c: boolean, m: string) => { c ? ok++ : (falhas++, console.log('FALHA', m)); };
const d = await carregarDadosCard(b44, u1, 'sp1');
t(d.preco_final === 145.08, 'preco com margem'); t(d.marca.logo === 'L', 'fallback logo do user'); t(d.marca.cor_secundaria === null && d.marca.cor_primaria === '#ec673c', 'cor invalida -> null (extrai da logo)'); t(d.marca.nome === 'MuscularFit', 'nome loja');
for (const [id, st] of [['sp2',403],['sp3',400],['nada',404],['',400]] as const) { try { await carregarDadosCard(b44, u1, id); t(false, id); } catch (e) { t(e instanceof ErroCard && e.status === st, `${id} -> ${st} (veio ${(e as any).status})`); } }
const adm = await carregarDadosCard(b44, { id:'a', role:'admin' }, 'sp2'); t(adm.preco_final === 50 && adm.revendedor_id === 'u2', 'admin ve outro revendedor');
t(precoRevendedor(122.3652, 24) === 151.73, 'arredonda'); t(formatarPreco(1234.5) === 'R$ 1.234,50', 'milhar'); t(formatarPreco(0.81) === 'R$ 0,81', 'centavos'); t(formatarPeso(2.5) === '2,5 kg', 'peso fracionado');
t(normalizarProporcao('vertical') === 'vertical' && normalizarProporcao('retrato') === 'retrato', 'proporcoes validas'); t(normalizarProporcao('banner') === 'quadrado' && normalizarProporcao(undefined) === 'quadrado', 'proporcao invalida -> quadrado');
t(resolverIdentidade({ cor_primaria:'#1e40af', cor_secundaria:'#059669' }).cor_primaria === null, 'defaults do schema -> extrai da logo'); t(resolverIdentidade({ identidade_configurada:true, cor_primaria:'#112233', cor_secundaria:'#445566', estilo_fundo:'escuro' }).estilo_fundo === 'escuro', 'identidade configurada respeitada'); t(resolverIdentidade({ identidade_configurada:true, estilo_fundo:'xadrez' }).estilo_fundo === 'gradiente', 'estilo invalido -> gradiente');
console.log(`ok=${ok} falhas=${falhas}`);
if (falhas) Deno.exit(1);
