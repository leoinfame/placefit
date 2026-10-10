import { DB, USERS } from './mock.ts';
// Teste de ponta a ponta da funcao hubApi contra um banco em memoria (mock.ts).
// Rodar a partir da raiz do app:  deno run --allow-all base44/shared/hub-e2e/e2e.ts
// Copia entry.ts para /tmp trocando o import do SDK pelo mock; nada toca o banco real.
const origem = new URL('../../functions/hubApi/entry.ts', import.meta.url);
const destino = await Deno.makeTempDir();
const fonte = (await Deno.readTextFile(origem))
  .replace(/import \{ createClientFromRequest \} from 'npm:@base44\/sdk@[^']+';/, `import { createClientFromRequest } from '${new URL('./mock.ts', import.meta.url).href}';`)
  .replace("'../../shared/hubFluxo.ts'", `'${new URL('../hubFluxo.ts', import.meta.url).href}'`);
await Deno.writeTextFile(`${destino}/entry.ts`, fonte);
let handler: (r: Request) => Promise<Response>;
(Deno as any).serve = (h: any) => { handler = h; };
await import(`file://${destino}/entry.ts`);
// sem webhook real
globalThis.fetch = async () => new Response('ok');

const chamar = async (uid: string, corpo: any) => {
  const r = await handler(new Request('http://x', { method: 'POST', headers: { 'x-user': uid }, body: JSON.stringify(corpo) }));
  return { ...(await r.json()), http: r.status };
};
let ok = 0, falha = 0;
const passo = (nome: string, cond: boolean, extra?: unknown) => { if (cond) ok++; else { falha++; console.log('FALHOU', nome, JSON.stringify(extra)); } };
const espera = async (nome: string, uid: string, corpo: any, status = 200) => {
  const r = await chamar(uid, corpo); passo(nome, r.http === status, r); return r;
};

// Cenario: revenda MuscularFit, pedido com 2 fabricantes
Object.assign(USERS, {
  admin: { id: 'admin', role: 'admin', full_name: 'Leandro' },
  revenda: { id: 'revenda', role: 'user', full_name: 'MuscularFit' },
  outra: { id: 'outra', role: 'user', full_name: 'Outra revenda' },
  col1: { id: 'col1', role: 'user', full_name: 'Joao Coletor' },
  col2: { id: 'col2', role: 'user', full_name: 'Zé Coletor' },
  base1: { id: 'base1', role: 'user', full_name: 'Maria Base' },
  fret1: { id: 'fret1', role: 'user', full_name: 'Carlos Frete' },
  curioso: { id: 'curioso', role: 'user', full_name: 'Sem perfil' },
});
DB.User = Object.values(USERS);
DB.HubBase = [{ id: 'B1', nome: 'Galpão Cláudio' }];
DB.HubConfig = [
  { id: 'cfgG', escopo: 'global', taxa_falsa_coleta: 50, base_padrao_id: 'B1' },
  { id: 'cfgR', escopo: 'revenda', revendedor_id: 'revenda', revendedor_nome: 'MuscularFit', flag: 'hub_muscularfit', hub_ativo: true },
];
DB.TransportProfile = [
  { id: 'Pc1', user_id: 'col1', tipo: 'coletor', nome: 'João', cidades: ['Cláudio'], limite_valor: 10000, verificacao: 'verificado', ativo: true },
  { id: 'Pc2', user_id: 'col2', tipo: 'coletor', nome: 'Zé', cidades: ['Divinópolis'], verificacao: 'verificado', ativo: true },
  { id: 'Pb1', user_id: 'base1', tipo: 'base', nome: 'Maria', base_id: 'B1', verificacao: 'verificado', ativo: true },
  { id: 'Pf1', user_id: 'fret1', tipo: 'fretista', nome: 'Carlos', ufs: ['SP'], verificacao: 'verificado', ativo: true },
];
DB.Fabricante = [
  { id: 'F1', nome_fantasia: 'Metal Forma', cidade: 'Cláudio', estado: 'MG', endereco: 'Rua A, 1', whatsapp: '37999990000' },
  { id: 'F2', nome_fantasia: 'Anilhas e Halteres Brasil', cidade: 'Cláudio', estado: 'MG', endereco: 'Rua B, 2' },
];
DB.Cliente = [{ id: 'C1', nome: 'Academia Força', cidade: 'Campinas', estado: 'SP', endereco: 'Av. X, 10', telefone: '19999' }];
DB.Pedido = [{ id: 'V1', fornecedor_id: 'revenda', cliente_id: 'C1', cliente_nome: 'Academia Força', numero_pedido: 'ORC-1' }];
DB.PedidoCompra = [
  { id: 'PC1', revendedor_id: 'revenda', revendedor_nome: 'MuscularFit', fabricante_id: 'pendente', fabricante_nome: 'Metal Forma', venda_id: 'V1', total: 2000, itens: [{ product_id: 'T1', nome: 'Barra 1,2m', quantidade: 2 }], status: 'rascunho' },
  { id: 'PC2', revendedor_id: 'revenda', revendedor_nome: 'MuscularFit', fabricante_id: 'pendente', fabricante_nome: 'Anilhas e Halteres Brasil', venda_id: 'V1', total: 900, itens: [{ product_id: 'SP2', nome: 'Anilha 10kg', quantidade: 4 }, { product_id: 'T9', nome: 'Presilha', quantidade: 2 }], status: 'rascunho' },
];
DB.ProductTemplate = [{ id: 'T1', peso_kg: 10 }, { id: 'T2', peso_kg: 10 }, { id: 'T9' }];
DB.SupplierProduct = [{ id: 'SP2', product_id: 'T2' }];

