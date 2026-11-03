// ─── Item 023 — Monitor do CRM (pedido do Sr. Leo, 02/11/2026) ───────────────
// O CRM vigia sozinho, por revenda, o que eu (assistente) vigiava à mão:
//   1. resposta automática ao lead novo (falhou / saiu link em vez do PDF);
//   2. tabela (preço fora do padrão da família, produto sem foto);
//   3. funil (lead sem resposta, negociação parada, orçamento sem retorno 24 h / 72 h);
//   4. saúde (WhatsApp 7206 desconectado).
// Só regras, sem IA. Avisa no painel (CRMAlerta) e pelo gerente do 8509 (Cloud API):
// grave na hora; o resto num resumo às 8 h e às 14 h. Fora da janela de 24 h da Meta a
// mensagem fica "aguardando_janela" e é entregue quando o revendedor falar com o 8509.
// Nunca manda nada para cliente; só para o dono da revenda.

const H = 3600000;
export const PAINEL_PADRAO = 'https://app.placefit.com.br';

// ── regras puras (testáveis) ────────────────────────────────────────────────

/** Nome da família do produto, sem o peso no fim (mesma ideia do agrupamento da Sua Tabela). */
export function familiaDoNome(nome: string): string {
  return String(nome || '')
    .replace(/\s*\d+([.,]\d+)?\s*kg(?=(\s*\([^)]*\))?\s*$)/i, '')
    .replace(/\s*\(par\)\s*$/i, '')
    .replace(/[\s-]+$/, '')
    .trim()
    .toLowerCase();
}

export const precoFinal = (sp: any) => Number(sp?.sale_price) > 0 ? Number(sp.sale_price) : Number(sp?.preco || 0) * (1 + (Number(sp?.margem) || 0) / 100);

/**
 * Preço fora do padrão: compara o R$/kg do item com a mediana da família (≥ 3 itens com peso).
 * Fora de 40%–250% da mediana → suspeito.
 */
export function precosSuspeitos(itens: { id: string; nome: string; peso_kg: number; preco: number }[]) {
  const fam = new Map<string, any[]>();
  for (const it of itens) {
    if (!(Number(it.peso_kg) > 0) || !(Number(it.preco) > 0)) continue;
    const f = familiaDoNome(it.nome);
    if (!fam.has(f)) fam.set(f, []);
    fam.get(f)!.push({ ...it, kg: Number(it.preco) / Number(it.peso_kg) });
  }
  const out: any[] = [];
  for (const grupo of fam.values()) {
    if (grupo.length < 3) continue;
    const ord = grupo.map((g) => g.kg).sort((a, b) => a - b);
    const med = ord.length % 2 ? ord[(ord.length - 1) / 2] : (ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2;
    for (const g of grupo) {
      const r = g.kg / med;
      if (r < 0.4 || r > 2.5) out.push({ ...g, mediana_kg: med, razao: r });
    }
  }
  return out;
}

export const brl = (v: number) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function tempoTexto(ms: number): string {
  const h = Math.floor(ms / H);
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))} min`;
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} dias`;
}

/**
 * Funil de UMA conversa. `ultimas` = mensagens mais recentes primeiro.
 * `ehLead` = a conversa começou como lead (recebeu boas-vindas) ou já tem orçamento.
 * Conversa pessoal (sem boas-vindas, em novo/atendimento) nunca gera alerta.
 */
