import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Download, Edit, Eye, FileText, Plus, Printer, Search, Send, XCircle } from 'lucide-react';
import { ProtectedAction } from '@/components/ProtectedAction';
import ERPDataTable from '@/components/ui/erp/DataTable';

/** @typedef {import('./notasFiscaisTabPolicy').NotaFiscalTabRecord} NotaFiscalTabRecord */

/**
 * @param {{
 *  notas: NotaFiscalTabRecord[], totals: {total: number, totalAutorizada: number, totalCancelada: number},
 *  searchTerm: string, statusFilter: string, tipoFilter: string,
 *  setSearchTerm: (value: string) => void, setStatusFilter: (value: string) => void, setTipoFilter: (value: string) => void,
 *  contextoValido: boolean, empresaId?: string|null, canViewNota: boolean, canCreateNota: boolean,
 *  canEditNota: boolean, canCancelNota: boolean, canExportNota: boolean, canPrintNota: boolean,
 *  canDownloadDanfe: boolean, canSendNota: boolean, onCreateNFe?: (() => void)|null,
 *  isDialogOpen: boolean, onDialogOpenChange: (open: boolean) => void,
 *  selectedNF: NotaFiscalTabRecord|null, formData: NotaFiscalTabRecord,
 *  setFormData: (value: NotaFiscalTabRecord) => void, onSubmit: (event: React.FormEvent<HTMLFormElement>) => void,
 *  isSaving: boolean, selectedNotas: string[], setSelectedNotas: (ids: string[]) => void,
 *  onExport: (notas: NotaFiscalTabRecord[]) => void, onView: (nota: NotaFiscalTabRecord) => void,
 *  onEdit: (nota: NotaFiscalTabRecord) => void, onPrint: (nota: NotaFiscalTabRecord) => void,
 *  onDownload: (nota: NotaFiscalTabRecord) => void, onSend: (nota: NotaFiscalTabRecord) => void,
 *  onCancelNFe: (nota: NotaFiscalTabRecord) => void, sending: boolean, cancelling: boolean,
 *  viewingDetails: NotaFiscalTabRecord|null, onCloseDetails: () => void,
 *  sortField: string, sortDirection: string, onSortChange: (field: string, direction: string) => void,
 *  page: number, pageSize: number, totalItems: number, onPageChange: (page: number) => void,
 *  onPageSizeChange: (size: number) => void
 * }} props
 */
