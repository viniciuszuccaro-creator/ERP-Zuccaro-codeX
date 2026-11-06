import React from 'react';
import DashboardFechamentoPedidos from '@/components/comercial/DashboardFechamentoPedidos';
import ProtectedSection from '@/components/security/ProtectedSection';

/**
 * Página canônica do dashboard de fechamento.
 * Reconecta o componente existente (já usado via Widget/openWindow)
 * à rota de páginas — o arquivo estava vazio/desconectado.
 */
export default function DashboardFechamentoPedidosPage() {
  return (
    <ProtectedSection module="Comercial" section="Fechamento" action="visualizar">
      <div className="w-full h-full p-4 md:p-6" data-permission="Comercial.Fechamento.visualizar">
        <DashboardFechamentoPedidos />
      </div>
    </ProtectedSection>
  );
}
