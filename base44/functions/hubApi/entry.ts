import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ErroHub, Papel, REGRAS_CUSTODIA, ACOES_PICKUP, ACOES_FRETE, NOTIFICAR, ROTULO_STATUS,
  validarCustodia, validarAcao, lerQr, gerarToken, conteudoQr, numeroCurto,
  pickupVisivelParaColetor, freteVisivelParaFretista, prontoParaConsolidar, normalizarCidade,
  estimarPeso, resolverDestino, conferirChecklist,
} from '../../shared/hubFluxo.ts';

// API do Hub PlaceFit. Todas as gravacoes de Pickup, FreightLeg, CustodyEvent, HubLancamento
// e HubNotificacao passam por aqui (service role), depois de conferir perfil e sequencia.
// body: { acao, papel?, ... }  — papel = qual perfil do usuario esta agindo (coletor/fretista/base/admin).
// Leituras de tela do admin (eventos ao vivo, financeiro, cadastros) usam as entidades direto (RLS admin).

const TAXA_FALSA_COLETA_PADRAO = 50;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const db = base44.asServiceRole.entities;
    const ctx = await carregarContexto(db, user);

    const acao = String(body.acao || '');
    const handler = ACOES[acao];
    if (!handler) throw new ErroHub(`Ação desconhecida: ${acao}`, 404);
    if (acao !== 'contexto' && !ctx.temAcesso) throw new ErroHub('O Hub não está liberado para a sua conta.', 403);
    const resultado = await handler({ base44, db, user, ctx, body });
    return Response.json(resultado ?? { ok: true });
  } catch (e) {
    const status = e instanceof ErroHub ? e.status : 500;
    if (status === 500) console.error('hubApi', e);
    return Response.json({ error: (e as Error).message || 'Erro no Hub' }, { status });
  }
});

type Ctx = Awaited<ReturnType<typeof carregarContexto>>;
type Args = { base44: any; db: any; user: any; ctx: Ctx; body: any };

async function carregarContexto(db: any, user: any) {
  const admin = user.role === 'admin';
  const perfis = (await db.TransportProfile.filter({ user_id: user.id }, '-created_date', 20))
    .filter((p: any) => p.ativo !== false);
  const flag = (await db.HubConfig.filter({ escopo: 'revenda', revendedor_id: user.id }, '-created_date', 1))[0];
  const revendaAtiva = !!flag?.hub_ativo;
  return {
    admin,
    perfis,
    revendaAtiva,
    temAcesso: admin || perfis.length > 0 || revendaAtiva,
  };
}

// Perfil com que o usuario age nesta chamada. Admin age como admin; os demais precisam de perfil verificado.
function perfilAtivo(ctx: Ctx, papel: string, exigirVerificado = true): { papel: Papel; perfil: any | null } {
  if (papel === 'admin') {
    if (!ctx.admin) throw new ErroHub('Só administradores.', 403);
    return { papel: 'admin', perfil: null };
  }
  const perfil = ctx.perfis.find((p: any) => p.tipo === papel);
  if (!perfil) {
    if (ctx.admin && papel === 'base') return { papel: 'admin', perfil: null }; // admin opera a base
    throw new ErroHub('Você não tem esse perfil no Hub.', 403);
  }
  if (exigirVerificado && perfil.verificacao !== 'verificado') {
    throw new ErroHub(perfil.verificacao === 'suspenso' ? 'Seu perfil está suspenso.' : 'Seu perfil ainda não foi verificado pelo admin.', 403);
  }
  return { papel: papel as Papel, perfil };
}

async function configGlobal(db: any) {
  return (await db.HubConfig.filter({ escopo: 'global' }, '-created_date', 1))[0] || null;
}

async function pegar(colecao: any, id: string, nome: string) {
  if (!id) throw new ErroHub(`${nome} não informado.`);
  const lista = await colecao.filter({ id }, '-created_date', 1);
  if (!lista?.[0]) throw new ErroHub(`${nome} não encontrado.`, 404);
  return lista[0];
}

const agora = () => new Date().toISOString();
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

function exigirFoto(url: string) {
  if (!url || !/^https?:\/\//.test(String(url))) throw new ErroHub('A foto do volume é obrigatória.');
}

function dadosGeo(body: any) {
  const lat = Number(body.lat), lng = Number(body.lng);
  const temGeo = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  return {
    lat: temGeo ? lat : undefined,
    lng: temGeo ? lng : undefined,
    precisao_m: Number.isFinite(Number(body.precisao_m)) ? Number(body.precisao_m) : undefined,
    geo_status: temGeo ? 'ok' : (body.geo_status === 'negado' ? 'negado' : 'indisponivel'),
    hora_dispositivo: body.hora_dispositivo || undefined,
  };
}

// ---------------- notificacoes ----------------

async function destinatarios(db: any, papel: string, ref: { pickup?: any; frete?: any; donoUserId?: string }) {
  if (papel === 'revenda') return [ref.frete?.revendedor_id || ref.pickup?.revendedor_id].filter(Boolean);
  if (papel === 'admin') return (await db.User.filter({ role: 'admin' }, '-created_date', 50)).map((u: any) => u.id);
  if (ref.donoUserId && (papel === 'coletor' || papel === 'fretista')) return [ref.donoUserId];
  const perfis = (await db.TransportProfile.filter({ tipo: papel }, '-created_date', 200))
    .filter((p: any) => p.ativo !== false && p.verificacao === 'verificado');
  const baseId = ref.pickup?.base_id || ref.frete?.base_id;
  return perfis
    .filter((p: any) => {
      if (papel === 'base') return !baseId || !p.base_id || p.base_id === baseId;
      if (papel === 'coletor' && ref.pickup) return pickupVisivelParaColetor({ ...ref.pickup, status: 'disponivel' }, p);
      if (papel === 'fretista' && ref.frete) return freteVisivelParaFretista({ ...ref.frete, status: 'disponivel' }, p);
      return true;
    })
    .map((p: any) => p.user_id);
}

const LINK_PAPEL: Record<string, string> = {
  coletor: '/hub/coletor', fretista: '/hub/fretista', base: '/hub/base', admin: '/hub/admin', revenda: '/hub/acompanhar',
};

async function notificar(db: any, evento: string, ref: { pickup?: any; frete?: any; donoUserId?: string }, mensagem: string) {
  const regra = NOTIFICAR[evento];
  if (!regra) return;
  const cfg = await configGlobal(db);
  const enviados = new Set<string>();
  for (const papel of regra.papeis) {
    const ids = await destinatarios(db, papel, ref);
    for (const uid of ids) {
      const chave = `${uid}:${papel}`;
      if (!uid || enviados.has(chave)) continue;
      enviados.add(chave);
      const notif = await db.HubNotificacao.create({
        destinatario_user_id: uid,
        papel,
        tipo: evento,
        titulo: regra.titulo,
        mensagem,
        link: LINK_PAPEL[papel],
        pickup_id: ref.pickup?.id,
        freight_leg_id: ref.frete?.id,
        venda_id: ref.frete?.venda_id || ref.pickup?.venda_id,
        lida: false,
        webhook_status: cfg?.webhook_url ? 'erro' : 'desligado',
      });
      if (cfg?.webhook_url) {
        const ok = await enviarWebhook(cfg.webhook_url, { evento, papel, notificacao: notif });
        await db.HubNotificacao.update(notif.id, { webhook_status: ok ? 'enviado' : 'erro' });
      }
    }
  }
}

async function enviarWebhook(url: string, payload: unknown): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origem: 'hub-placefit', ...(payload as object) }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

