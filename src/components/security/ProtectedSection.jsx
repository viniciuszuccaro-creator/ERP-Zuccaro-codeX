import React, { useEffect, useRef, useState } from "react";
import usePermissions from "@/components/lib/usePermissions";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getSensitiveGuardState, isSensitiveGuardAllowed } from "@/components/lib/sensitiveActionGuardPolicy";

// Cache / dedupe global para entityGuard (TTL 120s)
const { cache: __guardCache, inflight: __guardInflight } = getSensitiveGuardState();
const GUARD_TTL_MS = 120_000;
const getGuardKey = (module, section, action, empresaId, groupId) => `${module || '-'}|${section || '-'}|${action || '-'}|${empresaId || '-'}|${groupId || '-'}`;

export default function ProtectedSection({
  module: modulo,
  section,
  action = "visualizar",
  fallback = null,
  children,
  hideInstead = false,
  disableInstead = false
}) {
  const { isLoading, hasPermission } = usePermissions();
  const { user } = useUser();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const loggedRef = useRef(false);
  const [openDenied, setOpenDenied] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestedAccess, setRequestedAccess] = useState(false);

  // Sempre manter a mesma ordem de hooks entre renders
  const allowed = !isLoading && hasPermission(modulo, section, action);
  const [allowedFinal, setAllowedFinal] = useState(null);

  useEffect(() => {
    if (isLoading) return;
    if (!modulo) { setAllowedFinal(allowed); return; }

    const key = getGuardKey(modulo, section, action, empresaAtual?.id, grupoAtual?.id);
    const now = Date.now();
    const cached = __guardCache.get(key);
    if (cached && (now - cached.ts < GUARD_TTL_MS)) {
      setAllowedFinal(Boolean(cached.allowed) && allowed);
      return;
    }

    if (!allowed) {
      setAllowedFinal(false);
      return;
    }
    setAllowedFinal(null);

    if (__guardInflight.has(key)) {
      __guardInflight.get(key)
        .then((backendAllowed) => {
          __guardCache.set(key, { allowed: backendAllowed, ts: Date.now() });
          setAllowedFinal(backendAllowed && allowed);
        })
        .catch((error) => {
          console.warn('[RBAC] Guard indisponivel; secao protegida bloqueada.', error);
          setAllowedFinal(false);
        });
      return;
    }

    const p = base44.functions.invoke('entityGuard', {
      module: modulo,
      section,
      action,
      empresa_id: empresaAtual?.id || null,
      group_id: grupoAtual?.id || null,
    }).then(isSensitiveGuardAllowed).catch((error) => {
      console.warn('[RBAC] Guard indisponivel; secao protegida bloqueada.', error);
      return false;
    });
    __guardInflight.set(key, p);

    p.then((backendAllowed) => {
      __guardCache.set(key, { allowed: backendAllowed, ts: Date.now() });
      setAllowedFinal(backendAllowed && allowed);
    }).finally(() => {
      __guardInflight.delete(key);
    });
  }, [isLoading, allowed, modulo, section, action, empresaAtual?.id, grupoAtual?.id]);

  useEffect(() => {
    if (isLoading) return;
    if (allowedFinal === false && !loggedRef.current) {
      loggedRef.current = true;
      try {
        base44.entities.AuditLog.create({
          usuario: user?.full_name || user?.email || 'Usuário',
          usuario_id: user?.id,
          empresa_id: empresaAtual?.id || null,
          empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
          acao: 'Bloqueio',
          modulo: modulo || 'Sistema',
          tipo_auditoria: 'seguranca',
          entidade: section || 'Seção',
          descricao: `Acesso negado: ${modulo}.${section}.${action}`,
          data_hora: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[Auditoria] Falha ao registrar acesso negado.', error);
      }
    }
  }, [isLoading, allowedFinal, action, modulo, section, user?.id, empresaAtual?.id]);

  useEffect(() => {
    if (!isLoading && allowedFinal === false) setOpenDenied(true);
  }, [isLoading, allowedFinal]);

  if (isLoading || allowedFinal === null) return <div className="contents" data-ps-loading />;
  if (!allowedFinal) {
    if (hideInstead) return fallback;
    if (disableInstead) {
      return (
        <div className="opacity-50 pointer-events-none w-full h-full">
          {fallback || children}
        </div>
      );
    }
    return (
      <>
        {fallback}
        <Dialog open={openDenied} onOpenChange={setOpenDenied}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Permissão negada</DialogTitle>
              <DialogDescription>
                Você não possui permissão para visualizar esta seção.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-slate-600 space-y-1">
              <p><strong>Módulo:</strong> {modulo || 'Sistema'}</p>
              {section && <p><strong>Seção:</strong> {section}</p>}
              <p><strong>Ação:</strong> {action}</p>
            </div>
            {requestedAccess && (
              <div className="text-xs text-emerald-600 mt-2">
                Pedido de acesso enviado para aprovação.
              </div>
            )}
            <DialogFooter>
              <Button
                variant="default"
                disabled={requestingAccess || requestedAccess}
                onClick={async () => {
                  try {
                    setRequestingAccess(true);
                    await base44.functions.invoke('solicitacoesAprovacao', {
                      module: modulo || 'Sistema',
                      section,
                      action,
                      empresa_id: empresaAtual?.id || null,
                      group_id: grupoAtual?.id || null,
                    });
                    setRequestedAccess(true);
                  } finally {
                    setRequestingAccess(false);
                  }
                }}
              >
                {requestedAccess ? 'Solicitado' : (requestingAccess ? 'Solicitando…' : 'Solicitar acesso')}
              </Button>
              <Button variant="outline" onClick={() => setOpenDenied(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return <>{children}</>;
}
