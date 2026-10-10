import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Campo readonly do código numérico reservado no backend (MASTER_CODE).
 * Extraído do padrão já usado em Marca/GrupoProduto/Setor/UM — sem inventar fluxo novo.
 * Quando `entityId` é informado na edição, expõe também o ID técnico (≠ código).
 *
 * @param {{ value?: string|number|null, hasId?: boolean, action: string, entityId?: string|number|null }} props
 */
export default function CadastroCodigoRegistroField({ value, hasId, action, entityId }) {
  if (hasId) {
    const idAction = typeof action === 'string' && action.startsWith('codigo-registro-')
      ? action.replace('codigo-registro-', 'id-tecnico-')
      : `id-tecnico-${action || 'cadastro'}`;
    return (
      <div className="space-y-3">
        <div>
          <Label>Código de registro</Label>
          <Input
            value={value != null && value !== '' ? String(value) : ''}
            readOnly
            disabled
            className="bg-slate-50 font-mono tabular-nums"
            data-action={action}
            title="Gerado automaticamente no backend; ID técnico permanece separado"
          />
        </div>
        {entityId != null && String(entityId).trim() !== '' ? (
          <div>
            <Label>ID técnico</Label>
            <Input
              value={String(entityId)}
              readOnly
              disabled
              className="bg-slate-50 font-mono text-xs"
              data-action={idAction}
              title="Identificador técnico imutável; distinto do código de registro"
            />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <p className="text-xs text-slate-500">
      Código de registro numérico será gerado automaticamente ao salvar.
    </p>
  );
}
