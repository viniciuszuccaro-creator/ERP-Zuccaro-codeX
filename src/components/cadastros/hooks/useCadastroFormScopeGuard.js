import { useRef } from 'react';
import { isHttpBackendMode } from '@/api/base44Client';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { isCadastroSelfManagedScopeCurrent } from '../cadastroEditLoadPolicy.js';

/** Congela o tenant na abertura; um clique ou resposta tardia não reutiliza a tela no novo tenant. */
export default function useCadastroFormScopeGuard(groupId, empresaId) {
  const opened = useRef(null);
  const rendered = { groupId: groupId || null, empresaId: empresaId || null };
  const renderedRef = useRef(rendered);
  renderedRef.current = rendered;
  if (!opened.current && rendered.groupId) opened.current = rendered;

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
