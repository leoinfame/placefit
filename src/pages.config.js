/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminFrete from './pages/AdminFrete';
import AdminNotifications from './pages/AdminNotifications';
import AdminVersions from './pages/AdminVersions';
import AtendenteIA from './pages/AtendenteIA';
import AtendenteIARevendedor from './pages/AtendenteIARevendedor';
import Catalogo from './pages/Catalogo';
import Categories from './pages/Categories';
import Clientes from './pages/Clientes';
import ClientesVendas from './pages/ClientesVendas';
import Complementos from './pages/Complementos';
import Convite from './pages/Convite';
import Dashboard from './pages/Dashboard';
import DocumentacaoTecnica from './pages/DocumentacaoTecnica';
import Export from './pages/Export';
import FabricanteProdutos from './pages/FabricanteProdutos';
import Fabricantes from './pages/Fabricantes';
import FabricantesChina from './pages/FabricantesChina';
import FabricantesParaFabricantes from './pages/FabricantesParaFabricantes';
import FabricantesRevendedor from './pages/FabricantesRevendedor';
import Financeiro from './pages/Financeiro';
import Frete from './pages/Frete';
import Marketplace from './pages/Marketplace';
import MyProducts from './pages/MyProducts';
import Notifications from './pages/Notifications';
import Orcamentos from './pages/Orcamentos';
import PedidosCompra from './pages/PedidosCompra';
import PedidosCompraFabricante from './pages/PedidosCompraFabricante';
import Products from './pages/Products';
import Profile from './pages/Profile';
import PublicRegister from './pages/PublicRegister';
import PublicRegisterFabricante from './pages/PublicRegisterFabricante';
import PublicRegisterTransportador from './pages/PublicRegisterTransportador';
import PublicTable from './pages/PublicTable';
import Suporte from './pages/Suporte';
import Suppliers from './pages/Suppliers';
import TransportadorRotas from './pages/TransportadorRotas';
import Transportadores from './pages/Transportadores';
import Treinamento from './pages/Treinamento';
import Units from './pages/Units';
import Usuarios from './pages/Usuarios';
import Vendas from './pages/Vendas';
import ComprasInternacionais from './pages/ComprasInternacionais';
import AtualizacoesMercadoChina from './pages/AtualizacoesMercadoChina';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminFrete": AdminFrete,
    "AdminNotifications": AdminNotifications,
    "AdminVersions": AdminVersions,
    "AtendenteIA": AtendenteIA,
    "AtendenteIARevendedor": AtendenteIARevendedor,
    "Catalogo": Catalogo,
    "Categories": Categories,
    "Clientes": Clientes,
    "ClientesVendas": ClientesVendas,
    "Complementos": Complementos,
    "Convite": Convite,
    "Dashboard": Dashboard,
    "DocumentacaoTecnica": DocumentacaoTecnica,
    "Export": Export,
    "FabricanteProdutos": FabricanteProdutos,
    "Fabricantes": Fabricantes,
    "FabricantesChina": FabricantesChina,
    "FabricantesParaFabricantes": FabricantesParaFabricantes,
    "FabricantesRevendedor": FabricantesRevendedor,
    "Financeiro": Financeiro,
    "Frete": Frete,
    "Marketplace": Marketplace,
    "MyProducts": MyProducts,
    "Notifications": Notifications,
    "Orcamentos": Orcamentos,
    "PedidosCompra": PedidosCompra,
    "PedidosCompraFabricante": PedidosCompraFabricante,
    "Products": Products,
    "Profile": Profile,
    "PublicRegister": PublicRegister,
    "PublicRegisterFabricante": PublicRegisterFabricante,
    "PublicRegisterTransportador": PublicRegisterTransportador,
    "PublicTable": PublicTable,
    "Suporte": Suporte,
    "Suppliers": Suppliers,
    "TransportadorRotas": TransportadorRotas,
    "Transportadores": Transportadores,
    "Treinamento": Treinamento,
    "Units": Units,
    "Usuarios": Usuarios,
    "Vendas": Vendas,
    "ComprasInternacionais": ComprasInternacionais,
    "AtualizacoesMercadoChina": AtualizacoesMercadoChina,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};