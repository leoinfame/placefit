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

    const templateByCod = new Map();
    for (const t of templates) {
      const cod = (t.cod || "").trim().toUpperCase().replace(/\s+/g, "");
      if (cod) templateByCod.set(cod, t);
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

      const codigoLimpo = codigo.toUpperCase().replace(/\s+/g, "");
      const template = templateByCod.get(codigoLimpo);
      if (!template) {
        results.unmatched.push({ descricao: codigo, motivo: "Código não encontrado no catálogo" });
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