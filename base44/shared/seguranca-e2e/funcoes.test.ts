// Testes de seguranca das funcoes corrigidas no raio-x.
// Roda cada entry.ts trocando o SDK pelo banco em memoria do hub-e2e; nada toca o banco real, Stripe, Meta ou ML.
// deno run --allow-all base44/shared/seguranca-e2e/funcoes.test.ts
// FUNCOES_DIR=<pasta> roda os mesmos testes contra outra copia de base44/functions (ex.: a main, para comparar).
import { DB, USERS } from '../hub-e2e/mock.ts';

const mock = new URL('../hub-e2e/mock.ts', import.meta.url).href;
const shared = new URL('../', import.meta.url).href;
const funcoes = Deno.env.get('FUNCOES_DIR') ? `file://${Deno.env.get('FUNCOES_DIR')}/` : new URL('../../functions/', import.meta.url).href;
const runtime = 'data:text/javascript,export const secrets = { get: () => "sk_test_x" };';

async function carregar(nome: string) {
  const src = await (await fetch(`${funcoes}${nome}/entry.ts`)).text();
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/entry.ts`, src
    .replace(/from ["']npm:@base44\/sdk@[^"']+["']/, `from '${mock}'`)
    .replace(/from ["']base44:runtime["']/, `from '${runtime}'`)
    .replace(/from ["']\.\.\/\.\.\/shared\/([^"']+)["']/g, (_m, f) => `from '${shared}${f}'`));
  let servido: any = null;
  const original = (Deno as any).serve;
  (Deno as any).serve = (h: any) => { servido = h; };
  const mod = await import(`file://${dir}/entry.ts`);
  (Deno as any).serve = original;
  return (mod.default || servido) as (r: Request) => Promise<Response>;
}
const chamar = async (fn: (r: Request) => Promise<Response>, uid: string | null, corpo: unknown) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (uid) headers['x-user'] = uid;
  const r = await fn(new Request('http://x', { method: 'POST', headers, body: JSON.stringify(corpo) }));
  return { status: r.status, corpo: await r.json().catch(() => ({})) };
};

let ok = 0, falhas = 0;
const passo = (nome: string, cond: boolean, info?: unknown) => {
  if (cond) ok++; else { falhas++; console.log('FALHOU:', nome, JSON.stringify(info)?.slice(0, 160)); }
};
// Nada sai para a internet nestes testes.
globalThis.fetch = ((orig) => (u: any, i?: any) => String(u).startsWith('file:') ? orig(u, i) : Promise.reject(new Error('rede bloqueada no teste')))(globalThis.fetch);

USERS.dono = { id: 'dono', role: 'user', email: 'dono@x', full_name: 'Dono' };
USERS.outro = { id: 'outro', role: 'user', email: 'outro@x', full_name: 'Outro' };
USERS.admin = { id: 'admin', role: 'admin', email: 'admin@x', full_name: 'Admin' };
DB.User = Object.values(USERS);

// ---- 1. chargeSavedCard
{
  const fn = await carregar('chargeSavedCard');
  DB.AssinaturaUsuario = [{ id: 'A1', usuario_id: 'dono', status: 'ativo', plano_slug: 'x' }];
  DB.MetodoPagamento = [];
  let r = await chamar(fn, null, { assinatura_id: 'A1' });
  passo('charge: sem login 401', r.status === 401, r);
  r = await chamar(fn, 'outro', { assinatura_id: 'A1' });
  passo('charge: assinatura de outra conta 403', r.status === 403, r);
  r = await chamar(fn, 'dono', { assinatura_id: 'A1' });
  passo('charge: dono passa (para em sem cartao)', r.status === 400 && /cart/i.test(r.corpo.error || ''), r);
  r = await chamar(fn, null, { assinatura_id: 'A1', key: 'chute' });
  passo('charge: chave inventada 401', r.status === 401, r);
  Deno.env.set('COBRANCA_KEY', 'segredo-teste');
  r = await chamar(fn, null, { assinatura_id: 'A1', key: 'segredo-teste' });
  passo('charge: automacao com chave passa', r.status === 400 && /cart/i.test(r.corpo.error || ''), r);
  Deno.env.delete('COBRANCA_KEY');
}

