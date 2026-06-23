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

    // 2. Extrair dados do CSV enviado
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
                codigo: { type: "string", description: "Código/SKU do produto no catálogo padronizado (ex: ANI-OLI-EMB-010)" },
                preco: { type: "number", description: "Preço em R$ (apenas números)" },
                disponivel: { type: "string", description: "SIM ou NÃO (padrão: SIM)" }
              }
            }
          }
        }
      }
    });

    if (!extractResult.output || !extractResult.output.produtos || extractResult.output.produtos.length === 0) {
      return Response.json({ error: 'Nenhum produto encontrado no CSV. Verifique se o arquivo contém as colunas codigo e preco.' }, { status: 400 });
    }

    const produtosExtraidos = extractResult.output.produtos;
    const results = { created: [], updated: [], unmatched: [] };

    // 3. Para cada produto, buscar template por código (match exato, case-insensitive)
    for (const prod of produtosExtraidos) {
      if (!prod.codigo || !prod.preco) {
        results.unmatched.push({ descricao: prod.codigo || '(sem código)', motivo: 'Código ou preço ausente' });
        continue;
      }

      const codigoLimpo = String(prod.codigo).trim().toUpperCase();
      const template = templates.find((t) => (t.cod || '').trim().toUpperCase() === codigoLimpo);

      if (!template) {
        results.unmatched.push({ descricao: prod.codigo, motivo: 'Código não encontrado no catálogo padronizado' });
        continue;
      }

      const disponivel = prod.disponivel ? String(prod.disponivel).trim().toUpperCase() !== 'NÃO' : true;

      // Verificar se já existe SupplierProduct
      const existing = await base44.asServiceRole.entities.SupplierProduct.filter({
        supplier_id: user.id,
        product_id: template.id
      });

      if (existing.length > 0) {
        await base44.asServiceRole.entities.SupplierProduct.update(existing[0].id, {
          preco: prod.preco,
          disponivel
        });
        results.updated.push({
          codigo: prod.codigo,
          template_nome: template.nome,
          preco: prod.preco
        });
      } else {
        await base44.asServiceRole.entities.SupplierProduct.create({
          supplier_id: user.id,
          product_id: template.id,
          preco: prod.preco,
          disponivel
        });
        results.created.push({
          codigo: prod.codigo,
          template_nome: template.nome,
          preco: prod.preco
        });
      }
    }

    return Response.json({
      success: true,
      total_extracted: produtosExtraidos.length,
      created: results.created.length,
      updated: results.updated.length,
      unmatched: results.unmatched.length,
      details: results
    });
  } catch (error) {
    console.error("Erro:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});