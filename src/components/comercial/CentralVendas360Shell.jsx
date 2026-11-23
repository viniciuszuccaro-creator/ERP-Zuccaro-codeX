import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
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
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useWindow } from '@/components/lib/useWindow';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { canUsePedidoAction } from './pedidoUiPolicy';
import { canUseOrcamentoAction } from './orcamentoUiPolicy';
import {
  CENTRAL_VENDAS360_COLUMNS,
  CENTRAL_VENDAS360_DEFAULT_SITUACAO,
  CENTRAL_VENDAS360_SITUACOES,
  CENTRAL_VENDAS360_TITLE,
  invokeCentralDataAction,
  partitionCentralItens,
  resolveCentralFluxoState,
  situacaoById,
  sumCentralPesoKg,
} from './centralVendas360Layout';
import { Cliente360Aside, FaixaTile, GradesSimultaneas } from './CentralVendas360ShellParts';

const OrcamentosTab = React.lazy(() => import('./OrcamentosTab'));
const PedidoCanonicoPanel = React.lazy(() => import('./PedidoCanonicoPanel'));
// Janelas externas: import dinâmico no clique (não passar React.lazy a openWindow — suspende fora de Suspense).

const money = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
};

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
  /** Epoch da seleção na Central: troca de situação invalida GET tardio do painel desmontado. */
  const selectionEpochRef = useRef(0);
  const [selectionEpoch, setSelectionEpoch] = useState(0);
  // Uma montagem: em viewport estreita empilha (vertical); desktop mantém split horizontal.
  const [stackPanels, setStackPanels] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width: 1023px)');
    const sync = () => setStackPanels(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  const situacao = situacaoById(proposalMode ? CENTRAL_VENDAS360_DEFAULT_SITUACAO : situacaoId);
  const canViewDocument = situacao.kind === 'orcamento'
    ? canUseOrcamentoAction(hasPermission, 'visualizar')
    : canUsePedidoAction(hasPermission, 'visualizar');
  const canViewDocumentRef = useRef(canViewDocument);
  canViewDocumentRef.current = canViewDocument;
  const selectionForView = canViewDocument ? selected : null;
  const clienteForView = canViewDocument ? selectedClienteId : null;
  const contextoLabel = empresaAtual?.nome_fantasia
    || empresaAtual?.razao_social
    || grupoAtual?.nome
    || (contexto === 'grupo' ? 'Grupo' : 'Empresa');

  const onSelectDocument = useCallback((row, meta = {}) => {
    if (!canViewDocumentRef.current) return;
    // Epoch obrigatório: loadCentralDetail/Fechar sem epoch não pode preencher grades após troca de situação.
    if (typeof meta.selectionEpoch !== 'number' || meta.selectionEpoch !== selectionEpochRef.current) return;
    const withNome = row && meta.clienteNome && !row.cliente_nome && !row.nome_cliente
      ? { ...row, cliente_nome: meta.clienteNome, nome_cliente: meta.clienteNome }
      : row;
    setSelected(withNome || null);
    setSelectedClienteId(meta.clienteId || row?.cliente_id || null);
  }, []);

  useEffect(() => {
    if (canViewDocument) return;
    // Revogação encerra a geração, mesmo se a permissão voltar no mesmo contexto.
    const nextEpoch = selectionEpochRef.current + 1;
    selectionEpochRef.current = nextEpoch;
    setSelectionEpoch(nextEpoch);
    setSelected(null);
    setSelectedClienteId(null);
  }, [canViewDocument]);
  // Token vivo: Comercial pode não passar sessionToken (Bugbot) — ler sessão canônica.
  const sessionIdentity = rest.sessionToken || readErpHttpSession()?.token || null;

  // Security: grupo/empresa/ator/sessão — limpar pagamento-resumo e Cliente360 (≠ só situação).
  useEffect(() => {
    const nextEpoch = selectionEpochRef.current + 1;
    selectionEpochRef.current = nextEpoch;
    setSelectionEpoch(nextEpoch);
    setSelected(null);
    setSelectedClienteId(null);
  }, [groupId, empresaId, actorId, sessionIdentity]);

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
    void import('./PedidosEntregaTab').then((mod) => {
      openWindow(mod.default, { windowMode: true, groupId, empresaId }, {
        title: 'Entregas do Dia',
        width: 1400,
        height: 850,
        uniqueKey: 'central360-entregas-dia',
      });
    });
  };

  const openAprovacoes = () => {
    void import('./CentralAprovacoesManager').then((mod) => {
      openWindow(mod.default, { windowMode: true, groupId, empresaId }, {
        title: 'Aprovações pendentes',
        width: 1400,
        height: 800,
        uniqueKey: 'central360-aprovacoes',
      });
    });
  };

  const pesoSelecionado = sumCentralPesoKg(selectionForView?.itens);
  const fluxo = useMemo(
    () => resolveCentralFluxoState(situacao, selectionForView),
    [situacao, selectionForView],
  );
  const clienteNome = (() => {
    const row = selectionForView;
    if (!row) return null;
    const fromFields = row.cliente_nome || row.nome_cliente
      || (typeof row.cliente === 'string' ? row.cliente : null);
    if (typeof fromFields === 'string' && fromFields.trim()) return fromFields.trim();
    if (row.cliente && typeof row.cliente === 'object') {
      const nested = row.cliente.nome_fantasia || row.cliente.razao_social
        || row.cliente.nome || row.cliente.name;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
    return null;
  })();
  const localOuObraLabel = (() => {
    const row = selectionForView;
    if (!row) return null;
    const localNome = [row.cliente_local_nome, row.local_nome, row.local_entrega_nome]
      .find((v) => typeof v === 'string' && v.trim());
    const obraNome = [row.obra_nome, row.nome_obra]
      .find((v) => typeof v === 'string' && v.trim());
    if (localNome) return `Local ${localNome.trim()}`;
    if (obraNome) return `Obra ${obraNome.trim()}`;
    if (row.cliente_local_id) return 'Local definido';
    if (row.obra_id) return 'Obra definida';
    return null;
  })();
  const proximaAcaoLabel = situacao.kind === 'orcamento'
    ? (selectionForView?.status === 'EM_ABERTO' ? 'Fechar Orçamento' : 'Reabrir / editar documento')
    : (situacao.id === 'PRODUCAO' || situacao.id === 'ENTREGA' || situacao.id === 'RETIRA'
      ? 'Ajustar Pedido (tela da situação)'
      : fluxo.nextLabel);

  const proximaAcaoKey = situacao.kind === 'orcamento' && selectionForView?.status === 'EM_ABERTO'
    ? 'central360-fechar-orcamento'
    : null;

  const runCentralAction = useCallback((action, fallbackMessage) => {
    const ok = invokeCentralDataAction(action);
    if (!ok) {
      toast.message(fallbackMessage || 'Ação indisponível nesta visão ou sem seleção.');
    }
  }, []);

  const runProximaAcao = useCallback(() => {
    if (!selectionForView) {
      toast.message('Selecione um orçamento ou pedido para a próxima ação.');
      return;
    }
    if (proximaAcaoKey) {
      runCentralAction(proximaAcaoKey, 'Fechar Orçamento só na visão Orçamentos em Aberto com seleção.');
      return;
    }
    toast.message(`${proximaAcaoLabel} — use a faixa de situação ou a toolbar do documento.`);
  }, [selectionForView, proximaAcaoKey, proximaAcaoLabel, runCentralAction]);

  const openContasReceber = () => {
    void import('@/components/financeiro/ContasReceberTab').then((mod) => {
      openWindow(mod.default, { windowMode: true }, {
        title: 'Contas a Receber',
        width: 1400,
        height: 850,
        uniqueKey: 'central360-contas-receber',
      });
    });
  };

  const mainPanel = (
    <div className="w-full h-full min-h-0 flex flex-col gap-2 overflow-hidden">
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-sm text-slate-500" role="status">Carregando superfície…</div>}>
        {situacao.kind === 'orcamento' ? (
          <OrcamentosTab
            groupId={groupId}
            empresaId={empresaId}
            actorId={actorId}
            actorEmail={actorEmail}
            sessionToken={sessionIdentity}
            empresaAtual={empresaAtual}
            hasPermission={hasPermission}
            filterInContext={filterInContext}
            proposalMode={proposalMode}
            windowMode={windowMode}
            centralLayout
            centralSituacao={situacao.id}
            centralSearch={universalSearch}
            selectionEpoch={selectionEpoch}
            onCentralSelect={onSelectDocument}
            selectedCentralId={selectionForView?.id || null}
          />
        ) : (
          <PedidoCanonicoPanel
            groupId={groupId}
            empresaId={empresaId}
            actorId={actorId}
            actorEmail={actorEmail}
            sessionToken={sessionIdentity}
            hasPermission={hasPermission}
            filterInContext={filterInContext}
            empresaAtual={empresaAtual}
            windowMode={windowMode}
            centralLayout
            centralSituacao={situacao.id}
            centralSearch={universalSearch}
            selectionEpoch={selectionEpoch}
            onCentralSelect={onSelectDocument}
            selectedCentralId={selectionForView?.id || null}
          />
        )}
      </Suspense>
      <GradesSimultaneas itens={selectionForView?.itens} hasSelection={Boolean(selectionForView?.id)} />
      {selectionForView && (
        <div
          className="rounded-md border border-sky-200 bg-white px-3 py-2 text-xs text-slate-700 flex flex-wrap gap-x-4 gap-y-1"
          data-block="central360-pagamento-resumo"
          role="status"
        >
          {/* Condição/Total ficam na sticky — aqui só complementos para reduzir leitura duplicada. */}
          <span>
            Tabela:{' '}
            <strong className={selectionForView.tabela_preco_id ? 'text-sky-950' : 'text-slate-500'}>
              {selectionForView.tabela_preco_id
                ? (
                  selectionForView.tabela_preco_codigo
                  || selectionForView.tabela_preco_nome
                  || selectionForView.tabela_preco_label
                  || 'definida (id canônico)'
                )
                : 'não informada nesta seleção'}
            </strong>
          </span>
          <span>
            Operação:{' '}
            <strong className="text-sky-950">
              {selectionForView.tipo_operacao === 'ENTREGA'
                ? 'Entrega'
                : selectionForView.tipo_operacao === 'RETIRADA'
                  ? 'Retirada'
                  : (selectionForView.tipo_operacao || '—')}
            </strong>
          </span>
          {!selectionForView.condicao_pagamento_id ? (
            <span className="text-amber-900 font-medium" data-block="central360-pagamento-condicao-alerta">
              Condição pendente — bloqueia Fechar
            </span>
          ) : null}
          {selectionForView.total == null && selectionForView.total !== 0 ? (
            <span className="text-amber-900 font-medium">Total não hidratado (≠ zero)</span>
          ) : null}
          <span>
            Parcelas:{' '}
            <strong className="tabular-nums text-sky-950">
              {Array.isArray(selectionForView.parcelas)
                ? `${selectionForView.parcelas.length} no documento`
                : 'não carregadas nesta seleção'}
            </strong>
          </span>
          <span data-block="central360-pagamento-itens">
            Itens:{' '}
            <strong className="tabular-nums text-sky-950">
              {Array.isArray(selectionForView.itens)
                ? (() => {
                  const { corte, revenda } = partitionCentralItens(selectionForView.itens);
                  return `${selectionForView.itens.length} (corte ${corte.length} · revenda ${revenda.length})`;
                })()
                : 'não hidratados nesta seleção'}
            </strong>
          </span>
          <span className="text-slate-500 w-full sm:w-auto sm:ml-auto" data-block="central360-pagamento-dica">
            Fechar orçamento ≠ cancelar ≠ fechar janela.
          </span>
        </div>
      )}
      {selectionForView && (
        <div className="text-[11px] text-slate-500 px-1 flex flex-wrap gap-3" data-block="central360-selecao-meta" role="status">
          <span>Selecionado: <strong className="font-mono text-sky-900">{selectionForView.numero || selectionForView.id}</strong></span>
          <span>Peso: {pesoSelecionado == null ? '—' : `${pesoSelecionado} kg`}</span>
          <span className="text-slate-400">Clique simples seleciona e hidrata itens · duplo clique edita após GET · seleção não grava</span>
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
                const nextEpoch = selectionEpochRef.current + 1;
                selectionEpochRef.current = nextEpoch;
                setSelectionEpoch(nextEpoch);
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

      {/* Contexto da venda — sempre visível durante a operação */}
      <div
        className="mb-2 sticky top-0 z-10 rounded-md border border-sky-200 bg-white/95 backdrop-blur px-3 py-2 shadow-sm"
        data-block="central360-contexto-venda"
        role="status"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
          <span>Empresa: <strong className="text-sky-950">{contextoLabel}</strong></span>
          <span>
            Cliente:{' '}
            <strong className={clienteNome ? 'text-sky-950' : 'text-slate-400'}>
              {clienteNome || (selectionForView ? 'sem nome na seleção' : 'selecione um documento')}
            </strong>
          </span>
          <span data-block="central360-contexto-local-obra">
            Obra/Local:{' '}
            <strong className={localOuObraLabel ? 'text-sky-950' : (selectionForView ? 'text-amber-800' : 'text-slate-400')}>
              {localOuObraLabel
                || (selectionForView
                  ? (selectionForView.tipo_operacao === 'RETIRADA' ? 'Retirada (sem local)' : 'pendente na seleção')
                  : '—')}
            </strong>
          </span>
          <span>
            Condição:{' '}
            <strong className={selectionForView?.condicao_pagamento_id ? 'text-sky-950' : 'text-amber-800'}>
              {selectionForView?.condicao_pagamento_id
                ? (selectionForView.condicao_pagamento_nome || selectionForView.condicao_pagamento_codigo || 'definida')
                : (selectionForView ? 'pendente' : '—')}
            </strong>
          </span>
          <span>
            Total:{' '}
            <strong className="font-mono text-sky-950">
              {selectionForView
                ? (selectionForView.total == null && selectionForView.total !== 0 ? '—' : money(selectionForView.total))
                : '—'}
            </strong>
          </span>
          <Button
            type="button"
            variant={proximaAcaoKey ? 'default' : 'outline'}
            size="sm"
            className="ml-auto h-7 px-2.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            data-block="central360-proxima-acao"
            disabled={!selectionForView}
            onClick={runProximaAcao}
            aria-label={selectionForView ? `Próxima ação: ${proximaAcaoLabel}` : 'Selecione um orçamento ou pedido'}
          >
            {selectionForView ? proximaAcaoLabel : 'Selecione um orçamento/pedido'}
            <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-70" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Fluxo do pedido (visual — status do backend / situação da faixa) */}
      <nav
        className="mb-2 overflow-x-auto"
        data-block="central360-fluxo-pedido"
        aria-label="Fluxo do pedido"
      >
        <ol className="flex items-center gap-1 min-w-max px-1">
          {fluxo.steps.map((step, idx) => {
            const done = idx < fluxo.activeIndex;
            const active = idx === fluxo.activeIndex;
            return (
              <li key={step.id} className="flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border
                    ${active ? 'bg-sky-700 text-white border-sky-700'
                      : done ? 'bg-sky-50 text-sky-900 border-sky-200'
                        : 'bg-white text-slate-400 border-slate-200'}`}
                  data-fluxo-step={step.id}
                  data-fluxo-state={active ? 'ativo' : done ? 'feito' : 'pendente'}
                >
                  {done || active ? <CheckCircle2 className="w-3 h-3" aria-hidden /> : null}
                  {step.label}
                </span>
                {idx < fluxo.steps.length - 1 ? (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Centro + Cliente360 — uma única montagem (P1: sem cópia desktop/mobile). */}
      <div className="flex-1 min-h-0" data-block="central360-superficie-unica">
        <ResizablePanelGroup
          direction={stackPanels ? 'vertical' : 'horizontal'}
          className="w-full h-full rounded-md border border-sky-100 bg-white"
        >
          <ResizablePanel
            defaultSize={clientePanelOpen ? (stackPanels ? 62 : 72) : 100}
            minSize={stackPanels ? 35 : 40}
          >
            <div className="h-full min-h-[240px] overflow-hidden p-2">{mainPanel}</div>
          </ResizablePanel>
          {clientePanelOpen ? (
            <>
              <ResizableHandle withHandle className="bg-sky-50" />
              <ResizablePanel
                defaultSize={stackPanels ? 38 : 28}
                minSize={stackPanels ? 22 : 18}
                maxSize={stackPanels ? 55 : 48}
              >
                <div className="h-full min-h-[200px] overflow-auto">
                  <Cliente360Aside
                    clienteForView={clienteForView}
                    groupId={groupId}
                    empresaId={empresaId}
                    actorId={actorId}
                    actorEmail={actorEmail}
                    openHub={openHub}
                    openChatbot={openChatbot}
                    openEntregas={openEntregas}
                    openContasReceber={openContasReceber}
                    runCentralAction={runCentralAction}
                    situacao={situacao}
                    hasSelection={Boolean(selectionForView)}
                    proposalMode={proposalMode}
                  />
                </div>
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>

      {/* Referência das 12 colunas (contrato visual — tabela operacional nos painéis embutidos) */}
      <div className="sr-only" data-block="central360-colunas-contrato" aria-hidden>
        {CENTRAL_VENDAS360_COLUMNS.map((c) => c.label).join(' | ')}
      </div>
    </div>
  );
}