// Acesso
await espera('sem perfil nao entra', 'curioso', { acao: 'fila_coletor' }, 403);
const ctxCol = await espera('contexto coletor', 'col1', { acao: 'contexto' });
passo('contexto tem perfil', ctxCol.perfis?.[0]?.tipo === 'coletor', ctxCol);
await espera('outra revenda sem hub', 'outra', { acao: 'acompanhar' }, 403);
await espera('coletor nao inclui pedido', 'col1', { acao: 'incluir_pedido', venda_id: 'V1' }, 403);

// Admin: lista e sugere fabricante pelo nome
const ap = await espera('admin_pedidos', 'admin', { acao: 'admin_pedidos' });
passo('peso estimado na lista', ap.pedidos?.[0]?.subpedidos?.find((s: any) => s.pedido_compra_id === 'PC2')?.peso_estimado?.sem_peso === 1, ap.pedidos?.[0]?.subpedidos);
passo('destino sugerido', ap.pedidos?.[0]?.destino_sugerido?.cidade === 'Campinas', ap.pedidos?.[0]?.destino_sugerido);
passo('sugere fabricante', ap.pedidos?.[0]?.subpedidos?.find((s: any) => s.pedido_compra_id === 'PC1')?.fabricante_sugerido === 'F1', ap.pedidos?.[0]);
const sug = Object.fromEntries(ap.pedidos[0].subpedidos.map((s: any) => [s.pedido_compra_id, { fabricante_id: s.fabricante_sugerido, valor_coleta: s.pedido_compra_id === 'PC1' ? 80 : '' }]));
await espera('incluir pedido', 'admin', { acao: 'incluir_pedido', papel: 'admin', venda_id: 'V1', subpedidos: sug, valor_frete: 0 });
await espera('incluir de novo bloqueia', 'admin', { acao: 'incluir_pedido', papel: 'admin', venda_id: 'V1', subpedidos: sug }, 409);
const [pk1, pk2] = DB.Pickup;
const fr = DB.FreightLeg[0];
passo('2 coletas + 1 frete', DB.Pickup.length === 2 && DB.FreightLeg.length === 1);
passo('destino do cliente', fr.destino_cidade === 'Campinas' && fr.destino_uf === 'SP', fr);
passo('peso estimado completo', pk1.peso_kg === 20 && pk1.peso_origem === 'estimado', pk1);
passo('peso parcial via SupplierProduct', pk2.peso_kg === 40 && pk2.peso_origem === 'estimado_parcial', pk2);
passo('itens gravados', pk2.itens?.length === 2 && pk2.itens[0].nome === 'Anilha 10kg', pk2.itens);
passo('destino origem cliente', fr.destino_origem === 'cadastro_cliente', fr);
passo('endereco do fabricante', pk1.fabricante_endereco === 'Rua A, 1' && pk1.fabricante_cidade === 'Cláudio', pk1);