// ---------------- leitura para as telas ----------------

function resumoItens(itens: any[]): string {
  return (itens || []).map((i) => `${i.quantidade ?? 1}x ${i.nome || i.cod || 'item'}`).join(' · ');
}

function itensEstruturados(itens: any[]) {
  return (itens || []).map((i) => ({ product_id: i.product_id, cod: i.cod, nome: i.nome, quantidade: Number(i.quantidade) || 1 }));
}

// Itens que a coleta deve trazer (gravados na inclusao; coletas antigas leem do PedidoCompra).
async function itensDaColeta(db: any, p: any) {
  if (Array.isArray(p.itens) && p.itens.length) return p.itens;
  const pc = (await db.PedidoCompra.filter({ id: p.pedido_compra_id }, '-created_date', 1))[0];
  return itensEstruturados(pc?.itens);
}

// product_id -> peso_kg. Os itens apontam para ProductTemplate (vitrine) ou SupplierProduct (orcamento).
async function pesosDoCatalogo(db: any, itens: any[]) {
  const ids = [...new Set(itens.map((i) => i?.product_id).filter(Boolean))] as string[];
  const mapa: Record<string, number | undefined> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    for (const t of await db.ProductTemplate.filter({ id: { $in: lote } }, '-created_date', lote.length)) mapa[t.id] = t.peso_kg;
  }
  const faltam = ids.filter((id) => !(id in mapa));
  for (let i = 0; i < faltam.length; i += 200) {
    const lote = faltam.slice(i, i + 200);
    const sps = await db.SupplierProduct.filter({ id: { $in: lote } }, '-created_date', lote.length);
    const tplIds = [...new Set(sps.map((x: any) => x.product_id).filter(Boolean))] as string[];
    const tpls = tplIds.length ? await db.ProductTemplate.filter({ id: { $in: tplIds } }, '-created_date', tplIds.length) : [];
    const porTpl = Object.fromEntries(tpls.map((t: any) => [t.id, t.peso_kg]));
    for (const sp of sps) mapa[sp.id] = porTpl[sp.product_id];
  }
  return mapa;
}

// Pedido da vitrine ligado a esta venda: o PedidoCompra aponta para o LojaPedido direto ou para o Pedido interno gerado dele.
async function pedidoDaVitrine(db: any, vendaId: string) {
  return (await db.LojaPedido.filter({ id: vendaId }, '-created_date', 1))[0]
    || (await db.LojaPedido.filter({ pedido_interno_id: vendaId }, '-created_date', 1))[0]
    || null;
}

function publicoPickup(p: any, comQr = false) {
  const { qr_token, recusada_por, ...resto } = p;
  return comQr ? { ...resto, qr: qr_token ? conteudoQr('P', qr_token) : null } : resto;
}

function publicoFrete(f: any, comQr = false) {
  const { qr_mestre_token, recusado_por, ...resto } = f;
  return comQr ? { ...resto, qr: qr_mestre_token ? conteudoQr('F', qr_mestre_token) : null } : resto;
}

async function contexto({ user, ctx, db }: Args) {
  const cfg = ctx.admin ? await configGlobal(db) : null;
  return {
    usuario: { id: user.id, nome: user.full_name || user.empresa || user.email, email: user.email },
    admin: ctx.admin,
    revenda_ativa: ctx.revendaAtiva,
    tem_acesso: ctx.temAcesso,
    perfis: ctx.perfis.map((p: any) => ({ id: p.id, tipo: p.tipo, nome: p.nome, verificacao: p.verificacao, base_id: p.base_id })),
    taxa_falsa_coleta: cfg?.taxa_falsa_coleta ?? TAXA_FALSA_COLETA_PADRAO,
  };
}

async function filaColetor({ db, ctx }: Args) {
  const { perfil } = perfilAtivo(ctx, 'coletor');
  const disponiveis = await db.Pickup.filter({ status: 'disponivel' }, 'pronto_em', 200);
  return { coletas: disponiveis.filter((p: any) => pickupVisivelParaColetor(p, perfil)).map((p: any) => publicoPickup(p)) };
}

async function minhasColetas({ db, ctx, user }: Args) {
  perfilAtivo(ctx, 'coletor', false);
  const lista = await db.Pickup.filter({ coletor_user_id: user.id }, '-updated_date', 100);
  const ativas = lista.filter((p: any) => ['aceita', 'janela_confirmada', 'coletada'].includes(p.status));
  const feitas = lista.filter((p: any) => !['aceita', 'janela_confirmada', 'coletada'].includes(p.status)).slice(0, 20);
  return { ativas: ativas.map((p: any) => publicoPickup(p)), historico: feitas.map((p: any) => publicoPickup(p)) };
}

