// ─── Item 023 fase 2 — Vendedor automático do lead (Sr. Leo, 03/11/2026) ────────
// Fluxo híbrido no WhatsApp do CRM (7206):
//  1. lead novo recebe o PDF da tabela e o pedido de lista + CNPJ (item 022e/f);
//  2. cliente manda a lista: sem CNPJ, pedimos CNPJ — ou nome, CPF e endereço com CEP (pessoa física);
//  3. com lista + documento: cadastro pela Receita (telefone = o do WhatsApp), orçamento pelo MESMO motor
//     do gerente (produto, preço e frete são do código; a IA só lê o pedido), PDF do painel, envio ao cliente;
//  4. qualquer dúvida que importa (item que não existe, frete sem tabela, pergunta do cliente) NÃO vai ao
//     cliente: vira alerta "duvida" e o dono é avisado na hora pelo gerente do 8509.
// Travas: só conversa que começou como lead (recebeu boas-vindas), só em Novo/Em atendimento, para se um
// humano respondeu pelo celular, CRM_VENDEDOR=off desliga. Conversa pessoal nunca é tocada.

import { SCHEMA_PEDIDO, PROMPT_PARSER, montarRascunho, gravar, itensComOrigem } from './orcamentoGerente.ts';
import { invocarIA } from './iaComRetry.ts';
import { moverLeadParaOrcamento } from './funilCrm.js';
import { montarHtmlPedido } from './pedidoPdfHtml.js';
import { scriptCores, imprimirPdf } from './tabelaPdf.ts';

const H = 3600000;
export const ESPERA_RAJADA_MS = 15000;
const digitos = (s: string) => String(s || '').replace(/\D/g, '');
export const brl = (v: number) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const SCHEMA_LEAD = {
  ...SCHEMA_PEDIDO,
  properties: { ...SCHEMA_PEDIDO.properties, pergunta: { type: 'string' }, endereco: { type: 'string' } },
  required: [...SCHEMA_PEDIDO.required, 'pergunta', 'endereco']
};

export const PROMPT_LEAD = `CONTEXTO: as mensagens abaixo são de um CLIENTE (lead) que recebeu a tabela de atacado da revenda pelo
WhatsApp e respondeu. Trate o que o CLIENTE escreveu como o pedido (no lugar do "dono" das regras abaixo).
- acao = "orcamento" quando ele mandou itens OU dados de cadastro (CNPJ, CPF, nome, endereço, CEP); senão "consulta".
- cliente.telefone = "" (o sistema usa o número do WhatsApp). cliente.nome só se ELE escreveu o nome/razão social.
- pergunta: se o cliente fez uma pergunta que pede resposta de uma pessoa (prazo, forma de pagamento, desconto,
  produto fora da lista, visita, garantia...), copie a pergunta; senão "".
- endereco: o endereço de entrega que ele escreveu (rua, número, bairro, cidade/UF); senão "".
- Ignore cumprimentos e agradecimentos. Não existe RASCUNHO ATUAL nem PERGUNTAS QUE FIZEMOS.

REGRAS DO SISTEMA PARA LER OS ITENS (valem para o cliente):
` + PROMPT_PARSER;

// Mensagens fixas ao cliente (sem IA)
export const MSG_PEDIR_DADOS = 'Perfeito, recebi sua lista! Para eu montar o orçamento já com o frete, me envia o CNPJ da empresa.\n\nSe a compra for como pessoa física, me manda nome completo, CPF e o endereço de entrega com CEP.';
export const MSG_PEDIR_LISTA = 'Obrigado! Já estou com seus dados. Agora me manda a lista dos itens com as quantidades que eu monto o orçamento com o frete.';
export const MSG_CONFERINDO = 'Recebi! Estou conferindo alguns detalhes do seu pedido e já te retorno por aqui.';

export function legendaOrcamento(nome: string, numero: string, total: number, cidade: string, uf: string) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  const destino = [cidade, uf].filter(Boolean).join('/');
  return `${primeiro ? primeiro + ', s' : 'S'}egue o seu orçamento ${numero}.\n` +
    `Total: ${brl(total)}${destino ? `, já com o frete para ${destino}` : ', já com o frete'}.\n\n` +
    'Válido por 30 dias. Se quiser ajustar algum item ou quantidade, é só me falar por aqui.';
}

