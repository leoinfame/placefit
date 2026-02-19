import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Truck, MapPin, Package, DollarSign, Search, Building, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function AdminFrete() {
  const [user, setUser] = useState(null);
  const [freightOffers, setFreightOffers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const [offers, suppliersData] = await Promise.all([
        base44.entities.FreightOffer.list('-created_date'),
        base44.entities.User.filter({ role: 'user' })
      ]);

      setFreightOffers(offers);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const getSupplier = (supplierId) => {
    return suppliers.find(s => s.id === supplierId);
  };

  const filteredOffers = freightOffers.filter(offer => {
    const supplier = getSupplier(offer.supplier_id);
    const estadoMatch = selectedEstado === "all" || offer.estado === selectedEstado;
    const supplierMatch = selectedSupplier === "all" || offer.supplier_id === selectedSupplier;
    const searchMatch = !searchTerm || 
      offer.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.estado.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier?.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return estadoMatch && supplierMatch && searchMatch;
  });

  const groupedBySupplier = filteredOffers.reduce((acc, offer) => {
    const supplierId = offer.supplier_id;
    if (!acc[supplierId]) {
      acc[supplierId] = [];
    }
    acc[supplierId].push(offer);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4].map(i => (
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
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ofertas de Frete</h1>
            <p className="text-gray-600">Visualize todas as ofertas de frete dos fornecedores</p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Truck className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{freightOffers.length}</div>
              <p className="text-sm text-blue-700">Total de Ofertas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <Building className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">
                {Object.keys(groupedBySupplier).length}
              </div>
              <p className="text-sm text-green-700">Fornecedores com Ofertas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <MapPin className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">
                {[...new Set(freightOffers.map(o => o.estado))].length}
              </div>
              <p className="text-sm text-purple-700">Estados Atendidos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 border">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">
                {freightOffers.filter(o => o.ativo).length}
              </div>
              <p className="text-sm text-orange-700">Ofertas Ativas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por cidade, estado ou fornecedor..."
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

          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="w-full md:w-64 bg-white/80">
              <SelectValue placeholder="Filtrar por fornecedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Fornecedores</SelectItem>
              {suppliers.map(supplier => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.empresa || supplier.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Ofertas Agrupadas por Fornecedor */}
        {filteredOffers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Truck className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma oferta encontrada</h3>
            <p className="text-gray-600">Tente ajustar os filtros ou aguarde novas ofertas dos fornecedores</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(groupedBySupplier).map(supplierId => {
              const supplier = getSupplier(supplierId);
              const supplierOffers = groupedBySupplier[supplierId];

              return (
                <div key={supplierId}>
                  {/* Header do Fornecedor */}
                  <div className="bg-white rounded-lg p-4 shadow-md mb-4">
                    <div className="flex items-center gap-4">
                      {supplier?.logomarca && (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={supplier.logomarca}
                            alt={supplier.empresa}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900">
                          {supplier?.empresa || supplier?.full_name || 'Fornecedor'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                          {supplier?.whatsapp && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {supplier.whatsapp}
                            </div>
                          )}
                          {supplier?.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              {supplier.email}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-lg px-4 py-2">
                        {supplierOffers.length} oferta(s)
                      </Badge>
                    </div>
                  </div>

                  {/* Ofertas do Fornecedor */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {supplierOffers.map((offer) => (
                      <Card key={offer.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-lg font-bold text-gray-900">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-blue-600" />
                                {offer.cidade} - {offer.estado}
                              </div>
                            </CardTitle>
                            <Badge variant={offer.ativo ? "default" : "secondary"}>
                              {offer.ativo ? "Ativa" : "Inativa"}
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-gray-600">
                                <Package className="w-4 h-4" />
                                <span className="text-sm">Peso Total:</span>
                              </div>
                              <span className="font-semibold text-gray-900">{offer.peso_total} kg</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-gray-600">
                                <DollarSign className="w-4 h-4" />
                                <span className="text-sm">Valor Ofertado:</span>
                              </div>
                              <span className="font-bold text-green-600 text-lg">
                                R$ {offer.valor_ofertado.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {offer.observacoes && (
                            <div className="pt-3 border-t">
                              <p className="text-sm text-gray-600">
                                <strong>Observações:</strong><br />
                                {offer.observacoes}
                              </p>
                            </div>
                          )}

                          <div className="pt-3 border-t text-xs text-gray-500">
                            Criada em {new Date(offer.created_date).toLocaleDateString('pt-BR')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}