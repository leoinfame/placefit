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
                categoria: { type: "string", description: "Categoria do produto se mencionada (Anilhas, Halteres, Dumbells, Barras, Kettlebells, Pisos, Tijolinhos, Suportes)" },
                peso: { type: "string", description: "Peso mencionado (ex: 10kg, 20kg, 1.25kg)" },
                acabamento: { type: "string", description: "Acabamento/material (ex: emborrachado, pintado, bumper, cromado, bruto, injetado)" },
                tipo_furo: { type: "string", description: "Tipo de furo se aplicável (olímpico/50mm ou normal/pequeno)" },
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

    // 3. Construir lista compacta de templates para o LLM
    const templateList = templates.map((t) => {
      const parts = [t.cod, t.nome, `cat:${t.categoria}`];
      if (t.subcategoria) parts.push(`sub:${t.subcategoria}`);
      if (t.acabamento && t.acabamento !== "N/A") parts.push(`acab:${t.acabamento}`);
      if (t.peso_kg) parts.push(`peso:${t.peso_kg}kg`);
      if (t.tipo_furo && t.tipo_furo !== "N/A") parts.push(`furo:${t.tipo_furo}`);
      if (t.bojo_formato && t.bojo_formato !== "N/A") parts.push(`bojo:${t.bojo_formato}`);
      if (t.barra_tipo && t.barra_tipo !== "N/A") parts.push(`barra:${t.barra_tipo}`);
      if (t.barra_acabamento && t.barra_acabamento !== "N/A") parts.push(`barra_acab:${t.barra_acabamento}`);
      if (t.dumbell_tipo && t.dumbell_tipo !== "N/A") parts.push(`dumbell:${t.dumbell_tipo}`);
      if (t.piso_espessura_mm) parts.push(`esp:${t.piso_espessura_mm}mm`);
      if (t.piso_formato && t.piso_formato !== "N/A") parts.push(`piso_fmt:${t.piso_formato}`);
      if (t.tijolinho_tipo && t.tijolinho_tipo !== "N/A") parts.push(`tijolinho:${t.tijolinho_tipo}`);
      if (t.tijolinho_torre && t.tijolinho_torre !== "N/A") parts.push(`torre:${t.tijolinho_torre}`);
      if (t.suporte_capacidade_pares) parts.push(`pares:${t.suporte_capacidade_pares}`);
      if (t.suporte_capacidade_unidades) parts.push(`unid:${t.suporte_capacidade_unidades}`);
      if (t.suporte_modelo && t.suporte_modelo !== "N/A") parts.push(`mod:${t.suporte_modelo}`);
      if (t.suporte_estrutura && t.suporte_estrutura !== "N/A") parts.push(`estr:${t.suporte_estrutura}`);
      if (t.suporte_degraus) parts.push(`degraus:${t.suporte_degraus}`);
      if (t.und) parts.push(`und:${t.und}`);
      return { id: t.id, txt: parts.join(" | ") };
    });

    // 4. Usar LLM para fazer o match de cada produto com o template correto
    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Você é um especialista em equipamentos de academia/fitness. Sua tarefa é casar (match) cada produto da tabela do fornecedor com o ProductTemplate correto do catálogo padronizado.

CATÁLOGO DE TEMPLATES DISPONÍVEIS (id | descrição com atributos):
${templateList.map((t) => `${t.id} => ${t.txt}`).join("\n")}

PRODUTOS DA TABELA DO FORNECEDOR:
${produtosExtraidos.map((p, i) => `[${i}] ${p.descricao} | cat:${p.categoria || "?"} | peso:${p.peso || "?"} | acab:${p.acabamento || "?"} | furo:${p.tipo_furo || "?"} | preco:${p.preco}`).join("\n")}

REGRAS DE MATCH:
- Casar cada produto ao template cuja categoria, peso, acabamento, tipo de furo e outros atributos sejam compatíveis.
- "Bumper" = acabamento Bumper. "Olímpico" ou "50mm" = tipo_furo Olímpico (Furo 50mm). "Hexagonal" = bojo_formato Sextavado.
- Se o produto da tabela não tiver correspondência exata (ex: peso não existe no catálogo), use template_id null.
- Retorne o preco exatamente como veio (número).

Retorne um JSON com array "matches", cada item: { indice, descricao_original, template_id (ou null), preco, motivo }`,
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

    // 5. Criar/atualizar SupplierProduct records
    const results = { created: [], updated: [], unmatched: [] };

    for (const match of llmResult.matches) {
      if (!match.template_id || !match.preco) {
        results.unmatched.push({ descricao: match.descricao_original, motivo: match.motivo || 'Sem template correspondente' });
        continue;
      }

      // Verificar se template existe
      const templateExists = templates.find((t) => t.id === match.template_id);
      if (!templateExists) {
        results.unmatched.push({ descricao: match.descricao_original, motivo: 'Template ID inválido' });
        continue;
      }

      // Verificar se já existe SupplierProduct
      const existing = await base44.asServiceRole.entities.SupplierProduct.filter({
        supplier_id: user.id,
        product_id: match.template_id
      });

      if (existing.length > 0) {
        await base44.asServiceRole.entities.SupplierProduct.update(existing[0].id, {
          preco: match.preco,
          disponivel: true
        });
        results.updated.push({
          descricao: match.descricao_original,
          template_nome: templateExists.nome,
          preco: match.preco
        });
      } else {
        await base44.asServiceRole.entities.SupplierProduct.create({
          supplier_id: user.id,
          product_id: match.template_id,
          preco: match.preco,
          disponivel: true
        });
        results.created.push({
          descricao: match.descricao_original,
          template_nome: templateExists.nome,
          preco: match.preco
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