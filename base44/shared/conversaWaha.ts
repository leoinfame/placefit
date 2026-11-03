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
  // Item 022e: marca que este evento abriu a conversa (primeiro contato do lead)
  return { ...criada, _nova: true };
}


/** Nome do perfil limpo para cadastro (sem emoji/símbolos); '' se não for um nome de pessoa/empresa. */
export function nomeParaCadastro(nome: string): string {
  const limpo = String(nome || '').replace(/[^\p{L}' .-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!limpo || limpo === NAO_IDENTIFICADO || !nomeValido(limpo)) return '';
  return limpo.slice(0, 60);
}

/**
 * Item 022b (pedido do Sr. Leo, 02/11 19:44): contato com TELEFONE REAL verificado e nome no perfil
 * vira cliente em Meus Clientes (regra do nome de 12/10: nome + telefone criam o Cliente).
 * Nunca com LID, nunca sem telefone real, nunca duplica: procura antes pelo telefone e, depois de
 * criar, confere de novo (entregas simultâneas); a cópia mais nova fica ativo=false.
 */
export async function garantirCliente(db: any, ownerId: string, conversa: any): Promise<string> {
  const tel = String(conversa?.telefone || '');
  if (!tel || conversa?.cliente_id) return '';
  if (conversa?.contato_lid && tel === String(conversa.contato_lid)) return '';
  if (!/^55\d{10,11}$/.test(tel)) return '';
  const nome = nomeParaCadastro(conversa?.nome_contato);
  if (!nome) return '';

  let cliente = await clientePorTelefone(db, ownerId, tel);
  let criou = false;
  if (!cliente) {
    cliente = await db.Cliente.create({
      fornecedor_id: ownerId,
      nome,
      telefone: tel,
      ativo: true,
      observacoes: 'Cadastrado automaticamente pelo CRM WhatsApp (7206): nome do perfil + telefone real.'
    });
    criou = true;
    const chave = chaveTelefone(tel);
    const iguais = ((await db.Cliente.filter({ fornecedor_id: ownerId, telefone: { "$regex": chave.slice(-4) + "\\D*$" } }, 'created_date', 200)) || [])
      .filter((c: any) => chaveTelefone(c.telefone) === chave && c.ativo !== false);
    if (iguais.length > 1 && iguais[0].id !== cliente.id) {
      await db.Cliente.update(cliente.id, { ativo: false, observacoes: `Duplicado de ${iguais[0].id} (entrega simultânea; item 022b)` });
      cliente = iguais[0];
      criou = false;
    }
  }
  await db.CRMConversa.update(conversa.id, { cliente_id: cliente.id, ...(cliente.nome ? { nome_contato: cliente.nome } : {}) });
  conversa.cliente_id = cliente.id;
  return criou ? 'cliente_criado' : 'cliente_vinculado';
}

// ─── Item 022e: resposta automática para lead novo (7206) ───────────────────
// Pedido do Sr. Leo (02/11/2026 20:29). Texto fixo, sem IA: tabela de atacado atual + pedido
// da lista de itens e do CNPJ. Uma vez só por contato novo (conversa aberta agora e sem cliente).
// Item 022f: sem link => legenda do PDF anexado; com link => plano B quando o arquivo não sai.
export function textoBoasVindas(empresa: string, nome: string, linkTabela = ''): string {
  const primeiro = String(nome || '').trim().split(/\s+/)[0];
  return [
    `Olá${primeiro ? ', ' + primeiro : ''}! Aqui é da ${empresa || 'MuscularFit'}, obrigado pelo contato.`,
    '',
    linkTabela ? `Esta é a nossa tabela de atacado, sempre atualizada: ${linkTabela}` : 'Segue em anexo a nossa tabela de atacado, atualizada hoje.',
    '',
    'Para eu montar seu orçamento já com o frete, me envie:',
    '1. a lista dos itens com as quantidades',
    '2. o CNPJ (ou CPF) para o cadastro',
    '',
    'Assim que chegar, já te respondo com o orçamento.'
  ].join('\n');
}

/** Só para contato realmente novo: conversa criada neste evento, mensagem do cliente, sem cadastro. */
export function deveMandarBoasVindas(conversa: any, fromMe: boolean, chave: string): boolean {
  if (fromMe || !conversa?._nova || conversa?.cliente_id) return false;
  return String(chave || '').trim().toLowerCase() !== 'off';
}
