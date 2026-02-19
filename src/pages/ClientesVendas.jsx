import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Edit3, Trash2, User, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function ClientesVendas() {
  const [user, setUser] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFornecedor, setSelectedFornecedor] = useState("all");
  const [formData, setFormData] = useState({
    nome: "",
    cpf_cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    observacoes: "",
    ativo: true
  });

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterClientes();
  }, [searchTerm, selectedFornecedor, clientes]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const clientesData = currentUser.role === 'admin'
        ? await base44.entities.Cliente.list()
        : await base44.entities.Cliente.filter({ 
            fornecedor_id: currentUser.id 
          });

      // Buscar fornecedores para exibir nome
      if (currentUser.role === 'admin') {
        const allUsers = await base44.entities.User.list();
        const fornecedoresData = allUsers
          .filter(u => u.role === 'user' || u.tipo_usuario === 'fabricante')
          .map(u => ({ id: u.id, nome: u.empresa || u.full_name }));
        setFornecedores(fornecedoresData);
      }

      setClientes(clientesData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const filterClientes = () => {
    const filtered = clientes.filter(cliente => {
      const matchSearch = !searchTerm || 
        cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.cpf_cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchFornecedor = selectedFornecedor === "all" || cliente.fornecedor_id === selectedFornecedor;
      
      return matchSearch && matchFornecedor;
    });
    setFilteredClientes(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const clienteData = {
        ...formData,
        fornecedor_id: user.id
      };

      if (editingCliente) {
        await base44.entities.Cliente.update(editingCliente.id, clienteData);
        toast({
          title: "Cliente atualizado!",
          description: "Dados do cliente foram atualizados com sucesso.",
        });
      } else {
        await base44.entities.Cliente.create(clienteData);
        toast({
          title: "Cliente cadastrado!",
          description: "Novo cliente foi adicionado com sucesso.",
        });
      }

      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar cliente. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      cpf_cnpj: cliente.cpf_cnpj || "",
      email: cliente.email || "",
      telefone: cliente.telefone || "",
      endereco: cliente.endereco || "",
      cidade: cliente.cidade || "",
      estado: cliente.estado || "",
      cep: cliente.cep || "",
      observacoes: cliente.observacoes || "",
      ativo: cliente.ativo
    });
    setShowDialog(true);
  };

  const handleDelete = async (cliente) => {
    if (confirm(`Tem certeza que deseja excluir "${cliente.nome}"?`)) {
      try {
        await base44.entities.Cliente.delete(cliente.id);
        loadData();
        toast({
          title: "Cliente excluído",
          description: `${cliente.nome} foi removido do cadastro.`,
        });
      } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir cliente. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      cpf_cnpj: "",
      email: "",
      telefone: "",
      endereco: "",
      cidade: "",
      estado: "",
      cep: "",
      observacoes: "",
      ativo: true
    });
    setEditingCliente(null);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-600">Gerencie seus clientes</p>
          </div>
          <Button 
            onClick={() => setShowDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
          <CardContent className="p-4 text-center">
            <User className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-900">{clientes.length}</div>
            <p className="text-sm text-blue-700">Total de Clientes</p>
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar clientes por nome, CPF/CNPJ ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/80 border-gray-200"
            />
          </div>
          {user?.role === 'admin' && (
            <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
              <SelectTrigger className="w-full md:w-64 bg-white/80">
                <SelectValue placeholder="Fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Fornecedores</SelectItem>
                {fornecedores.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClientes.map((cliente) => (
            <Card key={cliente.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{cliente.nome}</h3>
                    {user?.role === 'admin' && (
                      <p className="text-xs text-purple-600 font-medium">
                        {fornecedores.find(f => f.id === cliente.fornecedor_id)?.nome || 'Fornecedor'}
                      </p>
                    )}
                    {cliente.cpf_cnpj && (
                      <p className="text-sm text-gray-600">{cliente.cpf_cnpj}</p>
                    )}
                  </div>
                  <Badge className={cliente.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                    {cliente.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {cliente.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>{cliente.telefone}</span>
                    </div>
                  )}
                  {cliente.cidade && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{cliente.cidade}{cliente.estado ? ` - ${cliente.estado}` : ''}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(cliente)}
                    className="flex-1"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(cliente)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredClientes.length === 0 && (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </h3>
            <p className="text-gray-600">
              {searchTerm ? "Tente ajustar sua busca." : "Adicione seu primeiro cliente para começar."}
            </p>
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCliente ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    placeholder="Nome do cliente"
                  />
                </div>
                
                <div>
                  <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
                  <Input
                    id="cpf_cnpj"
                    value={formData.cpf_cnpj}
                    onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
                
                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Rua, número, bairro"
                  />
                </div>
                
                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                
                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Input
                    id="estado"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                    placeholder="Informações adicionais sobre o cliente"
                  />
                </div>
                
                <div className="md:col-span-2 flex items-center space-x-2">
                  <Switch
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                  />
                  <Label>Cliente Ativo</Label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                >
                  {editingCliente ? "Salvar Alterações" : "Cadastrar Cliente"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}