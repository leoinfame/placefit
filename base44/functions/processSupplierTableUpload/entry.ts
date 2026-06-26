import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    // 1. Buscar templates ativos e SupplierProducts existentes em paralelo
    const [templates, existingSps] = await Promise.all([
      base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }),
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id })
    ]);

    const existingByPid = new Map();
    for (const sp of existingSps) existingByPid.set(sp.product_id, sp);

    // Lista compacta de templates
    const templateList = templates.map(t => {
      const parts = [t.id, t.cod || "", t.nome || "", t.categoria || ""];
      if (t.peso_kg) parts.push(`${t.peso_kg}kg`);
      if (t.acabamento) parts.push(t.acabamento);
      if (t.tipo_furo) parts.push(t.tipo_furo);
      if (t.und) parts.push(t.und);
      return parts.join("|");
    }).join("\n");

    // 2. ÚNICA chamada LLM: lê o arquivo + extrai produtos + casa com templates
    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analise o arquivo enviado (tabela de preços de equipamentos de fitness) e extraia todos os produtos com seus preços.
Para cada produto, case com o template mais similar do catálogo abaixo.

CATÁLOGO (id|codigo|nome|categoria|atributos):
${templateList}

Retorne JSON com produtos encontrados. Regras:
- Extraia TODOS os produtos com preço que encontrar
- preco: apenas números (45.90, não "R$ 45,90")
- template_id: ID exato do catálogo casado, ou null se não houver
- Use o código exato se houver match, senão compare nome/peso/acabamento/tipo`,
      file_urls: [file_url],
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          produtos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                descricao_original: { type: "string" },
                template_id: { type: "string" },
                preco: { type: "number" },
                motivo: { type: "string" }
              }
            }
          }
        }
      }
    });

    if (!llmResult.produtos || llmResult.produtos.length === 0) {
      return Response.json({ error: 'Nenhum produto encontrado no arquivo.' }, { status: 400 });
    }

    // 3. Processar resultados
    const toCreate = [];
    const toUpdate = [];
    const results = { created: [], updated: [], unmatched: [], divergencias: [] };

    for (const p of llmResult.produtos) {
      if (!p.preco || p.preco <= 0) {
        results.divergencias.push({ descricao: p.descricao_original || "?", motivo: "Produto sem preço" });
        results.unmatched.push({ descricao: p.descricao_original || "?", motivo: "Sem preço na tabela" });
        continue;
      }
      if (!p.template_id) {
        results.unmatched.push({ descricao: p.descricao_original || "?", motivo: p.motivo || "Sem template" });
        continue;
      }

      const tmpl = templates.find(t => t.id === p.template_id);
      if (!tmpl) {
        results.unmatched.push({ descricao: p.descricao_original || "?", motivo: "Template ID inválido" });
        continue;
      }

      const existing = existingByPid.get(p.template_id);
      const codOrigem = p.descricao_original || null;
      if (existing) {
        toUpdate.push({ id: existing.id, preco: p.preco, disponivel: true, ...(codOrigem ? { cod_origem: codOrigem } : {}) });
        results.updated.push({ descricao: p.descricao_original, template_nome: tmpl.nome, template_cod: tmpl.cod, preco: p.preco });
      } else {
        toCreate.push({ supplier_id: user.id, product_id: p.template_id, preco: p.preco, disponivel: true, ...(codOrigem ? { cod_origem: codOrigem } : {}) });
        results.created.push({ descricao: p.descricao_original, template_nome: tmpl.nome, template_cod: tmpl.cod, preco: p.preco });
      }
    }

    // 4. Operações em lote
    if (toCreate.length > 0) await base44.asServiceRole.entities.SupplierProduct.bulkCreate(toCreate);
    if (toUpdate.length > 0) await base44.asServiceRole.entities.SupplierProduct.bulkUpdate(toUpdate);

    return Response.json({
      success: true,
      total_extracted: llmResult.produtos.length,
      created: results.created.length,
      updated: results.updated.length,
      unmatched: results.unmatched.length,
      divergencias: results.divergencias.length,
      details: results
    });
  } catch (error) {
    console.error("Erro:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});