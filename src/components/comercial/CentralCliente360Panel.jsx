import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Building2, MapPin, FileText, ShoppingCart, HardHat } from 'lucide-react';
import {
  canLoadCentralCliente360,
  central360SessionKey,
  createHttpApiClient,
} from '@/api/httpApiClient';
import { isHttpCliente360Enabled } from '@/api/base44Client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  growCentral360BlockLimit,
  INITIAL_CENTRAL360_BLOCK_LIMITS,
} from '@/components/comercial/centralCliente360Pagination';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

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
  const sessionToken = typeof token === 'string' ? token.trim() : '';
  const enabled = canLoadCentralCliente360({
    flag: isHttpCliente360Enabled,
    clienteId,
    groupId,
    empresaId,
    actorId,
    token: sessionToken,
  });
  const sessionKey = central360SessionKey(sessionToken);
  const [blockLimits, setBlockLimits] = useState(INITIAL_CENTRAL360_BLOCK_LIMITS);

  // Troca de cliente/grupo/empresa/ator/sessão: zera paginação e impede
  // "Carregar mais" de outro contexto pintar o painel atual.
  React.useEffect(() => {
    setBlockLimits(INITIAL_CENTRAL360_BLOCK_LIMITS);
  }, [clienteId, groupId, empresaId, actorId, sessionKey]);

  const api = useMemo(
    () => createHttpApiClient({
      getScope: () => ({
        groupId,
        empresaId,
        actorId,
        actorEmail,
        token: sessionToken,
      }),
    }).clientes,
    [groupId, empresaId, actorId, actorEmail, sessionToken],
  );

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
    const status = query.error?.status;
    const code = query.error?.code || query.error?.body?.error?.code;
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
              </span>
            </>
          )}
        />
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
              </span>
            </>
          )}
        />
        <BlockCard
          title="CRM"
          icon={Building2}
          blockKey="crm"
          block={blocks.crm}
          renderRow={() => null}
        />
      </div>
    </div>
  );
}