// Pronto: sem valor nao vai; coletor nao marca; base marca com confirmacao
await espera('pronto sem valor', 'base1', { acao: 'marcar_pronto', pickup_id: pk2.id, confirmacao: 'zap' }, 409);
await espera('admin define valor', 'admin', { acao: 'definir_valores', pickup_id: pk2.id, valor_coleta: 60 });
await espera('pronto sem confirmacao', 'base1', { acao: 'marcar_pronto', pickup_id: pk1.id }, 400);
await espera('coletor nao marca pronto', 'col1', { acao: 'marcar_pronto', pickup_id: pk1.id, confirmacao: 'x' }, 403);
await espera('base marca pronto 1', 'base1', { acao: 'marcar_pronto', pickup_id: pk1.id, confirmacao: 'WhatsApp com Lucas 14h' });
await espera('admin marca pronto 2', 'admin', { acao: 'marcar_pronto', papel: 'admin', pickup_id: pk2.id, confirmacao: 'WhatsApp 15h' });
passo('coletor notificado do pronto', DB.HubNotificacao.some((n: any) => n.destinatario_user_id === 'col1' && n.tipo === 'pronto'));
passo('coletor de outra cidade nao notificado', !DB.HubNotificacao.some((n: any) => n.destinatario_user_id === 'col2'));

// Fila por regiao
const fila1 = await espera('fila col1', 'col1', { acao: 'fila_coletor' });
passo('col1 ve 2 e com valor', fila1.coletas?.length === 2 && fila1.coletas.every((c: any) => c.valor_coleta > 0), fila1);
passo('fila nao vaza qr', fila1.coletas?.every((c: any) => !('qr_token' in c)), fila1.coletas?.[0]);
const fila2 = await espera('fila col2', 'col2', { acao: 'fila_coletor' });
passo('col2 (Divinópolis) nao ve', fila2.coletas?.length === 0, fila2);

