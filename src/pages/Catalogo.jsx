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
        // Revendedor vê seus produtos selecionados
        const supplierProducts = await base44.entities.SupplierProduct.filter({ 
          supplier_id: currentUser.id 
        });
        const productIds = supplierProducts.map(sp => sp.product_id);
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

  const exportToPDF = () => {
    setExportingPDF(true);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Catálogo - ${user?.empresa || user?.full_name}</title>
        <style>
          @page { 
            size: A4; 
            margin: 15mm; 
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            color: #333;
          }
          .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 3px solid #2563eb;
            margin-bottom: 20px;
          }
          .header img {
            max-width: 120px;
            max-height: 80px;
            margin-bottom: 10px;
          }
          .header h1 {
            color: #2563eb;
            font-size: 24pt;
            margin-bottom: 5px;
          }
          .header p {
            color: #666;
            font-size: 10pt;
            margin: 3px 0;
          }
          .products-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-top: 20px;
          }
          .product-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 12px;
            page-break-inside: avoid;
            background: #fff;
          }
          .product-image {
            width: 100%;
            height: 150px;
            object-fit: cover;
            border-radius: 6px;
            margin-bottom: 10px;
            background: #f3f4f6;
          }
          .product-name {
            font-weight: bold;
            font-size: 11pt;
            color: #1f2937;
            margin-bottom: 8px;
            line-height: 1.3;
          }
          .product-category {
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 9pt;
            margin-bottom: 8px;
          }
          .product-info {
            font-size: 9pt;
            color: #666;
          }
          .product-info div {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          .product-info div:last-child {
            border-bottom: none;
          }
          .product-info .label {
            font-weight: 600;
            color: #4b5563;
          }
          .product-info .value {
            color: #1f2937;
            font-weight: 500;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            font-size: 9pt;
            color: #999;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${user?.logomarca ? `<img src="${user.logomarca}" alt="Logo" />` : ''}
          <h1>${user?.empresa || user?.full_name}</h1>
          ${user?.cnpj ? `<p><strong>CNPJ:</strong> ${user.cnpj}</p>` : ''}
          ${user?.endereco ? `<p>${user.endereco}</p>` : ''}
          ${user?.whatsapp ? `<p><strong>WhatsApp:</strong> ${user.whatsapp}</p>` : ''}
          ${user?.site ? `<p><strong>Site:</strong> ${user.site}</p>` : ''}
        </div>
        
        <div class="products-grid">
          ${filteredProducts.map(product => `
            <div class="product-card">
              ${product.foto ? `<img src="${product.foto}" class="product-image" alt="${product.nome}" />` : '<div class="product-image"></div>'}
              <div class="product-name">${product.nome}</div>
              <div class="product-category">${product.categoria}</div>
              <div class="product-info">
                <div>
                  <span class="label">Código:</span>
                  <span class="value">${product.cod}</span>
                </div>
                ${product.peso ? `
                  <div>
                    <span class="label">Peso:</span>
                    <span class="value">${product.peso} kg</span>
                  </div>
                ` : ''}
                ${product.dimensoes ? `
                  <div>
                    <span class="label">Dimensões:</span>
                    <span class="value">${product.dimensoes} cm</span>
                  </div>
                ` : ''}
                <div>
                  <span class="label">Unidade:</span>
                  <span class="value">${product.und}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="footer">
          <p>Catálogo gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          <p>Total de ${filteredProducts.length} produto(s)</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        setExportingPDF(false);
        toast({
          title: "PDF gerado!",
          description: "Use a janela de impressão para salvar como PDF.",
        });
      }, 500);
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
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {product.categoria}
                      </Badge>
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