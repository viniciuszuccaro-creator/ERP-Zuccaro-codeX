import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import CriarEtapaEntregaForm from './CriarEtapaEntregaForm';

/**
 * Adapter fino — reutiliza CriarEtapaEntregaForm (RBAC/sanitize/sky).
 * Preserva a API do modal usado em LogisticaEntregaTab.
 */
export default function CriarEtapaEntregaModal({ open, onClose, pedidoData, onCriarEtapa }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose?.(); }}>
      <DialogContent className="max-w-[90vw] max-h-[95vh] overflow-hidden flex flex-col bg-sky-50/40">
        <DialogHeader>
          <DialogTitle className="text-sky-900">Criar Nova Etapa de Entrega/Faturamento</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <CriarEtapaEntregaForm
            pedidoData={pedidoData}
            onCriarEtapa={(etapa) => {
              onCriarEtapa?.(etapa);
              onClose?.();
            }}
          />
        </div>
        <div className="flex-shrink-0 flex justify-end gap-3 pt-2 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            data-action="cancelar-etapa-entrega-modal"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
