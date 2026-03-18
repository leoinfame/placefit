/**
 * Gera um PDF profissional de orçamento ou pedido de venda
 * com identidade visual extraída da logo do usuário.
 */

function rgbFromHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function luminance({ r, g, b }) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Extrai as cores predominantes de uma imagem URL via Canvas.
 * Retorna uma promise com { primary, secondary, light, textOnPrimary }
 */
function extractColorsFromLogo(logoUrl) {
  return new Promise((resolve) => {
    const defaults = {
      primary: "#1e3a5f",
      primaryDark: "#0f172a",
      secondary: "#16a34a",
      light: "#eff6ff",
      lightBorder: "#bfdbfe",
      textOnPrimary: "#ffffff",
    };

    if (!logoUrl) return resolve(defaults);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;
        const colorMap = {};

        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2], a = imageData[i + 3];
          if (a < 128) continue;
          const brightness = (r + g + b) / 3;
          if (brightness > 240 || brightness < 15) continue;
          const qr = Math.round(r / 32) * 32;
          const qg = Math.round(g / 32) * 32;
          const qb = Math.round(b / 32) * 32;
          const key = `${qr},${qg},${qb}`;
          colorMap[key] = (colorMap[key] || 0) + 1;
        }

        const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) return resolve(defaults);

        const [r1, g1, b1] = sorted[0][0].split(",").map(Number);
        let secondary = null;
        for (let i = 1; i < sorted.length; i++) {
          const [r2, g2, b2] = sorted[i][0].split(",").map(Number);
          const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
          if (diff > 80) { secondary = { r: r2, g: g2, b: b2 }; break; }
        }
        if (!secondary) secondary = { r: Math.max(0, Math.round(r1 * 0.7)), g: Math.max(0, Math.round(g1 * 0.7)), b: Math.max(0, Math.round(b1 * 0.7)) };

        const toHex = ({ r, g, b }) => "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
        const primary = { r: r1, g: g1, b: b1 };
        const lum = luminance(primary);

        resolve({
          primary: toHex(primary),
          primaryDark: toHex({ r: Math.max(0, Math.round(r1 * 0.75)), g: Math.max(0, Math.round(g1 * 0.75)), b: Math.max(0, Math.round(b1 * 0.75)) }),
          secondary: toHex(secondary),
          light: toHex({ r: Math.min(255, Math.round(r1 + (255 - r1) * 0.88)), g: Math.min(255, Math.round(g1 + (255 - g1) * 0.88)), b: Math.min(255, Math.round(b1 + (255 - b1) * 0.88)) }),
          lightBorder: toHex({ r: Math.min(255, Math.round(r1 + (255 - r1) * 0.65)), g: Math.min(255, Math.round(g1 + (255 - g1) * 0.65)), b: Math.min(255, Math.round(b1 + (255 - b1) * 0.65)) }),
          textOnPrimary: lum > 140 ? "#1e293b" : "#ffffff",
        });
      } catch {
        resolve(defaults);
      }
    };
    img.onerror = () => resolve(defaults);
    img.src = logoUrl;
  });
}

/**
 * Abre uma janela com o PDF profissional e dispara impressão.
 * @param {object} pedido - dados do pedido/orçamento
 * @param {object} user   - usuário logado (revendedor/fabricante)
 * @param {array}  clientes - lista de clientes para buscar dados completos
 * @param {string} tipo - "orcamento" | "venda"
 */
