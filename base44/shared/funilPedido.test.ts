// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/funilPedido.test.ts
// Item 028: etapa automática do funil a partir do Pedido. Banco em memória.
import { aplicarFunilDoPedido, etapaAlvoDoPedido, funilAvanca } from './funilCrm.js';

function eq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`falhou: ${msg} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}

function banco(conversas: any[], clientes: any[] = []) {
  const rows = conversas.map((c) => ({ ...c }));
  const cli = clientes.map((c) => ({ ...c }));
  const casa = (r: any, q: any) => Object.entries(q).every(([k, v]: [string, any]) =>
    v && typeof v === 'object' && '$regex' in v ? new RegExp(v.$regex).test(String(r[k] ?? '')) : (r[k] ?? '') === v);
  return {
    rows,
    entities: {
      CRMConversa: {
        async filter(q: any) { return rows.filter((r) => casa(r, q)).map((r) => ({ ...r })); },
        async update(id: string, p: any) { Object.assign(rows.find((r) => r.id === id), p); }
      },
      Cliente: {
        async filter(q: any) { return cli.filter((r) => casa(r, q)).map((r) => ({ ...r })); }
      }
    }
  };
}

Deno.test('orçamento levado ao cliente pela conversa → etapa orcamento', async () => {
  const b = banco([{ id: 'c1', owner_id: 'dono', cliente_id: 'cli', etapa: 'atendimento', telefone: '553172070371', ativo: true }]);
  eq(await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli', tipo: 'orcamento', status: 'pendente' }), 1, 'mudou 1');
  eq(b.rows[0].etapa, 'orcamento', 'etapa');
});

Deno.test('conversa ainda sem cliente é achada pelo telefone do cadastro', async () => {
  const b = banco(
    [{ id: 'c1', owner_id: 'dono', cliente_id: '', etapa: 'novo', telefone: '553172070371', ativo: true }],
    [{ id: 'cli', telefone: '(31) 7207-0371' }]
  );
  await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli', tipo: 'orcamento', status: 'pendente' });
  eq(b.rows[0].etapa, 'orcamento', 'movida pelo telefone');
  eq(b.rows[0].cliente_id, '', 'não escreve no cadastro da conversa');
});

Deno.test('pedido que vira venda → ganho, de orçamento ou de negociação', async () => {
  const b = banco([
    { id: 'o', owner_id: 'dono', cliente_id: 'cli', etapa: 'orcamento', ativo: true },
    { id: 'n', owner_id: 'dono', cliente_id: 'cli2', etapa: 'negociacao', ativo: true },
    { id: 'x', owner_id: 'dono', cliente_id: 'cli3', etapa: 'perdido', ativo: true }
  ]);
  eq(await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli', tipo: 'venda', status: 'confirmado' }), 1, 'orçamento → ganho');
  await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli2', tipo: 'venda', status: 'enviado' });
  await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli3', tipo: 'venda', status: 'entregue' });
  eq(b.rows.map((r) => r.etapa), ['ganho', 'ganho', 'perdido'], 'perdido não volta sozinho');
});

Deno.test('nunca volta: negociacao/ganho/perdido não descem para orcamento', async () => {
  const b = banco([
    { id: 'n', owner_id: 'dono', cliente_id: 'cli', etapa: 'negociacao', ativo: true },
    { id: 'g', owner_id: 'dono', cliente_id: 'cli2', etapa: 'ganho', ativo: true },
    { id: 'p', owner_id: 'dono', cliente_id: 'cli3', etapa: 'perdido', ativo: true }
  ]);
  eq(await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli', tipo: 'orcamento' }), 0, 'negociação intacta');
  await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli2', tipo: 'orcamento' });
  await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli3', tipo: 'orcamento' });
  eq(b.rows.map((r) => r.etapa), ['negociacao', 'ganho', 'perdido'], 'etapas mantidas');
});

Deno.test('cliente sem conversa não ganha conversa nova', async () => {
  const b = banco([]);
  eq(await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'sem-conversa', tipo: 'orcamento' }), 0, 'nada criado');
  eq(b.rows.length, 0, 'continua sem conversa');
});

Deno.test('venda cancelada e pedido de outro dono ficam fora', async () => {
  const b = banco([
    { id: 'a', owner_id: 'dono', cliente_id: 'cli', etapa: 'orcamento', ativo: true },
    { id: 'b', owner_id: 'outro', cliente_id: 'cli2', etapa: 'orcamento', ativo: true }
  ]);
  eq(etapaAlvoDoPedido({ tipo: 'venda', status: 'cancelado' }), '', 'cancelada não pede etapa');
  eq(await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli', tipo: 'venda', status: 'cancelado' }), 0, 'cancelada não move');
  await aplicarFunilDoPedido(b.entities, { fornecedor_id: 'dono', cliente_id: 'cli2', tipo: 'venda', status: 'confirmado' });
  eq(b.rows.map((r) => r.etapa), ['orcamento', 'orcamento'], 'outro dono intacto');
});

Deno.test('falha no CRM não lança', async () => {
  const quebrado = { CRMConversa: { async filter() { throw new Error('fora'); } } };
  eq(await aplicarFunilDoPedido(quebrado, { fornecedor_id: 'dono', cliente_id: 'cli', tipo: 'orcamento' }), 0, 'devolve 0');
});

Deno.test('ordem das etapas: só avança', () => {
  eq(funilAvanca('novo', 'orcamento'), 'orcamento', 'novo → orcamento');
  eq(funilAvanca('atendimento', 'orcamento'), 'orcamento', 'atendimento → orcamento');
  eq(funilAvanca('orcamento', 'ganho'), 'ganho', 'orcamento → ganho');
  eq(funilAvanca('negociacao', 'orcamento'), '', 'negociação não desce');
  eq(funilAvanca('ganho', 'ganho'), '', 'ganho fica');
  eq(funilAvanca('perdido', 'ganho'), '', 'perdido fica');
});