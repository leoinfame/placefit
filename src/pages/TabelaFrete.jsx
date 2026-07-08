import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Truck, Edit3, Download, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { CAPITAIS_POR_UF } from "@/utils/frete";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

// Valores confirmados a partir da tabela oficial em muscularfit.com.br/categorias/frete.html
// (7 estados não listados na página não entram aqui: AC, AL, PB, RN, RO, SE, TO)
const TABELA_PADRAO = [
  { estado: "SP", valor_minimo: 450, preco_kg_capital: 1.30, preco_kg_interior: 1.40, observacoes: "Valores diferenciados para divisas com MS" },
  { estado: "MG", valor_minimo: 450, preco_kg_capital: 1.20, preco_kg_interior: 1.30, observacoes: "Direto da fábrica" },
  { estado: "RJ", valor_minimo: 550, preco_kg_capital: 1.30, preco_kg_interior: 1.50, observacoes: "" },
  { estado: "ES", valor_minimo: 550, preco_kg_capital: 1.20, preco_kg_interior: 1.40, observacoes: "" },
  { estado: "PR", valor_minimo: 500, preco_kg_capital: 1.40, preco_kg_interior: 1.45, observacoes: "Ajuste para regiões de fronteira" },
  { estado: "SC", valor_minimo: 550, preco_kg_capital: 1.45, preco_kg_interior: 1.50, observacoes: "Ajuste para regiões de fronteira" },
  { estado: "RS", valor_minimo: 650, preco_kg_capital: 1.50, preco_kg_interior: 1.70, observacoes: "Ajuste para regiões de fronteira" },
  { estado: "DF", valor_minimo: 550, preco_kg_capital: 1.20, preco_kg_interior: 1.30, observacoes: "Região integrada" },
  { estado: "GO", valor_minimo: 650, preco_kg_capital: 1.30, preco_kg_interior: 1.40, observacoes: "" },
  { estado: "MS", valor_minimo: 850, preco_kg_capital: 2.20, preco_kg_interior: 2.50, observacoes: "Ajuste para regiões de fronteira" },
  { estado: "MT", valor_minimo: 850, preco_kg_capital: 2.30, preco_kg_interior: 2.60, observacoes: "Ajuste para regiões de fronteira" },
  { estado: "BA", valor_minimo: 700, preco_kg_capital: 1.20, preco_kg_interior: 1.20, observacoes: "+R$100 sobretaxa suporte G / +R$50 suporte P" },
  { estado: "CE", valor_minimo: 750, preco_kg_capital: 1.20, preco_kg_interior: 1.40, observacoes: "+R$100 sobretaxa suporte G / +R$50 suporte P" },
  { estado: "PE", valor_minimo: 700, preco_kg_capital: 1.20, preco_kg_interior: 1.20, observacoes: "+R$100 sobretaxa suporte G / +R$50 suporte P" },
  { estado: "MA", valor_minimo: 650, preco_kg_capital: 1.50, preco_kg_interior: 1.90, observacoes: "Sujeito a ajuste se precisar de balsa" },
  { estado: "PI", valor_minimo: 650, preco_kg_capital: 1.50, preco_kg_interior: 1.90, observacoes: "Sujeito a ajuste se precisar de balsa" },
  { estado: "PA", valor_minimo: 550, preco_kg_capital: 1.40, preco_kg_interior: 1.80, observacoes: "Sujeito a ajuste se precisar de balsa" },
  { estado: "AM", valor_minimo: 950, preco_kg_capital: 3.40, preco_kg_interior: 3.80, observacoes: "Valor de partida — modais fluviais/balsa sob consulta" },
  { estado: "RR", valor_minimo: 950, preco_kg_capital: 3.40, preco_kg_interior: 3.80, observacoes: "Valor de partida — modais fluviais/balsa sob consulta" },
  { estado: "AP", valor_minimo: 950, preco_kg_capital: 3.40, preco_kg_interior: 3.80, observacoes: "Valor de partida — modais fluviais/balsa sob consulta" },
];

