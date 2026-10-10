import { useRef } from 'react';
import { isHttpBackendMode } from '@/api/base44Client';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { isCadastroSelfManagedScopeCurrent } from '../cadastroEditLoadPolicy.js';

/**
 * Congela o tenant na abertura quando sessão HTTP e render do form concordam.
 * Evita freeze prematuro (sessão com empresa + primeiro paint consolidado null)
 * e libera visão de Grupo (empresaId null nos três lados).
 */
export default function useCadastroFormScopeGuard(groupId, empresaId) {
  const opened = useRef(null);
  const rendered = { groupId: groupId || null, empresaId: empresaId || null };
  const renderedRef = useRef(rendered);
  renderedRef.current = rendered;

  if (!opened.current) {
    const currentRender = renderedRef.current;
    if (isHttpBackendMode) {
      const session = readErpHttpSession();
      if (session?.groupId && currentRender.groupId
        && session.groupId === currentRender.groupId
        && (session.empresaId || null) === (currentRender.empresaId || null)) {
        opened.current = {
          groupId: session.groupId,
          empresaId: session.empresaId || null,
          actorId: session.actorId || null,
          token: session.token || null,
        };
      }
    } else if (currentRender.groupId) {
      opened.current = {
        groupId: currentRender.groupId,
        empresaId: currentRender.empresaId || null,
      };
    }
  }

  const isCurrent = () => {
    const currentRender = renderedRef.current;
    const active = isHttpBackendMode ? readErpHttpSession() : currentRender;
    return isCadastroSelfManagedScopeCurrent(opened.current, currentRender, active);
  };
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error('Contexto alterado durante a edição. Reabra o cadastro antes de salvar.');
  };
  return { isCurrent, assertCurrent };
}
