import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import ExtratoBancarioImportDialog from './ExtratoBancarioImportDialog';

export default function ConciliacaoAutomaticaIA({ empresaId: empresaIdProp }) {
  const [open,setOpen] = useState(false);
  const { empresaAtual,grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id;
  const empresaId = empresaAtual?.id;
  const scope = typeof groupId==='string' && typeof empresaId==='string' && typeof user?.id==='string'
    && (!empresaIdProp || empresaIdProp===empresaId) ? {groupId,empresaId,actorId:user.id} : null;
  const canRead = hasPermission('Financeiro','ContaBancariaEmpresa','visualizar')
    && hasPermission('Financeiro','ContaBancariaEmpresa','dados-sensiveis.visualizar')
    && hasPermission('Financeiro','conciliacao','visualizar')
    && hasPermission('Financeiro','conciliacao','dados-sensiveis.visualizar')
    && hasPermission('Financeiro','Caixa','visualizar')
    && hasPermission('Financeiro','Caixa','dados-sensiveis.visualizar');
  const canAnalyze = canRead && hasPermission('IA','financeiro_conciliacao','visualizar');
  return <div className="w-full space-y-4">
    <Card><CardHeader><CardTitle>Conciliação Assistida com IA</CardTitle></CardHeader>
      <CardContent><Button onClick={()=>setOpen(true)} disabled={!scope || !canAnalyze}>
        <Sparkles className="w-4 h-4 mr-2" />Analisar fonte bancária
      </Button></CardContent>
    </Card>
    {open && scope && canRead && <ExtratoBancarioImportDialog
      key={`${scope.actorId}:${scope.groupId}:${scope.empresaId}`}
      scope={scope} canImport={hasPermission('Financeiro','conciliacao','importar')}
      canReadMovements={canRead} canAnalyze={canAnalyze}
      canReconcile={canRead && hasPermission('Financeiro','conciliacao','conciliar')}
      canReverseLink={canRead && hasPermission('Financeiro','conciliacao','estornar')}
      onClose={()=>setOpen(false)} />}
  </div>;
}
