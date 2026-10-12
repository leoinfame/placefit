// ─── Orçamento assistido (só modo gerente, número do dono) ──────────────────
// O dono pede um orçamento no chat; o código resolve cliente e itens no
// catálogo, calcula com as MESMAS regras do painel (preço da vitrine/painel e
// sugerirFrete de shared/freteCrm.js, a mesma que o painel usa, com TabelaFrete)
// e mostra um resumo.
//
// Travas:
//  - nada é gravado sem o "grava"/"confirma"/"pode gravar" do dono, conferido
//    por regex no CÓDIGO (não depende da IA);
//  - o rascunho vale 30 min; vencido, o resumo é refeito e não grava;
//  - a IA só interpreta o pedido (texto → JSON). Produto, preço, frete e total
//    são decididos pelo código; item que não casa com o catálogo vira pergunta;
//  - nunca envia nada ao cliente e nunca gera PDF.
// Escritas possíveis (só no "grava"): Cliente.create (se novo) + Pedido.create.

import { carregarCatalogo, resolverItem, normalizar } from './catalogoRespondedor.ts';
import { sugerirFrete } from './freteCrm.js';

const VALIDADE_MIN = 30;
const TZ = 'America/Sao_Paulo';

const CONFIRMA = /^(grava|gravar|grave|confirma|confirmo|confirmado|confirmar|pode gravar|pode confirmar|pode salvar|salva|ok,? grava|sim,? grava|sim,? pode gravar)\b/;
const CANCELA = /^(cancela|cancelar|descarta|descartar|esquece|apaga o rascunho|deixa pra la)\b/;
const GATILHO = /\b(orcamento|orcamentos|cotacao|cotar|orcar|rascunho)\b/;

const digitos = (s: string) => String(s || '').replace(/\D/g, '');
const brl = (v: number) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: number) => String(Number(v)).replace('.', ',');

const SCHEMA_PEDIDO = {
  type: 'object',
  properties: {
    acao: { type: 'string', enum: ['consulta', 'orcamento'] },
    cliente: {
      type: 'object',
      properties: {
        cpf_cnpj: { type: 'string' }, nome: { type: 'string' }, cidade: { type: 'string' },
        estado: { type: 'string' }, telefone: { type: 'string' }
      },
      required: ['cpf_cnpj', 'nome', 'cidade', 'estado', 'telefone']
    },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: { descricao: { type: 'string' }, quantidade: { type: 'number' }, unidade_pedida: { type: 'string' } },
        required: ['descricao', 'quantidade', 'unidade_pedida']
      }
    },
    frete_informado: { type: 'number' }
  },
  required: ['acao', 'cliente', 'itens', 'frete_informado']
};

const PROMPT_PARSER = `Você interpreta mensagens do dono de uma revenda de equipamentos de academia.
Decida "acao":
- "orcamento": ele quer CRIAR ou AJUSTAR um orçamento (ex.: "faz um orçamento pro cliente X de 10 anilhas...",
  "troca o de 2kg por 30", "a cidade é Vitória/ES", "o frete é 300", "a primeira opção").
- "consulta": qualquer outra coisa (perguntas sobre orçamentos existentes, leads, números, conversa).

Quando for "orcamento", devolva o pedido COMPLETO já atualizado: o RASCUNHO ATUAL (se houver) com as mudanças da mensagem.
- cliente: só o que foi dito (CNPJ/CPF, nome, cidade, estado em sigla UF, telefone). Não informado = "".
- itens: descricao = o produto completo SEM a quantidade (tipo, acabamento, peso, medida). Se ele diz "20 de 2kg"
  logo depois de "10 anilhas vazadas injetadas 10kg", a descricao é "anilha vazada injetada 2kg".
  Se ele escolheu uma opção que foi listada, use o NOME EXATO da opção como descricao.
  quantidade = número; unidade_pedida = a unidade que ele usou ("un", "m", "m2", "par", "kg"...), "" se não disse.
- frete_informado: valor em reais se ele disse o frete; -1 se não disse (mantenha o do rascunho, se houver).
Nunca invente produto, cliente nem valor. Quando for "consulta", devolva cliente vazio, itens [] e frete_informado -1.`;

// ── Rascunho na conversa do dono ─────────────────────────────────────────────
function lerRascunho(conversa: any) {
  try {
    const r = JSON.parse(String(conversa?.rascunho_orcamento || ''));
    const em = new Date(conversa?.rascunho_orcamento_em || 0).getTime();
    return { r, vencido: Date.now() - em > VALIDADE_MIN * 60000 };
  } catch {
    return null;
  }
}

