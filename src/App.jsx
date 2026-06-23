import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PublicTableFabricante from './pages/PublicTableFabricante';
import Marketplace from './pages/Marketplace';
import AdminTools from './pages/AdminTools';
import CatalogoWhatsApp from './pages/CatalogoWhatsApp';
import AdminServicos from './pages/AdminServicos';
import Servicos from './pages/Servicos';
import ConfigurarIA from './pages/ConfigurarIA';
import FinanceiroFiscal from './pages/FinanceiroFiscal';
import PedidosVenda from './pages/PedidosVenda';
import ClientesFiscais from './pages/ClientesFiscais';
import ConfiguracaoFiscal from './pages/ConfiguracaoFiscal';
import CatalogoFabricante from './pages/CatalogoFabricante';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const PUBLIC_PATHS = ['/', '/Marketplace', '/PublicTableFabricante', '/PublicRegister', '/PublicRegisterFabricante', '/PublicRegisterTransportador'];

const isPublicPath = () => {
  const path = window.location.pathname;
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Always render public paths without auth check
  if (isPublicPath()) {
    return (
      <Routes>
        <Route path="/" element={<Marketplace />} />
        <Route path="/Marketplace" element={<Marketplace />} />
        <Route path="/PublicTableFabricante" element={<PublicTableFabricante />} />
        <Route path="*" element={<Marketplace />} />
      </Routes>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<Marketplace />} />
      <Route path="/app" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/PublicTableFabricante" element={<PublicTableFabricante />} />
      <Route path="/AdminTools" element={<AdminTools />} />
      <Route path="/CatalogoWhatsApp" element={<LayoutWrapper currentPageName="CatalogoWhatsApp"><CatalogoWhatsApp /></LayoutWrapper>} />
      <Route path="/AdminServicos" element={<LayoutWrapper currentPageName="AdminServicos"><AdminServicos /></LayoutWrapper>} />
      <Route path="/Servicos" element={<LayoutWrapper currentPageName="Servicos"><Servicos /></LayoutWrapper>} />
      <Route path="/ConfigurarIA" element={<LayoutWrapper currentPageName="ConfigurarIA"><ConfigurarIA /></LayoutWrapper>} />
      <Route path="/FinanceiroFiscal" element={<LayoutWrapper currentPageName="FinanceiroFiscal"><FinanceiroFiscal /></LayoutWrapper>} />
      <Route path="/PedidosVenda" element={<LayoutWrapper currentPageName="PedidosVenda"><PedidosVenda /></LayoutWrapper>} />
      <Route path="/ClientesFiscais" element={<LayoutWrapper currentPageName="ClientesFiscais"><ClientesFiscais /></LayoutWrapper>} />
      <Route path="/ConfiguracaoFiscal" element={<LayoutWrapper currentPageName="ConfiguracaoFiscal"><ConfiguracaoFiscal /></LayoutWrapper>} />
      <Route path="/CatalogoFabricante" element={<LayoutWrapper currentPageName="CatalogoFabricante"><CatalogoFabricante /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App