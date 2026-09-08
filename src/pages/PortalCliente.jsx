import React, { Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { useUser } from '@/components/lib/UserContext';
import {
  resolvePortalSessionState,
  sanitizePortalClienteId,
} from '@/components/lib/portalClientePolicy';
import PortalHeader from '@/components/portal/PortalHeader';
import PortalTabsNav from '@/components/portal/PortalTabsNav';
import DashboardCliente from '@/components/portal/DashboardCliente';

const PedidosCliente = React.lazy(() => import('@/components/portal/PedidosCliente'));
const RastreamentoRealtime = React.lazy(() => import('@/components/portal/RastreamentoRealtime'));
const DocumentosCliente = React.lazy(() => import('@/components/portal/DocumentosCliente'));
const SolicitarOrcamento = React.lazy(() => import('@/components/portal/SolicitarOrcamento'));
const MinhasOportunidades = React.lazy(() => import('@/components/portal/MinhasOportunidades'));
const AprovacaoComAssinatura = React.lazy(() => import('@/components/portal/AprovacaoComAssinatura'));
const UploadProjetos = React.lazy(() => import('@/components/portal/UploadProjetos'));
const ChatVendedor = React.lazy(() => import('@/components/portal/ChatVendedor'));
const ChamadosCliente = React.lazy(() => import('@/components/portal/ChamadosCliente'));
const AnalyticsPortalCliente = React.lazy(() => import('@/components/portal/AnalyticsPortalCliente'));
const HistoricoComprasCliente = React.lazy(() => import('@/components/portal/HistoricoComprasCliente'));
const ConfiguracoesPortal = React.lazy(() => import('@/components/portal/ConfiguracoesPortal'));
const FAQAjuda = React.lazy(() => import('@/components/portal/FAQAjuda'));

const TAB_ALIASES = {
  documentos: 'documentos-novos',
  docs: 'documentos-novos',
  boletos: 'documentos-novos',
  pedidos: 'meus-pedidos',
  home: 'dashboard',
  suporte: 'chamados',
};

const VALID_TABS = new Set([
  'dashboard',
  'meus-pedidos',
  'rastreamento',
  'documentos-novos',
  'solicitar-orcamento',
  'minhas-oportunidades',
  'orcamentos',
  'projetos',
  'chat',
  'chamados',
  'analytics',
  'historico',
  'configuracoes',
  'ajuda',
]);

function PortalSessionScreen({ session }) {
  const isWait = ['autenticando', 'vinculando', 'carregando', 'timeout'].includes(session.state);
  return (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center p-6" data-portal-state={session.state}>
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-3">
          {isWait ? <Loader2 className="w-10 h-10 mx-auto animate-spin text-blue-600" /> : <AlertCircle className="w-10 h-10 mx-auto text-amber-600" />}
          <p className="font-semibold text-slate-900">{session.title}</p>
          <p className="text-sm text-slate-600">{session.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabFallback() {
  return (
    <div className="w-full p-8 flex items-center justify-center text-slate-500 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      Carregando...
    </div>
  );
}

export default function PortalCliente({ clienteId: propClienteId, adminMode = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: authLoading, error: authError } = useUser();
  const startedAtRef = React.useRef(Date.now());
  const [nowTs, setNowTs] = React.useState(Date.now());
  const requestedClienteId = sanitizePortalClienteId({ requestedClienteId: propClienteId, adminMode });

  const rawTab = String(searchParams.get('tab') || 'dashboard').trim().toLowerCase();
  const activeTab = useMemo(() => {
    const mapped = TAB_ALIASES[rawTab] || rawTab;
    return VALID_TABS.has(mapped) ? mapped : 'dashboard';
  }, [rawTab]);

  const vinculoQuery = useQuery({
    queryKey: ['portal-shell-cliente', user?.id, requestedClienteId, adminMode],
    queryFn: async () => {
      if (requestedClienteId) {
        const res = await base44.entities.Cliente.filter({ id: requestedClienteId });
        return res[0] || null;
      }
      const res = await base44.entities.Cliente.filter({ portal_usuario_id: user.id });
      return res[0] || null;
    },
    enabled: !!user && !authLoading,
  });

  const session = resolvePortalSessionState({
    authLoading,
    authError,
    user,
    vinculoLoading: vinculoQuery.isLoading,
    vinculoFetched: vinculoQuery.isFetched,
    vinculoError: vinculoQuery.error,
    vinculoCliente: vinculoQuery.data || null,
    requestedClienteId: propClienteId,
    adminMode,
    elapsedMs: nowTs - startedAtRef.current,
  });

  React.useEffect(() => {
    if (['pronto', 'sem_vinculo', 'sem_permissao', 'erro'].includes(session.state)) return undefined;
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session.state]);

  const { data: orcamentosPendentes = [] } = useQuery({
    queryKey: ['portal-shell-orcamentos', session.cliente?.id],
    queryFn: () => base44.entities.OrcamentoCliente.filter({
      cliente_id: session.cliente.id,
      status: 'Pendente',
    }),
    enabled: session.state === 'pronto' && !!session.cliente?.id,
  });

  const { data: chamadosAbertos = [] } = useQuery({
    queryKey: ['portal-shell-chamados', session.cliente?.id],
    queryFn: () => base44.entities.Chamado.filter({
      cliente_id: session.cliente.id,
      status: 'Aberto',
    }),
    enabled: session.state === 'pronto' && !!session.cliente?.id,
  });

  if (session.state !== 'pronto') {
    return (
      <div className="w-full h-full overflow-auto p-4">
        <PortalSessionScreen session={session} />
      </div>
    );
  }

  const cliente = session.cliente;

  return (
    <div className="w-full h-full overflow-auto p-4 space-y-4" data-portal-state="pronto" data-portal-shell="true">
      <PortalHeader cliente={cliente} />

      <Tabs
        value={activeTab}
        onValueChange={(next) => {
          const params = new URLSearchParams(searchParams);
          params.set('tab', next);
          setSearchParams(params, { replace: true });
        }}
        className="w-full space-y-4"
      >
        <div className="w-full overflow-x-auto">
          <PortalTabsNav
            orcamentosCount={orcamentosPendentes.length}
            chamadosCount={chamadosAbertos.length}
          />
        </div>

        <Suspense fallback={<TabFallback />}>
          <TabsContent value="dashboard" className="mt-0 w-full">
            <DashboardCliente clienteId={propClienteId} adminMode={adminMode} />
          </TabsContent>
          <TabsContent value="meus-pedidos" className="mt-0 w-full">
            <PedidosCliente />
          </TabsContent>
          <TabsContent value="rastreamento" className="mt-0 w-full">
            <RastreamentoRealtime />
          </TabsContent>
          <TabsContent value="documentos-novos" className="mt-0 w-full">
            <DocumentosCliente />
          </TabsContent>
          <TabsContent value="solicitar-orcamento" className="mt-0 w-full">
            <SolicitarOrcamento />
          </TabsContent>
          <TabsContent value="minhas-oportunidades" className="mt-0 w-full">
            <MinhasOportunidades />
          </TabsContent>
          <TabsContent value="orcamentos" className="mt-0 w-full">
            <AprovacaoComAssinatura />
          </TabsContent>
          <TabsContent value="projetos" className="mt-0 w-full">
            <UploadProjetos />
          </TabsContent>
          <TabsContent value="chat" className="mt-0 w-full">
            <ChatVendedor />
          </TabsContent>
          <TabsContent value="chamados" className="mt-0 w-full">
            <ChamadosCliente
              clienteId={cliente.id}
              clienteNome={cliente.nome_fantasia || cliente.razao_social || cliente.nome}
            />
          </TabsContent>
          <TabsContent value="analytics" className="mt-0 w-full">
            <AnalyticsPortalCliente />
          </TabsContent>
          <TabsContent value="historico" className="mt-0 w-full">
            <HistoricoComprasCliente />
          </TabsContent>
          <TabsContent value="configuracoes" className="mt-0 w-full">
            <ConfiguracoesPortal />
          </TabsContent>
          <TabsContent value="ajuda" className="mt-0 w-full">
            <FAQAjuda />
          </TabsContent>
        </Suspense>
      </Tabs>
    </div>
  );
}
