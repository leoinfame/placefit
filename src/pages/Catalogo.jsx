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

    const printContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Catálogo - ${user?.empresa || user?.full_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    @page { size: A4; margin: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; font-size: 9pt; color: #1e293b; background: #fff; }

    /* HEADER */
    .header {
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%);
      color: ${colors.textOnPrimary};
      display: flex;
      align-items: stretch;
      min-height: 72px;
      margin-bottom: 0;
    }
    .header-logo {
      background: rgba(255,255,255,0.12);
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 100px;
      border-right: 1px solid rgba(255,255,255,0.15);
    }
    .header-logo img {
      max-width: 75px;
      max-height: 55px;
      object-fit: contain;
    }
    .header-info {
      flex: 1;
      padding: 12px 18px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .header-info h1 {
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: -0.3px;
      margin-bottom: 3px;
    }
    .header-info p {
      font-size: 8pt;
      opacity: 0.85;
      line-height: 1.6;
    }
    .header-right {
      background: rgba(0,0,0,0.2);
      padding: 12px 18px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-end;
      min-width: 140px;
      border-left: 1px solid rgba(255,255,255,0.15);
      font-size: 8pt;
      opacity: 0.9;
    }
    .header-right strong { font-size: 10pt; display: block; margin-bottom: 2px; }

    .status-bar { background: ${colors.secondary}; height: 3px; margin-bottom: 16px; }

    /* GRID */
    .products-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .product-card {
      border: 1px solid ${colors.lightBorder};
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
      background: #fff;
    }

    /* IMAGE CONTAINER — contain para não cortar */
    .product-image-wrap {
      width: 100%;
      height: 130px;
      background: ${colors.light};
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid ${colors.lightBorder};
    }
    .product-image-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .no-image {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #cbd5e1;
      font-size: 22pt;
    }

    /* CARD BODY */
    .product-body { padding: 10px; }
    .product-name {
      font-weight: 700;
      font-size: 8.5pt;
      color: #0f172a;
      margin-bottom: 5px;
      line-height: 1.35;
    }
    .product-category {
      display: inline-block;
      background: ${colors.light};
      color: ${colors.primary};
      border: 1px solid ${colors.lightBorder};
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 600;
      margin-bottom: 7px;
    }
    .product-info { font-size: 7.5pt; }
    .product-info div {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      border-bottom: 1px solid ${colors.light};
    }
    .product-info div:last-child { border-bottom: none; }
    .product-info .label { color: #64748b; font-weight: 600; }
    .product-info .value { color: #1e293b; font-weight: 500; }

    /* FOOTER */
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 2px solid ${colors.lightBorder};
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #94a3b8;
      background: ${colors.light};
      padding: 8px 12px;
      border-radius: 0 0 6px 6px;
    }
    .footer span { color: ${colors.primary}; font-weight: 600; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { max-width: 100%; }
    }
  </style>
</head>
<body>

  <div class="header">
    ${user?.logomarca ? `<div class="header-logo"><img src="${user.logomarca}" alt="Logo" crossorigin="anonymous"/></div>` : ''}
    <div class="header-info">
      <h1>${user?.empresa || user?.full_name}</h1>
      <p>
        ${user?.cnpj ? `CNPJ: ${user.cnpj}` : ''}
        ${user?.whatsapp ? ` &nbsp;|&nbsp; 📱 ${user.whatsapp}` : ''}
        ${user?.site ? ` &nbsp;|&nbsp; 🌐 ${user.site}` : ''}
        ${user?.endereco ? `<br>📍 ${user.endereco}` : ''}
      </p>
    </div>
    <div class="header-right">
      <strong>CATÁLOGO</strong>
      ${filteredProducts.length} produto(s)<br>
      ${new Date().toLocaleDateString('pt-BR')}
    </div>
  </div>
  <div class="status-bar"></div>

  <div class="products-grid">
    ${filteredProducts.map(product => `
      <div class="product-card">
        <div class="product-image-wrap">
          ${product.foto
            ? `<img src="${product.foto}" alt="${product.nome}" crossorigin="anonymous"/>`
            : `<div class="no-image">📦</div>`
          }
        </div>
        <div class="product-body">
          <div class="product-name">${product.nome}</div>
          <div class="product-category">${product.categoria}</div>
          <div class="product-info">
            <div><span class="label">Código</span><span class="value">${product.cod}</span></div>
            ${product.peso ? `<div><span class="label">Peso</span><span class="value">${product.peso} kg</span></div>` : ''}
            ${product.dimensoes ? `<div><span class="label">Dimensões</span><span class="value">${product.dimensoes} cm</span></div>` : ''}
            <div><span class="label">Unidade</span><span class="value">${product.und}</span></div>
          </div>
        </div>
      </div>
    `).join('')}
  </div>

  <div class="footer">
    <span>PlaceFit</span> &nbsp;·&nbsp; Catálogo gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
    <span>${filteredProducts.length} produto(s)</span>
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
      }, 800);
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

        {/* Grid de Produtos */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="bg-white shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                <CardContent className="p-0">
                  {/* Foto */}
                  <div className="w-full h-48 bg-gray-100 relative">
                    {product.foto ? (
                      <img 
                        src={product.foto} 
                        alt={product.nome}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-gray-400" 
                      style={product.foto ? {display: 'none'} : {}}
                    >
                      <ImageIcon className="w-16 h-16" />
                    </div>
                  </div>

                  {/* Informações */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 mb-1 line-clamp-2">
                        {product.nome}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {product.categoria}
                        </Badge>
                        {product.origem === "china" && (
                          <Badge className="bg-red-50 text-red-700 border border-red-200 text-[10px]">
                            🇨🇳 Importado
                          </Badge>
                        )}
                        {product.fabricante_china_nome && (
                          <Badge className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px]">
                            {product.fabricante_china_nome}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-medium">Código:</span>
                        <span className="text-gray-900 font-semibold">{product.cod}</span>
                      </div>
                      
                      {product.peso && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Peso:</span>
                          <span className="text-gray-900">{product.peso} kg</span>
                        </div>
                      )}
                      
                      {product.dimensoes && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 font-medium">Dimensões:</span>
                          <span className="text-gray-900">{product.dimensoes} cm</span>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <span className="text-gray-600 font-medium">Unidade:</span>
                        <span className="text-gray-900">{product.und}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhum produto encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? "Tente ajustar os termos de busca." 
                  : "Você ainda não possui produtos cadastrados."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}