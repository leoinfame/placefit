// ─── Conversa do contato no CRM (entrada do 7206 via WAHA) ─────────────────
// Item 022 (02/11/2026). Separado do webhook para poder ser testado.
import { chaveTelefone, nomeValido } from './cadastroCliente.ts';

/** Nome que não é nome: vazio, só número (LID/telefone antigo) ou o marcador de não identificado. */
export const NAO_IDENTIFICADO = "Não identificado";
const nomeVazio = (n: string) => !String(n || "").trim() || /^[\d\s+()-]+$/.test(String(n)) || String(n).trim() === NAO_IDENTIFICADO;

/** Cliente do dono pelo telefone REAL (DDD + últimos 8 dígitos). Nunca por LID. */
export async function clientePorTelefone(db: any, ownerId: string, telefone: string) {
  const chave = chaveTelefone(telefone);
  if (!chave) return null;
  // Pré-filtro pelos 4 últimos dígitos (sobrevive a "(27) 3327-6576"); a conferência é pela chave inteira
  const candidatos = await db.Cliente.filter({ fornecedor_id: ownerId, telefone: { "$regex": chave.slice(-4) + "\\D*$" } }, "created_date", 200);
  return (candidatos || []).find((c: any) => chaveTelefone(c.telefone) === chave) || null;
}

/**
 * Item 022: conversa do contato, uma só por pessoa.
 * Procura pelo telefone real; senão pelo LID (campo contato_lid, ou conversa antiga que gravou o LID
 * no lugar do telefone). Criação protegida contra entrega simultânea: depois de criar, relê pela
 * mesma chave e, se outra entrega criou junto, fica a mais antiga e a nova sai da lista (ativo=false).
 */
export async function conversaDoContato(db: any, ownerId: string, ident: any, fromMe: boolean, texto: string, agora: string) {
  const tel = ident.telefone || "";
  const lid = ident.lid || "";
  let conversa: any = null;
  if (tel) conversa = (await db.CRMConversa.filter({ owner_id: ownerId, telefone: tel, ativo: true }, "created_date", 1))?.[0];
  if (!conversa && lid) conversa = (await db.CRMConversa.filter({ owner_id: ownerId, contato_lid: lid, ativo: true }, "created_date", 1))?.[0];
  if (!conversa && lid) conversa = (await db.CRMConversa.filter({ owner_id: ownerId, telefone: lid, ativo: true }, "created_date", 1))?.[0];

  if (conversa) {
    const patch: Record<string, unknown> = {
      ultima_mensagem: texto,
      ultima_interacao: agora,
      nao_lidas: fromMe ? 0 : Number(conversa.nao_lidas || 0) + 1
    };
    if (lid && !conversa.contato_lid) patch.contato_lid = lid;
    // Conversa antiga com LID no campo telefone: o LID nunca fica como telefone
    if (lid && String(conversa.telefone || "") === lid) patch.telefone = tel;
    else if (tel && !conversa.telefone) patch.telefone = tel;
    if (!conversa.cliente_id && tel) {
      const cli = await clientePorTelefone(db, ownerId, tel);
      if (cli) { patch.cliente_id = cli.id; if (cli.nome) patch.nome_contato = cli.nome; }
    }
    if (!patch.nome_contato && nomeVazio(conversa.nome_contato)) {
      patch.nome_contato = ident.nome || NAO_IDENTIFICADO;
    }
    await db.CRMConversa.update(conversa.id, patch);
    return { ...conversa, ...patch };
  }

  const cliente = tel ? await clientePorTelefone(db, ownerId, tel) : null;
  const criada = await db.CRMConversa.create({
    owner_id: ownerId,
    cliente_id: cliente?.id || "",
    nome_contato: cliente?.nome || ident.nome || NAO_IDENTIFICADO,
    telefone: tel,
    contato_lid: lid,
    etapa: "novo",
    ultima_mensagem: texto,
    ultima_interacao: agora,
    nao_lidas: fromMe ? 0 : 1,
    origem: "whatsapp",
    ativo: true
  });
  // Corrida: duas entregas do mesmo contato ao mesmo tempo. Fica a mais antiga.
  const chave = tel ? { telefone: tel } : { contato_lid: lid };
  const iguais = (await db.CRMConversa.filter({ owner_id: ownerId, ...chave, ativo: true }, "created_date", 5)) || [];
  if (iguais.length > 1 && iguais[0].id !== criada.id) {
    await db.CRMConversa.update(criada.id, { ativo: false, observacoes: `Duplicada de ${iguais[0].id} (entrega simultânea; item 022)` });
    console.log("[CRM_WEBHOOK] conversa duplicada evitada", criada.id, "→", iguais[0].id);
    return iguais[0];
  }
  return criada;
}