async function filaFretista({ db, ctx }: Args) {
  const { perfil } = perfilAtivo(ctx, 'fretista');
  const disponiveis = await db.FreightLeg.filter({ status: 'disponivel' }, 'liberado_em', 200);
  return { fretes: disponiveis.filter((f: any) => freteVisivelParaFretista(f, perfil)).map((f: any) => publicoFrete(f)) };
}

async function meusFretes({ db, ctx, user }: Args) {
  perfilAtivo(ctx, 'fretista', false);
  const lista = await db.FreightLeg.filter({ fretista_user_id: user.id }, '-updated_date', 100);
  const ativos = lista.filter((f: any) => ['aceito', 'retirado'].includes(f.status));
  const feitos = lista.filter((f: any) => !['aceito', 'retirado'].includes(f.status)).slice(0, 20);
  return { ativos: ativos.map((f: any) => publicoFrete(f)), historico: feitos.map((f: any) => publicoFrete(f)) };
}

async function painelBase({ db, ctx }: Args) {
  perfilAtivo(ctx, 'base');
  const [aguardando, falsas, disponiveis, aceitas, janelas, coletadas, naBase] = await Promise.all(
    ['aguardando_pronto', 'falsa_coleta', 'disponivel', 'aceita', 'janela_confirmada', 'coletada', 'entregue_base']
      .map((s) => db.Pickup.filter({ status: s }, '-updated_date', 200)),
  );
  const fretesAbertos = await db.FreightLeg.filter({ status: 'aguardando_consolidacao' }, '-created_date', 200);
  const consolidados = await db.FreightLeg.filter({ status: 'consolidado' }, '-updated_date', 200);

  const consolidar = [];
  for (const f of fretesAbertos) {
    const pks = await db.Pickup.filter({ venda_id: f.venda_id }, 'created_date', 50);
    const st = prontoParaConsolidar(pks);
    consolidar.push({
      ...publicoFrete(f, true),
      pronto: st.ok,
      faltam: st.faltam,
      subpedidos: pks.filter((p: any) => p.status !== 'cancelada').map((p: any) => ({ id: p.id, numero: p.numero, fabricante_nome: p.fabricante_nome, status: p.status })),
    });
  }
  return {
    a_marcar_pronto: [...aguardando, ...falsas].map((p: any) => publicoPickup(p)),
    em_andamento: [...disponiveis, ...aceitas, ...janelas].map((p: any) => publicoPickup(p)),
    chegando: coletadas.map((p: any) => publicoPickup(p)),
    para_conferir: naBase.map((p: any) => publicoPickup(p)),
    para_consolidar: consolidar,
    para_liberar: consolidados.map((f: any) => publicoFrete(f)),
  };
}

// Etiquetas para impressao (base/admin). ids = pickups; frete_ids = QR mestre.
async function etiquetas({ db, ctx, body }: Args) {
  perfilAtivo(ctx, 'base');
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const freteIds: string[] = Array.isArray(body.frete_ids) ? body.frete_ids : [];
  let pickups: any[] = [];
  if (ids.length) pickups = await Promise.all(ids.map((id) => pegar(db.Pickup, id, 'Coleta')));
  else if (!freteIds.length) {
    // Etiquetas do dia: tudo que ja pode ser coletado e ainda nao saiu do fabricante
    const listas = await Promise.all(['disponivel', 'aceita', 'janela_confirmada'].map((s) => db.Pickup.filter({ status: s }, 'pronto_em', 200)));
    pickups = listas.flat();
  }
  const fretes = await Promise.all(freteIds.map((id) => pegar(db.FreightLeg, id, 'Frete')));
  const t = agora();
  for (const p of pickups) if (!p.etiqueta_impressa_em) await db.Pickup.update(p.id, { etiqueta_impressa_em: t });
  return {
    pickups: pickups.map((p) => publicoPickup(p, true)),
    fretes: fretes.map((f) => publicoFrete(f, true)),
  };
}

async function acompanhar({ db, ctx, user }: Args) {
  if (!ctx.revendaAtiva && !ctx.admin) throw new ErroHub('O Hub não está ativo para esta revenda.', 403);
  const fretes = await db.FreightLeg.filter({ revendedor_id: user.id }, '-created_date', 50);
  const pickups = await db.Pickup.filter({ revendedor_id: user.id }, '-created_date', 200);
  return {
    pedidos: fretes.map((f: any) => ({
      ...publicoFrete(f),
      subpedidos: pickups.filter((p: any) => p.venda_id === f.venda_id).map((p: any) => ({
        id: p.id, numero: p.numero, fabricante_nome: p.fabricante_nome, status: p.status,
      })),
    })),
  };
}

// ---------------- coletor / fretista: fila ----------------

