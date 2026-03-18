import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle, FileText, Search, ImageIcon, Package, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

export default function CatalogoWhatsApp() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredProducts(
        products.filter(p =>
          p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.cod?.toLowerCase().includes(searchTerm.toLowerCase())
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

      const isFabricante = currentUser.tipo_usuario === 'fabricante';

      if (isFabricante) {
        const allProducts = await base44.entities.Product.list();
        const myProducts = allProducts.filter(p => p.fabricante_id === currentUser.id && p.ativo !== false);
        setProducts(myProducts);
        setFilteredProducts(myProducts);
        setSupplierProducts([]);
      } else {
        // Revendedor: buscar SupplierProducts com preço
        const [allProducts, spData] = await Promise.all([
          base44.entities.Product.filter({ ativo: true }),
          base44.entities.SupplierProduct.filter({ supplier_id: currentUser.id, disponivel: true })
        ]);
        const validSP = spData.filter(sp => sp.preco && parseFloat(sp.preco) > 0);
        setSupplierProducts(validSP);
        const productIds = validSP.map(sp => sp.product_id);
        const myProducts = allProducts.filter(p => productIds.includes(p.id));
        setProducts(myProducts);
        setFilteredProducts(myProducts);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const getPrice = (product) => {
    if (user?.tipo_usuario === 'fabricante') {
      return product.preco_fabricante ? parseFloat(product.preco_fabricante) : null;
    }
    const sp = supplierProducts.find(s => s.product_id === product.id);
    return sp?.preco ? parseFloat(sp.preco) : null;
  };

  const formatPrice = (price) => {
    if (!price) return null;
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const generateWhatsAppPDF = async () => {
    if (filteredProducts.length === 0) {
      toast({ title: "Sem produtos", description: "Nenhum produto disponível para gerar o catálogo.", variant: "destructive" });
      return;
    }

    setGenerating(true);

    // Agrupar por categoria
    const categorias = {};
    filteredProducts.forEach(p => {
      const cat = p.categoria || 'Outros';
      if (!categorias[cat]) categorias[cat] = [];
      categorias[cat].push(p);
    });

    const nomeEmpresa = user?.empresa || user?.full_name || '';
    const data = new Date().toLocaleDateString('pt-BR');
    const whatsapp = user?.whatsapp || '';

    // Grid de produtos compacto — 2 colunas para WhatsApp (fácil leitura no celular)
    const buildGrid = (prods) => prods.map(p => {
      const price = getPrice(p);
      return `
        <div style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;break-inside:avoid;page-break-inside:avoid;">
          <div style="width:100%;height:140px;background:#f8fafc;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #f1f5f9;">
            ${p.foto
              ? `<img src="${p.foto}" crossorigin="anonymous" style="max-width:100%;max-height:140px;object-fit:contain;display:block;padding:8px;" />`
              : `<span style="font-size:32pt;color:#e2e8f0;">📦</span>`
            }
          </div>
          <div style="padding:10px 10px 12px;">
            <div style="font-size:9pt;font-weight:700;color:#0f172a;line-height:1.3;margin-bottom:6px;min-height:2.6em;overflow:hidden;">${p.nome}</div>
            <div style="font-size:7.5pt;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Cód. <span style="color:#475569;font-family:monospace;">${p.cod}</span></div>
            ${price
              ? `<div style="font-size:12pt;font-weight:900;color:#16a34a;margin-top:4px;">${formatPrice(price)}</div>`
              : `<div style="font-size:8pt;color:#94a3b8;margin-top:4px;">Consultar preço</div>`
            }
            <div style="font-size:7pt;color:#cbd5e1;margin-top:3px;">${p.und ? `Und: ${p.und}` : ''}</div>
          </div>
        </div>`;
    }).join('');

    const categorySections = Object.entries(categorias).map(([cat, prods]) => `
      <div style="margin-bottom:24px;page-break-inside:avoid;">
        <div style="background:#128c7e;color:#fff;font-size:11pt;font-weight:800;padding:10px 16px;border-radius:8px;margin-bottom:12px;letter-spacing:0.3px;">
          📦 ${cat} <span style="font-size:8pt;font-weight:400;opacity:0.75;margin-left:8px;">${prods.length} produto${prods.length > 1 ? 's' : ''}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${buildGrid(prods)}
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Catálogo WhatsApp — ${nomeEmpresa}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    @page { size: A4; margin: 10mm; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',Arial,sans-serif; background:#ece5dd; color:#1e293b; }
    .wrapper { max-width:190mm; margin:0 auto; }

    /* CAPA WHATSAPP */
    .cover {
      background: linear-gradient(160deg, #075e54 0%, #128c7e 60%, #25d366 100%);
      border-radius:16px;
      padding:32px 28px 36px;
      margin-bottom:20px;
      color:#fff;
      position:relative;
      overflow:hidden;
    }
    .cover::after {
      content:'';
      position:absolute;
      right:-40px; bottom:-40px;
      width:180px; height:180px;
      border-radius:50%;
      background:rgba(255,255,255,0.06);
    }
    .cover-logo {
      width:70px;height:70px;object-fit:contain;
      background:#fff;border-radius:12px;padding:6px;
      margin-bottom:16px;display:block;
    }
    .cover-logo-placeholder {
      width:70px;height:70px;background:rgba(255,255,255,0.15);
      border-radius:12px;margin-bottom:16px;
      display:flex;align-items:center;justify-content:center;font-size:28pt;
    }
    .cover-title { font-size:22pt;font-weight:900;line-height:1.1;margin-bottom:4px; }
    .cover-sub { font-size:9pt;opacity:.75;font-weight:500;margin-bottom:16px; }
    .cover-badges { display:flex;gap:8px;flex-wrap:wrap; }
    .cover-badge {
      background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);
      border-radius:20px;padding:4px 12px;font-size:8pt;font-weight:600;
    }
    .cover-wa-icon { font-size:48pt;position:absolute;right:24px;top:50%;transform:translateY(-50%);opacity:.18; }

    /* PRODUTOS */
    .section-title {
      display:flex;align-items:center;gap:8px;
      font-size:9pt;font-weight:700;color:#475569;
      text-transform:uppercase;letter-spacing:1px;
      border-bottom:2px solid #25d366;padding-bottom:6px;margin-bottom:14px;
    }
    .wa-footer {
      background:#128c7e;color:#fff;border-radius:10px;
      padding:14px 18px;text-align:center;margin-top:24px;
    }
    .wa-footer-brand { font-size:13pt;font-weight:800;margin-bottom:4px; }
    .wa-footer-contact { font-size:9pt;opacity:.85; }
    .wa-footer-note { font-size:7.5pt;opacity:.6;margin-top:6px; }
  </style>
</head>
<body>
<div class="wrapper">

  <!-- CAPA -->
  <div class="cover">
    <div class="cover-wa-icon">💬</div>
    ${user?.logomarca
      ? `<img src="${user.logomarca}" alt="" crossorigin="anonymous" class="cover-logo" />`
      : `<div class="cover-logo-placeholder">🏋️</div>`
    }
    <div class="cover-title">${nomeEmpresa}</div>
    <div class="cover-sub">Catálogo de Produtos · ${data}</div>
    <div class="cover-badges">
      <span class="cover-badge">📦 ${filteredProducts.length} produto${filteredProducts.length !== 1 ? 's' : ''}</span>
      <span class="cover-badge">🗂 ${Object.keys(categorias).length} categoria${Object.keys(categorias).length !== 1 ? 's' : ''}</span>
      ${whatsapp ? `<span class="cover-badge">📱 ${whatsapp}</span>` : ''}
    </div>
  </div>

  <!-- PRODUTOS POR CATEGORIA -->
  ${categorySections}

  <!-- RODAPÉ -->
  <div class="wa-footer">
    <div class="wa-footer-brand">💬 ${nomeEmpresa}</div>
    ${whatsapp ? `<div class="wa-footer-contact">📱 ${whatsapp}</div>` : ''}
    ${user?.email ? `<div class="wa-footer-contact">✉ ${user.email}</div>` : ''}
    <div class="wa-footer-note">Catálogo gerado em ${data} via PlaceFit · Preços sujeitos a alterações sem aviso prévio.</div>
  </div>

</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      setTimeout(() => {
        win.print();
        setGenerating(false);
        toast({ title: "Catálogo WhatsApp gerado!", description: "Salve como PDF e envie pelo WhatsApp." });
      }, 1000);
    };
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Agrupar para preview
  const categorias = {};
  filteredProducts.forEach(p => {
    const cat = p.categoria || 'Outros';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(p);
  });

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-green-600" />
              Catálogo WhatsApp
            </h1>
            <p className="text-gray-500 text-sm mt-1">PDF compacto com foto, código e preço — ideal para enviar pelo WhatsApp</p>
          </div>
          <Button
            onClick={generateWhatsAppPDF}
            disabled={generating || filteredProducts.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {generating ? "Gerando PDF..." : "Gerar PDF WhatsApp"}
          </Button>
        </div>

        {/* Info box */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <MessageCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <strong>Como funciona:</strong> O PDF gerado usa layout de grade 2 colunas, com foto grande, nome, código e preço. Otimizado para leitura no celular após compartilhar pelo WhatsApp.
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Filtrar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>

        {/* Stats */}
        <div className="flex gap-3 text-sm text-gray-500">
          <Badge variant="secondary">{filteredProducts.length} produtos</Badge>
          <Badge variant="secondary">{Object.keys(categorias).length} categorias</Badge>
        </div>

        {/* Preview grid */}
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum produto disponível</p>
              <p className="text-sm text-gray-400 mt-1">Configure preços em "Meus Produtos" para exibi-los aqui.</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(categorias).map(([cat, prods]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-5 bg-green-500 rounded-full" />
                <h2 className="font-bold text-gray-800">{cat}</h2>
                <span className="text-xs text-gray-400">{prods.length} item(s)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {prods.map(p => {
                  const price = getPrice(p);
                  return (
                    <Card key={p.id} className="overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        <div className="h-32 bg-gray-50 flex items-center justify-center border-b border-gray-100">
                          {p.foto
                            ? <img src={p.foto} alt={p.nome} className="max-h-full max-w-full object-contain p-2" />
                            : <ImageIcon className="w-10 h-10 text-gray-200" />
                          }
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-gray-900 line-clamp-2 min-h-[2.4em] leading-snug">{p.nome}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-1">Cód. {p.cod}</p>
                          {price
                            ? <p className="text-sm font-black text-green-600 mt-1">{formatPrice(price)}</p>
                            : <p className="text-xs text-gray-400 mt-1">Consultar preço</p>
                          }
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}