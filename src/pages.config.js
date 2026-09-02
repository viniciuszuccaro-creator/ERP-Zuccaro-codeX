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
import AdministracaoSistema from './pages/AdministracaoSistema';
import Agenda from './pages/Agenda';
import CRM from './pages/CRM';
import Cadastros from './pages/Cadastros';
import ChatbotAtendimento from './pages/ChatbotAtendimento';
import Comercial from './pages/Comercial';
import Compras from './pages/Compras';
import ConfiguracoesUsuario from './pages/ConfiguracoesUsuario';
import Contratos from './pages/Contratos';
import Dashboard from './pages/Dashboard';
import DashboardCorporativo from './pages/DashboardCorporativo';
import DemoMultitarefas from './pages/DemoMultitarefas';
import Empresas from './pages/Empresas';
import EntregasMobile from './pages/EntregasMobile';
import Estoque from './pages/Estoque';
import Expedicao from './pages/Expedicao';
import Financeiro from './pages/Financeiro';
import Fiscal from './pages/Fiscal';
import Home from './pages/Home';
import HubAtendimento from './pages/HubAtendimento';
import OrcamentoSite from './pages/OrcamentoSite';
import PortalCliente from './pages/PortalCliente';
import Producao from './pages/Producao';
import ProducaoMobile from './pages/ProducaoMobile';
import RH from './pages/RH';
import Relatorios from './pages/Relatorios';
import portal from './pages/portal';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdministracaoSistema": AdministracaoSistema,
    "Agenda": Agenda,
    "CRM": CRM,
    "Cadastros": Cadastros,
    "ChatbotAtendimento": ChatbotAtendimento,
    "Comercial": Comercial,
    "Compras": Compras,
    "ConfiguracoesUsuario": ConfiguracoesUsuario,
    "Contratos": Contratos,
    "Dashboard": Dashboard,
    "DashboardCorporativo": DashboardCorporativo,
    "DemoMultitarefas": DemoMultitarefas,
    "Empresas": Empresas,
    "EntregasMobile": EntregasMobile,
    "Estoque": Estoque,
    "Expedicao": Expedicao,
    "Financeiro": Financeiro,
    "Fiscal": Fiscal,
    "Home": Home,
    "HubAtendimento": HubAtendimento,
    "OrcamentoSite": OrcamentoSite,
    "PortalCliente": PortalCliente,
    "Producao": Producao,
    "ProducaoMobile": ProducaoMobile,
    "RH": RH,
    "Relatorios": Relatorios,
    "portal": portal,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
