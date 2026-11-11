import React from 'react';
import IntegracoesIndex from '@/components/administracao-sistema/IntegracoesIndex';
import ProtectedSection from '@/components/security/ProtectedSection';

/**
 * Página de entrada `/Integracoes`.
 * Causa: arquivo esvaziado; o shell canônico permanece em
 * Administração → aba Integrações (`IntegracoesIndex`).
 * Recuperação: reusa o mesmo índice (RBAC/contexto/persistência),
 * sem restaurar o shell paralelo antigo baseado só na central legada.
 * Parecer 6691042172: proteção granular na rota — visualizar Integrações.
 */
export default function IntegracoesPage() {
  return (
    <ProtectedSection module="Sistema" section="Integracoes" action="visualizar">
      <div className="w-full h-full p-4 md:p-6" data-permission="Sistema.Integracoes.visualizar">
        <IntegracoesIndex initialTab={null} />
      </div>
    </ProtectedSection>
  );
}
