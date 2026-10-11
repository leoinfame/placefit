// Testes de seguranca das funcoes publicas corrigidas (chargeSavedCard, confirmarPagamentoLoja).
// Roda cada entry.ts trocando o SDK pelo banco em memoria do hub-e2e; nada toca o banco real nem o Stripe.
// deno run --allow-all base44/shared/seguranca-e2e/funcoes.test.ts
import { DB, USERS } from '../hub-e2e/mock.ts';

const mock = new URL('../hub-e2e/mock.ts', import.meta.url).href;
async function carregar(nome: string) {
  const src = await Deno.readTextFile(new URL(`../../functions/${nome}/entry.ts`, import.meta.url));
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/entry.ts`, src.replace(/from ["']npm:@base44\/sdk@[^"']+["']/, `from '${mock}'`));
  return (await import(`file://${dir}/entry.ts`)).default as (r: Request) => Promise<Response>;
}
const chamar = async (fn: (r: Request) => Promise<Response>, uid: string | null, corpo: unknown) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (uid) headers['x-user'] = uid;
  const r = await fn(new Request('http://x', { method: 'POST', headers, body: JSON.stringify(corpo) }));
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
};

let ok = 0, falhas = 0;
const passo = (nome: string, cond: boolean, info?: unknown) => {
  if (cond) ok++; else { falhas++; console.log('FALHOU:', nome, JSON.stringify(info)); }
};

USERS.dono = { id: 'dono', role: 'user', email: 'dono@x' };
USERS.outro = { id: 'outro', role: 'user', email: 'outro@x' };
USERS.admin = { id: 'admin', role: 'admin', email: 'admin@x' };

// ---- chargeSavedCard
const charge = await carregar('chargeSavedCard');
DB.AssinaturaUsuario = [{ id: 'A1', usuario_id: 'dono', status: 'ativo', plano_slug: 'x' }];
DB.MetodoPagamento = [];
let r = await chamar(charge, null, { assinatura_id: 'A1' });
passo('charge: sem login 401', r.status === 401, r);
r = await chamar(charge, 'outro', { assinatura_id: 'A1' });
passo('charge: assinatura de outra conta 403', r.status === 403, r);
r = await chamar(charge, 'dono', { assinatura_id: 'A1' });
passo('charge: dono passa da checagem (para em sem cartao)', r.status === 400 && /cart/i.test(r.corpo.error || ''), r);
r = await chamar(charge, 'admin', { assinatura_id: 'A1' });
passo('charge: admin passa da checagem', r.status === 400 && /cart/i.test(r.corpo.error || ''), r);

// ---- confirmarPagamentoLoja
const confirmar = await carregar('confirmarPagamentoLoja');
DB.LojaPedido = [
  { id: 'L1', revendedor_id: 'dono', status: 'pendente', pagamento_status: 'pendente', itens: [] },
  { id: 'L2', revendedor_id: 'dono', status: 'pendente', pagamento_status: 'pendente', itens: [] },
];
r = await chamar(confirmar, null, { loja_pedido_id: 'L1' });
passo('confirmar: sem login 401', r.status === 401, r);
r = await chamar(confirmar, 'outro', { loja_pedido_id: 'L1' });
passo('confirmar: loja de outra revenda 403', r.status === 403, r);
passo('confirmar: nada mudou apos tentativas', DB.LojaPedido[0].pagamento_status === 'pendente');
r = await chamar(confirmar, 'dono', { loja_pedido_id: 'L1' });
passo('confirmar: dono confirma', r.status === 200 && DB.LojaPedido[0].pagamento_status === 'pago', r);
r = await chamar(confirmar, 'admin', { loja_pedido_id: 'L2' });
passo('confirmar: admin confirma', r.status === 200 && DB.LojaPedido[1].pagamento_status === 'pago', r);

console.log(`${ok} ok, ${falhas} falha(s)`);
if (falhas) Deno.exit(1);
