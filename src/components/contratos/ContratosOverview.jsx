import React from 'react';
import { AlertCircle, Bell, CheckCircle, Clock, DollarSign, Edit, Eye, FileText, History, PenTool, Receipt, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calcularDiasParaVencimento, STATUS_COLORS, TIPO_COLORS } from './contratosPagePolicy';

/** @typedef {import('./contratosPagePolicy.js').Contrato} Contrato */

/**
 * @param {{
 *  contratos: Contrato[], filtrados: Contrato[], resumo: {vigentes: Contrato[], aguardando: Contrato[], vencidos: Contrato[], proximosVencer: Contrato[], valorMensalVigente: number},
 *  activeTab: string, onTabChange: (value: string) => void, searchTerm: string, onSearchChange: (value: string) => void,
 *  onView: (contrato: Contrato) => void, onEdit: (contrato: Contrato) => void, onSign: (contrato: Contrato) => void,
 *  onCharge: (contrato: Contrato) => void, onRenew: (contrato: Contrato) => void, onHistory: (contrato: Contrato) => void,
 *  onDeactivate: (contrato: Contrato) => void, canEdit: boolean, canSign: boolean, canCharge: boolean, canRenew: boolean, canDeactivate: boolean,
 *  charging: boolean, renewing: boolean
 * }} props
 */