export default function NotasFiscaisTabView(props) {
  const {
    notas, totals, searchTerm, statusFilter, tipoFilter, setSearchTerm, setStatusFilter, setTipoFilter,
    contextoValido, empresaId, canViewNota, canCreateNota, canEditNota, canCancelNota, canExportNota,
    canPrintNota, canDownloadDanfe, canSendNota, onCreateNFe, isDialogOpen, onDialogOpenChange,
    selectedNF, formData, setFormData, onSubmit, isSaving, selectedNotas, setSelectedNotas, onExport,
    onView, onEdit, onPrint, onDownload, onSend, onCancelNFe, sending, cancelling, viewingDetails,
    onCloseDetails, sortField, sortDirection, onSortChange, page, pageSize, totalItems, onPageChange,
    onPageSizeChange,
  } = props;
  const selectedSet = new Set(selectedNotas);

  const columns = [
    { key: 'numero', label: 'Numero', render: (nota) => <span className="font-medium">{nota.numero}</span> },
    { key: 'serie', label: 'Serie' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'cliente_fornecedor', label: 'Cliente/Fornecedor' },
    { key: 'data_emissao', label: 'Data Emissao', render: (nota) => nota.data_emissao ? new Date(nota.data_emissao).toLocaleDateString('pt-BR') : '-' },
    { key: 'valor_total', label: 'Valor Total', isNumeric: true, render: (nota) => `R$ ${Number(nota.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
    { key: 'status', label: 'Status', render: (nota) => <Badge className={statusClass(nota.status)}>{nota.status}</Badge> },
    { key: 'actions', label: 'Acoes', render: (nota) => (
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" data-permission="Fiscal.NotaFiscal.visualizar" onClick={() => onView(nota)} disabled={!contextoValido || !canViewNota} title="Ver detalhes" className="h-8 px-2"><Eye className="w-3 h-3 mr-1" /><span className="text-xs">Ver</span></Button>
        <ProtectedAction module="Fiscal" section="NotaFiscal" action="editar" mode="disable">
          <Button variant="ghost" size="sm" data-permission="Fiscal.NotaFiscal.editar" data-action="Fiscal.NotaFiscal.editar" data-context-required="true" data-sensitive="true" onClick={() => onEdit(nota)} disabled={!contextoValido || !canEditNota} title="Editar NF-e" className="h-8 px-2 text-amber-600"><Edit className="w-3 h-3 mr-1" /><span className="text-xs">Editar</span></Button>
        </ProtectedAction>
        <Button variant="ghost" size="sm" data-permission="Fiscal.NotaFiscal.imprimir" onClick={() => onPrint(nota)} disabled={!contextoValido || !canPrintNota} title="Imprimir DANFE" className="h-8 px-2 text-slate-600"><Printer className="w-3 h-3 mr-1" /><span className="text-xs">Imprimir</span></Button>
        {nota.danfe_url && <Button variant="ghost" size="sm" data-permission="Fiscal.NotaFiscal.baixar_pdf" onClick={() => onDownload(nota)} disabled={!contextoValido || !canDownloadDanfe} title="Baixar DANFE" className="h-8 px-2 text-blue-600"><Download className="w-3 h-3 mr-1" /><span className="text-xs">PDF</span></Button>}
        {nota.status === 'Pendente' && canSendNota && <Button variant="ghost" size="sm" title="Enviar NF-e" className="h-8 px-2 text-green-600" data-permission="Fiscal.NotaFiscal.enviar" data-action="Fiscal.NotaFiscal.enviar" data-context-required="true" data-sensitive="true" onClick={() => onSend(nota)} disabled={!contextoValido || sending}><Send className="w-3 h-3 mr-1" /><span className="text-xs">Enviar</span></Button>}
        {nota.status === 'Autorizada' && <ProtectedAction module="Fiscal" section="NotaFiscal" action="cancelar" mode="disable"><Button variant="ghost" size="sm" onClick={() => onCancelNFe(nota)} disabled={!contextoValido || !canCancelNota || cancelling} className="h-8 px-2 text-red-600" title="Cancelar NF-e" data-action="Fiscal.NotaFiscal.cancelar" data-permission="Fiscal.NotaFiscal.cancelar" data-context-required="true" data-sensitive="true"><XCircle className="w-3 h-3 mr-1" /><span className="text-xs">Cancelar</span></Button></ProtectedAction>}
      </div>
    ) },
  ];

  return (
    <div className="w-full h-full space-y-6 overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Total Emitidas" value={String(totals.total)} className="border-0 shadow-md" />
        <SummaryCard label="Autorizadas" value={`R$ ${totals.totalAutorizada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} className="border-0 shadow-md bg-green-50" textClass="text-green-900" />
        <SummaryCard label="Canceladas" value={`R$ ${totals.totalCancelada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} className="border-0 shadow-md bg-red-50" textClass="text-red-900" />
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /><Input placeholder="Buscar por cliente, numero, serie, chave, CPF/CNPJ, tipo, pedido..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-10" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="todas">Todos os Status</SelectItem><SelectItem value="Autorizada">Autorizada</SelectItem><SelectItem value="Cancelada">Cancelada</SelectItem><SelectItem value="Denegada">Denegada</SelectItem><SelectItem value="Pendente">Pendente</SelectItem><SelectItem value="Erro">Erro</SelectItem></SelectContent></Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}><SelectTrigger className="w-full lg:w-48"><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent><SelectItem value="todas">Todos os Tipos</SelectItem><SelectItem value="NF-e (Saída)">NF-e (Saida)</SelectItem><SelectItem value="NF-e (Entrada)">NF-e (Entrada)</SelectItem><SelectItem value="NFS-e">NFS-e</SelectItem><SelectItem value="CT-e">CT-e</SelectItem></SelectContent></Select>
            {onCreateNFe && canCreateNota && contextoValido && empresaId && <Button className="bg-blue-600 hover:bg-blue-700" data-permission="Fiscal.NotaFiscal.criar" data-action="Fiscal.NotaFiscal.criar" data-context-required="true" data-sensitive="true" onClick={onCreateNFe}><Plus className="w-4 h-4 mr-2" />Nova NF-e</Button>}
            <Dialog open={isDialogOpen} onOpenChange={onDialogOpenChange}>
              <DialogTrigger asChild>{!onCreateNFe && canCreateNota ? <Button className="bg-blue-600 hover:bg-blue-700" data-permission="Fiscal.NotaFiscal.criar" data-action="Fiscal.NotaFiscal.criar_rapido" data-context-required="true" data-sensitive="true" disabled={!contextoValido || !empresaId}><Plus className="w-4 h-4 mr-2" />Nova NF-e (Rapido)</Button> : <span />}</DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>{selectedNF ? 'Editar' : 'Nova'} Nota Fiscal</DialogTitle></DialogHeader><NotaFiscalForm formData={formData} setFormData={setFormData} onSubmit={onSubmit} onClose={() => onDialogOpenChange(false)} isSaving={isSaving} canSave={contextoValido && Boolean(empresaId) && (selectedNF ? canEditNota : canCreateNota)} isEditing={Boolean(selectedNF)} /></DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader className="bg-slate-50 border-b"><CardTitle>Notas Fiscais Emitidas</CardTitle></CardHeader>
        <CardContent className="p-3 sm:p-6">
          {selectedNotas.length > 0 && <Alert className="mb-3 border-blue-300 bg-blue-50"><AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div className="text-blue-900 font-semibold">{selectedNotas.length} NF selecionada(s)</div><div className="flex flex-wrap gap-2"><ProtectedAction module="Fiscal" section="NotaFiscal" action="exportar" mode="disable"><Button variant="outline" data-action="Fiscal.NotaFiscal.exportar" data-permission="Fiscal.NotaFiscal.exportar" data-context-required="true" onClick={() => onExport(notas.filter((nota) => selectedSet.has(nota.id || '')))} disabled={!contextoValido || !canExportNota}><Download className="w-4 h-4 mr-2" />Exportar CSV</Button></ProtectedAction><Button variant="ghost" onClick={() => setSelectedNotas([])}>Limpar Selecao</Button></div></AlertDescription></Alert>}
          <ERPDataTable columns={columns} data={notas} entityName="NotaFiscal" sortField={sortField} sortDirection={sortDirection} onSortChange={onSortChange} selectedIds={selectedSet} allSelected={selectedNotas.length === notas.length && notas.length > 0} onToggleSelectAll={() => setSelectedNotas(selectedNotas.length === notas.length && notas.length ? [] : notas.map((nota) => nota.id || ''))} onToggleItem={(id) => setSelectedNotas(selectedSet.has(id) ? selectedNotas.filter((item) => item !== id) : [...selectedNotas, id])} permission="Fiscal.NotaFiscal.visualizar" page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} onColumnFiltersChange={undefined} onHiddenColumnsChange={undefined} onGlobalSearchChange={undefined} rowActionsRender={undefined} rowContextMenuItems={undefined} onBulkDeleteSelected={undefined} onBulkExportSelected={undefined} />
          {!notas.length && <div className="text-center py-8 text-slate-500"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Nenhuma nota encontrada</p></div>}
        </CardContent>
      </Card>

      {viewingDetails && <Dialog open onOpenChange={(open) => { if (!open) onCloseDetails(); }}><DialogContent className="max-w-2xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Detalhes NF-e {viewingDetails.numero}/{viewingDetails.serie}</DialogTitle></DialogHeader><NotaFiscalDetails nota={viewingDetails} canDownload={contextoValido && canDownloadDanfe} onDownload={() => onDownload(viewingDetails)} onClose={onCloseDetails} /></DialogContent></Dialog>}
    </div>
  );
}

function statusClass(status) {
  if (status === 'Autorizada') return 'bg-green-100 text-green-700';
  if (status === 'Cancelada') return 'bg-red-100 text-red-700';
  if (status === 'Denegada') return 'bg-gray-100 text-gray-700';
  if (status === 'Pendente') return 'bg-yellow-100 text-yellow-700';
  return 'bg-orange-100 text-orange-700';
}

/** @param {{label: string, value: string, className: string, textClass?: string}} props */
function SummaryCard({ label, value, className, textClass = 'text-slate-900' }) {
  return <Card className={className}><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600">{label}</p><p className={`text-2xl font-bold ${textClass}`}>{value}</p></div><FileText className="w-8 h-8 text-slate-400" /></div></CardContent></Card>;
}

/** @param {{formData: NotaFiscalTabRecord, setFormData: (value: NotaFiscalTabRecord) => void, onSubmit: (event: React.FormEvent<HTMLFormElement>) => void, onClose: () => void, isSaving: boolean, canSave: boolean, isEditing: boolean}} props */
function NotaFiscalForm({ formData, setFormData, onSubmit, onClose, isSaving, canSave, isEditing }) {
  return <form onSubmit={onSubmit} className="space-y-4"><div><Label>Tipo *</Label><Select value={formData.tipo || ''} onValueChange={(value) => setFormData({ ...formData, tipo: value })}><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent><SelectItem value="NF-e (Saída)">NF-e (Saida)</SelectItem><SelectItem value="NF-e (Entrada)">NF-e (Entrada)</SelectItem><SelectItem value="NFS-e">NFS-e</SelectItem><SelectItem value="CT-e">CT-e</SelectItem></SelectContent></Select></div><div><Label>Cliente/Fornecedor *</Label><Input value={formData.cliente_fornecedor || ''} onChange={(event) => setFormData({ ...formData, cliente_fornecedor: event.target.value })} required /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label>Numero *</Label><Input value={formData.numero || ''} onChange={(event) => setFormData({ ...formData, numero: event.target.value })} required /></div><div><Label>Serie *</Label><Input value={formData.serie || ''} onChange={(event) => setFormData({ ...formData, serie: event.target.value })} required /></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label>Data de Emissao *</Label><Input type="date" value={formData.data_emissao || ''} onChange={(event) => setFormData({ ...formData, data_emissao: event.target.value })} required /></div><div><Label>Valor Produtos *</Label><Input type="number" step="0.01" value={formData.valor_produtos || 0} onChange={(event) => setFormData({ ...formData, valor_produtos: parseFloat(event.target.value) || 0 })} required /></div></div><div><Label>Valor Total *</Label><Input type="number" step="0.01" value={formData.valor_total || 0} onChange={(event) => setFormData({ ...formData, valor_total: parseFloat(event.target.value) || 0 })} required /></div><div><Label>Observacoes</Label><Textarea value={formData.observacoes || ''} onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })} /></div><div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={isSaving || !canSave} data-action={isEditing ? 'Fiscal.NotaFiscal.editar' : 'Fiscal.NotaFiscal.criar'} data-permission={isEditing ? 'Fiscal.NotaFiscal.editar' : 'Fiscal.NotaFiscal.criar'} data-context-required="true" data-sensitive="true">{isEditing ? 'Atualizar' : 'Criar'}</Button></div></form>;
}

/** @param {{nota: NotaFiscalTabRecord, canDownload: boolean, onDownload: () => void, onClose: () => void}} props */
function NotaFiscalDetails({ nota, canDownload, onDownload, onClose }) {
  return <div className="space-y-4 py-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label className="text-xs text-slate-600">Cliente/Fornecedor</Label><p className="font-semibold">{nota.cliente_fornecedor}</p></div><div><Label className="text-xs text-slate-600">Status</Label><div><Badge className={statusClass(nota.status)}>{nota.status}</Badge></div></div><div><Label className="text-xs text-slate-600">Chave de Acesso</Label><p className="font-mono text-xs break-all">{nota.chave_acesso || '-'}</p></div><div><Label className="text-xs text-slate-600">Protocolo</Label><p className="font-mono text-xs break-all">{nota.protocolo_autorizacao || '-'}</p></div><div><Label className="text-xs text-slate-600">Valor Produtos</Label><p className="text-lg font-bold text-green-600">R$ {Number(nota.valor_produtos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div><div><Label className="text-xs text-slate-600">Valor Total</Label><p className="text-lg font-bold text-blue-600">R$ {Number(nota.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div></div>{nota.observacoes && <div><Label className="text-xs text-slate-600">Observacoes</Label><p className="text-sm p-3 bg-slate-50 rounded">{nota.observacoes}</p></div>}<div className="flex flex-wrap gap-2 pt-4">{nota.danfe_url && <Button onClick={onDownload} disabled={!canDownload}><Download className="w-4 h-4 mr-2" />Baixar DANFE</Button>}<Button variant="outline" onClick={onClose}>Fechar</Button></div></div>;
}
