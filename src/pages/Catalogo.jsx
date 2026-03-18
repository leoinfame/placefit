import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Search, ImageIcon, FileText } from "lucide-react";
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

    // Paleta de acentos para separadores de categoria (ciclica)
    const accentPalette = [
      colors.primary, colors.secondary, colors.primaryDark,
      '#7c3aed','#0891b2','#b45309','#be123c','#166534','#1d4ed8','#9333ea',
    ];

    const buildCategorySections = () => categoriasOrdenadas.map((cat, idx) => {
      const prods = categorias[cat];
      const accent = accentPalette[idx % accentPalette.length];
      // luminance simples para texto no accent
      const hexToRgb = h => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return {r,g,b}; };
      const {r,g,b} = hexToRgb(accent);
      const lum = 0.299*r+0.587*g+0.114*b;
      const textOnAccent = lum > 140 ? '#1e293b' : '#ffffff';

      const cards = prods.map(product => `
        <div class="product-card">
          <div class="card-accent-line" style="background:${accent}"></div>
          <div class="product-image-wrap">
            ${product.foto
              ? `<img src="${product.foto}" alt="${product.nome}" crossorigin="anonymous"/>`
              : `<div class="no-image">📦</div>`
            }
          </div>
          <div class="product-body">
            <div class="product-name">${product.nome}</div>
            <div class="product-info">
              <div><span class="label">Cód.</span><span class="value mono">${product.cod}</span></div>
              ${product.peso ? `<div><span class="label">Peso</span><span class="value">${product.peso} kg</span></div>` : ''}
              ${product.dimensoes ? `<div><span class="label">Dim.</span><span class="value">${product.dimensoes} cm</span></div>` : ''}
              <div><span class="label">Und.</span><span class="value">${product.und}</span></div>
            </div>
          </div>
        </div>`).join('');

      return `
        <div class="category-section">
          <div class="category-header" style="background:${accent};color:${textOnAccent}">
            <div class="cat-left">
              <div class="cat-number">${String(idx+1).padStart(2,'0')}</div>
              <div>
                <div class="cat-name">${cat}</div>
                <div class="cat-sub">${prods.length} produto${prods.length > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div class="cat-divider" style="border-color:${textOnAccent}40"></div>
          </div>
          <div class="products-grid">${cards}</div>
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

    /* ===== PÁGINAS DE CONTEÚDO ===== */
    .content-page {
      background: #f1f5f9;
      padding: 14mm 14mm 10mm;
    }

    /* ===== STICKY HEADER (repetido por página) ===== */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 2px solid ${colors.lightBorder};
    }
    .page-header-logo { display: flex; align-items: center; gap: 8px; }
    .page-header-logo img { max-width: 40px; max-height: 28px; object-fit: contain; }
    .page-header-company { font-size: 8.5pt; font-weight: 700; color: ${colors.primary}; }
    .page-header-right { font-size: 7pt; color: #94a3b8; text-align: right; }

    /* ===== SEPARADOR DE CATEGORIA ===== */
    .category-section { margin-bottom: 20px; }
    .category-header {
      display: flex;
      align-items: center;
      border-radius: 8px 8px 0 0;
      padding: 10px 16px;
      margin-bottom: 0;
      gap: 12px;
    }
    .cat-left { display: flex; align-items: center; gap: 12px; }
    .cat-number {
      font-size: 20pt;
      font-weight: 900;
      opacity: 0.3;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .cat-name { font-size: 12pt; font-weight: 800; letter-spacing: -0.3px; line-height: 1.1; }
    .cat-sub { font-size: 7.5pt; opacity: 0.75; margin-top: 1px; }
    .cat-divider { flex: 1; height: 1px; border-top: 1px dashed; margin-left: 8px; }

    /* ===== GRID DE PRODUTOS ===== */
    .products-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #e2e8f0;
      border: 1px solid #e2e8f0;
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 8px;
    }
    .product-card {
      background: #fff;
      border-radius: 6px;
      overflow: hidden;
      page-break-inside: avoid;
      position: relative;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .card-accent-line {
      height: 3px;
      width: 100%;
    }

    /* IMAGE */
    .product-image-wrap {
      width: 100%;
      height: 100px;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .product-image-wrap img {
      max-width: 100%;
      max-height: 96px;
      object-fit: contain;
      display: block;
    }
    .no-image {
      font-size: 18pt;
      color: #e2e8f0;
    }

    /* CARD BODY */
    .product-body { padding: 8px 8px 6px; }
    .product-name {
      font-weight: 700;
      font-size: 7.5pt;
      color: #0f172a;
      margin-bottom: 5px;
      line-height: 1.3;
      min-height: 2.6em;
    }
    .product-info { font-size: 6.5pt; }
    .product-info div {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
      border-bottom: 1px solid #f8fafc;
    }
    .product-info div:last-child { border-bottom: none; }
    .product-info .label { color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .product-info .value { color: #1e293b; font-weight: 600; }
    .product-info .mono { font-family: monospace; font-size: 7pt; }

    /* ===== FOOTER ===== */
    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      font-size: 7pt;
      color: #94a3b8;
    }
    .page-footer span { color: ${colors.primary}; font-weight: 600; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: #f1f5f9; }
      .cover { page-break-after: always; }
    }
  </style>
</head>
<body>

  <!-- CAPA -->
  <div class="cover">
    <div class="cover-accent"></div>
    ${user?.logomarca ? `<div class="cover-logo-wrap"><img src="${user.logomarca}" alt="Logo" crossorigin="anonymous"/></div>` : ''}
    <div class="cover-company">${user?.empresa || user?.full_name}</div>
    <div class="cover-tag">Catálogo de Produtos</div>
    <div class="cover-badge">📅 ${new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})}</div>
    <div class="cover-stats">
      <div class="cover-stat"><strong>${filteredProducts.length}</strong><small>Produtos</small></div>
      <div class="cover-stat"><strong>${totalCategorias}</strong><small>Categorias</small></div>
    </div>
    <div class="cover-contact">
      ${user?.cnpj ? `<span>🏢 CNPJ: ${user.cnpj}</span>` : ''}
      ${user?.whatsapp ? `<span>📱 ${user.whatsapp}</span>` : ''}
      ${user?.site ? `<span>🌐 ${user.site}</span>` : ''}
      ${user?.endereco ? `<span>📍 ${user.endereco}</span>` : ''}
    </div>
  </div>

  <!-- CONTEÚDO -->
  <div class="content-page">
    <div class="page-header">
      <div class="page-header-logo">
        ${user?.logomarca ? `<img src="${user.logomarca}" alt="Logo" crossorigin="anonymous"/>` : ''}
        <div class="page-header-company">${user?.empresa || user?.full_name}</div>
      </div>
      <div class="page-header-right">
        Catálogo de Produtos &nbsp;·&nbsp; ${filteredProducts.length} itens em ${totalCategorias} categorias
      </div>
    </div>

    ${buildCategorySections()}

    <div class="page-footer">
      <span>PlaceFit</span> &nbsp;·&nbsp; Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
      <span>${filteredProducts.length} produto(s) · ${totalCategorias} categoria(s)</span>
    </div>
  </div>

</body>
</html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        setExportingPDF(false);
        toast({ title: "PDF gerado!", description: "Use a janela de impressão para salvar como PDF." });
      }, 1000);
    };
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
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-0 shadow-lg">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {user?.logomarca && (
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-xl shadow-md p-4 flex-shrink-0">
                  <img 
                    src={user.logomarca} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">
                  {user?.empresa || user?.full_name}
                </h1>
                {user?.cnpj && (
                  <p className="text-gray-600 mb-1">CNPJ: {user.cnpj}</p>
                )}
                {user?.endereco && (
                  <p className="text-gray-600 mb-1">{user.endereco}</p>
                )}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start mt-3">
                  {user?.whatsapp && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      WhatsApp: {user.whatsapp}
                    </Badge>
                  )}
                  {user?.site && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
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
              <div className={`bg-gradient-to-r ${catColors[idx % catColors.length]} rounded-xl px-5 py-4 flex items-center justify-between shadow-md`}>
                <div className="flex items-center gap-4">
                  <span className="text-4xl font-black text-white/20 leading-none tabular-nums">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h2 className="text-white font-bold text-xl leading-tight">{cat}</h2>
                    <p className="text-white/70 text-xs mt-0.5">{categorias[cat].length} produto{categorias[cat].length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <Package className="w-8 h-8 text-white/30" />
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