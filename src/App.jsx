import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { Suspense, lazy } from 'react';
import Layout from './Layout.jsx';
import { LAZY_PAGES, MAIN_PAGE, lazyPage } from '@/lib/pageRegistry';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
const PublicTableFabricante = lazyPage('PublicTableFabricante');
const Marketplace = lazyPage('Marketplace');
const HomeApp = lazyPage('HomeApp');
const DocumentoInvestidor = lazyPage('DocumentoInvestidor');
const MinhaConta = lazyPage('MinhaConta');
const FabricanteCatalogoPublic = lazyPage('FabricanteCatalogoPublic');
const LojaPublica = lazyPage('LojaPublica');
const LojaPoliticaDevolucao = lazyPage('LojaPoliticaDevolucao');
const LojaProduto = lazyPage('LojaProduto');
const LojaClienteArea = lazyPage('LojaClienteArea');
const LojaEcommerce = lazyPage('LojaEcommerce');
const LojaRevendedor = lazyPage('LojaRevendedor');
const AdminTools = lazyPage('AdminTools');
const CatalogoWhatsApp = lazyPage('CatalogoWhatsApp');
const AdminServicos = lazyPage('AdminServicos');
const CustosSistema = lazyPage('CustosSistema');
const Servicos = lazyPage('Servicos');
const ConfigurarIA = lazyPage('ConfigurarIA');
const FinanceiroFiscal = lazyPage('FinanceiroFiscal');
const PedidosVenda = lazyPage('PedidosVenda');
const ClientesFiscais = lazyPage('ClientesFiscais');
const ConfiguracaoFiscal = lazyPage('ConfiguracaoFiscal');
const NotasFiscais = lazyPage('NotasFiscais');
const CatalogoFabricante = lazyPage('CatalogoFabricante');
const Atributos = lazyPage('Atributos');
const Produtos = lazyPage('Produtos');
const FabricantePublico = lazyPage('FabricantePublico');
const CRMWhatsApp = lazy(() => import('./components/crm/CRMWhatsApp'));
import ErrorBoundary from './components/ErrorBoundary';
const CrmPrivacidade = lazy(() => import('./components/crm-legal/CrmPrivacidade'));
const CrmTermos = lazy(() => import('./components/crm-legal/CrmTermos'));
const CrmExclusaoDados = lazy(() => import('./components/crm-legal/CrmExclusaoDados'));
const HubApp = lazy(() => import('./hub/HubApp'));

const Pages = LAZY_PAGES;
const mainPageKey = MAIN_PAGE;
const MainPage = (mainPageKey && Pages[mainPageKey]) || (() => null);

const PageLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}><ErrorBoundary>{children}</ErrorBoundary></Layout>
  : <ErrorBoundary>{children}</ErrorBoundary>;

const PUBLIC_PATHS = ['/', '/Marketplace', '/PublicTableFabricante', '/PublicRegister', '/PublicRegisterFabricante', '/PublicRegisterTransportador', '/FabricanteCatalogoPublic', '/fabricantes', '/loja', '/documento', '/crm/privacidade', '/crm/termos', '/crm/exclusao-de-dados'];

