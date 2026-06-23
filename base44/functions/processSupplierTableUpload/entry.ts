import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    // 1. Buscar todos os templates ativos
    const templates = await base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true });

    // 2. Extrair dados do arquivo enviado
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
                descricao: { type: "string", description: "Nome ou descrição completa do produto exatamente como está na tabela" },
                codigo: { type: "string", description: "Código/SKU do produto se mencionado (ex: ANI-OLI-EMB-010)" },
                categoria: { type: "string", description: "Categoria do produto se mencionada" },
                peso: { type: "string", description: "Peso mencionado (ex: 10kg, 20kg, 1.25kg)" },
                acabamento: { type: "string", description: "Acabamento/material" },
                tipo_furo: { type: "string", description: "Tipo de furo se aplicável" },
                preco: { type: "number", description: "Preço em R$ (apenas números)" }
              }
            }
          }
        }
      }
    });

    if (!extractResult.output || !extractResult.output.produtos || extractResult.output.produtos.length === 0) {
      return Response.json({ error: 'Nenhum produto encontrado no arquivo. Verifique se o arquivo contém uma tabela de produtos com preços.' }, { status: 400 });
    }

    const produtosExtraidos = extractResult.output.produtos;

    // 3. Match direto por código (mais rápido e preciso)
    const results = { created: [], updated: [], unmatched: [], divergencias: [] };
    const needLlm = [];

    for (let i = 0; i < produtosExtraidos.length; i++) {
      const p = produtosExtraidos[i];
      const codRaw = (p.codigo || "").trim().toUpperCase();
      // Normalizar código: remover espaços e hifens extras
      const codNorm = codRaw.replace(/\s+/g, "");

      // Tentar match direto por código
      let matched = null;
      if (codNorm) {
        matched = templates.find((t) => {
          const tCod = (t.cod || "").toUpperCase().replace(/\s+/g, "");
          return tCod === codNorm || tCod.includes(codNorm) || codNorm.includes(tCod);
        });
      }

      // Tentar match por nome exato
      if (!matched && p.descricao) {
        const descNorm = p.descricao.trim().toLowerCase();
        matched = templates.find((t) => {
          const tNome = (t.nome || "").trim().toLowerCase();
          return tNome === descNorm;
        });
      }

      if (matched && p.preco != null && p.preco > 0) {
        // Inserir diretamente
        await upsertSupplierProduct(base44, user.id, matched, p.preco, results, p.descricao || p.codigo);
      } else {
        // Guardar para LLM
        needLlm.push({ indice: i, produto: p });
      }
    }

    // 4. Se sobraram produtos sem match direto, usar LLM
    if (needLlm.length > 0) {
      try {
        const llmMatches = await matchWithLlm(base44, templates, needLlm);
        for (const match of llmMatches) {
          const produto = produtosExtraidos[match.indice];
          if (!match.template_id || !match.preco) {
            results.unmatched.push({ descricao: match.descricao_original || produto.descricao, motivo: match.motivo || 'Sem template correspondente' });
            continue;
          }
          const templateExists = templates.find((t) => t.id === match.template_id);
          if (!templateExists) {
            results.unmatched.push({ descricao: match.descricao_original || produto.descricao, motivo: 'Template ID inválido' });
            continue;
          }
          await upsertSupplierProduct(base44, user.id, templateExists, match.preco, results, match.descricao_original || produto.descricao);
        }
      } catch (llmError) {
        // Se o LLM falhar, os produtos sem match direto ficam como unmatched mas não quebra
        console.error("Erro no LLM:", llmError.message);
        for (const item of needLlm) {
          results.unmatched.push({
            descricao: item.produto.descricao || item.produto.codigo || `Produto ${item.indice + 1}`,
            motivo: `Match por IA indisponível: ${llmError.message}`
          });
        }
      }
    }

    // 5. Apontar divergências (produtos sem preço, etc)
    for (const p of produtosExtraidos) {
      if (p.preco == null || p.preco <= 0) {
        results.divergencias.push({
          descricao: p.descricao || p.codigo || "Produto sem descrição",
          motivo: "Produto sem preço na tabela"
        });
      }
    }

    return Response.json({
      success: true,
      total_extracted: produtosExtraidos.length,
      direct_matches: produtosExtraidos.length - needLlm.length,
      llm_matches: needLlm.length,
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

async function upsertSupplierProduct(base44, userId, template, preco, results, descricaoOriginal) {
  try {
    const existing = await base44.asServiceRole.entities.SupplierProduct.filter({
      supplier_id: userId,
      product_id: template.id
    });

    if (existing.length > 0) {
      await base44.asServiceRole.entities.SupplierProduct.update(existing[0].id, {
        preco: preco,
        disponivel: true
      });
      results.updated.push({
        descricao: descricaoOriginal,
        template_nome: template.nome,
        template_cod: template.cod,
        preco: preco
      });
    } else {
      await base44.asServiceRole.entities.SupplierProduct.create({
        supplier_id: userId,
        product_id: template.id,
        preco: preco,
        disponivel: true
      });
      results.created.push({
        descricao: descricaoOriginal,
        template_nome: template.nome,
        template_cod: template.cod,
        preco: preco
      });
    }
  } catch (e) {
    results.unmatched.push({
      descricao: descricaoOriginal,
      motivo: `Erro ao salvar: ${e.message}`
    });
  }
}

async function matchWithLlm(base44, templates, needLlm) {
  const templateList = templates.map((t) => {
    const parts = [t.id, t.cod, t.nome, `cat:${t.categoria}`];
    if (t.subcategoria) parts.push(`sub:${t.subcategoria}`);
    if (t.acabamento && t.acabamento !== "N/A") parts.push(`acab:${t.acabamento}`);
    if (t.peso_kg) parts.push(`peso:${t.peso_kg}kg`);
    if (t.tipo_furo && t.tipo_furo !== "N/A") parts.push(`furo:${t.tipo_furo}`);
    if (t.bojo_formato && t.bojo_formato !== "N/A") parts.push(`bojo:${t.bojo_formato}`);
    if (t.barra_tipo && t.barra_tipo !== "N/A") parts.push(`barra:${t.barra_tipo}`);
    if (t.dumbell_tipo && t.dumbell_tipo !== "N/A") parts.push(`dumbell:${t.dumbell_tipo}`);
    if (t.piso_espessura_mm) parts.push(`esp:${t.piso_espessura_mm}mm`);
    if (t.und) parts.push(`und:${t.und}`);
    return parts.join(" | ");
  });

  const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Você é um especialista em equipamentos de academia. Casa cada produto com o ProductTemplate correto.

CATÁLOGO (id | cod | nome | atributos):
${templateList.join("\n")}

PRODUTOS PARA CASAR:
${needLlm.map((item) => `[${item.indice}] ${item.produto.descricao || ""} | cod:${item.produto.codigo || "?"} | cat:${item.produto.categoria || "?"} | peso:${item.produto.peso || "?"} | acab:${item.produto.acabamento || "?"} | furo:${item.produto.tipo_furo || "?"} | preco:${item.produto.preco}`).join("\n")}

REGRAS:
- Casar cada produto ao template cujos atributos sejam compatíveis.
- Se não houver correspondência exata, use template_id null.
- Retorne o preco exatamente como veio.

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