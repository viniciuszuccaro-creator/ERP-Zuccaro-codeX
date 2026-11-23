/**
 * Peças visuais extraídas do CentralVendas360Shell (arquivo >600 linhas).
 * Sem tela/módulo paralelo — só composição do shell existente.
 */
import React, { Suspense, useMemo } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  FileText,
  History,
  MapPinned,
  MoreHorizontal,
  Package,
  Printer,
  Scissors,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { partitionCentralItens } from './centralVendas360Layout';

const CentralCliente360Panel = React.lazy(() => import('./CentralCliente360Panel'));

const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};


export function GradesSimultaneas({ itens, hasSelection = false }) {
  const list = Array.isArray(itens) ? itens : [];
  const { corte, revenda } = useMemo(() => partitionCentralItens(list), [list]);
  const semItensCarregados = hasSelection && list.length === 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-[160px]" data-block="central360-grades-simultaneas">
      {semItensCarregados ? (
        <div
          className="lg:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          data-block="central360-grades-sem-itens"
          role="status"
        >
          Itens ainda não disponíveis nesta seleção. Aguarde a consulta ou reabra o documento. Grades vazias não confirmam estoque zerado.
        </div>
      ) : null}
      <GradeItens
        title="Corte e Dobra / Montagem"
        rows={corte}
        testId="central360-grade-corte"
        columns={['item', 'descricao', 'qtde', 'un', 'peso', 'total']}
      />
      <GradeItens
        title="Materiais de Revenda"
        rows={revenda}
        testId="central360-grade-revenda"
        columns={['item', 'descricao', 'qtde', 'un', 'unit', 'total']}
      />
    </div>
  );
}

