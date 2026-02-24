import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Store, Download, Package, Search, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function FabricantesParaFabricantes() {
  const [user, setUser] = useState(null);
  const [fabricantes, setFabricantes] = useState([]);
  const [filteredFabricantes, setFilteredFabricantes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFabricante, setSelectedFabricante] = useState(null);
  const [showCatalogoDialog, setShowCatalogoDialog] = useState(false);
  const [catalogoProducts, setCatalogoProducts] = useState([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [downloadingTable, setDownloadingTable] = useState(null);
  const [showPerfilDialog, setShowPerfilDialog] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredFabricantes(
        fabricantes.filter(f =>
          f.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredFabricantes(fabricantes);
    }
  }, [searchTerm, fabricantes]);

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setLoading(true);
      }
      
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Usar função backend com service role - excluir o próprio fabricante
      const { getFabricantes } = await import('@/functions/getFabricantes');
      const response = await getFabricantes();
      
      // A resposta vem como axios response: response.data.fabricantes
      const fabricantesList = (response?.data?.fabricantes || [])
        .filter(f => f.id !== currentUser.id);
      
      setFabricantes(fabricantesList);
      setFilteredFabricantes(fabricantesList);
      
      if (forceRefresh) {
        toast({
          title: "Atualizado!",
          description: "Lista de fabricantes recarregada.",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar fabricantes:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar fabricantes.",
        variant: "destructive",
      });
      setFabricantes([]);
      setFilteredFabricantes([]);
    }
    setLoading(false);
  };

  const downloadFabricanteTable = async (fabricante) => {
    setDownloadingTable(fabricante.id);
    try {
      const allProducts = await base44.entities.Product.list();
      const fabricanteProducts = allProducts.filter(
        p => p.fabricante_id === fabricante.id && p.aprovado_produto === true
      );

      if (fabricanteProducts.length === 0) {
        toast({
          title: "Sem produtos",
          description: "Este fabricante não possui produtos aprovados.",
        });
        setDownloadingTable(null);
        return;
      }

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Logo e cabeçalho
      if (fabricante.logomarca) {
        try {
          doc.addImage(fabricante.logomarca, 'PNG', margin, yPosition, 30, 30);
          yPosition += 35;
        } catch (e) {
          console.log("Erro ao adicionar logo, continuando sem logo");
        }
      }

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(fabricante.empresa || fabricante.full_name, margin, yPosition);
      yPosition += 8;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      if (fabricante.endereco) {
        doc.text(fabricante.endereco, margin, yPosition);
        yPosition += 5;
      }
      if (fabricante.whatsapp) {
        doc.text(`WhatsApp: ${fabricante.whatsapp}`, margin, yPosition);
        yPosition += 5;
      }
      if (fabricante.site) {
        doc.text(`Site: ${fabricante.site}`, margin, yPosition);
        yPosition += 5;
      }

      yPosition += 5;
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Tabela de Produtos', margin, yPosition);
      yPosition += 10;

      // Cabeçalho da tabela
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 7, 'F');
      
      const colWidths = {
        cod: 22,
        nome: 60,
        categoria: 25,
        und: 15,
        peso: 18,
        dim: 25,
        preco: 20
      };

      let xPos = margin + 2;
      doc.text('Código', xPos, yPosition);
      xPos += colWidths.cod;
      doc.text('Nome do Produto', xPos, yPosition);
      xPos += colWidths.nome;
      doc.text('Categoria', xPos, yPosition);
      xPos += colWidths.categoria;
      doc.text('Und', xPos, yPosition);
      xPos += colWidths.und;
      doc.text('Peso (kg)', xPos, yPosition);
      xPos += colWidths.peso;
      doc.text('Dimensões', xPos, yPosition);
      xPos += colWidths.dim;
      doc.text('Preço (R$)', xPos, yPosition);
      
      yPosition += 8;

      // Produtos
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);

      fabricanteProducts.forEach((product, index) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = margin;
        }

        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(margin, yPosition - 4, pageWidth - 2 * margin, 6, 'F');
        }

        xPos = margin + 2;
        doc.text(product.cod || '', xPos, yPosition);
        xPos += colWidths.cod;
        
        const nomeTruncado = (product.nome || '').length > 40 
          ? product.nome.substring(0, 37) + '...' 
          : product.nome || '';
        doc.text(nomeTruncado, xPos, yPosition);
        xPos += colWidths.nome;
        
        doc.text(product.categoria || '', xPos, yPosition);
        xPos += colWidths.categoria;
        doc.text(product.und || '', xPos, yPosition);
        xPos += colWidths.und;
        doc.text(product.peso ? product.peso.toString() : '', xPos, yPosition);
        xPos += colWidths.peso;
        doc.text(product.dimensoes || '', xPos, yPosition);
        xPos += colWidths.dim;
        doc.text(product.preco_fabricante ? `R$ ${product.preco_fabricante.toFixed(2)}` : '', xPos, yPosition);
        
        yPosition += 6;
      });

      // Rodapé
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(
          `Página ${i} de ${totalPages} - Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      doc.save(`tabela_${fabricante.empresa || fabricante.full_name}_${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "Download concluído!",
        description: `Tabela de ${fabricante.empresa || fabricante.full_name} baixada com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao baixar tabela:", error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar a tabela.",
        variant: "destructive",
      });
    }
    setDownloadingTable(null);
  };

  const openCatalogo = async (fabricante) => {
    setSelectedFabricante(fabricante);
    setShowCatalogoDialog(true);
    setLoadingCatalogo(true);

    try {
      const allProducts = await base44.entities.Product.list();
      const fabricanteProducts = allProducts.filter(
        p => p.fabricante_id === fabricante.id && p.aprovado_produto === true
      );
      setCatalogoProducts(fabricanteProducts);
    } catch (error) {
      console.error("Erro ao carregar catálogo:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o catálogo.",
        variant: "destructive",
      });
    }
    setLoadingCatalogo(false);
  };

  const openPerfil = (fabricante) => {
    setSelectedFabricante(fabricante);
    setShowPerfilDialog(true);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-16 bg-gray-200 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Outros Fabricantes
          </h1>
          <p className="text-gray-600">
            Conheça outros fabricantes da plataforma, seus catálogos e tabelas de preços
          </p>
        </div>

        {/* Busca e Refresh */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Buscar fabricantes por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200 h-12"
            />
          </div>
          <Button
            onClick={() => loadData(true)}
            variant="outline"
            className="h-12 px-6"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar
              </>
            )}
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Total de Fabricantes</p>
                  <p className="text-3xl font-bold text-purple-900">{filteredFabricantes.length}</p>
                </div>
                <Store className="w-12 h-12 text-purple-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grid de Fabricantes */}
        {filteredFabricantes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFabricantes.map((fabricante) => (
              <Card key={fabricante.id} className="bg-white shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    {fabricante.logomarca ? (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg p-2 flex-shrink-0">
                        <img
                          src={fabricante.logomarca}
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="w-8 h-8 text-purple-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-1 line-clamp-2">
                        {fabricante.empresa || fabricante.full_name}
                      </CardTitle>
                      {fabricante.cnpj && (
                        <p className="text-xs text-gray-500">CNPJ: {fabricante.cnpj}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fabricante.endereco && (
                    <p className="text-sm text-gray-600 line-clamp-2">{fabricante.endereco}</p>
                  )}
                  
                  {fabricante.whatsapp && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        📱 {fabricante.whatsapp}
                      </Badge>
                    </div>
                  )}

                  <Button
                    onClick={() => openPerfil(fabricante)}
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-purple-600 hover:text-purple-700 text-xs"
                  >
                    Ver perfil completo da empresa →
                  </Button>

                  <div className="grid grid-cols-1 gap-2 pt-3">
                    <Button
                      onClick={() => downloadFabricanteTable(fabricante)}
                      disabled={downloadingTable === fabricante.id}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {downloadingTable === fabricante.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                          Baixando...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Tabela
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => openCatalogo(fabricante)}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      size="sm"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Ver Catálogo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhum fabricante encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm
                  ? "Tente ajustar os termos de busca."
                  : "Não há outros fabricantes aprovados no momento."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Catálogo */}
      <Dialog open={showCatalogoDialog} onOpenChange={setShowCatalogoDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Catálogo - {selectedFabricante?.empresa || selectedFabricante?.full_name}
            </DialogTitle>
          </DialogHeader>

          {loadingCatalogo ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando catálogo...</p>
            </div>
          ) : catalogoProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogoProducts.map((product) => (
                <Card key={product.id} className="bg-white">
                  <CardContent className="p-4">
                    {product.foto && (
                      <img
                        src={product.foto}
                        alt={product.nome}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h4 className="font-bold text-sm mb-2 line-clamp-2">{product.nome}</h4>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><strong>Código:</strong> {product.cod}</p>
                      {product.peso && <p><strong>Peso:</strong> {product.peso} kg</p>}
                      {product.dimensoes && <p><strong>Dimensões:</strong> {product.dimensoes} cm</p>}
                      <p><strong>Unidade:</strong> {product.und}</p>
                      {product.preco_fabricante && (
                        <p className="text-green-600 font-bold">
                          R$ {product.preco_fabricante.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Este fabricante não possui produtos no catálogo.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Perfil */}
      <Dialog open={showPerfilDialog} onOpenChange={setShowPerfilDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedFabricante?.logomarca && (
                <img 
                  src={selectedFabricante.logomarca} 
                  alt="Logo" 
                  className="w-12 h-12 object-contain rounded-lg border p-1"
                />
              )}
              Perfil - {selectedFabricante?.empresa || selectedFabricante?.full_name}
            </DialogTitle>
          </DialogHeader>

          {selectedFabricante && (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações da Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.empresa && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Razão Social</p>
                      <p className="text-gray-900">{selectedFabricante.empresa}</p>
                    </div>
                  )}
                  {selectedFabricante.cnpj && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">CNPJ</p>
                      <p className="text-gray-900">{selectedFabricante.cnpj}</p>
                    </div>
                  )}
                  {selectedFabricante.endereco && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Endereço</p>
                      <p className="text-gray-900">{selectedFabricante.endereco}</p>
                    </div>
                  )}
                  {selectedFabricante.historia_empresa && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Sobre a Empresa</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.historia_empresa}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contatos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contatos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.email && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">E-mail</p>
                      <p className="text-gray-900">{selectedFabricante.email}</p>
                    </div>
                  )}
                  {selectedFabricante.whatsapp && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">WhatsApp</p>
                      <p className="text-gray-900">{selectedFabricante.whatsapp}</p>
                    </div>
                  )}
                  {selectedFabricante.site && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Website</p>
                      <a 
                        href={selectedFabricante.site} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:underline"
                      >
                        {selectedFabricante.site}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Políticas e Condições */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Políticas e Condições Comerciais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedFabricante.formas_pagamento && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Formas de Pagamento</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.formas_pagamento}</p>
                    </div>
                  )}
                  {selectedFabricante.prazo_entrega && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Prazo de Entrega</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.prazo_entrega}</p>
                    </div>
                  )}
                  {selectedFabricante.politica_troca && (
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Política de Troca</p>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedFabricante.politica_troca}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}