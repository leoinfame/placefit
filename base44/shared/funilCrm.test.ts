// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/funilCrm.test.ts
// Item 022c: orçamento criado move o lead do cliente para "orcamento" (só avança). Banco em memória.
import { moverLeadParaOrcamento } from './funilCrm.js';

function eq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`falhou: ${msg} — esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}

function banco(conversas: any[]) {
  const rows = conversas.map((c) => ({ ...c }));
  const casa = (r: any, q: any) => Object.entries(q).every(([k, v]: [string, any]) =>
    v && typeof v === 'object' && '$regex' in v ? new RegExp(v.$regex).test(String(r[k] ?? '')) : (r[k] ?? '') === v);
  return {
    rows,
    entities: {
      CRMConversa: {
        async filter(q: any) { return rows.filter((r) => casa(r, q)).map((r) => ({ ...r })); },
        async update(id: string, p: any) { Object.assign(rows.find((r) => r.id === id), p); }
      }
    }
  };
}

Deno.test('lead novo do cliente vai para orçamento', async () => {
  const b = banco([{ id: 'c1', owner_id: 'dono', cliente_id: 'cli', etapa: 'novo', telefone: '553172070371', ativo: true }]);
  eq(await moverLeadParaOrcamento(b.entities, 'dono', { id: 'cli', telefone: '553172070371' }), 1, 'mudou 1');
  eq(b.rows[0].etapa, 'orcamento', 'etapa');
});

Deno.test('conversa do mesmo telefone ainda sem cliente é ligada e movida', async () => {
  const b = banco([{ id: 'c1', owner_id: 'dono', cliente_id: '', etapa: 'atendimento', telefone: '553172070371', ativo: true }]);
  await moverLeadParaOrcamento(b.entities, 'dono', { id: 'cli', telefone: '(31) 7207-0371' });
  eq(b.rows[0].cliente_id, 'cli', 'ligada');
  eq(b.rows[0].etapa, 'orcamento', 'movida');
});

Deno.test('negociação, ganho e perdido não voltam; outro dono não é tocado', async () => {
  const b = banco([
    { id: 'n', owner_id: 'dono', cliente_id: 'cli', etapa: 'negociacao', ativo: true },
    { id: 'g', owner_id: 'dono', cliente_id: 'cli', etapa: 'ganho', ativo: true },
    { id: 'x', owner_id: 'outro', cliente_id: 'cli', etapa: 'novo', ativo: true },
  ]);
  eq(await moverLeadParaOrcamento(b.entities, 'dono', { id: 'cli', telefone: '' }), 0, 'nada muda');
  eq(b.rows.map((r) => r.etapa), ['negociacao', 'ganho', 'novo'], 'etapas mantidas');
});

Deno.test('falha no CRM não derruba o orçamento', async () => {
  const quebrado = { CRMConversa: { async filter() { throw new Error('fora'); } } };
  eq(await moverLeadParaOrcamento(quebrado, 'dono', { id: 'cli' }), 0, 'devolve 0 sem lançar');
});
