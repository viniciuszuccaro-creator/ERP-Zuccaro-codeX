import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { permissionNodeAllows } from '../../../base44/functions/_lib/security/entityGuardPolicy/entry';
import { z } from 'zod';
import { base44, erpBackendMode } from '@/api/base44Client';
import { readErpHttpSession } from '@/api/erpHttpSession';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';

let sequence = 0;
const scalar = z.union([z.string(),z.number().finite(),z.boolean(),z.null()]);
const pageSchema = z.object({
  contract:z.literal('secure-report-v1'),data:z.array(z.record(scalar)),fields:z.array(z.string().regex(/^[a-z_]+$/)),
  meta:z.object({ offset:z.number().int().nonnegative(),limit:z.number().int().nonnegative(),hasMore:z.boolean(),total:z.number().int().nonnegative().nullable(),coverage:z.enum(['page','complete']) }),
  scope:z.object({ groupId:z.string(),empresaId:z.string().nullable(),scopeType:z.enum(['grupo','empresa']) }),
  capabilities:z.record(z.boolean()).optional(),csv:z.string().optional(),
});
export function parseSecureReportPage(value, scope) {
  const parsed = pageSchema.safeParse(value);
  if (!parsed.success) throw new Error('REPORT_CONTRACT_UNAVAILABLE');
  const page = parsed.data;
  if (page.scope.groupId !== scope.groupId || page.scope.empresaId !== scope.empresaId || page.data.some(row =>
    row.group_id !== scope.groupId || scope.empresaId && row.empresa_id !== scope.empresaId && row.empresa_id !== null)) throw new Error('REPORT_SCOPE_CHANGED');
  if (page.meta.coverage === 'complete' && (page.meta.hasMore || page.meta.total !== page.data.length)) throw new Error('REPORT_COVERAGE_UNAVAILABLE');
  return page;
}
// Report grants are exact: broad module/admin fallbacks do not grant sensitive reports.
export function hasReportGrant(profile,moduleName,section,action) {
  if (!profile || profile.ativo === false) return false;
  const normalize = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const find = (object,name) => object?.[Object.keys(object || {}).find(key => normalize(key) === normalize(name)) || ''];
  const node = find(find(profile?.permissoes,moduleName),section);
  return permissionNodeAllows(node,action);
}
export default function useSecureReport({ kind, entityName, report = {}, filter = {}, page = 0, enabled = true }) {
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const permission = usePermissions();
  const { user, isLoading:loadingUser } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const module = kind === 'representantes' ? 'Comercial' : 'Relatorios';
  const section = kind === 'representantes' ? 'Representantes' : 'Personalizado';
  const token = readErpHttpSession()?.token;
  const permissionVersion = JSON.stringify(permission.perfilAcesso?.permissoes || {});
  const generation = useMemo(() => ++sequence,[user,permission.perfilAcesso,permissionVersion,groupId,empresaId,token]);
  const allowed = Boolean(user?.id && !user.disabled && groupId && !loadingUser && !permission.isLoading && hasReportGrant(permission.perfilAcesso,module,section,'visualizar'));
  const supported = erpBackendMode === 'remote';
  const canExport = allowed && supported && hasReportGrant(permission.perfilAcesso,module,section,'exportar');
  const scope = { groupId,empresaId,scopeType:empresaId ? 'empresa' : 'grupo' };
  const payload = { entityName,context:scope,filter,limit:50,skip:page*50,report:{ ...report,kind } };
  const identity = JSON.stringify([generation,kind,entityName,report,filter,page]);
  const current = useRef(null);
  current.current = { identity,allowed:allowed && supported,canExport };
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; },[]);
  const queryClient = useQueryClient();
  const queryKey = ['secure-report',kind,user?.id,groupId,empresaId,generation,report,filter,page,entityName];
  const query = useQuery({ queryKey,enabled:enabled && allowed && supported,retry:false,staleTime:0,gcTime:0,
    queryFn:async () => {
      if (!mounted.current || !current.current.allowed || current.current.identity !== identity) throw new Error('REPORT_SCOPE_CHANGED');
      const result = await base44.functions.invoke('entityListSorted',payload);
      if (!mounted.current || !current.current.allowed || current.current.identity !== identity) throw new Error('REPORT_SCOPE_CHANGED');
      return parseSecureReportPage(result?.data,scope);
    } });
  useEffect(() => () => { void queryClient.cancelQueries({ queryKey:['secure-report',kind,user?.id,groupId,empresaId,generation] });
    queryClient.removeQueries({ queryKey:['secure-report',kind,user?.id,groupId,empresaId,generation] }); },[queryClient,kind,user?.id,groupId,empresaId,generation]);
  const exportCsv = async () => {
    if (!mounted.current || pending.current || !current.current.canExport || current.current.identity !== identity || !query.data) return false;
    pending.current = true;
    try {
      const response = await base44.functions.invoke('entityListSorted',{ ...payload,report:{ ...payload.report,action:'exportar' } });
      if (!mounted.current || !current.current.canExport || current.current.identity !== identity) return false;
      const result = parseSecureReportPage(response?.data,scope);
      if (typeof result.csv !== 'string') throw new Error('REPORT_EXPORT_UNAVAILABLE');
      const url = URL.createObjectURL(new Blob(['\ufeff'+result.csv],{ type:'text/csv;charset=utf-8;' }));
      try { const link = document.createElement('a'); link.href=url;link.download=`relatorio_${kind}.csv`;link.click(); }
      finally { URL.revokeObjectURL(url); }
      return true;
    } finally { pending.current=false; }
  };
  const status = !allowed ? 'Selecione Grupo/Empresa e confirme a permissão específica do relatório.' : !supported
    ? 'Este relatório não está disponível neste ambiente. A consulta exige um servidor autorizado.'
    : query.isError ? 'Não foi possível obter o relatório autorizado. Verifique permissões e reduza o escopo ou período; nenhum total parcial é apresentado.'
    : query.isLoading ? 'Carregando relatório autorizado...' : '';
  return { ...query,data:allowed && supported && !query.isError ? query.data : undefined,allowed:allowed && supported,canExport,status,exportCsv };
}
