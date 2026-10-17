import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { normalizarCelular, chaveTelefone, hashCodigo } from '../../shared/vinculoRevendedor.ts';

// Item 006 (16/10/2026): o revendedor liga o proprio celular ao gerente do WhatsApp oficial.
// Acoes (sempre da conta logada; ninguem mexe no vinculo de outra conta):
//  - status:   vinculo atual da conta + numero oficial para onde mandar o codigo
//  - iniciar:  { telefone } gera um codigo de 6 digitos (vale 15 min); so o hash fica gravado
//  - remover:  desliga o vinculo da conta
const VALIDADE_MIN = 15;

async function numeroOficial(sr: any): Promise<string> {
  try {
    const conns = await sr.whatsapp_connections.list('-updated_date', 20);
    const c = (conns || []).find((x: any) => x.phone_number_id && x.display_phone);
    return String(c?.display_phone || '').replace(/\D/g, '');
  } catch { return ''; }
}

const mascarar = (tel: string) => {
  const d = String(tel || '');
  if (d.length < 6) return d;
  return d.slice(0, 4) + '•••••' + d.slice(-4);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch { /* sem corpo */ }
    const action = String(body?.action || 'status');
    const sr = base44.asServiceRole.entities;

    const meus = await sr.VinculoGerenteWhatsApp.filter({ user_id: user.id }, '-created_date', 10);
    const atual = (meus || [])[0] || null;
    const oficial = await numeroOficial(sr);

    if (action === 'status') {
      return Response.json({
        numero_oficial: oficial,
        vinculo: atual ? {
          telefone_mascarado: mascarar(atual.telefone),
          verificado: Boolean(atual.verificado),
          verificado_em: atual.verificado_em || null,
          aguardando_codigo: !atual.verificado && Boolean(atual.codigo_expira) && new Date(atual.codigo_expira).getTime() > Date.now(),
          codigo_expira: atual.codigo_expira || null,
        } : null,
      });
    }

    if (action === 'iniciar') {
      const telefone = normalizarCelular(String(body?.telefone || ''));
      const chave = chaveTelefone(telefone);
      if (!chave || telefone.length < 12 || telefone.length > 13) {
        return Response.json({ error: 'Confira o número: use o DDD e o celular, por exemplo (37) 99999-0000.' }, { status: 400 });
      }
      const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
      const dados = {
        user_id: user.id,
        telefone,
        chave_telefone: chave,
        verificado: false,
        codigo_hash: await hashCodigo(codigo),
        codigo_expira: new Date(Date.now() + VALIDADE_MIN * 60000).toISOString(),
        verificado_em: null,
        nome_conta: String(user.empresa || user.full_name || ''),
      };
      if (atual) await sr.VinculoGerenteWhatsApp.update(atual.id, dados);
      else await sr.VinculoGerenteWhatsApp.create(dados);
      // Vinculos antigos extras desta conta saem
      for (const v of (meus || []).slice(1)) await sr.VinculoGerenteWhatsApp.delete(v.id);
      return Response.json({ ok: true, codigo, validade_min: VALIDADE_MIN, numero_oficial: oficial });
    }

    if (action === 'remover') {
      for (const v of meus || []) await sr.VinculoGerenteWhatsApp.delete(v.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('[vinculoGerente]', error);
    return Response.json({ error: 'Erro ao processar', details: (error as any)?.message }, { status: 500 });
  }
});
