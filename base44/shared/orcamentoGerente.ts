// ─── Orçamento assistido (só modo gerente: dono do 8509 ou revendedor verificado) ─
// Spec do agente CRM, seção 5 (item 009 da fila, decisão do dono em 20/10):
//  - CNPJ → consulta pública (BrasilAPI) ANTES de perguntar; cliente cadastrado/completado
//    automaticamente, nunca duplicado (por CNPJ ou telefone);
//  - itens por composição (faixa de peso, kit com suporte, regra do óbvio), preço sempre
//    o da vitrine/painel (SupplierProduct via computeStorePrice);
//  - frete pela MESMA regra do painel (sugerirFrete de shared/freteCrm.js com TabelaFrete);
//  - grava UMA vez quando o pedido está completo, sem comando "grava"; ajuste depois disso
//    atualiza o MESMO orçamento (não cria outro);
//  - só pergunta o que falta, numerado, com a opção sugerida.
//
// Travas que continuam:
//  - a IA só interpreta o pedido (texto → JSON). Produto, preço, frete e total são do código;
//  - NUNCA envia nada ao cliente e NUNCA converte em pedido (status fica "pendente");
//  - preco_fabricante nunca é lido; links só em app.placefit.com.br.
// Escritas possíveis: Cliente.create/update (cadastro pelo CNPJ) e Pedido.create/update
// (tipo orçamento, status pendente).

import { carregarCatalogo, normalizar } from './catalogoRespondedor.ts';
import { comporPedido } from './composicaoOrcamento.ts';
import { consultarCnpj, consultarCep } from './cnpjPublico.ts';
import { chaveTelefone } from './cadastroCliente.ts';
import { sugerirFrete, resolverUF } from './freteCrm.js';
import { invocarIA } from './iaComRetry.ts';

const VALIDADE_MIN = 30;
// Link do painel: abre o orçamento já na visualização (mesmo botão de PDF do painel)
const painelUrl = () => {
  const url = String((globalThis as any).Deno?.env.get('PAINEL_URL') || '').trim().replace(/\/$/, '');
  return url && !/base44/i.test(url) ? url : 'https://app.placefit.com.br';
};

const CONFIRMA = /^(grava|gravar|grave|confirma|confirmo|confirmado|confirmar|pode gravar|pode confirmar|pode salvar|salva|ok,? grava|sim,? grava|sim,? pode gravar)\b/;
const CANCELA = /^(cancela|cancelar|descarta|descartar|esquece|apaga o rascunho|deixa pra la)\b/;
// Cumprimento sozinho não precisa do interpretador
const SO_CUMPRIMENTO = /^(oi|ola|opa|e ai|eai|bom dia|boa tarde|boa noite|tudo bem|tudo bom|blz|beleza|valeu|obrigad[oa]|ok)( [a-z]+)?$/;

const digitos = (s: string) => String(s || '').replace(/\D/g, '');
const brl = (v: number) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: number) => String(Number(v)).replace('.', ',');
const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

const SCHEMA_PEDIDO = {
  type: 'object',
  properties: {
    acao: { type: 'string', enum: ['consulta', 'orcamento'] },
    cliente: {
      type: 'object',
      properties: {
        cpf_cnpj: { type: 'string' }, nome: { type: 'string' }, cidade: { type: 'string' },
        estado: { type: 'string' }, telefone: { type: 'string' }, cep: { type: 'string' }
      },
      required: ['cpf_cnpj', 'nome', 'cidade', 'estado', 'telefone', 'cep']
    },
    cep_entrega: { type: 'string' },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          descricao: { type: 'string' }, quantidade: { type: 'number' },
          quantidade_informada: { type: 'boolean' }, unidade_pedida: { type: 'string' }
        },
        required: ['descricao', 'quantidade', 'quantidade_informada', 'unidade_pedida']
      }
    },
    frete_informado: { type: 'number' }
  },
  required: ['acao', 'cliente', 'cep_entrega', 'itens', 'frete_informado']
};

