import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Package,
  LayoutDashboard,
  ShoppingCart,
  UserCircle,
  Download,
  Settings,
  LogOut,
  Menu,
  Dumbbell,
  Store,
  Users,
  Smartphone,
  X,
  Bell
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PLACEFIT_LOGO = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68c9d5dd3cf0f8fd8a834875/f1656529c_logo-ico-removebg-preview.png";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [adminViewMode, setAdminViewMode] = useState(() => {
    return localStorage.getItem('admin_view_mode') || 'admin';
  });
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // VERIFICAR PÁGINAS PÚBLICAS PRIMEIRO
  const isPublicPage = 
    currentPageName === 'Marketplace' || 
    currentPageName === 'Complementos' ||
    location.pathname.endsWith('/Marketplace') ||
    location.pathname.endsWith('/Complementos') ||
    location.pathname.includes('/Marketplace') ||
    location.pathname.includes('/Complementos');

  useEffect(() => {
    // Se for página pública, não precisa carregar usuário
    if (isPublicPage) {
      setLoading(false);
      return;
    }
    loadUser();

    // PWA Install Handler
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const hasClosedBanner = localStorage.getItem('pwa_banner_closed');
      if (!hasClosedBanner) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isPublicPage]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA instalado');
        alert('App instalado com sucesso! ✓');
      }
      
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    } else {
      // Instruções manuais detalhadas
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isChrome = /Chrome/.test(navigator.userAgent);
      const isEdge = /Edg/.test(navigator.userAgent);
      
      let message = '📱 COMO INSTALAR O PLACEFIT:\n\n';
      
      if (isIOS) {
        message += 'iPhone/iPad (Safari):\n';
        message += '1. Toque no botão de COMPARTILHAR (quadrado com seta para cima)\n';
        message += '2. Role a lista e toque em "Adicionar à Tela de Início"\n';
        message += '3. Confirme tocando em "Adicionar"\n';
      } else if (isAndroid) {
        message += 'Android (Chrome):\n';
        message += '1. Toque nos 3 PONTINHOS (⋮) no canto superior direito\n';
        message += '2. Toque em "Instalar app" ou "Adicionar à tela inicial"\n';
        message += '3. Confirme a instalação\n';
      } else if (isChrome || isEdge) {
        message += 'Desktop (Chrome/Edge):\n\n';
        message += 'OPÇÃO 1 (mais fácil):\n';
        message += '→ Procure o ícone de INSTALAÇÃO (⊕ ou 🖥️) na BARRA DE ENDEREÇO\n';
        message += '→ Fica do lado direito, perto da estrela de favoritos\n';
        message += '→ Clique nele e depois em "Instalar"\n\n';
        message += 'OPÇÃO 2:\n';
        message += '→ Clique nos 3 PONTINHOS (⋮) no canto superior direito\n';
        message += '→ Vá em "Salvar e compartilhar"\n';
        message += '→ Clique em "Instalar PlaceFit"\n\n';
        message += '⚠️ IMPORTANTE: O site precisa estar em HTTPS para instalação funcionar';
      } else {
        message += '⚠️ Este navegador não suporta instalação de apps.\n\n';
        message += 'Use Chrome ou Edge para instalar o app.';
      }
      
      alert(message);
    }
  };

  const handleCloseBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_banner_closed', 'true');
  };

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Carregar notificações não lidas para fornecedores e fabricantes
      if (currentUser.role === 'user' && (!currentUser.tipo_usuario || currentUser.tipo_usuario === 'fabricante')) {
        try {
          const notifs = await base44.entities.Notification.filter(
            { supplier_id: currentUser.id, lida: false }
          );
          setUnreadNotifications(notifs.length);
        } catch (error) {
          console.error("Erro ao carregar notificações:", error);
        }
      }
    } catch (error) {
      setUser(null);
    }
    setLoading(false);
  };

  const handleAdminViewModeChange = (mode) => {
    setAdminViewMode(mode);
    localStorage.setItem('admin_view_mode', mode);
    window.location.reload();
  };

  const getEffectiveUser = () => {
    if (!user || user.role !== 'admin') return user;
    
    if (adminViewMode === 'fornecedor') {
      return { ...user, role: 'user', tipo_usuario: null, aprovado: true };
    }
    if (adminViewMode === 'fabricante') {
      return { ...user, role: 'user', tipo_usuario: 'fabricante', aprovado: true };
    }
    if (adminViewMode === 'transportador') {
      return { ...user, role: 'user', tipo_usuario: 'transportador', aprovado: true };
    }
    return user;
  };

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.reload();
  };

  const getNavigationItems = () => {
    if (!user) return [];
    
    const effectiveUser = getEffectiveUser();

    const baseItems = [
      {
        title: "Painel",
        url: createPageUrl("Dashboard"),
        icon: LayoutDashboard,
      }
    ];

    if (effectiveUser.tipo_usuario === 'transportador') {
      baseItems.push(
        {
          title: "Minhas Rotas",
          url: createPageUrl("TransportadorRotas"),
          icon: Dumbbell,
        },
        {
          title: "Perfil",
          url: createPageUrl("Profile"),
          icon: Settings,
        }
      );
      return baseItems;
    }

    if (effectiveUser.role === 'admin' && user.role === 'admin' && adminViewMode === 'admin') {
      baseItems.push(
        {
          title: "Usuários",
          url: createPageUrl("Usuarios"),
          icon: Users,
        },
        {
          title: "Notificações",
          url: createPageUrl("AdminNotifications"),
          icon: Bell,
        },
        {
          title: "Produtos",
          url: createPageUrl("Products"),
          icon: Package,
        },
        {
          title: "  • Categorias",
          url: createPageUrl("Categories"),
          icon: Package,
        },
        {
          title: "  • Unidades",
          url: createPageUrl("Units"),
          icon: Package,
        },
        {
          title: "Fornecedores",
          url: createPageUrl("Suppliers"),
          icon: UserCircle,
        },
        {
          title: "Fabricantes",
          url: createPageUrl("Fabricantes"),
          icon: Package,
        },
        {
          title: "Transportadoras",
          url: createPageUrl("Transportadores"),
          icon: Dumbbell,
        },
        {
          title: "Clientes",
          url: createPageUrl("Clientes"),
          icon: Users,
        },
        {
          title: "Frete",
          url: createPageUrl("AdminFrete"),
          icon: Dumbbell,
        },
        {
          title: "Atendente IA",
          url: createPageUrl("AtendenteIA"),
          icon: Package,
        },
        {
          title: "Marketplace",
          url: createPageUrl("Marketplace"),
          icon: Store,
        },
        {
          title: "Complementos",
          url: createPageUrl("Complementos"),
          icon: Dumbbell,
        },
        {
          title: "Convites",
          url: createPageUrl("Convite"),
          icon: Users,
        }
      );
    } else if (effectiveUser.tipo_usuario === 'fabricante') {
      baseItems.push(
        {
          title: "Notificações",
          url: createPageUrl("Notifications"),
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : null
        },
        {
          title: "Meus Produtos",
          url: createPageUrl("FabricanteProdutos"),
          icon: Package,
        },
        {
          title: "Sua Tabela",
          url: createPageUrl("Export"),
          icon: Download,
        },
        {
          title: "Orçamentos",
          url: createPageUrl("Orcamentos"),
          icon: Dumbbell,
        },
        {
          title: "Vendas",
          url: createPageUrl("Vendas"),
          icon: ShoppingCart,
        },
        {
          title: "  • Clientes",
          url: createPageUrl("ClientesVendas"),
          icon: Users,
        }
      );
    } else {
      baseItems.push(
        {
          title: "Notificações",
          url: createPageUrl("Notifications"),
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : null
        },
        {
          title: "Meus Produtos",
          url: createPageUrl("MyProducts"),
          icon: ShoppingCart,
        },
        {
          title: "Frete",
          url: createPageUrl("Frete"),
          icon: Dumbbell,
        },
        {
          title: "Sua Tabela",
          url: createPageUrl("Export"),
          icon: Download,
        },
        {
          title: "Orçamentos",
          url: createPageUrl("Orcamentos"),
          icon: Dumbbell,
        },
        {
          title: "Vendas",
          url: createPageUrl("Vendas"),
          icon: ShoppingCart,
        },
        {
          title: "  • Clientes",
          url: createPageUrl("ClientesVendas"),
          icon: Users,
        }
      );
    }

    baseItems.push({
      title: "Perfil",
      url: createPageUrl("Profile"),
      icon: Settings,
    });

    return baseItems;
  };

  // Se for página pública, renderizar sem layout e sem exigir login
  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <img 
            src={PLACEFIT_LOGO} 
            alt="PlaceFit" 
            className="w-12 h-12 mx-auto object-contain animate-pulse"
          />
          <div className="animate-pulse text-gray-600">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <img 
            src={PLACEFIT_LOGO} 
            alt="PlaceFit" 
            className="w-16 h-16 mx-auto mb-6 object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">PlaceFit</h1>
          <p className="text-gray-600 mb-8">Plataforma de Fornecedores</p>
          <Button 
            onClick={() => base44.auth.redirectToLogin()} 
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold py-3 rounded-xl transition-all duration-300"
          >
            Entrar com Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50 overflow-x-hidden">
        <style>{`
          :root {
            --primary-blue: #1e40af;
            --primary-green: #059669;
            --surface-white: #ffffff;
            --surface-gray: #f8fafc;
            --text-primary: #0f172a;
            --text-secondary: #64748b;
            --border-light: #e2e8f0;
          }

          /* Prevenir scroll horizontal em todo o app */
          html, body {
            overflow-x: hidden !important;
            max-width: 100vw !important;
          }

          #root {
            overflow-x: hidden !important;
            max-width: 100vw !important;
          }
        `}</style>
        
        <Sidebar className="border-r border-white/20 bg-white/80 backdrop-blur-xl">
          <SidebarHeader className="border-b border-slate-200/50 p-6">
            <div className="flex items-center gap-3">
              <img 
                src={PLACEFIT_LOGO} 
                alt="PlaceFit" 
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="font-bold text-gray-900 text-lg">PlaceFit</h2>
                <p className="text-xs text-gray-500">
                  {getEffectiveUser().role === 'admin' ? 'Administração' : getEffectiveUser().tipo_usuario === 'fabricante' ? 'Fabricantes' : getEffectiveUser().tipo_usuario === 'transportador' ? 'Transportadora' : 'Fornecedores'}
                </p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                {getEffectiveUser().role === 'admin' ? 'Administração' : getEffectiveUser().tipo_usuario === 'fabricante' ? 'Fabricante' : getEffectiveUser().tipo_usuario === 'transportador' ? 'Transportadora' : 'Fornecedor'}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {getNavigationItems().map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-green-50 hover:text-blue-700 transition-all duration-300 rounded-lg mb-1 ${
                          location.pathname === item.url 
                            ? 'bg-gradient-to-r from-blue-50 to-green-50 text-blue-700 shadow-sm' 
                            : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-3">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium">{item.title}</span>
                          {item.badge && (
                            <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                              {item.badge > 9 ? '9+' : item.badge}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200/50 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-3 h-auto">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-green-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-semibold text-sm">
                        {user.full_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {user.empresa || user.full_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {getEffectiveUser().role === 'admin' ? 'Administrador' : getEffectiveUser().tipo_usuario === 'fabricante' ? 'Fabricante' : getEffectiveUser().tipo_usuario === 'transportador' ? 'Transportadora' : 'Fornecedor'}
                      </p>
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl("Profile")} className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleInstallClick} className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Instalar App
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-red-600">
                  <LogOut className="w-4 h-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 lg:hidden">
                <SidebarTrigger>
                  <Menu className="w-6 h-6" />
                </SidebarTrigger>
                <h1 className="text-xl font-semibold text-gray-900">PlaceFit</h1>
              </div>
              <div className="hidden lg:block flex-1">
                {user?.role === 'admin' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 font-medium">Visualizar como:</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={adminViewMode === 'admin' ? 'default' : 'outline'}
                        onClick={() => handleAdminViewModeChange('admin')}
                        className={adminViewMode === 'admin' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                      >
                        Admin
                      </Button>
                      <Button
                        size="sm"
                        variant={adminViewMode === 'fornecedor' ? 'default' : 'outline'}
                        onClick={() => handleAdminViewModeChange('fornecedor')}
                        className={adminViewMode === 'fornecedor' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        Fornecedor
                      </Button>
                      <Button
                        size="sm"
                        variant={adminViewMode === 'fabricante' ? 'default' : 'outline'}
                        onClick={() => handleAdminViewModeChange('fabricante')}
                        className={adminViewMode === 'fabricante' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        Fabricante
                      </Button>
                      <Button
                        size="sm"
                        variant={adminViewMode === 'transportador' ? 'default' : 'outline'}
                        onClick={() => handleAdminViewModeChange('transportador')}
                        className={adminViewMode === 'transportador' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                      >
                        Transportador
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <Button
                onClick={handleInstallClick}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden md:inline">Instalar App</span>
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {/* PWA Install Banner */}
            {showInstallBanner && (
              <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-4 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Smartphone className="w-6 h-6 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Instalar PlaceFit no seu celular</p>
                      <p className="text-xs opacity-90">Acesse mais rápido e receba notificações</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleInstallClick}
                      size="sm"
                      className="bg-white text-blue-600 hover:bg-gray-100"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Instalar
                    </Button>
                    <Button
                      onClick={handleCloseBanner}
                      size="sm"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}