export function alertasDoFunil(conversa: any, ultimas: any[], ehLead: boolean, orcamento: any, agora: number) {
  const out: any[] = [];
  const nome = conversa?.nome_contato || 'Contato';
  const ultima = ultimas?.[0];
  const idade = ultima ? agora - new Date(ultima.created_date).getTime() : 0;
  const etapa = String(conversa?.etapa || 'novo');

  if (ehLead && (etapa === 'novo' || etapa === 'atendimento') && ultima?.direcao === 'recebida' && idade >= 2 * H && idade <= 7 * 24 * H) {
    out.push({ tipo: 'funil', gravidade: 'atencao', chave: `lead_sem_resposta:${conversa.id}`,
      titulo: `Lead sem resposta há ${tempoTexto(idade)}: ${nome}`,
      detalhe: `Última mensagem do cliente: "${String(ultima.conteudo || '').slice(0, 120)}"`, conversa_id: conversa.id });
  }
  if (etapa === 'negociacao' && ultima?.direcao === 'recebida' && idade >= 2 * H && idade <= 7 * 24 * H) {
    out.push({ tipo: 'funil', gravidade: 'atencao', chave: `negociacao_sem_resposta:${conversa.id}`,
      titulo: `Cliente em negociação esperando resposta há ${tempoTexto(idade)}: ${nome}`,
      detalhe: `Última mensagem: "${String(ultima.conteudo || '').slice(0, 120)}"`, conversa_id: conversa.id });
  }
  if (etapa === 'orcamento' && orcamento?.created_date) {
    const desde = new Date(orcamento.created_date).getTime();
    const respondeu = (ultimas || []).some((m: any) => m.direcao === 'recebida' && new Date(m.created_date).getTime() > desde);
    const t = agora - desde;
    if (!respondeu && t >= 24 * H && t <= 15 * 24 * H) {
      const fase = t >= 72 * H ? '72h' : '24h';
      out.push({ tipo: 'funil', gravidade: 'atencao', chave: `orcamento_${fase}:${conversa.id}:${orcamento.id}`,
        titulo: `Orçamento sem retorno há ${tempoTexto(t)}: ${nome}`,
        detalhe: `${orcamento.numero || 'Orçamento'}${Number(orcamento.total) > 0 ? ' · ' + brl(orcamento.total) : ''}. ` +
          (fase === '72h' ? 'Hora do segundo contato: pergunte se ficou alguma dúvida ou se quer ajustar algo.' : 'Hora do primeiro retorno: confirme se o cliente recebeu e viu o orçamento.'),
        conversa_id: conversa.id, ref_id: orcamento.id });
    }
  }
  return out;
}

/** Resposta automática das últimas horas → alertas. */
export function alertasBoasVindas(msgsSistema: any[], agora: number, hojeBR: string) {
  const out: any[] = [];
  let link = 0;
  for (const m of msgsSistema || []) {
    if (agora - new Date(m.created_date).getTime() > 26 * H) continue;
    if (m.status === 'erro') {
      out.push({ tipo: 'boas_vindas', gravidade: 'grave', chave: `boasvindas_erro:${m.id}`,
        titulo: 'A resposta automática não saiu para um lead novo',
        detalhe: `Erro: ${String(m.erro || 'falha no envio').slice(0, 160)}. Responda esse contato manualmente.`, conversa_id: m.conversa_id, ref_id: m.id });
    } else if (!String(m.conteudo || '').startsWith('[PDF:')) link++;
  }
  if (link) {
    out.push({ tipo: 'boas_vindas', gravidade: 'atencao', chave: `boasvindas_link:${hojeBR}`,
      titulo: `Hoje ${link === 1 ? '1 lead recebeu' : link + ' leads receberam'} o link da tabela em vez do PDF`,
      detalhe: 'O PDF não saiu (serviço de PDF fora do ar ou o WhatsApp recusou o arquivo). O cliente recebeu o link, que funciona, mas vale verificar.' });
  }
  return out;
}

export function textoResumo(empresa: string, alertas: any[], painel = PAINEL_PADRAO) {
  const icone = (g: string) => g === 'grave' ? '🔴' : g === 'atencao' ? '🟡' : '⚪';
  const linhas = alertas.slice(0, 10).map((a, i) => `${i + 1}. ${icone(a.gravidade)} ${a.titulo}`);
  const mais = alertas.length > 10 ? `\n…e mais ${alertas.length - 10} no painel.` : '';
  return `🔔 Monitor do CRM${empresa ? ' — ' + empresa : ''}\n\n${linhas.join('\n')}${mais}\n\nVer e resolver: ${painel.replace(/\/+$/, '')}/CRMWhatsApp`;
}

export const foraDaJanela = (erro: string) => /131047|24[ -]?h|24 hours|re-?engagement|janela/i.test(String(erro || ''));

export function horaBR(d: Date) {
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).reduce((o: any, x) => (o[x.type] = x.value, o), {});
  return { hora: Number(p.hour) % 24, dia: `${p.year}-${p.month}-${p.day}` };
}

// ── acesso a dados ──────────────────────────────────────────────────────────

const sessionDe = (u: any) => {
  const custom = String(u?.whatsapp_waha_session || '').trim();
  return custom && custom.toLowerCase() !== 'default' ? custom : 'u' + String(u?.id || '').replace(/[^A-Za-z0-9]/g, '').slice(-24);
};

async function todos(fn: (skip: number) => Promise<any[]>, max = 10000) {
  let out: any[] = [];
  for (let skip = 0; skip < max; skip += 500) {
    const lote = (await fn(skip)) || [];
    out = out.concat(lote);
    if (lote.length < 500) break;
  }
  return out;
}

