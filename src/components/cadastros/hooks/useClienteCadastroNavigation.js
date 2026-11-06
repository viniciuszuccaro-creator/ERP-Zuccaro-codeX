import { useEffect, useRef, useState } from 'react';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { centralOpenErrorMessage, isCanonicalClienteId } from '@/components/comercial/centralCliente360Navigation';

/** Initial-ID orchestration only; V24 remains owner of scoped reads, audit and save routing. */
export default function useClienteCadastroNavigation({ entityName, id, requestId, receipt, groupId, empresaId,
  canView, canEdit, permissionsLoading, openRecord, closeRecord }) {
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([entityName, id, requestId, receipt?.groupId, receipt?.empresaId, receipt?.actorId]);
  const authorized = Boolean(!permissionsLoading && canView && canEdit && typeof receipt?.isCurrent === 'function'
    && receipt.isCurrent({ groupId, empresaId }, readErpHttpSession()));
  const latest = useRef(null);
  latest.current = { key, authorized, receipt, groupId, empresaId, openRecord, closeRecord };
  useEffect(() => {
    if (entityName !== 'Cliente' || !id) return;
    if (!isCanonicalClienteId(id) || !authorized) {
      latest.current.closeRecord(false);
      if (!permissionsLoading) setError(centralOpenErrorMessage());
      return;
    }
    let active = true;
    latest.current.closeRecord(false);
    setError('');
    const isCurrent = () => Boolean(active && latest.current.key === key && latest.current.authorized
      && latest.current.receipt === receipt && receipt.isCurrent({
        groupId: latest.current.groupId, empresaId: latest.current.empresaId,
      }, readErpHttpSession()));
    Promise.resolve().then(() => {
      if (!isCurrent()) return false;
      return latest.current.openRecord({ id }, isCurrent);
    }).then(opened => {
      if (isCurrent() && opened !== true) {
        latest.current.closeRecord(false);
        setError(centralOpenErrorMessage());
      }
    }).catch(() => {
      if (isCurrent()) {
        latest.current.closeRecord(false);
        setError(centralOpenErrorMessage());
      }
    });
    return () => { active = false; };
  }, [key, authorized, permissionsLoading, attempt]);
  return { error, retry: () => setAttempt(value => value + 1) };
}
