// Gerador da tabela de precos no MODELO NOVO da revenda (agrupada por variacoes, com logo e cores).
// Extraido de FabricantesRevendedor.jsx (item 008, 16/10/2026) para ser usado tambem no admin (Fabricantes).
import { getProdutosData } from "@/functions/getProdutosData";
import { expandTemplates } from "@/utils/expandTemplates";

const normalizeName = (s) => (s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\w\s]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const GROUP_FIELDS = [
  "categoria", "subcategoria", "tipo_anilha", "tipo_furo", "acabamento",
  "barra_formato", "barra_acabamento", "presilha_tipo", "comprimento_m",
  "barra_rolamento", "bojo_formato", "dumbell_tipo",
  "piso_espessura_mm", "piso_formato", "tijolinho_tipo", "tijolinho_torre",
  "suporte_modelo", "suporte_estrutura", "suporte_degraus",
  "suporte_capacidade_pares", "suporte_capacidade_unidades",
  "suporte_torre_capacidade", "suporte_torre_tipo",
  "pegada", "peso_faixa"
];

const WEIGHT_TOKEN_RE = /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*kg(?![\p{L}\p{N}])/giu;

const extractWeightFromName = (nome) => {
  const m = (nome || "").match(WEIGHT_TOKEN_RE);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/kg/i, "").replace(",", ".").trim());
  return isNaN(n) ? null : n;
};

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG"];
const SIZE_CANONICAL = {
  PP: "PP", P: "P", M: "M", G: "G", GG: "GG", XG: "XG",
  PEQUENO: "P", MEDIO: "M", GRANDE: "G",
};
const normSizeKey = (k) => k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const SIZE_PAREN_RE = /\((PP|XG|GG|P|M|G)\)|\((PP|XG|GG|P|M|G)(?=\s*$)/gi;
const SIZE_LETTER_RE = /(?<![\p{L}\p{N}])(PP|XG|GG|P|M|G)(?![\p{L}\p{N}])/giu;
const SIZE_WORD_RE = /(?<![\p{L}\p{N}])(Pequeno|Médio|Medio|Grande)(?![\p{L}\p{N}])/giu;

const extractSizesFromName = (nome) => {
  const s = nome || "";
  const found = new Set();
  for (const m of s.matchAll(SIZE_PAREN_RE)) {
    const key = m[1] || m[2];
    if (key) found.add(SIZE_CANONICAL[normSizeKey(key)]);
  }
  for (const m of s.matchAll(SIZE_LETTER_RE)) {
    found.add(SIZE_CANONICAL[normSizeKey(m[1])]);
  }
  for (const m of s.matchAll(SIZE_WORD_RE)) {
    found.add(SIZE_CANONICAL[normSizeKey(m[1])]);
  }
  return [...found];
};

const getBaseName = (tmpl) => {
  let nome = (tmpl.nome || "");
  nome = nome.replace(WEIGHT_TOKEN_RE, " ");
  nome = nome.replace(/\((PP|XG|GG|P|M|G)\)/gi, " ");
  nome = nome.replace(/\((PP|XG|GG|P|M|G)(?=\s*$)/gi, " ");
  nome = nome.replace(SIZE_LETTER_RE, " ");
  nome = nome.replace(SIZE_WORD_RE, " ");
  nome = nome.replace(/\s+/g, " ").trim();
  nome = nome.replace(/^[,()/\\-]+|[,()/\\-]+$/g, "").trim();
  return nome;
};

const getGroupKey = (tmpl) => getBaseName(tmpl).toLowerCase() + "|" + GROUP_FIELDS.map(f => tmpl[f] ?? "").join("|");

const DIM_RE = /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?(?:\s*[xX×]\s*\d+(?:[.,]\d+)?){1,2}(?:\s*(?:mm|cm|m|mts?))?(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:mm|cm|mts?|metros?|m|pol)(?![\p{L}\p{N}])/giu;
const TBL_SKIP = ["piso_espessura_mm", "piso_formato", "comprimento_m", "peso_faixa"];
const tblBase = (tmpl) => getBaseName(tmpl).replace(DIM_RE, " ").replace(/\bmodular\b/gi, " ").replace(/^(colchonete\b.*?)\s*&\s*Cia\b/i, "$1").replace(/\s+/g, " ").replace(/^[,()/\\-]+|[,()/\\-]+$/g, "").trim();
const tblKey = (tmpl) => tblBase(tmpl).toLowerCase() + "|" + GROUP_FIELDS.filter(f => !TBL_SKIP.includes(f)).map(f => tmpl[f] ?? "").join("|");
const tblDims = (tmpl) => ((tmpl.nome || "").match(DIM_RE) || []).map(x => x.replace(/\s+/g, "")).join(" ");

const extractLogoColors = (logoUrl) => {
  return new Promise((resolve) => {
    if (!logoUrl) { resolve(null); return; }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const colorMap = {};
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if (a < 128) continue;
          const brightness = (r + g + b) / 3;
          if (brightness > 240 || brightness < 20) continue;
          const key = `${Math.round(r/20)*20},${Math.round(g/20)*20},${Math.round(b/20)*20}`;
          colorMap[key] = (colorMap[key] || 0) + 1;
        }
        const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) { resolve(null); return; }
        const [r1, g1, b1] = sorted[0][0].split(',').map(Number);
        const toHex = (r, g, b) => `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
        const darken = (r, g, b, f=0.6) => toHex(Math.round(r*f), Math.round(g*f), Math.round(b*f));
        const lighten = (r, g, b, f=0.9) => toHex(Math.round(255-(255-r)*f), Math.round(255-(255-g)*f), Math.round(255-(255-b)*f));
        resolve({
          primary: toHex(r1, g1, b1),
          primaryDark: darken(r1, g1, b1),
          secondary: toHex(r1, g1, b1),
          light: lighten(r1, g1, b1),
          lightBorder: lighten(r1, g1, b1, 0.6),
          textOnPrimary: '#ffffff',
          textAccent: darken(r1, g1, b1, 0.7),
        });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
};

// Converte imagem URL -> base64 data URL para embed no HTML de impressão
const fetchImageAsDataURL = async (url) => {
  if (!url) return null;
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
};

export async function gerarTabelaRevenda(fabricante, { toast = () => {}, setDownloadingTable = () => {} } = {}) {
  setDownloadingTable(fabricante.id);
  try {
    // Mesma fonte do catálogo (getProdutosData): templates com preço deste fabricante
    const res = await getProdutosData({ mode: "catalogo" });
    const data = res.data || res;
    const templatesAll = expandTemplates(data.templates || [], data.fieldMap);
    const pricesByProduct = data.pricesByProduct || {};
    const fabNomeBusca = fabricante.nome_fantasia || fabricante.razao_social || fabricante.empresa || fabricante.full_name;
    const fabNormBusca = normalizeName(fabNomeBusca);
    const fabricanteProducts = [];
    for (const tmpl of templatesAll) {
      const precos = (pricesByProduct[tmpl.id] || []).filter(p => {
        const pNorm = normalizeName(p && p.fabricante_nome);
        if (!fabNormBusca || !pNorm) return false;
        return fabNormBusca.includes(pNorm) || pNorm.includes(fabNormBusca);
      }).map(p => Number(p.preco_origem)).filter(n => n > 0);
      if (precos.length === 0) continue;
      fabricanteProducts.push({
        _key: tblKey(tmpl),
        _base: tblBase(tmpl),
        _dims: tblDims(tmpl),
        _sizes: extractSizesFromName(tmpl.nome),
        cod: tmpl.cod,
        nome: tmpl.nome,
        categoria: tmpl.categoria || 'Outros',
        peso: tmpl.peso_kg != null ? tmpl.peso_kg : extractWeightFromName(tmpl.nome),
        und: tmpl.und,
        foto: tmpl.foto && !tmpl.foto.includes("placefit.com.br/produtos") ? tmpl.foto : null,
        preco: Math.min(...precos),
      });
    }
    fabricanteProducts.sort((x, y) => (x.nome || '').localeCompare(y.nome || '', 'pt-BR', { numeric: true }));

    if (fabricanteProducts.length === 0) {
      toast({ title: "Sem produtos", description: "Este fabricante não possui produtos com preço no catálogo." });
      setDownloadingTable(null);
      return;
    }

    // Agrupar variações (peso/tamanho) de um mesmo produto: 1 produto + chips
    const gmap = new Map();
    for (const it of fabricanteProducts) {
      if (!gmap.has(it._key)) {
        gmap.set(it._key, { nome: it._base || it.nome, categoria: it.categoria, foto: null, und: it.und, cods: [], variants: [] });
      }
      const g = gmap.get(it._key);
      if (!g.foto && it.foto) g.foto = it.foto;
      g.cods.push(it.cod);
      const wl = it.peso != null ? String(it.peso).replace('.', ',') + 'kg' : (it._sizes && it._sizes.length ? it._sizes.join('/') : '');
      const label = it._dims ? it._dims : wl;
      g.variants.push({ label, peso: it.peso, size: it._sizes && it._sizes.length ? SIZE_ORDER.indexOf(it._sizes[0]) : 99, preco: it.preco, cod: it.cod, nome: it.nome });
    }
    const grupos = [...gmap.values()];
    for (const g of grupos) {
      g.variants.sort((a, b) => (a.peso != null && b.peso != null) ? a.peso - b.peso : a.size - b.size);
      if (g.variants.length === 1 && !g.variants[0].label) g.nome = g.variants[0].nome;
    }
    grupos.sort((x, y) => (x.nome || '').localeCompare(y.nome || '', 'pt-BR', { numeric: true }));

    // Embedar imagens (logo + fotos) como base64 para garantir exibição no PDF
    const imgUrls = new Set();
    if (fabricante.logomarca) imgUrls.add(fabricante.logomarca);
    for (const g of grupos) {
      if (g.foto) imgUrls.add(g.foto);
    }
    const imgMap = {};
    await Promise.all([...imgUrls].map(async (url) => {
      const dataUrl = await fetchImageAsDataURL(url);
      imgMap[url] = dataUrl || url;
    }));
    const getImg = (url) => imgMap[url] || url || '';

    // Extrair cores da logo (usar base64 se disponível para evitar CORS no canvas)
    const logoForColors = imgMap[fabricante.logomarca] || fabricante.logomarca;
    const logoColors = await extractLogoColors(logoForColors);
    const c = logoColors || {
      primary: '#1e3a5f', primaryDark: '#0f172a', secondary: '#1e40af',
      light: '#eff6ff', lightBorder: '#bfdbfe', textOnPrimary: '#ffffff', textAccent: '#1e40af'
    };

    const nomeEmpresa = fabricante.empresa || fabricante.full_name;
    const dataGeracao = new Date().toLocaleDateString('pt-BR');

    // Agrupar por categoria
    const categorias = {};
    grupos.forEach(p => {
      const cat = p.categoria || 'Outros';
      if (!categorias[cat]) categorias[cat] = [];
      categorias[cat].push(p);
    });

    const categoryIcons = {
      'Cardiovascular': '🏃', 'Musculação': '💪', 'Funcional': '🤸',
      'Acessórios': '🎯', 'Anilhas': '🏋️', 'Halteres': '🏋️',
      'Barras': '📊', 'Suportes': '🔧', 'Caneleiras': '🦵',
      'Tornozeleiras': '🦵', 'Cabos': '🔗', 'Complemento': '➕', 'Outros': '📦',
    };

    const ordemCats = ['Anilhas', 'Halteres', 'Dumbbells', 'Kettlebells', 'Tijolinhos', 'Pisos', 'Kits'];
    const catsOrdenadas = Object.keys(categorias).sort((x, y) => {
      const ix = ordemCats.indexOf(x), iy = ordemCats.indexOf(y);
      if (ix !== -1 && iy !== -1) return ix - iy;
      if (ix !== -1) return -1;
      if (iy !== -1) return 1;
      return x.localeCompare(y, 'pt-BR');
    });
    const fmtPreco = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Tabela densa B2B: 1 linha por produto, variações como chips na mesma linha
    const categoriasBlocos = catsOrdenadas.map((cat) => {
      const itens = categorias[cat];
      const icon = categoryIcons[cat] || '📦';
      // Linha separadora de categoria (colspan 5)
      let rows = `<tr><td colspan="5" style="background:${c.light};padding:3px 5px;border-bottom:1px solid ${c.lightBorder};">
        <span style="font-size:9pt;">${icon}</span>
        <span style="font-size:8pt;font-weight:700;color:${c.primaryDark};letter-spacing:0.5px;text-transform:uppercase;margin-left:3px;">${cat}</span>
        <span style="font-size:7pt;color:#64748b;font-weight:400;margin-left:4px;">${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</span>
      </td></tr>`;
      // Linhas de produto: foto miniatura | nome | variações (chips com preço) | und | a partir de
      for (const g of itens) {
        const precos = g.variants.map(v => v.preco);
        const mesmoPreco = precos.every(p => p === precos[0]);
        const temChips = g.variants.length > 1 || (g.variants[0] && g.variants[0].label);
        const fotoHtml = g.foto
          ? `<img src="${getImg(g.foto)}" alt="" style="width:24px;height:24px;object-fit:contain;background:#fff;border-radius:3px;border:1px solid #e2e8f0;">`
          : `<div style="width:24px;height:24px;border-radius:3px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:10px;">📦</div>`;
        const chips = temChips
          ? g.variants.map(v => `<span style="display:inline-block;font-size:7pt;color:#475569;background:#eff6ff;border:1px solid #dbeafe;padding:0 3px;border-radius:6px;margin:0 2px 1px 0;white-space:nowrap;line-height:1.5;">${v.label || v.cod}${mesmoPreco ? '' : ' · ' + fmtPreco(v.preco)}</span>`).join('')
          : `<span style="font-size:7pt;color:#94a3b8;">—</span>`;
        const precoTxt = mesmoPreco ? fmtPreco(precos[0]) : 'a partir de ' + fmtPreco(Math.min(...precos));
        const codTxt = g.cods.length > 1 ? g.cods[0] + '…' : g.cods[0];
        rows += `<tr>
          <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:center;">${fotoHtml}</td>
          <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;">
            <div style="font-size:8pt;font-weight:600;color:#1e293b;line-height:1.2;">${g.nome}</div>
            ${codTxt ? `<div style="font-size:6pt;font-family:monospace;color:#94a3b8;">${codTxt}</div>` : ''}
          </td>
          <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;line-height:1.6;">${chips}</td>
          <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:center;font-size:7pt;color:#64748b;">${g.und || 'peça'}</td>
          <td style="padding:2px 3px;border-bottom:1px solid #f1f5f9;vertical-align:middle;text-align:right;font-size:8pt;font-weight:700;color:#16a34a;white-space:nowrap;">${precoTxt}</td>
        </tr>`;
      }
      return rows;
    }).join('');

    // Índice compacto de categorias
    const indexHtml = catsOrdenadas.map(cat =>
      `<span style="display:inline-block;font-size:7pt;color:${c.primaryDark};background:${c.light};border:1px solid ${c.lightBorder};padding:1px 5px;border-radius:8px;margin:1px 3px 1px 0;white-space:nowrap;">${categoryIcons[cat] || '📦'} ${cat} <span style="color:#94a3b8;font-size:6pt;">${categorias[cat].length}</span></span>`
    ).join('');

    const html = `<!DOCTYPE html>
    <html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Tabela de Preços — ${nomeEmpresa}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1e293b; background: #fff; }
  .page-wrapper { padding: 12px 16px; }
  .cover { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: transparent; border-radius: 8px; margin-bottom: 6px; }
  .cover-logo { width: 56px; height: 56px; object-fit: contain; background: #fff; border-radius: 6px; padding: 4px; flex-shrink: 0; }
  .cover-logo-placeholder { width: 56px; height: 56px; background: rgba(255,255,255,0.15); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  .cover-title { font-size: 18px; font-weight: 800; color: #0f172a !important; line-height: 1.1; }
  .cover-subtitle { font-size: 9px; font-weight: 600; color: #0f172a !important; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; margin-top: 0px; }
  .cover-contact { font-size: 8px; color: #475569 !important; display: inline-block; margin-right: 12px; margin-top: 2px; }
  .cover-right { text-align: right; flex-shrink: 0; }
  .cover-doc-title { font-size: 11px; font-weight: 800; color: #0f172a !important; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1; }
  .cover-date { font-size: 8px; color: #475569 !important; margin-top: 2px; }
  .stats-bar { display: flex; gap: 8px; margin-bottom: 12px; page-break-inside: avoid; }
  .stat-card { flex: 1; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; text-align: center; }
  .stat-num { font-size: 16px; font-weight: 800; color: ${c.primaryDark}; }
  .stat-label { font-size: 7px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
  .footer { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .footer-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .footer-item { flex: 1; min-width: 80px; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 8px; }
  .footer-item-label { font-size: 7px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
  .footer-item-value { font-size: 8px; color: #1e293b; font-weight: 500; }
  .footer-disclaimer { font-size: 8px; color: #64748b; line-height: 1.4; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; }
  .footer-brand { font-size: 7px; color: #94a3b8; }
  table.prod-table { width: 100%; border-collapse: collapse; }
  table.prod-table thead { display: table-header-group; }
  table.prod-table tr { page-break-inside: avoid; }
  table.prod-table th { background: #f1f5f9; }
  .index-bar { margin-bottom: 6px; page-break-inside: avoid; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page-wrapper">
<div class="cover">
  ${fabricante.logomarca ? `<img src="${getImg(fabricante.logomarca)}" alt="Logo" class="cover-logo">` : `<div class="cover-logo-placeholder">🏭</div>`}
  <div style="flex:1;">
    <div class="cover-title">${nomeEmpresa}</div>
    <div style="margin-top:6px;">
      ${fabricante.whatsapp ? `<span class="cover-contact">📱 ${fabricante.whatsapp}</span>` : ''}
      ${fabricante.email ? `<span class="cover-contact">✉ ${fabricante.email}</span>` : ''}
      ${fabricante.endereco ? `<span class="cover-contact">📍 ${fabricante.endereco}</span>` : ''}
      ${fabricante.site ? `<span class="cover-contact">🌐 ${fabricante.site}</span>` : ''}
    </div>
  </div>
  <div class="cover-right">
    <div class="cover-doc-title">Tabela de<br>Preços Oficial</div>
    <div class="cover-date">📅 ${dataGeracao}</div>
  </div>
</div>

<div class="stats-bar">
  <div class="stat-card"><div class="stat-num">${grupos.length}</div><div class="stat-label">Produtos</div></div>
  <div class="stat-card"><div class="stat-num">${Object.keys(categorias).length}</div><div class="stat-label">Categorias</div></div>
  <div class="stat-card"><div class="stat-num">${dataGeracao}</div><div class="stat-label">Atualizado em</div></div>
</div>

<!-- Índice de Categorias -->
<div class="index-bar">
  <div style="font-size:7pt;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Índice</div>
  <div>${indexHtml}</div>
</div>

<!-- Tabela de Produtos -->
<table class="prod-table">
  <thead>
    <tr>
      <th style="padding:3px 4px;text-align:center;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;width:28px;"></th>
      <th style="padding:3px 4px;text-align:left;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;width:32%;">Produto</th>
      <th style="padding:3px 4px;text-align:left;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;">Variações e Preços</th>
      <th style="padding:3px 4px;text-align:center;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;width:24px;">Und</th>
      <th style="padding:3px 4px;text-align:right;font-size:7pt;color:#64748b;text-transform:uppercase;border-bottom:1px solid #cbd5e1;width:60px;">A partir de</th>
    </tr>
  </thead>
  <tbody>${categoriasBlocos}</tbody>
</table>

<div class="footer">
  <div class="footer-grid">
    <div class="footer-item"><div class="footer-item-label">Condições de Pagamento</div><div class="footer-item-value">À vista, cartão, boleto ou transferência bancária</div></div>
    <div class="footer-item"><div class="footer-item-label">Prazo de Produção</div><div class="footer-item-value">Consultar disponibilidade no momento do pedido</div></div>
    <div class="footer-item"><div class="footer-item-label">Frete</div><div class="footer-item-value">Calculado conforme destino e volume do pedido</div></div>
    <div class="footer-item"><div class="footer-item-label">Validade da Tabela</div><div class="footer-item-value">Válida na data de geração: ${dataGeracao}</div></div>
  </div>
  <div class="footer-disclaimer">⚠️ <strong>Aviso:</strong> Esta tabela pode sofrer alterações sem aviso prévio. Consulte disponibilidade antes de confirmar o pedido.</div>
  <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid #e2e8f0;">
    <div class="footer-brand">Total: ${grupos.length} produtos · ${Object.keys(categorias).length} categorias</div>
    <div class="footer-brand">${nomeEmpresa} · ${dataGeracao}</div>
  </div>
</div>
</div>
</body>
</html>`;

    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        // Aguardar todas as imagens carregarem antes de imprimir
        const imgs = printWindow.document.querySelectorAll('img');
        await Promise.all(Array.from(imgs).map(img =>
          img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
        ));
        setTimeout(() => printWindow.print(), 300);
      }

      toast({
        title: "Tabela gerada!",
        description: `Tabela de ${nomeEmpresa} aberta para impressão/PDF.`,
      });
    } catch (printError) {
      console.error("Erro ao imprimir:", printError);
      toast({ title: "Erro", description: "Erro ao gerar tabela para impressão.", variant: "destructive" });
    }
  } catch (error) {
    console.error("Erro ao baixar tabela:", error);
    toast({ title: "Erro", description: "Não foi possível gerar a tabela.", variant: "destructive" });
  } finally {
    setDownloadingTable(null);
  }
}