const PROMPT_PARSER = `Você interpreta mensagens do dono de uma revenda de equipamentos de academia.
Decida "acao":
- "orcamento": ele quer CRIAR ou AJUSTAR um orçamento, mesmo sem a palavra "orçamento" (ex.: "faz um orçamento
  pro cliente X de 10 anilhas...", "cota pro CNPJ 12.345.678/0001-90 um kit de halter", "quanto fica 6 anilhas de
  20 pro cliente Y com frete", "troca o de 2kg por 30", "a cidade é Vitória/ES", "o frete é 300", "1. Sim 2. Sim").
- "consulta": qualquer outra coisa (perguntas sobre orçamentos já feitos, leads, números, conversa).

Se existe RASCUNHO ATUAL e a mensagem fala do orçamento, dos itens, dos produtos, do cliente ou do frete — mesmo
de forma vaga — a acao é "orcamento". Frase vaga não escolhe opção.

Quando for "orcamento", devolva o pedido COMPLETO já atualizado: o RASCUNHO ATUAL (se houver) com as mudanças da mensagem.
- cliente: só o que foi dito (CNPJ/CPF, nome, cidade, estado em sigla UF, telefone, CEP). Não informado = "".
  cpf_cnpj só recebe números de documento (11 ou 14 dígitos, com ou sem pontuação). Código de produto
  (tem letras, ex.: "ANI-N062", "ASP20", "KHSI110S") NUNCA é CPF/CNPJ: ele vai na descricao do item a que se refere.
- cep_entrega: só se ele disse que a entrega é em OUTRO lugar (CEP diferente do cliente); senão "".
- itens: um por produto pedido. descricao = o produto como ele falou, SEM a quantidade (tipo, acabamento, peso, medida).
  - Faixa de pesos ("dumbbell montado de 12 a 20kg"): mantenha a faixa na descricao ("dumbbell montado 12 a 20 kg");
    o sistema monta a composição peso a peso. Não expanda você mesmo.
  - Kit ("kit de halter sextavado injetado de 1 a 10"): mantenha "kit" e a faixa na descricao.
  - Suporte pedido junto ("mais suporte para 10 pares"): item separado, descricao "suporte para 10 pares".
  - Se ele diz "20 de 2kg" logo depois de "10 anilhas vazadas injetadas 10kg", a descricao é "anilha vazada injetada 2kg".
  - quantidade = número dito; se não disse, quantidade 1 e quantidade_informada false. "10 pares de cada" = 10.
  - unidade_pedida = a unidade que ele usou ("un", "m", "m2", "par", "kg"...), "" se não disse.
- Respostas às PERGUNTAS QUE FIZEMOS (ex.: "1. Sim 2. Não"): "Sim" aceita a opção sugerida — copie o texto entre
  aspas depois de "Usar" naquela pergunta como a nova descricao do item (mantenha a quantidade). "Não" mantém o item
  como estava. Se ele escolheu outra opção listada, use o NOME EXATO dela.
- frete_informado: valor em reais se ele disse o frete; -1 se não disse (mantenha o do rascunho, se houver).
Nunca invente produto, cliente nem valor. Quando for "consulta", devolva cliente vazio, cep_entrega "", itens [] e frete_informado -1.`;

// ── Rascunho / último orçamento gravado, na conversa do dono ─────────────────
/** Uma linha sobre o rascunho, para a consulta do gerente não inventar nada. */
export function statusRascunho(conversa: any): string {
  const a = lerRascunho(conversa);
  if (!a?.r) return 'nenhum';
  if (a.vencido) return 'havia um, mas venceu (30 min)';
  if (a.r.gravado_numero) return `orçamento ${a.r.gravado_numero} GRAVADO (pendente, total ${brl(a.r.total)}); ajustes nos próximos ${VALIDADE_MIN} min atualizam esse mesmo orçamento. Nada foi enviado ao cliente.`;
  return `aberto, NÃO gravado, faltando: ${(a.r.perguntas || []).join(' | ')}`;
}

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

// ── Cliente (5.1) ────────────────────────────────────────────────────────────
async function clientesDoTenant(db: any, tenantId: string) {
  let todos: any[] = [];
  for (let skip = 0; skip < 5000; skip += 500) {
    const lote = await db.Cliente.filter({ fornecedor_id: tenantId }, '-created_date', 500, skip);
    todos = todos.concat(lote || []);
    if (!lote || lote.length < 500) break;
  }
  return todos;
}

const vazio = (v: any) => !String(v || '').trim();

/**
 * Acha, cadastra ou completa o cliente. Com CNPJ, consulta a base pública antes de
 * qualquer pergunta; nunca pergunta o que a consulta devolve e nunca duplica.
 */
