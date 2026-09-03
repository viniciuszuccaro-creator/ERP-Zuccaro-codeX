import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Download, ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function OriginBadge({ origin }) {
  const options = {
    'Mercado Livre': { color: 'bg-yellow-100 text-yellow-700', symbol: 'ML' },
    Shopee: { color: 'bg-orange-100 text-orange-700', symbol: 'SH' },
    Amazon: { color: 'bg-blue-100 text-blue-700', symbol: 'AZ' },
    Site: { color: 'bg-purple-100 text-purple-700', symbol: 'WEB' },
  };
  const option = options[origin] || { color: 'bg-slate-100 text-slate-700', symbol: 'EXT' };
  return <Badge className={option.color}>{option.symbol} {origin}</Badge>;
}

export default function MarketplacePendingOrders({ contextValid, canImport, canView, importMutation, onOpen, orders }) {
  if (orders.length === 0) {
    return (
      <Alert className="border-green-300 bg-green-50">
        <CheckCircle2 className="w-5 h-5 text-green-600" />
        <AlertDescription>
          <p className="font-semibold text-green-900">Nenhum pedido pendente de importacao</p>
          <p className="text-sm text-green-700 mt-1">Todos os pedidos externos foram processados</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-base">Pedidos Pendentes de Importacao ({orders.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Origem</TableHead><TableHead>No. Pedido</TableHead><TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell><OriginBadge origin={order.origem} /></TableCell>
                <TableCell className="font-mono text-sm">{order.numero_pedido_externo}</TableCell>
                <TableCell><p className="font-semibold text-sm">{order.cliente_nome}</p><p className="text-xs text-slate-500">{order.cliente_cpf_cnpj}</p></TableCell>
                <TableCell className="text-sm">{new Date(order.data_pedido_externo).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell className="font-semibold text-green-600">R$ {(order.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell><Badge className={order.status_importacao === 'A Validar' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}>{order.status_importacao}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" onClick={() => importMutation.mutate(order)} disabled={importMutation.isPending || !contextValid || !canImport} className="bg-green-600 hover:bg-green-700" data-action="Integracoes.Marketplaces.importarPedido" data-permission="Sistema.Integracoes.criar|Sistema.Integracoes.editar" data-context-required="group-or-company" data-sensitive="true">
                      <Download className="w-4 h-4 mr-1" />Importar
                    </Button>
                    {order.id_externo && (
                      <Button size="sm" variant="outline" onClick={() => onOpen(order)} disabled={!contextValid || !canView} data-action="Integracoes.Marketplaces.abrirPedidoExterno" data-permission="Sistema.Integracoes.visualizar" data-context-required="group-or-company" data-sensitive="true" title="Abrir pedido no marketplace">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