/** Cria (se não houver aberto com a mesma chave) e devolve só os NOVOS. */
async function registrar(db: any, ownerId: string, lista: any[]) {
  const novos: any[] = [];
  for (const a of lista) {
    const ja = await db.CRMAlerta.filter({ owner_id: ownerId, chave: a.chave, status: 'aberto' }, '-created_date', 1);
    if (ja?.length) {
      if (ja[0].titulo !== a.titulo || ja[0].detalhe !== a.detalhe) await db.CRMAlerta.update(ja[0].id, { titulo: a.titulo, detalhe: a.detalhe || '' });
      continue;
    }
    // dispensado pelo dono: não volta com a mesma chave
    const disp = await db.CRMAlerta.filter({ owner_id: ownerId, chave: a.chave, status: 'dispensado' }, '-created_date', 1);
    if (disp?.length) continue;
    const criado = await db.CRMAlerta.create({ owner_id: ownerId, status: 'aberto', whatsapp_status: a.gravidade === 'info' ? 'so_painel' : '', ...a });
    novos.push(criado);
  }
  return novos;
}

/** Fecha sozinho os alertas de um grupo que não aparecem mais. */
async function resolverSumidos(db: any, ownerId: string, prefixos: string[], atuais: Set<string>) {
  const abertos = await db.CRMAlerta.filter({ owner_id: ownerId, status: 'aberto' }, '-created_date', 500);
  for (const a of abertos || []) {
    if (prefixos.some((p) => String(a.chave).startsWith(p)) && !atuais.has(a.chave)) {
      await db.CRMAlerta.update(a.id, { status: 'resolvido', resolvido_em: new Date().toISOString(), resolvido_por: 'monitor' });
    }
  }
}

async function marcador(db: any, ownerId: string, chave: string) {
  const ja = await db.CRMAlerta.filter({ owner_id: ownerId, tipo: 'controle', chave }, '-created_date', 1);
  if (ja?.length) return false;
  await db.CRMAlerta.create({ owner_id: ownerId, tipo: 'controle', gravidade: 'info', chave, titulo: chave, status: 'resolvido', whatsapp_status: 'so_painel' });
  return true;
}

export type Cfg = {
  wahaUrl: string; wahaKey: string;
  metaToken: string; phoneNumberId: string; tenant8509: string; ownerPhone: string;
  painel: string;
};

async function enviarCloud(cfg: Cfg, para: string, texto: string) {
  if (!cfg.metaToken || !cfg.phoneNumberId) return { ok: false, id: '', error: 'Cloud API não configurada' };
  const r = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.metaToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, type: 'text', text: { preview_url: false, body: texto } })
  });
  const d: any = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: String(d?.messages?.[0]?.id || ''), error: '' }
    : { ok: false, id: '', error: `HTTP ${r.status} ${d?.error?.code || ''}: ${d?.error?.message || 'falha'}` };
}

/** Celular do dono da revenda no gerente 8509 (vínculo verificado; a conta do 8509 usa o OWNER_PHONE). */
export async function destinoDoDono(db: any, ownerId: string, cfg: Cfg) {
  if (ownerId === cfg.tenant8509 && cfg.ownerPhone) return cfg.ownerPhone.replace(/\D/g, '');
  const v = await db.VinculoGerenteWhatsApp.filter({ user_id: ownerId, verificado: true }, '-verificado_em', 1);
  return String(v?.[0]?.telefone || '').replace(/\D/g, '');
}

async function notificar(db: any, cfg: Cfg, ownerId: string, empresa: string, alertas: any[]) {
  if (!alertas.length) return;
  const para = await destinoDoDono(db, ownerId, cfg);
  const agora = new Date().toISOString();
  if (!para) {
    for (const a of alertas) await db.CRMAlerta.update(a.id, { whatsapp_status: 'sem_destino' });
    return;
  }
  const env = await enviarCloud(cfg, para, textoResumo(empresa, alertas, cfg.painel));
  const st = env.ok ? 'enviado' : foraDaJanela(env.error) ? 'aguardando_janela' : 'erro';
  for (const a of alertas) {
    await db.CRMAlerta.update(a.id, { whatsapp_status: st, whatsapp_erro: env.ok ? '' : env.error.slice(0, 300), ...(env.ok ? { notificado_em: agora } : {}) });
  }
}