async function acaoPickup({ db, ctx, user, body }: Args) {
  const acao = String(body.acao_pickup || '');
  const p = await pegar(db.Pickup, body.pickup_id, 'Coleta');

  if (acao === 'recusar') {
    const { perfil } = perfilAtivo(ctx, 'coletor');
    if (p.status !== 'disponivel') throw new ErroHub('Esta coleta já saiu da fila.', 409);
    await db.Pickup.update(p.id, { recusada_por: [...new Set([...(p.recusada_por || []), perfil.id])] });
    return { ok: true };
  }

  const papelPedido = acao === 'atribuir' || acao === 'cancelar' ? 'admin' : (body.papel || 'coletor');
  const { papel, perfil } = perfilAtivo(ctx, papelPedido);
  const para = validarAcao(ACOES_PICKUP, acao, p.status, papel);

  if (acao === 'aceitar') {
    if (!pickupVisivelParaColetor(p, perfil)) throw new ErroHub('Esta coleta não está disponível para você.', 403);
    await db.Pickup.update(p.id, { status: para, coletor_profile_id: perfil.id, coletor_user_id: user.id, coletor_nome: perfil.nome, atribuida_por_admin: false });
    // Dois coletores podem aceitar ao mesmo tempo: quem ficar gravado por ultimo leva.
    await dorme(400);
    const depois = await pegar(db.Pickup, p.id, 'Coleta');
    if (depois.coletor_user_id !== user.id) throw new ErroHub('Outro coletor aceitou esta coleta primeiro.', 409);
    return { ok: true, coleta: publicoPickup(depois) };
  }

  if (acao === 'atribuir') {
    const alvo = await pegar(db.TransportProfile, body.profile_id, 'Perfil');
    if (alvo.tipo !== 'coletor' || alvo.ativo === false) throw new ErroHub('Escolha um coletor ativo.');
    await db.Pickup.update(p.id, { status: para, coletor_profile_id: alvo.id, coletor_user_id: alvo.user_id, coletor_nome: alvo.nome, atribuida_por_admin: true });
    await notificar(db, 'atribuida', { pickup: p, donoUserId: alvo.user_id }, `${p.numero} — ${p.fabricante_nome} (${p.fabricante_cidade || ''}). Valor: ${brl(p.valor_coleta)}.`);
    return { ok: true };
  }

  if (papel === 'coletor' && p.coletor_user_id !== user.id) throw new ErroHub('Esta coleta está com outra pessoa.', 403);

  if (acao === 'confirmar_janela') {
    if (!body.janela_inicio) throw new ErroHub('Informe o horário em que vai buscar.');
    await db.Pickup.update(p.id, { status: para, janela_inicio: body.janela_inicio, janela_fim: body.janela_fim || undefined });
    return { ok: true };
  }
  if (acao === 'desistir') {
    await db.Pickup.update(p.id, { status: para, coletor_profile_id: null, coletor_user_id: null, coletor_nome: null, janela_inicio: null, janela_fim: null });
    await notificar(db, 'pronto', { pickup: p }, `${p.numero} voltou para a fila — ${p.fabricante_nome}.`);
    return { ok: true };
  }
  if (acao === 'cancelar') {
    await db.Pickup.update(p.id, { status: para, observacoes: [p.observacoes, body.motivo].filter(Boolean).join(' | ') });
    return { ok: true };
  }
  throw new ErroHub(`Use a ação própria para "${acao}".`);
}

async function acaoFrete({ db, ctx, user, body }: Args) {
  const acao = String(body.acao_frete || '');
  const f = await pegar(db.FreightLeg, body.freight_leg_id, 'Frete');

  if (acao === 'recusar') {
    const { perfil } = perfilAtivo(ctx, 'fretista');
    if (f.status !== 'disponivel') throw new ErroHub('Este frete já saiu da fila.', 409);
    await db.FreightLeg.update(f.id, { recusado_por: [...new Set([...(f.recusado_por || []), perfil.id])] });
    return { ok: true };
  }

  const papelPedido = acao === 'atribuir' || acao === 'cancelar' ? 'admin' : (body.papel || 'fretista');
  const { papel, perfil } = perfilAtivo(ctx, papelPedido);
  const para = validarAcao(ACOES_FRETE, acao, f.status, papel);

  if (acao === 'liberar') {
    if (!(f.valor_frete > 0)) throw new ErroHub('O admin ainda não definiu o valor do frete.', 409);
    await db.FreightLeg.update(f.id, { status: para, liberado_em: agora() });
    await notificar(db, 'liberado', { frete: f }, `${f.numero} — ${f.destino_cidade}/${f.destino_uf}. Valor: ${brl(f.valor_frete)}.`);
    return { ok: true };
  }
  if (acao === 'aceitar') {
    if (!freteVisivelParaFretista(f, perfil)) throw new ErroHub('Este frete não está disponível para você.', 403);
    await db.FreightLeg.update(f.id, { status: para, fretista_profile_id: perfil.id, fretista_user_id: user.id, fretista_nome: perfil.nome, atribuido_por_admin: false });
    await dorme(400);
    const depois = await pegar(db.FreightLeg, f.id, 'Frete');
    if (depois.fretista_user_id !== user.id) throw new ErroHub('Outro fretista aceitou este frete primeiro.', 409);
    return { ok: true, frete: publicoFrete(depois) };
  }
  if (acao === 'atribuir') {
    const alvo = await pegar(db.TransportProfile, body.profile_id, 'Perfil');
    if (alvo.tipo !== 'fretista' || alvo.ativo === false) throw new ErroHub('Escolha um fretista ativo.');
    if (!(f.valor_frete > 0)) throw new ErroHub('Defina o valor do frete antes de atribuir.', 409);
    await db.FreightLeg.update(f.id, { status: para, fretista_profile_id: alvo.id, fretista_user_id: alvo.user_id, fretista_nome: alvo.nome, atribuido_por_admin: true, liberado_em: f.liberado_em || agora() });
    await notificar(db, 'frete_atribuido', { frete: f, donoUserId: alvo.user_id }, `${f.numero} — ${f.destino_cidade}/${f.destino_uf}. Valor: ${brl(f.valor_frete)}.`);
    return { ok: true };
  }
  if (acao === 'desistir') {
    if (papel === 'fretista' && f.fretista_user_id !== user.id) throw new ErroHub('Este frete está com outra pessoa.', 403);
    await db.FreightLeg.update(f.id, { status: para, fretista_profile_id: null, fretista_user_id: null, fretista_nome: null });
    await notificar(db, 'liberado', { frete: f }, `${f.numero} voltou para a fila.`);
    return { ok: true };
  }
  if (acao === 'cancelar') {
    await db.FreightLeg.update(f.id, { status: para, observacoes: [f.observacoes, body.motivo].filter(Boolean).join(' | ') });
    return { ok: true };
  }
  throw new ErroHub(`Ação de frete desconhecida: ${acao}`);
}

// ---------------- base / admin: pronto e consolidacao ----------------

async function marcarPronto({ db, ctx, user, body }: Args) {
  const { papel } = perfilAtivo(ctx, body.papel === 'admin' ? 'admin' : 'base');
  const p = await pegar(db.Pickup, body.pickup_id, 'Coleta');
  const para = validarAcao(ACOES_PICKUP, 'marcar_pronto', p.status, papel);
  if (!(p.valor_coleta > 0)) throw new ErroHub('O admin ainda não definiu o valor da coleta.', 409);
  if (!String(body.confirmacao || '').trim()) throw new ErroHub('Diga como o fabricante confirmou (ex.: WhatsApp com quem, que horas).');
  await db.Pickup.update(p.id, {
    status: para,
    pronto_em: agora(),
    pronto_por_nome: user.full_name || user.email,
    pronto_confirmacao: String(body.confirmacao).trim(),
    coletor_profile_id: null, coletor_user_id: null, coletor_nome: null, janela_inicio: null, janela_fim: null,
    recusada_por: [],
  });
  await notificar(db, 'pronto', { pickup: p }, `${p.numero} — ${p.fabricante_nome} (${p.fabricante_cidade || ''}). Valor: ${brl(p.valor_coleta)}.`);
  return { ok: true };
}

