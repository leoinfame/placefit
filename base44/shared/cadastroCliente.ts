// ─── Cadastro automático do contato em Cliente (atendimento do vendedor) ────
// Regras (Leandro, 12/10/2026):
//  - o cliente só é CRIADO quando a pessoa diz o nome (nome + telefone, o mínimo);
//  - antes de criar, procura Cliente pelo telefone para não duplicar; se existir,
//    só preenche o nome se estiver vazio e vincula a conversa (CRMConversa.cliente_id);
//  - enriquecimento progressivo: CPF/CNPJ, e-mail, endereço, cidade/UF, CEP entram
//    conforme a pessoa informa, SÓ em campos vazios (nunca sobrescreve);
//  - nada sai do PlaceFit; nome do perfil do WhatsApp e número nunca viram nome.

const UFS = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
const digitos = (s: string) => String(s || '').replace(/\D/g, '');

/** Chave de telefone BR: DDD + últimos 8 dígitos (ignora 55 e o nono dígito). */
export function chaveTelefone(tel: string): string {
  let d = digitos(tel);
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) return '';
  return d.slice(0, 2) + d.slice(-8);
}

async function clientesDoTenant(base44: any, tenantId: string) {
  let todos: any[] = [];
  for (let skip = 0; skip < 10000; skip += 500) {
    const lote = await base44.asServiceRole.entities.Cliente.filter({ fornecedor_id: tenantId }, '-created_date', 500, skip);
    todos = todos.concat(lote || []);
    if (!lote || lote.length < 500) break;
  }
  return todos;
}

/** Cliente vinculado à conversa; se não houver vínculo, procura pelo telefone e vincula. */
export async function clienteDaConversa(base44: any, tenantId: string, conversa: any, telefone: string) {
  const db = base44.asServiceRole.entities;
  if (conversa.cliente_id) {
    const r = await db.Cliente.filter({ id: conversa.cliente_id }, '-created_date', 1);
    if (r?.[0]) return r[0];
  }
  const chave = chaveTelefone(telefone);
  if (!chave) return null;
  const achado = (await clientesDoTenant(base44, tenantId)).find((c) => chaveTelefone(c.telefone) === chave);
  if (achado) {
    await db.CRMConversa.update(conversa.id, {
      cliente_id: achado.id,
      ...(achado.nome ? { nome_contato: achado.nome } : {})
    });
    conversa.cliente_id = achado.id;
  }
  return achado || null;
}

export function nomeValido(n: string) {
  return /^[\p{L}][\p{L}' .-]{1,59}$/u.test(n) && !/\d/.test(n);
}

/** Só os dados válidos que a pessoa informou. */
function dadosValidos(d: any) {
  const out: Record<string, string> = {};
  const doc = digitos(d?.cpf_cnpj);
  if (doc.length === 11 || doc.length === 14) out.cpf_cnpj = String(d.cpf_cnpj).trim();
  const email = String(d?.email || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.email = email.toLowerCase();
  const uf = String(d?.estado || '').trim().toUpperCase();
  if (UFS.has(uf)) out.estado = uf;
  const cidade = String(d?.cidade || '').trim();
  if (cidade.length >= 2 && cidade.length <= 60 && !/\d/.test(cidade)) out.cidade = cidade;
  const endereco = String(d?.endereco || '').trim();
  if (endereco.length >= 5 && endereco.length <= 200) out.endereco = endereco;
  const cep = digitos(d?.cep);
  if (cep.length === 8) out.cep = cep.slice(0, 5) + '-' + cep.slice(5);
  return out;
}

/**
 * Aplica o que a IA extraiu da conversa: cria/vincula o cliente quando houver nome
 * e preenche só campos vazios. Devolve uma descrição curta do que mudou (para log).
 */
export async function atualizarCadastro(base44: any, tenantId: string, conversa: any, telefone: string, clienteAtual: any, nome: string, dados: any): Promise<string> {
  const db = base44.asServiceRole.entities;
  const novos = dadosValidos(dados);
  let cliente = clienteAtual;

  if (!cliente) {
    if (!nome || !nomeValido(nome)) return '';
    // Última checagem por telefone, para nunca duplicar
    const chave = chaveTelefone(telefone);
    const existente = chave ? (await clientesDoTenant(base44, tenantId)).find((c) => chaveTelefone(c.telefone) === chave) : null;
    if (existente) {
      cliente = existente;
    } else {
      cliente = await db.Cliente.create({
        fornecedor_id: tenantId,
        nome,
        telefone: digitos(telefone),
        ...novos,
        ativo: true,
        observacoes: 'Cadastrado automaticamente pelo atendimento do WhatsApp (PlaceFit).'
      });
      await db.CRMConversa.update(conversa.id, { cliente_id: cliente.id, nome_contato: nome });
      conversa.cliente_id = cliente.id;
      return 'cliente_criado';
    }
  }

  const patch: Record<string, string> = {};
  if (!String(cliente.nome || '').trim() && nome && nomeValido(nome)) patch.nome = nome;
  for (const [k, v] of Object.entries(novos)) {
    if (!String(cliente[k] || '').trim()) patch[k] = v;
  }
  const vincular = conversa.cliente_id !== cliente.id;
  if (Object.keys(patch).length) await db.Cliente.update(cliente.id, patch);
  if (vincular || patch.nome) {
    await db.CRMConversa.update(conversa.id, { cliente_id: cliente.id, ...(patch.nome || cliente.nome ? { nome_contato: patch.nome || cliente.nome } : {}) });
    conversa.cliente_id = cliente.id;
  }
  const mudou = [vincular && 'vinculado', ...Object.keys(patch)].filter(Boolean);
  return mudou.length ? 'cliente_atualizado:' + mudou.join(',') : '';
}
