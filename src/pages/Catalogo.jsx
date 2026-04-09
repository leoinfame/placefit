import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Search, ImageIcon, FileText } from "lucide-react";
import { useLogoColors } from "@/components/export/useLogoColors";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function Catalogo() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);
  const logoColors = useLogoColors(user?.logomarca);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredProducts(
        products.filter(p => 
          p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.cod.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      let productsData = [];

      if (currentUser.role === 'admin') {
        // Admin vê todos os produtos
        productsData = await base44.entities.Product.list('-updated_date');
      } else if (currentUser.tipo_usuario === 'fabricante') {
        // Fabricante vê apenas seus produtos
        const allProducts = await base44.entities.Product.list();
        productsData = allProducts.filter(p => p.fabricante_id === currentUser.id);
      } else {
        // Revendedor vê apenas produtos selecionados COM preço definido
        const supplierProducts = await base44.entities.SupplierProduct.filter({ 
          supplier_id: currentUser.id,
          disponivel: true
        });
        
        // Filtrar apenas produtos com preço maior que 0
        const validSupplierProducts = supplierProducts.filter(sp => 
          sp.preco && parseFloat(sp.preco) > 0
        );
        
        const productIds = validSupplierProducts.map(sp => sp.product_id);
        if (productIds.length > 0) {
          const allProducts = await base44.entities.Product.list();
          productsData = allProducts.filter(p => productIds.includes(p.id));
        }
      }

      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const extractColorsFromLogo = (logoUrl) => {
    return new Promise((resolve) => {
      const defaults = {
        primary: "#1e3a5f", primaryDark: "#0f172a", secondary: "#16a34a",
        light: "#eff6ff", lightBorder: "#bfdbfe", textOnPrimary: "#ffffff",
      };
      if (!logoUrl) return resolve(defaults);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 80;
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size).data;
          const colorMap = {};
          for (let i = 0; i < imageData.length; i += 4) {
            const r = imageData[i], g = imageData[i+1], b = imageData[i+2], a = imageData[i+3];
            if (a < 128) continue;
            const brightness = (r + g + b) / 3;
            if (brightness > 240 || brightness < 15) continue;
            const key = `${Math.round(r/32)*32},${Math.round(g/32)*32},${Math.round(b/32)*32}`;
            colorMap[key] = (colorMap[key] || 0) + 1;
          }
          const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
          if (sorted.length === 0) return resolve(defaults);
          const [r1, g1, b1] = sorted[0][0].split(",").map(Number);
          let sec = null;
          for (let i = 1; i < sorted.length; i++) {
            const [r2, g2, b2] = sorted[i][0].split(",").map(Number);
            if (Math.abs(r1-r2)+Math.abs(g1-g2)+Math.abs(b1-b2) > 80) { sec = {r:r2,g:g2,b:b2}; break; }
          }
          if (!sec) sec = { r: Math.max(0,Math.round(r1*.7)), g: Math.max(0,Math.round(g1*.7)), b: Math.max(0,Math.round(b1*.7)) };
          const toHex = ({r,g,b}) => "#"+[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("");
          const lum = 0.299*r1 + 0.587*g1 + 0.114*b1;
          resolve({
            primary: toHex({r:r1,g:g1,b:b1}),
            primaryDark: toHex({r:Math.max(0,Math.round(r1*.75)),g:Math.max(0,Math.round(g1*.75)),b:Math.max(0,Math.round(b1*.75))}),
            secondary: toHex(sec),
            light: toHex({r:Math.min(255,Math.round(r1+(255-r1)*.88)),g:Math.min(255,Math.round(g1+(255-g1)*.88)),b:Math.min(255,Math.round(b1+(255-b1)*.88))}),
            lightBorder: toHex({r:Math.min(255,Math.round(r1+(255-r1)*.65)),g:Math.min(255,Math.round(g1+(255-g1)*.65)),b:Math.min(255,Math.round(b1+(255-b1)*.65))}),
            textOnPrimary: lum > 140 ? "#1e293b" : "#ffffff",
          });
        } catch { resolve(defaults); }
      };
      img.onerror = () => resolve(defaults);
      img.src = logoUrl;
    });
  };

  const exportToPDF = async () => {
    setExportingPDF(true);
    const colors = await extractColorsFromLogo(user?.logomarca);

    // Agrupar produtos por categoria, mantendo ordem alfabética de categoria
    const categorias = {};
    filteredProducts.forEach(p => {
      const cat = p.categoria || 'Outros';
      if (!categorias[cat]) categorias[cat] = [];
      categorias[cat].push(p);
    });
    const categoriasOrdenadas = Object.keys(categorias).sort();
    const totalCategorias = categoriasOrdenadas.length;

    // Paleta de acentos com contraste garantido (todas escuras o suficiente para texto branco)
    const accentPalette = [
      '#1e40af','#065f46','#7c2d12','#4c1d95','#164e63','#713f12','#881337','#14532d','#1e3a5f','#4a1d96',
      '#0c4a6e','#78350f','#be123c','#155e75','#166534',
    ];

    const hexToRgb = h => { try { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return {r,g,b}; } catch(e){ return {r:30,g:64,b:175}; } };
    const lumOf = h => { const {r,g,b}=hexToRgb(h); return 0.299*r+0.587*g+0.114*b; };
    // Limiar mais conservador: só usa texto escuro em fundos realmente claros (>160)
    const textOn = h => lumOf(h) > 160 ? '#1e293b' : '#ffffff';

    const miniFooter = `
      <div class="mini-footer">
        <span style="font-weight:700;color:${colors.primary};">${user?.empresa || user?.full_name}</span>
        ${user?.whatsapp ? `&nbsp;·&nbsp;📱 ${user.whatsapp}` : ''}
        ${user?.site ? `&nbsp;·&nbsp;🌐 ${user.site}` : ''}
        <span style="float:right;color:#94a3b8;">PlaceFit · ${new Date().toLocaleDateString('pt-BR')}</span>
      </div>`;

    const buildCategorySections = () => categoriasOrdenadas.map((cat, idx) => {
      const prods = categorias[cat];
      const accent = accentPalette[idx % accentPalette.length];
      const txtAcc = textOn(accent);

      // Escolher colunas conforme quantidade de produtos — economia de papel
      const cols = prods.length >= 10 ? 5 : prods.length >= 6 ? 4 : prods.length >= 3 ? 3 : prods.length === 2 ? 2 : 1;
      // Altura da imagem: com mais colunas, reduzir altura para caber mais por página
      const imgH = cols >= 5 ? '72px' : cols === 4 ? '88px' : '105px';

      const cards = prods.map(product => `
        <div class="product-card" style="break-inside:avoid;">
          <div style="height:3px;background:${accent};width:100%;"></div>
          <div style="width:100%;height:${imgH};background:#fff;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #f1f5f9;">
            ${product.foto
              ? `<img src="${product.foto}" alt="" crossorigin="anonymous" style="max-width:100%;max-height:${imgH};object-fit:contain;display:block;"/>`
              : `<span style="font-size:14pt;color:#e2e8f0;">📦</span>`
            }
          </div>
          <div style="padding:6px 7px 5px;">
            <div style="font-weight:700;font-size:${cols>=5?'6.5pt':'7pt'};color:#0f172a;line-height:1.25;min-height:2.4em;margin-bottom:4px;overflow:hidden;">${product.nome}</div>
            <div style="font-size:6pt;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.03em;">Cód.&nbsp;<span style="color:#1e293b;font-weight:700;font-family:monospace;">${product.cod}</span></div>
            ${product.peso||product.dimensoes ? `<div style="font-size:6pt;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.03em;">${product.peso?`${product.peso}kg`:''}${product.peso&&product.dimensoes?' · ':''}${product.dimensoes?product.dimensoes+' cm':''}</div>` : ''}
            <div style="font-size:6pt;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.03em;">Und.&nbsp;<span style="color:#1e293b;font-weight:600;">${product.und}</span></div>
          </div>
        </div>`).join('');

      const isFirst = idx === 0;
      return `
        <div class="cat-page" style="${isFirst?'':'page-break-before:always;'}padding:12mm 12mm 10mm;">

          <!-- Mini header de página com logo + info -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid ${colors.lightBorder};">
            <div style="display:flex;align-items:center;gap:8px;">
              ${user?.logomarca?`<img src="${user.logomarca}" alt="" crossorigin="anonymous" style="max-width:36px;max-height:24px;object-fit:contain;"/>`:''}
              <span style="font-size:8pt;font-weight:700;color:${colors.primary};">${user?.empresa||user?.full_name}</span>
            </div>
            <span style="font-size:7pt;color:#94a3b8;">Catálogo de Produtos &nbsp;·&nbsp; ${filteredProducts.length} itens · ${totalCategorias} categorias</span>
          </div>

          <!-- Cabeçalho da Categoria — full-width banner -->
          <div style="display:flex;align-items:stretch;border-radius:8px;overflow:hidden;margin-bottom:10px;background:${accent};">
            <div style="background:rgba(0,0,0,0.18);padding:16px 20px;display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:64px;">
              <span style="font-size:22pt;font-weight:900;color:rgba(255,255,255,0.35);line-height:1;">${String(idx+1).padStart(2,'0')}</span>
            </div>
            <div style="flex:1;padding:12px 18px;display:flex;flex-direction:column;justify-content:center;">
              <div style="font-size:14pt;font-weight:900;color:${txtAcc};letter-spacing:-0.3px;line-height:1.1;">${cat}</div>
              <div style="font-size:7.5pt;color:${txtAcc};opacity:0.7;margin-top:2px;">${prods.length} produto${prods.length>1?'s':''} · grid ${cols} colunas</div>
            </div>
            <!-- mini índice lateral das outras categorias -->
            <div style="background:rgba(0,0,0,0.12);padding:8px 12px;min-width:140px;display:flex;flex-direction:column;justify-content:center;gap:2px;border-left:1px solid rgba(255,255,255,0.1);">
              ${categoriasOrdenadas.slice(0,6).map((c,i)=>`<span style="font-size:6pt;color:${i===idx?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.4)'};font-weight:${i===idx?'700':'400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i===idx?'▶ ':''} ${c}</span>`).join('')}
              ${categoriasOrdenadas.length>6?`<span style="font-size:6pt;color:rgba(255,255,255,0.35);">+${categoriasOrdenadas.length-6} mais...</span>`:''}
            </div>
          </div>

          <!-- Grid de produtos -->
          <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;">
            ${cards}
          </div>

          ${miniFooter}
          ${idx === categoriasOrdenadas.length - 1 ? `
          <!-- RODAPÉ COMERCIAL — apenas na última categoria -->
          <div class="footer">
            <div class="footer-title">📋 Informações do Catálogo</div>
            <div class="footer-grid">
              <div class="footer-item"><div class="footer-item-label">Empresa</div><div class="footer-item-value">${user?.empresa || user?.full_name}</div></div>
              <div class="footer-item"><div class="footer-item-label">Contato</div><div class="footer-item-value">${user?.whatsapp || user?.email || '—'}</div></div>
              <div class="footer-item"><div class="footer-item-label">Total de Produtos</div><div class="footer-item-value">${filteredProducts.length} item(s) em ${totalCategorias} categoria(s)</div></div>
              <div class="footer-item"><div class="footer-item-label">Data de Emissão</div><div class="footer-item-value">${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div></div>
            </div>
            <div class="footer-disclaimer">⚠️ <strong>Aviso:</strong> Este catálogo pode sofrer alterações sem aviso prévio. Disponibilidade, especificações e imagens são meramente ilustrativas. Consulte nossa equipe comercial antes de efetuar qualquer pedido.</div>
            <div class="footer-bottom">
              <div>Documento gerado automaticamente via PlaceFit</div>
              <div class="footer-bottom-brand">${user?.empresa || user?.full_name} · ${new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>` : ''}
        </div>`;
    }).join('');

    const printContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Catálogo - ${user?.empresa || user?.full_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,600;0,700;0,800;0,900;1,400&display=swap');
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 9pt; color: #1e293b; background: #f1f5f9; }

    /* ===== CAPA SPLIT-SCREEN ===== */
    .cover {
      width: 100%;
      min-height: 297mm;
      display: flex;
      flex-direction: row;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }
    /* Coluna esquerda — painel escuro com logo */
    .cover-left {
      width: 42%;
      background: linear-gradient(175deg, ${colors.primaryDark} 0%, ${colors.primary} 55%, ${colors.secondary}cc 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 28px;
      position: relative;
      overflow: hidden;
    }
    .cover-left::before {
      content: '';
      position: absolute;
      top: -60px; left: -60px;
      width: 260px; height: 260px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
    }
    .cover-left::after {
      content: '';
      position: absolute;
      bottom: -80px; right: -50px;
      width: 220px; height: 220px;
      border-radius: 50%;
      background: rgba(0,0,0,0.15);
    }
    .cover-logo-wrap {
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 18px;
      padding: 28px 32px;
      margin-bottom: 28px;
      position: relative;
      z-index: 1;
    }
    .cover-logo-wrap img { max-width: 130px; max-height: 100px; object-fit: contain; display: block; }
    .cover-logo-placeholder {
      width: 110px; height: 110px;
      background: rgba(255,255,255,0.1);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 40pt; position: relative; z-index:1;
    }
    .cover-doc-label {
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.55);
      margin-bottom: 6px;
      position: relative; z-index:1;
    }
    .cover-doc-title {
      font-size: 17pt;
      font-weight: 900;
      color: #fff;
      text-align: center;
      line-height: 1.15;
      position: relative; z-index:1;
    }
    .cover-left-date {
      position: absolute;
      bottom: 20px;
      font-size: 7.5pt;
      color: rgba(255,255,255,0.45);
      letter-spacing: 0.5px;
      z-index: 1;
    }
    .cover-left-accent {
      position: absolute;
      top: 0; right: 0;
      width: 4px; height: 100%;
      background: rgba(255,255,255,0.12);
    }

    /* Coluna direita — branco com dados */
    .cover-right {
      flex: 1;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 48px 36px;
    }
    .cover-company-name {
      font-size: 22pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.8px;
      line-height: 1.1;
      margin-bottom: 4px;
    }
    .cover-company-sub {
      font-size: 8pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 600;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 2px solid ${colors.lightBorder};
    }
    .cover-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 28px;
    }
    .cover-info-item {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .cover-info-item.full { grid-column: 1 / -1; }
    .cover-info-label {
      font-size: 6.5pt;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 3px;
    }
    .cover-info-value {
      font-size: 9pt;
      font-weight: 600;
      color: #1e293b;
    }
    .cover-stats-row {
      display: flex;
      gap: 10px;
      margin-bottom: 28px;
    }
    .cover-stat-box {
      flex: 1;
      background: linear-gradient(135deg, ${colors.primary}18, ${colors.primary}08);
      border: 1px solid ${colors.lightBorder};
      border-radius: 10px;
      padding: 14px 10px;
      text-align: center;
    }
    .cover-stat-num {
      font-size: 24pt;
      font-weight: 900;
      color: ${colors.primary};
      line-height: 1;
      display: block;
    }
    .cover-stat-lbl {
      font-size: 7pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 3px;
      display: block;
    }
    .cover-validity {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-left: 3px solid ${colors.secondary};
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 8pt;
      color: #475569;
    }
    .cover-validity strong { color: #1e293b; }

    /* ===== PÁGINAS DE CATEGORIA ===== */
    .cat-page { background: #f8fafc; min-height: 297mm; position: relative; }
    .product-card {
      background: #fff;
      border-radius: 6px;
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    /* ===== MINI FOOTER (rodapé leve em cada página) ===== */
    .mini-footer {
      margin-top: 12px;
      padding-top: 7px;
      border-top: 1px solid #e2e8f0;
      font-size: 7pt;
      color: #64748b;
    }

    /* ===== RODAPÉ COMERCIAL ===== */
    .footer { margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    .footer-title { font-size: 9px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .footer-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .footer-item { flex: 1; min-width: 80px; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 9px; }
    .footer-item-label { font-size: 7px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
    .footer-item-value { font-size: 8px; color: #1e293b; font-weight: 500; }
    .footer-disclaimer { font-size: 8px; color: #64748b; line-height: 1.5; background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 7px 10px; margin-bottom: 8px; }
    .footer-bottom { display: flex; justify-content: space-between; align-items: center; font-size: 7px; color: #94a3b8; }
    .footer-bottom-brand { font-weight: 700; color: ${colors.primary}; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: #f1f5f9; }
      .cover { page-break-after: always; }
    }
  </style>
</head>
<body>

  <!-- CAPA SPLIT-SCREEN -->
  <div class="cover">
    <!-- Painel esquerdo escuro: logo + título do documento -->
    <div class="cover-left">
      <div class="cover-left-accent"></div>
      ${user?.logomarca
        ? `<div class="cover-logo-wrap"><img src="${user.logomarca}" alt="Logo" crossorigin="anonymous"/></div>`
        : `<div class="cover-logo-placeholder">🏋️</div>`
      }
      <div class="cover-doc-label">Documento Oficial</div>
      <div class="cover-doc-title">Catálogo<br>de Produtos</div>
      <div class="cover-left-date">📅 ${new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})}</div>
    </div>

    <!-- Painel direito claro: dados da empresa -->
    <div class="cover-right">
      <div class="cover-company-name">${user?.empresa || user?.full_name}</div>
      <div class="cover-company-sub">Informações da Empresa</div>

      <div class="cover-info-grid">
        ${user?.cnpj ? `<div class="cover-info-item"><div class="cover-info-label">CNPJ</div><div class="cover-info-value">${user.cnpj}</div></div>` : ''}
        ${user?.whatsapp ? `<div class="cover-info-item"><div class="cover-info-label">WhatsApp / Tel.</div><div class="cover-info-value">📱 ${user.whatsapp}</div></div>` : ''}
        ${user?.email ? `<div class="cover-info-item"><div class="cover-info-label">E-mail</div><div class="cover-info-value">✉ ${user.email}</div></div>` : ''}
        ${user?.site ? `<div class="cover-info-item"><div class="cover-info-label">Site</div><div class="cover-info-value">🌐 ${user.site}</div></div>` : ''}
        ${user?.endereco ? `<div class="cover-info-item full"><div class="cover-info-label">Endereço</div><div class="cover-info-value">📍 ${user.endereco}</div></div>` : ''}
      </div>

      <div class="cover-stats-row">
        <div class="cover-stat-box">
          <span class="cover-stat-num">${filteredProducts.length}</span>
          <span class="cover-stat-lbl">Produtos</span>
        </div>
        <div class="cover-stat-box">
          <span class="cover-stat-num">${totalCategorias}</span>
          <span class="cover-stat-lbl">Categorias</span>
        </div>
        <div class="cover-stat-box">
          <span class="cover-stat-num" style="font-size:13pt">${new Date().toLocaleDateString('pt-BR')}</span>
          <span class="cover-stat-lbl">Emissão</span>
        </div>
      </div>

      <div class="cover-validity">
        <strong>Validade:</strong> Este catálogo é válido na data de geração. Produtos, especificações e disponibilidade podem sofrer alterações. Consulte sempre nossa equipe comercial.
      </div>
    </div>
  </div>

  <!-- PÁGINA DE ÍNDICE -->
  <div style="page-break-after:always;background:#f8fafc;min-height:297mm;padding:14mm 14mm 10mm;display:flex;flex-direction:column;">

    <!-- Header mini -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:10px;border-bottom:2px solid ${colors.lightBorder};">
      <div style="display:flex;align-items:center;gap:10px;">
        ${user?.logomarca?`<img src="${user.logomarca}" alt="" crossorigin="anonymous" style="max-width:40px;max-height:28px;object-fit:contain;"/>`:''}
        <span style="font-size:9pt;font-weight:700;color:${colors.primary};">${user?.empresa||user?.full_name}</span>
      </div>
      <span style="font-size:7pt;color:#94a3b8;">Catálogo de Produtos · Índice</span>
    </div>

    <div style="font-size:9pt;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">📑 Índice de Categorias</div>

    <!-- Grade de categorias no índice -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:1;">
      ${categoriasOrdenadas.map((cat, idx) => {
        const accent = accentPalette[idx % accentPalette.length];
        const txtA = textOn(accent);
        return `<div style="display:flex;align-items:center;gap:0;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
          <div style="width:48px;background:${accent};display:flex;align-items:center;justify-content:center;align-self:stretch;">
            <span style="font-size:11pt;font-weight:900;color:rgba(255,255,255,0.5);">${String(idx+1).padStart(2,'0')}</span>
          </div>
          <div style="flex:1;padding:10px 12px;background:#fff;">
            <div style="font-size:9pt;font-weight:700;color:#1e293b;">${cat}</div>
            <div style="font-size:7pt;color:#64748b;margin-top:2px;">${categorias[cat].length} produto${categorias[cat].length>1?'s':''}</div>
          </div>
          <div style="width:4px;background:${accent};align-self:stretch;"></div>
        </div>`;
      }).join('')}
    </div>

    <!-- Sumário de totais -->
    <div style="display:flex;gap:10px;margin-top:20px;">
      <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-left:3px solid ${colors.primary};border-radius:6px;padding:10px 14px;">
        <div style="font-size:7pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Total de Produtos</div>
        <div style="font-size:18pt;font-weight:900;color:${colors.primary};line-height:1.1;">${filteredProducts.length}</div>
      </div>
      <div style="flex:1;background:#fff;border:1px solid #e2e8f0;border-left:3px solid ${colors.secondary};border-radius:6px;padding:10px 14px;">
        <div style="font-size:7pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;">Categorias</div>
        <div style="font-size:18pt;font-weight:900;color:${colors.secondary};line-height:1.1;">${totalCategorias}</div>
      </div>
      <div style="flex:2;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;">
        <div style="font-size:7pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Empresa</div>
        <div style="font-size:8pt;font-weight:600;color:#1e293b;">${user?.empresa||user?.full_name}</div>
        ${user?.whatsapp?`<div style="font-size:7.5pt;color:#64748b;">📱 ${user.whatsapp}</div>`:''}
        ${user?.site?`<div style="font-size:7.5pt;color:#64748b;">🌐 ${user.site}</div>`:''}
      </div>
    </div>

    <div style="margin-top:10px;font-size:7pt;color:#94a3b8;text-align:center;">
      Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} via PlaceFit
    </div>
  </div>

  <!-- SEÇÕES POR CATEGORIA (cada uma em nova página) -->
  ${buildCategorySections()}


</body>
</html>`;

    const downloadBar = `
    <div id="download-bar" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e3a5f;color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
      <span>📄 <strong>Catálogo de Produtos</strong> — Pronto para download</span>
      <div style="display:flex;gap:10px;">
        <button onclick="window.print()" style="background:#16a34a;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">⬇️ Baixar PDF</button>
        <button onclick="document.getElementById('download-bar').style.display='none'" style="background:rgba(255,255,255,0.15);color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:13px;cursor:pointer;">✕</button>
      </div>
    </div>
    <div style="height:52px;"></div>
    <style>@media print { #download-bar, #download-bar + div { display:none !important; } }</style>`;

    const finalContent = printContent.replace('<body>', '<body>' + downloadBar);

    const blob = new Blob([finalContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setExportingPDF(false);
    toast({ title: "PDF gerado!", description: "Use o botão 'Baixar PDF' na janela aberta para salvar como PDF." });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabeçalho da Empresa */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div style={{height: '4px', background: logoColors ? `linear-gradient(90deg, ${logoColors.primaryDark}, ${logoColors.primary}, ${logoColors.secondary})` : 'linear-gradient(90deg,#0f172a,#1e3a5f,#1e40af)'}} />
          <CardContent className="p-6 md:p-8 bg-white">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {user?.logomarca && (
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-xl shadow-md p-4 flex-shrink-0" style={{border: `1px solid ${logoColors?.lightBorder || '#e2e8f0'}`}}>
                  <img src={user.logomarca} alt="Logo" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{color: logoColors?.primaryDark || '#0f172a'}}>
                  {user?.empresa || user?.full_name}
                </h1>
                {user?.cnpj && <p className="text-gray-600 mb-1">CNPJ: {user.cnpj}</p>}
                {user?.endereco && <p className="text-gray-600 mb-1">{user.endereco}</p>}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start mt-3">
                  {user?.whatsapp && (
                    <Badge variant="outline" style={{color: logoColors?.primary || '#1e3a5f', borderColor: logoColors?.lightBorder || '#bfdbfe', background: logoColors?.light || '#eff6ff'}}>
                      WhatsApp: {user.whatsapp}
                    </Badge>
                  )}
                  {user?.site && (
                    <Badge variant="outline" style={{color: logoColors?.primary || '#1e3a5f', borderColor: logoColors?.lightBorder || '#bfdbfe', background: logoColors?.light || '#eff6ff'}}>
                      {user.site}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Buscar produtos por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/80 border-gray-200 h-12"
          />
        </div>

        {/* Estatísticas e Ações */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Catálogo de Produtos ({filteredProducts.length})
          </h2>
          <Button
            onClick={exportToPDF}
            disabled={exportingPDF || filteredProducts.length === 0}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            {exportingPDF ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Gerando PDF...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Exportar PDF
              </>
            )}
          </Button>
        </div>

        {/* Produtos por Categoria */}
        {filteredProducts.length > 0 ? (() => {
          const categorias = {};
          filteredProducts.forEach(p => {
            const cat = p.categoria || 'Outros';
            if (!categorias[cat]) categorias[cat] = [];
            categorias[cat].push(p);
          });
          const catColors = [
            'from-blue-600 to-blue-700','from-emerald-600 to-emerald-700','from-violet-600 to-violet-700',
            'from-orange-500 to-orange-600','from-cyan-600 to-cyan-700','from-rose-600 to-rose-700',
            'from-teal-600 to-teal-700','from-amber-500 to-amber-600','from-indigo-600 to-indigo-700',
            'from-fuchsia-600 to-fuchsia-700',
          ];
          return Object.keys(categorias).sort().map((cat, idx) => (
            <div key={cat} className="space-y-4">
              {/* Header da Categoria */}
              <div className="rounded-xl px-5 py-4 flex items-center justify-between shadow-md" style={{background: logoColors ? `linear-gradient(135deg, ${logoColors.primaryDark} 0%, ${logoColors.primary} 60%, ${logoColors.secondary} 100%)` : `linear-gradient(135deg, #0f172a, #1e3a5f, #1e40af)`}}>
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-black leading-none tabular-nums" style={{color: 'rgba(255,255,255,0.2)'}}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2 className="font-bold text-xl leading-tight" style={{color: logoColors?.textOnPrimary || '#ffffff'}}>{cat}</h2>
                    <p className="text-xs mt-0.5" style={{color: `${logoColors?.textOnPrimary || '#ffffff'}99`}}>{categorias[cat].length} produto{categorias[cat].length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <Package className="w-8 h-8" style={{color: 'rgba(255,255,255,0.3)'}} />
              </div>

              {/* Grid da Categoria */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {categorias[cat].map((product) => (
                  <Card key={product.id} className="bg-white shadow hover:shadow-lg transition-all duration-200 overflow-hidden group">
                    <CardContent className="p-0">
                      <div className="w-full h-40 bg-white flex items-center justify-center relative">
                        {product.foto ? (
                          <img
                            src={product.foto}
                            alt={product.nome}
                            className="max-w-full max-h-full object-contain p-2"
                            onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                          />
                        ) : null}
                        <div className="absolute inset-0 flex items-center justify-center text-gray-200" style={product.foto ? {display:'none'} : {}}>
                          <ImageIcon className="w-12 h-12" />
                        </div>
                      </div>
                      <div className="p-3 border-t border-gray-50">
                        <h3 className="font-semibold text-xs text-gray-900 leading-snug line-clamp-2 mb-2 min-h-[2.5rem]">
                          {product.nome}
                        </h3>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">Cód.</span>
                            <span className="font-mono font-bold text-gray-700">{product.cod}</span>
                          </div>
                          {product.peso && (
                            <div className="flex justify-between">
                              <span className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">Peso</span>
                              <span className="text-gray-700">{product.peso} kg</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-400 uppercase tracking-wide text-[10px] font-semibold">Und.</span>
                            <span className="text-gray-700">{product.und}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ));
        })() : (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
              <p className="text-gray-600">
                {searchTerm ? "Tente ajustar os termos de busca." : "Você ainda não possui produtos cadastrados."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}