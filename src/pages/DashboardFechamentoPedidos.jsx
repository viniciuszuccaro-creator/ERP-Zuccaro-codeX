import React from 'react';
import DashboardFechamentoPedidos from '@/components/comercial/DashboardFechamentoPedidos';

/**
 * Página canônica do dashboard de fechamento.
 * Reconecta o componente existente (já usado via Widget/openWindow)
 * à rota de páginas — o arquivo estava vazio/desconectado.
 */
export default function DashboardFechamentoPedidosPage() {
  return (
    <div className="w-full h-full p-4 md:p-6">
      <DashboardFechamentoPedidos />
    </div>
  );
}