const isPublicPath = () => {
  const path = window.location.pathname;
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // hub.placefit.com.br abre direto na area do Hub
  if (window.location.hostname.startsWith('hub.') && window.location.pathname === '/') {
    window.location.replace('/hub');
    return null;
  }

  // Always render public paths without auth check
  if (isPublicPath()) {
    return (
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<ErrorBoundary><HomeApp /></ErrorBoundary>} />
        <Route path="/documento" element={<ErrorBoundary><DocumentoInvestidor /></ErrorBoundary>} />
        <Route path="/Marketplace" element={<ErrorBoundary><Marketplace /></ErrorBoundary>} />
        <Route path="/PublicTableFabricante" element={<ErrorBoundary><PublicTableFabricante /></ErrorBoundary>} />
        <Route path="/FabricanteCatalogoPublic/:id" element={<ErrorBoundary><FabricanteCatalogoPublic /></ErrorBoundary>} />
        <Route path="/fabricantes/:slug" element={<ErrorBoundary><FabricantePublico /></ErrorBoundary>} />
        <Route path="/loja/:slug/produto/:cod" element={<ErrorBoundary><LojaProduto /></ErrorBoundary>} />
        <Route path="/loja/:slug/conta" element={<ErrorBoundary><LojaClienteArea /></ErrorBoundary>} />
        <Route path="/loja/:slug/politica-devolucao" element={<ErrorBoundary><LojaPoliticaDevolucao /></ErrorBoundary>} />
        <Route path="/loja/:slug" element={<ErrorBoundary><LojaPublica /></ErrorBoundary>} />
        <Route path="/crm/privacidade" element={<ErrorBoundary><CrmPrivacidade /></ErrorBoundary>} />
        <Route path="/crm/termos" element={<ErrorBoundary><CrmTermos /></ErrorBoundary>} />
        <Route path="/crm/exclusao-de-dados" element={<ErrorBoundary><CrmExclusaoDados /></ErrorBoundary>} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
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
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/" element={<HomeApp />} />
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
      <Route path="/CRMWhatsApp" element={<LayoutWrapper currentPageName="CRMWhatsApp"><CRMWhatsApp /></LayoutWrapper>} />
      <Route path="/AdminServicos" element={<LayoutWrapper currentPageName="AdminServicos"><AdminServicos /></LayoutWrapper>} />
      <Route path="/CustosSistema" element={<LayoutWrapper currentPageName="CustosSistema"><CustosSistema /></LayoutWrapper>} />
      <Route path="/Servicos" element={<LayoutWrapper currentPageName="Servicos"><Servicos /></LayoutWrapper>} />
      <Route path="/ConfigurarIA" element={<LayoutWrapper currentPageName="ConfigurarIA"><ConfigurarIA /></LayoutWrapper>} />
      <Route path="/FinanceiroFiscal" element={<LayoutWrapper currentPageName="FinanceiroFiscal"><FinanceiroFiscal /></LayoutWrapper>} />
      <Route path="/PedidosVenda" element={<LayoutWrapper currentPageName="PedidosVenda"><PedidosVenda /></LayoutWrapper>} />
      <Route path="/ClientesFiscais" element={<LayoutWrapper currentPageName="ClientesFiscais"><ClientesFiscais /></LayoutWrapper>} />
      <Route path="/NotasFiscais" element={<LayoutWrapper currentPageName="NotasFiscais"><NotasFiscais /></LayoutWrapper>} />
      <Route path="/ConfiguracaoFiscal" element={<LayoutWrapper currentPageName="ConfiguracaoFiscal"><ConfiguracaoFiscal /></LayoutWrapper>} />
      <Route path="/CatalogoFabricante" element={<LayoutWrapper currentPageName="CatalogoFabricante"><CatalogoFabricante /></LayoutWrapper>} />
      <Route path="/Atributos" element={<LayoutWrapper currentPageName="Atributos"><Atributos /></LayoutWrapper>} />
      <Route path="/Produtos" element={<LayoutWrapper currentPageName="Produtos"><Produtos /></LayoutWrapper>} />
      <Route path="/LojaEcommerce" element={<LayoutWrapper currentPageName="LojaEcommerce"><LojaEcommerce /></LayoutWrapper>} />
      <Route path="/LojaRevendedor" element={<LayoutWrapper currentPageName="LojaRevendedor"><LojaRevendedor /></LayoutWrapper>} />
      <Route path="/MinhaConta" element={<LayoutWrapper currentPageName="MinhaConta"><MinhaConta /></LayoutWrapper>} />
      <Route path="/hub/*" element={<ErrorBoundary><HubApp /></ErrorBoundary>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
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