async function salvarRascunho(base44: any, conversa: any, r: any) {
  await base44.asServiceRole.entities.CRMConversa.update(conversa.id, {
    rascunho_orcamento: r ? JSON.stringify(r) : '',
    rascunho_orcamento_em: r ? new Date().toISOString() : null
  });
}

// ── Cliente ──────────────────────────────────────────────────────────────────
async function resolverCliente(base44: any, tenantId: string, pedido: any) {
  const db = base44.asServiceRole.entities;
  const doc = digitos(pedido?.cpf_cnpj);
  const nome = String(pedido?.nome || '').trim();
  const pend: string[] = [];

  let todos: any[] = [];
  for (let skip = 0; skip < 5000; skip += 500) {
    const lote = await db.Cliente.filter({ fornecedor_id: tenantId }, '-created_date', 500, skip);
    todos = todos.concat(lote || []);
    if (!lote || lote.length < 500) break;
  }

  if (doc) {
    if (doc.length !== 11 && doc.length !== 14) pend.push(`CPF/CNPJ "${pedido.cpf_cnpj}" não tem 11 nem 14 dígitos — confere?`);
    const achado = todos.find((c) => digitos(c.cpf_cnpj) === doc);
    if (achado) return { cliente: { id: achado.id, nome: achado.nome, cpf_cnpj: achado.cpf_cnpj, cidade: achado.cidade, estado: achado.estado, novo: false }, pend };
  } else if (nome) {
    const alvo = normalizar(nome);
    const achados = todos.filter((c) => normalizar(c.nome).includes(alvo));
    if (achados.length === 1) {
      const a = achados[0];
      return { cliente: { id: a.id, nome: a.nome, cpf_cnpj: a.cpf_cnpj, cidade: a.cidade, estado: a.estado, novo: false }, pend };
    }
    if (achados.length > 1) {
      pend.push(`Achei ${achados.length} clientes com "${nome}": ` +
        achados.slice(0, 5).map((c) => `${c.nome}${c.cpf_cnpj ? ' (' + c.cpf_cnpj + ')' : ''}`).join('; ') + '. Qual? Manda o CNPJ.');
      return { cliente: null, pend };
    }
  } else {
    pend.push('Pra qual cliente? Manda o CNPJ/CPF ou o nome.');
    return { cliente: null, pend };
  }

  // Cliente novo: aproveita o cadastro fiscal do tenant, se existir
  const novo: any = { id: '', nome, cpf_cnpj: pedido?.cpf_cnpj || '', cidade: pedido?.cidade || '', estado: pedido?.estado || '', telefone: pedido?.telefone || '', novo: true };
  if (doc) {
    try {
      const fiscais = await db.ClienteFiscal.filter({ tenant_id: tenantId }, '-created_date', 500);
      const f = (fiscais || []).find((x: any) => digitos(x.cpf_cnpj) === doc);
      if (f) {
        novo.nome = novo.nome || f.nome_razao_social || f.nome_fantasia || '';
        novo.cidade = novo.cidade || f.cidade || '';
        novo.estado = novo.estado || f.estado || '';
        novo.telefone = novo.telefone || f.telefone || f.whatsapp || '';
      }
    } catch (_) { /* segue sem o fiscal */ }
  }
  const faltam = [!novo.nome && 'nome/razão social', !novo.cidade && 'cidade', !novo.estado && 'estado (UF)'].filter(Boolean);
  if (faltam.length) pend.push(`Cliente novo (não achei no cadastro). Me passa: ${faltam.join(', ')}.`);
  return { cliente: novo, pend };
}

