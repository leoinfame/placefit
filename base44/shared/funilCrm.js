// ─── Funil do CRM alimentado pelo sistema ────────────────────────────────────
// Item 022c (pedido do Sr. Leo, 02/11/2026 20:00): orçamento criado para um cliente — pelo painel
// ou pelo gerente do WhatsApp — move o lead desse cliente para a etapa "orcamento" do funil.
// Só avança: novo/atendimento → orcamento. Negociação, ganho e perdido não voltam.
// Usado pelo painel (base44.entities) e pelas functions (base44.asServiceRole.entities).

const ETAPAS_ANTES_DO_ORCAMENTO = ["novo", "atendimento"];

const digitos = (s) => String(s || "").replace(/\D/g, "");

/** Chave de telefone BR: DDD + últimos 8 dígitos (igual a cadastroCliente.chaveTelefone). */
export function chaveTelefoneFunil(tel) {
  let d = digitos(tel);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return "";
  return d.slice(0, 2) + d.slice(-8);
}

/**
 * Leva para "orcamento" as conversas do cliente: as já ligadas a ele e as do mesmo telefone real
 * ainda sem cliente (essas também ficam ligadas). Devolve quantas conversas mudaram.
 * Nunca lança: o orçamento já foi gravado e não pode falhar por causa do funil.
 */
export async function moverLeadParaOrcamento(entities, ownerId, cliente) {
  try {
    if (!entities || !ownerId || !cliente?.id) return 0;
    const ligadas = (await entities.CRMConversa.filter({ owner_id: ownerId, cliente_id: cliente.id }, "-ultima_interacao", 20)) || [];
    let mesmas = [];
    const chave = chaveTelefoneFunil(cliente.telefone);
    if (chave) {
      const candidatas = (await entities.CRMConversa.filter(
        { owner_id: ownerId, telefone: { "$regex": chave.slice(-4) + "$" } }, "-ultima_interacao", 50
      )) || [];
      mesmas = candidatas.filter((c) => !c.cliente_id && chaveTelefoneFunil(c.telefone) === chave);
    }
    let mudou = 0;
    for (const c of [...ligadas, ...mesmas]) {
      if (c.ativo === false) continue;
      const patch = {};
      if (ETAPAS_ANTES_DO_ORCAMENTO.includes(c.etapa || "novo")) patch.etapa = "orcamento";
      if (!c.cliente_id) patch.cliente_id = cliente.id;
      if (Object.keys(patch).length) {
        await entities.CRMConversa.update(c.id, patch);
        mudou++;
      }
    }
    return mudou;
  } catch (e) {
    console.error("[FUNIL] não consegui mover o lead para orçamento", e);
    return 0;
  }
}

/**
 * Item 022e (pedido do Sr. Leo, 02/11 20:29): orçamento que vira venda leva o lead para "ganho".
 * Vale de qualquer etapa (inclusive perdido: o cliente acabou comprando). Nunca lança.
 */
export async function moverLeadParaGanho(entities, ownerId, cliente) {
  try {
    if (!entities || !ownerId || !cliente?.id) return 0;
    const ligadas = (await entities.CRMConversa.filter({ owner_id: ownerId, cliente_id: cliente.id }, "-ultima_interacao", 20)) || [];
    let mudou = 0;
    for (const c of ligadas) {
      if (c.ativo === false) continue;
      const nova = funilAvanca(c.etapa, "ganho");
      if (!nova) continue;
      await entities.CRMConversa.update(c.id, { etapa: nova });
      mudou++;
    }
    return mudou;
  } catch (e) {
    console.error("[FUNIL] não consegui mover o lead para ganho", e);
    return 0;
  }
}

/** Item 022e: cliente respondeu com o lead em "orcamento" → "negociacao". Só essa transição. */
export function etapaDepoisDaResposta(etapaAtual) {
  return etapaAtual === "orcamento" ? "negociacao" : "";
}

// ─── Item 028 (12/11/2026): a etapa do funil anda sozinha junto com o Pedido ──
// Uma regra só vale para qualquer origem do pedido (painel, WhatsApp/gerente, loja):
// orçamento criado → "orcamento"; pedido virando venda → "ganho".
// Só avança: nunca volta, nunca rebaixa, e não cria conversa para quem não tem.
const ETAPAS_FINAIS = ["ganho", "perdido"];

/** Etapa que o pedido pede. Venda cancelada não pede nada. */
export function etapaAlvoDoPedido(pedido) {
  if (!pedido) return "";
  if (pedido.tipo === "orcamento") return "orcamento";
  if (pedido.tipo === "venda" && String(pedido.status || "") !== "cancelado") return "ganho";
  return "";
}

/** Só avança: devolve a etapa nova, ou "" quando a conversa fica como está. */
export function funilAvanca(etapaAtual, alvo) {
  const atual = etapaAtual || "novo";
  if (!alvo || atual === alvo || ETAPAS_FINAIS.includes(atual)) return "";
  if (alvo === "orcamento") return ETAPAS_ANTES_DO_ORCAMENTO.includes(atual) ? "orcamento" : "";
  if (alvo === "ganho") return "ganho";
  return "";
}

/**
 * Move a conversa do cliente do pedido para a etapa que ele pede.
 * Casa por cliente_id e, para conversas ainda sem cliente, pelo telefone do cadastro.
 * Devolve quantas conversas mudaram. Nunca lança.
 */
export async function aplicarFunilDoPedido(entities, pedido, cliente) {
  try {
    const alvo = etapaAlvoDoPedido(pedido);
    const ownerId = pedido?.fornecedor_id;
    if (!entities || !alvo || !ownerId) return 0;

    let cli = cliente || null;
    if (!cli && pedido.cliente_id) {
      cli = (await entities.Cliente.filter({ id: pedido.cliente_id }, "-created_date", 1))?.[0] || null;
    }

    const conversas = new Map();
    if (pedido.cliente_id) {
      const ligadas = (await entities.CRMConversa.filter({ owner_id: ownerId, cliente_id: pedido.cliente_id }, "-ultima_interacao", 50)) || [];
      for (const c of ligadas) conversas.set(c.id, c);
    }
    const chave = chaveTelefoneFunil(cli?.telefone);
    if (chave) {
      const candidatas = (await entities.CRMConversa.filter(
        { owner_id: ownerId, telefone: { "$regex": chave.slice(-4) + "$" } }, "-ultima_interacao", 50
      )) || [];
      for (const c of candidatas) {
        if (chaveTelefoneFunil(c.telefone) !== chave) continue;
        if (c.cliente_id && c.cliente_id !== pedido.cliente_id) continue;
        conversas.set(c.id, c);
      }
    }

    let mudou = 0;
    for (const c of conversas.values()) {
      if (c.ativo === false) continue;
      const nova = funilAvanca(c.etapa, alvo);
      if (!nova) continue;
      await entities.CRMConversa.update(c.id, { etapa: nova });
      mudou++;
    }
    return mudou;
  } catch (e) {
    console.error("[FUNIL] não consegui mover a etapa pelo pedido", e);
    return 0;
  }
}