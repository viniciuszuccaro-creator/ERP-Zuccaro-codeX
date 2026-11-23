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
  // null/'' ≠ zero confirmado (alinha sticky: ausente → "—").
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};


const itemDescontoLabel = (item) => {
  const raw = item?.desconto ?? item?.valor_desconto ?? item?.percentual_desconto;
  if (raw === null || raw === undefined || raw === '') return '—';
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return '—';
  // Percentual tipicamente 0–100; valores monetários usam o mesmo formatador.
  if (n > 0 && n <= 100 && (item?.percentual_desconto != null || String(raw).includes('%'))) {
    return `${n}%`;
  }
  return money(n);
};

export function GradesSimultaneas({ itens, hasSelection = false }) {
  const list = Array.isArray(itens) ? itens : [];
  const { corte, revenda } = useMemo(() => partitionCentralItens(list), [list]);
  const semItensCarregados = hasSelection && list.length === 0;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-[160px]" data-block="central360-grades-simultaneas">
      {semItensCarregados ? (
        <div
          className="lg:col-span-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"
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
        columns={['item', 'descricao', 'qtde', 'un', 'peso', 'unit', 'desc', 'total']}
      />
      <GradeItens
        title="Materiais de Revenda"
        rows={revenda}
        testId="central360-grade-revenda"
        columns={['item', 'descricao', 'qtde', 'un', 'unit', 'desc', 'total']}
      />
    </div>
  );
}

function GradeItens({ title, rows, testId, columns }) {
  const colCount = columns.length;
  return (
    <div className="border border-sky-200 rounded-md bg-white overflow-hidden flex flex-col min-h-[140px]" data-testid={testId}>
      <div className="px-3 py-1.5 bg-sky-50 border-b border-sky-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-sky-950">{title}</h3>
        <Badge variant="secondary" className="text-[10px] tabular-nums">{rows.length}</Badge>
      </div>
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.includes('item') && <TableHead className="text-xs text-slate-600">Item</TableHead>}
              {columns.includes('descricao') && <TableHead className="text-xs text-slate-600">Descrição</TableHead>}
              {columns.includes('qtde') && <TableHead className="text-xs text-slate-600 text-right">Qtde</TableHead>}
              {columns.includes('un') && <TableHead className="text-xs text-slate-600">Un.</TableHead>}
              {columns.includes('peso') && <TableHead className="text-xs text-slate-600 text-right">Peso (Kg)</TableHead>}
              {columns.includes('unit') && <TableHead className="text-xs text-slate-600 text-right">Unit.</TableHead>}
              {columns.includes('desc') && <TableHead className="text-xs text-slate-600 text-right">Desc.</TableHead>}
              {columns.includes('total') && <TableHead className="text-xs text-slate-600 text-right">Total</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-xs text-slate-500 text-center py-6">
                  Sem itens nesta grade para a seleção atual.
                </TableCell>
              </TableRow>
            ) : rows.map((item, idx) => (
              <TableRow key={item.id || `${idx}-${item.produto_id || item.descricao}`} className="odd:bg-white even:bg-slate-50/60">
                <TableCell className="text-xs font-mono text-slate-800">{item.codigo || item.produto_codigo || idx + 1}</TableCell>
                <TableCell className="text-xs text-slate-900">{item.descricao || item.nome || '—'}</TableCell>
                <TableCell className="text-xs tabular-nums text-right text-slate-900">{item.quantidade ?? '—'}</TableCell>
                <TableCell className="text-xs font-medium uppercase text-slate-800">{item.unidade_sigla || item.unidade || '—'}</TableCell>
                {columns.includes('peso') && (
                  <TableCell className="text-xs tabular-nums text-right text-slate-800">
                    {item.peso_kg ?? item.peso ?? '—'}
                  </TableCell>
                )}
                {columns.includes('unit') && (
                  <TableCell className="text-xs tabular-nums text-right text-slate-900">{money(item.preco_unitario ?? item.valor_unitario)}</TableCell>
                )}
                {columns.includes('desc') && (
                  <TableCell className="text-xs tabular-nums text-right text-slate-800">{itemDescontoLabel(item)}</TableCell>
                )}
                <TableCell className="text-xs tabular-nums text-right font-semibold text-sky-950">{money(item.total ?? item.subtotal)}</TableCell>
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
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1
        ${disabled
          ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
          : 'border-sky-100 bg-white hover:bg-sky-50 text-sky-950'}`}
    >
      <Icon className="w-3.5 h-3.5 text-sky-700 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      {!disabled && String(action || '').includes('mais') ? (
        <MoreHorizontal className="w-3 h-3 ml-auto text-slate-400" aria-hidden />
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
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1
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

