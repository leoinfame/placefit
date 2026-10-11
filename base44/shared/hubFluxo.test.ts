// deno run base44/shared/hubFluxo.test.ts
import {
  validarCustodia, validarAcao, ACOES_PICKUP, ACOES_FRETE, lerQr, conteudoQr, gerarToken,
  pickupVisivelParaColetor, freteVisivelParaFretista, prontoParaConsolidar, ErroHub,
  estimarPeso, resolverDestino, conferirChecklist, vendaEfetivada, pcEntraNoHub,
  estadoConvite, validarConvite, dadosDoAceite,
} from './hubFluxo.ts';

let ok = 0, falhas = 0;
function t(nome: string, fn: () => void) {
  try { fn(); ok++; } catch (e) { falhas++; console.log('FALHOU:', nome, '-', (e as Error).message); }
}
function igual(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}
function erro(fn: () => unknown, status?: number) {
  try { fn(); } catch (e) {
    if (!(e instanceof ErroHub)) throw e;
    if (status && e.status !== status) throw new Error(`status ${e.status}, esperado ${status}`);
    return;
  }
  throw new Error('deveria ter dado erro');
}

// Caminho feliz completo da coleta
t('pronto', () => igual(validarAcao(ACOES_PICKUP, 'marcar_pronto', 'aguardando_pronto', 'base'), 'disponivel'));
t('aceitar', () => igual(validarAcao(ACOES_PICKUP, 'aceitar', 'disponivel', 'coletor'), 'aceita'));
t('janela', () => igual(validarAcao(ACOES_PICKUP, 'confirmar_janela', 'aceita', 'coletor'), 'janela_confirmada'));
t('coletado', () => igual(validarCustodia('coletado_no_fabricante', { status: 'janela_confirmada', dono_user_id: 'u1' }, 'coletor', 'u1'), { para: 'coletada', alvo: 'pickup' }));
t('na base', () => igual(validarCustodia('entregue_na_base', { status: 'coletada', dono_user_id: 'u1' }, 'coletor', 'u1').para, 'entregue_base'));
t('base recebe sem ser dona', () => igual(validarCustodia('entregue_na_base', { status: 'coletada', dono_user_id: 'u1' }, 'base', 'b9').para, 'entregue_base'));
t('conferido', () => igual(validarCustodia('conferido', { status: 'entregue_base' }, 'base', 'b9').para, 'conferida'));

// Frete
t('consolidado', () => igual(validarCustodia('pedido_consolidado', { status: 'aguardando_consolidacao' }, 'base', 'b9'), { para: 'consolidado', alvo: 'frete' }));
t('liberar', () => igual(validarAcao(ACOES_FRETE, 'liberar', 'consolidado', 'base'), 'disponivel'));
t('fretista aceita', () => igual(validarAcao(ACOES_FRETE, 'aceitar', 'disponivel', 'fretista'), 'aceito'));
t('retirado', () => igual(validarCustodia('retirado_pelo_fretista', { status: 'aceito', dono_user_id: 'f1' }, 'fretista', 'f1').para, 'retirado'));
t('entregue', () => igual(validarCustodia('entregue_ao_cliente', { status: 'retirado', dono_user_id: 'f1' }, 'fretista', 'f1').para, 'entregue'));

