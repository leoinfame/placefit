// Trava de regressao: confere que as regras de acesso (RLS) dos itens criticos continuam nas entidades.
// node base44/shared/seguranca-e2e/rls.test.mjs
import { readFileSync } from 'node:fs';

const ler = (e) => JSON.parse(readFileSync(new URL(`../../entities/${e}.jsonc`, import.meta.url), 'utf8')).rls || {};
const so_admin = (r) => JSON.stringify(r) === JSON.stringify({ user_condition: { role: 'admin' } });
const dono = (r, campo) => JSON.stringify(r || {}).includes(`"data.${campo}":"{{user.id}}"`) && JSON.stringify(r).includes('"role":"admin"');

let ok = 0, falhas = 0;
const t = (nome, cond) => { if (cond) ok++; else { falhas++; console.log('FALHOU:', nome); } };

for (const e of ['Product', 'ProductTemplate', 'Category', 'Unit', 'AtributoConfig']) {
  const r = ler(e);
  for (const op of ['create', 'update', 'delete']) t(`${e}.${op} so admin`, so_admin(r[op]));
}
const sp = ler('SupplierProduct');
for (const op of ['create', 'update', 'delete']) t(`SupplierProduct.${op} dono`, dono(sp[op], 'supplier_id'));
for (const [e, campo] of [['Cliente', 'fornecedor_id'], ['Pedido', 'fornecedor_id']]) {
  const r = ler(e);
  for (const op of ['read', 'create', 'update', 'delete']) t(`${e}.${op} dono`, dono(r[op], campo));
}
t('Pedido.read inclui cliente_id', dono(ler('Pedido').read, 'cliente_id'));
const lp = ler('LojaPedido');
t('LojaPedido.create so admin', so_admin(lp.create));
t('LojaPedido.delete so admin', so_admin(lp.delete));
t('LojaPedido.read dono', dono(lp.read, 'revendedor_id'));

// ---- etapa 2 (itens 5 a 9)
const escritaAdmin = (e) => ['create', 'update', 'delete'].forEach((op) => t(`${e}.${op} so admin`, so_admin(ler(e)[op])));
for (const e of ['AssinaturaUsuario', 'FaturaAssinatura', 'MetodoPagamento', 'PlanoServico', 'LojaCliente', 'AcordoFabricante',
  'Revendedor', 'Fabricante', 'FabricantePerfilPublico', 'PreCadastro', 'InscricaoApp', 'TabelaFrete', 'FabricanteChina', 'AprovacaoUsuario']) escritaAdmin(e);
for (const [e, c] of [['AssinaturaUsuario', 'usuario_id'], ['FaturaAssinatura', 'usuario_id'], ['MetodoPagamento', 'usuario_id'],
  ['LojaCliente', 'revendedor_id'], ['InscricaoApp', 'user_id'], ['AprovacaoUsuario', 'user_id']]) t(`${e}.read dono`, dono(ler(e).read, c));
for (const e of ['AcordoFabricante', 'Revendedor', 'PreCadastro']) t(`${e}.read so admin`, so_admin(ler(e).read));
for (const [e, c] of [['AcordoComissao', 'revendedor_id'], ['IAConfig', 'revendedor_id']])
  for (const op of ['read', 'create', 'update', 'delete']) t(`${e}.${op} dono`, dono(ler(e)[op], c));
for (const [e, c] of [['AIKnowledge', 'supplier_id'], ['FreightOffer', 'supplier_id'], ['TransportadorRota', 'transportador_id']])
  for (const op of ['create', 'update', 'delete']) t(`${e}.${op} dono`, dono(ler(e)[op], c));
const porCriador = (r) => JSON.stringify(r || {}).includes('"created_by_id":"{{user.id}}"');
for (const e of ['ChatHistory', 'PedidoChina']) for (const op of ['read', 'update', 'delete']) t(`${e}.${op} criador`, porCriador(ler(e)[op]));
t('Notification.read destinatario', dono(ler('Notification').read, 'supplier_id'));
t('Notification.update destinatario', dono(ler('Notification').update, 'supplier_id'));

console.log(`${ok} ok, ${falhas} falha(s)`);
if (falhas) process.exit(1);
