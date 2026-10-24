import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ConverterOportunidade from '@/components/crm/ConverterOportunidade';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { isCanonicalQuoteOpportunity, openCrmQuoteOrderWindow, isCrmConversionScopeCurrent } from '@/components/crm/crmFormSubmission';
import { AlertCircle, Building2, MapPin, FileText, ShoppingCart, HardHat, Target } from 'lucide-react';
import {
  canLoadCentralCliente360,
  central360SessionKey,
  createHttpApiClient,
  isHttpApiError,
  readHttpErrorBodyCode,
} from '@/api/httpApiClient';
import { isHttpCliente360Enabled } from '@/api/base44Client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  growCentral360BlockLimit,
  INITIAL_CENTRAL360_BLOCK_LIMITS,
} from '@/components/comercial/centralCliente360Pagination';
import {
  centralCrmLegadoQueryKey,
  loadCentralCrmLegado,
  shouldUseCrmLegadoAdapter,
} from '@/components/comercial/centralCliente360CrmLegado';
import { formatCentral360Money as money } from '@/components/comercial/centralCliente360Money';
import { centralOpenErrorMessage, createCentralOpenGate, openCentralClienteWindow, openCentralOrcamentoWindow, openCentralPedidoWindow } from '@/components/comercial/centralCliente360Navigation';
import { hasCadastroEntityPermission } from '@/components/cadastros/cadastroEditLoadPolicy';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useWindow } from '@/components/lib/useWindow';

function CrmLegadoAdapterBlock({ clienteId, groupId, empresaId, actorId, sessionKey, httpBlock }) {
  const { filterInContext } = useContextoVisual();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { openWindow } = useWindow();
  const canView = !permissionsLoading && (
    hasPermission('CRM', 'oportunidades', 'ver')
    || hasPermission('CRM', 'Oportunidade', 'visualizar')
    || hasPermission('CRM', null, 'visualizar')
  );
  const enabled = Boolean(clienteId && groupId && empresaId && actorId && sessionKey && sessionKey !== 'none' && canView);
  const scopedKey = centralCrmLegadoQueryKey({clienteId,groupId,empresaId,actorId,sessionKey,canView});
  const scopeRef = useRef(null);
  const serializedScope = JSON.stringify(scopedKey);
  scopeRef.current = serializedScope;
  React.useEffect(() => {
    scopeRef.current = serializedScope;
    return () => { scopeRef.current = null; };
  }, [serializedScope]);

  const query = useQuery({
    queryKey: scopedKey,
    queryFn: ({signal}) => loadCentralCrmLegado({clienteId,signal,
      readRows:()=>filterInContext('Oportunidade', {}, '-created_date', 100)}),
    enabled,
    placeholderData: undefined,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  });

  const openCrm = async () => {
    if (!enabled) return;
    const openedScope = scopeRef.current;
    const OportunidadesLista = (await import('@/components/crm/OportunidadesLista')).default;
    if (openedScope !== scopeRef.current) return;
    const rows = query.data || [];
    openWindow(
      OportunidadesLista,
      { oportunidades: rows, windowMode: true },
      {
        title: 'CRM · Oportunidades do cliente',
        width: 1400,
        height: 800,
        uniqueKey: `crm-oportunidades-cliente-${scopeRef.current}`,
      },
    );
  };

  if (permissionsLoading) {
    return (
      <div className="border rounded-md bg-white p-3" data-block-key="crm" data-block-status="loading" data-crm-source="legado">
        <p className="text-xs text-slate-500">Verificando permissão CRM…</p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="border rounded-md bg-white p-3 space-y-2" data-block-key="crm" data-block-status="forbidden" data-crm-source="legado">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-semibold">CRM</h4>
          <Badge variant="secondary">forbidden</Badge>
        </div>
        <p className="text-xs text-amber-700">Sem permissão para oportunidades do CRM.</p>
        <p className="text-[11px] text-slate-400">HTTP canônico pendente ({httpBlock?.code || 'CRM_CANONICAL_HTTP_PENDING'}).</p>
      </div>
    );
  }

  const rows = query.data || [];
  return (
    <div className="border rounded-md bg-white p-3 space-y-2" data-block-key="crm" data-block-status={query.isError ? 'unavailable' : 'ok'} data-crm-source="legado">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-900">CRM</h4>
          <Badge variant="outline">legado</Badge>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" data-action="central360-crm-abrir" onClick={openCrm}>
          Abrir CRM
        </Button>
      </div>
      {query.isLoading && <p className="text-xs text-slate-500">Carregando oportunidades do cliente…</p>}
      {query.isError && (
        <p className="text-xs text-red-700">Falha ao ler CRM legado (fonte Oportunidade). Tente novamente.</p>
      )}
      {!query.isLoading && !query.isError && rows.length === 0 && (
        <p className="text-xs text-slate-500">Nenhuma oportunidade deste cliente no contexto atual.</p>
      )}
      {rows.map((row) => (
        <div key={row.id || row.titulo} className="text-sm flex items-center justify-between border-b last:border-0 py-1">
          <span className="min-w-0 flex-1 truncate">
            <span data-action="central360-crm-titulo">{row.titulo}</span>
            {row.id ? (
              <span className="ml-2 font-mono text-[10px] text-slate-400" data-action="central360-crm-id" title="ID técnico">{String(row.id).slice(0, 8)}</span>
            ) : null}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <Badge variant="outline">{row.etapa}</Badge>
            <span>{money(row.valor)}</span>
          </span>
        </div>
      ))}
      <p className="text-[11px] text-slate-400" data-action="central360-crm-fonte">
        Fonte canônica atual: store Oportunidade (CRM). HTTP dedicado permanece {httpBlock?.code || 'CRM_CANONICAL_HTTP_PENDING'} — sem tabela paralela.
      </p>
    </div>
  );
}

