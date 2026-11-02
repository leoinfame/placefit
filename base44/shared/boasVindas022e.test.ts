// Rodar a partir da raiz do app:  deno test -A --no-check base44/shared/boasVindas022e.test.ts
// Item 022e: resposta automática ao lead novo, Orçamento → Negociação, venda → Ganho.
import { textoBoasVindas, deveMandarBoasVindas } from './conversaWaha.ts';
import { etapaDepoisDaResposta, moverLeadParaGanho } from './funilCrm.js';

function ok(c: boolean, m: string) { if (!c) throw new Error('falhou: ' + m); }

Deno.test('boas-vindas: só conversa nova, mensagem do cliente, sem cadastro, chave ligada', () => {
  ok(deveMandarBoasVindas({ _nova: true, cliente_id: '' }, false, ''), 'lead novo recebe');
  ok(!deveMandarBoasVindas({ _nova: true }, true, ''), 'mensagem do dono não dispara');
  ok(!deveMandarBoasVindas({ cliente_id: '' }, false, ''), 'conversa antiga não recebe de novo');
  ok(!deveMandarBoasVindas({ _nova: true, cliente_id: 'c1' }, false, ''), 'cliente já cadastrado não recebe');
  ok(!deveMandarBoasVindas({ _nova: true }, false, 'OFF'), 'CRM_BOAS_VINDAS=off desliga');
  ok(!deveMandarBoasVindas(null, false, ''), 'sem conversa não dispara');
});

Deno.test('boas-vindas: texto com primeiro nome, link da tabela e pedido de lista + CNPJ', () => {
  const t = textoBoasVindas('MuscularFit', 'Carlos Silva', 'https://app.placefit.com.br/PublicTable?supplier=x');
  ok(t.startsWith('Olá, Carlos!'), 'saudação com primeiro nome');
  ok(t.includes('https://app.placefit.com.br/PublicTable?supplier=x'), 'link da tabela');
  ok(t.includes('CNPJ') && t.includes('quantidades'), 'pede lista e CNPJ');
  ok(!/base44/i.test(t), 'nunca link base44');
  ok(textoBoasVindas('', '', 'L').startsWith('Olá! Aqui é da MuscularFit'), 'sem nome nem empresa');
});

Deno.test('negociação: só sai de Orçamento', () => {
  ok(etapaDepoisDaResposta('orcamento') === 'negociacao', 'orcamento → negociacao');
  for (const e of ['novo', 'atendimento', 'negociacao', 'ganho', 'perdido', '', undefined]) ok(etapaDepoisDaResposta(e as any) === '', 'não mexe em ' + e);
});

Deno.test('ganho: venda leva a conversa do cliente para Ganho', async () => {
  const rows = [
    { id: 'a', owner_id: 'o', cliente_id: 'c1', telefone: '5531972070371', etapa: 'negociacao', ativo: true },
    { id: 'b', owner_id: 'o', cliente_id: 'c2', telefone: '5531900000000', etapa: 'orcamento', ativo: true }
  ];
  const entities = { CRMConversa: {
    async filter(q: any) { return rows.filter((r: any) => Object.entries(q).every(([k, v]) => typeof v === 'object' && v && '$regex' in (v as any) ? new RegExp((v as any).$regex).test(String(r[k] ?? '')) : (r[k] ?? '') === v)).map((r) => ({ ...r })); },
    async update(id: string, p: any) { Object.assign(rows.find((r) => r.id === id)!, p); }
  } };
  await moverLeadParaGanho(entities, 'o', { id: 'c1', telefone: '5531972070371' });
  ok(rows[0].etapa === 'ganho', 'cliente da venda em ganho');
  ok(rows[1].etapa === 'orcamento', 'outro cliente intacto');
  await moverLeadParaGanho(entities, 'o', null);
});
