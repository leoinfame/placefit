import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLogoColors } from "@/components/export/useLogoColors";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  Dumbbell, 
  Phone, 
  Mail, 
  Globe, 
  MapPin,
  Download,
  AlertCircle
} from "lucide-react";

export default function PublicTable() {
  const [supplier, setSupplier] = useState(null);
  const [products, setProducts] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const colors = useLogoColors(supplier?.logomarca);

  useEffect(() => {
    loadTableData();
  }, []);

  const loadTableData = async () => {
    try {
      // Pegar ID do fornecedor da URL
      const urlParams = new URLSearchParams(window.location.search);
      const supplierId = urlParams.get('supplier');

      if (!supplierId) {
        setError("Link inválido. Fornecedor não encontrado.");
        setLoading(false);
        return;
      }

      // Carregar dados do fornecedor
      const users = await base44.entities.User.filter({ id: supplierId });
      if (users.length === 0) {
        setError("Fornecedor não encontrado.");
        setLoading(false);
        return;
      }

      const supplierData = users[0];
      setSupplier(supplierData);

      // Carregar produtos do fornecedor
      const [allProducts, supplierProductsData] = await Promise.all([
        base44.entities.Product.filter({ ativo: true }),
        base44.entities.SupplierProduct.filter({ 
          supplier_id: supplierId, 
          disponivel: true 
        })
      ]);

      setProducts(allProducts);
      setSupplierProducts(supplierProductsData.filter(sp => sp.preco > 0));

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setError("Erro ao carregar tabela. Tente novamente.");
    }
    setLoading(false);
  };

  const getTableData = () => {
    return supplierProducts.map(sp => {
      const product = products.find(p => p.id === sp.product_id);
      return product ? {
        codigo: product.cod,
        nome: product.nome,
        categoria: product.categoria,
        unidade: product.und,
        peso: product.peso ? `${product.peso} kg` : '-',
        dimensoes: product.dimensoes || '-',
        preco: sp.preco,
        observacoes: sp.observacoes || ''
      } : null;
    }).filter(Boolean);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto">
            <Dumbbell className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="animate-pulse text-gray-600">Carregando tabela...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tableData = getTableData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-full { page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header com Logo FitPlace */}
        <div className="text-center mb-6 no-print">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Dumbbell className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            FitPlace
          </h1>
          <p className="text-gray-600">Plataforma de Fornecedores</p>
        </div>

        {/* Botão de Impressão */}
        <div className="flex justify-end no-print">
          <Button
            onClick={handlePrint}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Imprimir / Salvar PDF
          </Button>
        </div>

        {/* Tabela */}
        <Card className="bg-white shadow-2xl border-0 print-full">
          <CardContent className="p-8">
            {/* Cabeçalho do Fornecedor */}
            <div className="text-center mb-8">
              {supplier.logomarca && (
                <div className="w-24 h-24 mx-auto mb-4 rounded-lg overflow-hidden bg-gray-100 p-2">
                  <img 
                    src={supplier.logomarca} 
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                {supplier.empresa || supplier.full_name}
              </h2>
              
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600 mb-2">
                {supplier.whatsapp && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {supplier.whatsapp}
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {supplier.email}
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
                {supplier.endereco && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {supplier.endereco}
                  </div>
                )}
                {supplier.site && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    <a href={supplier.site} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {supplier.site.replace(/https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
              
              <Separator className="my-6" />
              
              <h3 className="text-2xl font-bold text-gray-800 mb-1">TABELA DE PREÇOS</h3>
              <p className="text-sm text-gray-500">
                Atualizada em {new Date().toLocaleDateString('pt-BR', { 
                  day: '2-digit', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
            </div>

            {/* Tabela de Produtos */}
            {tableData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{background: 'transparent', borderBottom: `2px solid ${colors ? colors.primary : '#1e3a5f'}`}}>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900 bg-white">Código</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900 bg-white">Produto</th>
                      <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-gray-900 bg-white">Categoria</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-900 bg-white">Unidade</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-900 bg-white">Peso</th>
                      <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-gray-900 bg-white">Dimensões</th>
                      <th className="border border-gray-200 px-4 py-3 text-right font-semibold text-gray-900 bg-white">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                        <td className="border border-gray-300 px-4 py-3 font-mono text-sm">
                          {item.codigo}
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="font-medium text-gray-900">{item.nome}</div>
                          {item.observacoes && (
                            <div className="text-xs text-gray-500 mt-1">{item.observacoes}</div>
                          )}
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {item.categoria}
                          </Badge>
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center">
                          {item.unidade}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                          {item.peso}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center text-sm">
                          {item.dimensoes}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right">
                          <span className="font-bold text-lg text-green-700">
                            R$ {item.preco.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100">
                      <td colSpan="6" className="border border-gray-300 px-4 py-3 text-right font-bold">
                        TOTAL:
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right">
                        <span className="font-bold text-xl text-green-700">
                          R$ {tableData.reduce((sum, item) => sum + item.preco, 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto disponível</h3>
                <p className="text-gray-600">O fornecedor ainda não configurou produtos e preços.</p>
              </div>
            )}

            {/* Rodapé */}
            <div className="mt-8 pt-6 border-t text-center text-sm text-gray-500">
              <p>Tabela gerada pela plataforma FitPlace</p>
              <p>Preços e disponibilidade sujeitos a alterações sem aviso prévio</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}