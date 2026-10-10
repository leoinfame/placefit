// deno run base44/shared/hubFluxo.test.ts
import {
  validarCustodia, validarAcao, ACOES_PICKUP, ACOES_FRETE, lerQr, conteudoQr, gerarToken,
  pickupVisivelParaColetor, freteVisivelParaFretista, prontoParaConsolidar, ErroHub,
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

console.log(`${ok} ok, ${falhas} falha(s)`);
if (falhas) Deno.exit(1);