// Bloqueios
t('coletor nao confere', () => erro(() => validarCustodia('conferido', { status: 'entregue_base' }, 'coletor', 'u1'), 403));
t('coletor de outro', () => erro(() => validarCustodia('coletado_no_fabricante', { status: 'aceita', dono_user_id: 'u1' }, 'coletor', 'u2'), 403));
t('pular etapa', () => erro(() => validarCustodia('conferido', { status: 'coletada' }, 'base', 'b9'), 409));
t('coletar antes de aceitar', () => erro(() => validarCustodia('coletado_no_fabricante', { status: 'disponivel', dono_user_id: null }, 'coletor', 'u1'), 409));
t('escanear duas vezes', () => erro(() => validarCustodia('coletado_no_fabricante', { status: 'coletada', dono_user_id: 'u1' }, 'coletor', 'u1'), 409));
t('aceitar ja aceita', () => erro(() => validarAcao(ACOES_PICKUP, 'aceitar', 'aceita', 'coletor'), 409));
t('coletor nao marca pronto', () => erro(() => validarAcao(ACOES_PICKUP, 'marcar_pronto', 'aguardando_pronto', 'coletor'), 403));
t('base nao atribui', () => erro(() => validarAcao(ACOES_PICKUP, 'atribuir', 'disponivel', 'base'), 403));
t('liberar sem consolidar', () => erro(() => validarAcao(ACOES_FRETE, 'liberar', 'aguardando_consolidacao', 'base'), 409));
t('fretista nao retira de outro', () => erro(() => validarCustodia('retirado_pelo_fretista', { status: 'aceito', dono_user_id: 'f1' }, 'fretista', 'f2'), 403));
t('evento inventado', () => erro(() => validarCustodia('teletransportado', { status: 'aceita' }, 'admin', 'a')));

// Falsa coleta volta para a fila quando o fabricante confirma de novo
t('falsa coleta', () => igual(validarAcao(ACOES_PICKUP, 'falsa_coleta', 'janela_confirmada', 'coletor'), 'falsa_coleta'));
t('pronto de novo', () => igual(validarAcao(ACOES_PICKUP, 'marcar_pronto', 'falsa_coleta', 'admin'), 'disponivel'));
t('falsa depois de coletar nao', () => erro(() => validarAcao(ACOES_PICKUP, 'falsa_coleta', 'coletada', 'coletor'), 409));

// QR
t('qr ida e volta', () => igual(lerQr(conteudoQr('P', 'ABCDEF2345')), { tipo: 'P', token: 'ABCDEF2345' }));
t('qr digitado', () => igual(lerQr(' abcd ef2345 '), { tipo: null, token: 'ABCDEF2345' }));
t('qr estranho', () => erro(() => lerQr('https://golpe.com/x')));
t('token sem 0 O 1 I', () => { const k = gerarToken(200); if (/[01OI]/.test(k) || k.length !== 200) throw new Error(k); });

// Fila
const perfil = { id: 'p1', cidades: ['Cláudio'], limite_valor: 5000 };
t('fila cidade com acento', () => igual(pickupVisivelParaColetor({ status: 'disponivel', fabricante_cidade: 'CLAUDIO', valor_mercadoria: 100 }, perfil), true));
t('fila outra cidade', () => igual(pickupVisivelParaColetor({ status: 'disponivel', fabricante_cidade: 'Divinópolis' }, perfil), false));
t('fila acima do limite', () => igual(pickupVisivelParaColetor({ status: 'disponivel', fabricante_cidade: 'Cláudio', valor_mercadoria: 9000 }, perfil), false));
t('fila recusada', () => igual(pickupVisivelParaColetor({ status: 'disponivel', fabricante_cidade: 'Cláudio', recusada_por: ['p1'] }, perfil), false));
t('fabricante sem cidade aparece para todos', () => igual(pickupVisivelParaColetor({ status: 'disponivel', fabricante_cidade: '' }, perfil), true));
t('fila sem cidades = todas', () => igual(pickupVisivelParaColetor({ status: 'disponivel', fabricante_cidade: 'X' }, { id: 'p2' }), true));
t('fila so disponivel', () => igual(pickupVisivelParaColetor({ status: 'aguardando_pronto', fabricante_cidade: 'Cláudio' }, perfil), false));
t('frete por UF', () => igual(freteVisivelParaFretista({ status: 'disponivel', destino_uf: 'sp' }, { id: 'f', ufs: ['SP'] }), true));
t('frete outra UF', () => igual(freteVisivelParaFretista({ status: 'disponivel', destino_uf: 'RJ' }, { id: 'f', ufs: ['SP'] }), false));