/** Quando o revendedor fala com o 8509 a janela abre: entrega o que ficou esperando. */
export async function entregarPendentes(db: any, cfg: Cfg, telefone: string) {
  const tel = String(telefone || '').replace(/\D/g, '');
  if (!tel) return 0;
  let ownerId = '';
  if (cfg.ownerPhone && tel === cfg.ownerPhone.replace(/\D/g, '')) ownerId = cfg.tenant8509;
  else {
    const chave = tel.length >= 10 ? tel.slice(-10, -8) + tel.slice(-8) : '';
    const v = chave ? await db.VinculoGerenteWhatsApp.filter({ chave_telefone: chave, verificado: true }, '-verificado_em', 1) : [];
    ownerId = String(v?.[0]?.user_id || '');
  }
  if (!ownerId) return 0;
  const pend = (await db.CRMAlerta.filter({ owner_id: ownerId, status: 'aberto', whatsapp_status: 'aguardando_janela' }, '-created_date', 30)) || [];
  if (!pend.length) return 0;
  const u = (await db.User.filter({ id: ownerId }))?.[0];
  const env = await enviarCloud(cfg, tel, textoResumo(u?.empresa || '', pend, cfg.painel));
  for (const a of pend) {
    await db.CRMAlerta.update(a.id, env.ok ? { whatsapp_status: 'enviado', notificado_em: new Date().toISOString(), whatsapp_erro: '' } : { whatsapp_erro: env.error.slice(0, 300) });
  }
  return env.ok ? pend.length : 0;
}

// ── execução ────────────────────────────────────────────────────────────────

