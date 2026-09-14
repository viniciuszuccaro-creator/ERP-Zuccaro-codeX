import React from 'react';
import { Bell, CheckCircle, RefreshCw, Zap } from 'lucide-react';
import AssinaturaEletronicaModal from '@/components/AssinaturaEletronicaModal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { STATUS_COLORS } from './contratosPagePolicy';

/** @typedef {import('./contratosPagePolicy.js').Contrato} Contrato */

/**
 * @param {{viewing: Contrato|null, onCloseViewing: () => void, historyOpen: boolean, onHistoryOpenChange: (open: boolean) => void, history: Contrato|null, signatureOpen: boolean, signatureContract: Contrato|null, onCloseSignature: () => void}} props
 */
export default function ContratoDialogs({ viewing, onCloseViewing, historyOpen, onHistoryOpenChange, history, signatureOpen, signatureContract, onCloseSignature }) {
  return <>
    {viewing && <Dialog open onOpenChange={(open) => { if (!open) onCloseViewing(); }}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Detalhes do Contrato</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <ResponsiveGrid><Field label="Número" value={viewing.numero_contrato} strong /><Field label="Status"><Badge className={STATUS_COLORS[viewing.status] || STATUS_COLORS.Rascunho}>{viewing.status}</Badge></Field></ResponsiveGrid>
          <ResponsiveGrid><Field label="Tipo" value={viewing.tipo} /><Field label="Parte Contratante" value={viewing.parte_contratante} /></ResponsiveGrid>
          <Field label="Objeto" value={viewing.objeto} />
          {viewing.descricao && <Field label="Descrição" value={viewing.descricao} />}
          <ResponsiveGrid><MoneyField label="Valor Mensal" value={viewing.valor_mensal} /><MoneyField label="Valor Total" value={viewing.valor_total} /></ResponsiveGrid>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Data Início" value={formatDate(viewing.data_inicio)} />
            <Field label="Data Fim" value={formatDate(viewing.data_fim)} />
            <Field label="Vigência" value={`${viewing.vigencia_meses || 0} meses`} />
          </div>
          <ResponsiveGrid><Field label="Forma de Pagamento" value={viewing.forma_pagamento} /><Field label="Dia Vencimento" value={`Dia ${viewing.dia_vencimento || '-'}`} /></ResponsiveGrid>
          <ResponsiveGrid><Field label="Índice de Reajuste" value={viewing.indice_reajuste} /><Field label="Reajuste Anual" value={`${viewing.percentual_reajuste || 0}%`} /></ResponsiveGrid>
          <ResponsiveGrid><Field label="Renovação Automática" value={viewing.renovacao_automatica ? 'Sim' : 'Não'} /><Field label="Alertar Renovação" value={`${viewing.prazo_aviso_renovacao || 0} dias antes`} /></ResponsiveGrid>
          {viewing.gerar_cobranca_automatica && <Card className="border-purple-200 bg-purple-50"><CardContent className="p-4"><div className="mb-2 flex items-center gap-2"><Zap className="h-5 w-5 text-purple-600" /><p className="font-semibold text-purple-900">Cobrança Automática Ativa</p></div><div className="space-y-1 text-sm text-purple-800"><p>Última cobrança: {formatDate(viewing.ultima_cobranca_gerada) || 'Nenhuma'}</p><p>Próxima cobrança: {formatDate(viewing.proxima_cobranca) || 'Pendente'}</p><p>Total de cobranças geradas: {viewing.contas_geradas_ids?.length || 0}</p></div></CardContent></Card>}
          {viewing.responsavel_empresa && <Field label="Responsável" value={viewing.responsavel_empresa} />}
          {viewing.assinado && viewing.assinatura_digital && <div className="border-t pt-4"><Label className="mb-2 block text-slate-600">Assinatura Digital</Label><Card className="border-green-200 bg-green-50 p-4"><div className="flex items-start gap-3"><CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /><div className="text-sm text-green-900"><p className="mb-1 font-semibold">Documento Assinado Digitalmente</p><p>Por: <strong>{viewing.assinatura_digital.nome_completo}</strong></p><p>Em: <strong>{viewing.data_assinatura && new Date(viewing.data_assinatura).toLocaleString('pt-BR')}</strong></p><p className="mt-1 text-xs text-green-700">IP: {viewing.assinatura_digital.ip_address} | {viewing.assinatura_digital.dispositivo} - {viewing.assinatura_digital.navegador}</p></div></div></Card></div>}
          {viewing.observacoes && <Field label="Observações" value={viewing.observacoes} />}
        </div>
      </DialogContent>
    </Dialog>}

    <Dialog open={historyOpen} onOpenChange={onHistoryOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Histórico do Contrato {history?.numero_contrato}</DialogTitle></DialogHeader>
        {history && <div className="space-y-6">
          {!!history.historico_renovacoes?.length && <div><h4 className="mb-3 flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4 text-blue-600" />Renovações e Reajustes</h4><div className="space-y-2">{history.historico_renovacoes.map((renovacao, index) => <Card key={`${renovacao.data_renovacao || 'renovacao'}-${index}`} className="p-3"><p className="font-semibold">{renovacao.observacao}</p><p className="text-sm text-slate-600">{formatDate(renovacao.data_renovacao)} - Por {renovacao.usuario}</p><div className="mt-2 text-sm"><p>Valor anterior: <strong>{formatMoney(renovacao.valor_anterior)}</strong></p><p>Valor novo: <strong className="text-green-600">{formatMoney(renovacao.valor_novo)}</strong></p>{(renovacao.percentual_reajuste || 0) > 0 && <p>Reajuste: <Badge className="bg-blue-100 text-blue-700">{renovacao.percentual_reajuste}% ({renovacao.indice_utilizado})</Badge></p>}</div></Card>)}</div></div>}
          {!!history.alertas_enviados?.length && <div><h4 className="mb-3 flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-orange-600" />Alertas Enviados</h4><div className="space-y-2">{history.alertas_enviados.map((alerta, index) => <Card key={`${alerta.data_envio || 'alerta'}-${index}`} className="border-orange-200 bg-orange-50 p-3"><div className="flex items-center justify-between"><div><p className="font-semibold text-orange-900">{alerta.tipo}</p><p className="text-sm text-orange-700">Enviado em {alerta.data_envio && new Date(alerta.data_envio).toLocaleString('pt-BR')}</p><p className="text-xs text-orange-600">Para: {alerta.destinatario}</p></div>{alerta.enviado && <CheckCircle className="h-5 w-5 text-green-600" />}</div></Card>)}</div></div>}
        </div>}
      </DialogContent>
    </Dialog>

    {signatureContract && <AssinaturaEletronicaModal isOpen={signatureOpen} onClose={onCloseSignature} documento={signatureContract} tipo="contrato" onAssinado={onCloseSignature} />}
  </>;
}

/** @param {{children: React.ReactNode}} props */
function ResponsiveGrid({ children }) { return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>; }

/** @param {{label: string, value?: React.ReactNode, children?: React.ReactNode, strong?: boolean}} props */
function Field({ label, value, children, strong = false }) { return <div><Label className="text-slate-600">{label}</Label>{children || <p className={strong ? 'text-lg font-bold' : 'font-medium'}>{value}</p>}</div>; }

/** @param {{label: string, value?: number}} props */
function MoneyField({ label, value }) { return <div><Label className="text-slate-600">{label}</Label><p className="text-xl font-bold text-emerald-600">{formatMoney(value)}</p></div>; }

/** @param {number|undefined} value */
function formatMoney(value) { return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; }

/** @param {string|null|undefined} value */
function formatDate(value) { return value ? new Date(value).toLocaleDateString('pt-BR') : ''; }