export default function ContratosOverview({
  contratos, filtrados, resumo, activeTab, onTabChange, searchTerm, onSearchChange,
  onView, onEdit, onSign, onCharge, onRenew, onHistory, onDeactivate,
  canEdit, canSign, canCharge, canRenew, canDeactivate, charging, renewing
}) {
  return <>
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Contratos Vigentes" value={resumo.vigentes.length} icon={CheckCircle} color="green" />
      <Kpi label="Receita Mensal Recorrente" value={`R$ ${resumo.valorMensalVigente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="emerald" compact />
      <Kpi label="Próximos a Vencer" value={resumo.proximosVencer.length} detail="60 dias" icon={Clock} color="orange" />
      <Kpi label="Aguardando Assinatura" value={resumo.aguardando.length} icon={AlertCircle} color="yellow" />
    </div>

    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="overflow-x-auto pb-1">
        <TabsList className="grid min-w-[760px] grid-cols-5 mb-4">
          <TabsTrigger value="todos">Todos ({contratos.length})</TabsTrigger>
          <TabsTrigger value="Vigente">Vigentes ({resumo.vigentes.length})</TabsTrigger>
          <TabsTrigger value="Aguardando Assinatura">Aguardando Assinatura ({resumo.aguardando.length})</TabsTrigger>
          <TabsTrigger value="proximos">Próximos a Vencer ({resumo.proximosVencer.length})</TabsTrigger>
          <TabsTrigger value="Vencido">Vencidos ({resumo.vencidos.length})</TabsTrigger>
        </TabsList>
      </div>
    </Tabs>

    <Card><CardContent className="p-4"><div className="relative">
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <Input placeholder="Buscar por número, contratante, objeto, tipo, status, responsável, forma pagamento..." value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} className="pl-10" />
    </div></CardContent></Card>

    <Card>
      <CardHeader><CardTitle>Contratos</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto"><Table className="min-w-[980px]">
          <TableHeader><TableRow>
            <TableHead>Número</TableHead><TableHead>Tipo</TableHead><TableHead>Parte Contratante</TableHead><TableHead>Objeto</TableHead>
            <TableHead>Vigência</TableHead><TableHead>Valor Mensal</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>{filtrados.map((contrato) => {
            const diasVencer = contrato.data_fim ? calcularDiasParaVencimento(contrato.data_fim) : -1;
            const renovavel = (contrato.status === 'Vigente' && diasVencer <= 0) || (contrato.status === 'Vencido' && contrato.renovacao_automatica);
            return <TableRow key={contrato.id}>
              <TableCell className="font-medium">{contrato.numero_contrato}</TableCell>
              <TableCell><Badge className={TIPO_COLORS[contrato.tipo] || TIPO_COLORS.Outro}>{contrato.tipo}</Badge></TableCell>
              <TableCell>{contrato.parte_contratante}</TableCell><TableCell className="max-w-xs truncate">{contrato.objeto}</TableCell>
              <TableCell><div className="text-sm">
                {contrato.data_inicio && new Date(contrato.data_inicio).toLocaleDateString('pt-BR')} até{' '}{contrato.data_fim && new Date(contrato.data_fim).toLocaleDateString('pt-BR')}
                {diasVencer > 0 && diasVencer <= 60 && contrato.status === 'Vigente' && <div className="mt-1 flex items-center gap-1 text-xs text-orange-600"><Bell className="h-3 w-3" />Vence em {diasVencer} dias</div>}
              </div></TableCell>
              <TableCell className="font-semibold text-emerald-600">R$ {contrato.valor_mensal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
              <TableCell><div className="flex flex-col gap-1">
                <Badge className={STATUS_COLORS[contrato.status] || STATUS_COLORS.Rascunho}>{contrato.status}</Badge>
                {contrato.assinado && <Badge className="bg-green-100 text-green-700 text-xs">✓ Assinado</Badge>}
                {contrato.renovacao_automatica && <Badge className="bg-blue-100 text-blue-700 text-xs">🔄 Auto-renova</Badge>}
                {contrato.gerar_cobranca_automatica && <Badge className="bg-purple-100 text-purple-700 text-xs">💳 Auto-cobrança</Badge>}
              </div></TableCell>
              <TableCell><div className="flex flex-wrap gap-1">
                <Action title="Ver detalhes" onClick={() => onView(contrato)} icon={Eye} />
                {canEdit && <Action title="Editar" onClick={() => onEdit(contrato)} icon={Edit} />}
                {canSign && podeAssinar(contrato) && <Action title="Assinar Eletronicamente" onClick={() => onSign(contrato)} icon={PenTool} className="text-blue-600 hover:bg-blue-50 hover:text-blue-700" />}
                {canCharge && contrato.gerar_cobranca_automatica && contrato.status === 'Vigente' && <Action title="Gerar Cobrança Manualmente" onClick={() => onCharge(contrato)} icon={Receipt} className="text-purple-600 hover:text-purple-700" disabled={charging} />}
                {canRenew && renovavel && <Action title="Renovar Contrato" onClick={() => onRenew(contrato)} icon={RefreshCw} className="text-green-600 hover:text-green-700" disabled={renewing} />}
                {(contrato.historico_renovacoes?.length || contrato.alertas_enviados?.length) ? <Action title="Ver Histórico" onClick={() => onHistory(contrato)} icon={History} className="text-indigo-600" /> : null}
                {canDeactivate && contrato.status !== 'Rescindido' && <Action title="Rescindir contrato" onClick={() => onDeactivate(contrato)} icon={Trash2} className="text-red-600 hover:text-red-700" />}
              </div></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table></div>
        {filtrados.length === 0 && <div className="py-12 text-center"><FileText className="mx-auto mb-3 h-12 w-12 text-slate-400" /><p className="text-slate-500">Nenhum contrato encontrado</p></div>}
      </CardContent>
    </Card>
  </>;
}

/** @param {{label: string, value: string|number, detail?: string, icon: React.ComponentType<{className?: string}>, color: string, compact?: boolean}} props */
function Kpi({ label, value, detail, icon: Icon, color, compact = false }) {
  const colorClass = { green: 'text-green-600 bg-green-100', emerald: 'text-emerald-600 bg-emerald-100', orange: 'text-orange-600 bg-orange-100', yellow: 'text-yellow-600 bg-yellow-100' }[color] || 'text-slate-600 bg-slate-100';
  const [textColor, background] = colorClass.split(' ');
  return <Card className="border-0 shadow-md"><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-sm text-slate-600">{label}</p><p className={`${compact ? 'text-2xl' : 'text-3xl'} mt-1 font-bold ${textColor}`}>{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div><div className={`rounded-lg p-3 ${background}`}><Icon className={`h-6 w-6 ${textColor}`} /></div></div></CardContent></Card>;
}

/** @param {{title: string, onClick: () => void, icon: React.ComponentType<{className?: string}>, className?: string, disabled?: boolean}} props */
function Action({ title, onClick, icon: Icon, className = '', disabled = false }) {
  return <Button variant="ghost" size="icon" onClick={onClick} title={title} className={className} disabled={disabled}><Icon className="h-4 w-4" /></Button>;
}

/** @param {Contrato} contrato */
function podeAssinar(contrato) {
  return contrato.status === 'Aguardando Assinatura' || (contrato.status === 'Vigente' && !contrato.assinado);
}
