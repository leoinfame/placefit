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
      if (c.ativo === false || c.etapa === "ganho") continue;
      await entities.CRMConversa.update(c.id, { etapa: "ganho" });
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
