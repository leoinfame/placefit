import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { adminUpdateUser } from "@/functions/adminUpdateUser";
import { Users, Search, Building, Trash2, UserCog, Pencil, X, Check, UserPlus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function Usuarios() {
  const [user, setUser] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [filteredUsuarios, setFilteredUsuarios] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null); // { id, field, value }
  const [showCadastroDialog, setShowCadastroDialog] = useState(false);
  const [cadastroForm, setCadastroForm] = useState({ email: "", tipo: "fornecedor" });
  const [submittingCadastro, setSubmittingCadastro] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterUsuarios();
  }, [usuarios, searchTerm, filterRole]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const allUsers = await base44.entities.User.list('-created_date');
      setUsuarios(allUsers);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
    setLoading(false);
  };

  const filterUsuarios = () => {
    let filtered = usuarios;

    if (searchTerm) {
      filtered = filtered.filter(u =>
        (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.empresa?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    }

    if (filterRole !== 'all') {
      if (filterRole === 'fornecedor') {
        filtered = filtered.filter(u => u.role === 'user' && u.tipo_usuario !== 'fabricante' && u.tipo_usuario !== 'transportador');
      } else if (filterRole === 'fabricante') {
        filtered = filtered.filter(u => u.tipo_usuario === 'fabricante');
      } else if (filterRole === 'transportador') {
        filtered = filtered.filter(u => u.tipo_usuario === 'transportador');
      } else {
        filtered = filtered.filter(u => u.role === filterRole);
      }
    }

    setFilteredUsuarios(filtered);
  };

  const handleApprovalToggle = async (usuario) => {
    try {
      await base44.entities.User.update(usuario.id, {
        aprovado: !usuario.aprovado
      });
      loadData();
      toast({
        title: "Status atualizado",
        description: `Usuário ${usuario.aprovado ? 'desaprovado' : 'aprovado'} com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao alterar aprovação:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleChangeUserType = async (usuario, newType) => {
    try {
      const updateData = {
        tipo_usuario: newType === 'fornecedor' ? null : newType,
        role: newType === 'admin' ? 'admin' : 'user'
      };

      await base44.entities.User.update(usuario.id, updateData);
      loadData();
      toast({
        title: "Categoria alterada!",
        description: `Usuário agora é ${newType}.`,
      });
    } catch (error) {
      console.error("Erro ao alterar categoria:", error);
      toast({
        title: "Erro",
        description: "Erro ao alterar categoria. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleEditField = (usuario, field) => {
    setEditingUser({ id: usuario.id, field, value: usuario[field] || '' });
  };

  const handleSaveField = async () => {
    if (!editingUser) return;
    try {
      await adminUpdateUser({ userId: editingUser.id, data: { [editingUser.field]: editingUser.value } });
      setEditingUser(null);
      loadData();
      toast({ title: "Atualizado!", description: "Campo atualizado com sucesso." });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao atualizar campo.", variant: "destructive" });
    }
  };

  const handleCadastrarUsuario = async (e) => {
    e.preventDefault();
    setSubmittingCadastro(true);
    try {
      // Convidar usuário (role sempre 'user' para fabricante/revendedor/transportador)
      await base44.users.inviteUser(cadastroForm.email, 'user');

      // Tentar atualizar tipo_usuario assim que aparecer na lista
      // (pode demorar - o admin pode ajustar na tabela se necessário)
      toast({
        title: "Convite enviado!",
        description: `Convite enviado para ${cadastroForm.email} como ${cadastroForm.tipo}. Após o primeiro acesso, defina o tipo na tabela abaixo.`,
      });

      setCadastroForm({ email: "", tipo: "fornecedor" });
      setShowCadastroDialog(false);
      setTimeout(loadData, 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao cadastrar usuário.",
        variant: "destructive"
      });
    }
    setSubmittingCadastro(false);
  };

  const handleDeleteUser = async (usuario) => {
    if (usuario.role === 'admin') {
      toast({
        title: "Ação não permitida",
        description: "Não é possível excluir administradores.",
        variant: "destructive"
      });
      return;
    }

    if (confirm(`Tem certeza que deseja excluir o usuário "${usuario.full_name || usuario.email}"? Esta ação não pode ser desfeita.`)) {
      try {
        await base44.entities.User.delete(usuario.id);
        loadData();
        toast({
          title: "Usuário excluído",
          description: "Usuário removido com sucesso.",
        });
      } catch (error) {
        console.error("Erro ao excluir usuário:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir usuário. Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const getUserType = (usuario) => {
    if (usuario.role === 'admin') return 'admin';
    if (usuario.tipo_usuario === 'fabricante') return 'fabricante';
    if (usuario.tipo_usuario === 'transportador') return 'transportador';
    return 'fornecedor';
  };

  const getUserTypeBadge = (usuario) => {
    const type = getUserType(usuario);
    const colors = {
      admin: 'bg-red-100 text-red-700 border-red-200',
      fabricante: 'bg-purple-100 text-purple-700 border-purple-200',
      fornecedor: 'bg-blue-100 text-blue-700 border-blue-200',
      transportador: 'bg-orange-100 text-orange-700 border-orange-200'
    };
    const labels = {
      admin: 'Administrador',
      fabricante: 'Fabricante',
      fornecedor: 'Fornecedor',
      transportador: 'Transportadora'
    };
    return (
      <Badge variant="outline" className={colors[type]}>
        {labels[type]}
      </Badge>
    );
  };

  const getStats = () => {
    const total = usuarios.length;
    const admins = usuarios.filter(u => u.role === 'admin').length;
    const fornecedores = usuarios.filter(u => u.role === 'user' && u.tipo_usuario !== 'fabricante' && u.tipo_usuario !== 'transportador').length;
    const fabricantes = usuarios.filter(u => u.tipo_usuario === 'fabricante').length;
    const transportadores = usuarios.filter(u => u.tipo_usuario === 'transportador').length;

    return { total, admins, fornecedores, fabricantes, transportadores };
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

  const stats = getStats();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gerenciar Usuários</h1>
            <p className="text-gray-600">Visualize e gerencie todos os usuários da plataforma</p>
          </div>
          <Button
            onClick={() => setShowCadastroDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Cadastrar Usuário
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
              <p className="text-sm text-blue-700">Total</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 border">
            <CardContent className="p-4 text-center">
              <UserCog className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-red-900">{stats.admins}</div>
              <p className="text-sm text-red-700">Admins</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <Building className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{stats.fornecedores}</div>
              <p className="text-sm text-green-700">Fornecedores</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{stats.fabricantes}</div>
              <p className="text-sm text-purple-700">Fabricantes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">{stats.transportadores}</div>
              <p className="text-sm text-orange-700">Transportadoras</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, email ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200"
              />
            </div>
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-full md:w-48 bg-white/80">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="admin">Administradores</SelectItem>
              <SelectItem value="fornecedor">Fornecedores</SelectItem>
              <SelectItem value="fabricante">Fabricantes</SelectItem>
              <SelectItem value="transportador">Transportadoras</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela de Usuários */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                    <TableHead className="text-white font-semibold">Nome</TableHead>
                    <TableHead className="text-white font-semibold">E-mail</TableHead>
                    <TableHead className="text-white font-semibold">Empresa</TableHead>
                    <TableHead className="text-white font-semibold">Contato</TableHead>
                    <TableHead className="text-white font-semibold">Tipo</TableHead>
                    <TableHead className="text-white font-semibold text-center">Status</TableHead>
                    <TableHead className="text-white font-semibold text-center">Alterar Categoria</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsuarios.map((usuario, index) => (
                    <TableRow
                      key={usuario.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                    >
                      <TableCell className="font-medium">
                        {editingUser?.id === usuario.id && editingUser?.field === 'full_name' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingUser.value}
                              onChange={e => setEditingUser(p => ({ ...p, value: e.target.value }))}
                              className="h-7 text-sm w-36"
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSaveField}><Check className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400" onClick={() => setEditingUser(null)}><X className="w-3.5 h-3.5" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span>{usuario.full_name || '-'}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600" onClick={() => handleEditField(usuario, 'full_name')}><Pencil className="w-3 h-3" /></Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {editingUser?.id === usuario.id && editingUser?.field === 'email' ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingUser.value}
                              onChange={e => setEditingUser(p => ({ ...p, value: e.target.value }))}
                              className="h-7 text-sm w-44"
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSaveField}><Check className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400" onClick={() => setEditingUser(null)}><X className="w-3.5 h-3.5" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group">
                            <span>{usuario.email}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600" onClick={() => handleEditField(usuario, 'email')}><Pencil className="w-3 h-3" /></Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{usuario.empresa || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {usuario.whatsapp || '-'}
                      </TableCell>
                      <TableCell>
                        {getUserTypeBadge(usuario)}
                      </TableCell>
                      <TableCell className="text-center">
                        {usuario.role !== 'admin' && (
                          <div className="flex items-center justify-center space-x-2">
                            <Switch
                              checked={usuario.aprovado}
                              onCheckedChange={() => handleApprovalToggle(usuario)}
                            />
                            <Label className="text-xs">
                              {usuario.aprovado ? 'Aprovado' : 'Pendente'}
                            </Label>
                          </div>
                        )}
                        {usuario.role === 'admin' && (
                          <Badge className="bg-green-100 text-green-700">
                            Ativo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={getUserType(usuario)}
                          onValueChange={(value) => handleChangeUserType(usuario, value)}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="fornecedor">Fornecedor</SelectItem>
                            <SelectItem value="fabricante">Fabricante</SelectItem>
                            <SelectItem value="transportador">Transportadora</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(usuario)}
                            className="hover:bg-red-50 hover:text-red-700"
                            title="Excluir usuário"
                            disabled={usuario.role === 'admin'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredUsuarios.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum usuário encontrado</h3>
                <p className="text-gray-600">Ajuste os filtros ou busca.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Cadastro */}
      <Dialog open={showCadastroDialog} onOpenChange={setShowCadastroDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Cadastrar Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCadastrarUsuario} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="email-cadastro">E-mail *</Label>
              <Input
                id="email-cadastro"
                type="email"
                placeholder="email@exemplo.com"
                value={cadastroForm.email}
                onChange={(e) => setCadastroForm({ ...cadastroForm, email: e.target.value })}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tipo-cadastro">Tipo de Usuário *</Label>
              <Select
                value={cadastroForm.tipo}
                onValueChange={(v) => setCadastroForm({ ...cadastroForm, tipo: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fornecedor">Revendedor / Fornecedor</SelectItem>
                  <SelectItem value="fabricante">Fabricante</SelectItem>
                  <SelectItem value="transportador">Transportadora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ Um convite será enviado ao e-mail. Após o primeiro acesso, ajuste o tipo do usuário na tabela se necessário.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCadastroDialog(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submittingCadastro}
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
              >
                {submittingCadastro ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" />Enviar Convite</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}