// Coleta 1: aceitar, janela, coletar com QR + foto
await espera('col2 nao aceita fora da regiao', 'col2', { acao: 'acao_pickup', pickup_id: pk1.id, acao_pickup: 'aceitar' }, 403);
await espera('col1 aceita', 'col1', { acao: 'acao_pickup', pickup_id: pk1.id, acao_pickup: 'aceitar' });
await espera('aceitar de novo', 'col1', { acao: 'acao_pickup', pickup_id: pk1.id, acao_pickup: 'aceitar' }, 409);
await espera('janela sem horario', 'col1', { acao: 'acao_pickup', pickup_id: pk1.id, acao_pickup: 'confirmar_janela' }, 400);
await espera('janela', 'col1', { acao: 'acao_pickup', pickup_id: pk1.id, acao_pickup: 'confirmar_janela', janela_inicio: '2026-10-11T13:00:00Z' });
const qr1 = `PFHUB:P:${DB.Pickup[0].qr_token}`;
const qr2 = `PFHUB:P:${DB.Pickup[1].qr_token}`;
const foto = 'https://cdn/foto.jpg';
await espera('coletar sem foto', 'col1', { acao: 'custodia', tipo: 'coletado_no_fabricante', papel: 'coletor', qr: qr1 }, 400);
await espera('coletar QR de outra coleta', 'col1', { acao: 'custodia', tipo: 'coletado_no_fabricante', papel: 'coletor', qr: qr2, pickup_id: pk1.id, foto_url: foto }, 409);
await espera('coletar com QR do mestre', 'col1', { acao: 'custodia', tipo: 'coletado_no_fabricante', papel: 'coletor', qr: `PFHUB:F:${fr.qr_mestre_token}`, foto_url: foto }, 400);
await espera('coletar ok', 'col1', { acao: 'custodia', tipo: 'coletado_no_fabricante', papel: 'coletor', qr: qr1, pickup_id: pk1.id, foto_url: foto, lat: -20.4, lng: -44.7, precisao_m: 12 });
passo('evento com geo', DB.CustodyEvent.at(-1).geo_status === 'ok' && DB.CustodyEvent.at(-1).ator_papel === 'coletor', DB.CustodyEvent.at(-1));
passo('base notificada da coleta', DB.HubNotificacao.some((n: any) => n.destinatario_user_id === 'base1' && n.tipo === 'coletado_no_fabricante'));
await espera('escanear duas vezes', 'col1', { acao: 'custodia', tipo: 'coletado_no_fabricante', papel: 'coletor', qr: qr1, foto_url: foto }, 409);
await espera('conferir antes de chegar', 'base1', { acao: 'custodia', tipo: 'conferido', papel: 'base', qr: qr1, foto_url: foto }, 409);
await espera('entregar na base (digitado)', 'col1', { acao: 'custodia', tipo: 'entregue_na_base', papel: 'coletor', qr: DB.Pickup[0].qr_token.toLowerCase(), qr_digitado: true, foto_url: foto, geo_status: 'negado' });
passo('evento sem geo registrado', DB.CustodyEvent.at(-1).geo_status === 'negado' && DB.CustodyEvent.at(-1).qr_digitado === true);
await espera('coletor nao confere', 'col1', { acao: 'custodia', tipo: 'conferido', papel: 'coletor', qr: qr1, foto_url: foto }, 403);
const et1 = await espera('base le etiqueta', 'base1', { acao: 'ler_etiqueta', qr: qr1 });
passo('etiqueta traz itens', et1.itens?.length === 1 && et1.itens[0].quantidade === 2, et1);
await espera('coletor nao le etiqueta', 'col1', { acao: 'ler_etiqueta', qr: qr1 }, 403);
await espera('conferir sem checklist', 'base1', { acao: 'custodia', tipo: 'conferido', papel: 'base', qr: qr1, foto_url: foto }, 400);
await espera('base confere', 'base1', { acao: 'custodia', tipo: 'conferido', papel: 'base', qr: qr1, foto_url: foto, checklist: [{ ok: true }] });
passo('sem divergencia', !DB.Pickup[0].divergencia && DB.CustodyEvent.at(-1).checklist?.[0]?.ok === true, DB.CustodyEvent.at(-1));
passo('pagamento da coleta lancado', DB.HubLancamento.some((l: any) => l.tipo === 'pagamento_coleta' && l.valor === 80 && l.favorecido_nome === 'João'));

// Coleta 2: falsa coleta -> taxa -> pronto de novo -> coleta normal
await espera('col1 aceita 2', 'col1', { acao: 'acao_pickup', pickup_id: pk2.id, acao_pickup: 'aceitar' });
await espera('falsa sem foto', 'col1', { acao: 'falsa_coleta', pickup_id: pk2.id }, 400);
await espera('falsa coleta', 'col1', { acao: 'falsa_coleta', pickup_id: pk2.id, foto_url: foto, observacao: 'faltava pintura' });
const taxa = DB.HubLancamento.find((l: any) => l.tipo === 'taxa_falsa_coleta');
passo('taxa R$50 fabricante->coletor', taxa?.valor === 50 && taxa.devedor_tipo === 'fabricante' && taxa.devedor_id === 'F2' && taxa.favorecido_id === 'Pc1' && taxa.status_recebimento === 'pendente', taxa);
passo('admin avisado da falsa', DB.HubNotificacao.some((n: any) => n.destinatario_user_id === 'admin' && n.tipo === 'falsa_coleta'));
passo('pickup volta sem coletor', DB.Pickup[1].status === 'falsa_coleta' && !DB.Pickup[1].coletor_user_id && DB.Pickup[1].falsas_coletas === 1);
await espera('nao aparece na fila antes do pronto', 'col1', { acao: 'fila_coletor' });
await espera('consolidar com um faltando', 'base1', { acao: 'consolidar', freight_leg_id: fr.id }, 409);
await espera('pronto de novo', 'base1', { acao: 'marcar_pronto', pickup_id: pk2.id, confirmacao: 'agora sim, 17h' });
await espera('aceita 2 de novo', 'col1', { acao: 'acao_pickup', pickup_id: pk2.id, acao_pickup: 'aceitar' });
await espera('coleta 2', 'col1', { acao: 'custodia', tipo: 'coletado_no_fabricante', papel: 'coletor', qr: qr2, foto_url: foto });
await espera('base recebe 2 (coletor esqueceu)', 'base1', { acao: 'custodia', tipo: 'entregue_na_base', papel: 'base', qr: qr2, foto_url: foto });
await espera('base confere 2 com divergencia', 'base1', { acao: 'custodia', tipo: 'conferido', papel: 'base', qr: qr2, foto_url: foto,
  checklist: [{ ok: false, quantidade_recebida: 3 }, { ok: true }], divergencia: '1 anilha amassada' });