/** Observações que vão no PDF do cliente: só as condições do cadastro da revenda e o destino do frete. */
export function observacoesCliente(owner: any, r: any) {
  const destino = [r?.cliente?.cidade, r?.cliente?.estado].filter(Boolean).join('/');
  return [
    owner?.condicoes_pagamento && `Pagamento: ${String(owner.condicoes_pagamento).trim()}`,
    owner?.prazo_producao && `Prazo: ${String(owner.prazo_producao).trim()}`,
    destino && `Frete calculado para ${destino}.`,
    owner?.informacoes_frete && String(owner.informacoes_frete).trim()
  ].filter(Boolean).join('<br>');
}

/** O que fazer com o pedido lido (puro, testável). */
export function decidir(pedido: any, r: any | null) {
  const itens = pedido?.itens || [];
  const doc = digitos(pedido?.cliente?.cpf_cnpj);
  const pergunta = String(pedido?.pergunta || '').trim();
  if (!itens.length) {
    if (pergunta) return { acao: 'escalar', motivos: [`Pergunta do cliente: "${pergunta}"`] };
    if (doc || pedido?.cliente?.nome) return { acao: 'pedir_lista', motivos: [] };
    return { acao: 'nada', motivos: [] };
  }
  if (!doc) return { acao: 'pedir_dados', motivos: [] };
  if (!r) return { acao: 'montar', motivos: [] };
  // Pessoa física sem cidade/UF ou CEP: o motor pergunta; pedimos ao cliente
  const perguntasCadastro = (r.perguntas || []).filter((p: string) => /cliente novo|cidade\/uf|cep|nome\/raz|CPF\/CNPJ/i.test(p));
  const outrasPerguntas = (r.perguntas || []).filter((p: string) => !perguntasCadastro.includes(p));
  if (!outrasPerguntas.length && perguntasCadastro.length && r.itens?.length && doc.length === 11) {
    return { acao: 'pedir_dados', motivos: perguntasCadastro };
  }
  const motivos: string[] = [];
  if (outrasPerguntas.length) motivos.push(...outrasPerguntas);
  if (perguntasCadastro.length && doc.length === 14) motivos.push(...perguntasCadastro);
  if (r.nao_cotados?.length) motivos.push(`Itens sem correspondência no catálogo: ${r.nao_cotados.join('; ')}`);
  if (r.frete === null || !String(r.frete_origem || '').startsWith('tabela')) motivos.push('Frete não saiu da tabela de frete.');
  if ((r.ressalvas || []).some((x: string) => /confer[eê]ncia|indispon[ií]vel/i.test(x))) motivos.push(...r.ressalvas.filter((x: string) => /confer[eê]ncia|indispon[ií]vel/i.test(x)));
  if (!(Number(r.total) > 0) || !r.itens?.length) motivos.push('Orçamento sem itens cotados.');
  if (motivos.length || !r.pronto) return { acao: 'escalar', motivos: motivos.length ? motivos : ['Orçamento incompleto.'], pergunta };
  return { acao: 'enviar', motivos: [], pergunta };
}

