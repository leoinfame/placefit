import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, FileText, Download, DollarSign, TrendingUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

export default function Financeiro() {
  const [user, setUser] = useState(null);
  const [vendas, setVendas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [allPedidos, productsData] = await Promise.all([
        base44.entities.Pedido.list('-created_date'),
        base44.entities.Product.list()
      ]);

      const vendasData = allPedidos.filter(
        p => p.fornecedor_id === currentUser.id && p.tipo === 'venda'
      );

      // Calcular lucro para cada venda
      const vendasComLucro = vendasData.map(venda => {
        let lucroTotal = 0;
        let custoTotal = 0;
        
        venda.itens.forEach(item => {
          const produto = productsData.find(p => p.id === item.product_id);
          if (produto && produto.preco_fabricante) {
            const precoFabricante = parseFloat(produto.preco_fabricante);
            const precoVenda = parseFloat(item.preco_unitario);
            const custoItem = precoFabricante * item.quantidade;
            const lucroItem = (precoVenda - precoFabricante) * item.quantidade;
            
            custoTotal += custoItem;
            lucroTotal += lucroItem;
          }
        });
        
        return { ...venda, lucro_total: lucroTotal, custo_total: custoTotal };
      });

      setVendas(vendasComLucro);
      setProdutos(productsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const vendasFiltradas = vendas.filter(venda => {
    const dataVenda = new Date(venda.data_pedido);
    
    if (dataInicio) {
      const inicio = new Date(dataInicio);
      if (dataVenda < inicio) return false;
    }
    
    if (dataFim) {
      const fim = new Date(dataFim);
      if (dataVenda > fim) return false;
    }
    
    return true;
  });

  const totais = vendasFiltradas.reduce((acc, venda) => {
    return {
      totalVendas: acc.totalVendas + (venda.total || 0),
      totalFrete: acc.totalFrete + (venda.frete || 0),
      totalLucro: acc.totalLucro + (venda.lucro_total || 0),
      totalCusto: acc.totalCusto + (venda.custo_total || 0)
    };
  }, { totalVendas: 0, totalFrete: 0, totalLucro: 0, totalCusto: 0 });

  const gerarRelatorio = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório Financeiro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 30px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .company-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
    .report-title { font-size: 16px; font-weight: bold; margin-top: 15px; color: #2563eb; }
    .periodo { font-size: 12px; color: #666; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 11px; }
    th, td { border: 1px solid #333; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; font-weight: bold; }
    .text-right { text-align: right; }
    .resumo { margin-top: 30px; padding: 20px; background-color: #f9f9f9; border: 2px solid #2563eb; }
    .resumo h3 { font-size: 14px; margin-bottom: 15px; color: #2563eb; }
    .resumo-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 12px; }
    .resumo-item.total { font-weight: bold; font-size: 14px; border-top: 2px solid #333; margin-top: 10px; padding-top: 10px; color: #16a34a; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${user?.empresa || user?.full_name}</div>
    <div class="report-title">RELATÓRIO FINANCEIRO</div>
    <div class="periodo">
      Período: ${dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : 'Início'} até ${dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : 'Atual'}
    </div>
    <div class="periodo">Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Pedido</th>
        <th>Cliente</th>
        <th class="text-right">Subtotal</th>
        <th class="text-right">Frete</th>
        <th class="text-right">Total</th>
        <th class="text-right">Custo</th>
        <th class="text-right">Lucro</th>
      </tr>
    </thead>
    <tbody>
      ${vendasFiltradas.map(venda => `
        <tr>
          <td>${new Date(venda.data_pedido).toLocaleDateString('pt-BR')}</td>
          <td>${venda.numero_pedido}</td>
          <td>${venda.cliente_nome}</td>
          <td class="text-right">R$ ${venda.subtotal.toFixed(2)}</td>
          <td class="text-right">R$ ${venda.frete.toFixed(2)}</td>
          <td class="text-right">R$ ${venda.total.toFixed(2)}</td>
          <td class="text-right">R$ ${venda.custo_total.toFixed(2)}</td>
          <td class="text-right">R$ ${venda.lucro_total.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="resumo">
    <h3>RESUMO DO PERÍODO</h3>
    <div class="resumo-item">
      <span>Total de Pedidos:</span>
      <span><strong>${vendasFiltradas.length}</strong></span>
    </div>
    <div class="resumo-item">
      <span>Total em Vendas (sem frete):</span>
      <span>R$ ${(totais.totalVendas - totais.totalFrete).toFixed(2)}</span>
    </div>
    <div class="resumo-item">
      <span>Total em Fretes:</span>
      <span>R$ ${totais.totalFrete.toFixed(2)}</span>
    </div>
    <div class="resumo-item">
      <span>Total Faturado:</span>
      <span>R$ ${totais.totalVendas.toFixed(2)}</span>
    </div>
    <div class="resumo-item">
      <span>Total em Custos:</span>
      <span>R$ ${totais.totalCusto.toFixed(2)}</span>
    </div>
    <div class="resumo-item total">
      <span>LUCRO LÍQUIDO:</span>
      <span>R$ ${totais.totalLucro.toFixed(2)}</span>
    </div>
    <div class="resumo-item">
      <span>Margem de Lucro:</span>
      <span>${totais.totalVendas > 0 ? ((totais.totalLucro / totais.totalVendas) * 100).toFixed(1) : 0}%</span>
    </div>
  </div>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => printWindow.print(), 500);
    };

    toast({ title: "Relatório gerado!", description: "Abrindo janela de impressão/PDF." });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Financeiro</h1>
            <p className="text-gray-600">Relatório financeiro de vendas e lucros</p>
          </div>
          <Button
            onClick={gerarRelatorio}
            disabled={vendasFiltradas.length === 0}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Gerar Relatório PDF
          </Button>
        </div>

        {/* Filtros */}
        <Card className="bg-white/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filtrar por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>
            {(dataInicio || dataFim) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDataInicio(""); setDataFim(""); }}
                className="mt-4"
              >
                Limpar Filtros
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4 text-center">
              <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{vendasFiltradas.length}</div>
              <p className="text-sm text-blue-700">Pedidos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">
                R$ {totais.totalVendas.toFixed(2)}
              </div>
              <p className="text-sm text-green-700">Total Faturado</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">
                R$ {totais.totalCusto.toFixed(2)}
              </div>
              <p className="text-sm text-purple-700">Total Custos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-emerald-900">
                R$ {totais.totalLucro.toFixed(2)}
              </div>
              <p className="text-sm text-emerald-700">Lucro Líquido</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Vendas - Desktop */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hidden md:block">
          <CardHeader>
            <CardTitle>Detalhamento de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {vendasFiltradas.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma venda no período</h3>
                <p className="text-gray-600">Ajuste os filtros de data ou aguarde novas vendas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                      <TableHead className="text-white font-semibold">Data</TableHead>
                      <TableHead className="text-white font-semibold">Pedido</TableHead>
                      <TableHead className="text-white font-semibold">Cliente</TableHead>
                      <TableHead className="text-white font-semibold text-right">Subtotal</TableHead>
                      <TableHead className="text-white font-semibold text-right">Frete</TableHead>
                      <TableHead className="text-white font-semibold text-right">Total</TableHead>
                      <TableHead className="text-white font-semibold text-right">Custo</TableHead>
                      <TableHead className="text-white font-semibold text-right">Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendasFiltradas.map((venda, index) => (
                      <TableRow key={venda.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <TableCell>{new Date(venda.data_pedido).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="font-mono text-sm">{venda.numero_pedido}</TableCell>
                        <TableCell>{venda.cliente_nome}</TableCell>
                        <TableCell className="text-right">R$ {venda.subtotal.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {venda.frete.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-blue-700">
                          R$ {venda.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          R$ {venda.custo_total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-700">
                          R$ {venda.lucro_total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cards de Vendas - Mobile */}
        <div className="md:hidden space-y-3">
          {vendasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma venda</h3>
                <p className="text-gray-600 text-sm">Ajuste os filtros de data</p>
              </CardContent>
            </Card>
          ) : (
            vendasFiltradas.map((venda) => (
              <Card key={venda.id} className="bg-white shadow">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-xs text-gray-500">{venda.numero_pedido}</p>
                        <h3 className="font-semibold text-sm">{venda.cliente_nome}</h3>
                        <p className="text-xs text-gray-500">{new Date(venda.data_pedido).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">R$ {venda.total.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">Frete: R$ {venda.frete.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                      <div>
                        <span className="text-gray-500">Custo:</span>
                        <span className="ml-1 text-red-600 font-semibold">R$ {venda.custo_total.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500">Lucro:</span>
                        <span className="ml-1 text-green-600 font-bold">R$ {venda.lucro_total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Resumo Final */}
        {vendasFiltradas.length > 0 && (
          <Card className="bg-gradient-to-br from-blue-50 to-green-50 border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Resumo do Período</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total de Pedidos:</span>
                <span className="font-bold">{vendasFiltradas.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total em Vendas (sem frete):</span>
                <span className="font-semibold">R$ {(totais.totalVendas - totais.totalFrete).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total em Fretes:</span>
                <span className="font-semibold">R$ {totais.totalFrete.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total Faturado:</span>
                <span className="font-semibold text-blue-700">R$ {totais.totalVendas.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total em Custos:</span>
                <span className="font-semibold text-red-600">R$ {totais.totalCusto.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-3">
                <span className="text-gray-900">LUCRO LÍQUIDO:</span>
                <span className="text-green-700">R$ {totais.totalLucro.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Margem de Lucro:</span>
                <span className="font-semibold text-green-600">
                  {totais.totalVendas > 0 ? ((totais.totalLucro / totais.totalVendas) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}