async function resolverCliente(base44: any, tenantId: string, pedido: any) {
  const db = base44.asServiceRole.entities;
  // B1: código de produto (tem letra, ex.: ANI-N062) nunca é tratado como CPF/CNPJ
  const docBruto = /[a-z]/i.test(String(pedido?.cpf_cnpj || '')) ? '' : String(pedido?.cpf_cnpj || '').trim();
  pedido = { ...pedido, cpf_cnpj: docBruto };
  const doc = digitos(docBruto);
  const nome = String(pedido?.nome || '').trim();
  const tel = chaveTelefone(pedido?.telefone || '');
  const perguntas: string[] = [];
  const ressalvas: string[] = [];

  if (doc && doc.length !== 11 && doc.length !== 14) {
    perguntas.push(`O CPF/CNPJ "${pedido.cpf_cnpj}" não tem 11 nem 14 dígitos. Qual é o certo?`);
    return { cliente: null, perguntas, ressalvas };
  }

  const todos = await clientesDoTenant(db, tenantId);
  let existente = doc ? todos.find((c) => digitos(c.cpf_cnpj) === doc) : null;
  if (!existente && tel) existente = todos.find((c) => chaveTelefone(c.telefone) === tel) || null;
  if (!existente && !doc && nome) {
    const alvo = normalizar(nome);
    const achados = todos.filter((c) => normalizar(c.nome).includes(alvo));
    if (achados.length === 1) existente = achados[0];
    if (achados.length > 1) {
      perguntas.push(`Achei ${achados.length} clientes com "${nome}". Usar "${achados[0].nome}"${achados[0].cpf_cnpj ? ` (${achados[0].cpf_cnpj})` : ''}? ` +
        `Outros: ${achados.slice(1, 5).map((c) => `${c.nome}${c.cpf_cnpj ? ' (' + c.cpf_cnpj + ')' : ''}`).join('; ')}.`);
      return { cliente: null, perguntas, ressalvas };
    }
  }
  if (!existente && !doc && !nome) {
    perguntas.push('Pra qual cliente? Manda o CNPJ (eu puxo o cadastro na Receita) ou o nome.');
    return { cliente: null, perguntas, ressalvas };
  }

  // Consulta pública: só CNPJ, e só se ainda falta algum dado do cadastro
  let publico: any = null;
  const faltaDado = (c: any) => !c || vazio(c.nome) || vazio(c.endereco) || vazio(c.cidade) || vazio(c.estado) || vazio(c.cep);
  if (doc.length === 14 && faltaDado(existente)) publico = await consultarCnpj(doc);
  if (publico?.numero_ausente) ressalvas.push('Endereço do CNPJ sem número (número ausente).');

  const obsCnpj = publico
    ? [publico.nome_fantasia && `Fantasia: ${publico.nome_fantasia}.`, publico.numero_ausente && 'Endereço: número ausente.'].filter(Boolean).join(' ')
    : '';

  if (existente) {
    // Completa só campos vazios; nunca sobrescreve o que o dono já cadastrou
    const patch: Record<string, string> = {};
    if (publico) {
      if (vazio(existente.nome)) patch.nome = publico.razao_social;
      if (vazio(existente.endereco) && publico.endereco) patch.endereco = publico.endereco;
      if (vazio(existente.cidade) && publico.cidade) patch.cidade = publico.cidade;
      if (vazio(existente.estado) && publico.estado) patch.estado = publico.estado;
      if (vazio(existente.cep) && publico.cep) patch.cep = publico.cep;
      if (vazio(existente.telefone) && publico.telefone) patch.telefone = publico.telefone;
      if (Object.keys(patch).length && obsCnpj && !String(existente.observacoes || '').includes(obsCnpj)) {
        patch.observacoes = [String(existente.observacoes || '').trim(), `Completado pela consulta pública do CNPJ: ${obsCnpj}`].filter(Boolean).join('\n');
      }
      if (Object.keys(patch).length) await db.Cliente.update(existente.id, patch);
    }
    const c = { ...existente, ...patch };
    if (vazio(c.estado) && !publico && doc.length === 14) ressalvas.push('Consulta pública do CNPJ indisponível agora; cadastro não foi completado.');
    return {
      cliente: {
        id: c.id, nome: c.nome, cpf_cnpj: c.cpf_cnpj || pedido?.cpf_cnpj || '', cidade: c.cidade || '', estado: c.estado || '',
        cep: c.cep || '', fantasia: publico?.nome_fantasia || '', situacao: Object.keys(patch).length ? 'completado' : 'existente'
      },
      perguntas, ressalvas
    };
  }

  if (publico) {
    const c = await db.Cliente.create({
      fornecedor_id: tenantId,
      nome: publico.razao_social,
      cpf_cnpj: pedido.cpf_cnpj,
      telefone: digitos(pedido?.telefone) || publico.telefone || '',
      endereco: publico.endereco,
      cidade: publico.cidade,
      estado: publico.estado,
      cep: publico.cep,
      ativo: true,
      observacoes: `Cadastrado pelo WhatsApp (modo gerente) a partir da consulta pública do CNPJ.${obsCnpj ? ' ' + obsCnpj : ''}`
    });
    return {
      cliente: { id: c.id, nome: c.nome, cpf_cnpj: c.cpf_cnpj, cidade: c.cidade, estado: c.estado, cep: c.cep, fantasia: publico.nome_fantasia, situacao: 'criado' },
      perguntas, ressalvas
    };
  }

  // Sem consulta pública (CPF, CNPJ fora do ar ou só nome): aproveita o cadastro fiscal do tenant
  const novo: any = { id: '', nome, cpf_cnpj: pedido?.cpf_cnpj || '', cidade: pedido?.cidade || '', estado: pedido?.estado || '', cep: pedido?.cep || '', telefone: pedido?.telefone || '', situacao: 'novo' };
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
    if (doc.length === 14) ressalvas.push('Consulta pública do CNPJ indisponível agora.');
  }
  if (!novo.estado && novo.cep) {
    const cep = await consultarCep(novo.cep);
    if (cep) { novo.cidade = novo.cidade || cep.cidade; novo.estado = cep.estado; }
  }
  const faltam = [!novo.nome && 'nome/razão social', !novo.estado && 'cidade/UF ou CEP'].filter(Boolean);
  if (faltam.length) perguntas.push(`Cliente novo, sem cadastro público. Me passa: ${faltam.join(', ')}.`);
  return { cliente: novo, perguntas, ressalvas };
}

