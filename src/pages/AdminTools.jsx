import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function AdminTools() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const handleUpdateSupportProducts = async () => {
    setLoading(true);
    try {
      const allProducts = await base44.entities.Product.list();
      const productsToUpdate = allProducts.filter(p => 
        p.nome && p.nome.trim().startsWith('Suporte')
      );

      if (productsToUpdate.length === 0) {
        toast({
          title: "Nenhum produto encontrado",
          description: 'Nenhum produto começando com "Suporte"',
        });
        setResult({ success: true, updated: 0 });
        setLoading(false);
        return;
      }

      let updated = 0;
      for (const product of productsToUpdate) {
        await base44.entities.Product.update(product.id, {
          categoria: 'Suportes'
        });
        updated++;
      }

      setResult({
        success: true,
        updated,
        products: productsToUpdate.map(p => p.nome)
      });

      toast({
        title: "Sucesso!",
        description: `${updated} produto(s) atualizado(s)`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Ferramentas Administrativas</h1>

      <Card>
        <CardHeader>
          <CardTitle>Atualizar Categoria de Produtos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Produtos que começam com 'Suporte' → Categoria 'Suportes'</h3>
            <p className="text-sm text-gray-600 mb-4">
              Esta operação atualizará a categoria de todos os produtos cujo nome começa com "Suporte" para "Suportes".
            </p>
            <Button
              onClick={handleUpdateSupportProducts}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Processando..." : "Executar Atualização"}
            </Button>
          </div>

          {result && (
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.success ? `✓ ${result.updated} produto(s) atualizado(s)` : 'Erro na operação'}
              </p>
              {result.products && result.products.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium mb-2">Produtos atualizados:</p>
                  <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
                    {result.products.map((nome, idx) => (
                      <li key={idx} className="text-gray-700">• {nome}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}