export async function generateProfessionalPDF(pedido, user, clientes, tipo = "venda", products = []) {
  const cliente = clientes.find(c => c.id === pedido.cliente_id) || { nome: pedido.cliente_nome };
  const colors = await extractColorsFromLogo(user?.logomarca);

  // Calcular peso total
  const pesoTotal = (pedido.itens || []).reduce((sum, item) => {
    const prod = products.find(p => p.id === item.product_id);
    const peso = prod?.peso ? parseFloat(prod.peso) : 0;
    return sum + peso * (item.quantidade || 1);
  }, 0);

  const tipoLabel = tipo === "orcamento" ? "ORÇAMENTO" : "PEDIDO DE VENDA";
  const numero = pedido.numero_pedido;
  const dataDoc = new Date(pedido.data_pedido).toLocaleDateString('pt-BR');
  const dataGeracao = new Date().toLocaleDateString('pt-BR');

  const fmtBRL = (v) => `R$ ${(parseFloat(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

  // Validade 30 dias para orçamentos
  const validadeDate = new Date(pedido.data_pedido);
  validadeDate.setDate(validadeDate.getDate() + 30);
  const validade = validadeDate.toLocaleDateString('pt-BR');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${tipoLabel} ${numero}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', Arial, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      font-size: 10px;
      line-height: 1.5;
    }

    .page {
      background: white;
      max-width: 800px;
      margin: 0 auto;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ===== CABEÇALHO ===== */
    .header {
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
      color: ${colors.textOnPrimary};
      padding: 0;
      display: flex;
      flex-direction: column;
    }

    .header-top {
      display: flex;
      align-items: stretch;
      min-height: 80px;
    }

    .header-logo-block {
      background: rgba(255,255,255,0.12);
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 110px;
      border-right: 1px solid rgba(255,255,255,0.15);
    }

    .header-logo-block img {
      max-width: 80px;
      max-height: 60px;
      object-fit: contain;
      filter: brightness(1.05);
    }

    .header-company {
      flex: 1;
      padding: 12px 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .company-name {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.3px;
      margin-bottom: 3px;
      color: ${colors.textOnPrimary};
    }

    .company-details {
      font-size: 8.5px;
      opacity: 0.85;
      line-height: 1.6;
    }

    .header-doc-block {
      background: rgba(0,0,0,0.2);
      padding: 12px 20px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-end;
      min-width: 160px;
      border-left: 1px solid rgba(255,255,255,0.15);
    }

    .doc-type {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      opacity: 0.9;
      margin-bottom: 4px;
    }

    .doc-number {
      font-size: 13px;
      font-weight: 700;
      color: ${colors.textOnPrimary};
    }

    .doc-date {
      font-size: 8px;
      opacity: 0.7;
      margin-top: 2px;
    }

    /* ===== FAIXA DE STATUS ===== */
    .status-bar {
      background: ${colors.secondary};
      height: 3px;
    }

    /* ===== BLOCO DE INFOS (vendedor + cliente) ===== */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border-bottom: 2px solid ${colors.lightBorder};
    }

    .info-block {
      padding: 14px 20px;
    }

    .info-block:first-child {
      border-right: 1px solid ${colors.lightBorder};
    }

    .info-block-header {
      font-size: 7.5px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: ${colors.primary};
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid ${colors.primary};
      display: inline-block;
    }

    .info-line {
      font-size: 9px;
      color: #475569;
      margin-bottom: 2px;
    }

    .info-line strong {
      color: #1e293b;
      font-weight: 600;
    }

    .info-name {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 5px;
    }

    /* ===== TABELA DE ITENS ===== */
    .section {
      padding: 16px 20px;
    }

    .section-title {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: ${colors.primary};
      margin-bottom: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }

    thead tr {
      background: ${colors.primary};
      color: ${colors.textOnPrimary};
    }

    thead th {
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 8px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    thead th.right { text-align: right; }
    thead th.center { text-align: center; }

    tbody tr:nth-child(even) {
      background: ${colors.light};
    }

    tbody tr:nth-child(odd) {
      background: white;
    }

    tbody tr:hover {
      background: ${colors.lightBorder}40;
    }

    tbody td {
      padding: 7px 10px;
      border-bottom: 1px solid ${colors.lightBorder};
      vertical-align: middle;
    }

    td.right { text-align: right; }
    td.center { text-align: center; }
    td.bold { font-weight: 600; }
    td.cod { font-family: monospace; font-size: 8px; color: #64748b; }

    /* ===== TOTAIS ===== */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      padding: 0 20px 16px;
    }

    .totals-box {
      width: 280px;
      background: ${colors.light};
      border: 1px solid ${colors.lightBorder};
      border-radius: 6px;
      overflow: hidden;
    }

    .total-row-item {
      display: flex;
      justify-content: space-between;
      padding: 5px 14px;
      font-size: 9px;
      border-bottom: 1px solid ${colors.lightBorder};
    }

    .total-row-item:last-child {
      border-bottom: none;
    }

    .total-row-item label {
      color: #64748b;
    }

    .total-row-item.grand {
      background: ${colors.primary};
      color: ${colors.textOnPrimary};
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 700;
    }

    .total-row-item.grand label {
      color: ${colors.textOnPrimary};
      opacity: 0.9;
    }

    /* ===== OBSERVAÇÕES ===== */
    .obs-block {
      margin: 0 20px 16px;
      padding: 10px 14px;
      background: #fef9c3;
      border-left: 3px solid #eab308;
      border-radius: 0 4px 4px 0;
      font-size: 9px;
      color: #713f12;
    }

    .obs-title {
      font-weight: 700;
      margin-bottom: 3px;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ===== VALIDADE (orçamento) ===== */
    .validity-block {
      margin: 0 20px 16px;
      padding: 8px 14px;
      background: #f0fdf4;
      border-left: 3px solid #16a34a;
      border-radius: 0 4px 4px 0;
      font-size: 9px;
      color: #166534;
      font-weight: 500;
    }

    /* ===== RODAPÉ ===== */
    .footer {
      margin-top: auto;
      border-top: 2px solid ${colors.lightBorder};
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${colors.light};
    }

    .footer-brand {
      font-size: 8px;
      color: #94a3b8;
    }

    .footer-brand span {
      color: ${colors.primary};
      font-weight: 600;
    }

    .footer-sig {
      font-size: 8px;
      color: #94a3b8;
      text-align: right;
    }

    /* ===== PRINT ===== */
    @media print {
      body { background: white; }
      .page { max-width: 100%; }
      @page { margin: 10mm; size: A4; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- CABEÇALHO -->
  <div class="header">
    <div class="header-top">
      ${user?.logomarca ? `
      <div class="header-logo-block">
        <img src="${user.logomarca}" alt="Logo" crossorigin="anonymous"/>
      </div>` : ''}
      <div class="header-company">
        <div class="company-name">${user?.empresa || user?.full_name || 'Empresa'}</div>
        <div class="company-details">
          ${user?.cnpj ? `CNPJ: ${user.cnpj} &nbsp;|&nbsp; ` : ''}
          ${user?.email ? `✉ ${user.email}` : ''}
          ${user?.whatsapp ? `&nbsp;|&nbsp; 📱 ${user.whatsapp}` : ''}
          ${user?.endereco ? `<br>📍 ${user.endereco}${user?.cidade ? `, ${user.cidade}` : ''}${user?.estado ? ` - ${user.estado}` : ''}` : ''}
          ${user?.site ? `<br>🌐 ${user.site}` : ''}
        </div>
      </div>
      <div class="header-doc-block">
        <div class="doc-type">${tipoLabel}</div>
        <div class="doc-number">${numero}</div>
        <div class="doc-date">Emitido em ${dataDoc}</div>
        ${tipo === 'orcamento' ? `<div class="doc-date">Válido até ${validade}</div>` : ''}
      </div>
    </div>
  </div>
  <div class="status-bar"></div>

  <!-- DADOS: VENDEDOR + CLIENTE -->
  <div class="info-grid">
    <div class="info-block">
      <div class="info-block-header">Emitente / Vendedor</div>
      <div class="info-name">${user?.empresa || user?.full_name || 'Empresa'}</div>
      ${user?.cnpj ? `<div class="info-line"><strong>CNPJ:</strong> ${user.cnpj}</div>` : ''}
      ${user?.email ? `<div class="info-line"><strong>E-mail:</strong> ${user.email}</div>` : ''}
      ${user?.whatsapp ? `<div class="info-line"><strong>WhatsApp:</strong> ${user.whatsapp}</div>` : ''}
      ${user?.endereco ? `<div class="info-line"><strong>Endereço:</strong> ${user.endereco}</div>` : ''}
      ${user?.cidade ? `<div class="info-line"><strong>Cidade:</strong> ${user.cidade}${user?.estado ? ` - ${user.estado}` : ''}</div>` : ''}
      ${user?.site ? `<div class="info-line"><strong>Site:</strong> ${user.site}</div>` : ''}
    </div>
    <div class="info-block">
      <div class="info-block-header">Destinatário / Cliente</div>
      <div class="info-name">${cliente?.nome || pedido.cliente_nome || '-'}</div>
      ${cliente?.cpf_cnpj ? `<div class="info-line"><strong>CPF/CNPJ:</strong> ${cliente.cpf_cnpj}</div>` : ''}
      ${cliente?.email ? `<div class="info-line"><strong>E-mail:</strong> ${cliente.email}</div>` : ''}
      ${cliente?.telefone ? `<div class="info-line"><strong>Telefone:</strong> ${cliente.telefone}</div>` : ''}
      ${cliente?.endereco ? `<div class="info-line"><strong>Endereço:</strong> ${cliente.endereco}</div>` : ''}
      ${cliente?.cidade ? `<div class="info-line"><strong>Cidade:</strong> ${cliente.cidade}${cliente?.estado ? ` - ${cliente.estado}` : ''}</div>` : ''}
      ${cliente?.cep ? `<div class="info-line"><strong>CEP:</strong> ${cliente.cep}</div>` : ''}
      ${cliente?.observacoes ? `<div class="info-line"><strong>Obs:</strong> ${cliente.observacoes}</div>` : ''}
    </div>
  </div>

  <!-- ITENS -->
  <div class="section">
    <div class="section-title">Itens do ${tipo === 'orcamento' ? 'Orçamento' : 'Pedido'}</div>
    <table>
      <thead>
        <tr>
          <th style="width:70px">Código</th>
          <th>Descrição do Produto</th>
          <th class="center" style="width:50px">Qtd</th>
          <th class="right" style="width:90px">Preço Unit.</th>
          <th class="right" style="width:90px">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${pedido.itens.map((item, i) => `
          <tr>
            <td class="cod">${item.cod || '-'}</td>
            <td class="bold">${item.nome}</td>
            <td class="center">${item.quantidade}</td>
            <td class="right">${fmtBRL(item.preco_unitario)}</td>
            <td class="right bold">${fmtBRL(item.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- TOTAIS -->
  <div class="totals-section">
    <div class="totals-box">
      <div class="total-row-item">
        <label>Subtotal</label>
        <span>${fmtBRL(pedido.subtotal)}</span>
      </div>
      ${parseFloat(pedido.frete || 0) > 0 ? `
      <div class="total-row-item">
        <label>Frete</label>
        <span>+ ${fmtBRL(pedido.frete)}</span>
      </div>` : ''}
      ${parseFloat(pedido.desconto || 0) > 0 ? `
      <div class="total-row-item">
        <label>Desconto</label>
        <span style="color:#dc2626">- ${fmtBRL(pedido.desconto)}</span>
      </div>` : ''}
      <div class="total-row-item grand">
        <label>TOTAL</label>
        <span>${fmtBRL(pedido.total)}</span>
      </div>
    </div>
  </div>

  <!-- VALIDADE (somente orçamento) -->
  ${tipo === 'orcamento' ? `
  <div class="validity-block">
    ✓ Este orçamento é válido até <strong>${validade}</strong>. Após esta data, os preços e condições podem ser revisados.
  </div>` : ''}

  <!-- OBSERVAÇÕES -->
  ${pedido.observacoes ? `
  <div class="obs-block">
    <div class="obs-title">Observações</div>
    ${pedido.observacoes}
  </div>` : ''}

  <!-- RODAPÉ -->
  <div class="footer">
    <div class="footer-brand">
      Gerado via <span>PlaceFit</span> &nbsp;·&nbsp; ${dataGeracao}
    </div>
    <div class="footer-sig">
      ${user?.empresa || user?.full_name || ''}<br>
      ${user?.email || ''}
    </div>
  </div>

</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => setTimeout(() => win.print(), 600);
}