// ── Montagem (determinística) ────────────────────────────────────────────────
async function montarRascunho(base44: any, tenantId: string, pedido: any, anterior: any) {
  const perguntas: string[] = [];
  const ressalvas: string[] = [];

  const rc = await resolverCliente(base44, tenantId, pedido.cliente || {});
  perguntas.push(...rc.perguntas);
  ressalvas.push(...rc.ressalvas);
  const cliente = rc.cliente;

  const catalogo = await carregarCatalogo(base44, tenantId);
  if (!pedido.itens?.length) perguntas.push('Quais itens e quantidades?');
  const comp = comporPedido(catalogo, pedido.itens || []);
  perguntas.push(...comp.perguntas);

  const avisosUnidade: string[] = [];
  const itens = comp.itens.map(({ item: it, quantidade, origem }) => {
    const linha = (pedido.itens || []).find((p: any) => p.descricao === origem);
    const up = normalizar(linha?.unidade_pedida || '');
    if (up && /^(m|m2|metro|metros|kg|quilo|quilos)$/.test(up) && !normalizar(it.und).startsWith(up[0])) {
      avisosUnidade.push(`"${origem}": pedido em ${linha.unidade_pedida}, mas o produto é vendido por ${it.und}. Considerei ${num(quantidade)} × ${it.und}.`);
    }
    return {
      product_id: it.product_id, cod: it.cod, nome: it.nome, quantidade,
      preco_unitario: it.preco, subtotal: r2(it.preco * quantidade), und: it.und, peso_kg: it.peso_kg
    };
  });
  const suposicoes = [...comp.suposicoes, ...avisosUnidade];

  const subtotal = r2(itens.reduce((s, i) => s + i.subtotal, 0));
  const pesoTotal = itens.reduce((s, i) => s + (Number(i.peso_kg) || 0) * i.quantidade, 0);
  const semPeso = itens.filter((i) => !i.peso_kg).map((i) => i.cod || i.nome);
  if (semPeso.length) ressalvas.push(`Sem peso cadastrado (fora do peso do frete): ${semPeso.join(', ')}.`);

  // Destino do frete: CEP de entrega informado, senão o endereço do cliente (CNPJ)
  let destino: any = cliente ? { cidade: cliente.cidade, estado: cliente.estado } : null;
  if (cliente && !destino.estado && digitos(pedido.cliente?.cep).length === 8) {
    const cep = await consultarCep(pedido.cliente.cep);
    if (cep) destino = { cidade: cep.cidade, estado: cep.estado, cep: cep.cep };
  }
  if (digitos(pedido.cep_entrega).length === 8) {
    const cep = await consultarCep(pedido.cep_entrega);
    if (cep) destino = { cidade: cep.cidade, estado: cep.estado, cep: cep.cep };
    else perguntas.push(`Não achei o CEP de entrega ${pedido.cep_entrega}. Qual a cidade/UF da entrega?`);
  }

  let frete: number | null = null;
  let freteOrigem = '';
  let freteObs = '';
  const informado = Number(pedido.frete_informado);
  if (informado > 0) {
    frete = r2(informado);
    freteOrigem = 'informado por você';
  } else if (destino?.estado && resolverUF(destino.estado)) {
    const tabela = await base44.asServiceRole.entities.TabelaFrete.filter({ ativo: true });
    const s = sugerirFrete({ estado: destino.estado, cidade: destino.cidade, pesoTotal, tabelaFrete: tabela });
    if (s && s.valor > 0) {
      frete = r2(s.valor);
      const piso = pesoTotal <= s.pesoLimite;
      freteOrigem = `tabela ${s.uf} ${piso ? `piso até ${num(s.pesoLimite)} kg` : (s.capital ? 'capital' : 'interior') + ' por kg'}, ${num(Math.round(pesoTotal * 10) / 10)} kg`;
      if (informado === 0) suposicoes.push('Frete veio zerado: apliquei o frete sugerido pela tabela do app. Se for frete grátis, me diz o valor 0 de novo com "frete grátis".');
      if (subtotal > 0 && frete >= subtotal * 0.5) {
        freteObs = `Frete ≥ 50% da mercadoria: ` + (piso
          ? `pedido de ${num(Math.round(pesoTotal * 10) / 10)} kg paga o piso fixo de ${s.uf} (${brl(s.valor)})` + (semPeso.length ? ', e há produto sem peso cadastrado' : '')
          : `peso alto (${num(Math.round(pesoTotal * 10) / 10)} kg × tabela de ${s.uf})`) + '.';
      }
    } else {
      perguntas.push(`Sem tabela de frete pra ${destino.estado}. Qual o valor do frete?`);
    }
  } else if (cliente) {
    perguntas.push('Sem CNPJ, cidade/UF ou CEP não calculo o frete. Me passa o CEP de entrega ou o valor do frete.');
  }

  const total = r2(subtotal + (frete || 0));
  const pronto = perguntas.length === 0 && !!cliente && itens.length > 0 && frete !== null;
  return {
    pedido, cliente, itens, subtotal, peso_total: pesoTotal, frete, frete_origem: freteOrigem, frete_obs: freteObs, total,
    composicoes: comp.composicoes, suposicoes, ressalvas, perguntas, pronto,
    gravado_id: anterior?.gravado_id || '', gravado_numero: anterior?.gravado_numero || ''
  };
}