// ── Montagem do rascunho (determinística) ────────────────────────────────────
async function montarRascunho(base44: any, tenantId: string, pedido: any) {
  const pend: string[] = [];
  const avisos: string[] = [];

  const { cliente, pend: pc } = await resolverCliente(base44, tenantId, pedido.cliente || {});
  pend.push(...pc);

  const catalogo = await carregarCatalogo(base44, tenantId);
  const itens: any[] = [];
  if (!pedido.itens?.length) pend.push('Quais itens e quantidades?');
  for (const pi of pedido.itens || []) {
    const qtd = Number(pi.quantidade);
    if (!(qtd > 0)) { pend.push(`Quantidade de "${pi.descricao}" não ficou clara.`); continue; }
    const r = resolverItem(catalogo, pi.descricao);
    if (r.status === 'ok') {
      const it = r.item;
      itens.push({ product_id: it.product_id, cod: it.cod, nome: it.nome, quantidade: qtd, preco_unitario: it.preco, subtotal: Math.round(it.preco * qtd * 100) / 100, und: it.und, peso_kg: it.peso_kg });
      const up = normalizar(pi.unidade_pedida || '');
      if (up && /^(m|m2|metro|metros|kg|quilo|quilos)$/.test(up) && !normalizar(it.und).startsWith(up[0])) {
        avisos.push(`"${pi.descricao}": você pediu ${num(qtd)} ${pi.unidade_pedida}, mas o produto é vendido por ${it.und}. Considerei ${num(qtd)} ${it.und}.`);
      }
    } else if (r.status === 'ambiguo') {
      pend.push(`"${pi.descricao}" tem mais de uma opção: ` + r.opcoes.map((o, i) => `${i + 1}) ${o.nome} (${brl(o.preco)}/${o.und})`).join('; ') + '. Qual?');
    } else {
      pend.push(`Não achei "${pi.descricao}" no catálogo.` +
        (r.sugestoes.length ? ' Parecidos: ' + r.sugestoes.map((o) => `${o.nome} (${brl(o.preco)}/${o.und})`).join('; ') + '.' : '') +
        ' Me diz o produto certo.');
    }
  }

  const subtotal = Math.round(itens.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
  const pesoTotal = itens.reduce((s, i) => s + (Number(i.peso_kg) || 0) * i.quantidade, 0);
  const semPeso = itens.filter((i) => !i.peso_kg).map((i) => i.nome);

  let frete: number | null = null;
  let freteOrigem = '';
  if (Number(pedido.frete_informado) >= 0) {
    frete = Math.round(Number(pedido.frete_informado) * 100) / 100;
    freteOrigem = 'informado por você';
  } else if (cliente && cliente.estado) {
    const tabela = await base44.asServiceRole.entities.TabelaFrete.filter({ ativo: true });
    const s = sugerirFrete({ estado: cliente.estado, cidade: cliente.cidade, pesoTotal, tabelaFrete: tabela });
    if (s) {
      frete = Math.round(s.valor * 100) / 100;
      freteOrigem = `tabela ${s.uf} ${s.capital ? 'capital' : 'interior'}, ${num(Math.round(pesoTotal * 10) / 10)} kg`;
      if (semPeso.length) avisos.push(`Sem peso cadastrado (fora do cálculo do frete): ${semPeso.join('; ')}.`);
    } else {
      pend.push(`Sem tabela de frete pro estado "${cliente.estado}". Me diz o valor do frete.`);
    }
  } else if (cliente) {
    pend.push('Sem cidade/UF do cliente não calculo o frete. Me passa a cidade/UF ou o valor do frete.');
  }

  const total = Math.round((subtotal + (frete || 0)) * 100) / 100;
  return { pedido, cliente, itens, subtotal, peso_total: pesoTotal, frete, frete_origem: freteOrigem, total, avisos, pendencias: pend, pronto: pend.length === 0 && !!cliente && itens.length > 0 && frete !== null };
}

function textoResumo(r: any, cabecalho = '*Rascunho de orçamento*') {
  const l: string[] = [cabecalho];
  if (r.cliente) {
    const c = r.cliente;
    l.push(`Cliente: ${c.nome || '?'}${c.cpf_cnpj ? ' — ' + c.cpf_cnpj : ''}${c.cidade || c.estado ? ' — ' + [c.cidade, c.estado].filter(Boolean).join('/') : ''} ${c.novo ? '(NOVO, será cadastrado)' : '(já cadastrado)'}`);
  }
  if (r.itens.length) {
    l.push('', 'Itens:');
    r.itens.forEach((i: any, n: number) => l.push(`${n + 1}. ${num(i.quantidade)} × ${i.nome}${i.cod ? ' (' + i.cod + ')' : ''} — ${brl(i.preco_unitario)}/${i.und} = ${brl(i.subtotal)}`));
    l.push('', `Subtotal: ${brl(r.subtotal)}`);
    l.push(`Frete: ${r.frete === null ? 'a definir' : brl(r.frete) + (r.frete_origem ? ' (' + r.frete_origem + ')' : '')}`);
    l.push(`*Total: ${brl(r.total)}*`);
  }
  if (r.avisos.length) l.push('', ...r.avisos.map((a: string) => '⚠️ ' + a));
  if (r.pendencias.length) {
    l.push('', 'Falta resolver antes de gravar:', ...r.pendencias.map((p: string) => '- ' + p));
  } else if (r.pronto) {
    l.push('', `Confirmo e gravo? Responde *grava* (vale ${VALIDADE_MIN} min). Nada vai pro cliente.`);
  }
  return l.join('\n');
}

async function gravar(base44: any, tenantId: string, r: any) {
  const db = base44.asServiceRole.entities;
  let clienteId = r.cliente.id;
  if (r.cliente.novo) {
    const c = await db.Cliente.create({
      fornecedor_id: tenantId,
      nome: r.cliente.nome,
      cpf_cnpj: r.cliente.cpf_cnpj || '',
      telefone: r.cliente.telefone || '',
      cidade: r.cliente.cidade || '',
      estado: r.cliente.estado || '',
      ativo: true,
      observacoes: 'Cadastrado pelo WhatsApp (modo gerente), com confirmação do dono.'
    });
    clienteId = c.id;
  }
  // Mesmo formato do painel (Orcamentos.jsx → createOrcamentoMutation)
  const pedido = await db.Pedido.create({
    fornecedor_id: tenantId,
    cliente_id: clienteId,
    cliente_nome: r.cliente.nome || '',
    numero_pedido: `ORC-${Date.now()}`,
    data_pedido: new Date().toISOString().split('T')[0],
    tipo: 'orcamento',
    itens: r.itens.map((i: any) => ({ product_id: i.product_id, cod: i.cod, nome: i.nome, quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal })),
    subtotal: r.subtotal,
    frete: r.frete || 0,
    desconto: 0,
    total: r.total,
    status: 'pendente',
    observacoes: 'Criado pelo WhatsApp (modo gerente) com confirmação explícita do dono. Não enviado ao cliente.'
  });
  return pedido;
}

/**
 * Trata a mensagem do dono se ela for sobre CRIAR/AJUSTAR/CONFIRMAR orçamento.
 * Devolve { tratou: false } para cair no fluxo normal de consulta do gerente.
 */
export async function tratarOrcamentoGerente(base44: any, tenantId: string, conversa: any, texto: string, conversaTexto: string): Promise<{ tratou: boolean; resposta: string; gravou?: string }> {
  const t = normalizar(texto).replace(/\./g, ' ').trim();
  const atual = lerRascunho(conversa);

  // Confirmação: decidida por regex no código, nunca pela IA
  if (CONFIRMA.test(t) && t.length <= 40) {
    if (!atual?.r) return { tratou: true, resposta: 'Não tem orçamento esperando confirmação. Me pede um que eu monto.' };
    if (atual.vencido) {
      const novo = await montarRascunho(base44, tenantId, atual.r.pedido);
      await salvarRascunho(base44, conversa, novo);
      return { tratou: true, resposta: textoResumo(novo, `*O rascunho venceu (${VALIDADE_MIN} min) e NÃO foi gravado.* Refiz com os preços de agora:`) };
    }
    if (!atual.r.pronto) return { tratou: true, resposta: textoResumo(atual.r, '*Ainda não dá pra gravar.*') };
    const p = await gravar(base44, tenantId, atual.r);
    await salvarRascunho(base44, conversa, null);
    return {
      tratou: true,
      gravou: p.id,
      resposta: `Gravado ✅ ${p.numero_pedido} — ${atual.r.cliente.nome} — ${brl(atual.r.total)}.\nStatus pendente no painel. Não enviei nada ao cliente nem gerei PDF.`
    };
  }

  if (CANCELA.test(t) && atual?.r) {
    await salvarRascunho(base44, conversa, null);
    return { tratou: true, resposta: 'Rascunho descartado. Nada foi gravado.' };
  }

  // Só chama o interpretador se a mensagem fala de orçamento ou há rascunho aberto
  if (!GATILHO.test(t) && !(atual?.r && !atual.vencido)) return { tratou: false, resposta: '' };

  const rascunhoTexto = atual?.r && !atual.vencido ? JSON.stringify(atual.r.pedido) : 'nenhum';
  const ai: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: PROMPT_PARSER +
      `\n\nRASCUNHO ATUAL (pedido): ${rascunhoTexto}` +
      (atual?.r && !atual.vencido && atual.r.pendencias?.length ? `\nPERGUNTAS QUE FIZEMOS AO DONO: ${atual.r.pendencias.join(' | ')}` : '') +
      `\n\nCONVERSA RECENTE:\n${conversaTexto}` +
      `\n\nÚLTIMA MENSAGEM DO DONO: ${texto}`,
    response_json_schema: SCHEMA_PEDIDO
  });
  const pedido = typeof ai === 'string' ? JSON.parse(ai) : ai;
  if (pedido?.acao !== 'orcamento') return { tratou: false, resposta: '' };

  const r = await montarRascunho(base44, tenantId, pedido);
  await salvarRascunho(base44, conversa, r);
  return { tratou: true, resposta: textoResumo(r) };
}