// Gera o QR mestre. O evento pedido_consolidado so nasce quando a base escaneia a etiqueta mestre com foto.
async function consolidar({ db, ctx, body }: Args) {
  perfilAtivo(ctx, 'base');
  const f = await pegar(db.FreightLeg, body.freight_leg_id, 'Frete');
  if (f.status !== 'aguardando_consolidacao') throw new ErroHub('Este pedido já foi consolidado.', 409);
  const pks = await db.Pickup.filter({ venda_id: f.venda_id }, 'created_date', 50);
  const st = prontoParaConsolidar(pks);
  if (!st.ok) throw new ErroHub(st.faltam ? `Ainda faltam ${st.faltam} subpedido(s) conferido(s).` : 'Pedido sem subpedidos.', 409);
  const ativos = pks.filter((p: any) => p.status !== 'cancelada');
  const token = f.qr_mestre_token || gerarToken();
  await db.FreightLeg.update(f.id, {
    qr_mestre_token: token,
    numero: f.numero || numeroCurto('FRT', token),
    volumes: f.volumes || ativos.reduce((s: number, p: any) => s + (p.volumes || 0), 0) || undefined,
    peso_kg: f.peso_kg || ativos.reduce((s: number, p: any) => s + (p.peso_kg || 0), 0) || undefined,
  });
  const atualizado = await pegar(db.FreightLeg, f.id, 'Frete');
  return { ok: true, frete: publicoFrete(atualizado, true) };
}

// ---------------- custodia por QR ----------------

async function custodia({ db, ctx, user, body }: Args) {
  const tipo = String(body.tipo || '');
  const regra = REGRAS_CUSTODIA[tipo as keyof typeof REGRAS_CUSTODIA];
  if (!regra) throw new ErroHub(`Evento desconhecido: ${tipo}`);
  exigirFoto(body.foto_url);

  const papelPedido = String(body.papel || (regra.alvo === 'frete' && tipo !== 'pedido_consolidado' ? 'fretista' : 'coletor'));
  const { papel, perfil } = perfilAtivo(ctx, papelPedido);

  const qr = lerQr(body.qr);
  const tipoQr = regra.alvo === 'pickup' ? 'P' : 'F';
  if (qr.tipo && qr.tipo !== tipoQr) {
    throw new ErroHub(tipoQr === 'P' ? 'Este é o QR mestre do pedido. Escaneie a etiqueta do subpedido.' : 'Esta é a etiqueta de um subpedido. Escaneie o QR mestre do pedido.');
  }

  let pickup: any = null, frete: any = null;
  if (regra.alvo === 'pickup') {
    pickup = (await db.Pickup.filter({ qr_token: qr.token }, '-created_date', 1))[0];
    if (!pickup) throw new ErroHub('Etiqueta não encontrada no Hub.', 404);
    if (body.pickup_id && body.pickup_id !== pickup.id) throw new ErroHub(`Etiqueta errada: este QR é da ${pickup.numero}.`, 409);
  } else {
    frete = (await db.FreightLeg.filter({ qr_mestre_token: qr.token }, '-created_date', 1))[0];
    if (!frete) throw new ErroHub('QR mestre não encontrado no Hub.', 404);
    if (body.freight_leg_id && body.freight_leg_id !== frete.id) throw new ErroHub(`QR errado: este é do ${frete.numero}.`, 409);
  }
  const alvo = pickup || frete;
  const { para } = validarCustodia(tipo, {
    status: alvo.status,
    dono_user_id: pickup ? pickup.coletor_user_id : frete.fretista_user_id,
  }, papel, user.id);

  // Conferencia item a item: a divergencia nasce do que nao foi marcado (+ observacao livre opcional).
  let checklist: any[] | undefined;
  let divergencia: string | undefined = body.divergencia ? String(body.divergencia).trim() || undefined : undefined;
  if (tipo === 'conferido') {
    const itens = await itensDaColeta(db, pickup);
    if (itens.length) {
      const r = conferirChecklist(itens, body.checklist);
      checklist = r.linhas;
      divergencia = [r.divergencia, divergencia && `Obs.: ${divergencia}`].filter(Boolean).join('; ') || undefined;
    }
  }

  if (tipo === 'entregue_ao_cliente' && !String(body.recebedor_nome || '').trim()) {
    throw new ErroHub('Informe o nome de quem recebeu.');
  }
  if (tipo === 'pedido_consolidado') {
    const pks = await db.Pickup.filter({ venda_id: frete.venda_id }, 'created_date', 50);
    const st = prontoParaConsolidar(pks);
    if (!st.ok) throw new ErroHub(`Ainda faltam ${st.faltam} subpedido(s) conferido(s).`, 409);
  }

  const t = agora();
  const evento = await db.CustodyEvent.create({
    tipo,
    pickup_id: pickup?.id,
    freight_leg_id: frete?.id || pickup?.freight_leg_id,
    venda_id: alvo.venda_id,
    revendedor_id: alvo.revendedor_id,
    referencia: alvo.numero,
    qr_lido: String(body.qr).slice(0, 200),
    qr_digitado: !!body.qr_digitado,
    ator_user_id: user.id,
    ator_nome: perfil?.nome || user.full_name || user.email,
    ator_papel: papel,
    ator_profile_id: perfil?.id,
    registrado_em: t,
    ...dadosGeo(body),
    foto_url: body.foto_url,
    observacao: body.observacao || undefined,
    divergencia,
    checklist,
    recebedor_nome: body.recebedor_nome || undefined,
  });

  if (pickup) {
    await db.Pickup.update(pickup.id, { status: para, ...(tipo === 'conferido' && divergencia ? { divergencia } : {}) });
  } else {
    await db.FreightLeg.update(frete.id, {
      status: para,
      ...(tipo === 'entregue_ao_cliente' ? { entregue_em: t, recebedor_nome: String(body.recebedor_nome).trim() } : {}),
    });
  }

  // Financeiro: servico terminado vira pagamento a fazer
  if (tipo === 'conferido' && pickup.valor_coleta > 0) {
    await db.HubLancamento.create({
      tipo: 'pagamento_coleta', pickup_id: pickup.id, venda_id: pickup.venda_id, referencia: pickup.numero,
      descricao: `Coleta ${pickup.numero} — ${pickup.fabricante_nome}`, valor: pickup.valor_coleta,
      devedor_tipo: 'placefit', devedor_nome: 'PlaceFit',
      favorecido_tipo: 'coletor', favorecido_id: pickup.coletor_profile_id, favorecido_nome: pickup.coletor_nome,
      status_recebimento: 'nao_aplica', status_pagamento: 'pendente', registrado_por: 'automatico',
    });
  }
  if (tipo === 'entregue_ao_cliente' && frete.valor_frete > 0) {
    await db.HubLancamento.create({
      tipo: 'pagamento_frete', freight_leg_id: frete.id, venda_id: frete.venda_id, referencia: frete.numero,
      descricao: `Frete ${frete.numero} — ${frete.destino_cidade}/${frete.destino_uf}`, valor: frete.valor_frete,
      devedor_tipo: 'placefit', devedor_nome: 'PlaceFit',
      favorecido_tipo: 'fretista', favorecido_id: frete.fretista_profile_id, favorecido_nome: frete.fretista_nome,
      status_recebimento: 'nao_aplica', status_pagamento: 'pendente', registrado_por: 'automatico',
    });
  }

  const quem = perfil?.nome || user.full_name || 'Admin';
  const msg: Record<string, string> = {
    coletado_no_fabricante: `${pickup?.numero} coletada por ${quem} em ${pickup?.fabricante_nome}. A caminho da base.`,
    entregue_na_base: `${pickup?.numero} (${pickup?.fabricante_nome}) chegou na base. Falta conferir.`,
    conferido: `${pickup?.numero} (${pickup?.fabricante_nome}) conferida${divergencia ? ' COM DIVERGÊNCIA: ' + divergencia : ' sem divergência'}.`,
    pedido_consolidado: `${frete?.numero} consolidado — ${frete?.cliente_nome || ''} ${frete?.destino_cidade || ''}/${frete?.destino_uf || ''}. Pronto para liberar ao frete.`,
    retirado_pelo_fretista: `Seu pedido ${frete?.numero} saiu para entrega com ${quem}. Destino: ${frete?.destino_cidade}/${frete?.destino_uf}.`,
    entregue_ao_cliente: `Pedido ${frete?.numero} entregue. Recebido por ${body.recebedor_nome}.`,
  };
  await notificar(db, tipo, { pickup, frete }, msg[tipo] || ROTULO_STATUS[para]);
  return { ok: true, evento_id: evento.id, status: para };
}

