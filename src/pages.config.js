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
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import MyProducts from './pages/MyProducts';
import Profile from './pages/Profile';
import Suppliers from './pages/Suppliers';
import Export from './pages/Export';
import PublicRegister from './pages/PublicRegister';
import PublicTable from './pages/PublicTable';
import Marketplace from './pages/Marketplace';
import Frete from './pages/Frete';
import Complementos from './pages/Complementos';
import AdminFrete from './pages/AdminFrete';
import Clientes from './pages/Clientes';
import AtendenteIA from './pages/AtendenteIA';
import FabricanteProdutos from './pages/FabricanteProdutos';
import Fabricantes from './pages/Fabricantes';
import PublicRegisterFabricante from './pages/PublicRegisterFabricante';
import Usuarios from './pages/Usuarios';
import Categories from './pages/Categories';
import Units from './pages/Units';
import Convite from './pages/Convite';
import PublicRegisterTransportador from './pages/PublicRegisterTransportador';
import TransportadorRotas from './pages/TransportadorRotas';
import Transportadores from './pages/Transportadores';
import ClientesVendas from './pages/ClientesVendas';
import Vendas from './pages/Vendas';
import Orcamentos from './pages/Orcamentos';
import Notifications from './pages/Notifications';
import AdminNotifications from './pages/AdminNotifications';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Products": Products,
    "MyProducts": MyProducts,
    "Profile": Profile,
    "Suppliers": Suppliers,
    "Export": Export,
    "PublicRegister": PublicRegister,
    "PublicTable": PublicTable,
    "Marketplace": Marketplace,
    "Frete": Frete,
    "Complementos": Complementos,
    "AdminFrete": AdminFrete,
    "Clientes": Clientes,
    "AtendenteIA": AtendenteIA,
    "FabricanteProdutos": FabricanteProdutos,
    "Fabricantes": Fabricantes,
    "PublicRegisterFabricante": PublicRegisterFabricante,
    "Usuarios": Usuarios,
    "Categories": Categories,
    "Units": Units,
    "Convite": Convite,
    "PublicRegisterTransportador": PublicRegisterTransportador,
    "TransportadorRotas": TransportadorRotas,
    "Transportadores": Transportadores,
    "ClientesVendas": ClientesVendas,
    "Vendas": Vendas,
    "Orcamentos": Orcamentos,
    "Notifications": Notifications,
    "AdminNotifications": AdminNotifications,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};