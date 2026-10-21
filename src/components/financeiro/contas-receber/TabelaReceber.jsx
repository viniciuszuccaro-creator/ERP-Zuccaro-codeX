import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Printer, Eye, Edit, CreditCard, QrCode, FileText, MessageSquare, CheckCircle2, Wallet, Zap, DollarSign } from 'lucide-react';
import { ProtectedAction } from '@/components/ProtectedAction';

import EstagiosRecebimentoWidget from '../EstagiosRecebimentoWidget';
import ERPDataTable from '@/components/ui/erp/DataTable';

export default function TabelaReceber({
  contas,
  empresas,
  statusColors,
  contasSelecionadas,
  toggleSelecao,
  onPrint,
  onEdit,
  onGerarCobranca,
  onGerarLink,
  onVerBoleto,
  onCopiarPix,
  onEnviarWhatsApp,
  onSimularPagamento,
  onBaixar,
  configsCobranca,
  sortField = undefined,
  sortDirection = undefined,
  onSortChange = undefined
}) {
  const obterConfigEmpresa = (empresaId) => configsCobranca.find(c => c.empresa_id === empresaId);

  const isRowSelectable = (row) => row.status === "Pendente" || row.status === "Atrasado";
  const allSelected = React.useMemo(() => {
    const allowed = contas.filter(isRowSelectable).length;
    return contasSelecionadas.length === allowed && allowed > 0;
  }, [contas, contasSelecionadas]);
  const onToggleSelectAll = () => {
    const pendentes = contas.filter(isRowSelectable);
    if (!allSelected) {
      pendentes.forEach(c => { if (!contasSelecionadas.includes(c.id)) toggleSelecao(c.id); });
    } else {
      pendentes.forEach(c => { if (contasSelecionadas.includes(c.id)) toggleSelecao(c.id); });
    }
  };

  const columns = React.useMemo(() => [
    { key: 'cliente', label: 'Cliente', render: (r) => (<span className="font-medium text-sm">{r.cliente}</span>) },
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
    { key: 'data_vencimento', label: 'Vencimento', render: (r) => {
        const vencida = (r.status === 'Pendente' || r.status === 'Atrasado') && new Date(r.data_vencimento) < new Date();
        const diasAtraso = vencida ? Math.floor((new Date().getTime() - new Date(r.data_vencimento).getTime()) / (1000*60*60*24)) : 0;
        return (
          <div>
            <p className="text-sm">{new Date(r.data_vencimento).toLocaleDateString('pt-BR')}</p>
            {vencida && (<Badge variant="destructive" className="text-xs">{diasAtraso}d atraso</Badge>)}
          </div>
        );
      }
    },
    { key: 'valor', label: 'Valor', isNumeric: true, render: (r) => (<span className="font-semibold">R$ {(r.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>) },
    { key: 'status', label: 'Status', render: (r) => (<Badge className={statusColors[r.status] || 'bg-gray-100 text-gray-800'}>{r.status}</Badge>) },
    { key: 'canal_origem', label: 'Canal', render: (r) => (<Badge variant="outline" className="text-xs">{r.canal_origem || 'Manual'}</Badge>) },
    { key: 'marketplace', label: 'Marketplace', render: (r) => (r.marketplace_origem && r.marketplace_origem !== 'Nenhum' ? (<Badge className="bg-purple-100 text-purple-700 text-xs">{r.marketplace_origem}</Badge>) : <span className="text-xs text-slate-400">-</span>) },
    { key: 'cobranca', label: 'Cobrança', render: (r) => ((r.status_cobranca === 'gerada_simulada' || r.status_cobranca === 'gerada') ? (<Badge className="bg-green-100 text-green-700 text-xs">{r.forma_cobranca}</Badge>) : (<Badge variant="outline" className="text-xs">Não Gerada</Badge>)) },
    { key: 'estagios', label: 'Estágios', render: (r) => (r.status === 'Recebido' && r.detalhes_pagamento ? (<EstagiosRecebimentoWidget conta={r} />) : <span className="text-xs text-slate-400">-</span>) },
    { key: 'actions', label: 'Ações', render: (r) => {
        const emp = empresas.find(e => e.id === r.empresa_id);
        const config = obterConfigEmpresa(r.empresa_id);
        const temConfig = config && config.ativo;
        return (
          <div className="flex flex-col gap-1 items-start">
            <Button data-permission="Financeiro.ContasReceber.exportar" variant="ghost" size="sm" onClick={() => onPrint(r, emp)} className="justify-start h-6 px-2 text-xs">
              <Printer className="w-3 h-3 mr-1" /> Imprimir
            </Button>
            <Button data-permission="Financeiro.ContasReceber.visualizar" variant="ghost" size="sm" onClick={() => onEdit(r)} className="justify-start h-6 px-2 text-xs">
              <Eye className="w-3 h-3 mr-1" /> Detalhes
            </Button>
            {r.status === 'Pendente' && (
              <>
                {!r.status_cobranca && temConfig && (
                  <>
                    <Button data-permission="Financeiro.ContasReceber.gerar_cobranca" variant="ghost" size="sm" onClick={() => onGerarCobranca(r)} className="justify-start h-6 px-2 text-xs">
                      <CreditCard className="w-3 h-3 mr-1" /> Cobrança
                    </Button>
                    <Button data-permission="Financeiro.ContasReceber.gerar_link_pagamento" variant="ghost" size="sm" onClick={() => onGerarLink(r)} className="justify-start h-6 px-2 text-xs text-purple-600">
                      <Wallet className="w-3 h-3 mr-1" /> Link
                    </Button>
                  </>
                )}
                {r.boleto_url && (
                  <Button variant="ghost" size="sm" onClick={() => onVerBoleto(r)} className="justify-start h-6 px-2 text-xs">
                    <FileText className="w-3 h-3 mr-1" /> Boleto
                  </Button>
                )}
                {r.pix_copia_cola && (
                  <Button variant="ghost" size="sm" onClick={() => onCopiarPix(r)} className="justify-start h-6 px-2 text-xs">
                    <QrCode className="w-3 h-3 mr-1" /> PIX
                  </Button>
                )}
                {(r.boleto_url || r.pix_copia_cola) && (
                  <Button data-permission="Financeiro.ContasReceber.enviar_cobranca_whatsapp" variant="ghost" size="sm" onClick={() => onEnviarWhatsApp(r)} className="justify-start h-6 px-2 text-xs">
                    <MessageSquare className="w-3 h-3 mr-1" /> WhatsApp
                  </Button>
                )}
                {r.status_cobranca === 'gerada_simulada' && (
                  <Button data-permission="Financeiro.ContasReceber.simular_pagamento" variant="ghost" size="sm" onClick={() => onSimularPagamento(r)} className="justify-start h-6 px-2 text-xs text-green-600">
                    <Zap className="w-3 h-3 mr-1" /> Simular
                  </Button>
                )}
                <Button data-permission="Financeiro.ContasReceber.baixar" variant="ghost" size="sm" onClick={() => onBaixar(r)} className="justify-start h-6 px-2 text-xs text-green-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Baixar
                </Button>
              </>
            )}
            <Button data-permission="Financeiro.ContasReceber.editar" variant="ghost" size="sm" onClick={() => onEdit(r, true)} className="justify-start h-6 px-2 text-xs">
              <Edit className="w-3 h-3 mr-1" /> Editar
            </Button>
          </div>
        );
      }
    }
  ], [empresas, statusColors, configsCobranca, contasSelecionadas]);

  return (
    <Card className="border-0 shadow-md flex-1 overflow-hidden flex flex-col">
      <CardHeader className="bg-slate-50 border-b py-2 px-3 min-h-[50px] max-h-[50px]">
        <CardTitle className="text-sm">Títulos a Receber</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto">
        <ERPDataTable
          columns={columns}
          data={contas}
          entityName="ContaReceber"
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
          permission="Financeiro.ContasReceber.visualizar"
        />

        {contas.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Nenhuma conta a receber encontrada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