async function falsaColeta({ db, ctx, user, body }: Args) {
  const { papel, perfil } = perfilAtivo(ctx, 'coletor');
  exigirFoto(body.foto_url);
  const p = await pegar(db.Pickup, body.pickup_id, 'Coleta');
  const para = validarAcao(ACOES_PICKUP, 'falsa_coleta', p.status, papel);
  if (p.coletor_user_id !== user.id) throw new ErroHub('Esta coleta está com outra pessoa.', 403);

  const t = agora();
  await db.CustodyEvent.create({
    tipo: 'falsa_coleta', pickup_id: p.id, freight_leg_id: p.freight_leg_id, venda_id: p.venda_id, revendedor_id: p.revendedor_id,
    referencia: p.numero, ator_user_id: user.id, ator_nome: perfil.nome, ator_papel: 'coletor', ator_profile_id: perfil.id,
    registrado_em: t, ...dadosGeo(body), foto_url: body.foto_url, observacao: body.observacao || undefined,
  });
  await db.Pickup.update(p.id, {
    status: para, falsas_coletas: (p.falsas_coletas || 0) + 1,
    coletor_profile_id: null, coletor_user_id: null, coletor_nome: null, janela_inicio: null, janela_fim: null,
  });
  const cfg = await configGlobal(db);
  const taxa = Number(cfg?.taxa_falsa_coleta ?? TAXA_FALSA_COLETA_PADRAO);
  await db.HubLancamento.create({
    tipo: 'taxa_falsa_coleta', pickup_id: p.id, venda_id: p.venda_id, referencia: p.numero,
    descricao: `Falsa coleta ${p.numero} em ${p.fabricante_nome}${body.observacao ? ' — ' + body.observacao : ''}`,
    valor: taxa,
    devedor_tipo: 'fabricante', devedor_id: p.fabricante_id, devedor_nome: p.fabricante_nome,
    favorecido_tipo: 'coletor', favorecido_id: perfil.id, favorecido_nome: perfil.nome,
    status_recebimento: 'pendente', status_pagamento: 'pendente', registrado_por: 'automatico',
  });
  await notificar(db, 'falsa_coleta', { pickup: p }, `${p.numero}: ${perfil.nome} chegou em ${p.fabricante_nome} e o pedido não estava pronto. Taxa ${brl(taxa)} lançada.`);
  return { ok: true };
}

// ---------------- admin ----------------