/** Mensagem enviada por uma PESSOA pelo celular (não o sistema, não eco do PDF): o humano assumiu. */
export function humanoAssumiu(msgs: any[], desdeIso: string) {
  const sist = msgs.filter((m) => m.origem === 'sistema').map((m) => String(m.conteudo || ''));
  return msgs.some((m) => m.direcao === 'enviada' && m.origem === 'waha' && m.created_date > desdeIso &&
    !/^\[(m[ií]dia|mensagem n[aã]o textual)/i.test(String(m.conteudo || '')) &&
    !sist.some((s) => s && String(m.conteudo || '').length > 10 && s.includes(String(m.conteudo).slice(0, 40))));
}

export type Ctx = {
  db: any; base44: any; owner: any; conversa: any; messageId: string;
  enviarTexto: (texto: string) => Promise<{ ok: boolean; id: string; error: string }>;
  enviarPdf: (bytes: Uint8Array, nome: string, legenda: string) => Promise<{ ok: boolean; id: string; error: string }>;
  pdfCfg: { url: string; user: string; pass: string };
  avisarDono: (alertas: any[]) => Promise<void>;
  esperar?: (ms: number) => Promise<void>;
  deps?: Partial<{ ler: (prompt: string) => Promise<any>; montar: (pedido: any) => Promise<any>; gravar: (r: any, opcoes: any) => Promise<any>; pdf: (html: string) => Promise<Uint8Array> }>;
};

async function registrarSaida(ctx: Ctx, texto: string, env: any, tipo = 'texto') {
  await ctx.db.CRMMensagem.create({
    owner_id: ctx.owner.id, conversa_id: ctx.conversa.id, telefone: ctx.conversa.telefone || '',
    direcao: 'enviada', tipo, conteudo: texto, status: env.ok ? 'enviada' : 'erro',
    meta_message_id: env.id, erro: env.error, origem: 'sistema'
  });
  if (env.ok) await ctx.db.CRMConversa.update(ctx.conversa.id, { ultima_mensagem: texto.slice(0, 200), ultima_interacao: new Date().toISOString() });
}

/** Manda uma mensagem fixa no máximo 1x a cada 6 h na conversa. */
async function mandarUmaVez(ctx: Ctx, msgs: any[], texto: string) {
  const ja = msgs.some((m) => m.origem === 'sistema' && m.conteudo === texto && Date.now() - Date.parse(m.created_date + (/Z$/.test(m.created_date) ? '' : 'Z')) < 6 * H);
  if (ja) return false;
  const env = await ctx.enviarTexto(texto);
  await registrarSaida(ctx, texto, env);
  return env.ok;
}

async function escalar(ctx: Ctx, msgs: any[], motivos: string[], resumo: string) {
  const alerta = await ctx.db.CRMAlerta.create({
    owner_id: ctx.owner.id, tipo: 'duvida', gravidade: 'grave', status: 'aberto', whatsapp_status: '',
    chave: `duvida:${ctx.conversa.id}:${ctx.messageId}`, conversa_id: ctx.conversa.id,
    titulo: `Lead esperando você: ${ctx.conversa.nome_contato || 'contato'} — o vendedor automático parou`,
    detalhe: [...motivos, resumo].filter(Boolean).join(' | ').slice(0, 1500)
  });
  await ctx.avisarDono([alerta]);
  await mandarUmaVez(ctx, msgs, MSG_CONFERINDO);
}

/**
 * Atende a mensagem `messageId` de um lead. Nunca lança.
 * Devolve { atuou, motivo } — atuou = mandou algo ao cliente ou avisou o dono.
 */
export async function atenderLead(ctx: Ctx): Promise<{ atuou: boolean; motivo: string }> {
  try {
    if (String(Deno.env.get('CRM_VENDEDOR') || '').trim().toLowerCase() === 'off') return { atuou: false, motivo: 'desligado' };
    if (!['novo', 'atendimento'].includes(String(ctx.conversa?.etapa || 'novo'))) return { atuou: false, motivo: 'etapa' };
    if (!/^55\d{10,11}$/.test(digitos(ctx.conversa?.telefone))) return { atuou: false, motivo: 'sem_telefone' };

    // Só conversa que começou como lead (recebeu boas-vindas): conversa pessoal sai aqui, sem esperar nada
    const bv = (await ctx.db.CRMMensagem.filter({ conversa_id: ctx.conversa.id, origem: 'sistema' }, 'created_date', 1))?.[0];
    if (!bv) return { atuou: false, motivo: 'nao_lead' };

    // Rajada: espera o cliente terminar de digitar; só a mensagem mais nova segue
    await (ctx.esperar || ((ms) => new Promise((r) => setTimeout(r, ms))))(ESPERA_RAJADA_MS);
    const msgs = (await ctx.db.CRMMensagem.filter({ conversa_id: ctx.conversa.id }, '-created_date', 40)) || [];
    const ultimaRecebida = msgs.find((m: any) => m.direcao === 'recebida');
    if (!ultimaRecebida || (ctx.messageId && ultimaRecebida.meta_message_id !== ctx.messageId)) return { atuou: false, motivo: 'mais_nova' };
    if (humanoAssumiu(msgs, bv.created_date)) return { atuou: false, motivo: 'humano' };

    // Já tem orçamento recente deste vendedor? (corrida entre mensagens) — não monta outro
    if (msgs.some((m: any) => m.origem === 'sistema' && String(m.conteudo || '').startsWith('[PDF orçamento:') && Date.now() - Date.parse(m.created_date + (/Z$/.test(m.created_date) ? '' : 'Z')) < 30 * 60000)) {
      return { atuou: false, motivo: 'ja_orcado' };
    }

    // Inclui a 1ª mensagem do lead (chega segundos ANTES das boas-vindas)
    const corte = new Date(Date.parse(bv.created_date + (/Z$/.test(bv.created_date) ? '' : 'Z')) - 10 * 60000).toISOString().replace('Z', '');
    const doCliente = msgs.filter((m: any) => m.direcao === 'recebida' && String(m.created_date).replace('Z', '') >= corte).reverse()
      .map((m: any) => String(m.conteudo || '')).filter((t: string) => t && !/^\[(m[ií]dia|mensagem n[aã]o textual)/i.test(t)).slice(-25);
    if (!doCliente.length) return { atuou: false, motivo: 'sem_texto' };
    const textoCliente = doCliente.join('\n');

    const ler = ctx.deps?.ler || (async (prompt: string) => {
      const ai: any = await invocarIA(ctx.base44, { prompt, response_json_schema: SCHEMA_LEAD });
      return typeof ai === 'string' ? JSON.parse(ai) : ai;
    });
    const pedido = await ler(PROMPT_LEAD + `\n\nCONVERSA RECENTE:\n(nenhuma)\n\nÚLTIMA MENSAGEM DO DONO (aqui: TODAS as mensagens do cliente, uma por linha):\n${textoCliente}`);
    if (!pedido) return { atuou: false, motivo: 'leitura_vazia' };
    pedido.itens = itensComOrigem(pedido.itens || [], textoCliente).ficam;
    pedido.cliente = { ...(pedido.cliente || {}), telefone: digitos(ctx.conversa.telefone) };
    pedido.frete_informado = -1;
    if (!pedido.cep_entrega && digitos(pedido.cliente.cep).length !== 8) {
      const cep = (String(pedido.endereco || '') + ' ' + textoCliente).match(/\b\d{5}-?\d{3}\b/);
      if (cep) pedido.cliente.cep = digitos(cep[0]);
    }

    let d = decidir(pedido, null);
    if (d.acao === 'nada') return { atuou: false, motivo: 'nada' };
    if (d.acao === 'pedir_lista') return { atuou: await mandarUmaVez(ctx, msgs, MSG_PEDIR_LISTA), motivo: 'pedir_lista' };
    if (d.acao === 'pedir_dados') return { atuou: await mandarUmaVez(ctx, msgs, MSG_PEDIR_DADOS), motivo: 'pedir_dados' };
    const itensTexto = (pedido.itens || []).map((i: any) => `${i.quantidade} ${i.descricao}`).join('; ');
    if (d.acao === 'escalar') { await escalar(ctx, msgs, d.motivos, `Pedido: ${itensTexto || '(sem itens)'}`); return { atuou: true, motivo: 'escalou' }; }

    const montar = ctx.deps?.montar || ((p: any) => montarRascunho(ctx.base44, ctx.owner.id, p, null));
    const r = await montar(pedido);
    d = decidir(pedido, r);
    if (d.acao === 'pedir_dados') return { atuou: await mandarUmaVez(ctx, msgs, MSG_PEDIR_DADOS), motivo: 'pedir_dados' };
    if (d.acao !== 'enviar') {
      await escalar(ctx, msgs, d.motivos, `Pedido: ${itensTexto}`);
      return { atuou: true, motivo: 'escalou' };
    }

    // Grava o orçamento (observações para o cliente) e gera o PDF do painel
    const grav = ctx.deps?.gravar || ((rr: any, op: any) => gravar(ctx.base44, ctx.owner.id, rr, op));
    const { pedido: p, divergencias } = await grav(r, {
      observacoes: observacoesCliente(ctx.owner, r),
      origemCliente: 'Cadastrado pelo vendedor automático do CRM (lead do WhatsApp).'
    });
    if (divergencias?.length) { await escalar(ctx, msgs, [`Conferência do orçamento salvo falhou: ${divergencias.join('; ')}`], `Orçamento ${p?.numero_pedido}`); return { atuou: true, motivo: 'escalou' }; }
    const cli = (await ctx.db.Cliente.filter({ id: p.cliente_id }, '-created_date', 1))?.[0] || r.cliente;
    if (cli?.id && !ctx.conversa.cliente_id) await ctx.db.CRMConversa.update(ctx.conversa.id, { cliente_id: cli.id });

    const legenda = legendaOrcamento(ctx.conversa.nome_contato || cli?.nome || '', p.numero_pedido, p.total, r.cliente?.cidade, r.cliente?.estado);
    let env: any = { ok: false, id: '', error: '' };
    try {
      const html = montarHtmlPedido({
        pedido: p, user: ctx.owner, cliente: { ...cli, observacoes: '' }, tipo: 'orcamento', pesoTotal: r.peso_total,
        colors: CORES_PEDIDO_CSS, extraHead: scriptCores(ctx.owner?.logomarca || '')
      });
      const bytes = await (ctx.deps?.pdf || ((h: string) => imprimirPdf(h, ctx.pdfCfg)))(html);
      env = await ctx.enviarPdf(bytes, `Orçamento ${p.numero_pedido}.pdf`, legenda);
    } catch (e) {
      env = { ok: false, id: '', error: String((e as any)?.message || e) };
    }
    if (env.ok) {
      await registrarSaida(ctx, `[PDF orçamento: ${p.numero_pedido}]\n${legenda}`, env, 'documento');
    } else {
      // PDF não saiu: manda o resumo em texto (o orçamento está claro) e avisa o dono
      const linhas = r.itens.map((i: any) => `• ${i.quantidade} x ${i.nome} — ${brl(i.subtotal)}`).join('\n');
      const texto = `${legenda.split('\n')[0]}\n\n${linhas}\nFrete: ${brl(r.frete)}\n*Total: ${brl(p.total)}*\n\nVálido por 30 dias. Se quiser ajustar algo, é só me falar por aqui.`;
      const envT = await ctx.enviarTexto(texto);
      await registrarSaida(ctx, `[PDF orçamento: ${p.numero_pedido}] (enviado em texto; PDF falhou)\n${texto}`, envT);
      await ctx.avisarDono([await ctx.db.CRMAlerta.create({
        owner_id: ctx.owner.id, tipo: 'duvida', gravidade: 'grave', status: 'aberto', whatsapp_status: '',
        chave: `orcamento_pdf_falhou:${p.id}`, conversa_id: ctx.conversa.id, ref_id: p.id,
        titulo: `Orçamento ${p.numero_pedido} foi para ${ctx.conversa.nome_contato || 'o lead'} em texto (o PDF falhou)`,
        detalhe: `Erro do PDF: ${String(env.error).slice(0, 200)}. Se quiser, mande o PDF pelo painel (Orçamentos).`
      })]);
    }
    if (cli?.id) await moverLeadParaOrcamento(ctx.db, ctx.owner.id, cli);
    // Registro para o dono (só painel): o que foi suposto na montagem
    await ctx.db.CRMAlerta.create({
      owner_id: ctx.owner.id, tipo: 'duvida', gravidade: 'info', status: 'aberto', whatsapp_status: 'so_painel',
      chave: `orcamento_enviado:${p.id}`, conversa_id: ctx.conversa.id, ref_id: p.id,
      titulo: `Vendedor automático enviou o orçamento ${p.numero_pedido} (${brl(p.total)}) para ${ctx.conversa.nome_contato || 'o lead'}`,
      detalhe: [r.composicoes?.length && 'Composição: ' + r.composicoes.join('; '), r.suposicoes?.length && 'Suposições: ' + r.suposicoes.join(' '),
        r.ressalvas?.length && 'Ressalvas: ' + r.ressalvas.join(' '), `Frete: ${r.frete_origem}`].filter(Boolean).join(' | ').slice(0, 1500)
    });
    if (d.pergunta) await escalar(ctx, msgs, [`Pergunta do cliente (o orçamento já foi enviado): "${d.pergunta}"`], '');
    return { atuou: true, motivo: env.ok ? 'orcamento_pdf' : 'orcamento_texto' };
  } catch (e) {
    console.error('[VENDEDOR] falhou', e);
    return { atuou: false, motivo: 'erro' };
  }
}

const CORES_PEDIDO: Record<string, string> = {
  primary: '#1e3a5f', primaryDark: '#0f172a', secondary: '#16a34a', light: '#eff6ff', lightBorder: '#bfdbfe', textOnPrimary: '#ffffff'
};
const CORES_PEDIDO_CSS = Object.fromEntries(Object.entries(CORES_PEDIDO).map(([k, v]) => [k, `var(--pf-${k}, ${v})`]));
