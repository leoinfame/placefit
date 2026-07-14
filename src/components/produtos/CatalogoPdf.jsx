/**
 * Gera um PDF profissional com todos os produtos do catálogo padronizado.
 * @param {object} user - usuário logado
 * @param {array} byCategoria - produtos agrupados por categoria [{ categoria, groups }]
 * @param {function} getGroupFabricantes - função que retorna fabricantes/preços de um grupo
 */
export async function generateCatalogoPDF(user, byCategoria, getGroupFabricantes) {
  const fmtBRL = (v) => v != null && !isNaN(v)
    ? `R$ ${(parseFloat(v)).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
    : "—";

  const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const totalProdutos = byCategoria.reduce((sum, c) => sum + c.groups.length, 0);

  // Monta linhas da tabela por categoria
  let tabelasHtml = '';
  for (const { categoria, groups } of byCategoria) {
    let linhas = '';
    for (const g of groups) {
      const fabs = getGroupFabricantes(g);
      const hasWeights = g.templates.some(t => t.peso_kg != null);
      const pesos = g.templates.map(t => t.peso_kg ? `${t.peso_kg}kg` : null).filter(Boolean).join(', ');
      const minPreco = fabs.length > 0 ? (hasWeights ? fabs[0].precoKg : fabs[0].preco) : null;

      // Lista de fabricantes com preços
      const fabsHtml = fabs.length > 0
        ? fabs.slice(0, 5).map(f =>
            `<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px solid #f1f5f9;">
              <span style="color:#64748b;font-size:9px;">${f.fabricante_nome}</span>
              <span style="font-weight:600;font-size:9px;">${fmtBRL(hasWeights ? f.precoKg : f.preco)}${hasWeights ? '/kg' : ''}</span>
            </div>`
          ).join('')
        : '<span style="color:#cbd5e1;font-size:9px;">Sem preços cadastrados</span>';

      linhas += `
        <tr>
          <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            <div style="font-weight:600;font-size:10px;color:#1e293b;">${g.baseName}</div>
            <div style="font-size:8px;color:#94a3b8;margin-top:2px;">SKU: ${g.templates[0]?.cod || '—'}</div>
          </td>
          <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:9px;color:#64748b;">
            ${g.subcategoria || '—'}<br>
            ${g.acabamento || ''}
          </td>
          <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:9px;color:#64748b;">
            ${pesos || '—'}
          </td>
          <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
            ${fabsHtml}
          </td>
          <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:right;">
            ${minPreco != null ? `<span style="font-weight:700;color:#059669;font-size:10px;">a partir de<br>${fmtBRL(minPreco)}</span>` : '<span style="color:#cbd5e1;font-size:9px;">—</span>'}
          </td>
          <td style="padding:6px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:center;font-size:9px;color:#64748b;">
            ${g.und || '—'}
          </td>
        </tr>`;
    }

    tabelasHtml += `
      <div style="margin-top:20px;">
        <div style="background:#1e40af;color:white;padding:8px 12px;border-radius:6px 6px 0 0;font-weight:700;font-size:12px;display:flex;align-items:center;gap:8px;">
          ${categoria}
          <span style="background:rgba(255,255,255,0.2);padding:1px 8px;border-radius:10px;font-size:9px;font-weight:400;">${groups.length} ${groups.length === 1 ? 'produto' : 'produtos'}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:white;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:6px 4px;text-align:left;font-size:8px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Produto</th>
              <th style="padding:6px 4px;text-align:left;font-size:8px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Tipo/Acab.</th>
              <th style="padding:6px 4px;text-align:left;font-size:8px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Pesos</th>
              <th style="padding:6px 4px;text-align:left;font-size:8px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Fabricantes</th>
              <th style="padding:6px 4px;text-align:right;font-size:8px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Menor Preço</th>
              <th style="padding:6px 4px;text-align:center;font-size:8px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #e2e8f0;">Und</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Catálogo Padronizado - ${user?.empresa || user?.full_name || 'PlaceFit'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; background: #f8fafc; color: #1e293b; font-size: 10px; line-height: 1.5; }
    .page { background: white; max-width: 900px; margin: 0 auto; padding: 30px; min-height: 100vh; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 20px; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-logo { width: 50px; height: 50px; border-radius: 10px; background: #1e40af; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 20px; }
    .header-info h1 { font-size: 16px; font-weight: 700; color: #0f172a; }
    .header-info p { font-size: 10px; color: #64748b; }
    .header-meta { text-align: right; }
    .header-meta .label { font-size: 8px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }
    .header-meta .value { font-size: 11px; font-weight: 600; color: #1e293b; }
    .subtitle { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-size: 10px; color: #475569; margin-bottom: 4px; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8px; color: #94a3b8; }
    @media print { body { background: white; } .page { padding: 15px; max-width: none; } @page { margin: 1cm; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        ${user?.logomarca
          ? `<img src="${user.logomarca}" style="max-width:60px;max-height:50px;object-fit:contain;border-radius:8px;" />`
          : `<div class="header-logo">${(user?.empresa || user?.full_name || 'P')[0]?.toUpperCase()}</div>`}
        <div class="header-info">
          <h1>${user?.empresa || user?.full_name || 'PlaceFit'}</h1>
          <p>Catálogo Padronizado de Produtos</p>
        </div>
      </div>
      <div class="header-meta">
        <div class="label">Data de Geração</div>
        <div class="value">${dataGeracao}</div>
        <div class="label" style="margin-top:6px;">Total de Produtos</div>
        <div class="value">${totalProdutos}</div>
      </div>
    </div>
    <div class="subtitle">Documento gerado automaticamente com todos os produtos do catálogo padronizado e seus respectivos preços de fabricantes.</div>
    ${tabelasHtml}
    <div class="footer">
      Catálogo gerado via PlaceFit • ${dataGeracao} • ${totalProdutos} produtos em ${byCategoria.length} categorias
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Permita popups para gerar o PDF do catálogo.');
    return;
  }
  win.document.write(html);
  win.document.close();
}