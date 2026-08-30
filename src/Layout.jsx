import React, { useEffect, useState, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
        LayoutDashboard, 
        Users, 
        ShoppingCart, 
        Truck, 
        DollarSign, 
        Package,
        UserCircle,
        Menu,
        LogOut,
        Box,
        FileText,
        Settings,
        Shield,
        Calendar,
        BarChart3,
        Factory,
        Search,
        MessageCircle,
        CheckCircle2,
        Trophy,
        Zap
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
import { base44 } from "@/api/base44Client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import usePermissions from "@/components/lib/usePermissions";
import NotificationCenter from "@/components/NotificationCenter";
import EmpresaSwitcher from "@/components/EmpresaSwitcher";
import { UserProvider, useUser } from "@/components/lib/UserContext";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import AcoesRapidasGlobal from "@/components/AcoesRapidasGlobal";
import PesquisaUniversal from "@/components/PesquisaUniversal";
import MiniMapaNavegacao from "@/components/MiniMapaNavegacao";
import { WindowProvider } from "@/components/lib/WindowManager";
import WindowRenderer from "@/components/lib/WindowRenderer";
import MinimizedWindowsBar from "@/components/lib/MinimizedWindowsBar";
import AtalhosTecladoInfo from "@/components/sistema/AtalhosTecladoInfo";
import ZIndexGuard from "@/components/lib/ZIndexFix";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import "@/components/lib/networkGuard";
import BootstrapGuard from "@/components/lib/BootstrapGuard";
import GlobalNetworkErrorHandler from "@/components/lib/GlobalNetworkErrorHandler";
import GuardRails from "@/components/lib/GuardRails";
import GlobalContextStamp from "@/components/lib/GlobalContextStamp";
import ProtectedSection from "@/components/security/ProtectedSection";
import { sanitizeOnWrite } from "@/components/lib/sanitizeOnWrite";
import { usePrefetchModuleData } from "@/components/lib/usePrefetchModuleData";
import { useInvalidationBus } from "@/components/lib/useInvalidationBus";
import { useNavHistory } from "@/components/lib/useNavHistory";
import { usePredictivePrefetch } from "@/components/lib/usePredictivePrefetch";
import { idbClearExpired } from "@/components/lib/useIndexedDBCache";
import { toEntityScope, toGuardScope } from "@/components/lib/contextoMultiempresaPolicy";

const reportLayoutFailure = (operation, error, context = {}) => {
  console.error('[Layout] ' + operation, {
    error: error?.message || String(error),
    ...context,
  });
};

const navigationItems = [
        { title: "Dashboard", url: createPageUrl("Dashboard"), icon: LayoutDashboard, group: "principal" },
        { title: "Dashboard Corporativo", url: createPageUrl("DashboardCorporativo"), icon: BarChart3, group: "principal" },
        { title: "Relatórios e Análises", url: createPageUrl("Relatorios"), icon: BarChart3, group: "principal" },
        { title: "Agenda e Calendário", url: createPageUrl("Agenda"), icon: Calendar, group: "principal" },
        { title: "CRM - Relacionamento", url: createPageUrl("CRM"), icon: Users, group: "principal" },
  { title: "Cadastros Gerais", url: createPageUrl("Cadastros"), icon: Users, group: "cadastros" },
  { title: "Comercial e Vendas", url: createPageUrl("Comercial"), icon: ShoppingCart, group: "operacional" },
  { title: "Estoque e Almoxarifado", url: createPageUrl("Estoque"), icon: Box, group: "operacional" },
  { title: "Compras e Suprimentos", url: createPageUrl("Compras"), icon: Package, group: "operacional" },
  { title: "Expedição e Logística", url: createPageUrl("Expedicao"), icon: Truck, group: "operacional" },
  { title: "Produção e Manufatura", url: createPageUrl("Producao"), icon: Factory, group: "operacional" },



  { title: "Financeiro e Contábil", url: createPageUrl("Financeiro"), icon: DollarSign, group: "administrativo" },
  { title: "Recursos Humanos", url: createPageUrl("RH"), icon: UserCircle, group: "administrativo" },
  { title: "Fiscal e Tributário", url: createPageUrl("Fiscal"), icon: FileText, group: "administrativo" },
  { title: "Gestão de Contratos", url: createPageUrl("Contratos"), icon: FileText, group: "administrativo" },
  { title: "Administração do Sistema", url: createPageUrl("AdministracaoSistema?tab=integracoes"), icon: Settings, group: "sistema" },
  
  
  
  
  { title: "Hub de Atendimento", url: createPageUrl("HubAtendimento"), icon: MessageCircle, group: "principal" },
  ];

// React Query client centralizado (padrões seguros + performance)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120000,
      gcTime: 300000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: { retry: 1 }
  }
});

