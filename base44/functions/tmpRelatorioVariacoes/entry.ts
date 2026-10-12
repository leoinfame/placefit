// TEMPORÁRIA (12/10/2026) — SOMENTE LEITURA — APAGAR logo após gerar o relatório.
// Devolve dados compactos do catálogo de uma revenda para a análise de variações:
// produtos (SupplierProduct x ProductTemplate), presença de foto e quantas vezes cada
// template é citado em orçamentos/pedidos (impacto de uma unificação).
// Protegida por chave aleatória (segredo TMP_RELATORIO_KEY). Não grava nada.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";
import { fetchAllPaged } from "../../shared/metaCatalog.ts";

export default async function (req: Request) {
  const chave = String(Deno.env.get("TMP_RELATORIO_KEY") || "");
  if (!chave || req.headers.get("x-tmp-key") !== chave) return Response.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const { revendedor_id } = await req.json();

    const sps = await fetchAllPaged((sort: any, limit: any, skip: any) => db.SupplierProduct.filter({ supplier_id: revendedor_id }, sort, limit, skip));
    const ids = [...new Set(sps.map((s: any) => s.product_id).filter(Boolean))] as string[];
    const tpls: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const parte = ids.slice(i, i + 200);
      tpls.push(...await fetchAllPaged((sort: any, limit: any, skip: any) => db.ProductTemplate.filter({ id: { $in: parte } }, sort, limit, skip)));
    }

    // Referências em orçamentos/pedidos (todas as revendas: o template é compartilhado)
    const refs: Record<string, { orc: number; ped: number; pv: number; lp: number }> = {};
    const conta = (pid: string, campo: "orc" | "ped" | "pv" | "lp") => {
      if (!pid) return;
      refs[pid] = refs[pid] || { orc: 0, ped: 0, pv: 0, lp: 0 };
      refs[pid][campo]++;
    };
    const pedidos = await fetchAllPaged((sort: any, limit: any, skip: any) => db.Pedido.filter({}, sort, limit, skip));
    for (const p of pedidos) for (const it of p.itens || []) conta(String(it.product_id || ""), p.tipo === "orcamento" ? "orc" : "ped");
    let pvs: any[] = [];
    try { pvs = await fetchAllPaged((sort: any, limit: any, skip: any) => db.PedidoVenda.filter({}, sort, limit, skip)); } catch (_) {}
    for (const p of pvs) for (const it of p.itens || []) conta(String(it.product_id || ""), "pv");
    let lps: any[] = [];
    try { lps = await fetchAllPaged((sort: any, limit: any, skip: any) => db.LojaPedido.filter({}, sort, limit, skip)); } catch (_) {}
    for (const p of lps) for (const it of p.itens || []) conta(String(it.product_id || it.template_id || ""), "lp");

    // Quantas revendas usam cada template (impacto fora da MuscularFit)
    const usoPorTemplate: Record<string, number> = {};
    for (let i = 0; i < ids.length; i += 200) {
      const parte = ids.slice(i, i + 200);
      const outros = await fetchAllPaged((sort: any, limit: any, skip: any) => db.SupplierProduct.filter({ product_id: { $in: parte } }, sort, limit, skip));
      const vistos = new Set<string>();
      for (const o of outros) {
        const k = `${o.product_id}|${o.supplier_id}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        usoPorTemplate[o.product_id] = (usoPorTemplate[o.product_id] || 0) + 1;
      }
    }

    return Response.json({
      gerado_em: new Date().toISOString(),
      sps: sps.map((s: any) => ({ id: s.id, p: s.product_id, d: s.disponivel !== false, preco: s.preco, sale: s.sale_price || 0, m: s.margem || 0 })),
      tpls: tpls.map((t: any) => ({
        id: t.id, nome: t.nome, cod: t.cod, cat: t.categoria, sub: t.subcategoria, peso: t.peso_kg, und: t.und, ativo: t.ativo !== false,
        foto: String(t.foto || ""), tipo_anilha: t.tipo_anilha, acab: t.acabamento, pegada: t.pegada,
        revendas: usoPorTemplate[t.id] || 0, refs: refs[t.id] || null,
      })),
      totais: { pedidos: pedidos.length, pedidos_venda: pvs.length, loja_pedidos: lps.length },
    });
  } catch (e) {
    return Response.json({ erro: String((e as any)?.message || e).slice(0, 500) }, { status: 500 });
  }
}
