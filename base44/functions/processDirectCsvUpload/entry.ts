import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });

    // 1. Buscar templates e SupplierProducts em paralelo
    const [templates, existingSps] = await Promise.all([
      base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }),
      base44.asServiceRole.entities.SupplierProduct.filter({ supplier_id: user.id })
    ]);

    // Normalização: remove tudo que não é alfanumérico (hífens, espaços, pontos, etc.)
    const normalizeCod = (cod) => (cod || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    const templateByCod = new Map();
    for (const t of templates) {
      const cod = normalizeCod(t.cod);
      if (cod) templateByCod.set(cod, t);
    }

    // Normalização de nome para matching fallback
    const normalizeName = (name) => {
      let n = (name || "").trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ").trim();
      // Normalizar variações comuns de grafia
      n = n
        .replace(/\bbamper\b/g, "bumper")
        .replace(/\bhalt\b/g, "halter")
        .replace(/\bdumbel\b/g, "dumbbell")
        .replace(/\bdumbel[l]?\s*$/g, "dumbbell")
        .replace(/\bkettle\b\s*bells?\b/g, "kettlebell")
        .replace(/\bkettle\s*$/g, "kettlebell")
        .replace(/\btorre\b/g, "torre");
      return n;
    };

    const getTokens = (name) => {
      const norm = normalizeName(name);
      return norm.split(" ").filter(w => w.length > 1); // ignora palavras de 1 char
    };

    const normalizeNameTokens = (name) => {
      const tokens = getTokens(name);
      return tokens.sort().join(" ");
    };

    // Distância de Levenshtein simplificada para matching fuzzy
    const levenshtein = (a, b) => {
      if (a === b) return 0;
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          const cost = a[j - 1] === b[i - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }
      return matrix[b.length][a.length];
    };

    // Dois tokens são "similares" se: exatamente iguais, OU ambos >=4 chars com distância <=2
    const tokensSimilar = (a, b) => {
      if (a === b) return true;
      // Números devem bater exatamente (pesos como "2kg", "20kg")
      if (/^\d/.test(a) || /^\d/.test(b)) return a === b;
      // Palavras curtas devem bater exatamente
      if (a.length < 4 || b.length < 4) return a === b;
      // Palavras longas: tolera até 2 chars de diferença (ex: bumper/bamper, olimpica/olimpica)
      const dist = levenshtein(a, b);
      return dist <= 2;
    };

    // Score de similaridade entre dois conjuntos de tokens (0 a 1)
    const scoreTokens = (csvTokens, tmplTokens) => {
      if (csvTokens.length === 0 || tmplTokens.length === 0) return 0;
      let matches = 0;
      const used = new Set();
      for (const ct of csvTokens) {
        for (let i = 0; i < tmplTokens.length; i++) {
          if (used.has(i)) continue;
          if (tokensSimilar(ct, tmplTokens[i])) {
            matches++;
            used.add(i);
            break;
          }
        }
      }
      // Score = fração de tokens do CSV que encontraram par no template
      return matches / Math.max(csvTokens.length, tmplTokens.length);
    };

    // Pré-computa tokens dos templates para matching fuzzy
    const templateTokenList = templates.map(t => ({
      t,
      tokens: getTokens(t.nome),
    }));

    // Mapa por tokens de nome (palavras ordenadas) — tolera ordem diferente das palavras
    const templateByTokens = new Map();
    // Mapa por nome normalizado sem palavras de acabamento (bruto/pintado)
    const templateByCleanTokens = new Map();
    for (const t of templates) {
      const tokens = normalizeNameTokens(t.nome);
      if (tokens) templateByTokens.set(tokens, t);
      const cleanTokens = normalizeNameTokens(
        (t.nome || "").replace(/\bbruto\b/gi, "").replace(/\bpintado\b/gi, "")
      );
      if (cleanTokens && cleanTokens !== tokens) templateByCleanTokens.set(cleanTokens, t);
    }

    const existingByPid = new Map();
    for (const sp of existingSps) existingByPid.set(sp.product_id, sp);

    // 2. Buscar e fazer parse do CSV diretamente (sem IA)
    const csvRes = await fetch(file_url);
    if (!csvRes.ok) return Response.json({ error: 'Não foi possível baixar o arquivo.' }, { status: 400 });
    const csvText = await csvRes.text();

    // Parse CSV com detecção automática de delimitador (ponto e vírgula Excel BR, vírgula ou tab)
    const parseCsv = (text) => {
      // Remover BOM comum em exports do Excel
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

      const firstLine = text.split(/\r?\n/)[0] || "";
      let delimiter = ',';
      const semis = (firstLine.match(/;/g) || []).length;
      const commas = (firstLine.match(/,/g) || []).length;
      const tabs = (firstLine.match(/\t/g) || []).length;
      if (semis >= commas && semis >= tabs && semis > 0) delimiter = ';';
      else if (tabs > commas && tabs > 0) delimiter = '\t';

      const rows = [];
      let current = [];
      let field = "";
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
          if (ch === '"') {
            if (text[i + 1] === '"') { field += '"'; i++; }
            else inQuotes = false;
          } else field += ch;
        } else {
          if (ch === '"') inQuotes = true;
          else if (ch === delimiter) { current.push(field); field = ""; }
          else if (ch === '\n' || ch === '\r') {
            if (field || current.length > 0) { current.push(field); rows.push(current); current = []; field = ""; }
            if (ch === '\r' && text[i + 1] === '\n') i++;
          } else field += ch;
        }
      }
      if (field || current.length > 0) { current.push(field); rows.push(current); }
      return rows;
    };

    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      return Response.json({ error: 'CSV vazio ou sem dados.' }, { status: 400 });
    }

    // 3. Mapear cabeçalho (normaliza acentos e aceita variações comuns)
    const headers = rows[0].map(h => h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const idxCodigo = headers.findIndex(h => h === "codigo" || h === "sku" || h === "cod");
    const idxNome = headers.findIndex(h => h === "nome" || h === "produto" || h === "descricao" || h === "descricao_produto");
    const idxPreco = headers.findIndex(h => h === "preco" || h === "valor" || h === "preco_unitario");
    const idxDisponivel = headers.findIndex(h => h === "disponivel" || h === "disp" || h === "estoque");

    if (idxCodigo === -1) {
      return Response.json({ error: 'Coluna "codigo" não encontrada no CSV.' }, { status: 400 });
    }

    // 4. Processar linhas
    const parsePreco = (val) => {
      if (!val) return null;
      let s = String(val).replace(/[R$\s]/g, "").trim();
      if (s === "") return null;
      // Se tem vírgula: formato BR (vírgula = decimal, ponto = milhares)
      if (s.includes(",")) {
        s = s.replace(/\./g, "").replace(",", ".");
      }
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    const toCreate = [];
    const toUpdate = [];
    const results = { created: [], updated: [], unmatched: [], divergencias: [] };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const codigo = (row[idxCodigo] || "").trim();
      if (!codigo) continue;

      const preco = idxPreco !== -1 ? parsePreco(row[idxPreco]) : null;
      if (preco === null || preco <= 0) {
        results.divergencias.push({ descricao: codigo, motivo: "Sem preço preenchido no CSV" });
        results.unmatched.push({ descricao: codigo, motivo: "Sem preço no CSV" });
        continue;
      }

      const codigoLimpo = normalizeCod(codigo);
      let template = templateByCod.get(codigoLimpo);

      // Fallback: matching por nome quando SKU não bate
      if (!template && idxNome !== -1) {
        const nome = (row[idxNome] || "").trim();
        if (nome) {
          // 1) tokens ordenados exatos
          let tokens = normalizeNameTokens(nome);
          template = templateByTokens.get(tokens);

          // 2) remover palavras de acabamento (bruto/pintado) que alguns templates não têm
          if (!template) {
            const cleaned = normalizeNameTokens(
              nome.replace(/\bbruto\b/gi, "").replace(/\bpintado\b/gi, "")
            );
            template = templateByCleanTokens.get(cleaned) || templateByTokens.get(cleaned);
          }

          // 3) Matching fuzzy por score de similaridade de tokens
          if (!template) {
            const csvTokens = getTokens(nome);
            let bestScore = 0;
            let bestTemplate = null;
            for (const { t, tokens: tmplTokens } of templateTokenList) {
              const score = scoreTokens(csvTokens, tmplTokens);
              if (score > bestScore) {
                bestScore = score;
                bestTemplate = t;
              }
            }
            // Aceita apenas se a similaridade for alta (>= 70%)
            if (bestScore >= 0.7) {
              template = bestTemplate;
            }
          }
        }
      }

      if (!template) {
        results.unmatched.push({ descricao: codigo + (idxNome !== -1 && row[idxNome] ? ` (${row[idxNome]})` : ""), motivo: "SKU e nome não encontrados no catálogo" });
        continue;
      }

      const disponivel = idxDisponivel !== -1 && row[idxDisponivel]
        ? String(row[idxDisponivel]).trim().toUpperCase() !== "NÃO"
        : true;

      const existing = existingByPid.get(template.id);
      if (existing) {
        toUpdate.push({ id: existing.id, preco, disponivel });
        results.updated.push({ codigo, template_nome: template.nome, preco });
      } else {
        toCreate.push({ supplier_id: user.id, product_id: template.id, preco, disponivel });
        results.created.push({ codigo, template_nome: template.nome, preco });
      }
    }

    // 5. Operações em lote
    if (toCreate.length > 0) {
      try { await base44.asServiceRole.entities.SupplierProduct.bulkCreate(toCreate); } catch (e) { console.error("bulkCreate:", e.message); }
    }
    if (toUpdate.length > 0) {
      try { await base44.asServiceRole.entities.SupplierProduct.bulkUpdate(toUpdate); } catch (e) { console.error("bulkUpdate:", e.message); }
    }

    return Response.json({
      success: true,
      total_extracted: rows.length - 1,
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