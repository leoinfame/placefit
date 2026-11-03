// Itens 022f (pedido do Sr. Leo, 02/11/2026): layout ÚNICO da tabela em PDF da revenda.
// Usado pela tela "Sua Tabela" (botão Gerar PDF) e pela resposta automática do CRM,
// que manda exatamente o mesmo PDF ao lead novo. Mudou aqui, muda nos dois.
// Código movido sem alteração de src/pages/Export.jsx.

export const PDF_CATEGORY_ORDER = ['Anilhas', 'Halteres', 'Dumbbells', 'Kettlebells', 'Tijolinhos', 'Pisos', 'Kits'];

// Agrupa produtos que têm variações de peso (ex: Halter 1kg, 2kg, 3kg...)
// em uma única linha, mostrando os pesos disponíveis e o preço do item de referência (1kg)
// Colchonetes: uma linha por linha de produto (AG90, Bagum, Smart...), com as medidas como fichas
export const groupColchonetes = (items) => {
  const dimRe = /\s*\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?(?:\s*x\s*\d+(?:[.,]\d+)?)?\s*(?:cm)?/i;
  const g = {};
  items.forEach(it => {
    const nome = it.nome || '';
    const dm = nome.match(dimRe);
    const dens = (nome.match(/\bD\d+\b/i) || [''])[0];
    const base = nome.replace(dimRe, ' ').replace(/\bD\d+\b/i, '').replace(/\s*&\s*Cia\b/i, '').replace(/\s+/g, ' ').trim();
    const chip = dm ? (dm[0].trim().replace(/\s*cm$/i, '') + 'cm' + (dens ? ' ' + dens.toUpperCase() : '')) : '';
    if (!g[base]) g[base] = [];
    g[base].push({ it, chip });
  });
  return Object.entries(g).map(([base, arr]) => {
    if (arr.length === 1) return arr[0].it;
    const first = arr.find(x => x.it.foto) || arr[0];
    const min = Math.min(...arr.map(x => x.it.preco));
    return {
      nome: base,
      cod: '',
      categoria: arr[0].it.categoria,
      und: arr[0].it.und || 'peça',
      peso: '',
      dimsDisponiveis: arr.map(x => x.chip).filter(Boolean).join(', '),
      foto: first.it.foto || '',
      preco: min,
      precoFormatado: `R$ ${min.toFixed(2)}`,
      isDimGrouped: true
    };
  });
};

export const groupWeightProducts = (previewItems) => {
  const isColch = (it) => /colchonete/i.test(it.categoria || '') && /^colchonete\b/i.test(it.nome || '');
  const colchItems = previewItems.filter(isColch);
  previewItems = previewItems.filter(it => !isColch(it));
  const withWeight = previewItems.filter(item => item.peso_kg || (item.categoria || '').toLowerCase() === 'kettlebells');
  const withoutWeight = previewItems.filter(item => !item.peso_kg && (item.categoria || '').toLowerCase() !== 'kettlebells');

  const groups = {};
  withWeight.forEach(item => {
    const baseName = item.nome.replace(/\s*\d+([.,]\d+)?\s*kg(?=(\s*\([^)]*\))?\s*$)/i, '').replace(/\s*\(par\)\s*$/i, '').replace(/[\s-]+$/, '').trim();
    if (!groups[baseName]) {
      groups[baseName] = { items: [], pesos: [], categoria: item.categoria, und: item.und };
    }
    if (item.foto && !groups[baseName].foto) {
      groups[baseName].foto = item.foto;
    }
    groups[baseName].items.push(item);
    groups[baseName].pesos.push(item.peso_kg);
    if (item.peso_kg === 1) {
      groups[baseName].referenceItem = item;
    } else if (!groups[baseName].referenceItem) {
      groups[baseName].referenceItem = item;
    }
  });

  const groupedItems = Object.entries(groups).map(([baseName, group]) => {
    const ref = group.referenceItem || group.items[0];
    const isKettlebell = (group.categoria || '').toLowerCase() === 'kettlebells';
    const pesosPadraoKB = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40];
    const pesosOrdenados = isKettlebell
      ? pesosPadraoKB
      : [...new Set(group.pesos)].sort((a, b) => a - b);
    const isGrouped = group.items.length > 1 || isKettlebell;

    // Calculate price per kg: divide reference price by its weight
    const precoPorKg = (ref.peso_kg && ref.peso_kg > 0) ? ref.preco / ref.peso_kg : ref.preco;

    return {
      nome: isGrouped ? baseName : ref.nome,
      cod: isGrouped ? '' : (ref.cod || ''),
      categoria: ref.categoria,
      und: ref.und || 'peça',
      peso: '',
      pesosDisponiveis: isGrouped ? pesosOrdenados.map(p => `${p}kg`).join(', ') : '',
      foto: group.foto || ref.foto || '',
      preco: isGrouped ? precoPorKg : ref.preco,
      precoFormatado: isGrouped
        ? `R$ ${precoPorKg.toFixed(2)}/kg`
        : ref.precoFormatado,
      isWeightGrouped: isGrouped
    };
  });

  return [...withoutWeight, ...groupedItems, ...groupColchonetes(colchItems)];
};