function observacoesDoOrcamento(r: any) {
  return [
    'Criado pelo WhatsApp (modo gerente). Não enviado ao cliente.',
    r.composicoes.length ? 'Composição: ' + r.composicoes.join('; ') + '.' : '',
    r.suposicoes.length ? 'Suposições: ' + r.suposicoes.join(' ') : '',
    r.ressalvas.length ? 'Ressalvas: ' + r.ressalvas.join(' ') : '',
    r.frete !== null ? `Frete: ${brl(r.frete)} (${r.frete_origem}).` : '',
    r.frete_obs
  ].filter(Boolean).join('\n');
}

function linhaCliente(c: any) {
  const origem = { criado: 'cadastrado agora pela consulta pública do CNPJ', completado: 'cadastro completado pela consulta pública', existente: 'já cadastrado', novo: 'novo, será cadastrado' }[c.situacao as string] || '';
  return `Cliente: ${c.nome || '?'}${c.fantasia ? ' / ' + c.fantasia : ''}${c.cpf_cnpj ? ' - ' + c.cpf_cnpj : ''}` +
    `${c.cidade || c.estado ? ', ' + [c.cidade, c.estado].filter(Boolean).join('/') : ''}${origem ? ' (' + origem + ')' : ''}`;
}

/** Resposta no modelo 5.6. */
function textoResposta(r: any, cabecalho: string) {
  const l: string[] = [cabecalho];
  if (r.cliente) l.push('', linhaCliente(r.cliente));
  if (r.itens.length) {
    l.push('', 'Itens:');
    r.itens.forEach((i: any, n: number) => l.push(`${n + 1}. ${i.cod ? i.cod + ' ' : ''}${i.nome} - ${num(i.quantidade)} x ${brl(i.preco_unitario)} = ${brl(i.subtotal)}`));
    l.push('', `Subtotal: ${brl(r.subtotal)}`);
    if (r.frete !== null) l.push(`Frete (${r.frete_origem}): ${brl(r.frete)}${r.frete_obs ? '  ⚠️ ' + r.frete_obs : ''}`);
    l.push(`*Total: ${brl(r.total)}*`);
  }
  const obs = [...r.composicoes.map((c: string) => 'composição ' + c), ...r.suposicoes, ...r.ressalvas];
  if (obs.length) l.push('', (r.gravado_id ? 'Observações gravadas: ' : 'Observações: ') + obs.join(' | '));
  if (r.gravado_id) l.push('', `PDF: ${painelUrl()}/Orcamentos?abrir=${r.gravado_id} (abre o orçamento no painel, botão PDF)`);
  if (r.perguntas.length) {
    l.push('', 'Falta só (responde tipo "1. Sim 2. Sim"):', ...r.perguntas.map((p: string, n: number) => `${n + 1}. ${p}`));
  }
  return l.join('\n');
}

