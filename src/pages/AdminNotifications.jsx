import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Plus, Trash2, Eye, Search, Filter, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function AdminNotifications() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [formData, setFormData] = useState({
    destinatario: "todos",
    tipo: "novo_produto",
    mensagem: "",
    produto_nome: "",
  });

  const { toast } = useToast();

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
    }
  };

  const loadData = async () => {
    try {
      const [allNotifications, allUsers] = await Promise.all([
        base44.entities.Notification.list('-created_date'),
        base44.entities.User.filter({ role: 'user', aprovado: true })
      ]);
      setNotifications(allNotifications);
      setUsers(allUsers);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let targetUsers = [];
      
      if (formData.destinatario === "todos") {
        targetUsers = users;
      } else if (formData.destinatario === "fabricantes") {
        targetUsers = users.filter(u => u.tipo_usuario === 'fabricante');
      } else if (formData.destinatario === "transportadores") {
        targetUsers = users.filter(u => u.tipo_usuario === 'transportador');
      } else if (formData.destinatario === "fornecedores") {
        targetUsers = users.filter(u => !u.tipo_usuario || u.tipo_usuario === null);
      }
      
      if (targetUsers.length === 0) {
        toast({
          title: "Nenhum usuário encontrado",
          description: "Não há usuários deste tipo para notificar.",
          variant: "destructive"
        });
        return;
      }
      
      const notifications = targetUsers.map(u => ({
        supplier_id: u.id,
        tipo: formData.tipo,
        mensagem: formData.mensagem,
        produto_nome: formData.produto_nome || null,
        lida: false
      }));
      
      await base44.entities.Notification.bulkCreate(notifications);
      toast({
        title: "Notificações enviadas!",
        description: `${notifications.length} usuário(s) notificado(s).`,
      });
      
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar notificação. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (notificationId) => {
    if (confirm("Tem certeza que deseja excluir esta notificação?")) {
      try {
        await base44.entities.Notification.delete(notificationId);
        loadData();
        toast({
          title: "Notificação excluída",
          description: "Notificação removida do sistema.",
        });
      } catch (error) {
        console.error("Erro ao excluir notificação:", error);
        toast({
          title: "Erro",
          description: "Erro ao excluir notificação.",
          variant: "destructive"
        });
      }
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await base44.entities.Notification.update(notificationId, { lida: true });
      loadData();
      toast({
        title: "Notificação marcada",
        description: "Notificação marcada como lida.",
      });
    } catch (error) {
      console.error("Erro:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      destinatario: "todos",
      tipo: "novo_produto",
      mensagem: "",
      produto_nome: "",
    });
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.empresa || user?.full_name || "Usuário";
  };

  const getFilteredNotifications = () => {
    let filtered = notifications;

    if (searchTerm) {
      filtered = filtered.filter(n =>
        n.mensagem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.produto_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getUserName(n.supplier_id).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter(n => n.tipo === filterType);
    }

    if (filterStatus !== "all") {
      const isRead = filterStatus === "lida";
      filtered = filtered.filter(n => n.lida === isRead);
    }

    if (filterUser !== "all") {
      filtered = filtered.filter(n => n.supplier_id === filterUser);
    }

    return filtered;
  };

  const getStats = () => {
    const total = notifications.length;
    const lidas = notifications.filter(n => n.lida).length;
    const naoLidas = notifications.filter(n => !n.lida).length;
    const porTipo = {
      novo_produto: notifications.filter(n => n.tipo === 'novo_produto').length,
      alteracao_preco: notifications.filter(n => n.tipo === 'alteracao_preco').length,
      produto_aprovado: notifications.filter(n => n.tipo === 'produto_aprovado').length,
    };

    return { total, lidas, naoLidas, porTipo };
  };

  const getTipoBadge = (tipo) => {
    const badges = {
      novo_produto: { label: "Novo Produto", color: "bg-blue-100 text-blue-700" },
      alteracao_preco: { label: "Alteração de Preço", color: "bg-amber-100 text-amber-700" },
      produto_aprovado: { label: "Produto Aprovado", color: "bg-green-100 text-green-700" },
      mensagem_placefit: { label: "Mensagem PlaceFit", color: "bg-purple-100 text-purple-700" }
    };
    const badge = badges[tipo] || { label: tipo, color: "bg-gray-100 text-gray-700" };
    return <Badge className={badge.color}>{badge.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = getStats();
  const filteredNotifications = getFilteredNotifications();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gerenciar Notificações</h1>
            <p className="text-gray-600">Acompanhe e envie notificações do sistema</p>
          </div>
          <Button 
            onClick={() => setShowDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Notificação
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Bell className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
              <p className="text-sm text-blue-700">Total</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <Eye className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">{stats.lidas}</div>
              <p className="text-sm text-green-700">Lidas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 border">
            <CardContent className="p-4 text-center">
              <Bell className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-amber-900">{stats.naoLidas}</div>
              <p className="text-sm text-amber-700">Não Lidas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Send className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">{stats.porTipo.novo_produto}</div>
              <p className="text-sm text-purple-700">Novos Produtos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200 border">
            <CardContent className="p-4 text-center">
              <Filter className="w-8 h-8 text-pink-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-pink-900">{stats.porTipo.alteracao_preco}</div>
              <p className="text-sm text-pink-700">Alterações</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar notificações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200"
              />
            </div>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full md:w-48 bg-white/80">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="novo_produto">Novo Produto</SelectItem>
              <SelectItem value="alteracao_preco">Alteração de Preço</SelectItem>
              <SelectItem value="produto_aprovado">Produto Aprovado</SelectItem>
              <SelectItem value="mensagem_placefit">Mensagem PlaceFit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full md:w-48 bg-white/80">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="lida">Lidas</SelectItem>
              <SelectItem value="nao_lida">Não Lidas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-full md:w-48 bg-white/80">
              <SelectValue placeholder="Usuário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Usuários</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.empresa || u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-500 hover:to-green-500">
                    <TableHead className="text-white font-semibold">Usuário</TableHead>
                    <TableHead className="text-white font-semibold">Tipo</TableHead>
                    <TableHead className="text-white font-semibold">Mensagem</TableHead>
                    <TableHead className="text-white font-semibold">Status</TableHead>
                    <TableHead className="text-white font-semibold">Data</TableHead>
                    <TableHead className="text-white font-semibold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotifications.map((notif, index) => (
                    <TableRow 
                      key={notif.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                    >
                      <TableCell className="font-medium">
                        {getUserName(notif.supplier_id)}
                      </TableCell>
                      <TableCell>
                        {getTipoBadge(notif.tipo)}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {notif.mensagem}
                      </TableCell>
                      <TableCell>
                        <Badge className={notif.lida ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                          {notif.lida ? "Lida" : "Não Lida"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(notif.created_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          {!notif.lida && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notif.id)}
                              className="hover:bg-green-50 hover:text-green-700"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(notif.id)}
                            className="hover:bg-red-50 hover:text-red-700"
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

            {filteredNotifications.length === 0 && (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma notificação encontrada</h3>
                <p className="text-gray-600">Tente ajustar os filtros.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Nova Notificação */}
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova Notificação</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="destinatario">Destinatário *</Label>
                <Select
                  value={formData.destinatario}
                  onValueChange={(value) => setFormData({ ...formData, destinatario: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um destinatário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">
                      <span className="font-semibold">Todos os Usuários ({users.length})</span>
                    </SelectItem>
                    <SelectItem value="fornecedores">
                      <span className="font-semibold">Fornecedores ({users.filter(u => !u.tipo_usuario).length})</span>
                    </SelectItem>
                    <SelectItem value="fabricantes">
                      <span className="font-semibold">Fabricantes ({users.filter(u => u.tipo_usuario === 'fabricante').length})</span>
                    </SelectItem>
                    <SelectItem value="transportadores">
                      <span className="font-semibold">Transportadores ({users.filter(u => u.tipo_usuario === 'transportador').length})</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tipo">Tipo de Notificação *</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo_produto">Novo Produto</SelectItem>
                    <SelectItem value="alteracao_preco">Alteração de Preço</SelectItem>
                    <SelectItem value="produto_aprovado">Produto Aprovado</SelectItem>
                    <SelectItem value="mensagem_placefit">Mensagem da PlaceFit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="produto_nome">Nome do Produto (opcional)</Label>
                <Input
                  id="produto_nome"
                  value={formData.produto_nome}
                  onChange={(e) => setFormData({ ...formData, produto_nome: e.target.value })}
                  placeholder="Ex: Esteira Profissional X1"
                />
              </div>

              <div>
                <Label htmlFor="mensagem">Mensagem *</Label>
                <Textarea
                  id="mensagem"
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  required
                  rows={4}
                  placeholder="Digite a mensagem da notificação..."
                />
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
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Notificação
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}