// Mesma regra de generatePreview (revenda): preço promocional, senão preço × (1 + margem).
export function itensDaRevenda(productsData, supplierProductsData) {
  const availableProducts = supplierProductsData.filter(sp => sp.preco > 0);
  const preview = availableProducts.map(sp => {
    const product = productsData.find(p => p.id === sp.product_id);
    if (!product) return null;
    const precoFinal = sp.sale_price || (sp.preco * (1 + (sp.margem || 0) / 100));
    return {
      nome: product.nome,
      cod: product.cod || '',
      categoria: product.categoria || 'Outros',
      und: product.und || 'peça',
      peso: product.peso_kg ? `${product.peso_kg}kg` : '',
      peso_kg: product.peso_kg || null,
      foto: product.foto || '',
      preco: precoFinal,
      precoFormatado: `R$ ${precoFinal.toFixed(2)}`
    };
  }).filter(Boolean);
  return groupWeightProducts(preview);
}

export const buildPDFHTML = ({ user, colors, imageMap = {}, items = [], extraHead = '' }) => {
  const getImg = (url) => imageMap[url] || url || '';
  const nomeEmpresa = user?.empresa || user?.full_name || 'Fornecedor';
  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  const c = colors || {
    primary: '#1e3a5f', primaryDark: '#0f172a', secondary: '#1e40af',
    light: '#eff6ff', lightBorder: '#bfdbfe', textOnPrimary: '#ffffff', textAccent: '#1e40af'
  };

  // Agrupar por categoria
  const categorias = {};
  items.forEach(item => {
    const cat = item.categoria || 'Outros';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(item);
  });

  // Ordem desejada de categorias; demais aparecem depois em ordem alfabética
  const sortedCategories = Object.keys(categorias).sort((a, b) => {
    const ia = PDF_CATEGORY_ORDER.indexOf(a);
    const ib = PDF_CATEGORY_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b, 'pt-BR');
  });

  const categoryIcons = {
    'Cardiovascular': '🏃',
    'Musculação': '💪',
    'Funcional': '🤸',
    'Acessórios': '🎯',
    'Vestuário': '👕',
    'Nutrição': '🥗',
    'Outros': '📦',
  };

  const categoriasBlocos = sortedCategories.map(cat => {
    const itens = categorias[cat];
    const icon = categoryIcons[cat] || '📦';
    const cards = itens.map(item => {
      const espec = item.isWeightGrouped ? (item.pesosDisponiveis || '—') : item.isDimGrouped ? (item.dimsDisponiveis || '—') : (item.peso || item.dimensoes || '');
      const und = item.isWeightGrouped ? '/kg' : (item.und || 'peça');
      const precoLabel = item.isWeightGrouped ? 'Preço por kg' : item.isDimGrouped ? 'A partir de' : 'Preço';
      const fotoUrl = getImg(item.foto);
      const fotoHtml = fotoUrl
        ? `<img src="${fotoUrl}" alt="${item.nome}" style="width:30px;height:30px;object-fit:contain;background:#fff;border-radius:4px;border:1px solid #e2e8f0;flex-shrink:0;">`
        : `<div style="width:30px;height:30px;border-radius:4px;border:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📦</div>`;
      return `
        <div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px;background:#ffffff;break-inside:avoid;display:flex;gap:6px;min-height:78px;">
          ${fotoHtml}
          <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;min-width:0;">
            <div>
              ${item.cod ? `<span style="display:inline-block;font-size:7px;font-family:monospace;color:#64748b;background:#f1f5f9;padding:1px 4px;border-radius:3px;margin-bottom:3px;">${item.cod}</span>` : ''}
              <div style="font-size:9px;font-weight:600;color:#1e293b;line-height:1.25;">${item.nome}</div>
            </div>
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin:4px 0;">
              ${espec && espec !== '—' ? `<span style="font-size:7px;color:#475569;background:#eff6ff;border:1px solid #dbeafe;padding:1px 5px;border-radius:8px;line-height:1.35;">${espec}</span>` : ''}
              <span style="font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;">${und}</span>
            </div>
            <div style="display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:3px;">
              <span style="font-size:7px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;">${precoLabel}</span>
              <span style="font-size:11px;font-weight:700;color:#16a34a;">${item.precoFormatado}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <div style="width:3px;height:14px;background:${c.secondary};border-radius:2px;"></div>
          <span style="font-size:10px;font-weight:700;color:#1e293b;letter-spacing:1px;text-transform:uppercase;">${cat}</span>
          <span style="margin-left:auto;font-size:8px;color:#64748b;font-weight:500;">${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;">${cards}</div>
      </div>`;
  }).join('');

  const totalProdutos = items.length;
  const totalCategorias = Object.keys(categorias).length;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Tabela de Preços — ${nomeEmpresa}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; color: #1e293b; background: #fff; }
  .page-wrapper { padding: 12px 16px; }

  /* CAPA/HEADER */
  .cover { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: linear-gradient(135deg, ${c.primaryDark} 0%, ${c.primary} 50%, ${c.secondary} 100%); border-radius: 8px; margin-bottom: 12px; }
  .cover-logo { width: 56px; height: 56px; object-fit: contain; background: #fff; border-radius: 6px; padding: 4px; flex-shrink: 0; }
  .cover-logo-placeholder { width: 56px; height: 56px; background: rgba(255,255,255,0.15); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  .cover-body { flex: 1; }
  .cover-title { font-size: 18px; font-weight: 800; color: #1e293b !important; letter-spacing: -0.5px; line-height: 1.1; }
  .cover-subtitle { font-size: 9px; font-weight: 600; color: #1e293b !important; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; margin-top: 0px; }
  .cover-contacts { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; }
  .cover-contact { font-size: 8px; color: #1e293b !important; display: flex; align-items: center; gap: 3px; }
  .cover-right { text-align: right; flex-shrink: 0; }
  .cover-doc-title { font-size: 11px; font-weight: 800; color: #1e293b !important; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1; }
  .cover-date { font-size: 8px; color: #1e293b !important; margin-top: 2px; }
  .cover-badge { margin-top: 4px; display: none; }

  /* STATS BAR */
  .stats-bar { display: flex; gap: 8px; margin-bottom: 12px; }
  .stat-card { flex: 1; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; text-align: center; }
  .stat-num { font-size: 16px; font-weight: 800; color: ${c.textAccent}; }
  .stat-label { font-size: 7px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }

  /* CONTENT */
  .section-divider { border: none; border-top: 1px solid #e2e8f0; margin: 8px 0; }

  /* FOOTER */
  .footer { margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .footer-title { font-size: 9px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .footer-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .footer-item { flex: 1; min-width: 80px; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 8px; }
  .footer-item-label { font-size: 7px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 1px; }
  .footer-item-value { font-size: 8px; color: #1e293b; font-weight: 500; }
  .footer-disclaimer { font-size: 8px; color: #64748b; line-height: 1.4; background: transparent; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; }
  .footer-bottom { margin-top: 8px; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 7px; color: #94a3b8; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-wrapper { padding: 8mm; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
${extraHead}
</head>
<body>
<div class="page-wrapper">

<!-- CAPA -->
<div class="cover">
  ${user?.logomarca
    ? `<img src="${getImg(user.logomarca)}" alt="Logo" class="cover-logo">`
    : `<div class="cover-logo-placeholder">🏋️</div>`}
  <div class="cover-body">
  <div class="cover-title">${nomeEmpresa}</div>
    <div class="cover-contacts">
      ${user?.whatsapp ? `<span class="cover-contact">📱 ${user.whatsapp}</span>` : ''}
      ${user?.email ? `<span class="cover-contact">✉ ${user.email}</span>` : ''}
      ${user?.endereco ? `<span class="cover-contact">📍 ${user.endereco}</span>` : ''}
      ${user?.site ? `<span class="cover-contact">🌐 ${user.site}</span>` : ''}
    </div>
  </div>
  <div class="cover-right">
    <div class="cover-doc-title">Tabela de<br>Preços Oficial</div>
    <div class="cover-date">📅 ${dataGeracao}</div>

  </div>
</div>

<!-- STATS -->
<div class="stats-bar">
  <div class="stat-card">
    <div class="stat-num">${totalProdutos}</div>
    <div class="stat-label">Produtos</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">${totalCategorias}</div>
    <div class="stat-label">Categorias</div>
  </div>
  <div class="stat-card">
    <div class="stat-num">${dataGeracao}</div>
    <div class="stat-label">Atualizado em</div>
  </div>
</div>

<!-- CATEGORIAS E PRODUTOS -->
${categoriasBlocos}

<!-- RODAPÉ COMERCIAL -->
<div class="footer">
  <div class="footer-title">📋 Informações Comerciais</div>
  <div class="footer-grid">
    <div class="footer-item">
      <div class="footer-item-label">Condições de Pagamento</div>
      <div class="footer-item-value">À vista, cartão, boleto ou transferência bancária</div>
    </div>
    <div class="footer-item">
      <div class="footer-item-label">Prazo de Produção</div>
      <div class="footer-item-value">Consultar disponibilidade no momento do pedido</div>
    </div>
    <div class="footer-item">
      <div class="footer-item-label">Frete</div>
      <div class="footer-item-value">Calculado conforme destino e volume do pedido</div>
    </div>
    <div class="footer-item">
      <div class="footer-item-label">Validade da Tabela</div>
      <div class="footer-item-value">Válida na data de geração: ${dataGeracao}</div>
    </div>
  </div>
  <div class="footer-disclaimer">
    ⚠️ <strong>Aviso:</strong> Esta tabela de preços pode sofrer alterações sem aviso prévio. Consulte disponibilidade e prazo de entrega antes de confirmar o pedido. Os preços praticados são os vigentes no momento da emissão do pedido de compra. Para mais informações, entre em contato com nossa equipe comercial.
  </div>
  <div class="footer-bottom">
    <div class="footer-brand">Documento gerado automaticamente</div>
    <div class="footer-brand">${nomeEmpresa} · ${dataGeracao}</div>
  </div>
</div>

</div>
</body>
</html>`;
};

