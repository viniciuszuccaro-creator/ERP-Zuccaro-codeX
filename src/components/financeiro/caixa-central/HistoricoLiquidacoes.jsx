import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import useContextoVisual from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

export default function HistoricoLiquidacoes() {
  const { filterInContext, empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const canViewHistorico = hasPermission('Financeiro', 'Caixa Central', 'visualizar') ||
    hasPermission('Financeiro', 'Caixa', 'visualizar') ||
    hasPermission('Financeiro', null, 'visualizar');

  const { data: ordensLiquidacao = [], isLoading } = useQuery({
    queryKey: ['caixa-ordens-liquidacao', groupId, empresaId],
    queryFn: () => filterInContext('CaixaOrdemLiquidacao', {}, '-created_date'),
    enabled: contextoValido && canViewHistorico
  });

  const ordensLiquidadas = ordensLiquidacao.filter(o => o.status === "Liquidado");
  const ordensCanceladas = ordensLiquidacao.filter(o => o.status === "Cancelado");

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-slate-500">
          Carregando histórico...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      {(!contextoValido || !canViewHistorico) && (
        <Alert className="m-4 border-amber-300 bg-amber-50" data-permission="Financeiro.CaixaCentral.visualizar" data-context-required="true">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription>Selecione grupo ou empresa e confirme permissao para visualizar historico de liquidacoes.</AlertDescription>
        </Alert>
      )}
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          Histórico de Liquidações
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Data Processamento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Títulos Vinculados</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...ordensLiquidadas, ...ordensCanceladas].map(ordem => (
                <TableRow key={ordem.id} className={ordem.status === "Cancelado" ? "opacity-50" : ""}>
                  <TableCell className="text-sm">
                    {ordem.data_processamento ? new Date(ordem.data_processamento).toLocaleString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={ordem.tipo_operacao === "Recebimento" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {ordem.tipo_operacao === "Recebimento" ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {ordem.tipo_operacao}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{ordem.origem}</Badge></TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {ordem.titulos_vinculados?.slice(0, 2).map((titulo, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="font-semibold">{titulo.numero_titulo}</span>
                          <span className="text-slate-500"> • {titulo.cliente_fornecedor_nome}</span>
                        </div>
                      ))}
                      {ordem.titulos_vinculados?.length > 2 && (
                        <p className="text-xs text-slate-500">+{ordem.titulos_vinculados.length - 2} mais</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">R$ {(ordem.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge className={ordem.status === "Liquidado" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {ordem.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {ordensLiquidadas.length === 0 && ordensCanceladas.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Nenhum histórico ainda</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