// ---- 4. confirmarPagamentoLoja
{
  const fn = await carregar('confirmarPagamentoLoja');
  DB.LojaPedido = [{ id: 'L1', revendedor_id: 'dono', status: 'pendente', pagamento_status: 'pendente', itens: [] }];
  let r = await chamar(fn, null, { loja_pedido_id: 'L1' });
  passo('confirmar: sem login 401', r.status === 401, r);
  r = await chamar(fn, 'outro', { loja_pedido_id: 'L1' });
  passo('confirmar: outra revenda 403', r.status === 403 && DB.LojaPedido[0].pagamento_status === 'pendente', r);
  r = await chamar(fn, 'dono', { loja_pedido_id: 'L1' });
  passo('confirmar: dono confirma', r.status === 200 && DB.LojaPedido[0].pagamento_status === 'pago', r);
}

// ---- 5. autoaprovacao: aplicarPreCadastro, adminUpdateUser, listagens
{
  const pre = await carregar('aplicarPreCadastro');
  DB.AprovacaoUsuario = [];
  // PreCadastro forjado pela propria conta
  DB.PreCadastro = [{ id: 'P1', email: 'outro@x', aplicado: false, tipo_usuario: 'fabricante', created_by_id: 'outro' }];
  let r = await chamar(pre, 'outro', {});
  passo('pre-cadastro forjado nao aplica', r.corpo.applied === false && USERS.outro.aprovado !== true, r);
  // PreCadastro feito pelo admin
  DB.PreCadastro.push({ id: 'P2', email: 'dono@x', aplicado: false, tipo_usuario: 'fabricante', empresa: 'Fundicao Dono', created_by_id: 'admin' });
  r = await chamar(pre, 'dono', {});
  const userDono = DB.User.find((u: any) => u.id === 'dono');
  passo('pre-cadastro do admin aplica', r.corpo.applied === true && userDono.aprovado === true && userDono.tipo_usuario === 'fabricante', r);
  passo('pre-cadastro do admin grava aprovacao', DB.AprovacaoUsuario.some((a: any) => a.user_id === 'dono' && a.aprovado && a.tipo_usuario === 'fabricante'));

  const adm = await carregar('adminUpdateUser');
  r = await chamar(adm, 'outro', { userId: 'outro', data: { aprovado: true } });
  passo('adminUpdateUser: nao admin 403', r.status === 403, r);

  // "outro" se autoaprova editando o proprio cadastro (o que o app permite hoje)
  Object.assign(DB.User.find((u: any) => u.id === 'outro'), { aprovado: true, tipo_usuario: 'fabricante' });
  const lista = await carregar('getFabricantes');
  r = await chamar(lista, 'dono', {});
  const ids = (r.corpo.fabricantes || []).map((f: any) => f.id);
  passo('getFabricantes: autoaprovado fica fora', !ids.includes('outro'), ids);
  passo('getFabricantes: aprovado pelo admin aparece', ids.includes('dono'), ids);

  const pub = await carregar('getPublicFabricanteTable');
  r = await chamar(pub, null, { fabricante_id: 'outro' });
  passo('tabela publica: autoaprovado 404', r.status === 404, r);

  r = await chamar(adm, 'admin', { userId: 'outro', data: { aprovado: true } });
  passo('adminUpdateUser: admin aprova e grava registro', r.status === 200 && DB.AprovacaoUsuario.some((a: any) => a.user_id === 'outro' && a.aprovado && a.tipo_usuario === 'fabricante'), DB.AprovacaoUsuario);
  r = await chamar(lista, 'dono', {});
  passo('getFabricantes: depois da aprovacao do admin aparece', (r.corpo.fabricantes || []).some((f: any) => f.id === 'outro'));
  // Aprovado como fabricante, mas troca o proprio tipo para transportador: sai da lista
  DB.User.find((u: any) => u.id === 'outro').tipo_usuario = 'transportador';
  r = await chamar(lista, 'dono', {});
  passo('getFabricantes: troca de tipo pelo usuario tira da lista', !(r.corpo.fabricantes || []).some((f: any) => f.id === 'outro'));
  DB.User.find((u: any) => u.id === 'outro').tipo_usuario = 'fabricante';
  r = await chamar(adm, 'admin', { userId: 'outro', data: { aprovado: false } });
  r = await chamar(lista, 'dono', {});
  passo('getFabricantes: desaprovado pelo admin sai', !(r.corpo.fabricantes || []).some((f: any) => f.id === 'outro'));

  // Origem 'entidade' (menu Fabricantes do revendedor, item 005 de 14/10)
  DB.Fabricante = [
    { id: 'FSEM', nome_fantasia: 'Sem Conta', aprovado: true, ativo: true, user_id: null },
    { id: 'FPEND', nome_fantasia: 'Conta Pendente', aprovado: true, ativo: true, user_id: 'outro' },
    { id: 'FTESTE', nome_fantasia: 'Teste', aprovado: false, ativo: true, user_id: 'dono' },
    { id: 'FINAT', nome_fantasia: 'Inativo', aprovado: true, ativo: false, user_id: null },
  ];
  r = await chamar(lista, null, { origem: 'entidade' });
  passo('getFabricantes entidade: sem login 401', r.status === 401, r);
  r = await chamar(lista, 'dono', { origem: 'entidade' });
  const idsEnt = (r.corpo.fabricantes || []).map((f: any) => f.id).sort();
  passo('getFabricantes entidade: so aprovado e ativo, com ou sem conta', JSON.stringify(idsEnt) === JSON.stringify(['FPEND', 'FSEM']), idsEnt);
  passo('getFabricantes entidade: leva user_id da conta', (r.corpo.fabricantes || []).find((f: any) => f.id === 'FPEND')?.user_id === 'outro', r.corpo);
  r = await chamar(lista, 'dono', {});
  passo('getFabricantes padrao: continua por conta de usuario', !(r.corpo.fabricantes || []).some((f: any) => String(f.id).startsWith('F')), r.corpo);
}