passo('divergencia nasce do checklist', DB.Pickup[1].divergencia === 'Veio 3 de 4: Anilha 10kg; Obs.: 1 anilha amassada', DB.Pickup[1].divergencia);
passo('admin avisado com divergencia', DB.HubNotificacao.some((n: any) => n.tipo === 'conferido' && /Veio 3 de 4/.test(n.mensagem)));

// Consolidacao e frete
const pb = await espera('painel base', 'base1', { acao: 'painel_base' });
passo('painel: pedido pronto p/ consolidar', pb.para_consolidar?.[0]?.pronto === true, pb.para_consolidar);
const cons = await espera('consolidar', 'base1', { acao: 'consolidar', freight_leg_id: fr.id });
passo('qr mestre gerado', String(cons.frete?.qr || '').startsWith('PFHUB:F:'), cons);
const qrM = cons.frete.qr;
await espera('escanear subpedido no lugar do mestre', 'base1', { acao: 'custodia', tipo: 'pedido_consolidado', papel: 'base', qr: qr1, foto_url: foto }, 400);
await espera('consolidado', 'base1', { acao: 'custodia', tipo: 'pedido_consolidado', papel: 'base', qr: qrM, foto_url: foto });
passo('admin avisado do consolidado', DB.HubNotificacao.some((n: any) => n.destinatario_user_id === 'admin' && n.tipo === 'pedido_consolidado'));
await espera('liberar sem valor de frete', 'base1', { acao: 'acao_frete', freight_leg_id: fr.id, acao_frete: 'liberar', papel: 'base' }, 409);
await espera('base nao define valor', 'base1', { acao: 'definir_valores', freight_leg_id: fr.id, valor_frete: 999 }, 403);
await espera('admin define frete', 'admin', { acao: 'definir_valores', freight_leg_id: fr.id, valor_frete: 450 });
await espera('liberar', 'base1', { acao: 'acao_frete', freight_leg_id: fr.id, acao_frete: 'liberar', papel: 'base' });
const ff = await espera('fila fretista', 'fret1', { acao: 'fila_fretista' });
passo('fretista SP ve com valor', ff.fretes?.length === 1 && ff.fretes[0].valor_frete === 450, ff);
await espera('fretista aceita', 'fret1', { acao: 'acao_frete', freight_leg_id: fr.id, acao_frete: 'aceitar' });
await espera('retirar com qr de subpedido', 'fret1', { acao: 'custodia', tipo: 'retirado_pelo_fretista', papel: 'fretista', qr: qr1, foto_url: foto }, 400);
await espera('retirado', 'fret1', { acao: 'custodia', tipo: 'retirado_pelo_fretista', papel: 'fretista', qr: qrM, foto_url: foto });
const nRev = DB.HubNotificacao.find((n: any) => n.destinatario_user_id === 'revenda' && n.tipo === 'retirado_pelo_fretista');
passo('revenda: saiu para entrega', !!nRev && /saiu para entrega/.test(nRev.mensagem), nRev);
await espera('entregar sem recebedor', 'fret1', { acao: 'custodia', tipo: 'entregue_ao_cliente', papel: 'fretista', qr: qrM, foto_url: foto }, 400);
await espera('entregue', 'fret1', { acao: 'custodia', tipo: 'entregue_ao_cliente', papel: 'fretista', qr: qrM, foto_url: foto, recebedor_nome: 'Paulo (gerente)' });
passo('pagamento do frete lancado', DB.HubLancamento.some((l: any) => l.tipo === 'pagamento_frete' && l.valor === 450 && l.favorecido_nome === 'Carlos'));
const ac = await espera('revenda acompanha', 'revenda', { acao: 'acompanhar' });
passo('acompanhar entregue', ac.pedidos?.[0]?.status === 'entregue' && ac.pedidos[0].recebedor_nome === 'Paulo (gerente)', ac.pedidos?.[0]);
passo('eventos de custodia (6 tipos + falsa)', new Set(DB.CustodyEvent.map((e: any) => e.tipo)).size === 7, DB.CustodyEvent.map((e: any) => e.tipo));
await espera('marcar lidas', 'revenda', { acao: 'marcar_lidas' });
passo('lidas', DB.HubNotificacao.filter((n: any) => n.destinatario_user_id === 'revenda').every((n: any) => n.lida));

