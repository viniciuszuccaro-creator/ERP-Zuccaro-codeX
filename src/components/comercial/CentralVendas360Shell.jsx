import React, { Suspense, useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  ChevronRight,
  LayoutDashboard,
  MapPinned,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Search,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useWindow } from '@/components/lib/useWindow';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { readErpHttpSession } from '@/api/erpHttpSession';
import {
  CENTRAL_VENDAS360_COLUMNS,
  CENTRAL_VENDAS360_DEFAULT_SITUACAO,
  CENTRAL_VENDAS360_SITUACOES,
  CENTRAL_VENDAS360_TITLE,
  partitionCentralItens,
  situacaoById,
  sumCentralPesoKg,
} from './centralVendas360Layout';

const OrcamentosTab = React.lazy(() => import('./OrcamentosTab'));
const PedidoCanonicoPanel = React.lazy(() => import('./PedidoCanonicoPanel'));
const CentralCliente360Panel = React.lazy(() => import('./CentralCliente360Panel'));
const CentralAprovacoesManager = React.lazy(() => import('./CentralAprovacoesManager'));
const PedidosEntregaTab = React.lazy(() => import('./PedidosEntregaTab'));

const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};

const dateLabel = (value) => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
  } catch {
    return '—';
  }
};

function GradesSimultaneas({ itens, hasSelection = false }) {
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
          Documento selecionado sem itens carregados — aguarde a hidratação do clique. Duplo clique só abre edição após hidratar itens; use Visualizar se a sessão não permitir GET. Grades vazias não significam estoque zerado.
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

/**
 * Shell visual versão 6 sobre OrcamentosTab + PedidoCanonicoPanel + CentralCliente360Panel.
 * Não cria Central paralela; só reorganiza o lançamento Pedidos → Central de Vendas360°.
 */
export default function CentralVendas360Shell({
  groupId,
  empresaId,
  actorId,
  actorEmail,
  hasPermission,
  filterInContext,
  empresas,
  empresaAtual,
  windowMode = false,
  proposalMode = false,
  canonicalHttp = true,
  ...rest
}) {
  const { openWindow } = useWindow();
  const { grupoAtual, contexto } = useContextoVisual();
  const [situacaoId, setSituacaoId] = useState(CENTRAL_VENDAS360_DEFAULT_SITUACAO);
  const [universalSearch, setUniversalSearch] = useState('');
  const [clientePanelOpen, setClientePanelOpen] = useState(true);
  const [selected, setSelected] = useState(null);
  const [selectedClienteId, setSelectedClienteId] = useState(null);

  const situacao = situacaoById(proposalMode ? CENTRAL_VENDAS360_DEFAULT_SITUACAO : situacaoId);
  const contextoLabel = empresaAtual?.nome_fantasia
    || empresaAtual?.razao_social
    || grupoAtual?.nome
    || (contexto === 'grupo' ? 'Grupo' : 'Empresa');

  const onSelectDocument = useCallback((row, meta = {}) => {
    setSelected(row || null);
    setSelectedClienteId(meta.clienteId || row?.cliente_id || null);
  }, []);

  const openHub = () => {
    void import('@/pages/HubAtendimento').then((mod) => {
      openWindow(mod.default, { windowMode: true }, {
        title: 'Atendimento Unificado',
        width: 1400,
        height: 850,
        uniqueKey: 'central360-hub-atendimento',
      });
    });
  };

  const openChatbot = () => {
    void import('@/pages/ChatbotAtendimento').then((mod) => {
      openWindow(mod.default, { windowMode: true }, {
        title: 'Bot Vendas',
        width: 1200,
        height: 800,
        uniqueKey: 'central360-bot-vendas',
      });
    });
  };

  const openEntregas = () => {
    openWindow(PedidosEntregaTab, { windowMode: true, groupId, empresaId }, {
      title: 'Entregas do Dia',
      width: 1400,
      height: 850,
      uniqueKey: 'central360-entregas-dia',
    });
  };

  const openAprovacoes = () => {
    openWindow(CentralAprovacoesManager, { windowMode: true, groupId, empresaId }, {
      title: 'Aprovações pendentes',
      width: 1400,
      height: 800,
      uniqueKey: 'central360-aprovacoes',
    });
  };

  const pesoSelecionado = sumCentralPesoKg(selected?.itens);
  const mainPanel = (
    <div className="w-full h-full min-h-0 flex flex-col gap-2 overflow-hidden">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-slate-500">Carregando superfície…</div>}>
        {situacao.kind === 'orcamento' ? (
          <OrcamentosTab
            groupId={groupId}
            empresaId={empresaId}
            actorId={actorId}
            actorEmail={actorEmail}
            sessionToken={rest.sessionToken}
            empresaAtual={empresaAtual}
            hasPermission={hasPermission}
            filterInContext={filterInContext}
            proposalMode={proposalMode}
            windowMode={windowMode}
            centralLayout
            centralSituacao={situacao.id}
            centralSearch={universalSearch}
            onCentralSelect={onSelectDocument}
            selectedCentralId={selected?.id || null}
          />
        ) : (
          <PedidoCanonicoPanel
            groupId={groupId}
            empresaId={empresaId}
            actorId={actorId}
            actorEmail={actorEmail}
            sessionToken={rest.sessionToken}
            hasPermission={hasPermission}
            filterInContext={filterInContext}
            empresaAtual={empresaAtual}
            windowMode={windowMode}
            centralLayout
            centralSituacao={situacao.id}
            centralSearch={universalSearch}
            onCentralSelect={onSelectDocument}
            selectedCentralId={selected?.id || null}
          />
        )}
      </Suspense>
      <GradesSimultaneas itens={selected?.itens} hasSelection={Boolean(selected?.id)} />
      {selected && (
        <div className="text-[11px] text-slate-500 px-1 flex flex-wrap gap-3" data-block="central360-selecao-meta" role="status">
          <span>Selecionado: <strong className="font-mono text-sky-900">{selected.numero || selected.id}</strong></span>
          <span>Peso: {pesoSelecionado == null ? '—' : `${pesoSelecionado} kg`}</span>
          <span className="text-slate-400">Clique simples seleciona e hidrata itens · duplo clique edita · seleção não grava</span>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`w-full h-full flex flex-col bg-slate-50 text-slate-900 ${windowMode ? 'p-2' : 'p-3'}`}
      data-permission="Comercial.pedido.visualizar"
      data-block="central-vendas-360"
      data-layout="versao6"
      data-proposta={proposalMode ? 'comercial360' : undefined}
    >
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-center gap-3 mb-2" data-block="central360-cabecalho">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-md bg-sky-700 text-white p-2 shrink-0" aria-hidden>
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-sky-950 truncate">{CENTRAL_VENDAS360_TITLE}</h2>
            <p className="text-xs text-slate-500 truncate" data-block="central360-contexto">
              Contexto autorizado: {contextoLabel}
              {groupId ? ` · grupo ${String(groupId).slice(0, 8)}…` : ''}
              {empresaId ? ` · empresa ${String(empresaId).slice(0, 8)}…` : ''}
            </p>
          </div>
        </div>
        <form
          className="flex-1 min-w-[200px] flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); }}
          data-block="central360-pesquisa-universal"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={universalSearch}
              onChange={(e) => setUniversalSearch(e.target.value.slice(0, 80))}
              placeholder="Pesquisar cliente, CNPJ, nº orçamento/pedido…"
              className="pl-8 bg-white border-sky-100"
              aria-label="Pesquisa universal da Central"
              maxLength={80}
            />
          </div>
        </form>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-sky-200"
          onClick={() => setClientePanelOpen((v) => !v)}
          data-action="central360-toggle-cliente360"
          title={clientePanelOpen ? 'Recolher Cliente360' : 'Expandir Cliente360'}
        >
          {clientePanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          <span className="ml-1 hidden sm:inline">Cliente360</span>
        </Button>
      </header>

      {/* Faixa compacta */}
      <div
        className="flex flex-wrap gap-2 mb-2"
        data-block="central360-faixa-compacta"
        role="toolbar"
        aria-label="Atalhos da Central"
      >
        <FaixaTile icon={MessageCircle} label="Atendimento Unificado" onClick={openHub} action="central360-atendimento" />
        <FaixaTile icon={Bot} label="Bot Vendas" badge="exceções" onClick={openChatbot} action="central360-bot" />
        <FaixaTile icon={MapPinned} label="Entregas do Dia" onClick={openEntregas} action="central360-entregas" disabled={proposalMode} />
        <FaixaTile icon={ShieldCheck} label="Aprovações pendentes" onClick={openAprovacoes} action="central360-aprovacoes" disabled={proposalMode} />
      </div>

      {proposalMode && (
        <Alert className="mb-2 border-sky-200 bg-sky-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Proposta visual — situação fixa em Orçamentos em Aberto (sintético). Faixa operacional não grava.
          </AlertDescription>
        </Alert>
      )}

      {/* Situações */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2" role="tablist" aria-label="Situações" data-block="central360-situacoes">
        {CENTRAL_VENDAS360_SITUACOES.map((s) => {
          const active = situacao.id === s.id;
          const blocked = proposalMode && s.id !== CENTRAL_VENDAS360_DEFAULT_SITUACAO;
          return (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              className={active ? 'bg-sky-700 hover:bg-sky-800' : 'bg-white border-sky-100'}
              role="tab"
              aria-selected={active}
              disabled={blocked}
              data-action={`central360-situacao-${s.id}`}
              onClick={() => {
                if (blocked) return;
                setSituacaoId(s.id);
                setSelected(null);
                setSelectedClienteId(null);
              }}
            >
              {s.label}
            </Button>
          );
        })}
        <Badge variant="outline" className="ml-auto text-[10px] border-sky-200 text-sky-800 hidden md:inline-flex">
          <LayoutDashboard className="w-3 h-3 mr-1" />
          Visão: {situacao.label}
        </Badge>
      </div>

      {/* Centro + Cliente360 */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="w-full h-full rounded-md border border-sky-100 bg-white">
          <ResizablePanel defaultSize={clientePanelOpen ? 72 : 100} minSize={45}>
            <div className="h-full overflow-hidden p-2">{mainPanel}</div>
          </ResizablePanel>
          {clientePanelOpen && (
            <>
              <ResizableHandle withHandle className="bg-sky-50" />
              <ResizablePanel defaultSize={28} minSize={18} maxSize={42}>
                <aside className="h-full overflow-auto border-l border-sky-100 bg-white" data-block="central360-cliente-panel">
                  <div className="px-3 py-2 border-b border-sky-100 flex items-center justify-between bg-sky-50">
                    <h3 className="text-sm font-semibold text-sky-950">Cliente 360°</h3>
                    <ChevronRight className="w-4 h-4 text-sky-600" aria-hidden />
                  </div>
                  {!selectedClienteId ? (
                    <p className="text-xs text-slate-500 p-3">
                      Selecione um orçamento/pedido para carregar o Cliente360 contextual (RBAC do módulo dono).
                    </p>
                  ) : (
                    <Suspense fallback={<p className="p-3 text-xs text-slate-500">Carregando Cliente360…</p>}>
                      <CentralCliente360Panel
                        clienteId={selectedClienteId}
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
                </aside>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Referência das 12 colunas (contrato visual — tabela operacional nos painéis embutidos) */}
      <div className="sr-only" data-block="central360-colunas-contrato" aria-hidden>
        {CENTRAL_VENDAS360_COLUMNS.map((c) => c.label).join(' | ')}
      </div>
    </div>
  );
}

function FaixaTile({ icon: Icon, label, badge = null, onClick, action, disabled = false }) {
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
