import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Semeia o de-para (SupplierSkuMap) a partir dos cod_origem já gravados em
 * SupplierProduct pelas importações antigas. Só o admin roda.
 *
 * Cuidado importante: nas importações antigas, quando o preço era interpretado
 * como por quilo, o MESMO cod_origem era gravado em todas as variações de peso.
 * Nesses casos o código não identifica um produto específico, e semear seria
 * inventar um vínculo que nunca existiu. Por isso só são semeados os cod_origem
 * que apontam para exatamente um produto dentro do mesmo fornecedor.
 *
 * Chamar com { dry_run: true } para apenas contar, sem gravar.
 */

const normalizeCod = (cod: string) =>
  String(cod ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas administradores.' }, { status: 403 });
    }

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true;
    } catch { /* sem corpo: grava */ }

    // Todos os SupplierProduct, paginado.
    let todos: any[] = [];
    let skip = 0;
    while (true) {
      const lote = await base44.asServiceRole.entities.SupplierProduct.list('-created_date', 500, skip);
      todos = todos.concat(lote);
      if (lote.length < 500) break;
      skip += 500;
    }

    // Agrupa por (supplier_id, cod_origem normalizado) → conjunto de product_id
    const grupos = new Map<string, { supplier_id: string; cod_origem: string; pids: Set<string> }>();
    for (const sp of todos) {
      if (!sp.cod_origem || !sp.product_id || !sp.supplier_id) continue;
      const chave = normalizeCod(sp.cod_origem);
      if (!chave) continue;
      const k = `${sp.supplier_id}::${chave}`;
      if (!grupos.has(k)) {
        grupos.set(k, { supplier_id: sp.supplier_id, cod_origem: sp.cod_origem, pids: new Set() });
      }
      grupos.get(k)!.pids.add(sp.product_id);
    }

    // Não sobrescreve mapeamentos já confirmados por gente.
    const existentes = await base44.asServiceRole.entities.SupplierSkuMap.list('-created_date', 500);
    const jaMapeado = new Set(existentes.map((m: any) => `${m.supplier_id}::${m.chave}`));

    const novos: any[] = [];
    let ambiguos = 0;
    let jaExistiam = 0;

    for (const [k, g] of grupos) {
      if (jaMapeado.has(k)) { jaExistiam++; continue; }
      if (g.pids.size !== 1) { ambiguos++; continue; }
      novos.push({
        supplier_id: g.supplier_id,
        chave: normalizeCod(g.cod_origem),
        tipo_chave: 'codigo',
        cod_origem: g.cod_origem,
        product_id: [...g.pids][0],
        origem_match: 'importado_historico',
        confirmado_por: user.email,
        ativo: true,
      });
    }

    if (!dryRun && novos.length > 0) {
      for (let i = 0; i < novos.length; i += 200) {
        await base44.asServiceRole.entities.SupplierSkuMap.bulkCreate(novos.slice(i, i + 200));
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      supplier_products_lidos: todos.length,
      codigos_distintos: grupos.size,
      mapeamentos_criados: dryRun ? 0 : novos.length,
      mapeamentos_elegiveis: novos.length,
      ignorados_ambiguos: ambiguos,
      ignorados_ja_mapeados: jaExistiam,
    });
  } catch (error) {
    console.error('Erro semearSkuMapHistorico:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
