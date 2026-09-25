import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Building2, MapPin, FileText, ShoppingCart, HardHat } from 'lucide-react';
import { createHttpApiClient } from '@/api/httpApiClient';
import { isHttpCliente360Enabled } from '@/api/base44Client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

function BlockCard({ title, icon: Icon, block, renderRow }) {
  if (!block) return null;
  const status = block.status;
  return (
    <div className="border rounded-md bg-white p-3 space-y-2" data-block-status={status}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-600" />
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        </div>
        <Badge variant={status === 'ok' ? 'default' : 'secondary'}>{status}</Badge>
      </div>
      {status === 'ok' && Array.isArray(block.data) && block.data.length > 0 && (
        <div className="space-y-1">
          {block.data.slice(0, 5).map((row) => (
            <div key={row.id} className="text-sm flex items-center justify-between border-b last:border-0 py-1">
              {renderRow(row)}
            </div>
          ))}
          {block.meta?.hasMore ? (
            <p className="text-xs text-slate-500">Mais registros disponíveis ({block.meta.total}).</p>
          ) : null}
        </div>
      )}
      {status === 'ok' && (!block.data || block.data.length === 0) && (
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
 * Opt-in: VITE_ERP_BACKEND=http + VITE_ERP_HTTP_CLIENTE_360=true.
 */
export default function CentralCliente360Panel({
  clienteId,
  groupId,
  empresaId,
  actorId,
  actorEmail,
  token,
}) {
  const enabled = isHttpCliente360Enabled && Boolean(clienteId && groupId && empresaId && actorId);
  const api = useMemo(
    () => createHttpApiClient({
      getScope: () => ({ groupId, empresaId, actorId, actorEmail, token }),
    }).clientes,
    [groupId, empresaId, actorId, actorEmail, token],
  );

  const query = useQuery({
    queryKey: ['cliente-central-360', groupId, empresaId, actorId, clienteId],
    queryFn: ({ signal }) => api.central360(clienteId, { signal }),
    enabled,
    retry: 1,
  });

  if (!isHttpCliente360Enabled) return null;

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

  if (query.isLoading) {
    return <p className="text-sm text-slate-500 mb-4">Carregando Central 360…</p>;
  }

  if (query.isError) {
    const status = query.error?.status;
    const code = query.error?.code || query.error?.body?.error?.code;
    return (
      <div className="mb-4 space-y-2">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {status === 403
              ? 'Sem permissão ou vínculo ClienteEmpresa nesta empresa.'
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
        <Button type="button" size="sm" variant="ghost" onClick={() => query.refetch()}>
          Atualizar
        </Button>
      </div>

      {identity && (
        <div className="border rounded-md bg-slate-50 p-3 text-sm grid grid-cols-1 md:grid-cols-3 gap-2">
          <div><span className="text-slate-500">Código</span><p className="font-mono">{identity.codigo}</p></div>
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
          block={blocks.empresas}
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
          block={blocks.locais}
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
          block={blocks.obras}
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
          block={blocks.orcamentos}
          renderRow={(row) => (
            <>
              <span className="font-mono">{row.numero}</span>
              <span>{money(row.total)}</span>
            </>
          )}
        />
        <BlockCard
          title="Pedidos"
          icon={ShoppingCart}
          block={blocks.pedidos}
          renderRow={(row) => (
            <>
              <span className="font-mono">{row.numero}</span>
              <span>{money(row.total)}</span>
            </>
          )}
        />
        <BlockCard
          title="CRM"
          icon={Building2}
          block={blocks.crm}
          renderRow={() => null}
        />
      </div>
    </div>
  );
}
