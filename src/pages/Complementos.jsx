import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Truck, Search, Phone, Mail, Copy, MessageCircle, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const PLACEFIT_LOGO = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c9d5dd3cf0f8fd8a834875/b1ab9fc90_WhatsAppImage2025-10-16at023605.jpeg";

export default function Complementos() {
  const [freightOffers, setFreightOffers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedEstado, setSelectedEstado] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    registerMarketplaceVisit();
  }, []);

  const registerMarketplaceVisit = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const currentUser = await base44.auth.me();
        await base44.auth.updateMe({
          ultima_visita_marketplace: new Date().toISOString()
        });
        console.log("Visita registrada em Complementos para:", currentUser.email);
      }
    } catch (error) {
      // Silenciosamente ignorar erro se usuário não estiver autenticado
      console.log("Visitante não autenticado:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Carregar ofertas de frete ativas
      const offers = await base44.entities.FreightOffer.list('-created_date');
      const activeOffers = offers.filter(o => o.ativo === true);
      
      // Carregar fornecedores
      const suppliersData = await base44.entities.User.list();
      
      console.log("Ofertas ativas carregadas:", activeOffers.length);
      console.log("Fornecedores carregados:", suppliersData.length);
      
      setFreightOffers(activeOffers);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setError("Erro ao carregar ofertas de frete. Por favor, tente novamente.");
    }
    setLoading(false);
  };

  const getSupplier = (supplierId) => {
    return suppliers.find(s => s.id === supplierId);
  };

  const filteredOffers = freightOffers.filter(offer => {
    const estadoMatch = selectedEstado === "all" || offer.estado === selectedEstado;
    const searchMatch = !searchTerm || 
      offer.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.estado.toLowerCase().includes(searchTerm.toLowerCase());
    return estadoMatch && searchMatch;
  });

  const shareOfferWhatsApp = (offer, supplier) => {
    const text = `Oferta de Frete - ${offer.cidade}/${offer.estado}\nPeso: ${offer.peso_total}kg\nValor: R$ ${offer.valor_ofertado.toFixed(2)}\nFornecedor: ${supplier?.empresa || supplier?.full_name || 'N/A'}\nContato: ${supplier?.whatsapp || supplier?.email || 'N/A'}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareOfferTelegram = (offer, supplier) => {
    const text = `Oferta de Frete - ${offer.cidade}/${offer.estado}\nPeso: ${offer.peso_total}kg - Valor: R$ ${offer.valor_ofertado.toFixed(2)}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin + '/Complementos')}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyOfferDetails = (offer, supplier) => {
    const text = `Oferta de Frete - ${offer.cidade}/${offer.estado}\nPeso: ${offer.peso_total}kg\nValor: R$ ${offer.valor_ofertado.toFixed(2)}\nFornecedor: ${supplier?.empresa || supplier?.full_name || 'N/A'}\nContato: ${supplier?.whatsapp || supplier?.email || 'N/A'}`;
    navigator.clipboard.writeText(text);
    toast({
      title: "Detalhes copiados!",
      description: "Informações da oferta copiadas para área de transferência.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <img 
            src={PLACEFIT_LOGO} 
            alt="PlaceFit" 
            className="w-12 h-12 mx-auto object-contain animate-pulse"
          />
          <div className="animate-pulse text-gray-600">Carregando complementos...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao Carregar</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadData} className="bg-gradient-to-r from-blue-600 to-green-600">
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={PLACEFIT_LOGO} 
                alt="PlaceFit" 
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  PlaceFit
                </h1>
                <p className="text-sm text-gray-600">Complementos de Carga</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 px-4 py-2">
              <Truck className="w-4 h-4 mr-2" />
              {filteredOffers.length} {filteredOffers.length === 1 ? 'oferta' : 'ofertas'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Descrição */}
        <div className="text-center">
          <p className="text-gray-600 max-w-2xl mx-auto">
            Encontre ofertas de frete para complementar sua rota. Selecione o estado de destino e veja as cargas disponíveis.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80"
              />
            </div>
          </div>
          <Select value={selectedEstado} onValueChange={setSelectedEstado}>
            <SelectTrigger className="w-full md:w-48 bg-white/80">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Estados</SelectItem>
              {ESTADOS.map(estado => (
                <SelectItem key={estado} value={estado}>
                  {estado}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela de Ofertas */}
        {filteredOffers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Truck className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {freightOffers.length === 0 
                ? 'Nenhuma oferta de frete disponível no momento' 
                : 'Nenhuma oferta encontrada'
              }
            </h3>
            <p className="text-gray-600">
              {freightOffers.length === 0 
                ? 'As ofertas aparecerão aqui quando os fornecedores publicarem' 
                : 'Tente ajustar os filtros ou buscar por outra região'
              }
            </p>
          </div>
        ) : (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                      <TableHead className="text-white font-semibold">Fornecedor</TableHead>
                      <TableHead className="text-white font-semibold">Destino</TableHead>
                      <TableHead className="text-white font-semibold">Estado</TableHead>
                      <TableHead className="text-white font-semibold">Peso (kg)</TableHead>
                      <TableHead className="text-white font-semibold">Valor (R$)</TableHead>
                      <TableHead className="text-white font-semibold">Contato</TableHead>
                      <TableHead className="text-white font-semibold">Observações</TableHead>
                      <TableHead className="text-white font-semibold text-center">Compartilhar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOffers.map((offer, index) => {
                      const supplier = getSupplier(offer.supplier_id);
                      return (
                        <TableRow 
                          key={offer.id}
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {supplier?.logomarca && (
                                <div className="w-8 h-8 bg-white rounded border flex-shrink-0">
                                  <img
                                    src={supplier.logomarca}
                                    alt={supplier.empresa}
                                    className="w-full h-full object-contain p-1"
                                  />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {supplier?.empresa || supplier?.full_name || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{offer.cidade}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {offer.estado}
                            </Badge>
                          </TableCell>
                          <TableCell>{offer.peso_total}</TableCell>
                          <TableCell className="font-bold text-green-600">
                            {offer.valor_ofertado.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs">
                              {supplier?.whatsapp && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  <span>{supplier.whatsapp}</span>
                                </div>
                              )}
                              {supplier?.email && (
                                <div className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-gray-400" />
                                  <span className="truncate max-w-[150px]">{supplier.email}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-gray-600">
                            {offer.observacoes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyOfferDetails(offer, supplier)}
                                title="Copiar detalhes"
                                className="h-8 px-2 hover:bg-gray-100"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => shareOfferWhatsApp(offer, supplier)}
                                title="Compartilhar no WhatsApp"
                                className="h-8 px-2 hover:bg-green-50 hover:text-green-700"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => shareOfferTelegram(offer, supplier)}
                                title="Compartilhar no Telegram"
                                className="h-8 px-2 hover:bg-sky-50 hover:text-sky-700"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-600">
          <p className="text-sm">
            © 2024 PlaceFit - Marketplace de Equipamentos Fitness
          </p>
          <p className="text-xs mt-2">
            Encontre complementos de carga para sua rota
          </p>
        </div>
      </div>
    </div>
  );
}