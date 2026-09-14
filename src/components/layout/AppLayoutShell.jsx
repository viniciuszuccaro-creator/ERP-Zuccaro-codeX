import React, { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { FileText, LogOut, Menu, Search, Settings } from 'lucide-react';

import AcoesRapidasGlobal from '@/components/AcoesRapidasGlobal';
import EmpresaSwitcher from '@/components/EmpresaSwitcher';
import NotificationCenter from '@/components/NotificationCenter';
import PesquisaUniversal from '@/components/PesquisaUniversal';
import MiniMapaNavegacao from '@/components/MiniMapaNavegacao';
import AtalhosTecladoInfo from '@/components/sistema/AtalhosTecladoInfo';
import BootstrapGuard from '@/components/lib/BootstrapGuard';
import ErrorBoundary from '@/components/lib/ErrorBoundary';
import GuardRails from '@/components/lib/GuardRails';
import MinimizedWindowsBar from '@/components/lib/MinimizedWindowsBar';
import WindowRenderer from '@/components/lib/WindowRenderer';
import ProtectedSection from '@/components/security/ProtectedSection';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { createPageUrl } from '@/utils';

/** @typedef {{ title: string, url: string, icon: React.ElementType, group: string }} NavigationItem */
/** @typedef {{ id?: string, full_name?: string, email?: string, role?: string }} LayoutUser */
/** @typedef {{ id?: string }} LayoutEmpresa */

const GROUP_LABELS = {
  principal: 'Principal',
  cadastros: 'Cadastros',
  operacional: 'Operacional',
  administrativo: 'Administrativo',
  sistema: 'Sistema',
  publico: 'Público',
};

// O componente legado de Sidebar ainda nao declara props JSDoc; estes aliases preservam sua API publica.
const TypedSidebarProvider = /** @type {React.ComponentType<any>} */ (SidebarProvider);
const TypedSidebar = /** @type {React.ComponentType<any>} */ (Sidebar);
const TypedSidebarHeader = /** @type {React.ComponentType<any>} */ (SidebarHeader);
const TypedSidebarContent = /** @type {React.ComponentType<any>} */ (SidebarContent);
const TypedSidebarGroup = /** @type {React.ComponentType<any>} */ (SidebarGroup);
const TypedSidebarGroupLabel = /** @type {React.ComponentType<any>} */ (SidebarGroupLabel);
const TypedSidebarGroupContent = /** @type {React.ComponentType<any>} */ (SidebarGroupContent);
const TypedSidebarMenu = /** @type {React.ComponentType<any>} */ (SidebarMenu);
const TypedSidebarMenuItem = /** @type {React.ComponentType<any>} */ (SidebarMenuItem);
const TypedSidebarMenuButton = /** @type {React.ComponentType<any>} */ (SidebarMenuButton);
const TypedSidebarFooter = /** @type {React.ComponentType<any>} */ (SidebarFooter);
const TypedSidebarTrigger = /** @type {React.ComponentType<any>} */ (SidebarTrigger);

/**
 * Shell visual privado do Layout existente. Nao possui consultas nem regras de autorizacao.
 * @param {{
 *   children: React.ReactNode,
 *   currentPageName?: string,
 *   moduleName: string,
 *   groupedItems: Record<string, NavigationItem[]>,
 *   currentPath: string,
 *   user?: LayoutUser | null,
 *   empresaAtual?: LayoutEmpresa | null,
 *   contexto?: string,
 *   isOffline: boolean,
 *   integracoesOk: boolean,
 *   pesquisaOpen: boolean,
 *   setPesquisaOpen: (open: boolean) => void,
 *   canViewSystem: boolean,
 *   onLogout: () => void,
 *   onPrefetch: (item: NavigationItem) => void,
 * }} props
 */
export default function AppLayoutShell({
  children,
  currentPageName,
  moduleName,
  groupedItems,
  currentPath,
  user,
  empresaAtual,
  contexto,
  isOffline,
  integracoesOk,
  pesquisaOpen,
  setPesquisaOpen,
  canViewSystem,
  onLogout,
  onPrefetch,
}) {
  return (
    <TypedSidebarProvider>
      <div className="min-h-screen h-full flex w-full bg-gradient-to-br from-slate-50 to-blue-50">
        <TypedSidebar className="border-r border-slate-200 bg-white/80 backdrop-blur-sm">
          <TypedSidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-slate-900">ERP Zuccaro</h2>
                <p className="text-xs text-slate-500">V21.5 • Sistema Completo</p>
              </div>
            </div>
          </TypedSidebarHeader>

          <TypedSidebarContent className="p-3">
            {Object.entries(groupedItems).map(([groupName, items]) => {
              if (items.length === 0) return null;
              return (
                <TypedSidebarGroup key={groupName}>
                  <TypedSidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 mb-1">
                    {GROUP_LABELS[groupName] || groupName}
                  </TypedSidebarGroupLabel>
                  <TypedSidebarGroupContent>
                    <TypedSidebarMenu>
                      {items.map((item) => {
                        const isActive = currentPath === item.url;
                        return (
                          <TypedSidebarMenuItem key={item.title}>
                            <TypedSidebarMenuButton
                              asChild
                              className={`transition-all duration-200 rounded-lg mb-1 ${isActive
                                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200'
                                : 'hover:bg-slate-100 text-slate-700'}`}
                            >
                              <Link to={item.url} onMouseEnter={() => onPrefetch(item)} className="flex items-center gap-3 px-4 py-3">
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                                <span className="font-medium">{item.title}</span>
                              </Link>
                            </TypedSidebarMenuButton>
                          </TypedSidebarMenuItem>
                        );
                      })}
                    </TypedSidebarMenu>
                  </TypedSidebarGroupContent>
                </TypedSidebarGroup>
              );
            })}
          </TypedSidebarContent>

          <TypedSidebarFooter className="border-t border-slate-200 p-4 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <Link to={createPageUrl('ConfiguracoesUsuario')} className="flex items-center gap-3 hover:bg-slate-100 p-2 rounded-lg transition-colors flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">{user?.full_name?.[0] || 'U'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{user?.full_name || 'Usuário'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.role === 'admin' ? 'Administrador' : 'Usuário'}</p>
                </div>
              </Link>
              <button onClick={onLogout} className="p-2 hover:bg-slate-200 rounded-lg transition-colors" title="Sair">
                <LogOut className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </TypedSidebarFooter>
        </TypedSidebar>

        <main className="flex-1 min-w-0 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-4 md:px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="lg:hidden">
                  <TypedSidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors">
                    <Menu className="w-5 h-5" />
                  </TypedSidebarTrigger>
                </div>
                <div className="hidden lg:block flex-1 max-w-md"><MiniMapaNavegacao /></div>
              </div>
              <div className="hidden sm:block"><EmpresaSwitcher /></div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPesquisaOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors hidden md:flex items-center gap-2" title="Pesquisa Universal (Ctrl+K)">
                  <Search className="w-5 h-5 text-slate-600" />
                  <span className="text-sm text-slate-500 hidden lg:inline">Ctrl+K</span>
                </button>
                <AtalhosTecladoInfo />
                <AcoesRapidasGlobal />
                <NotificationCenter />
                <Link to={createPageUrl('ConfiguracoesUsuario')}>
                  <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Configurações do usuário">
                    <Settings className="w-5 h-5 text-slate-600" />
                  </button>
                </Link>
              </div>
            </div>
            {isOffline && <LayoutWarning>Modo offline: exibindo dados em cache. Algumas ações podem não estar disponíveis.</LayoutWarning>}
            {!empresaAtual?.id && contexto !== 'grupo' && <LayoutWarning>Selecione uma empresa para carregar os dados. O acesso está bloqueado sem empresa selecionada.</LayoutWarning>}
            {!integracoesOk && canViewSystem && (
              <LayoutWarning>
                Integrações fiscais pendentes nesta empresa. <Link to={createPageUrl('AdministracaoSistema?tab=integracoes')} className="underline">Configurar agora</Link>.
              </LayoutWarning>
            )}
          </header>

          <div className="flex-1 min-h-0 overflow-auto">
            <ErrorBoundary>
              <Suspense fallback={<div className="p-6 text-slate-500">Carregando…</div>}>
                <BootstrapGuard>
                  <ProtectedSection module={moduleName || 'Sistema'} section={null} action="ver" fallback={<div className="p-10 text-center text-slate-600">Acesso negado a este módulo.</div>}>
                    <GuardRails currentPageName={currentPageName}>
                      <div className="w-full h-full">
                        <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 py-4 space-y-4">{children}</div>
                      </div>
                    </GuardRails>
                  </ProtectedSection>
                </BootstrapGuard>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        <PesquisaUniversal open={pesquisaOpen} onOpenChange={setPesquisaOpen} />
        <WindowRenderer />
        <MinimizedWindowsBar />
      </div>
    </TypedSidebarProvider>
  );
}

/** @param {{ children: React.ReactNode }} props */
function LayoutWarning({ children }) {
  return <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm">{children}</div>;
}
