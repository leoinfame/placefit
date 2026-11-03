import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { atenderLead } from '../../shared/vendedorLead.ts';
import { itensSuaTabela, htmlSuaTabela, imprimirPdf } from '../../shared/tabelaPdf.ts';

// TEMPORÁRIA (03/11/2026, autorizada pelo Sr. Leo): ensaio do vendedor automático com dados reais,
// sem WhatsApp e sem gravar nada. Exige o segredo ENSAIO_TOKEN. Apagar depois do ensaio.
const env = (n: string) => String(Deno.env.get(n) || '').trim();

function memoria(seed: Record<string, any[]>) {
  const t: Record<string, any[]> = {};
  let n = 0;
  const casa = (r: any, q: any) => Object.entries(q).every(([k, v]) => (r[k] ?? '') === v);
  const db: any = {};
  for (const e of ['CRMMensagem', 'CRMConversa', 'CRMAlerta', 'Cliente', 'Pedido', 'LojaConfig']) {
    t[e] = (seed[e] || []).map((r) => ({ ...r }));
    db[e] = {
      async filter(q: any, sort?: string, lim = 1000) {
        let rows = t[e].filter((r) => casa(r, q));
        if (sort) { const d = sort.startsWith('-'); const f = sort.replace('-', ''); rows = [...rows].sort((a, b) => (String(a[f]) < String(b[f]) ? -1 : 1) * (d ? -1 : 1)); }
        return rows.slice(0, lim).map((r) => ({ ...r }));
      },
      async create(dd: any) { const r = { id: e + ++n, created_date: new Date(Date.now() + n).toISOString().replace('Z', ''), ...dd }; t[e].push(r); return { ...r }; },
      async update(id: string, p: any) { Object.assign(t[e].find((r) => r.id === id) || {}, p); }
    };
  }
  return { db, t };
}

function b64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (!env('ENSAIO_TOKEN') || req.headers.get('x-ensaio') !== env('ENSAIO_TOKEN')) return new Response('forbidden', { status: 403 });
  const base44 = createClientFromRequest(req);
  const real = base44.asServiceRole.entities;
  const body = await req.json().catch(() => ({}));
  const owner = (await real.User.filter({ id: '697aeaf8e4420021ed5caeb1' }))?.[0];
  const pdfCfg = { url: env('PDF_SERVICE_URL'), user: env('PDF_SERVICE_USER'), pass: env('PDF_SERVICE_PASS') };
  const out: any = {};

  if (body.tabela) {
    const t0 = Date.now();
    try {
      const itens = await itensSuaTabela(real, owner.id);
      const bytes = await imprimirPdf(await htmlSuaTabela(owner, itens), pdfCfg);
      const up: any = await base44.asServiceRole.integrations.Core.UploadFile({ file: new File([bytes], 'ensaio-tabela.pdf', { type: 'application/pdf' }) });
      out.tabela = { itens: itens.length, kb: Math.round(bytes.length / 1024), ms: Date.now() - t0, url: up?.file_url };
    } catch (e) { out.tabela = { erro: String((e as any)?.message || e), ms: Date.now() - t0 }; }
  }

  for (const cen of body.cenarios || []) {
    const t0 = Date.now();
    const base = Date.now() - 120000;
    const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '');
    const msgs = [
      { id: 'm0', conversa_id: 'c1', direcao: 'recebida', origem: 'waha', conteudo: cen.msgs[0], meta_message_id: 'w0', created_date: iso(base) },
      { id: 'bv', conversa_id: 'c1', direcao: 'enviada', origem: 'sistema', conteudo: '[PDF: tabela]\nOlá!', created_date: iso(base + 2000) },
      ...cen.msgs.slice(1).map((x: string, i: number) => ({ id: 'r' + i, conversa_id: 'c1', direcao: 'recebida', origem: 'waha', conteudo: x, meta_message_id: 'w' + (i + 1), created_date: iso(base + 10000 + i * 1000) }))
    ];
    const { db } = memoria({ CRMMensagem: msgs, CRMConversa: [{ id: 'c1', etapa: 'novo' }] });
    const r: any = { nome: cen.nome, textos: [], pdfs: [], avisos: [] };
    let quote: Uint8Array | null = null;
    const res = await atenderLead({
      db, base44, owner, conversa: { id: 'c1', etapa: 'novo', telefone: '5531900000000', nome_contato: 'Teste' }, messageId: 'w' + (cen.msgs.length - 1),
      enviarTexto: async (x: string) => { r.textos.push(x); return { ok: true, id: 'x', error: '' }; },
      enviarPdf: async (bytes: Uint8Array, nome: string, leg: string) => { quote = bytes; r.pdfs.push({ nome, legenda: leg, kb: Math.round(bytes.length / 1024) }); return { ok: true, id: 'p', error: '' }; },
      pdfCfg,
      avisarDono: async (a: any[]) => { r.avisos.push(...a.map((x) => ({ titulo: x.titulo, detalhe: x.detalhe }))); },
      esperar: async () => {},
      deps: {
        gravar: async (rr: any, op: any) => {
          r.orcamento = { cliente: rr.cliente, itens: rr.itens, subtotal: rr.subtotal, frete: rr.frete, frete_origem: rr.frete_origem, total: rr.total, suposicoes: rr.suposicoes, ressalvas: rr.ressalvas, composicoes: rr.composicoes };
          return { pedido: { id: 'ensaio', numero_pedido: 'ORC-ENSAIO', data_pedido: new Date().toISOString().split('T')[0], cliente_id: rr.cliente?.id || '', cliente_nome: rr.cliente?.nome || '', itens: rr.itens.map((i: any) => ({ cod: i.cod, nome: i.nome, quantidade: i.quantidade, preco_unitario: i.preco_unitario, subtotal: i.subtotal })), subtotal: rr.subtotal, frete: rr.frete || 0, desconto: 0, total: rr.total, observacoes: op?.observacoes || '' }, divergencias: [] };
        }
      }
    });
    r.resultado = res;
    r.ms = Date.now() - t0;
    if (quote && cen.devolverPdf) r.pdf_b64 = b64(quote);
    (out.cenarios ||= []).push(r);
  }
  return Response.json(out);
});