/** Grava (ou atualiza o já gravado) e confere o registro salvo, que é o que o PDF do painel imprime. */
async function gravar(base44: any, tenantId: string, r: any) {
  const db = base44.asServiceRole.entities;
  let clienteId = r.cliente.id;
  if (!clienteId) {
    const c = await db.Cliente.create({
      fornecedor_id: tenantId,
      nome: r.cliente.nome,
      cpf_cnpj: r.cliente.cpf_cnpj || '',
      telefone: digitos(r.cliente.telefone) || '',
      cidade: r.cliente.cidade || '',
      estado: r.cliente.estado || '',
      cep: r.cliente.cep || '',
      ativo: true,
      observacoes: 'Cadastrado pelo WhatsApp (modo gerente).'
    });
    clienteId = c.id;
    r.cliente.id = c.id;
  }
  const dados = {
    cliente_id: clienteId,
    cliente_nome: r.cliente.nome || '',
    tipo: 'orcamento',
    itens: r.itens.map((i: any) => ({ product_id: i.product_id, cod: i.cod, nome: i.nome, quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal })),
    subtotal: r.subtotal,
    frete: r.frete || 0,
    desconto: 0,
    total: r.total,
    status: 'pendente',
    observacoes: observacoesDoOrcamento(r)
  };
  let p: any;
  if (r.gravado_id) {
    const atual = (await db.Pedido.filter({ id: r.gravado_id, fornecedor_id: tenantId }, '-created_date', 1))?.[0];
    // Só ajusta orçamento ainda pendente; virou pedido ou foi mexido no painel → cria outro
    if (atual && atual.tipo === 'orcamento' && atual.status === 'pendente') {
      await db.Pedido.update(atual.id, dados);
      p = { ...atual, ...dados };
    }
  }
  if (!p) {
    // Mesmo formato e numeração do painel (Orcamentos.jsx → createOrcamentoMutation)
    p = await db.Pedido.create({
      fornecedor_id: tenantId,
      numero_pedido: `ORC-${Date.now()}`,
      data_pedido: new Date().toISOString().split('T')[0],
      ...dados
    });
  }

  // Conferência: relê o que foi salvo (fonte do PDF do painel) e compara itens, frete e total
  const salvo = (await db.Pedido.filter({ id: p.id }, '-created_date', 1))?.[0];
  const divergencias: string[] = [];
  if (!salvo) divergencias.push('não consegui reler o orçamento salvo');
  else {
    if ((salvo.itens || []).length !== r.itens.length) divergencias.push(`itens: ${(salvo.itens || []).length} salvos x ${r.itens.length} montados`);
    const somaItens = r2((salvo.itens || []).reduce((s: number, i: any) => s + (Number(i.subtotal) || 0), 0));
    if (somaItens !== r.subtotal) divergencias.push(`subtotal: ${brl(somaItens)} salvo x ${brl(r.subtotal)}`);
    if (r2(salvo.frete) !== r2(r.frete || 0)) divergencias.push(`frete: ${brl(salvo.frete)} salvo x ${brl(r.frete || 0)}`);
    if (r2(salvo.total) !== r.total || r2(somaItens + r2(salvo.frete) - r2(salvo.desconto)) !== r.total) divergencias.push(`total: ${brl(salvo.total)} salvo x ${brl(r.total)}`);
  }
  return { pedido: salvo || p, divergencias };
}