async function adminPedidos({ db, ctx }: Args) {
  perfilAtivo(ctx, 'admin');
  const flags = (await db.HubConfig.filter({ escopo: 'revenda' }, '-created_date', 100)).filter((c: any) => c.hub_ativo);
  const fabricantes = (await db.Fabricante.filter({}, 'nome_fantasia', 500)).filter((f: any) => f.ativo !== false);
  const pedidos: any[] = [];
  for (const flag of flags) {
    const [pcs, vendas, pks, fretes, vitrines, clientes] = await Promise.all([
      db.PedidoCompra.filter({ revendedor_id: flag.revendedor_id }, '-created_date', 300),
      db.Pedido.filter({ fornecedor_id: flag.revendedor_id }, '-created_date', 300),
      db.Pickup.filter({ revendedor_id: flag.revendedor_id }, '-created_date', 500),
      db.FreightLeg.filter({ revendedor_id: flag.revendedor_id }, '-created_date', 200),
      db.LojaPedido.filter({ revendedor_id: flag.revendedor_id }, '-created_date', 300),
      db.Cliente.filter({ fornecedor_id: flag.revendedor_id }, '-created_date', 1000),
    ]);
    const pesos = await pesosDoCatalogo(db, pcs.filter((pc: any) => !pks.some((p: any) => p.pedido_compra_id === pc.id)).flatMap((pc: any) => pc.itens || []));
    const porVenda = new Map<string, any[]>();
    for (const pc of pcs) {
      if (pc.status === 'cancelado' || !pc.venda_id) continue;
      if (!porVenda.has(pc.venda_id)) porVenda.set(pc.venda_id, []);
      porVenda.get(pc.venda_id)!.push(pc);
    }
    for (const [vendaId, subs] of porVenda) {
      const venda = vendas.find((v: any) => v.id === vendaId);
      const frete = fretes.find((f: any) => f.venda_id === vendaId);
      const vitrine = vitrines.find((l: any) => l.id === vendaId || l.pedido_interno_id === vendaId) || null;
      const cliente = venda?.cliente_id ? clientes.find((c: any) => c.id === venda.cliente_id) || null : null;
      pedidos.push({
        venda_id: vendaId,
        revendedor_id: flag.revendedor_id,
        revendedor_nome: flag.revendedor_nome || subs[0]?.revendedor_nome,
        numero_pedido: venda?.numero_pedido || vitrine?.numero_pedido,
        cliente_nome: venda?.cliente_nome || vitrine?.cliente_nome || cliente?.nome,
        destino_sugerido: frete ? null : resolverDestino({}, vitrine, cliente),
        data: venda?.data_pedido || subs[0]?.data_pedido || subs[0]?.created_date,
        total: subs.reduce((s: number, pc: any) => s + (pc.total || 0), 0),
        no_hub: !!frete,
        frete: frete ? publicoFrete(frete, true) : null,
        subpedidos: subs.map((pc: any) => {
          const pk = pks.find((p: any) => p.pedido_compra_id === pc.id);
          return {
            pedido_compra_id: pc.id,
            fabricante_nome: pc.fabricante_nome,
            total: pc.total,
            itens: resumoItens(pc.itens),
            peso_estimado: pk ? null : estimarPeso(pc.itens || [], pesos),
            fabricante_sugerido: sugerirFabricante(pc.fabricante_nome, fabricantes)?.id || null,
            pickup: pk ? publicoPickup(pk, true) : null,
          };
        }),
      });
    }
  }
  pedidos.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  return {
    pedidos,
    fabricantes: fabricantes.map((f: any) => ({ id: f.id, nome: f.nome_fantasia || f.razao_social, cidade: f.cidade, uf: f.estado })),
  };
}

function sugerirFabricante(nome: string, fabricantes: any[]) {
  const alvo = normalizarCidade(nome);
  if (!alvo) return null;
  return fabricantes.find((f) => normalizarCidade(f.nome_fantasia) === alvo || normalizarCidade(f.razao_social) === alvo)
    || fabricantes.find((f) => {
      const n = normalizarCidade(f.nome_fantasia || f.razao_social);
      return n && (n.includes(alvo) || alvo.includes(n));
    }) || null;
}

// Coloca um pedido da revenda no Hub: um Pickup por subpedido + o FreightLeg do pedido completo.
async function incluirPedido({ db, ctx, body }: Args) {
  perfilAtivo(ctx, 'admin');
  const vendaId = String(body.venda_id || '');
  const pcs = (await db.PedidoCompra.filter({ venda_id: vendaId }, 'created_date', 50)).filter((pc: any) => pc.status !== 'cancelado');
  if (!pcs.length) throw new ErroHub('Pedido sem subpedidos de fabricante.', 404);
  const revendedorId = pcs[0].revendedor_id;
  const flag = (await db.HubConfig.filter({ escopo: 'revenda', revendedor_id: revendedorId }, '-created_date', 1))[0];
  if (!flag?.hub_ativo) throw new ErroHub('O Hub não está ligado para esta revenda.', 403);
  if ((await db.FreightLeg.filter({ venda_id: vendaId }, '-created_date', 1)).length) throw new ErroHub('Este pedido já está no Hub.', 409);

  const cfg = await configGlobal(db);
  const baseId = body.base_id || flag.base_padrao_id || cfg?.base_padrao_id;
  if (!baseId) throw new ErroHub('Cadastre uma base e escolha a base padrão nas configurações do Hub.', 409);

  const venda = (await db.Pedido.filter({ id: vendaId }, '-created_date', 1))[0];
  const cliente = venda?.cliente_id ? (await db.Cliente.filter({ id: venda.cliente_id }, '-created_date', 1))[0] : null;
  const vitrine = await pedidoDaVitrine(db, vendaId);
  const destino = resolverDestino(
    { endereco: body.destino_endereco, cidade: body.destino_cidade, uf: body.destino_uf, cep: body.destino_cep, telefone: body.destino_telefone },
    vitrine, cliente,
  );
  const escolhas: Record<string, any> = body.subpedidos || {};
  const pesos = await pesosDoCatalogo(db, pcs.flatMap((pc: any) => pc.itens || []));

  const tokenF = gerarToken();
  const frete = await db.FreightLeg.create({
    venda_id: vendaId,
    numero: numeroCurto('FRT', tokenF),
    qr_mestre_token: tokenF,
    revendedor_id: revendedorId,
    revendedor_nome: pcs[0].revendedor_nome,
    base_id: baseId,
    cliente_nome: venda?.cliente_nome || vitrine?.cliente_nome || cliente?.nome,
    destino_endereco: destino.endereco,
    destino_cidade: destino.cidade,
    destino_uf: destino.uf,
    destino_cep: destino.cep,
    destino_telefone: destino.telefone,
    destino_origem: destino.origem,
    valor_mercadoria: pcs.reduce((s: number, pc: any) => s + (pc.total || 0), 0),
    valor_frete: Number(body.valor_frete) > 0 ? Number(body.valor_frete) : undefined,
    status: 'aguardando_consolidacao',
  });

  for (const pc of pcs) {
    const escolha = escolhas[pc.id] || {};
    const fab = escolha.fabricante_id ? (await db.Fabricante.filter({ id: escolha.fabricante_id }, '-created_date', 1))[0] : null;
    const token = gerarToken();
    const informado = Number(escolha.peso_kg) > 0 ? Number(escolha.peso_kg) : null;
    const estimado = estimarPeso(pc.itens || [], pesos);
    await db.Pickup.create({
      pedido_compra_id: pc.id,
      venda_id: vendaId,
      freight_leg_id: frete.id,
      revendedor_id: revendedorId,
      revendedor_nome: pc.revendedor_nome,
      numero: numeroCurto('COL', token),
      qr_token: token,
      fabricante_id: fab?.id,
      fabricante_nome: fab?.nome_fantasia || fab?.razao_social || pc.fabricante_nome,
      fabricante_endereco: fab?.endereco,
      fabricante_cidade: fab?.cidade,
      fabricante_uf: fab?.estado,
      fabricante_whatsapp: fab?.whatsapp || fab?.telefone,
      base_id: baseId,
      itens_resumo: resumoItens(pc.itens),
      itens: itensEstruturados(pc.itens),
      volumes: Number(escolha.volumes) || undefined,
      peso_kg: informado ?? estimado.peso_kg ?? undefined,
      peso_origem: informado ? 'informado' : estimado.peso_kg ? (estimado.completo ? 'estimado' : 'estimado_parcial') : undefined,
      valor_mercadoria: pc.total,
      valor_coleta: Number(escolha.valor_coleta) > 0 ? Number(escolha.valor_coleta) : undefined,
      status: 'aguardando_pronto',
      recusada_por: [],
      falsas_coletas: 0,
    });
  }
  return { ok: true, freight_leg_id: frete.id };
}

