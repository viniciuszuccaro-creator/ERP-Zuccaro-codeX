import React from 'react';
import { Switch } from '@/components/ui/switch';

const EVENTOS = [
  ['enviar_pedido_aprovado', 'pedidoAprovado', 'Pedido Aprovado', 'Notificar cliente quando pedido for aprovado'],
  ['enviar_saida_entrega', 'saidaEntrega', 'Saida para Entrega', 'Enviar rastreamento quando sair para entrega'],
  ['enviar_entrega_concluida', 'entregaConcluida', 'Entrega Concluida', 'Confirmar entrega realizada'],
  ['enviar_cobranca', 'cobranca', 'Cobranca (Boleto/PIX)', 'Enviar cobranca automaticamente'],
];

export default function WhatsAppEventToggles({ config, disabled, onChange, permission }) {
  return (
    <div className="border-t pt-4">
      <p className="font-semibold mb-3">Eventos Automaticos</p>
      <div className="space-y-3">
        {EVENTOS.map(([field, action, title, description]) => (
          <div key={field} className="flex items-center justify-between gap-3 p-3 bg-white rounded border">
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-slate-600">{description}</p>
            </div>
            <Switch
              checked={Boolean(config[field])}
              onCheckedChange={(checked) => onChange(field, checked)}
              disabled={disabled}
              data-action={`Integracoes.WhatsApp.${action}`}
              data-permission={permission}
              data-context-required="group-or-company"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