/**
 * Trata a mensagem do dono se ela for sobre CRIAR/AJUSTAR orçamento.
 * Devolve { tratou: false } para cair no fluxo normal de consulta do gerente.
 */
export async function tratarOrcamentoGerente(base44: any, tenantId: string, conversa: any, texto: string, conversaTexto: string): Promise<{ tratou: boolean; resposta: string; gravou?: string }> {
  const t = normalizar(texto).replace(/\./g, ' ').trim();
  const lido = lerRascunho(conversa);
  const atual = lido && !lido.vencido ? lido.r : null;

  if (CANCELA.test(t) && atual && !atual.gravado_id) {
    await salvarRascunho(base44, conversa, null);
    return { tratou: true, resposta: 'Rascunho descartado. Nada foi gravado.' };
  }
  // "grava" virou desnecessário: responde o estado sem gravar de novo
  if (CONFIRMA.test(t) && t.length <= 40) {
    if (atual?.gravado_id) return { tratou: true, resposta: `O ${atual.gravado_numero} já está gravado (pendente). Nada foi enviado ao cliente. PDF: ${painelUrl()}/Orcamentos?abrir=${atual.gravado_id}` };
    if (atual) return { tratou: true, resposta: textoResposta(atual, '*Ainda não dá pra gravar.*') };
    return { tratou: true, resposta: 'Não tem orçamento em andamento. Me manda o pedido (cliente + itens) que eu monto e gravo.' };
  }
  if (!t || SO_CUMPRIMENTO.test(t)) return { tratou: false, resposta: '' };

  // O interpretador decide se é orçamento; não depende mais de a mensagem dizer "orçamento"
  const rascunhoTexto = atual ? JSON.stringify(atual.pedido) : 'nenhum';
  const ai: any = await invocarIA(base44, {
    prompt: PROMPT_PARSER +
      `\n\nRASCUNHO ATUAL (pedido): ${rascunhoTexto}` +
      (atual?.perguntas?.length ? `\nPERGUNTAS QUE FIZEMOS AO DONO: ${atual.perguntas.map((p: string, n: number) => `${n + 1}. ${p}`).join(' | ')}` : '') +
      `\n\nCONVERSA RECENTE:\n${conversaTexto}` +
      `\n\nÚLTIMA MENSAGEM DO DONO: ${texto}`,
    response_json_schema: SCHEMA_PEDIDO
  });
  const pedido = typeof ai === 'string' ? JSON.parse(ai) : ai;
  if (pedido?.acao !== 'orcamento') return { tratou: false, resposta: '' };

  const r = await montarRascunho(base44, tenantId, pedido, atual);
  if (!r.pronto) {
    await salvarRascunho(base44, conversa, r);
    const cab = r.gravado_id ? `*${r.gravado_numero} continua como estava (ajuste incompleto).* Nada foi enviado ao cliente.` : '*Orçamento em montagem, nada gravado ainda.*';
    return { tratou: true, resposta: textoResposta(r, cab) };
  }

  const ajuste = Boolean(r.gravado_id);
  const { pedido: p, divergencias } = await gravar(base44, tenantId, r);
  r.gravado_id = p.id;
  r.gravado_numero = p.numero_pedido;
  await salvarRascunho(base44, conversa, r);
  let cab = `Orçamento ${p.numero_pedido} ${ajuste ? 'atualizado' : 'gravado'} (pendente). Nada enviado ao cliente.`;
  if (divergencias.length) cab += `\n⚠️ Conferência do salvo falhou (${divergencias.join('; ')}). Confere no painel antes de usar.`;
  return { tratou: true, gravou: p.id, resposta: textoResposta(r, cab) };
}