function LayoutContent({ children, currentPageName }) {
  // Módulo atual da página (definido no topo para evitar TDZ)
  const pageToModule = {
    CRM: 'CRM',
    Comercial: 'Comercial',
    Estoque: 'Estoque',
    Compras: 'Compras',
    Financeiro: 'Financeiro',
    Fiscal: 'Fiscal',
    RH: 'RH',
    Expedicao: 'Expedição',
    Producao: 'Produção',
    ProducaoMobile: 'Produção',
    Dashboard: 'Dashboard',
    DashboardCorporativo: 'Dashboard',
    Relatorios: 'Relatórios',
    Agenda: 'Agenda',
    Cadastros: 'Cadastros',
    Contratos: 'Contratos',
    AdministracaoSistema: 'Sistema',
  };
  const moduleName = pageToModule?.[currentPageName] || 'Sistema';
              // AppLayout + Sidebar + Topbar padrão já implementados; reforço de h-full/scroll interno preservado
        const location = useLocation();
        const { user } = useUser();
        const { empresaAtual, filterInContext, grupoAtual, contexto } = useContextoVisual();
        const { hasPermission } = usePermissions();
        const contextRef = React.useRef({ user, empresaAtual, grupoAtual, contexto, moduleName });
        contextRef.current = { user, empresaAtual, grupoAtual, contexto, moduleName };


        const [pesquisaOpen, setPesquisaOpen] = useState(false);
        const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
        const auditThrottleRef = React.useRef({ click: 0, change: 0 });
        const { prefetch: prefetchModule } = usePrefetchModuleData();
        const AUDIT_BUSINESS_ONLY = true;
        const queryClient = useQueryClient();

        // Fase 2: Barramento de invalidação seletiva — substitui broadcast global por keys específicas
        useInvalidationBus([
          'Cliente', 'Fornecedor', 'Transportadora', 'Colaborador', 'Produto',
          'Pedido', 'ContaReceber', 'ContaPagar', 'Entrega', 'NotaFiscal',
          'OrdemCompra', 'MovimentacaoEstoque', 'Oportunidade', 'Representante',
          'ContatoB2B', 'SegmentoCliente', 'RegiaoAtendimento',
        ], { enabled: true });

        // Fase 3: Rastreamento de histórico + prefetch preditivo
        useNavHistory();
        usePredictivePrefetch();

        const [integracoesOk, setIntegracoesOk] = useState(true);

  // pageToModule/moduleName movidos para antes dos efeitos para evitar TDZ

        // Auditoria global de erros do React Query (queries e mutations)
        React.useEffect(() => {
          try {
            queryClient.setDefaultOptions({
              queries: {
                staleTime: 120000,
                gcTime: 300000,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
                retry: 1,
                onError: (error) => {
                                                                                    const m = String(error?.message || '');
                                                                                    const code = error?.code;
                                                                                    const name = error?.name;
                                                                                    const status = error?.response?.status || error?.status;
                                                                                    if (name === 'AbortError' || code === 'ERR_CANCELED' || /aborted|abort|canceled|cancelled/i.test(m)) { return; }
                                                                                    if (status === 429 || /rate limit/i.test(m)) { return; }
                                                                                    try {
                                                                                      const msg = (error && (error.message || String(error))) || 'Erro em query';
                                                                (async () => {
                                                                  try {
                                                                    if (await base44.auth.isAuthenticated()) {
                                                                      await base44.functions.invoke('auditError', {
                                                                        module: moduleName || 'Sistema',
                                                                        message: `Query error: ${msg}`,
                                                                        stack: error?.stack || null,
                                                                        page: currentPageName,
                                                                        empresa_id: empresaAtual?.id || null,
                                                                        group_id: grupoAtual?.id || null,
                                                                        metadata: { queryKey: 'unknown' }
                                                                      });
                                                                    }
                                                                  } catch (auditError) { reportLayoutFailure('Falha ao auditar erro de query', auditError); }
                                                                })();
                                                              } catch (error) { reportLayoutFailure('Falha ao preparar auditoria de query', error); }
                                                            }
              },
              mutations: {
                retry: 1,
                onError: (error) => {
                                                                                    const m = String(error?.message || '');
                                                                                    const code = error?.code;
                                                                                    const name = error?.name;
                                                                                    const status = error?.response?.status || error?.status;
                                                                                    if (name === 'AbortError' || code === 'ERR_CANCELED' || /aborted|abort|canceled|cancelled/i.test(m)) { return; }
                                                                                    if (status === 429 || /rate limit/i.test(m)) { return; }
                                                                                    try {
                                                                                      const msg = (error && (error.message || String(error))) || 'Erro em mutation';
                                                                (async () => {
                                                                  try {
                                                                    if (await base44.auth.isAuthenticated()) {
                                                                      await base44.functions.invoke('auditError', {
                                                                        module: moduleName || 'Sistema',
                                                                        message: `Mutation error: ${msg}`,
                                                                        stack: error?.stack || null,
                                                                        page: currentPageName,
                                                                        empresa_id: empresaAtual?.id || null,
                                                                        group_id: grupoAtual?.id || null,
                                                                        metadata: { mutation: true }
                                                                      });
                                                                    }
                                                                  } catch (auditError) { reportLayoutFailure('Falha ao auditar erro de mutation', auditError); }
                                                                })();
                                                              } catch (error) { reportLayoutFailure('Falha ao preparar auditoria de mutation', error); }
                                                            }
              }
            });
          } catch (error) { reportLayoutFailure('Falha ao configurar React Query', error); }
        }, [user?.id, empresaAtual?.id, grupoAtual?.id, moduleName, currentPageName]);

        const prefetchForItem = (title) => {
                        try {
                          switch (title) {
                            case 'Dashboard':
                              queryClient.prefetchQuery({ queryKey: ['dash', 'kpis'], queryFn: () => base44.entities.AuditLog.filter({}, '-data_hora', 5) });
                              queryClient.prefetchQuery({
                                queryKey: ['dash', 'groupConsolidation', empresaAtual?.id, grupoAtual?.id, contexto],
                                queryFn: async () => {
                                  const res = await base44.functions.invoke('groupConsolidation', { filtros: {} });
                                  return res?.data;
                                }
                              });
                              break;
                            case 'CRM - Relacionamento':
                              queryClient.prefetchQuery({ queryKey: ['crm', 'clientes'], queryFn: () => filterInContext('Cliente', {}, '-updated_date', 10) });
                              queryClient.prefetchQuery({ queryKey: ['crm', 'oportunidades'], queryFn: () => filterInContext('Oportunidade', {}, '-updated_date', 10) });
                              break;
                            case 'Comercial e Vendas':
                              queryClient.prefetchQuery({ queryKey: ['comercial', 'pedidos'], queryFn: () => filterInContext('Pedido', {}, '-updated_date', 10) });
                              break;
                            case 'Estoque e Almoxarifado':
                              queryClient.prefetchQuery({ queryKey: ['estoque', 'produtos'], queryFn: () => filterInContext('Produto', {}, '-updated_date', 10) });
                              break;
                            case 'Compras e Suprimentos':
                              queryClient.prefetchQuery({ queryKey: ['compras', 'ocs'], queryFn: () => filterInContext('OrdemCompra', {}, '-updated_date', 10) });
                              break;
                            case 'Financeiro e Contábil':
                              queryClient.prefetchQuery({ queryKey: ['fin', 'pagar'], queryFn: () => filterInContext('ContaPagar', {}, '-updated_date', 10) });
                              queryClient.prefetchQuery({ queryKey: ['fin', 'receber'], queryFn: () => filterInContext('ContaReceber', {}, '-updated_date', 10) });
                              break;
                            case 'Expedição e Logística':
                              queryClient.prefetchQuery({ queryKey: ['log', 'entregas'], queryFn: () => filterInContext('Entrega', {}, '-updated_date', 10) });
                              break;
                            default:
                              break;
                          }
                        } catch (error) { reportLayoutFailure('Falha no prefetch do menu', error, { title }); }
                        };

                        // pageToModule/moduleName já declarados acima (remoção da duplicata para evitar TDZ)

                        useEffect(() => {
    const handleKeyDown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'k') {
        e.preventDefault();
        setPesquisaOpen(true);
      }

      if (ctrl && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        window.location.href = createPageUrl('Dashboard');
      }

      if (ctrl && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        window.location.href = createPageUrl('Comercial');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Offline status + basic offline shell cache (last data snapshot)
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Verificação de integrações fiscais por empresa (alerta leve para admins)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!empresaAtual?.id) { if (!cancelled) setIntegracoesOk(true); return; }
        // Apenas perfis com permissão de Sistema visualizam alerta
        const allowed = hasPermission('Sistema', null, 'ver');
        if (!allowed) { if (!cancelled) setIntegracoesOk(true); return; }
        const chave = `integracoes_${empresaAtual.id}`;
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) { if (!cancelled) setIntegracoesOk(true); return; }
        const res = await base44.functions.invoke('getEntityRecord', {
          entityName: 'ConfiguracaoSistema',
          filter: { chave },
          limit: 1,
        });
        const cfg = Array.isArray(res?.data) ? (res.data[0] || null) : null;
        const ok = !!(cfg?.integracao_nfe?.api_key && cfg?.integracao_boletos?.api_key);
        if (!cancelled) setIntegracoesOk(!!ok);
      } catch {
        if (!cancelled) setIntegracoesOk(true);
      }
    })();
    return () => { cancelled = true; };
  }, [empresaAtual?.id]);

  // PWA-lite: injeta manifest em runtime e tenta registrar service worker (se disponível)
  useEffect(() => {
    try {
      // Injeta <link rel="manifest"> dinâmico
      const manifest = {
        name: 'ERP Zuccaro',
        short_name: 'ERP',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'https://base44.com/logo_v2.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'https://base44.com/logo_v2.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = URL.createObjectURL(blob);
      // Evita múltiplas inserções
      const existing = document.head.querySelector('link[rel="manifest"]');
      if (!existing) document.head.appendChild(link);

      // Meta para barra de status em mobile
      const themeMeta = document.querySelector('meta[name="theme-color"]') || document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      themeMeta.setAttribute('content', '#0f172a');
      if (!themeMeta.parentElement) document.head.appendChild(themeMeta);

      // Apple PWA meta/icons
      const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]') || document.createElement('meta');
      appleMeta.setAttribute('name', 'apple-mobile-web-app-capable');
      appleMeta.setAttribute('content', 'yes');
      if (!appleMeta.parentElement) document.head.appendChild(appleMeta);

      const appleIcon = document.querySelector('link[rel="apple-touch-icon"]') || document.createElement('link');
      appleIcon.setAttribute('rel', 'apple-touch-icon');
      appleIcon.setAttribute('href', 'https://base44.com/logo_v2.svg');
      if (!appleIcon.parentElement) document.head.appendChild(appleIcon);

      // CSP meta (melhora segurança client-side)
      try {
        const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]') || document.createElement('meta');
        csp.setAttribute('http-equiv', 'Content-Security-Policy');
        csp.setAttribute('content', "upgrade-insecure-requests; default-src 'self' https: data: blob:; connect-src 'self' https: wss:; img-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; frame-ancestors 'self'; object-src 'none'");
        if (!csp.parentElement) document.head.appendChild(csp);
      } catch (error) { reportLayoutFailure('Falha ao configurar CSP do PWA', error); }
      
      // Enforce HTTPS at client as fallback (HSTS at edge)
      try {
        if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
          window.location.replace('https://' + window.location.host + window.location.pathname + window.location.search + window.location.hash);
        }
      } catch (error) { reportLayoutFailure('Falha ao aplicar redirecionamento HTTPS', error); }
    
    } catch (error) { reportLayoutFailure('Falha ao preparar metadados do PWA', error); }

    // Registrar service worker com estratégia de atualização
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // Registra SW servido por função (compatível com Vite 6, sem plugin)
        fetch('/functions/pwaSw', { method: 'HEAD' }).then((res) => {
          if (!res.ok) {
            try {
              (async () => {
                try {
                  if (await base44.auth.isAuthenticated()) {
                    await base44.entities.AuditLog.create({
                      acao: 'Visualização', modulo: moduleName || 'Sistema', tipo_auditoria: 'sistema', entidade: 'PWA',
                      descricao: 'Service Worker ausente - registro pulado', data_hora: new Date().toISOString(),
                      usuario: user?.full_name || 'Usuário', usuario_id: user?.id || null,
                      empresa_id: empresaAtual?.id || null, group_id: grupoAtual?.id || null,
                    });
                  }
                } catch (error) { reportLayoutFailure('Falha ao auditar ausencia do Service Worker', error); }
              })();
            } catch (error) { reportLayoutFailure('Falha ao preparar auditoria do Service Worker', error); }
            return;
          }
          navigator.serviceWorker.register('/functions/pwaSw').then((reg) => {
            // Força ativação da nova versão quando disponível
            if (reg && reg.waiting) { try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (error) { reportLayoutFailure('Falha ao ativar atualizacao do Service Worker', error); } }
            reg.onupdatefound = () => {
              const nw = reg.installing;
              if (!nw) return;
              nw.onstatechange = () => {
                if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                  try {
                    (async () => {
                      try {
                        if (await base44.auth.isAuthenticated()) {
                          await base44.entities.AuditLog.create({
                            acao: 'Visualização', modulo: moduleName || 'Sistema', tipo_auditoria: 'sistema', entidade: 'PWA',
                            descricao: 'Nova versão PWA disponível', data_hora: new Date().toISOString(),
                            usuario: user?.full_name || 'Usuário', usuario_id: user?.id || null,
                            empresa_id: empresaAtual?.id || null, group_id: grupoAtual?.id || null,
                          });
                        }
                      } catch (error) { reportLayoutFailure('Falha ao auditar nova versao do PWA', error); }
                    })();
                  } catch (error) { reportLayoutFailure('Falha ao preparar auditoria da nova versao do PWA', error); }
                }
              };
            };
            // Checagens periódicas por atualização (1h)
            try {
              setInterval(() => { try { reg.update(); } catch (error) { reportLayoutFailure('Falha ao atualizar Service Worker', error); } }, 60 * 60 * 1000);
            } catch (error) { reportLayoutFailure('Falha ao agendar atualizacao do Service Worker', error); }
            // Auditoria quando o SW assumir controle (atualização aplicada)
            try {
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                try { (async () => { try { if (await base44.auth.isAuthenticated()) { await base44.entities.AuditLog.create({
                  acao: 'Visualização', modulo: moduleName || 'Sistema', tipo_auditoria: 'sistema', entidade: 'PWA',
                  descricao: 'Service Worker atualizado e ativo', data_hora: new Date().toISOString(),
                  usuario: user?.full_name || 'Usuário', usuario_id: user?.id || null,
                  empresa_id: empresaAtual?.id || null, group_id: grupoAtual?.id || null,
                }); } } catch (error) { reportLayoutFailure('Falha ao auditar ativacao do Service Worker', error); } })(); } catch (error) { reportLayoutFailure('Falha ao preparar auditoria de ativacao do Service Worker', error); }
              });
            } catch (error) { reportLayoutFailure('Falha ao observar ativacao do Service Worker', error); }
          }).catch((error) => reportLayoutFailure('Falha ao registrar Service Worker', error));
        }).catch((error) => reportLayoutFailure('Falha ao verificar Service Worker', error));
      });
    }
    }, []);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const indexKey = 'rq_index_keys';
    const addToIndex = (k) => {
      try {
        const curr = JSON.parse(localStorage.getItem(indexKey) || '[]');
        if (!curr.includes(k)) {
          curr.push(k);
          localStorage.setItem(indexKey, JSON.stringify(curr));
        }
      } catch (error) { reportLayoutFailure('Falha ao atualizar indice do cache offline', error); }
    };
    const sub = cache.subscribe((event) => {
      try {
        if (event?.type !== 'updated') return;
        const q = event.query;
        const state = q.getState?.();
        if (state?.data === undefined) return;
        const scopeEmpresa = empresaAtual?.id || '';
        const scopeGrupo = grupoAtual?.id || '';
        const storageKey = `rq_${JSON.stringify(q.queryKey)}_${scopeEmpresa}_${scopeGrupo}`;
        localStorage.setItem(storageKey, JSON.stringify(state.data));
        addToIndex(storageKey);
      } catch (error) { reportLayoutFailure('Falha ao persistir cache offline', error); }
    });
    // Hydrate when offline (cold start)
    if (isOffline) {
      try {
        const keys = JSON.parse(localStorage.getItem(indexKey) || '[]');
        keys.forEach((k) => {
          try {
            const val = JSON.parse(localStorage.getItem(k) || 'null');
            if (val != null) {
              const match = k.match(/^rq_(.*)_/);
              if (match) {
                const keyJson = match[1];
                const qk = JSON.parse(keyJson);
                queryClient.setQueryData(qk, val);
              }
            }
          } catch (error) { reportLayoutFailure('Falha ao restaurar item do cache offline', error, { storageKey: k }); }
        });
      } catch (error) { reportLayoutFailure('Falha ao restaurar indice do cache offline', error); }
    }
    return () => { if (typeof sub === 'function') sub(); };
  }, [queryClient, isOffline, empresaAtual?.id, grupoAtual?.id]);

  // Registro global de erros de UI (não altera layout visual)
  useEffect(() => {
    const onError = (e) => {
                                    try {
                                      const msg = e?.message || e?.error?.message || 'Erro de UI';
                                      const code = e?.error?.code;
                                      const name = e?.error?.name;
                                      const status = e?.error?.response?.status || e?.error?.status;
                                      if (name === 'AbortError' || code === 'ERR_CANCELED' || /aborted|abort|canceled|cancelled/i.test(String(msg))) { return; }
                                      if (status === 429 || /rate limit/i.test(String(msg))) { return; }
                            const stack = e?.error?.stack || null;
                            (async () => {
                              try {
                                if (await base44.auth.isAuthenticated()) {
                                  await base44.functions.invoke('auditError', {
                                    module: moduleName || 'Sistema',
                                    message: `Erro não tratado: ${msg}`,
                                    stack,
                                    page: currentPageName,
                                    empresa_id: empresaAtual?.id || null,
                                    group_id: grupoAtual?.id || null,
                                    metadata: { source: e?.filename, lineno: e?.lineno, colno: e?.colno }
                                  });
                                }
                              } catch (auditError) { reportLayoutFailure('Falha ao auditar erro global', auditError); }
                            })();
                } catch (error) { reportLayoutFailure('Falha ao processar erro global', error); }
              };
    const onUnhandled = (e) => {
                                    try {
                                      const msg = e?.reason?.message || String(e?.reason);
                                      const code = e?.reason?.code;
                                      const name = e?.reason?.name;
                                      const status = e?.reason?.response?.status || e?.reason?.status;
                                      if (name === 'AbortError' || code === 'ERR_CANCELED' || /aborted|abort|canceled|cancelled/i.test(String(msg))) { return; }
                                      if (status === 429 || /rate limit/i.test(String(msg))) { return; }
                            (async () => {
                              try {
                                if (await base44.auth.isAuthenticated()) {
                                  await base44.functions.invoke('auditError', {
                                    module: moduleName || 'Sistema',
                                    message: `Promise rejeitada: ${msg}`,
                                    stack: e?.reason?.stack || null,
                                    page: currentPageName,
                                    empresa_id: empresaAtual?.id || null,
                                    group_id: grupoAtual?.id || null,
                                    metadata: { reason: e?.reason }
                                  });
                                }
                              } catch (auditError) { reportLayoutFailure('Falha ao auditar promise rejeitada', auditError); }
                            })();
                } catch (error) { reportLayoutFailure('Falha ao processar promise rejeitada', error); }
              };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const entityToModule = {
      Cliente: 'CRM',
      Oportunidade: 'CRM',
      Interacao: 'CRM',
      Pedido: 'Comercial',
      NotaFiscal: 'Fiscal',
      Entrega: 'Expedição',
      Romaneio: 'Expedição',
      Fornecedor: 'Compras',
      SolicitacaoCompra: 'Compras',
      OrdemCompra: 'Compras',
      Produto: 'Estoque',
      MovimentacaoEstoque: 'Estoque',
      ContaPagar: 'Financeiro',
      ContaReceber: 'Financeiro',
      Evento: 'Agenda',
      Comissao: 'Comercial',
    };
    const stampConfig = {
      Cliente: { nameField: 'vendedor_responsavel', idField: 'vendedor_responsavel_id' },
      Oportunidade: { nameField: 'responsavel', idField: 'responsavel_id' },
      Interacao: { nameField: 'responsavel', idField: 'responsavel_id' },
      Entrega: { nameField: 'usuario_responsavel', idField: 'usuario_responsavel_id' },
      MovimentacaoEstoque: { nameField: 'responsavel', idField: 'responsavel_id' },
      Pedido: { nameField: 'vendedor', idField: 'vendedor_id' },
    };

    const entities = Object.keys(entityToModule);
    const unsubs = entities.map((name) => {
      const api = base44.entities?.[name];
      if (!api?.subscribe) return null;
      return api.subscribe(async (evt) => {
        try {
          // 1) Auditoria universal
          await base44.entities.AuditLog.create({
                            usuario: user?.full_name || user?.email || 'Usuário',
                            usuario_id: user?.id,
                            empresa_id: empresaAtual?.id || null,
                            empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
                            acao: evt.type === 'create' ? 'Criação' : evt.type === 'update' ? 'Edição' : 'Exclusão',
                            modulo: entityToModule[name],
                            tipo_auditoria: 'entidade',
                            entidade: name,
                            registro_id: evt.id,
                            descricao: `${name} ${evt.type}`,
                            dados_novos: evt?.data || null,
                          });

          // 2) Carimbo de responsável + multiempresa no momento da criação, quando fizer sentido
          if (evt.type === 'create') {
            const cfg = stampConfig[name];
            const data = evt?.data || {};
            const patch = {};

            if (cfg) {
              const hasName = data?.[cfg.nameField];
              const hasId = data?.[cfg.idField];
              if (!hasName) patch[cfg.nameField] = user?.full_name || user?.email;
              if (!hasId) patch[cfg.idField] = user?.id;
            }
            if ('empresa_id' in data && !data?.empresa_id && empresaAtual?.id) {
              patch.empresa_id = empresaAtual.id;
            }

            if (Object.keys(patch).length > 0) {
              try {
                await base44.entities?.[name]?.update?.(evt.id, patch);
              } catch (_) { /* silencioso: se não puder atualizar, seguimos */ }
            }

            // Replicação descendente: se o registro foi criado no contexto de Grupo (tem group_id e não tem empresa_id)
            try {
              if (evt?.data?.group_id && !evt?.data?.empresa_id) {
                if (await base44.auth.isAuthenticated()) {
                  await base44.functions.invoke('propagateGroupConfigs', {
                    entity_name: name,
                    source_id: evt.id,
                    group_id: evt.data.group_id
                  });
                }
              }
            } catch (error) {
              reportLayoutFailure('Falha ao propagar configuracao do Grupo', error, { entity: name, id: evt?.id });
            }
          }

          // Invalidação de queries relacionadas ao evento (sync frontend↔backend)
          try {
            const map = {
              Pedido: [['pedidos']],
              ContaReceber: [['contasReceber'], ['cobrancas']],
              ContaPagar: [['contasPagar']],
              Entrega: [['entregas']],
              Colaborador: [['colaboradores']],
              Produto: [['produtos'], ['produtos-count-dash']],
              Cliente: [['clientes'], ['clientes-count']],
              OrdemProducao: [['ordensProducao']],
              NotaFiscal: [['notasFiscais']],
            };
            (map[name] || []).forEach((qk) => {
              try { queryClient.invalidateQueries({ queryKey: qk }); } catch (error) { reportLayoutFailure('Falha ao invalidar consulta', error, { entity: name, queryKey: qk }); }
            });
          } catch (error) {
            reportLayoutFailure('Falha ao processar invalidacao de consultas', error, { entity: name });
          }

        } catch (error) {
          reportLayoutFailure('Falha no evento de auditoria da entidade', error, { entity: name, id: evt?.id });
        }
      });
    }).filter(Boolean);

    return () => { unsubs.forEach(u => { if (typeof u === 'function') u(); }); };
  }, [user?.id, empresaAtual?.id, queryClient]);

  // Global Phase 4 patch: multiempresa stamping + audit on entity writes
  useEffect(() => {
    if (!base44?.entities) return;

    const stamp = (dados) => {
      const out = { ...(dados || {}) };
      try {
        const ctx = contextRef.current;
        if (ctx.grupoAtual?.id && !out.group_id) out.group_id = ctx.grupoAtual.id;
        if (ctx.contexto !== 'grupo' && ctx.empresaAtual?.id && !out.empresa_id) out.empresa_id = ctx.empresaAtual.id;
      } catch (error) {
        reportLayoutFailure('Falha ao aplicar contexto multiempresa', error);
      }
      return out;
    };

    const getScope = () => {
      try {
        const ctx = contextRef.current;
        return toGuardScope({
          scopeType: ctx.contexto,
          groupId: ctx.grupoAtual?.id || ctx.empresaAtual?.group_id || ctx.empresaAtual?.grupo_id,
          empresaId: ctx.empresaAtual?.id,
        });
      } catch (_) {
        return toGuardScope({});
      }
    };

    // Cache local de permissões RBAC (evita chamadas repetidas ao backend)
    const __rbacCache = window.__layoutRbacCache || (window.__layoutRbacCache = new Map());
    const __RBAC_TTL = 5 * 60 * 1000; // 5 minutos

    const checkRBAC = async (entityName, action, sectionHint = null, op = null) => {
      try {
        const scope = getScope();
        if (scope.__blocked) throw new Error(scope.__error || 'Contexto multiempresa obrigatório');
        // Proteção imediata de entidades críticas (sem chamada backend)
        if (entityName === 'AuditLog' || entityName === 'PerfilAcesso') {
          if (['criar','editar','excluir'].includes(action)) throw new Error('RBAC: entidade protegida');
        }
        // Admin sempre permitido (sem chamada backend)
        if (contextRef.current.user?.role === 'admin') return;

        const map = {
          Cliente: 'CRM', Oportunidade: 'CRM', Interacao: 'CRM',
          Pedido: 'Comercial', Comissao: 'Comercial',
          NotaFiscal: 'Fiscal',
          Entrega: 'Expedição', Romaneio: 'Expedição',
          Fornecedor: 'Compras', SolicitacaoCompra: 'Compras', OrdemCompra: 'Compras',
          Produto: 'Estoque', MovimentacaoEstoque: 'Estoque',
          ContaPagar: 'Financeiro', ContaReceber: 'Financeiro', CentroCusto: 'Financeiro',
          PerfilAcesso: 'Administração', User: 'Administração', Evento: 'Agenda'
        };
        const modName = map[entityName] || 'Sistema';
        const cacheKey = `${modName}|${sectionHint || entityName}|${action}|${scope.empresa_id || ''}|${scope.group_id || ''}`;
        const now = Date.now();
        const cached = __rbacCache.get(cacheKey);
        if (cached && now - cached.ts < __RBAC_TTL) {
          if (!cached.allowed) throw new Error('RBAC backend: ação negada');
          return;
        }

        const payload = {
          module: modName,
          section: sectionHint || entityName,
          action,
          entity_name: entityName,
          operation: op,
          empresa_id: scope.empresa_id || null,
          group_id: scope.group_id || null,
          scope_type: scope.scope_type,
        };
        const res = await base44.functions.invoke('entityGuard', payload);
        const allowed = res?.data?.allowed === true;
        __rbacCache.set(cacheKey, { allowed, ts: now });
        if (!allowed) throw new Error('RBAC backend: ação negada');
      } catch (err) {
        if (err?.message?.includes('Contexto') || err?.message?.includes('Grupo obrigatório') || err?.message?.includes('Empresa obrigatória')) {
          throw err;
        }
        // Leituras podem continuar durante indisponibilidade; mutações falham fechadas.
        if (err?.message === 'RBAC backend: ação negada' || err?.response?.status === 403) {
          throw new Error('RBAC backend: ação negada');
        }
        if (action !== 'visualizar') {
          throw new Error('RBAC backend indisponível: operação sensível bloqueada');
        }
      }
    };

    const wrapEntity = (api, name) => {
      if (!api || api.__wrappedContext === true || name === 'AuditLog') return;
      const orig = {
        create: typeof api.create === 'function' ? api.create.bind(api) : null,
        bulkCreate: typeof api.bulkCreate === 'function' ? api.bulkCreate.bind(api) : null,
        update: typeof api.update === 'function' ? api.update.bind(api) : null,
        delete: typeof api.delete === 'function' ? api.delete.bind(api) : null,
        filter: typeof api.filter === 'function' ? api.filter.bind(api) : null,
        list: typeof api.list === 'function' ? api.list.bind(api) : null,
      };

      // Sanitização centralizada (utilitário):
      // usar sanitizeOnWrite em todas as escritas


      if (orig.create) {
        api.create = async (data) => {
          await checkRBAC(name, 'criar');
          const res = await orig.create(stamp(sanitizeOnWrite(data)));
          try { await base44.entities.AuditLog.create({
            usuario: user?.full_name || user?.email || 'Usuário',
            usuario_id: user?.id,
            acao: 'Criação', modulo: 'Sistema', tipo_auditoria: 'entidade',
            entidade: name, registro_id: res?.id, dados_novos: res,
            empresa_id: empresaAtual?.id || null,
            data_hora: new Date().toISOString(),
          }); } catch (error) { reportLayoutFailure('Falha ao auditar criacao', error, { entity: name, id: res?.id }); }
          // PII encryption pass (server-side) for sensitive entities
          try {
            if (name === 'Cliente' || name === 'Colaborador') {
              await base44.functions.invoke('piiEncryptor', { entity_name: name, id: res?.id, action: 'encrypt' });
            }
          } catch (error) { reportLayoutFailure('Falha ao criptografar dados pessoais apos criacao', error, { entity: name, id: res?.id }); }
          return res;
        };
      }

      if (orig.bulkCreate) {
        api.bulkCreate = async (arr) => {
          const stamped = Array.isArray(arr) ? arr.map((x) => stamp(sanitizeOnWrite(x))) : arr;
          const res = await orig.bulkCreate(stamped);
          try { await base44.entities.AuditLog.create({
            usuario: user?.full_name || user?.email || 'Usuário',
            usuario_id: user?.id,
            acao: 'Criação', modulo: 'Sistema', tipo_auditoria: 'entidade',
            entidade: name, descricao: `bulkCreate`,
            empresa_id: empresaAtual?.id || null,
            data_hora: new Date().toISOString(),
          }); } catch (error) { reportLayoutFailure('Falha ao auditar criacao em lote', error, { entity: name }); }
          return res;
        };
      }

      if (orig.update) {
        api.update = async (id, data) => {
          await checkRBAC(name, 'editar');
          const res = await orig.update(id, stamp(sanitizeOnWrite(data)));
          try { await base44.entities.AuditLog.create({
            usuario: user?.full_name || user?.email || 'Usuário',
            usuario_id: user?.id,
            acao: 'Edição', modulo: 'Sistema', tipo_auditoria: 'entidade',
            entidade: name, registro_id: id, dados_novos: data,
            empresa_id: empresaAtual?.id || null,
            data_hora: new Date().toISOString(),
          }); } catch (error) { reportLayoutFailure('Falha ao auditar edicao', error, { entity: name, id }); }
          // PII encryption pass (server-side) for sensitive entities
          try {
            if (name === 'Cliente' || name === 'Colaborador') {
              await base44.functions.invoke('piiEncryptor', { entity_name: name, id, action: 'encrypt' });
            }
          } catch (error) { reportLayoutFailure('Falha ao criptografar dados pessoais apos edicao', error, { entity: name, id }); }
          return res;
        };
      }

      if (orig.delete) {
        api.delete = async (id) => {
          await checkRBAC(name, 'excluir');
          const res = await orig.delete(id);
          try { await base44.entities.AuditLog.create({
            usuario: user?.full_name || user?.email || 'Usuário',
            usuario_id: user?.id,
            acao: 'Exclusão', modulo: 'Sistema', tipo_auditoria: 'entidade',
            entidade: name, registro_id: id,
            empresa_id: empresaAtual?.id || null,
            data_hora: new Date().toISOString(),
          }); } catch (error) { reportLayoutFailure('Falha ao auditar exclusao', error, { entity: name, id }); }
          return res;
        };
      }

      // Multiempresa em list/filter por padrão + STRICT empresa_id
      if (orig.filter) {
        api.filter = async (criteria = {}, order, limit, skip) => {
          const scope = getScope();
          if (scope.__blocked) return [];
          const entityScope = toEntityScope(scope);
          // Se o filtro já contém $or/$and ou campos de escopo, não injetar AND adicional
          const hasScope = !!criteria?.empresa_id || !!criteria?.group_id || !!criteria?.$or || !!criteria?.$and;
          const merged = (!hasScope) ? { ...criteria, ...entityScope } : criteria;
          return await orig.filter(merged, order, limit, skip);
        };
      }

      if (orig.list) {
        api.list = async (order, limit, skip) => {
          const scope = getScope();
          if (scope.__blocked) return [];
          if (orig.filter) {
            return await orig.filter(toEntityScope(scope), order, limit, skip);
          }
          return await orig.list(order, limit, skip);
        };
      }

      api.__wrappedContext = true;
    };

    try {
      Object.keys(base44.entities).forEach((name) => wrapEntity(base44.entities[name], name));
    } catch (error) {
      reportLayoutFailure('Falha ao instalar wrappers de entidades', error);
    }

    // Phase 4: RBAC + Auditoria + Strict empresa scope para chamadas de funções backend
    try {
      if (base44?.functions && base44.functions.invoke && base44.functions.__wrappedPhase4 !== true) {
        const origInvoke = base44.functions.invoke.bind(base44.functions);
        // Política híbrida: apenas funções sensíveis exigem guard; demais apenas auditam
        const SENSITIVE_FUNCTIONS = new Set([
          'permissionOptimizer', 'securityAlerts', 'adminInviteUser', 'propagateGroupConfigs',
          'migrateAuditoriasToAuditLog', 'migrateIntegrationsToConfiguracaoSistema', 'migrateChatbotIntents',
          'applyInventoryAdjustments', 'applyOrderStockMovements', 'emitirBoleto', 'sendEmailProvider',
          'groupConsolidation', 'sodValidator', 'solicitacoesAprovacao',
          'nfeActions', 'paymentStatusManager'
        ]);

        base44.functions.invoke = async (functionName, params) => {
          // Evita loops e ruído de auditoria
          if (functionName === 'auditError') {
            return await origInvoke(functionName, params);
          }

          // RBAC somente para funções sensíveis (evita chamadas extras)
          const shouldGuard = SENSITIVE_FUNCTIONS.has(functionName) || (params && params.__sensitive === true);
          if (shouldGuard && functionName !== 'entityGuard') {
            try {
              const scope = getScope();
              const guardPayload = {
                module: contextRef.current.moduleName || 'Sistema',
                section: 'Funções',
                action: 'executar',
                function_name: functionName,
                empresa_id: scope.empresa_id || null,
                group_id: scope.group_id || null,
                scope_type: scope.scope_type,
              };
              const res = await origInvoke('entityGuard', guardPayload);
              if (res?.data?.allowed !== true) {
                try { await base44.entities.AuditLog.create({
                  acao: 'Bloqueio', modulo: contextRef.current.moduleName || 'Sistema', tipo_auditoria: 'seguranca',
                  entidade: 'Function', descricao: `Acesso negado à função ${functionName}`, data_hora: new Date().toISOString(),
                }); } catch (error) { reportLayoutFailure('Falha ao auditar bloqueio de funcao', error, { functionName }); }
                throw new Error('RBAC backend: ação negada');
              }
            } catch (err) {
              if (err?.message === 'RBAC backend: ação negada' || err?.response?.status === 403) throw err;
              throw new Error(`RBAC backend indisponível: função sensível ${functionName} bloqueada`);
            }
          }

          // Injetar contexto multiempresa em chamadas de função — NÃO injeta em funções que já têm scope explícito
          // (upsertConfig, getEntityRecord e similares passam scope próprio e não devem ser contaminados)
          const SKIP_AUTO_SCOPE = new Set(['upsertConfig', 'getEntityRecord', 'entityListSorted', 'propagateGroupConfigs', 'auditError', 'deployAudit', 'piiEncryptor', 'portalToken']);
          try {
            const ctx = getScope ? getScope() : {};
            if (!SKIP_AUTO_SCOPE.has(functionName) && params && typeof params === 'object' && !Array.isArray(params)) {
              params = { ...params };
              if (ctx?.group_id && (params.group_id === undefined || params.group_id === null)) params.group_id = ctx.group_id;
              if (ctx?.scope_type && (params.scope_type === undefined || params.scope_type === null)) params.scope_type = ctx.scope_type;
              // aceitar alias empresaId, mas padronizar empresa_id
              const hasEmpresa = !(params.empresa_id === undefined || params.empresa_id === null) || !(params.empresaId === undefined || params.empresaId === null);
              if (ctx?.empresa_id && !hasEmpresa) params.empresa_id = ctx.empresa_id;
            }
          } catch (error) {
            reportLayoutFailure('Falha ao injetar contexto na funcao', error, { functionName });
            if (shouldGuard) throw new Error('Contexto indisponivel: funcao sensivel bloqueada');
          }
          // Sanitização hardening (anti-XSS/injeção)
          params = sanitizeOnWrite(params);

          // De-duplicação + retry com backoff para 429/500
          // upsertConfig e outras escritas NUNCA são deduplicadas (cada chamada é uma mutação distinta)
          const SKIP_DEDUP = new Set(['upsertConfig', 'applyInventoryAdjustments', 'applyOrderStockMovements', 'nfeActions', 'emitirBoleto', 'adminInviteUser']);
          base44.functions.__inflight = base44.functions.__inflight || new Map();
          const serialize = (o)=>{try{return JSON.stringify(o, Object.keys(o||{}).sort())}catch{ return JSON.stringify(o||{})}};
          const key = `${functionName}:${serialize(params || {})}`;
          if (!SKIP_DEDUP.has(functionName) && base44.functions.__inflight.has(key)) {
            return await base44.functions.__inflight.get(key);
          }
          const exec = async () => {
            let attempt = 0;
            while (true) {
              try {
                return await origInvoke(functionName, params);
              } catch (err) {
                const status = err?.response?.status || err?.status;
                if (((status === 429) || (typeof status === 'number' && status >= 500)) && attempt < 3) {
                  const delay = (800 + Math.floor(Math.random() * 600)) * (attempt + 1);
                  await new Promise(r => setTimeout(r, delay));
                  attempt++;
                  continue;
                }
                throw err;
              }
            }
          };
          const startedAt = Date.now();
          const p = exec().finally(() => base44.functions.__inflight.delete(key));
          if (!SKIP_DEDUP.has(functionName)) base44.functions.__inflight.set(key, p);
          const result = await p;

          // Telemetria de latência (auditoria de performance > 1500ms)
          try {
            const dur = Date.now() - startedAt;
            if (dur > 1500) {
              await base44.entities.AuditLog.create({
                usuario: user?.full_name || user?.email || 'Usuário',
                usuario_id: user?.id,
                acao: 'Visualização', modulo: moduleName || 'Sistema', tipo_auditoria: 'sistema',
                entidade: 'FunctionLatency', descricao: `Função ${functionName} lenta (${dur}ms)`,
                empresa_id: empresaAtual?.id || null,
                group_id: grupoAtual?.id || null,
                data_hora: new Date().toISOString(),
                duracao_ms: dur,
              });
            }
          } catch (error) { reportLayoutFailure('Falha ao auditar latencia de funcao', error, { functionName }); }

          // Auditoria (throttle 3s)
          try {
            const now = Date.now();
            const last = (base44.functions.__invokeAuditLastAt || 0);
            if (now - last > 3000) {
              base44.functions.__invokeAuditLastAt = now;
              await base44.entities.AuditLog.create({
                usuario: user?.full_name || user?.email || 'Usuário',
                usuario_id: user?.id,
                empresa_id: empresaAtual?.id || null,
                acao: 'Execução', modulo: moduleName || 'Sistema', tipo_auditoria: 'sistema',
                entidade: 'Function', descricao: `Função ${functionName} chamada`, dados_novos: { params }, data_hora: new Date().toISOString(),
              });
            }
          } catch (error) { reportLayoutFailure('Falha ao auditar chamada de funcao', error, { functionName }); }
          return result;
        };

        base44.functions.__wrappedPhase4 = true;
        // Nota: performance logs visíveis em Auditoria > Logs; usar este sinal para detectar gargalos.
      }
    } catch (error) {
      reportLayoutFailure('Falha ao instalar wrapper de funcoes', error);
    }
    }, [user?.id, empresaAtual?.id, grupoAtual?.id, contexto]);


  // Auditoria global de interações (cliques/seletores/tabs)

  // Auditoria de navegação entre páginas
  useEffect(() => {
    if (!user) return;
    try {
      (async () => {
        try {
          if (await base44.auth.isAuthenticated()) {
            await base44.entities.AuditLog.create({
              usuario: user?.full_name || user?.email || 'Usuário',
              usuario_id: user?.id,
              empresa_id: empresaAtual?.id || null,
              empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
              acao: 'Visualização',
              modulo: moduleName || 'Sistema',
              tipo_auditoria: 'ui',
              entidade: 'Navegação',
              descricao: `Rota: ${location.pathname}`,
              data_hora: new Date().toISOString(),
            });
          }
        } catch (error) { reportLayoutFailure('Falha ao auditar navegacao', error, { path: location.pathname }); }
      })();
    } catch (error) { reportLayoutFailure('Falha ao preparar auditoria de navegacao', error, { path: location.pathname }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.id, empresaAtual?.id, moduleName]);
  useEffect(() => {
            if (!user) return;
            if (AUDIT_BUSINESS_ONLY) return;
            const handlerClick = (e) => {
      try {
        const now = Date.now();
        if (now - auditThrottleRef.current.click < 1500) return; // throttle 1.5s
        auditThrottleRef.current.click = now;
        const target = e.target.closest('button, a, [role="button"], [data-radix-collection-item]');
        if (!target) return;
        const label = target.getAttribute('aria-label') || target.innerText?.trim()?.slice(0, 80) || target.tagName;
        base44.entities?.AuditLog?.create?.({
          usuario: user?.full_name || user?.email || 'Usuário',
          usuario_id: user?.id,
          empresa_id: empresaAtual?.id || null,
          empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
          acao: 'Visualização',
          modulo: moduleName || 'Sistema',
          tipo_auditoria: 'ui',
          entidade: 'Clique',
          descricao: `Click: ${label}`,
          data_hora: new Date().toISOString(),
        });
      } catch (error) { reportLayoutFailure('Falha ao auditar clique', error); }
    };

    const handlerChange = (e) => {
      try {
        const now = Date.now();
        if (now - auditThrottleRef.current.change < 1000) return; // throttle 1s
        auditThrottleRef.current.change = now;
        const el = e.target;
        if (!el) return;
        const tag = el.tagName;
        if (tag !== 'SELECT' && tag !== 'INPUT' && tag !== 'TEXTAREA') return;
        const name = el.name || el.id || tag;
        base44.entities?.AuditLog?.create?.({
          usuario: user?.full_name || user?.email || 'Usuário',
          usuario_id: user?.id,
          empresa_id: empresaAtual?.id || null,
          empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
          acao: 'Visualização',
          modulo: moduleName || 'Sistema',
          tipo_auditoria: 'ui',
          entidade: 'Input',
          descricao: `Change: ${name}`,
          data_hora: new Date().toISOString(),
        });
      } catch (error) { reportLayoutFailure('Falha ao auditar alteracao de campo', error); }
    };

    document.addEventListener('click', handlerClick, true);
    document.addEventListener('change', handlerChange, true);
    return () => {
      document.removeEventListener('click', handlerClick, true);
      document.removeEventListener('change', handlerChange, true);
    };
  }, [user?.id, empresaAtual?.id, moduleName]);

  const isMobilePage = currentPageName === "ProducaoMobile";



  // Idle prefetch common datasets (multiempresa-aware)
  useEffect(() => {
    const can = (contexto === 'grupo') || !!empresaAtual?.id;
    if (!can) return;
    const run = () => {
      try {
        if (hasPermission('Comercial', null, 'ver')) {
          queryClient.prefetchQuery({ queryKey: ['pedidos', empresaAtual?.id, grupoAtual?.id, contexto], queryFn: () => filterInContext('Pedido', {}, '-updated_date', 20) });
        }
        if (hasPermission('Financeiro', null, 'ver')) {
          queryClient.prefetchQuery({ queryKey: ['contasReceber', empresaAtual?.id, grupoAtual?.id, contexto], queryFn: () => filterInContext('ContaReceber', {}, '-data_vencimento', 20) });
        }
        if (hasPermission('Estoque', null, 'ver')) {
          queryClient.prefetchQuery({ queryKey: ['produtos', empresaAtual?.id, grupoAtual?.id, contexto], queryFn: () => filterInContext('Produto', {}, '-updated_date', 20) });
        }
      } catch (error) { reportLayoutFailure('Falha no prefetch ocioso', error); }
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 1500);
    }
  }, [empresaAtual?.id, grupoAtual?.id, contexto]);

  // Fase 3: Limpeza do IDB expirado no idle (uma vez por sessão)
  useEffect(() => {
    const cleanup = () => { try { idbClearExpired(); } catch (error) { reportLayoutFailure('Falha ao limpar cache IDB expirado', error); } };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(cleanup, { timeout: 10000 });
    } else {
      setTimeout(cleanup, 8000);
    }
  }, []);

  // Performance metrics observer (audit slow LCP/long tasks)
  useEffect(() => {
    try {
      // Auditoria de deploy/app load (não bloqueante)
      setTimeout(() => { (async () => { try { if (await base44.auth.isAuthenticated()) { await base44.functions.invoke('deployAudit', { event: 'app_loaded', module: moduleName || 'Sistema', page: currentPageName }); } } catch (error) { reportLayoutFailure('Falha ao auditar carregamento do app', error); } })(); }, 0);
      const audits = [];
      if (typeof PerformanceObserver !== 'undefined') {
        // LCP
        const lcpObs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const entry = entries && entries.length ? entries[entries.length - 1] : null;
          if (entry && entry.startTime > 2500) {
            audits.push({ type: 'LCP', value: entry.startTime });
          }
        });
        try { lcpObs.observe({ type: 'largest-contentful-paint', buffered: true }); } catch (error) { reportLayoutFailure('Falha ao observar LCP', error); }
        // Long tasks
        const ltObs = new PerformanceObserver((list) => {
          const longs = list.getEntries().filter((e) => e.duration > 200);
          if (longs.length) {
            const max = Math.max.apply(null, longs.map((e) => e.duration));
            audits.push({ type: 'longtask', count: longs.length, max });
          }
        });
        try { ltObs.observe({ type: 'longtask', buffered: true }); } catch (error) { reportLayoutFailure('Falha ao observar tarefas longas', error); }
        // Flush once after 5s
        setTimeout(() => {
          if (audits.length) {
            try { (async () => { try { if (await base44.auth.isAuthenticated()) { await base44.entities.AuditLog.create({
              usuario: user?.full_name || 'Usuário',
              usuario_id: user?.id,
              empresa_id: empresaAtual?.id || null,
              group_id: grupoAtual?.id || null,
              acao: 'Visualização',
              modulo: moduleName || 'Sistema',
              tipo_auditoria: 'sistema',
              entidade: 'Performance',
              descricao: 'Métricas de desempenho',
              dados_novos: { audits },
              data_hora: new Date().toISOString(),
            }); } } catch (error) { reportLayoutFailure('Falha ao auditar metricas de desempenho', error); } })(); } catch (error) { reportLayoutFailure('Falha ao preparar auditoria de desempenho', error); }
          }
        }, 5000);
      }
    } catch (error) { reportLayoutFailure('Falha ao configurar telemetria de desempenho', error); }
  }, [user?.id, empresaAtual?.id, grupoAtual?.id, moduleName]);

  const titleToModule = {
    "CRM - Relacionamento": "CRM",
    "Comercial e Vendas": "Comercial",
    "Estoque e Almoxarifado": "Estoque",
    "Compras e Suprimentos": "Compras",
    "Financeiro e Contábil": "Financeiro",
    "Fiscal e Tributário": "Fiscal",
    "Recursos Humanos": "RH",
  };

  const itemsFiltrados = navigationItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    const mod = titleToModule[item.title];
    if (!mod) return true; // itens públicos ou informativos continuam visíveis
    return hasPermission(mod, null, 'ver');
  });

  useEffect(() => {
    if (!moduleName) return;
    const key = `audit_block_${moduleName}`;
    try {
      const allowed = hasPermission(moduleName, null, 'ver');
      if (!allowed && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        base44.entities.AuditLog.create({
                        usuario: user?.full_name || user?.email || 'Usuário',
                        usuario_id: user?.id,
                        empresa_id: empresaAtual?.id || null,
                        empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
                        acao: 'Bloqueio',
                        modulo: moduleName,
                        tipo_auditoria: 'seguranca',
                        entidade: 'Página',
                        descricao: `Acesso negado ao módulo ${moduleName} (${currentPageName})`,
                      });
      }
    } catch (error) { reportLayoutFailure('Falha ao auditar bloqueio de pagina', error, { moduleName, currentPageName }); }
  }, [moduleName, currentPageName, user?.id, empresaAtual?.id]);



  const groupedItems = {
    principal: itemsFiltrados.filter(item => item.group === "principal"),
    cadastros: itemsFiltrados.filter(item => item.group === "cadastros"),
    operacional: itemsFiltrados.filter(item => item.group === "operacional"),
    administrativo: itemsFiltrados.filter(item => item.group === "administrativo"),
    sistema: itemsFiltrados.filter(item => item.group === "sistema"),
    publico: itemsFiltrados.filter(item => item.group === "publico"),
  };

  if (isMobilePage) {
    return (
      <>
        <div className="w-full h-full min-h-screen">{children}</div>
      </>
    );
  }

  return (
    <SidebarProvider>
      
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Fase 2: preencher h-full com rolagem interna em todo conteúdo central */}
        <Sidebar className="border-r border-slate-200 bg-white/80 backdrop-blur-sm">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-slate-900">ERP Zuccaro</h2>
                <p className="text-xs text-slate-500">V21.5 • Sistema Completo</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {Object.entries(groupedItems).map(([groupName, items]) => {
              if (items.length === 0) return null;
              
              const groupLabels = {
                principal: "Principal",
                cadastros: "Cadastros",
                operacional: "Operacional",
                administrativo: "Administrativo",
                sistema: "Sistema",
                publico: "Público"
              };

              return (
                <SidebarGroup key={groupName}>
                  <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 mb-1">
                    {groupLabels[groupName]}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {items.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton 
                              asChild 
                              className={`transition-all duration-200 rounded-lg mb-1 ${
                                isActive 
                                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200' 
                                  : 'hover:bg-slate-100 text-slate-700'
                              }`}
                            >
                              <Link to={item.url} onMouseEnter={() => { prefetchForItem(item.title); prefetchModule(item.title); }} className="flex items-center gap-3 px-4 py-3">
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                                <span className="font-medium">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <Link to={createPageUrl("ConfiguracoesUsuario")} className="flex items-center gap-3 hover:bg-slate-100 p-2 rounded-lg transition-colors flex-1">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">
                    {user?.full_name?.[0] || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">
                    {user?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => base44.auth.logout()}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="lg:hidden">
                  <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors">
                    <Menu className="w-5 h-5" />
                  </SidebarTrigger>
                </div>
                
                <div className="hidden lg:block flex-1 max-w-md">
                  <MiniMapaNavegacao />
                </div>
              </div>

              <div className="hidden sm:block">
                <EmpresaSwitcher />
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPesquisaOpen(true)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors hidden md:flex items-center gap-2"
                  title="Pesquisa Universal (Ctrl+K)"
                >
                  <Search className="w-5 h-5 text-slate-600" />
                  <span className="text-sm text-slate-500 hidden lg:inline">Ctrl+K</span>
                </button>

                <AtalhosTecladoInfo />

                <AcoesRapidasGlobal />

                <NotificationCenter />
                
                <Link to={createPageUrl("ConfiguracoesUsuario")}>
                  <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <Settings className="w-5 h-5 text-slate-600" />
                  </button>
                </Link>
              </div>
              </div>
              {isOffline && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
                Modo offline: exibindo dados em cache (última sincronização). Algumas ações podem não estar disponíveis.
              </div>
              )}
              {(!empresaAtual?.id && contexto !== 'grupo') && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
                Selecione uma empresa para carregar os dados. O acesso está bloqueado sem empresa selecionada.
              </div>
              )}
              {!integracoesOk && hasPermission('Sistema', null, 'ver') && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
                Integrações fiscais pendentes nesta empresa. <Link to={createPageUrl("AdministracaoSistema?tab=integracoes")} className="underline">Configurar agora</Link>.
              </div>
              )}
              </header>

          <div className="flex-1 overflow-auto">
            <ErrorBoundary>
              <Suspense fallback={<div className="p-6 text-slate-500">Carregando…</div>}>
                <BootstrapGuard>
                  <ProtectedSection module={moduleName || 'Sistema'} action="ver" fallback={<div className="p-10 text-center text-slate-600">Acesso negado a este módulo.</div>}>
                    <GuardRails currentPageName={currentPageName}>
                      <div className="w-full h-full">
                        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 space-y-4">
                          {children}
                        </div>
                      </div>
                    </GuardRails>
                  </ProtectedSection>
                </BootstrapGuard>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        <PesquisaUniversal 
          open={pesquisaOpen} 
          onOpenChange={setPesquisaOpen} 
        />

        {/* Sistema de Janelas Multitarefa V21.0 */}
        <WindowRenderer />
        <MinimizedWindowsBar />
        </div>
        </SidebarProvider>
        );
        }


export default function Layout({ children, currentPageName }) {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
      <WindowProvider>
        <ZIndexGuard>
          <GlobalNetworkErrorHandler />
          <GlobalContextStamp />
          <LayoutContent children={children} currentPageName={currentPageName} />
        </ZIndexGuard>
      </WindowProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
