import React from 'react';
import AppEntregasMotorista from '@/components/mobile/AppEntregasMotorista';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { Card, CardContent } from '@/components/ui/card';

export default function EntregasMobile() {
  const { grupoAtual, empresaAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId && empresaId);
  const canUsarApp =
    hasPermission('Expedicao', 'Entrega', 'entregar')
    || hasPermission('Expedicao', 'Entrega', 'editar')
    || hasPermission('Expedicao', 'Motorista', 'visualizar')
    || hasPermission('Cadastros', 'Motorista', 'visualizar')
    || hasPermission('Logistica', 'Entrega', 'entregar');

  if (!contextoValido || !canUsarApp) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center" data-context-required="true">
        <Card className="w-full max-w-md border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-sm text-amber-950 space-y-2">
            <p className="font-semibold">App Motorista bloqueado</p>
            <p>Selecione grupo e empresa e garanta permissao de entrega/motorista.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <AppEntregasMotorista />
    </div>
  );
}
