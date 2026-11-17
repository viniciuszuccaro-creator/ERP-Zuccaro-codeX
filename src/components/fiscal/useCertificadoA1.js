import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isHttpBackendMode } from '@/api/base44Client';
import { a1CertificateApi, central360SessionKey } from '@/api/httpApiClient';
import { HTTP_CONTEXT_CHANGED, readErpHttpSession } from '@/api/erpHttpSession';
import usePermissions from '@/components/lib/usePermissions';

/** Shared query extracted from ConfigFiscalAutomatica; no key material in state/cache. */
export default function useCertificadoA1({ groupId, empresaId }) {
  const [epoch, setEpoch] = useState(0);
  const { hasPermission, isLoading } = usePermissions();
  useEffect(() => {
    const changed = () => setEpoch(value => value + 1);
    window.addEventListener(HTTP_CONTEXT_CHANGED, changed);
    return () => window.removeEventListener(HTTP_CONTEXT_CHANGED, changed);
  }, []);
  const active = readErpHttpSession();
  const a1Scope = { groupId, empresaId, actorId: active?.actorId };
  const scopeMatches = Boolean(isHttpBackendMode && active?.token && active.actorId
    && groupId && empresaId && active.groupId === groupId && active.empresaId === empresaId);
  const allowed = !isLoading && hasPermission('Fiscal', 'certificado', 'visualizar');
  const certificateQueryKey = ['a1-certificate', groupId, empresaId, active?.actorId,
    central360SessionKey(active?.token), epoch];
  const query = useQuery({ queryKey: certificateQueryKey,
    queryFn: ({ signal }) => a1CertificateApi.metadata(a1Scope, { signal }),
    enabled: scopeMatches && allowed, staleTime: 0, gcTime: 0, retry: false });
  const available = scopeMatches && allowed;
  return { a1Scope, certificateQueryKey, panelKey: JSON.stringify(certificateQueryKey),
    certificate: available ? query.data : undefined,
    certificateQuery: { ...query, data: available ? query.data : undefined, isSuccess: available && query.isSuccess },
    scopeMatches, allowed };
}