// Consolidacao
t('consolidar ok', () => igual(prontoParaConsolidar([{ status: 'conferida' }, { status: 'cancelada' }]), { ok: true, faltam: 0 }));
t('consolidar falta', () => igual(prontoParaConsolidar([{ status: 'conferida' }, { status: 'coletada' }]), { ok: false, faltam: 1 }));
t('consolidar vazio', () => igual(prontoParaConsolidar([{ status: 'cancelada' }]).ok, false));

// Peso estimado
t('peso completo', () => igual(estimarPeso([{ product_id: 'a', quantidade: 4 }, { product_id: 'b', quantidade: 1 }], { a: 10, b: 2.5 }), { peso_kg: 42.5, completo: true, sem_peso: 0 }));
t('peso parcial', () => igual(estimarPeso([{ product_id: 'a', quantidade: 2 }, { product_id: 'x', quantidade: 1 }], { a: 10 }), { peso_kg: 20, completo: false, sem_peso: 1 }));
t('peso nenhum', () => igual(estimarPeso([{ product_id: 'x' }], {}), { peso_kg: null, completo: false, sem_peso: 1 }));

// Destino
const vit = { endereco_entrega: { logradouro: 'Rua X', numero: '10', bairro: 'Centro', cidade: 'Campinas', estado: 'sp', cep: '13000-000' }, cliente_telefone: '19 9999' };
const cli = { endereco: 'Av. Y, 5', cidade: 'Itu', estado: 'SP' };
t('destino da vitrine', () => igual(resolverDestino({}, vit, cli), { endereco: 'Rua X, 10 — Centro', cidade: 'Campinas', uf: 'SP', cep: '13000-000', telefone: '19 9999', origem: 'pedido_vitrine' }));
t('destino do cliente', () => igual(resolverDestino({}, null, cli).origem, 'cadastro_cliente'));
t('manual vence', () => { const d = resolverDestino({ cidade: 'Sorocaba', uf: 'sp' }, vit, cli); igual([d.cidade, d.uf, d.endereco, d.origem], ['Sorocaba', 'SP', 'Rua X, 10 — Centro', 'manual']); });
t('vitrine sem cidade cai no cliente', () => igual(resolverDestino({}, { endereco_entrega: {} }, cli).cidade, 'Itu'));
t('sem destino', () => igual(resolverDestino({}, null, null).origem, 'sem_destino'));

// Checklist
const itensC = [{ nome: 'Anilha 10kg', quantidade: 4 }, { nome: 'Barra 1,2m', quantidade: 2 }, { nome: 'Presilha', quantidade: 2 }];
t('checklist tudo ok', () => igual(conferirChecklist(itensC, [{ ok: true }, { ok: true }, { ok: true }]).divergencia, null));
t('checklist falta e parcial', () => igual(conferirChecklist(itensC, [{ ok: false, quantidade_recebida: 3 }, { ok: true }, { ok: false }]).divergencia, 'Veio 3 de 4: Anilha 10kg; Faltou 2x Presilha'));
t('checklist incompleto', () => erro(() => conferirChecklist(itensC, [{ ok: true }])));
t('desmarcado com qtd cheia conta como ok', () => igual(conferirChecklist([{ nome: 'A', quantidade: 2 }], [{ ok: false, quantidade_recebida: 2 }]).divergencia, null));
t('qtd acima do esperado limita', () => igual(conferirChecklist([{ nome: 'A', quantidade: 2 }], [{ ok: false, quantidade_recebida: 9 }]).linhas[0].quantidade_recebida, 2));

