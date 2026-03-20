import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Eye, Edit, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export default function ClientesFiscais() {
  const [user, setUser] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCliente, setEditingCliente] = useState(null);
  
  const [formData, setFormData] = useState({
    tipo_pessoa: "Jurídica",
    cpf_cnpj: "",
    nome_razao_social: "",
    nome_fantasia: "",
    inscricao_estadual: "",
    email: "",
    telefone: "",
    whatsapp: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "SP",
    cep: "",
    observacoes: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const clientesData = await base44.entities.ClienteFiscal.filter({ user_id: currentUser.id }, "-created_date");
      setClientes(clientesData || []);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    } finally {
      setLoading(false);
    }
  };

  const buscarCNPJ = async (cnpj) => {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g, '')}`);
      if (res.ok) {
        const data = await res.json();
        setFormData({
          ...formData,
          cpf_cnpj: cnpj,
          nome_razao_social: data.razao_social || "",
          nome_fantasia: data.nome_fantasia || "",
          email: data.email || "",
          telefone: data.ddd_telefone_1 || "",
          endereco: data.logradouro || "",
          numero: data.numero || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          cidade: data.municipio || "",
          estado: data.uf || "SP",
          cep: data.cep || ""
        });
        toast.success("Dados do CNPJ carregados");
      } else {
        toast.error("CNPJ não encontrado");
      }
    } catch (error) {
      toast.error("Erro ao buscar CNPJ");
    }
  };

  const buscarCEP = async (cep) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          setFormData({
            ...formData,
            cep: cep,
            endereco: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "SP"
          });
          toast.success("Endereço carregado");
        }
      }
    } catch (error) {
      toast.error("Erro ao buscar CEP");
    }
  };

  const handleSaveCliente = async () => {
    if (!formData.cpf_cnpj || !formData.nome_razao_social) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      const clienteData = {
        ...formData,
        user_id: user.id
      };

      if (editingCliente) {
        await base44.entities.ClienteFiscal.update(editingCliente.id, clienteData);
        toast.success("Cliente atualizado!");
      } else {
        await base44.entities.ClienteFiscal.create(clienteData);
        toast.success("Cliente cadastrado!");
      }

      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast.error("Erro ao salvar cliente");
    }
  };

  const handleEditCliente = (cliente) => {
    setEditingCliente(cliente);
    setFormData(cliente);
    setShowDialog(true);
  };

  const handleDeleteCliente = async (id) => {
    if (!confirm("Deseja realmente excluir este cliente?")) return;

    try {
      await base44.entities.ClienteFiscal.delete(id);
      toast.success("Cliente excluído");
      loadData();
    } catch (error) {
      toast.error("Erro ao excluir cliente");
    }
  };

  const resetForm = () => {
    setFormData({
      tipo_pessoa: "Jurídica",
      cpf_cnpj: "",
      nome_razao_social: "",
      nome_fantasia: "",
      inscricao_estadual: "",
      email: "",
      telefone: "",
      whatsapp: "",
      endereco: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "SP",
      cep: "",
      observacoes: ""
    });
    setEditingCliente(null);
  };

  const filteredClientes = clientes.filter(c => 
    c.nome_razao_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpf_cnpj?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Clientes Fiscais</h1>
              <p className="text-gray-600">Cadastro de clientes para emissão de NF-e</p>
            </div>
          </div>

          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Tipo Pessoa */}
                <div className="space-y-2">
                  <Label>Tipo de Pessoa</Label>
                  <Select value={formData.tipo_pessoa} onValueChange={(value) => setFormData({...formData, tipo_pessoa: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Física">Pessoa Física</SelectItem>
                      <SelectItem value="Jurídica">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* CPF/CNPJ */}
                <div className="space-y-2">
                  <Label>{formData.tipo_pessoa === "Física" ? "CPF" : "CNPJ"} *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.cpf_cnpj}
                      onChange={(e) => setFormData({...formData, cpf_cnpj: e.target.value})}
                      placeholder={formData.tipo_pessoa === "Física" ? "000.000.000-00" : "00.000.000/0000-00"}
                    />
                    {formData.tipo_pessoa === "Jurídica" && (
                      <Button onClick={() => buscarCNPJ(formData.cpf_cnpj)} variant="outline">
                        Buscar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Nome */}
                <div className="space-y-2">
                  <Label>{formData.tipo_pessoa === "Física" ? "Nome Completo" : "Razão Social"} *</Label>
                  <Input
                    value={formData.nome_razao_social}
                    onChange={(e) => setFormData({...formData, nome_razao_social: e.target.value})}
                  />
                </div>

                {formData.tipo_pessoa === "Jurídica" && (
                  <>
                    <div className="space-y-2">
                      <Label>Nome Fantasia</Label>
                      <Input
                        value={formData.nome_fantasia}
                        onChange={(e) => setFormData({...formData, nome_fantasia: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Inscrição Estadual</Label>
                      <Input
                        value={formData.inscricao_estadual}
                        onChange={(e) => setFormData({...formData, inscricao_estadual: e.target.value})}
                      />
                    </div>
                  </>
                )}

                {/* Contato */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                    />
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.cep}
                      onChange={(e) => setFormData({...formData, cep: e.target.value})}
                      placeholder="00000-000"
                    />
                    <Button onClick={() => buscarCEP(formData.cep)} variant="outline">
                      Buscar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Logradouro</Label>
                    <Input
                      value={formData.endereco}
                      onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={formData.numero}
                      onChange={(e) => setFormData({...formData, numero: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={formData.bairro}
                      onChange={(e) => setFormData({...formData, bairro: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={formData.complemento}
                      onChange={(e) => setFormData({...formData, complemento: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.cidade}
                      onChange={(e) => setFormData({...formData, cidade: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Input
                      value={formData.estado}
                      onChange={(e) => setFormData({...formData, estado: e.target.value})}
                      maxLength={2}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveCliente} className="bg-gradient-to-r from-purple-600 to-purple-700">
                    {editingCliente ? "Atualizar" : "Cadastrar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou CPF/CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Clientes List */}
        <div className="grid gap-4">
          {filteredClientes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhum cliente cadastrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredClientes.map((cliente) => (
              <Card key={cliente.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold">{cliente.nome_razao_social}</h3>
                      {cliente.nome_fantasia && (
                        <p className="text-sm text-gray-600">{cliente.nome_fantasia}</p>
                      )}
                      <p className="text-sm text-gray-600">
                        {cliente.tipo_pessoa === "Física" ? "CPF" : "CNPJ"}: {cliente.cpf_cnpj}
                      </p>
                      <p className="text-sm text-gray-600">
                        {cliente.cidade} - {cliente.estado}
                      </p>
                      {cliente.email && (
                        <p className="text-sm text-gray-600">📧 {cliente.email}</p>
                      )}
                      {cliente.whatsapp && (
                        <p className="text-sm text-gray-600">📱 {cliente.whatsapp}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEditCliente(cliente)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDeleteCliente(cliente.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}