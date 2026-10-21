// ─── Vinculo telefone -> revenda para o gerente do 8509 (item 006, 16/10/2026) ───
// O gerente do WhatsApp oficial atende cada revendedor pela PROPRIA conta.
// Regras:
//  - o numero so vale depois de verificado: o revendedor gera um codigo no PlaceFit e manda
//    "ATIVAR 123456" do proprio celular para o 8509 (prova que o numero e dele);
//  - o codigo vale 15 minutos e so o hash SHA-256 fica gravado;
//  - um numero pertence a UMA conta: ao verificar, vinculos do mesmo numero em outras contas caem;
//  - quem consulta (respondedorLeo) passa o user_id do vinculo como tenant do gerente, entao
//    todas as leituras e o orcamento assistido ficam restritos a essa revenda.

const soDigitos = (v: string) => String(v || '').replace(/\D/g, '');

/** Normaliza celular BR: so digitos, com 55 na frente. */
export function normalizarCelular(v: string): string {
  let d = soDigitos(v);
  if (d.startsWith('00')) d = d.slice(2);
  if (!d.startsWith('55') && (d.length === 10 || d.length === 11)) d = '55' + d;
  return d;
}

/** DDD + ultimos 8 digitos: casa o numero com ou sem o nono digito (a Meta as vezes manda sem). */
export function chaveTelefone(v: string): string {
  let d = normalizarCelular(v);
  if (d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) return '';
  const ddd = d.slice(0, 2);
  return ddd + d.slice(-8);
}

export async function hashCodigo(codigo: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vinculo-gerente:' + codigo));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Vinculo VERIFICADO do numero, com a conta ainda existente; senao null. */
export async function revendedorDoTelefone(base44: any, telefone: string) {
  const chave = chaveTelefone(telefone);
  if (!chave) return null;
  const db = base44.asServiceRole.entities;
  const rows = await db.VinculoGerenteWhatsApp.filter({ chave_telefone: chave, verificado: true }, '-verificado_em', 2);
  const v = rows?.[0];
  if (!v?.user_id) return null;
  try {
    const conta = await db.User.get(v.user_id);
    if (!conta) return null;
    return { ...v, conta };
  } catch {
    return null;
  }
}

const RE_ATIVAR = /^\s*ativar\s*:?\s*(\d{6})\s*$/i;

export function ehMensagemDeAtivacao(texto: string): boolean {
  return RE_ATIVAR.test(String(texto || ''));
}

// ── Item 016: ninguém que tenta ativar ou tem cadastro fica em silêncio ──────────────

/** "ATIVAR" sem os 6 números ou com formato errado ("ATIVAR 8509", "ativar"). */
export function ehTentativaDeAtivacao(texto: string): boolean {
  const t = String(texto || '');
  return /^\s*ativar\b/i.test(t) && !RE_ATIVAR.test(t);
}

export const FORMATO_ATIVAR = 'Pra ativar o gerente, manda aqui: ATIVAR + o código de 6 números que aparece no app PlaceFit (ex.: ATIVAR 123456). ' +
  'O código sai no card "Gerente PlaceFit no seu WhatsApp" e vale 15 minutos.';

/** Marca no começo da orientação: o respondedor usa para não repetir em menos de 6 h. */
export const PREFIXO_ORIENTACAO = 'Seu número está no cadastro do PlaceFit';

export function orientacaoAtivacao(conta: { nome: string; empresa: string }) {
  const quem = conta.nome ? `Oi, ${conta.nome.split(' ')[0]}! ` : 'Oi! ';
  return quem + `${PREFIXO_ORIENTACAO}${conta.empresa ? ` (${conta.empresa})` : ''}, mas ainda não está ativado aqui no gerente.\n` +
    '1. Abre o app PlaceFit e vai no card "Gerente PlaceFit no seu WhatsApp".\n' +
    '2. Cadastra este celular e toca em ATIVAR.\n' +
    '3. Manda aqui: ATIVAR + o código de 6 números (vale 15 minutos).';
}

const CACHE_CONTAS_MS = 10 * 60 * 1000;
let cacheContas: { em: number; porChave: Map<string, any> } | null = null;

/** Conta do app com este celular no cadastro (User.whatsapp ou telefone), aprovada; senão null. */
export async function contaCadastradaDoTelefone(base44: any, telefone: string) {
  const chave = chaveTelefone(telefone);
  if (!chave) return null;
  if (!cacheContas || Date.now() - cacheContas.em > CACHE_CONTAS_MS) {
    const porChave = new Map<string, any>();
    for (let skip = 0; skip < 10000; skip += 500) {
      const lote = await base44.asServiceRole.entities.User.filter({}, '-created_date', 500, skip);
      for (const u of lote || []) {
        if (u.aprovado === false || u.disabled) continue;
        for (const tel of [u.whatsapp, u.telefone, u.phone]) {
          const k = chaveTelefone(String(tel || ''));
          if (k && !porChave.has(k)) porChave.set(k, u);
        }
      }
      if (!lote || lote.length < 500) break;
    }
    cacheContas = { em: Date.now(), porChave };
  }
  const u = cacheContas.porChave.get(chave);
  return u ? { id: String(u.id), nome: String(u.full_name || '').trim(), empresa: String(u.empresa || '').trim() } : null;
}

/** Só para testes: zera o cache de contas. */
export function _limparCacheContas() { cacheContas = null; }

/**
 * Trata "ATIVAR 123456" vindo do numero `telefone`.
 * Retorna { tratou:false } se a mensagem nao e de ativacao.
 */
export async function tentarAtivacao(base44: any, telefone: string, texto: string): Promise<{ tratou: boolean; resposta: string; userId?: string }> {
  const m = RE_ATIVAR.exec(String(texto || ''));
  if (!m) return { tratou: false, resposta: '' };
  const chave = chaveTelefone(telefone);
  const falha = 'Não consegui ativar. Confira se o código é o que aparece no PlaceFit, se ainda está dentro dos 15 minutos e se você está mandando do mesmo celular que cadastrou. Se precisar, gere um código novo.';
  if (!chave) return { tratou: true, resposta: falha };

  const db = base44.asServiceRole.entities;
  const pendentes = await db.VinculoGerenteWhatsApp.filter({ chave_telefone: chave }, '-created_date', 20);
  const h = await hashCodigo(m[1]);
  const agora = Date.now();
  const alvo = (pendentes || []).find((p: any) =>
    p.codigo_hash && p.codigo_hash === h && p.codigo_expira && new Date(p.codigo_expira).getTime() >= agora
  );
  if (!alvo) return { tratou: true, resposta: falha };

  const quando = new Date().toISOString();
  await db.VinculoGerenteWhatsApp.update(alvo.id, {
    verificado: true, verificado_em: quando, codigo_hash: '', codigo_expira: null, telefone: normalizarCelular(telefone)
  });
  // Um numero, uma conta: derruba vinculos desse numero em outras contas
  for (const p of pendentes || []) {
    if (p.id !== alvo.id && p.verificado) {
      await db.VinculoGerenteWhatsApp.update(p.id, { verificado: false });
    }
  }
  const nome = alvo.nome_conta ? ` da ${alvo.nome_conta}` : '';
  return {
    tratou: true,
    userId: alvo.user_id,
    resposta: `Pronto, número ativado! A partir de agora eu sou o gerente${nome} aqui no WhatsApp. Pode perguntar dos seus orçamentos, leads e clientes, ou pedir "faz um orçamento pro cliente ...".`
  };
}