export default function TabelaFrete() {
  const [user, setUser] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEstado, setEditingEstado] = useState(null);
  const [formData, setFormData] = useState({
    valor_minimo: "",
    peso_limite: 500,
    preco_kg_capital: "",
    preco_kg_interior: "",
    observacoes: "",
    ativo: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser.role !== "admin") {
        window.location.href = "/Dashboard";
        return;
      }
      const dados = await base44.entities.TabelaFrete.list();
      setLinhas(dados);
    } catch (error) {
      console.error("Erro ao carregar tabela de frete:", error);
    }
    setLoading(false);
  };

  const linhaPorEstado = (uf) => linhas.find((l) => l.estado === uf);

  const handleEdit = (uf) => {
    const existente = linhaPorEstado(uf);
    setEditingEstado(uf);
    setFormData({
      valor_minimo: existente?.valor_minimo ?? "",
      peso_limite: existente?.peso_limite ?? 500,
      preco_kg_capital: existente?.preco_kg_capital ?? "",
      preco_kg_interior: existente?.preco_kg_interior ?? "",
      observacoes: existente?.observacoes ?? "",
      ativo: existente?.ativo ?? true,
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const existente = linhaPorEstado(editingEstado);
      const data = {
        estado: editingEstado,
        valor_minimo: parseFloat(formData.valor_minimo) || 0,
        peso_limite: parseFloat(formData.peso_limite) || 500,
        preco_kg_capital: parseFloat(formData.preco_kg_capital) || 0,
        preco_kg_interior: parseFloat(formData.preco_kg_interior) || 0,
        observacoes: formData.observacoes,
        ativo: formData.ativo,
      };

      if (existente) {
        await base44.entities.TabelaFrete.update(existente.id, data);
      } else {
        await base44.entities.TabelaFrete.create(data);
      }

      toast({ title: "Faixa de frete salva!", description: `Tabela para ${editingEstado} atualizada.` });
      setShowDialog(false);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar faixa de frete:", error);
      toast({ title: "Erro", description: "Erro ao salvar. Tente novamente.", variant: "destructive" });
    }
  };

  const handleCarregarPadrao = async () => {
    if (!confirm(`Isso vai criar/atualizar ${TABELA_PADRAO.length} estados com os valores da tabela oficial do site (muscularfit.com.br/categorias/frete.html). Estados já configurados manualmente serão sobrescritos. Continuar?`)) {
      return;
    }
    setLoading(true);
    try {
      for (const item of TABELA_PADRAO) {
        const existente = linhaPorEstado(item.estado);
        if (existente) {
          await base44.entities.TabelaFrete.update(existente.id, { ...item, ativo: true });
        } else {
          await base44.entities.TabelaFrete.create({ ...item, ativo: true });
        }
      }
      toast({ title: "Tabela padrão carregada!", description: `${TABELA_PADRAO.length} estados atualizados. 7 estados (AC, AL, PB, RN, RO, SE, TO) não estão na tabela do site — configure-os manualmente se precisar.` });
      loadData();
    } catch (error) {
      console.error("Erro ao carregar tabela padrão:", error);
      toast({ title: "Erro", description: "Erro ao carregar tabela padrão.", variant: "destructive" });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tabela de Frete</h1>
            <p className="text-gray-600">
              Cadastre o frete por estado para o app sugerir o valor automaticamente nos orçamentos,
              com base na cidade/estado do cliente e no peso total do pedido.
            </p>
          </div>
          <Button
            onClick={handleCarregarPadrao}
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Carregar tabela padrão (site)
          </Button>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Faixas por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-white font-semibold">Estado</TableHead>
                    <TableHead className="text-white font-semibold">Capital</TableHead>
                    <TableHead className="text-white font-semibold text-right">Mín. (100-500kg)</TableHead>
                    <TableHead className="text-white font-semibold text-right">Peso limite</TableHead>
                    <TableHead className="text-white font-semibold text-right">R$/kg Capital</TableHead>
                    <TableHead className="text-white font-semibold text-right">R$/kg Interior</TableHead>
                    <TableHead className="text-white font-semibold">Observações</TableHead>
                    <TableHead className="text-white font-semibold text-center">Status</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ESTADOS.map((uf, index) => {
                    const linha = linhaPorEstado(uf);
                    return (
                      <TableRow
                        key={uf}
                        className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                      >
                        <TableCell className="font-mono font-semibold">{uf}</TableCell>
                        <TableCell className="text-sm text-gray-500">{CAPITAIS_POR_UF[uf]}</TableCell>
                        {linha ? (
                          <>
                            <TableCell className="text-right">R$ {linha.valor_minimo.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{linha.peso_limite || 500} kg</TableCell>
                            <TableCell className="text-right font-semibold text-green-700">R$ {linha.preco_kg_capital.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-semibold text-green-700">R$ {linha.preco_kg_interior.toFixed(2)}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs text-gray-600">{linha.observacoes || "-"}</TableCell>
                            <TableCell className="text-center">
                              {linha.ativo ? (
                                <Badge className="bg-green-100 text-green-700 border-green-200">Ativa</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-500">Inativa</Badge>
                              )}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell colSpan={5} className="text-center text-sm text-amber-600">
                              Não configurado
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(uf)}
                            className="h-8 px-2 hover:bg-blue-50 hover:text-blue-700"
                            title="Configurar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Frete para {editingEstado} ({CAPITAIS_POR_UF[editingEstado]})
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="valor_minimo">Frete mínimo — 100 a 500kg (R$) *</Label>
                  <Input
                    id="valor_minimo"
                    type="number"
                    step="0.01"
                    value={formData.valor_minimo}
                    onChange={(e) => setFormData({ ...formData, valor_minimo: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="peso_limite">Peso limite (kg)</Label>
                  <Input
                    id="peso_limite"
                    type="number"
                    step="1"
                    value={formData.peso_limite}
                    onChange={(e) => setFormData({ ...formData, peso_limite: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="preco_kg_capital">R$/kg Capital (acima do limite) *</Label>
                  <Input
                    id="preco_kg_capital"
                    type="number"
                    step="0.01"
                    value={formData.preco_kg_capital}
                    onChange={(e) => setFormData({ ...formData, preco_kg_capital: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="preco_kg_interior">R$/kg Interior (acima do limite) *</Label>
                  <Input
                    id="preco_kg_interior"
                    type="number"
                    step="0.01"
                    value={formData.preco_kg_interior}
                    onChange={(e) => setFormData({ ...formData, preco_kg_interior: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Ajustes de fronteira, sobretaxas, condições especiais..."
                  rows={2}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                />
                Faixa ativa (considerada nas sugestões de frete)
              </label>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