export async function rodarMonitor(db: any, cfg: Cfg, agoraD = new Date()) {
  const agora = agoraD.getTime();
  const { hora, dia } = horaBR(agoraD);
  const relatorio: any[] = [];

  const recentes = await db.CRMConversa.filter({ ativo: true }, '-ultima_interacao', 500);
  const porDono = new Map<string, any[]>();
  for (const c of recentes || []) {
    if (!c.owner_id || !c.ultima_interacao || agora - new Date(c.ultima_interacao).getTime() > 30 * 24 * H) continue;
    if (!porDono.has(c.owner_id)) porDono.set(c.owner_id, []);
    porDono.get(c.owner_id)!.push(c);
  }

  for (const [ownerId, conversas] of porDono) {
    const rel: any = { ownerId, novos: 0 };
    try {
      const dono = (await db.User.filter({ id: ownerId }))?.[0];
      if (!dono || dono.tipo_usuario === 'fabricante' || dono.tipo_usuario === 'transportador') continue;
      const novos: any[] = [];

      // 1. resposta automática
      const sist = await db.CRMMensagem.filter({ owner_id: ownerId, origem: 'sistema', direcao: 'enviada' }, '-created_date', 30);
      novos.push(...await registrar(db, ownerId, alertasBoasVindas(sist || [], agora, dia)));

      // 3. funil (só conversas dos últimos 15 dias)
      const leadsComBoasVindas = new Set((sist || []).map((m: any) => m.conversa_id));
      const atuais = new Set<string>();
      for (const c of conversas.slice(0, 150)) {
        if (agora - new Date(c.ultima_interacao).getTime() > 15 * 24 * H) continue;
        if (!['novo', 'atendimento', 'orcamento', 'negociacao'].includes(String(c.etapa || 'novo'))) continue;
        const ultimas = await db.CRMMensagem.filter({ conversa_id: c.id }, '-created_date', 15);
        let orc: any = null;
        if (c.etapa === 'orcamento' && c.cliente_id) {
          orc = (await db.Pedido.filter({ fornecedor_id: ownerId, cliente_id: c.cliente_id, tipo: 'orcamento' }, '-created_date', 1))?.[0] || null;
        }
        let ehLead = leadsComBoasVindas.has(c.id);
        if (!ehLead && (c.etapa === 'novo' || c.etapa === 'atendimento')) {
          ehLead = Boolean((await db.CRMMensagem.filter({ conversa_id: c.id, origem: 'sistema' }, '-created_date', 1))?.length);
        }
        const lista = alertasDoFunil(c, ultimas || [], ehLead, orc, agora);
        lista.forEach((a) => atuais.add(a.chave));
        novos.push(...await registrar(db, ownerId, lista));
      }
      await resolverSumidos(db, ownerId, ['lead_sem_resposta:', 'negociacao_sem_resposta:', 'orcamento_24h:', 'orcamento_72h:'], atuais);

      // 2. tabela — 1x por dia
      if (await marcador(db, ownerId, `tabela_checada:${dia}`)) {
        const sps = await todos((skip) => db.SupplierProduct.filter({ supplier_id: ownerId }, '-created_date', 500, skip));
        const ativos = sps.filter((sp: any) => Number(sp.preco) > 0 && sp.product_id && sp.disponivel !== false);
        const ids = [...new Set(ativos.map((sp: any) => sp.product_id))];
        const tpl = new Map<string, any>();
        for (let i = 0; i < ids.length; i += 200) {
          for (const t of (await db.ProductTemplate.filter({ id: { $in: ids.slice(i, i + 200) } }, '-created_date', 200)) || []) tpl.set(t.id, t);
        }
        const itens = ativos.map((sp: any) => ({ sp, t: tpl.get(sp.product_id) })).filter((x: any) => x.t)
          .map((x: any) => ({ id: x.sp.id, nome: x.t.nome, cod: x.t.cod, peso_kg: Number(x.t.peso_kg) || 0, preco: precoFinal(x.sp), foto: x.t.foto }));
        const susp = precosSuspeitos(itens);
        const chavesTab = new Set<string>();
        const listaTab: any[] = susp.map((s: any) => {
          const chave = `preco_suspeito:${s.id}:${Math.round(s.preco * 100)}`;
          chavesTab.add(chave);
          return { tipo: 'tabela', gravidade: 'atencao', chave, ref_id: s.id,
            titulo: `Preço fora do padrão: ${s.nome} a ${brl(s.preco)}`,
            detalhe: `${brl(s.kg)}/kg, quando a família está em torno de ${brl(s.mediana_kg)}/kg. Esse preço aparece na tabela e no PDF que vai para o cliente.` };
        });
        const semFoto = itens.filter((i: any) => !i.foto).length;
        if (semFoto) {
          chavesTab.add('sem_foto');
          listaTab.push({ tipo: 'tabela', gravidade: 'info', chave: 'sem_foto', titulo: `${semFoto} produto(s) da tabela sem foto`,
            detalhe: 'Sem foto, o produto aparece com um ícone genérico na tabela e no PDF.' });
        }
        novos.push(...await registrar(db, ownerId, listaTab));
        await resolverSumidos(db, ownerId, ['preco_suspeito:', 'sem_foto'], chavesTab);
      }

      // 4. saúde do WhatsApp 7206 (WAHA, só leitura)
      const usaWaha = (await db.CRMMensagem.filter({ owner_id: ownerId, origem: 'waha' }, '-created_date', 1))?.[0];
      if (usaWaha && cfg.wahaUrl && agora - new Date(usaWaha.created_date).getTime() < 30 * 24 * H) {
        let estado = '';
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 8000);
          const r = await fetch(`${cfg.wahaUrl.replace(/\/+$/, '')}/api/sessions/${sessionDe(dono)}`, { headers: cfg.wahaKey ? { 'X-Api-Key': cfg.wahaKey } : {}, signal: ctrl.signal });
          clearTimeout(t);
          estado = r.ok ? String((await r.json().catch(() => ({})))?.status || '') : `HTTP ${r.status}`;
        } catch (e) {
          estado = 'sem resposta';
        }
        const saude = new Set<string>();
        if (estado && estado !== 'WORKING') {
          saude.add('waha_desconectado');
          novos.push(...await registrar(db, ownerId, [{ tipo: 'saude', gravidade: 'grave', chave: 'waha_desconectado',
            titulo: 'WhatsApp do CRM desconectado', detalhe: `Status do WhatsApp: ${estado}. Enquanto não reconectar, leads novos não chegam ao CRM e a resposta automática não sai.` }]));
        }
        if (estado) await resolverSumidos(db, ownerId, ['waha_desconectado'], saude);
      }

      // Aviso: grave na hora; resumo às 8 h e às 14 h (horário de Brasília)
      const graves = novos.filter((a) => a.gravidade === 'grave');
      if (graves.length) await notificar(db, cfg, ownerId, dono.empresa || '', graves);
      if ((hora === 8 || hora === 14) && await marcador(db, ownerId, `resumo:${dia}:${hora}`)) {
        const pend = ((await db.CRMAlerta.filter({ owner_id: ownerId, status: 'aberto' }, '-created_date', 100)) || [])
          .filter((a: any) => a.tipo !== 'controle' && a.gravidade !== 'info' && !a.notificado_em && a.whatsapp_status !== 'aguardando_janela');
        await notificar(db, cfg, ownerId, dono.empresa || '', pend);
      }
      rel.novos = novos.length;
    } catch (e) {
      rel.erro = String((e as any)?.message || e);
      console.error('[MONITOR] conta', ownerId, e);
    }
    relatorio.push(rel);
  }
  return relatorio;
}
