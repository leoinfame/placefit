import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Package, TrendingUp, CheckCircle, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      
      // Subscrever a mudanças em tempo real
      try {
        const unsubscribe = base44.entities.Notification.subscribe((event) => {
          if (event.type === 'create' && event.data?.supplier_id === user.id) {
            loadNotifications();
          }
        });
        
        return () => {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        };
      } catch (error) {
        console.error("Erro ao subscrever notificações:", error);
      }
    }
  }, [user?.id]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Redirecionar apenas se for admin ou transportador
      if (currentUser.role === 'admin' || currentUser.tipo_usuario === 'transportador') {
        window.location.href = '/Dashboard';
      }
    } catch (error) {
      console.error("Erro ao carregar usuário:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    if (!user?.id) {
      return;
    }
    
    try {
      const notifs = await base44.entities.Notification.filter(
        { supplier_id: user.id },
        '-created_date',
        100
      );
      setNotifications(notifs || []);
      setUnreadCount((notifs || []).filter(n => !n.lida).length);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await base44.entities.Notification.update(notificationId, { lida: true });
      await loadNotifications();
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.lida);
      for (const notif of unreadNotifs) {
        await base44.entities.Notification.update(notif.id, { lida: true });
      }
      await loadNotifications();
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await base44.entities.Notification.delete(notificationId);
      await loadNotifications();
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
    }
  };

  const getNotificationIcon = (tipo) => {
    switch (tipo) {
      case 'novo_produto':
        return <Package className="w-5 h-5 text-blue-600" />;
      case 'alteracao_preco':
        return <TrendingUp className="w-5 h-5 text-orange-600" />;
      case 'produto_aprovado':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notificações</h1>
            <p className="text-gray-600">Acompanhe atualizações de produtos dos fabricantes</p>
          </div>
          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Check className="w-4 h-4 mr-2" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Bell className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{notifications.length}</div>
              <p className="text-sm text-blue-700">Total de Notificações</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 border">
            <CardContent className="p-4 text-center">
              <Bell className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-900">{unreadCount}</div>
              <p className="text-sm text-orange-700">Não Lidas</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Notificações */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma notificação</h3>
                <p className="text-gray-600">
                  Você será notificado quando houver novos produtos ou alterações de preço dos fabricantes.
                </p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notif) => (
              <Card
                key={notif.id}
                className={`bg-white/80 backdrop-blur-sm border-0 shadow-lg transition-all ${
                  !notif.lida ? 'border-l-4 border-l-blue-500' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 p-3 rounded-full flex-shrink-0 ${
                      !notif.lida ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {getNotificationIcon(notif.tipo)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          {notif.fabricante_nome && (
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              {notif.fabricante_nome}
                            </p>
                          )}
                          <p className="text-sm text-gray-700 break-words">
                            {notif.mensagem}
                          </p>
                        </div>
                        {!notif.lida && (
                          <Badge className="bg-blue-500 text-white flex-shrink-0">
                            Novo
                          </Badge>
                        )}
                      </div>
                      
                      {notif.produto_nome && (
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <p className="text-xs text-gray-500 mb-1">Produto:</p>
                          <p className="text-sm font-medium text-gray-900">{notif.produto_nome}</p>
                        </div>
                      )}
                      
                      {notif.preco_antigo && notif.preco_novo && (
                        <div className="flex items-center gap-4 mb-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Preço Anterior:</p>
                            <span className="text-red-600 line-through font-medium">
                              R$ {notif.preco_antigo.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Novo Preço:</p>
                            <span className="text-green-600 font-semibold">
                              R$ {notif.preco_novo.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-3 border-t">
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notif.created_date), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </p>
                        <div className="flex items-center gap-2">
                          {!notif.lida && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notif.id)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Marcar como lida
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotification(notif.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
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