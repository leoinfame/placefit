import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    // 1. Buscar templates ativos e SupplierProducts existentes em paralelo (2 chamadas)
    const [templates, existingSps] = await Promise.all([
      base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }),
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id })
    ]);

    // Mapa de código -> template (normalizado)
    const templateByCod = new Map();
    const templateByNome = new Map();
    for (const t of templates) {
      const cod = (t.cod || "").toUpperCase().replace(/\s+/g, "");
      if (cod) templateByCod.set(cod, t);
      if (t.nome) templateByNome.set(t.nome.trim().toLowerCase(), t);
    }

    // Mapa de product_id -> SupplierProduct existente
    const existingByPid = new Map();
    for (const sp of existingSps) {
      existingByPid.set(sp.product_id, sp);
    }

    // 2. Extrair dados do arquivo (1 chamada)
    const extractResult = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          produtos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                descricao: { type: "string", description: "Nome ou descrição completa do produto" },
                codigo: { type: "string", description: "Código/SKU do produto se mencionado" },
                categoria: { type: "string", description: "Categoria do produto" },
                peso: { type: "string", description: "Peso mencionado" },
                acabamento: { type: "string", description: "Acabamento/material" },
                tipo_furo: { type: "string", description: "Tipo de furo" },
                preco: { type: "number", description: "Preço em R$ (apenas números)" }
              }
            }
          }
        }
      }
    });

    if (!extractResult.output || !extractResult.output.produtos || extractResult.output.produtos.length === 0) {
      return Response.json({ error: 'Nenhum produto encontrado no arquivo.' }, { status: 400 });
    }

    const produtosExtraidos = extractResult.output.produtos;

    // 3. Match direto por código e por nome (sem LLM)
    const toCreate = [];
    const toUpdate = [];
    const results = { created: [], updated: [], unmatched: [], divergencias: [] };
    const needLlm = [];

    for (let i = 0; i < produtosExtraidos.length; i++) {
      const p = produtosExtraidos[i];
      const codNorm = (p.codigo || "").trim().toUpperCase().replace(/\s+/g, "");

      let matched = null;
      if (codNorm) matched = templateByCod.get(codNorm);
      if (!matched && p.descricao) {
        matched = templateByNome.get(p.descricao.trim().toLowerCase());
      }

      if (matched && p.preco != null && p.preco > 0) {
        const existing = existingByPid.get(matched.id);
        if (existing) {
          toUpdate.push({ id: existing.id, preco: p.preco, disponivel: true });
          results.updated.push({ descricao: p.descricao || p.codigo, template_nome: matched.nome, template_cod: matched.cod, preco: p.preco });
        } else {
          toCreate.push({ supplier_id: user.id, product_id: matched.id, preco: p.preco, disponivel: true });
          results.created.push({ descricao: p.descricao || p.codigo, template_nome: matched.nome, template_cod: matched.cod, preco: p.preco });
        }
      } else {
        needLlm.push({ indice: i, produto: p });
      }
    }

    // 4. Operações em lote (máximo 2 chamadas, não 187+)
    if (toCreate.length > 0) {
      try { await base44.asServiceRole.entities.SupplierProduct.bulkCreate(toCreate); } catch (e) { console.error("bulkCreate:", e.message); }
    }
    if (toUpdate.length > 0) {
      try { await base44.asServiceRole.entities.SupplierProduct.bulkUpdate(toUpdate); } catch (e) { console.error("bulkUpdate:", e.message); }
    }

    // 5. LLM apenas para produtos não casados (se houver)
    if (needLlm.length > 0) {
      try {
        const llmMatches = await matchWithLlm(base44, templates, needLlm);
        const llmCreate = [];
        const llmUpdate = [];
        for (const match of llmMatches) {
          const produto = produtosExtraidos[match.indice];
          if (!match.template_id || !match.preco) {
            results.unmatched.push({ descricao: match.descricao_original || produto.descricao, motivo: match.motivo || 'Sem template' });
            continue;
          }
          const templateExists = templates.find((t) => t.id === match.template_id);
          if (!templateExists) {
            results.unmatched.push({ descricao: match.descricao_original || produto.descricao, motivo: 'Template ID inválido' });
            continue;
          }
          const existing = existingByPid.get(match.template_id);
          if (existing) {
            llmUpdate.push({ id: existing.id, preco: match.preco, disponivel: true });
            results.updated.push({ descricao: match.descricao_original, template_nome: templateExists.nome, template_cod: templateExists.cod, preco: match.preco });
          } else {
            llmCreate.push({ supplier_id: user.id, product_id: match.template_id, preco: match.preco, disponivel: true });
            results.created.push({ descricao: match.descricao_original, template_nome: templateExists.nome, template_cod: templateExists.cod, preco: match.preco });
          }
        }
        if (llmCreate.length > 0) {
          try { await base44.asServiceRole.entities.SupplierProduct.bulkCreate(llmCreate); } catch (e) { console.error("llm bulkCreate:", e.message); }
        }
        if (llmUpdate.length > 0) {
          try { await base44.asServiceRole.entities.SupplierProduct.bulkUpdate(llmUpdate); } catch (e) { console.error("llm bulkUpdate:", e.message); }
        }
      } catch (llmError) {
        console.error("Erro LLM:", llmError.message);
        for (const item of needLlm) {
          results.unmatched.push({ descricao: item.produto.descricao || item.produto.codigo, motivo: `Match IA indisponível: ${llmError.message}` });
        }
      }
    }

    // 6. Divergências
    for (const p of produtosExtraidos) {
      if (p.preco == null || p.preco <= 0) {
        results.divergencias.push({ descricao: p.descricao || p.codigo || "Sem descrição", motivo: "Produto sem preço na tabela" });
      }
    }

    return Response.json({
      success: true,
      total_extracted: produtosExtraidos.length,
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

async function matchWithLlm(base44, templates, needLlm) {
  const templateList = templates.map((t) => {
    const parts = [t.id, t.cod, t.nome, `cat:${t.categoria}`];
    if (t.subcategoria) parts.push(`sub:${t.subcategoria}`);
    if (t.acabamento && t.acabamento !== "N/A") parts.push(`acab:${t.acabamento}`);
    if (t.peso_kg) parts.push(`peso:${t.peso_kg}kg`);
    if (t.tipo_furo && t.tipo_furo !== "N/A") parts.push(`furo:${t.tipo_furo}`);
    if (t.und) parts.push(`und:${t.und}`);
    return parts.join(" | ");
  }).join("\n");

  const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Casa cada produto com o template correto.

CATÁLOGO:
${templateList}

PRODUTOS:
${needLlm.map((item) => `[${item.indice}] ${item.produto.descricao || ""} | cod:${item.produto.codigo || "?"} | cat:${item.produto.categoria || "?"} | preco:${item.produto.preco}`).join("\n")}

Retorne JSON: { "matches": [{ "indice": number, "descricao_original": string, "template_id": string ou null, "preco": number, "motivo": string }] }`,
    response_json_schema: {
      type: "object",
      properties: {
        matches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              indice: { type: "number" },
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

  return llmResult.matches || [];
}