// Pedido da vitrine sem pedido interno: destino vem do endereco de entrega
DB.LojaPedido = [{ id: 'L1', revendedor_id: 'revenda', numero_pedido: 'LOJA-1', cliente_nome: 'Maria Silva', cliente_telefone: '31 98888',
  endereco_entrega: { logradouro: 'Rua das Flores', numero: '42', bairro: 'Centro', cidade: 'Belo Horizonte', estado: 'mg', cep: '30000-000' } }];
DB.PedidoCompra.push({ id: 'PC3', revendedor_id: 'revenda', revendedor_nome: 'MuscularFit', fabricante_id: 'F1', fabricante_nome: 'Metal Forma', venda_id: 'L1', total: 300, itens: [{ product_id: 'T1', nome: 'Barra 1,2m', quantidade: 1 }], status: 'pendente' });
const ap2 = await espera('admin_pedidos com vitrine', 'admin', { acao: 'admin_pedidos' });
const pv = ap2.pedidos?.find((p: any) => p.venda_id === 'L1');
passo('vitrine aparece com cliente e destino', pv?.cliente_nome === 'Maria Silva' && pv?.destino_sugerido?.origem === 'pedido_vitrine', pv);
await espera('incluir vitrine', 'admin', { acao: 'incluir_pedido', papel: 'admin', venda_id: 'L1', subpedidos: { PC3: { fabricante_id: 'F1', valor_coleta: 40, peso_kg: 12 } } });
const fv = DB.FreightLeg.find((f: any) => f.venda_id === 'L1');
passo('destino da vitrine gravado', fv?.destino_cidade === 'Belo Horizonte' && fv.destino_uf === 'MG' && fv.destino_endereco === 'Rua das Flores, 42 — Centro' && fv.destino_origem === 'pedido_vitrine' && fv.cliente_nome === 'Maria Silva', fv);
const pv3 = DB.Pickup.find((p: any) => p.venda_id === 'L1');
passo('peso informado vence estimativa', pv3?.peso_kg === 12 && pv3.peso_origem === 'informado', pv3);
// manual continua valendo
DB.PedidoCompra.push({ id: 'PC4', revendedor_id: 'revenda', revendedor_nome: 'MuscularFit', fabricante_id: 'F1', fabricante_nome: 'Metal Forma', venda_id: 'L2', total: 100, itens: [], status: 'pendente' });
await espera('incluir sem destino com manual', 'admin', { acao: 'incluir_pedido', papel: 'admin', venda_id: 'L2', destino_cidade: 'Divinópolis', destino_uf: 'mg' });
const fm = DB.FreightLeg.find((f: any) => f.venda_id === 'L2');
passo('destino manual', fm?.destino_cidade === 'Divinópolis' && fm.destino_uf === 'MG' && fm.destino_origem === 'manual', fm);

// Flag desligada fecha o hub para a revenda
DB.HubConfig[1].hub_ativo = false;
await espera('flag desligada', 'revenda', { acao: 'acompanhar' }, 403);
// Perfil nao verificado nao ve fila
DB.TransportProfile[0].verificacao = 'pendente';
await espera('coletor pendente', 'col1', { acao: 'fila_coletor' }, 403);

if (falha) Deno.exitCode = 1;
console.log(`${ok} ok, ${falha} falha(s) · eventos ${DB.CustodyEvent.length} · notificacoes ${DB.HubNotificacao.length} · lancamentos ${DB.HubLancamento.length}`);
