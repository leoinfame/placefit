import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { SupplierProduct } from "@/entities/SupplierProduct";
import { Product } from "@/entities/Product";
import { 
  Users, 
  Search, 
  CheckCircle, 
  XCircle, 
  Building, 
  Phone, 
  MapPin, 
  Globe,
  Package,
  Eye,
  Copy,
  Share2,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export default function Suppliers() {
  const [user, setUser] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [products, setProducts] = useState([]);

  const { toast } = useToast();

  useEffect(() => {
    loadUser();
    loadSuppliers();
    loadProducts();
  }, []);

  const filterSuppliers = useCallback(() => {
    let filtered = suppliers;
    
    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        (supplier.empresa?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (supplier.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (supplier.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredSuppliers(filtered);
  }, [suppliers, searchTerm]); // Dependencies for useCallback

  useEffect(() => {
    filterSuppliers();
  }, [filterSuppliers]); // Dependency on the memoized filterSuppliers

  const loadUser = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await User.filter({ role: 'user' });
      // Filtrar apenas fornecedores (excluir fabricantes e transportadores)
      const fornecedores = data.filter(u => !u.tipo_usuario || u.tipo_usuario === null);
      setSuppliers(fornecedores);
    } catch (error) {
      console.error("Erro ao carregar fornecedores:", error);
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    try {
      const data = await Product.list();
      setProducts(data);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    }
  };

  const handleApprovalToggle = async (supplier) => {
    try {
      await User.update(supplier.id, { 
        ...supplier,
        aprovado: !supplier.aprovado 
      });
      loadSuppliers();
    } catch (error) {
      console.error("Erro ao alterar aprovação:", error);
    }
  };

  const viewSupplierDetails = async (supplier) => {
    setSelectedSupplier(supplier);
    try {
      const products = await SupplierProduct.filter({ supplier_id: supplier.id });
      setSupplierProducts(products);
    } catch (error) {
      console.error("Erro ao carregar produtos do fornecedor:", error);
    }
    setShowDialog(true);
  };

  const handleDeleteSupplier = async (supplier) => {
    if (confirm(`Tem certeza que deseja excluir o revendedor "${supplier.empresa || supplier.full_name}"? Esta ação não pode ser desfeita.`)) {
      try {
        await User.delete(supplier.id);
        loadSuppliers();
        toast({
          title: "Revendedor excluído",
          description: "Revendedor removido com sucesso.",
        });
      } catch (error) {
        console.error("Erro ao excluir revendedor:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir revendedor. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const getSupplierStats = () => {
    const total = suppliers.length;
    const approved = suppliers.filter(s => s.aprovado).length;
    const pending = total - approved;
    
    return { total, approved, pending };
  };

  const copyRegistrationLink = () => {
    const link = `${window.location.origin}/PublicRegister`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Link de cadastro copiado para a área de transferência.",
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = getSupplierStats();

  return (
    <div className="p-4 md:p-8 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 w-full max-w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revendedores</h1>
            <p className="text-gray-600">Gerencie todos os revendedores cadastrados</p>
          </div>
        </div>

        {/* Link de Cadastro de Revendedores */}
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200 border">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Share2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Link de Cadastro de Revendedores</h3>
                  <p className="text-sm text-gray-600">
                    Compartilhe este link para que novos revendedores se cadastrem
                  </p>
                  <code className="text-xs bg-white px-2 py-1 rounded mt-2 inline-block border">
                    {window.location.origin}/PublicRegister
                  </code>
                </div>
              </div>
              <Button
                onClick={copyRegistrationLink}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 whitespace-nowrap"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
              <p className="text-sm text-blue-700">Total de Revendedores</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{stats.approved}</div>
              <p className="text-sm text-green-700">Aprovados</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 border">
            <CardContent className="p-4 text-center">
              <XCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">{stats.pending}</div>
              <p className="text-sm text-orange-700">Aguardando Aprovação</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtro */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar revendedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* Lista de Revendedores - Desktop */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold text-gray-900 mb-1">
                      {supplier.empresa || supplier.full_name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mb-2">{supplier.email}</p>
                    <Badge 
                      variant={supplier.aprovado ? "success" : "secondary"}
                      className={supplier.aprovado 
                        ? "bg-green-100 text-green-700 border-green-200" 
                        : "bg-orange-100 text-orange-700 border-orange-200"
                      }
                    >
                      {supplier.aprovado ? "Aprovado" : "Aguardando"}
                    </Badge>
                  </div>
                  
                  {supplier.logomarca && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img 
                        src={supplier.logomarca} 
                        alt="Logo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-4">
                {/* Informações de Contato */}
                <div className="space-y-2 text-sm">
                  {supplier.cnpj && (
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{supplier.cnpj}</span>
                    </div>
                  )}
                  {supplier.whatsapp && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{supplier.whatsapp}</span>
                    </div>
                  )}
                  {supplier.endereco && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600 truncate" title={supplier.endereco}>
                        {supplier.endereco}
                      </span>
                    </div>
                  )}
                  {supplier.site && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <a 
                        href={supplier.site} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 truncate"
                      >
                        {supplier.site.replace(/https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="space-y-2 pt-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewSupplierDetails(supplier)}
                      className="flex-1 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSupplier(supplier)}
                      className="hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-2 justify-center">
                    <Switch
                      checked={supplier.aprovado}
                      onCheckedChange={() => handleApprovalToggle(supplier)}
                    />
                    <Label className="text-xs">Aprovar</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cards Mobile */}
        <div className="md:hidden space-y-2 w-full">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="bg-white shadow-sm w-full">
              <CardContent className="p-3 w-full">
                <div className="space-y-2 w-full">
                  {/* Linha 1: Logo, Nome e Status */}
                  <div className="flex items-start gap-2 w-full">
                    {supplier.logomarca && (
                      <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                        <img 
                          src={supplier.logomarca} 
                          alt="Logo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm break-words">
                        {supplier.empresa || supplier.full_name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate">{supplier.full_name}</p>
                    </div>
                    <Badge 
                      className={supplier.aprovado 
                        ? "bg-green-100 text-green-700 text-xs flex-shrink-0" 
                        : "bg-orange-100 text-orange-700 text-xs flex-shrink-0"
                      }
                    >
                      {supplier.aprovado ? "✓" : "⏱"}
                    </Badge>
                  </div>

                  {/* Linha 2: Informações */}
                  <div className="space-y-0.5 text-xs text-gray-600">
                    <div className="flex items-center gap-1 truncate">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                    {supplier.whatsapp && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{supplier.whatsapp}</span>
                      </div>
                    )}
                    {supplier.cnpj && (
                      <div className="flex items-center gap-1 truncate">
                        <Building className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{supplier.cnpj}</span>
                      </div>
                    )}
                  </div>

                  {/* Linha 3: Aprovação */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <span className="text-xs text-gray-600">Aprovar:</span>
                    <Switch
                      checked={supplier.aprovado}
                      onCheckedChange={() => handleApprovalToggle(supplier)}
                      className="scale-90"
                    />
                  </div>

                  {/* Linha 4: Ações */}
                  <div className="flex gap-2 w-full pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewSupplierDetails(supplier)}
                      className="flex-1 h-7 text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteSupplier(supplier)}
                      className="flex-1 h-7 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum revendedor encontrado</h3>
            <p className="text-gray-600">Os revendedores aparecerão aqui após se cadastrarem.</p>
          </div>
        )}

        {/* Dialog de Detalhes do Revendedor */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Detalhes do Revendedor: {selectedSupplier?.empresa || selectedSupplier?.full_name}
              </DialogTitle>
            </DialogHeader>
            
            {selectedSupplier && (
              <div className="space-y-6">
                {/* Informações da Empresa */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Dados da Empresa</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Empresa</Label>
                        <p className="font-medium">{selectedSupplier.empresa || "Não informado"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">CNPJ</Label>
                        <p className="font-medium">{selectedSupplier.cnpj || "Não informado"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Responsável</Label>
                        <p className="font-medium">{selectedSupplier.full_name}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">E-mail</Label>
                        <p className="font-medium">{selectedSupplier.email}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Contato</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">WhatsApp</Label>
                        <p className="font-medium">{selectedSupplier.whatsapp || "Não informado"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Website</Label>
                        <p className="font-medium">{selectedSupplier.site || "Não informado"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Endereço</Label>
                        <p className="font-medium">{selectedSupplier.endereco || "Não informado"}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Status</Label>
                        <Badge 
                          variant={selectedSupplier.aprovado ? "success" : "secondary"}
                          className={selectedSupplier.aprovado 
                            ? "bg-green-100 text-green-700" 
                            : "bg-orange-100 text-orange-700"
                          }
                        >
                          {selectedSupplier.aprovado ? "Aprovado" : "Aguardando Aprovação"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Logo */}
                {selectedSupplier.logomarca && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Logomarca</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
                        <img 
                          src={selectedSupplier.logomarca} 
                          alt="Logo da empresa"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Produtos do Revendedor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Produtos Selecionados ({supplierProducts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {supplierProducts.length > 0 ? (
                      <div className="space-y-3">
                        {supplierProducts.map((sp) => {
                          const product = products.find(p => p.id === sp.product_id);
                          return product ? (
                            <div key={sp.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <p className="font-medium">{product.nome}</p>
                                <p className="text-sm text-gray-500">{product.cod}</p>
                                {sp.observacoes && (
                                  <p className="text-sm text-gray-600 mt-1">{sp.observacoes}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">
                                  R$ {sp.preco ? sp.preco.toFixed(2) : "0,00"}
                                </p>
                                <Badge variant={sp.disponivel ? "success" : "secondary"}>
                                  {sp.disponivel ? "Disponível" : "Indisponível"}
                                </Badge>
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        Nenhum produto selecionado ainda
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}