function BlockCard({ title, icon: Icon, block, blockKey, renderRow, onLoadMore, loadingMore }) {
  if (!block) return null;
  const status = block.status;
  const rows = status === 'ok' && Array.isArray(block.data) ? block.data : [];
  const hasMore = Boolean(block.meta?.hasMore);
  return (
    <div className="border rounded-md bg-white p-3 space-y-2" data-block-status={status} data-block-key={blockKey}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        </div>
        <Badge variant={status === 'ok' ? 'default' : 'secondary'}>{status}</Badge>
      </div>
      {status === 'ok' && rows.length > 0 && (
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.id} className="text-sm flex items-center justify-between border-b last:border-0 py-1">
              {renderRow(row)}
            </div>
          ))}
          {hasMore ? (
            <div className="pt-1 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Mais registros disponíveis ({block.meta?.total ?? '…'}).
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                data-action={`central360-${blockKey}-carregar-mais`}
                disabled={loadingMore}
                onClick={() => onLoadMore?.(blockKey)}
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {status === 'ok' && rows.length === 0 && (
        <p className="text-xs text-slate-500">Nenhum registro neste contexto.</p>
      )}
      {status === 'forbidden' && (
        <p className="text-xs text-amber-700">Sem permissão para este bloco.</p>
      )}
      {status === 'unavailable' && (
        <p className="text-xs text-slate-600">Bloco indisponível{block.code ? ` (${block.code})` : ''}.</p>
      )}
      {status === 'skipped' && (
        <p className="text-xs text-slate-500">Pendente{block.code ? `: ${block.code}` : ''}.</p>
      )}
    </div>
  );
}

/**
 * Composição Visual da Central Cliente 360 sobre o DetalhesCliente existente.
 * Opt-in: VITE_ERP_BACKEND=http + VITE_ERP_HTTP_CLIENTE_360=true (só após prova supabase_user).
 * Exige Bearer da sessão autenticada — sem token a query não dispara.
 */
