import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Item 022e (pedido do Sr. Leo, 02/11/2026): tabela de atacado PÚBLICA da revenda, sem login,
 * sempre com os preços atuais — é o link que a resposta automática manda para o lead novo.
 *
 * Mesma regra de preço da tela "Sua Tabela" (Export.jsx): preço promocional quando houver,
 * senão preço × (1 + margem). Só devolve o preço FINAL de venda: nunca preço de fábrica,
 * margem, fabricante, CNPJ, e-mail de login ou qualquer outro dado interno.
 */
const PAGE = 500;

async function todos(fn: (skip: number) => Promise<any[]>) {
  let out: any[] = [];
  for (let skip = 0; skip < 20000; skip += PAGE) {
    const lote = (await fn(skip)) || [];
    out = out.concat(lote);
    if (lote.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let supplierId = '';
    try {
      const body = await req.json();
      supplierId = String(body?.supplier || body?.supplier_id || '');
    } catch {
      supplierId = new URL(req.url).searchParams.get('supplier') || '';
    }
    if (!/^[a-f0-9]{24}$/i.test(supplierId)) {
      return Response.json({ error: 'Link inválido.' }, { status: 400 });
    }

    const db = base44.asServiceRole.entities;
    const u = (await db.User.filter({ id: supplierId }))?.[0];
    if (!u || u.tipo_usuario === 'fabricante' || u.tipo_usuario === 'transportador') {
      return Response.json({ error: 'Tabela não encontrada.' }, { status: 404 });
    }

    const revenda = {
      empresa: u.empresa || u.full_name || '',
      logomarca: u.logomarca || '',
      whatsapp: u.whatsapp || '',
      site: u.site || '',
      cidade: u.cidade || '',
      estado: u.estado || ''
    };

    const sps = await todos((skip) => db.SupplierProduct.filter({ supplier_id: supplierId }, '-created_date', PAGE, skip));
    const ativos = sps.filter((sp: any) => sp.disponivel !== false && Number(sp.preco) > 0 && sp.product_id);
    const ids = [...new Set(ativos.map((sp: any) => sp.product_id))];
    const templates: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const lote = await db.ProductTemplate.filter({ id: { $in: ids.slice(i, i + 200) } }, 'cod', 200);
      templates.push(...(lote || []));
    }
    const tpl = new Map(templates.map((t: any) => [t.id, t]));

    const vistos = new Set<string>();
    const itens = ativos.map((sp: any) => {
      const t: any = tpl.get(sp.product_id);
      if (!t || t.ativo === false || vistos.has(t.id)) return null;
      vistos.add(t.id);
      const preco = Number(sp.sale_price) > 0 ? Number(sp.sale_price) : Number(sp.preco) * (1 + (Number(sp.margem) || 0) / 100);
      return {
        cod: t.cod || '',
        nome: t.nome || '',
        categoria: t.categoria || 'Outros',
        und: t.und || 'peça',
        peso_kg: t.peso_kg ?? null,
        foto: t.foto || '',
        preco: Math.round(preco * 100) / 100
      };
    }).filter(Boolean)
      .sort((a: any, b: any) => String(a.categoria).localeCompare(String(b.categoria), 'pt-BR') ||
        String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));

    return Response.json({ revenda, itens, atualizado_em: new Date().toISOString() });
  } catch (error) {
    console.error('Erro getTabelaPublica:', error);
    return Response.json({ error: 'Erro ao carregar a tabela.' }, { status: 500 });
  }
});
