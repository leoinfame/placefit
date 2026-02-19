import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check, Package, TrendingUp, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function NotificationMenu({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
      
      // Subscrever a mudanças em tempo real
      const unsubscribe = base44.entities.Notification.subscribe((event) => {
        if (event.type === 'create' && event.data.supplier_id === user.id) {
          loadNotifications();
        }
      });
      
      return unsubscribe;
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      const notifs = await base44.entities.Notification.filter(
        { supplier_id: user.id },
        '-created_date',
        50
      );
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.lida).length);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    }
    setLoading(false);
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
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'alteracao_preco':
        return <TrendingUp className="w-4 h-4 text-orange-600" />;
      case 'produto_aprovado':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-900">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              <Check className="w-3 h-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-96">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notif.lida ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded-full ${
                      !notif.lida ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {getNotificationIcon(notif.tipo)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {notif.fabricante_nome && (
                            <p className="text-xs font-semibold text-gray-900 mb-1">
                              {notif.fabricante_nome}
                            </p>
                          )}
                          <p className="text-sm text-gray-700 break-words">
                            {notif.mensagem}
                          </p>
                          {notif.produto_nome && (
                            <p className="text-xs text-gray-500 mt-1">
                              Produto: {notif.produto_nome}
                            </p>
                          )}
                          {notif.preco_antigo && notif.preco_novo && (
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span className="text-red-600 line-through">
                                R$ {notif.preco_antigo.toFixed(2)}
                              </span>
                              <span className="text-green-600 font-semibold">
                                R$ {notif.preco_novo.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => deleteNotification(notif.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notif.created_date), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </p>
                        {!notif.lida && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notif.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 h-6 px-2"
                          >
                            Marcar como lida
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}