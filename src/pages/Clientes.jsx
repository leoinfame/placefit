import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Search, Mail, Phone, Calendar, Eye, Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Plus, Edit3, Trash2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export default function Clientes() {
  const [user, setUser] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [activeTab, setActiveTab] = useState("clientes");
  const [showDialog, setShowDialog] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
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
  }, [clientes, searchTerm]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role === 'admin') {
        // Admin vê todos os clientes do marketplace
        const allUsers = await base44.entities.User.list('-created_date');
        
        const clientesData = allUsers.filter(u => {
          if (u.role === 'admin') return false;
          if (u.role === 'user' && u.aprovado) return false;
          if (u.ultima_visita_marketplace) return true;
          return u.role !== 'user';
        });
        
        setClientes(clientesData);
      } else if (currentUser.role === 'user') {
        // Revendedor ou usuário comum vê seus clientes específicos (da entidade Cliente)
        try {
          const clientesData = await base44.entities.Cliente.filter({
            fornecedor_id: currentUser.id
          }, '-created_date');
          
          setClientes(clientesData);
        } catch (error) {
          // Se a entidade não existir, inicializa com array vazio
          console.log("Cliente entity not accessible, initializing empty");
          setClientes([]);
        }
      } else {
        window.location.href = '/Dashboard';
        return;
      }
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
    setLoading(false);
  };

  const filterClientes = () => {
    let filtered = clientes;
    
    if (searchTerm) {
      filtered = filtered.filter(cliente =>
        (cliente.full_name?.toLowerCase() || cliente.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cliente.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cliente.whatsapp?.toLowerCase() || cliente.telefone?.toLowerCase() || '').includes(searchTerm)
      );
    }
    
    setFilteredClientes(filtered);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    const headers = user?.role === 'admin' 
      ? ['Nome', 'E-mail', 'WhatsApp', 'Data de Cadastro', 'Última Visita']
      : ['Nome', 'E-mail', 'WhatsApp', 'Telefone', 'Cidade', 'Data de Cadastro'];
    
    const csvData = filteredClientes.map(cliente => {
      if (user?.role === 'admin') {
        return [
          cliente.full_name || '',
          cliente.email || '',
          cliente.whatsapp || '',
          formatDate(cliente.created_date),
          formatDate(cliente.ultima_visita_marketplace)
        ];
      } else {
        return [
          cliente.nome || '',
          cliente.email || '',
          cliente.telefone || '',
          cliente.cidade || '',
          cliente.cidade || '',
          formatDate(cliente.created_date)
        ];
      }
    });

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const fileName = user?.role === 'admin' 
      ? `clientes_marketplace_${new Date().toISOString().split('T')[0]}.csv`
      : `meus_clientes_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadTemplate = () => {
    const headers = ['Nome', 'E-mail', 'WhatsApp'];
    const exampleData = [
      ['João Silva', 'joao@example.com', '11987654321'],
      ['Maria Santos', 'maria@example.com', '21987654321'],
      ['Pedro Oliveira', 'pedro@example.com', '31987654321']
    ];

    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...exampleData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `template_clientes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setUploadedFile(null);
      return;
    }
    setUploadedFile(file);
  };

  const processImport = async () => {
    if (!uploadedFile) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo para importar.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      // 1. Upload do arquivo
      const uploadResult = await base44.integrations.Core.UploadFile({ file: uploadedFile });
      if (uploadResult.status === "error") {
        throw new Error(uploadResult.details || "Erro ao fazer upload do arquivo.");
      }
      const { file_url } = uploadResult;

      // 2. Extrair dados do arquivo
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "Nome": { type: "string" },
              "E-mail": { type: "string" },
              "WhatsApp": { type: "string" }
            },
            required: ["Nome", "E-mail"]
          }
        }
      });

      if (result.status === "error") {
        throw new Error(result.details || "Erro ao processar arquivo. Verifique o formato e o conteúdo.");
      }

      // 3. Criar clientes em massa
      const clientesData = result.output || [];
      let successCount = 0;
      let errorCount = 0;
      let errorDetails = [];

      for (const item of clientesData) {
        try {
          const nome = item["Nome"];
          const email = item["E-mail"];
          const whatsapp = item["WhatsApp"] || "";

          // Validação básica
          if (!nome || !email) {
            errorDetails.push(`Cliente ${nome || 'sem nome'}: Nome e E-mail são obrigatórios.`);
            errorCount++;
            continue;
          }

          // Verificar se o cliente já existe
          const existingCliente = clientes.find(c => c.email === email || c.nome === nome);
          if (existingCliente) {
            errorDetails.push(`Cliente ${nome}: Já existe um cliente com este nome/e-mail.`);
            errorCount++;
            continue;
          }

          if (user?.role === 'admin') {
            // Admin: convidar como usuário do marketplace
            await base44.users.inviteUser(email, "user");
          } else {
            // Revendedor: criar cliente na entidade Cliente
            await base44.entities.Cliente.create({
              fornecedor_id: user.id,
              nome: nome,
              email: email,
              telefone: whatsapp,
              ativo: true
            });
          }
          successCount++;
        } catch (error) {
          console.error("Erro ao criar cliente:", item, error);
          errorDetails.push(`Erro ao criar ${item["Nome"]}: ${error.message || "Erro desconhecido"}.`);
          errorCount++;
        }
      }

      toast({
        title: "Importação concluída!",
        description: `${successCount} cliente(s) importado(s) com sucesso.${errorCount > 0 ? ` ${errorCount} erro(s).` : ''}`,
      });

      if (errorDetails.length > 0) {
        errorDetails.slice(0, 3).forEach(detail => {
          toast({
            title: "Detalhe do Erro",
            description: detail,
            variant: "destructive",
            duration: 6000
          });
        });
        if (errorDetails.length > 3) {
          toast({
            description: `...e mais ${errorDetails.length - 3} erro(s)`,
            variant: "destructive"
          });
        }
      }

      // Reload data
      await loadData();
      setUploadedFile(null);
      setActiveTab("clientes");

    } catch (error) {
      console.error("Erro geral na importação:", error);
      toast({
        title: "Erro na importação",
        description: error.message || "Erro ao processar arquivo. Verifique o formato.",
        variant: "destructive"
      });
    }
    setUploading(false);
  };

  const handleSubmitCliente = async (e) => {
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

  const handleDeleteCliente = async (cliente) => {
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
          <div className="h-64 bg-gray-200 rounded"></div>
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
            <h1 className="text-3xl font-bold text-gray-900">
              {user?.role === 'admin' ? 'Clientes do Marketplace' : 'Meus Clientes'}
            </h1>
            <p className="text-gray-600">Visualize, gerencie e importe clientes</p>
          </div>
          <div className="flex gap-2">
            {user?.role !== 'admin' && (
              <Button
                onClick={() => setShowDialog(true)}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            )}
            <Button
              onClick={exportToCSV}
              disabled={filteredClientes.length === 0}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button
              onClick={() => setActiveTab("importar")}
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar CSV
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="clientes">
              {user?.role === 'admin' ? 'Clientes' : 'Meus Clientes'} ({clientes.length})
            </TabsTrigger>
            <TabsTrigger value="importar">Importar</TabsTrigger>
          </TabsList>

          <TabsContent value="clientes" className="space-y-6">

        {/* Estatísticas */}
        {user?.role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-900">{clientes.length}</div>
                <p className="text-sm text-blue-700">Total de Clientes</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
              <CardContent className="p-4 text-center">
                <Mail className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-900">
                  {clientes.filter(c => c.email).length}
                </div>
                <p className="text-sm text-green-700">Com E-mail</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
              <CardContent className="p-4 text-center">
                <Phone className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-900">
                  {clientes.filter(c => c.whatsapp).length}
                </div>
                <p className="text-sm text-purple-700">Com WhatsApp</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtro */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {user?.role === 'admin' ? 'Lista de Clientes' : 'Meus Clientes'} ({filteredClientes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClientes.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum cliente encontrado</h3>
              <p className="text-gray-600 mb-4">
                {user?.role === 'admin' 
                  ? 'Os clientes aparecerão aqui quando acessarem o marketplace.'
                  : 'Você ainda não possui clientes cadastrados.'}
              </p>
              {user?.role !== 'admin' && (
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => setShowDialog(true)}
                    className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar Cliente
                  </Button>
                  <Button
                    onClick={() => setActiveTab("importar")}
                    variant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Importar CSV
                  </Button>
                </div>
              )}
            </div>
          ) : (
             {user?.role === 'admin' ? (
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Nome</TableHead>
                       <TableHead>E-mail</TableHead>
                       <TableHead>WhatsApp</TableHead>
                       <TableHead>Data de Cadastro</TableHead>
                       <TableHead>Última Visita</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredClientes.map((cliente) => (
                       <TableRow key={cliente.id} className="hover:bg-blue-50">
                         <TableCell className="font-medium">
                           {cliente.full_name || 'Não informado'}
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             <Mail className="w-4 h-4 text-gray-400" />
                             <span className="text-sm">{cliente.email || 'Não informado'}</span>
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2">
                             <Phone className="w-4 h-4 text-gray-400" />
                             <span className="text-sm">{cliente.whatsapp || 'Não informado'}</span>
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2 text-sm text-gray-600">
                             <Calendar className="w-4 h-4" />
                             {formatDate(cliente.created_date)}
                           </div>
                         </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-2 text-sm">
                             <Eye className="w-4 h-4 text-gray-400" />
                             {cliente.ultima_visita_marketplace ? (
                               <span className="text-gray-600">
                                 {formatDate(cliente.ultima_visita_marketplace)}
                               </span>
                             ) : (
                               <Badge variant="secondary" className="text-xs">
                                 Nunca acessou
                               </Badge>
                             )}
                           </div>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {filteredClientes.map((cliente) => (
                   <Card key={cliente.id} className="hover:shadow-lg transition-shadow">
                     <CardContent className="p-4">
                       <div className="flex items-start justify-between mb-3">
                         <div className="flex-1">
                           <h3 className="font-semibold text-gray-900">{cliente.nome}</h3>
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
                           onClick={() => handleDeleteCliente(cliente)}
                           className="text-red-600 hover:bg-red-50"
                         >
                           <Trash2 className="w-4 h-4" />
                         </Button>
                       </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             )}
           )}
         </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="importar" className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Instruções */}
             <div className="lg:col-span-2">
               <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <FileSpreadsheet className="w-5 h-5" />
                     Importar Clientes
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-6">
                   {/* Passo 1 */}
                   <div className="space-y-3">
                     <div className="flex items-center gap-2">
                       <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                         1
                       </div>
                       <h3 className="font-semibold text-gray-900">Baixe o Template</h3>
                     </div>
                     <p className="text-sm text-gray-600 ml-10">
                       Primeiro, baixe o arquivo CSV de exemplo com a estrutura correta de colunas.
                     </p>
                     <div className="ml-10">
                       <Button
                         onClick={downloadTemplate}
                         variant="outline"
                         className="hover:bg-blue-50 hover:border-blue-200"
                       >
                         <Download className="w-4 h-4 mr-2" />
                         Baixar Template (.CSV)
                       </Button>
                     </div>
                   </div>

                   <div className="border-t pt-6">
                     {/* Passo 2 */}
                     <div className="space-y-3">
                       <div className="flex items-center gap-2">
                         <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
                           2
                         </div>
                         <h3 className="font-semibold text-gray-900">Edite o Arquivo</h3>
                       </div>
                       <div className="ml-10 space-y-2">
                         <p className="text-sm text-gray-600">
                           Abra o arquivo no Excel ou Google Sheets e adicione seus clientes com as seguintes colunas:
                         </p>
                         <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                           <li><strong>Nome:</strong> Nome completo do cliente (obrigatório)</li>
                           <li><strong>E-mail:</strong> E-mail do cliente (obrigatório)</li>
                           <li><strong>WhatsApp:</strong> Telefone com WhatsApp (opcional)</li>
                         </ul>
                         <Alert className="bg-blue-50 border-blue-200 mt-3">
                           <AlertCircle className="w-4 h-4 text-blue-600" />
                           <AlertDescription className="text-blue-800 text-sm">
                             Os clientes serão convidados automaticamente para o marketplace com os dados importados.
                           </AlertDescription>
                         </Alert>
                       </div>
                     </div>
                   </div>

                   <div className="border-t pt-6">
                     {/* Passo 3 */}
                     <div className="space-y-3">
                       <div className="flex items-center gap-2">
                         <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold">
                           3
                         </div>
                         <h3 className="font-semibold text-gray-900">Importe de Volta</h3>
                       </div>
                       <div className="ml-10 space-y-3">
                         <p className="text-sm text-gray-600">
                           Salve o arquivo como CSV (separado por vírgulas) e faça upload aqui.
                         </p>

                         <div className="space-y-2">
                           <Label htmlFor="file-upload">Selecione o arquivo</Label>
                           <Input
                             id="file-upload"
                             type="file"
                             accept=".csv,.xlsx,.xls"
                             onChange={handleFileUpload}
                             className="cursor-pointer"
                             disabled={uploading}
                           />
                           {uploadedFile && (
                             <p className="text-sm text-green-600 flex items-center gap-2">
                               <CheckCircle className="w-4 h-4" />
                               Arquivo selecionado: {uploadedFile.name}
                             </p>
                           )}
                         </div>

                         <Button
                           onClick={processImport}
                           disabled={uploading || !uploadedFile}
                           className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                         >
                           {uploading ? (
                             <>
                               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                               Importando...
                             </>
                           ) : (
                             <>
                               <Upload className="w-4 h-4 mr-2" />
                               Importar Clientes
                             </>
                           )}
                         </Button>
                       </div>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             </div>

             {/* Sidebar de Informações */}
             <div>
               <Card className="bg-gradient-to-br from-blue-50 to-green-50 border-blue-200 border">
                 <CardHeader>
                   <CardTitle className="text-lg">Formato do Arquivo</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                   <div>
                     <h4 className="font-medium text-gray-900 text-sm mb-2">Colunas Esperadas:</h4>
                     <ul className="text-sm text-gray-600 space-y-2">
                       <li className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                         Nome (obrigatório)
                       </li>
                       <li className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                         E-mail (obrigatório)
                       </li>
                       <li className="flex items-center gap-2">
                         <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                         WhatsApp (opcional)
                       </li>
                     </ul>
                   </div>
                   <div className="border-t pt-3">
                     <h4 className="font-medium text-gray-900 text-sm mb-2">Formatos Aceitos:</h4>
                     <ul className="text-sm text-gray-600 space-y-1">
                       <li>✓ CSV (.csv)</li>
                       <li>✓ Excel (.xlsx, .xls)</li>
                     </ul>
                   </div>
                 </CardContent>
               </Card>
             </div>
           </div>
          </TabsContent>
          </Tabs>

          {/* Dialog de Cadastro/Edição */}
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

           <form onSubmit={handleSubmitCliente} className="space-y-4">
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
                 <X className="w-4 h-4 mr-2" />
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