// Filtro de PedidoCompra do Hub: venda efetivada, a partir do corte
const novo = '2026-10-11T19:00:00Z', velho = '2026-10-11T18:00:00Z';
const vendaOk = { tipo: 'venda', status: 'confirmado' };
for (const s of ['confirmado', 'em_separacao', 'enviado', 'entregue']) t(`venda ${s} efetivada`, () => igual(vendaEfetivada({ tipo: 'venda', status: s }, null), true));
t('venda pendente fora', () => igual(vendaEfetivada({ tipo: 'venda', status: 'pendente' }, null), false));
t('venda cancelada fora', () => igual(vendaEfetivada({ tipo: 'venda', status: 'cancelado' }, null), false));
t('orcamento fora mesmo confirmado', () => igual(vendaEfetivada({ tipo: 'orcamento', status: 'confirmado' }, null), false));
t('vitrine paga entra', () => igual(vendaEfetivada(null, { pagamento_status: 'pago', status: 'pago' }), true));
t('vitrine nao paga fora', () => igual(vendaEfetivada(null, { pagamento_status: 'pendente' }), false));
t('vitrine paga cancelada fora', () => igual(vendaEfetivada(null, { pagamento_status: 'pago', status: 'cancelado' }), false));
for (const s of ['pendente', 'rascunho', 'confirmado', 'em_producao']) t(`pc ${s} novo de venda efetivada entra`, () => igual(pcEntraNoHub({ status: s, venda_id: 'V', created_date: novo }, vendaOk, null), true));
t('pc antes do corte fora', () => igual(pcEntraNoHub({ status: 'confirmado', venda_id: 'V', created_date: velho }, vendaOk, null), false));
t('pc sem data fora', () => igual(pcEntraNoHub({ status: 'pendente', venda_id: 'V' }, vendaOk, null), false));
t('pc cancelado fora', () => igual(pcEntraNoHub({ status: 'cancelado', venda_id: 'V', created_date: novo }, vendaOk, null), false));
t('pc sem venda fora', () => igual(pcEntraNoHub({ status: 'pendente', venda_id: 'V', created_date: novo }, null, null), false));
t('pc de orcamento fora', () => igual(pcEntraNoHub({ status: 'rascunho', venda_id: 'V', created_date: novo }, { tipo: 'orcamento', status: 'pendente' }, null), false));
t('pc nulo fora', () => igual(pcEntraNoHub(null, vendaOk, null), false));

// Convites
const agoraC = Date.parse('2026-10-11T12:00:00Z');
t('convite aberto', () => igual(estadoConvite({ status: 'aberto', expira_em: '2026-10-20T00:00:00Z' }, agoraC), 'aberto'));
t('convite vencido', () => igual(estadoConvite({ status: 'aberto', expira_em: '2026-10-01T00:00:00Z' }, agoraC), 'expirado'));
t('convite usado vence vencido', () => igual(estadoConvite({ status: 'usado', expira_em: '2026-10-01T00:00:00Z' }, agoraC), 'usado'));
t('convite inexistente 404', () => erro(() => validarConvite(null, agoraC), 404));
t('convite usado 409', () => erro(() => validarConvite({ status: 'usado' }, agoraC), 409));
t('convite cancelado 409', () => erro(() => validarConvite({ status: 'cancelado' }, agoraC), 409));
t('convite vencido 409', () => erro(() => validarConvite({ status: 'aberto', expira_em: '2026-10-01T00:00:00Z' }, agoraC), 409));
const aceite = { nome: ' João ', whatsapp: '(37) 99999-0000', documento: '123.456.789-00', veiculo: 'Fiorino', cidades: 'Cláudio, Itaúna,', ufs: 'mg, sp' };
t('aceite coletor', () => igual(dadosDoAceite('coletor', aceite), { nome: 'João', whatsapp: '(37) 99999-0000', documento: '123.456.789-00', veiculo: 'Fiorino', cidades: ['Cláudio', 'Itaúna'], ufs: [] }));
t('aceite fretista UFs', () => igual(dadosDoAceite('fretista', aceite).ufs, ['MG', 'SP']));
t('aceite sem dados', () => erro(() => dadosDoAceite('coletor', { nome: 'A', whatsapp: '123' })));

console.log(`${ok} ok, ${falhas} falha(s)`);
if (falhas) Deno.exit(1);