export default function CentralCliente360Panel({
  clienteId,
  groupId,
  empresaId,
  actorId,
  actorEmail,
  token,
}) {
  const queryClient=useQueryClient();
  const {openWindow,closeWindow}=useWindow();
  const {hasPermission,canEdit,isLoading:permissionsLoading}=usePermissions();
  const {grupoAtual,empresaAtual,contextoCanonico,filterInContext}=useContextoVisual();
  const renderedScope=useRef(null);
  renderedScope.current={groupId:grupoAtual?.id||empresaAtual?.group_id||empresaAtual?.grupo_id,empresaId:empresaAtual?.id||null,scopeType:contextoCanonico?.scopeType};
  const [conversionError,setConversionError]=useState('');
  const [pedidoOpenError,setPedidoOpenError]=useState('');
  const [orcamentoOpenError,setOrcamentoOpenError]=useState('');
  const [cadastroOpenError,setCadastroOpenError]=useState('');
  const [openingRecord,setOpeningRecord]=useState(/** @type {{pedido?: string|boolean|null, orcamento?: string|boolean|null, cliente?: boolean|null}} */ ({}));
  const openGate=useRef(createCentralOpenGate());
  const sessionToken = typeof token === 'string' ? token.trim() : '';
  const enabled = canLoadCentralCliente360({
    flag: isHttpCliente360Enabled,
    clienteId,
    groupId,
    empresaId,
    actorId,
    token: sessionToken,
  }) && isCrmConversionScopeCurrent({groupId,empresaId,actorId,token:sessionToken},renderedScope.current,readErpHttpSession());
  const cadastroAllowed = enabled && !permissionsLoading
    && hasCadastroEntityPermission('Cliente', 'visualizar', { hasPermission, canEdit })
    && hasCadastroEntityPermission('Cliente', 'editar', { hasPermission, canEdit });
  const cadastroAllowedRef = useRef(false);
  cadastroAllowedRef.current = cadastroAllowed;
  const sessionKey = central360SessionKey(sessionToken);
  const viewKey=JSON.stringify([clienteId,groupId,empresaId,actorId,sessionKey]);
  const viewRef=useRef(null);viewRef.current=viewKey;
  React.useEffect(()=>{viewRef.current=viewKey;openGate.current.reset();setOpeningRecord({});setConversionError('');setPedidoOpenError('');setOrcamentoOpenError('');setCadastroOpenError('');return()=>{viewRef.current=null;openGate.current.reset();};},[viewKey]);
  const [blockLimits, setBlockLimits] = useState(INITIAL_CENTRAL360_BLOCK_LIMITS);

  // Troca de cliente/grupo/empresa/ator/sessão: zera paginação e impede
  // "Carregar mais" de outro contexto pintar o painel atual.
  React.useEffect(() => {
    setBlockLimits(INITIAL_CENTRAL360_BLOCK_LIMITS);
  }, [clienteId, groupId, empresaId, actorId, sessionKey]);

  const httpApi = useMemo(
    () => createHttpApiClient({
      getScope: () => ({
        groupId,
        empresaId,
        actorId,
        actorEmail,
        token: sessionToken,
      }),
    }),
    [groupId, empresaId, actorId, actorEmail, sessionToken],
  );
  const api=httpApi.clientes;
  const canConvert=!permissionsLoading && hasPermission('CRM','oportunidades','aprovar')
    && hasPermission('Comercial','pedido','converter-pedido') && hasPermission('Comercial','pedido','visualizar')
    && hasPermission('Comercial','orcamento','visualizar');
  const openCanonicalConversion=async(row)=>{
    const openedKey=viewKey,openedScope={groupId,empresaId,actorId,token:sessionToken};
    const assertCurrent=(completed=false)=>{
      if(viewRef.current!==openedKey || !isCrmConversionScopeCurrent(openedScope,renderedScope.current,readErpHttpSession()))
        throw new Error(completed?'Contexto alterado. O Pedido pode ter sido criado; consulte o registro antes de repetir.':'Contexto alterado. Reabra a Central antes de converter.');
    };
    try{
      await openCrmQuoteOrderWindow(row,{api:httpApi,assertCurrent,scope:{groupId,empresaId},viewKey:openedKey,
        blocks:(query.data?.data||query.data)?.blocks||{},openWindow,closeWindow,component:ConverterOportunidade,
        invalidate:()=>queryClient.invalidateQueries({queryKey:['cliente-central-360',groupId,empresaId,actorId,clienteId,sessionKey]})});
    }catch(error){if(viewRef.current===openedKey)setConversionError(error?.message||'Falha ao abrir conversão.');}
  };

  const query = useQuery({
    queryKey: [
      'cliente-central-360',
      groupId,
      empresaId,
      actorId,
      clienteId,
      sessionKey,
      blockLimits.empresas,
      blockLimits.locais,
      blockLimits.obras,
      blockLimits.orcamentos,
      blockLimits.pedidos,
      blockLimits.crm,
    ],
    queryFn: ({ signal }) => api.central360(clienteId, {
      signal,
      empresasLimit: blockLimits.empresas,
      empresasOffset: 0,
      locaisLimit: blockLimits.locais,
      locaisOffset: 0,
      obrasLimit: blockLimits.obras,
      obrasOffset: 0,
      orcamentosLimit: blockLimits.orcamentos,
      orcamentosOffset: 0,
      pedidosLimit: blockLimits.pedidos,
      pedidosOffset: 0,
      crmLimit: blockLimits.crm,
      crmOffset: 0,
    }),
    enabled,
    retry: 1,
    // Evita reutilizar payload de outro Grupo/Empresa/ator/sessão no painel.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    placeholderData: undefined,
    // Sem keepPreviousData: resposta atrasada de outro queryKey não pinta a UI.
  });

  const handleLoadMore = (blockKey) => {
    setBlockLimits((prev) => growCentral360BlockLimit(prev, blockKey));
  };

  if (!isHttpCliente360Enabled) return null;

  if (!sessionToken) {
    return (
      <Alert className="mb-4 border-amber-200 bg-amber-50" data-central360-session="missing">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Central 360 exige sessão autenticada (Bearer). Faça login com supabase_user antes de carregar.
        </AlertDescription>
      </Alert>
    );
  }

  if (!enabled) {
    return (
      <Alert className="mb-4 border-amber-200 bg-amber-50" data-permission="Cadastros.cliente.visualizar">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Central 360 HTTP exige grupo, empresa e usuário autenticado.
        </AlertDescription>
      </Alert>
    );
  }

  if (query.isLoading && !query.data) {
    return <p className="text-sm text-slate-500 mb-4">Carregando Central 360…</p>;
  }

  if (query.isError) {
    const status = isHttpApiError(query.error) ? query.error.status : undefined;
    const code = isHttpApiError(query.error) ? query.error.code || readHttpErrorBodyCode(query.error.body) : undefined;
    return (
      <div className="mb-4 space-y-2" data-central360-error={status || 'error'}>
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {status === 403
              ? 'Sem permissão ou vínculo ClienteEmpresa nesta empresa.'
              : status === 401
                ? 'Sessão inválida ou expirada. Faça login novamente.'
                : status === 404
                  ? 'Cliente sem vínculo ativo nesta empresa (404 seguro).'
                  : `Falha ao carregar Central 360${code ? ` (${code})` : ''}.`}
          </AlertDescription>
        </Alert>
        <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const payload = query.data?.data || query.data;
  const identity = payload?.identity;
  const blocks = payload?.blocks || {};
  const meta = payload?.meta || {};
  const loadingMore = query.isFetching && !query.isLoading;
  const openCadastro = async () => {
    const ticket = openGate.current.begin('cliente', viewKey);
    if (!ticket) return;
    const openedKey = viewKey;
    const scope = { groupId, empresaId, actorId, token: sessionToken };
    const assertCurrent = () => {
      if (!cadastroAllowedRef.current || viewRef.current !== openedKey || !openGate.current.isCurrent(ticket)
        || !isCrmConversionScopeCurrent(scope, renderedScope.current, readErpHttpSession())) throw new Error(centralOpenErrorMessage());
    };
    setCadastroOpenError('');
    setOpeningRecord(current => ({ ...current, cliente: true }));
    try {
      const opened = await openCentralClienteWindow({ clienteId, identity, allowed: cadastroAllowed, assertCurrent, scope, renderedScope: renderedScope.current,
        loadPanel: async () => (await import('@/components/comercial/ClientesTab')).default, openWindow });
      if (!opened && openGate.current.isCurrent(ticket) && viewRef.current === openedKey) setCadastroOpenError(centralOpenErrorMessage());
    } catch {
      if (openGate.current.isCurrent(ticket) && viewRef.current === openedKey) setCadastroOpenError(centralOpenErrorMessage());
    } finally {
      if (openGate.current.end(ticket)) setOpeningRecord(current => ({ ...current, cliente: null }));
    }
  };
  const openRecord=async(row,kind)=>{
    const ticket=openGate.current.begin(kind,viewKey);
    if(!ticket)return;
    const pedido=kind==='pedido';
    const setError=pedido?setPedidoOpenError:setOrcamentoOpenError;
    setError('');
    setOpeningRecord(current=>({...current,[kind]:row?.id||true}));
    const openedKey=viewRef.current;
    const openedScope={groupId,empresaId,actorId,token:sessionToken};
    const assertCurrent=()=>{
      if(!openGate.current.isCurrent(ticket)||viewRef.current!==openedKey||!isCrmConversionScopeCurrent(openedScope,renderedScope.current,readErpHttpSession()))
        throw new Error('Contexto alterado. Reabra a Central antes de consultar o registro.');
    };
    try{
      const open=pedido?openCentralPedidoWindow:openCentralOrcamentoWindow;
      const opened=await open({row,block:pedido?blocks.pedidos:blocks.orcamentos,allowed:!permissionsLoading&&hasPermission('Comercial',kind,'visualizar'),
        assertCurrent,loadPanel:pedido?async()=>(await import('@/components/comercial/PedidosTab')).default:async()=>(await import('@/components/comercial/OrcamentosTab')).default,openWindow,
        props:{groupId,empresaId,actorId,actorEmail,sessionToken,hasPermission,filterInContext,empresaAtual}});
      if(!opened&&openGate.current.isCurrent(ticket)&&viewRef.current===openedKey)setError(centralOpenErrorMessage());
    }catch{if(openGate.current.isCurrent(ticket)&&viewRef.current===openedKey)setError(centralOpenErrorMessage());}
    finally{if(openGate.current.end(ticket))setOpeningRecord(current=>({...current,[kind]:null}));}
  };

  return (
    <div className="mb-6 space-y-3" data-permission="Cadastros.cliente.visualizar" data-central360="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">Central Cliente 360</h3>
          <p className="text-xs text-slate-500">
            Composição canônica · PII {meta.sensitiveFields === 'revealed' ? 'revelado' : 'mascarado'}
            {meta.requestId ? ` · req ${String(meta.requestId).slice(0, 8)}` : ''}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openCadastro}
          disabled={!cadastroAllowed || Boolean(openingRecord.cliente)}
          title="Editar cadastro do cliente" data-permission="Cadastros.Cliente.editar" data-action="central360-abrir-cadastro-cliente">
          <Building2 className="mr-2 h-4 w-4" /> Cadastro
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setBlockLimits(INITIAL_CENTRAL360_BLOCK_LIMITS);
            query.refetch();
          }}
        >
          Atualizar
        </Button>
      </div>

      {cadastroOpenError && <div role="alert" className="text-sm text-red-700">{cadastroOpenError}</div>}
      {identity && (
        <div className="border rounded-md bg-slate-50 p-3 text-sm grid grid-cols-1 md:grid-cols-3 gap-2">
          <div><span className="text-slate-500">Código</span><p className="font-mono" data-action="codigo-registro-central360">{identity.codigo ?? '—'}</p></div>
          <div>
            <span className="text-slate-500">ID técnico</span>
            <p className="font-mono text-xs" data-action="id-tecnico-central360" title="Identificador técnico imutável; distinto do código de registro">
              {identity.id || clienteId || '—'}
            </p>
          </div>
          <div><span className="text-slate-500">Documento</span><p>{identity.documento || '—'}</p></div>
          <div><span className="text-slate-500">E-mail</span><p>{identity.email || '—'}</p></div>
          <div><span className="text-slate-500">Telefone</span><p>{identity.telefone || '—'}</p></div>
          <div><span className="text-slate-500">Celular</span><p>{identity.celular || '—'}</p></div>
          <div><span className="text-slate-500">Status</span><p>{identity.status}</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <BlockCard
          title="Empresas"
          icon={Building2}
          blockKey="empresas"
          block={blocks.empresas}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
          renderRow={(row) => (
            <>
              <span className="font-mono text-xs">{String(row.empresa_id).slice(0, 8)}</span>
              <Badge variant="outline">{row.situacao_comercial}</Badge>
            </>
          )}
        />
        <BlockCard
          title="Locais"
          icon={MapPin}
          blockKey="locais"
          block={blocks.locais}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
          renderRow={(row) => (
            <>
              <span>{row.nome}</span>
              <span className="text-xs text-slate-500">{row.cidade}/{row.uf}</span>
            </>
          )}
        />
        <BlockCard
          title="Obras"
          icon={HardHat}
          blockKey="obras"
          block={blocks.obras}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
          renderRow={(row) => (
            <>
              <span>{row.nome}</span>
              <Badge variant="outline">{row.status}</Badge>
            </>
          )}
        />
        <BlockCard
          title="Orçamentos"
          icon={FileText}
          blockKey="orcamentos"
          block={blocks.orcamentos}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
          renderRow={(row) => (
            <>
              <span className="min-w-0 flex-1">
                <span className="font-mono" data-action="central360-orcamento-numero">{row.numero}</span>
                {row.id ? (
                  <span className="ml-2 font-mono text-[10px] text-slate-400" data-action="central360-orcamento-id" title="ID técnico">{String(row.id).slice(0, 8)}</span>
                ) : null}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {row.status ? <Badge variant="outline">{row.status}</Badge> : null}
                <span>{money(row.total)}</span>
                {!permissionsLoading&&hasPermission('Comercial','orcamento','visualizar')&&<Button type="button" size="sm" variant="outline" data-action="central360-orcamento-abrir" disabled={Boolean(openingRecord.orcamento)} onClick={()=>void openRecord(row,'orcamento')}>{openingRecord.orcamento===row.id?'Abrindo...':'Abrir'}</Button>}
              </span>
            </>
          )}
        />
        {orcamentoOpenError&&<p role="alert" className="text-sm text-red-700" data-testid="central360-orcamento-open-error">{orcamentoOpenError}</p>}
        <BlockCard
          title="Pedidos"
          icon={ShoppingCart}
          blockKey="pedidos"
          block={blocks.pedidos}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
          renderRow={(row) => (
            <>
              <span className="min-w-0 flex-1">
                <span className="font-mono" data-action="central360-pedido-numero">{row.numero}</span>
                {row.id ? (
                  <span className="ml-2 font-mono text-[10px] text-slate-400" data-action="central360-pedido-id" title="ID técnico">{String(row.id).slice(0, 8)}</span>
                ) : null}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {row.status ? <Badge variant="outline">{row.status}</Badge> : null}
                <span>{money(row.total)}</span>
                {!permissionsLoading&&hasPermission('Comercial','pedido','visualizar')&&<Button type="button" size="sm" variant="outline" data-action="central360-pedido-abrir" disabled={Boolean(openingRecord.pedido)} onClick={()=>void openRecord(row,'pedido')}>{openingRecord.pedido===row.id?'Abrindo...':'Abrir'}</Button>}
              </span>
            </>
          )}
        />
        {pedidoOpenError&&<p role="alert" className="text-sm text-red-700" data-testid="central360-pedido-open-error">{pedidoOpenError}</p>}
        {shouldUseCrmLegadoAdapter(blocks.crm) ? (
          <CrmLegadoAdapterBlock
            clienteId={clienteId}
            groupId={groupId}
            empresaId={empresaId}
            httpBlock={blocks.crm}
            actorId={actorId}
            sessionKey={sessionKey}
          />
        ) : (
          <BlockCard
            title="CRM"
            icon={Building2}
            blockKey="crm"
            block={blocks.crm}
            onLoadMore={handleLoadMore}
            loadingMore={query.isFetching}
            renderRow={(row) => (
              <>
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs mr-2" data-action="central360-crm-codigo">{row.codigo_oportunidade || row.codigo || 'Sem código'}</span>
                  {row.titulo}
                  <span className="ml-2 font-mono text-[10px] text-slate-400" title="ID técnico">{String(row.id).slice(0,8)}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">{row.etapa || row.status}</Badge>
                  <span>{money(row.valor_estimado)}</span>
                  {canConvert && isCanonicalQuoteOpportunity(row) &&
                    <Button type="button" size="sm" variant="outline" data-action="central360-crm-converter-pedido" data-permission="CRM.oportunidades.aprovar" onClick={()=>openCanonicalConversion(row)}>Converter em Pedido</Button>}
                </span>
              </>
            )}
          />
        )}
      </div>

      {conversionError && <p role="alert" className="text-sm text-red-700">{conversionError}</p>}
      <p className="text-xs text-slate-500" data-action="central360-fonte-canonica">
        Fontes canônicas (sem duplicar dados): Cadastros.Cliente · Comercial.Orçamento/Pedido ·
        CRM via Oportunidade canônica quando habilitada · Locais/Obras · Financeiro/Expedição via pedido.
      </p>
    </div>
  );
}
