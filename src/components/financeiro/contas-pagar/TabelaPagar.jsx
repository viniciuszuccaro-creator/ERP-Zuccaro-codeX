import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Printer, Shield, CheckCircle, Edit2, DollarSign } from 'lucide-react';
import { ProtectedAction } from '@/components/ProtectedAction';
import StatusBadge from '../../StatusBadge';
import ERPDataTable from '@/components/ui/erp/DataTable';

export default function TabelaPagar({
  contas,
  empresas,
  contasSelecionadas,
  toggleSelecao,
  onPrint,
  onEdit,
  onAprovar,
  onBaixar,
  aprovarPending = false,
  sortField,
  sortDirection,
  onSortChange
}) {
  const isRowSelectable = (row) => row.status === 'Pendente' || row.status === 'Aprovado';
  const allSelected = React.useMemo(() => {
    const allowed = contas.filter(isRowSelectable).length;
    return contasSelecionadas.length === allowed && allowed > 0;
  }, [contas, contasSelecionadas]);
  const onToggleSelectAll = () => {
    const allowed = contas.filter(isRowSelectable);
    if (!allSelected) {
      allowed.forEach(c => { if (!contasSelecionadas.includes(c.id)) toggleSelecao(c.id); });
    } else {
      allowed.forEach(c => { if (contasSelecionadas.includes(c.id)) toggleSelecao(c.id); });
    }
  };

  const columns = React.useMemo(() => [
    { key: 'fornecedor', label: 'Fornecedor', render: (r) => (<span className="font-medium text-sm">{r.fornecedor}</span>) },
    { key: 'descricao', label: 'Descrição', render: (r) => (<span className="max-w-xs truncate text-sm inline-block align-middle" title={r.descricao}>{r.descricao}</span>) },
    { key: 'empresa', label: 'Empresa', render: (r) => {
        const emp = empresas.find(e => e.id === r.empresa_id);
        return (
          <div className="flex items-center gap-1">
            <Building2 className="w-3 h-3 text-purple-600" />
            <span className="text-xs">{emp?.nome_fantasia || '-'}</span>
          </div>
        );
      }
    },
    { key: 'data_vencimento', label: 'Vencimento', render: (r) => (<span className="text-sm">{new Date(r.data_vencimento).toLocaleDateString('pt-BR')}</span>) },
    { key: 'valor', label: 'Valor', isNumeric: true, render: (r) => (<span className="font-semibold">R$ {(r.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>) },
    { key: 'status', label: 'Status', render: (r) => (<StatusBadge status={r.status} />) },
    { key: 'actions', label: 'Ações', render: (r) => {
        const emp = empresas.find(e => e.id === r.empresa_id);
        const vencida = r.status === 'Pendente' && new Date(r.data_vencimento) < new Date();
        return (
          <div className="flex gap-1 justify-center">
            <Button data-permission="Financeiro.ContasPagar.exportar" variant="ghost" size="icon" onClick={() => onPrint(r, emp)} title="Imprimir" className="h-7 w-7">
              <Printer className="w-3 h-3" />
            </Button>
            <Button data-permission="Financeiro.ContasPagar.editar" variant="ghost" size="icon" onClick={() => onEdit(r)} title="Editar" className="h-7 w-7">
              <Edit2 className="w-3 h-3" />
            </Button>
            {r.status === 'Pendente' && (
              <Button data-permission="Financeiro.ContasPagar.aprovar" variant="ghost" size="icon" onClick={() => onAprovar(r.id)} disabled={aprovarPending} title="Aprovar" className="h-7 w-7">
                <Shield className="w-3 h-3 text-blue-600" />
              </Button>
            )}
            {r.status === 'Aprovado' && (
              <Button data-permission="Financeiro.ContasPagar.baixar" variant="ghost" size="icon" onClick={() => onBaixar(r)} title="Pagar" className="h-7 w-7">
                <CheckCircle className="w-3 h-3 text-green-600" />
              </Button>
            )}
          </div>
        );
      }
    }
  ], [empresas, aprovarPending]);

  return (
    <Card className="border-0 shadow-md flex-1 overflow-hidden flex flex-col">
      <CardHeader className="bg-slate-50 border-b py-2 px-3 min-h-[50px] max-h-[50px]">
        <CardTitle className="text-sm">Títulos a Pagar</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto">
        <ERPDataTable
          columns={columns}
          data={contas}
          entityName="ContaPagar"
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(sf, sd) => onSortChange && onSortChange(sf, sd)}
          selectedIds={contasSelecionadas}
          allSelected={allSelected}
          onToggleSelectAll={onToggleSelectAll}
          onToggleItem={(id) => {
            const r = contas.find(c => c.id === id);
            if (r && isRowSelectable(r)) toggleSelecao(id);
          }}
          isRowSelectable={isRowSelectable}
          permission="Financeiro.ContasPagar.visualizar"
        />

        {contas.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Nenhuma conta a pagar encontrada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
