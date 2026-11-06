import React from 'react';
import IntegracoesIndex from '@/components/administracao-sistema/IntegracoesIndex';

/**
 * Página de entrada `/Integracoes`.
 * Causa: arquivo esvaziado; o shell canônico permanece em
 * Administração → aba Integrações (`IntegracoesIndex`).
 * Recuperação: reusa o mesmo índice (RBAC/contexto/persistência),
 * sem restaurar o shell paralelo antigo baseado só na central legada.
 */
export default function IntegracoesPage() {
  return (
    <div className="w-full h-full p-4 md:p-6">
      <IntegracoesIndex initialTab={null} />
    </div>
  );
}