// ---- 6. contratarRecurso
{
  const fn = await carregar('contratarRecurso');
  DB.PlanoServico = [{ id: 'PL1', slug: 'atendente_ia', nome: 'Atendente IA', preco: 99 }];
  DB.AssinaturaUsuario = [];
  let r = await chamar(fn, null, { plano_slug: 'atendente_ia', user_id: 'dono' });
  passo('contratar: sem login 401', r.status === 401, r);
  r = await chamar(fn, 'outro', { plano_slug: 'atendente_ia', user_id: 'dono', user_email: 'dono@x' });
  const a = DB.AssinaturaUsuario[0];
  passo('contratar: ignora user_id do corpo e usa a conta logada', r.status === 200 && a?.usuario_id === 'outro' && a?.usuario_email === 'outro@x', a);
}

// ---- 8. mlExportarProdutos
{
  const fn = await carregar('mlExportarProdutos');
  DB.LojaConfig = [{ id: 'LC1', revendedor_id: 'dono' }];
  let r = await chamar(fn, null, { revendedor_id: 'dono', sp_ids: ['x'] });
  passo('ml: sem login 401', r.status === 401, r);
  r = await chamar(fn, 'outro', { revendedor_id: 'dono', sp_ids: ['x'] });
  passo('ml: loja de outra revenda 403', r.status === 403, r);
  r = await chamar(fn, 'dono', { revendedor_id: 'dono', sp_ids: ['x'] });
  passo('ml: dono passa da checagem', r.status !== 401 && r.status !== 403, r);
}

// ---- 10. syncCatalogoWhatsapp
{
  const fn = await carregar('syncCatalogoWhatsapp');
  DB.SupplierProduct = [{ id: 'SP1', supplier_id: 'dono', preco: 100, product_id: 'T1' }];
  DB.LojaConfig = [{ id: 'LC1', revendedor_id: 'dono', wa_push_ativo: false }];
  // Evento forjado: diz que o SP1 e de "vitima" (sem loja). Com a correcao, usa o dono real.
  let r = await chamar(fn, null, { event: { type: 'update' }, data: { id: 'SP1', supplier_id: 'vitima', preco: 1 } });
  passo('whatsapp: usa o registro real, nao o corpo', /desligado/.test(r.corpo.skipped || ''), r);
  r = await chamar(fn, null, { event: { type: 'delete' }, data: { id: 'SP1', supplier_id: 'dono' } });
  passo('whatsapp: delete forjado de registro existente ignorado', r.corpo.skipped === 'registro ainda existe', r);
  r = await chamar(fn, null, { event: { type: 'update' }, data: { id: 'NAOEXISTE', supplier_id: 'dono' } });
  passo('whatsapp: registro inexistente ignorado', r.corpo.skipped === 'registro nao existe', r);
}

console.log(`${ok} ok, ${falhas} falha(s)`);
if (falhas) Deno.exit(1);