function GradeItens({ title, rows, testId, columns }) {
  return (
    <div className="border border-sky-100 rounded-md bg-white overflow-hidden flex flex-col min-h-[140px]" data-testid={testId}>
      <div className="px-3 py-1.5 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sky-900">{title}</h3>
        <Badge variant="secondary" className="text-[10px]">{rows.length}</Badge>
      </div>
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.includes('item') && <TableHead className="text-xs">Item</TableHead>}
              {columns.includes('descricao') && <TableHead className="text-xs">Descrição</TableHead>}
              {columns.includes('qtde') && <TableHead className="text-xs">Qtde</TableHead>}
              {columns.includes('un') && <TableHead className="text-xs">Un.</TableHead>}
              {columns.includes('peso') && <TableHead className="text-xs">Peso (Kg)</TableHead>}
              {columns.includes('unit') && <TableHead className="text-xs">Valor Unit.</TableHead>}
              {columns.includes('total') && <TableHead className="text-xs text-right">Total</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-xs text-slate-400 text-center py-6">
                  Sem itens nesta grade para a seleção atual.
                </TableCell>
              </TableRow>
            ) : rows.map((item, idx) => (
              <TableRow key={item.id || `${idx}-${item.produto_id || item.descricao}`}>
                <TableCell className="text-xs font-mono">{item.codigo || item.produto_codigo || idx + 1}</TableCell>
                <TableCell className="text-xs">{item.descricao || item.nome || '—'}</TableCell>
                <TableCell className="text-xs">{item.quantidade ?? '—'}</TableCell>
                <TableCell className="text-xs">{item.unidade_sigla || item.unidade || '—'}</TableCell>
                {columns.includes('peso') && (
                  <TableCell className="text-xs">
                    {item.peso_kg ?? item.peso ?? '—'}
                  </TableCell>
                )}
                {columns.includes('unit') && (
                  <TableCell className="text-xs">{money(item.preco_unitario ?? item.valor_unitario)}</TableCell>
                )}
                <TableCell className="text-xs text-right font-medium">{money(item.total ?? item.subtotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function Cliente360Aside({
  clienteForView,
  groupId,
  empresaId,
  actorId,
  actorEmail,
  openHub,
  openChatbot,
  openEntregas,
  openContasReceber,
  runCentralAction,
  situacao,
  hasSelection,
  proposalMode,
}) {
  const podeAjustar = situacao?.id === 'PRODUCAO' || situacao?.id === 'ENTREGA' || situacao?.id === 'RETIRA';
  return (
    <aside className="h-full overflow-auto border-l border-sky-100 bg-white" data-block="central360-cliente-panel">
      <div className="px-3 py-2 border-b border-sky-100 flex items-center justify-between bg-sky-50">
        <h3 className="text-sm font-semibold text-sky-950">Cliente 360°</h3>
        <ChevronRight className="w-4 h-4 text-sky-600" aria-hidden />
      </div>
      {!clienteForView ? (
        <p className="text-xs text-slate-500 p-3">
          Selecione um orçamento/pedido para carregar o Cliente360 contextual (RBAC do módulo dono).
        </p>
      ) : (
        <Suspense fallback={<p className="p-3 text-xs text-slate-500">Carregando Cliente360…</p>}>
          <CentralCliente360Panel
            clienteId={clienteForView}
            groupId={groupId}
            empresaId={empresaId}
            actorId={actorId}
            actorEmail={actorEmail}
            token={readErpHttpSession()?.token || ''}
          />
        </Suspense>
      )}
      <div className="p-2 border-t border-sky-100 grid grid-cols-2 gap-1" data-block="central360-atalhos-comunicacao">
        <Button type="button" size="sm" variant="outline" className="text-xs" onClick={openHub} data-action="central360-com-atendimento">
          Atendimento
        </Button>
        <Button type="button" size="sm" variant="outline" className="text-xs" onClick={openChatbot} data-action="central360-com-chatbot">
          Chatbot
        </Button>
        <Button type="button" size="sm" variant="outline" className="text-xs" disabled title="E-mail: use o provedor conectado do Hub" data-action="central360-com-email">
          E-mail
        </Button>
        <Button type="button" size="sm" variant="outline" className="text-xs" disabled title="GoTo: apenas com provedor conectado" data-action="central360-com-goto">
          GoTo
        </Button>
      </div>
      <div className="p-2 border-t border-sky-100 space-y-1.5" data-block="central360-acoes-rapidas">
        <p className="text-[11px] font-semibold text-sky-950 px-0.5">Ações Rápidas</p>
        <div className="grid grid-cols-2 gap-1">
          <QuickAction
            icon={Printer}
            label="Imprimir"
            action="central360-qa-imprimir"
            disabled={!hasSelection || proposalMode}
            onClick={() => runCentralAction('central360-imprimir', 'Selecione um documento e use Imprimir na barra ABERTO.')}
          />
          <QuickAction
            icon={FileText}
            label="Enviar"
            action="central360-qa-enviar"
            disabled={!hasSelection || proposalMode}
            onClick={() => runCentralAction('central360-enviar', 'Selecione um documento e use Enviar na barra ABERTO.')}
          />
          <QuickAction
            icon={CheckCircle2}
            label="Fechar Orç."
            action="central360-qa-fechar"
            disabled={!hasSelection || situacao?.kind !== 'orcamento' || proposalMode}
            onClick={() => runCentralAction('central360-fechar-orcamento', 'Fechar Orçamento só na visão Orçamentos em Aberto com seleção.')}
          />
          <QuickAction
            icon={Scissors}
            label="Desmembrar"
            action="central360-qa-desmembrar"
            disabled={!hasSelection || proposalMode}
            title="Abre Mais Ações (item Desmembrar fica no menu — não está no DOM fechado)"
            onClick={() => runCentralAction('central360-mais-acoes', 'Abra Mais Ações na barra do documento para Desmembrar.')}
          />
          <QuickAction
            icon={Package}
            label="Ajustar Pedido"
            action="central360-qa-ajustar"
            disabled={!podeAjustar || proposalMode}
            title={podeAjustar ? 'Disponível em Produção/Entrega/Retira' : 'Somente Produção, Entrega ou Retira'}
            onClick={() => toast.message('Ajuste o pedido na superfície da situação ativa (Produção/Entrega/Retira).')}
          />
          <QuickAction
            icon={Wallet}
            label="Contas a Receber"
            action="central360-qa-cr"
            disabled={proposalMode}
            onClick={openContasReceber}
          />
          <QuickAction
            icon={MapPinned}
            label="Entregas"
            action="central360-qa-entregas"
            disabled={proposalMode}
            onClick={openEntregas}
          />
          <QuickAction
            icon={History}
            label="Mais Ações"
            action="central360-qa-mais"
            disabled={!hasSelection || proposalMode}
            onClick={() => runCentralAction('central360-mais-acoes', 'Abra Mais Ações na barra do documento.')}
          />
        </div>
        <p className="text-[10px] text-slate-400 px-0.5 leading-snug">
          Ações de documento reutilizam a toolbar existente. Faturamento/baixa HTTP na HML: aguarda promote Codex.
        </p>
      </div>
    </aside>
  );
}

/** @param {{ icon: any, label: string, onClick: () => void, action: string, disabled?: boolean, title?: string }} props */
function QuickAction({ icon: Icon, label, onClick, action, disabled = false, title = undefined }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-action={action}
      title={title || label}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition
        ${disabled
          ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
          : 'border-sky-100 bg-white hover:bg-sky-50 text-sky-950'}`}
    >
      <Icon className="w-3.5 h-3.5 text-sky-700 shrink-0" />
      <span className="truncate">{label}</span>
      {!disabled && String(action || '').includes('mais') ? (
        <MoreHorizontal className="w-3 h-3 ml-auto text-slate-400" />
      ) : null}
    </button>
  );
}

export function FaixaTile({ icon: Icon, label, badge = null, onClick, action, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-action={action}
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition
        ${disabled
          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
          : 'border-sky-100 bg-white hover:bg-sky-50 text-sky-950'}`}
    >
      <Icon className="w-4 h-4 text-sky-700 shrink-0" />
      <span className="font-medium">{label}</span>
      {badge ? <Badge className="bg-rose-600 text-white text-[10px] ml-1">{badge}</Badge> : null}
    </button>
  );
}