// Valores e dados editaveis pelo admin enquanto o servico nao saiu da fila.
async function definirValores({ db, ctx, body }: Args) {
  perfilAtivo(ctx, 'admin');
  if (body.pickup_id) {
    const p = await pegar(db.Pickup, body.pickup_id, 'Coleta');
    if (['coletada', 'entregue_base', 'conferida', 'cancelada'].includes(p.status) && body.valor_coleta !== undefined && Number(body.valor_coleta) !== p.valor_coleta) {
      throw new ErroHub('A coleta já foi feita; ajuste o valor pelo financeiro.', 409);
    }
    const dados: any = {};
    for (const k of ['valor_coleta', 'volumes', 'peso_kg']) if (body[k] !== undefined && body[k] !== '') dados[k] = Number(body[k]);
    if (dados.peso_kg !== undefined) dados.peso_origem = 'informado';
    if (body.fabricante_id) {
      const fab = await pegar(db.Fabricante, body.fabricante_id, 'Fabricante');
      Object.assign(dados, {
        fabricante_id: fab.id, fabricante_nome: fab.nome_fantasia || fab.razao_social,
        fabricante_endereco: fab.endereco, fabricante_cidade: fab.cidade, fabricante_uf: fab.estado,
        fabricante_whatsapp: fab.whatsapp || fab.telefone,
      });
    }
    await db.Pickup.update(p.id, dados);
    return { ok: true };
  }
  const f = await pegar(db.FreightLeg, body.freight_leg_id, 'Frete');
  if (['retirado', 'entregue', 'cancelado'].includes(f.status) && body.valor_frete !== undefined && Number(body.valor_frete) !== f.valor_frete) {
    throw new ErroHub('O frete já saiu; ajuste o valor pelo financeiro.', 409);
  }
  const dados: any = {};
  for (const k of ['valor_frete', 'volumes', 'peso_kg']) if (body[k] !== undefined && body[k] !== '') dados[k] = Number(body[k]);
  for (const k of ['destino_endereco', 'destino_cidade', 'destino_cep', 'destino_telefone']) if (body[k]) dados[k] = String(body[k]);
  if (body.destino_uf) dados.destino_uf = String(body.destino_uf).toUpperCase().slice(0, 2);
  await db.FreightLeg.update(f.id, dados);
  return { ok: true };
}

// Base le a etiqueta antes de conferir, para montar o checklist dos itens.
async function lerEtiqueta({ db, ctx, body }: Args) {
  perfilAtivo(ctx, body.papel === 'admin' ? 'admin' : 'base');
  const qr = lerQr(body.qr);
  if (qr.tipo === 'F') throw new ErroHub('Este é o QR mestre do pedido. Escaneie a etiqueta do subpedido.');
  const p = (await db.Pickup.filter({ qr_token: qr.token }, '-created_date', 1))[0];
  if (!p) throw new ErroHub('Etiqueta não encontrada no Hub.', 404);
  return { coleta: publicoPickup(p), itens: await itensDaColeta(db, p) };
}

async function marcarLidas({ db, user, body }: Args) {
  const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
  const minhas = await db.HubNotificacao.filter({ destinatario_user_id: user.id, lida: false }, '-created_date', 200);
  for (const n of minhas) if (!ids.length || ids.includes(n.id)) await db.HubNotificacao.update(n.id, { lida: true });
  return { ok: true };
}

function brl(v: number | undefined) {
  return v ? `R$ ${Number(v).toFixed(2).replace('.', ',')}` : 'a definir';
}

const ACOES: Record<string, (a: Args) => Promise<any>> = {
  contexto,
  fila_coletor: filaColetor,
  minhas_coletas: minhasColetas,
  fila_fretista: filaFretista,
  meus_fretes: meusFretes,
  painel_base: painelBase,
  etiquetas,
  acompanhar,
  acao_pickup: acaoPickup,
  acao_frete: acaoFrete,
  marcar_pronto: marcarPronto,
  consolidar,
  custodia,
  falsa_coleta: falsaColeta,
  admin_pedidos: adminPedidos,
  incluir_pedido: incluirPedido,
  definir_valores: definirValores,
  ler_etiqueta: lerEtiqueta,
  marcar_lidas: marcarLidas,
};
