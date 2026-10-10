import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Campo readonly do código numérico reservado no backend (MASTER_CODE).
 * Extraído do padrão já usado em Marca/GrupoProduto/Setor/UM — sem inventar fluxo novo.
 *
 * @param {{ value?: string|number|null, hasId?: boolean, action: string }} props
 */
export default function CadastroCodigoRegistroField({ value, hasId, action }) {
  if (hasId) {
    return (
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
    );
  }
  return (
    <p className="text-xs text-slate-500">
      Código de registro numérico será gerado automaticamente ao salvar.
    </p>
  );
}
