import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, Eye, FilePlus2, FileText, Mail, MessageCircle, Pencil, Plus, Printer, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import { createHttpApiClient } from '@/api/httpApiClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PaginationControls from '@/components/ui/PaginationControls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { buildOrcamentoPayload, buildOrcamentoShareText, calculateItem, calculateTotals, canUseOrcamentoAction, resolveOrcamentoPrintPermission, resolveOrcamentoSharePermission, evaluateItemLinesGate, evaluateOrcamentoConvertUiGate, evaluateOrcamentoPrintPdfUiGate, evaluateOrcamentoShareUiGate, evaluateOrcamentoValidadeUiGate, resolveOrcamentoDetailSummaryUiState, evaluateOrcamentoCancelMotivoUiGate, clampOrcamentoCancelMotivo, ORCAMENTO_CANCEL_MOTIVO_MAX, isOrcamentoValidadeExpirada, mapOrcamentoRowToForm, microsToDecimal, openComercialResumoTextoWindow, orcamentoValidadeHint, resolveOrcamentoResumoPreviewState } from './orcamentoUiPolicy';
import { evaluatePedidoDataEntregaUiGate } from './pedidoUiPolicy';
import {
  applySimulacaoToForm,
  assertParcelaScheduleFromSimulacao,
  assertPromocaoAplicadaOuFalhar,
  assertSimulacaoFreshForSave,
  assertSimulacaoNoContexto,
  buildSimularVendaPayload,
  buildSimulacaoPreviewState,
  canSimularVenda,
  collectPersistedCommercialSnapshots,
  evaluateSimulacaoDirtySaveGate,
  mergeSimulacaoBeforeSave,
  promoInputsFromPersistedSnapshot,
  resolveDisplayTotals,
  resolveParcelaScheduleUiState,
  shouldInvalidateSimulacaoOnFormKey,
} from './comercialSimulacaoUiPolicy';
import {
  applyResolvedCondicaoToForm,
  assertCondicaoResolucaoNoContexto,
  buildCondicaoSnapshotPreview,
  canLoadCondicoesPagamentoHttp,
  normalizeCondicoesListPayload,
} from './comercialCondicaoHttpUiPolicy';
import {
  applyResolvedPrecoToItem,
  assertPrecoResolucaoNoContexto,
} from './comercialTabelaPrecoHttpUiPolicy';
import {
  buildClienteDisplayLabel,
  normalizeClientesListPayload,
  normalizeUnidadesListPayload,
} from './comercialClienteHttpUiPolicy';
import {
  canLoadClienteEmpresasHttp,
  normalizeClienteEmpresasListPayload,
} from './comercialClienteEmpresaHttpUiPolicy';
import {
  buildProdutoDisplayLabel,
  canLoadProdutosHttp,
  normalizeProdutosListPayload,
} from './comercialProdutoHttpUiPolicy';
import {
  ORCAMENTO_LIST_FILTER_DEFAULTS,
  ORCAMENTO_LIST_CSV_COLUMNS,
  COMERCIAL_OBSERVACOES_MAX_LENGTH,
  bindComercialFormBeforeUnload,
  buildComercialBannerA11yProps,
  buildComercialListCsv,
  buildHttpListQueryKey,
  buildItemLineFieldA11y,
  buildItemLineHintId,
  buildMastersHttpBannerText,
  buildOrcamentoListRequestParams,
  buildOrcamentoTenantSwitchReset,
  buildSimularHttpErrorBannerText,
  clearComercialHttpCacheOnTenantSwitch,
  clampObservacoesInput,
  comercialActionAriaLabel,
  confirmComercialFormAbandon,
  downloadComercialCsvText,
  evaluateObservacoesUiGate,
  filterActiveMasterRowsKeepingSelection,
  formatComercialHttpError,
  formatHttpListEmptyMessage,
  formatMasterPickerOptionLabel,
  formatMasterPickerPlaceholder,
  hasActiveComercialListFilters,
  inactiveMasterSelectionHint,
  isComercialRetryableHttpError,
  isMasterPickerBlocked,
  mapOrcamentoRowsForCsv,
  normalizeOrcamentoListFilters,
  resolveComercialFormDialogOpenChange,
  resolveComercialListPageExportUi,
  resolveHttpListViewState,
  resolveHttpMasterPickerState,
  resolveComercialListBulkUiState,
  toggleComercialListPageSelection,
  toggleComercialListRowSelection,
} from './comercialListHttpUiPolicy';
import {
  beginSaveOnce,
  endSaveOnce,
  evaluateDescontoAlcadaUi,
} from './comercialDescontoAlcadaUiPolicy';
import {
  evaluateMargemAlcadaUi,
  resolveMargemCostLookupFromItems,
} from './comercialMargemAlcadaUiPolicy';
import { gerarPDFOrcamento } from '@/components/lib/exportacaoPDF';

const emptyItem = () => ({ produto_id: '', unidade_id: '', descricao: '', unidade_sigla: '', quantidade: '1', preco_unitario: '0', desconto: '0' });
const emptyForm = () => ({ cliente_empresa_id: '', condicao_pagamento_id: '', validade_em: '', observacoes: '', itens: [emptyItem()] });
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : '-';
const errorMessage = (error) => formatComercialHttpError(error, {
  entityLabel: 'Orçamento',
  conflictMessage: 'O orçamento foi alterado e não está mais em aberto.',
});

export default function OrcamentosTab({ groupId, empresaId, actorId, actorEmail, empresaAtual, hasPermission, filterInContext, windowMode = false }) {
  void filterInContext;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resumoOpen, setResumoOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [pendingConversion, setPendingConversion] = useState(null);
  const [conversion, setConversion] = useState({ tipo_operacao: 'ENTREGA', data_entrega_solicitada: '' });
  const [filters, setFilters] = useState(() => ({ ...ORCAMENTO_LIST_FILTER_DEFAULTS }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...ORCAMENTO_LIST_FILTER_DEFAULTS }));
  const [promoBps, setPromoBps] = useState('');
  const [promoCupom, setPromoCupom] = useState('');
  const [simulacaoPreview, setSimulacaoPreview] = useState(null);
  const [lastSimulation, setLastSimulation] = useState(null);
  const [simulacaoDirty, setSimulacaoDirty] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simularHttpError, setSimularHttpError] = useState(null);
  const [condicaoSnapshot, setCondicaoSnapshot] = useState(null);
  const [tabelaSnapshot, setTabelaSnapshot] = useState(null);
  const [promocaoSnapshot, setPromocaoSnapshot] = useState(null);
  const [resolvingCondicao, setResolvingCondicao] = useState(false);
  const [resolvingPreco, setResolvingPreco] = useState(false);
  const saveInFlightRef = useRef(false);
  const canView = canUseOrcamentoAction(hasPermission, 'visualizar');
  const canCreate = canUseOrcamentoAction(hasPermission, 'criar');
  const canEdit = (row) => canUseOrcamentoAction(hasPermission, 'editar', row?.status);
  const canCancel = (row) => canUseOrcamentoAction(hasPermission, 'cancelar', row?.status);
  const canSimular = canSimularVenda(hasPermission);
  const canPrint = resolveOrcamentoPrintPermission(hasPermission);
  const canShare = resolveOrcamentoSharePermission(hasPermission);
  const contextReady = Boolean(groupId && empresaId && actorId);
  const http = useMemo(() => createHttpApiClient({
    getScope: () => ({ groupId, empresaId, actorId, actorEmail }),
  }), [groupId, empresaId, actorId, actorEmail]);
  const api = http.orcamentos;
  const pedidosApi = http.pedidos;
  const comercialApi = http.comercial;
  const condicoesApi = http.condicoesPagamento;
  const tabelasApi = http.tabelasPreco;
  const clientesApi = http.clientes;
  const clienteEmpresasApi = http.clienteEmpresas;
  const unidadesApi = http.unidadesMedida;
  const produtosApi = http.produtos;
  const canConvert = hasPermission('Comercial', 'pedido', 'converter-pedido');
  const validadeUi = evaluateOrcamentoValidadeUiGate(form.validade_em);
  const validadeHint = validadeUi.hint;
  const selectedConvertGate = useMemo(
    () => evaluateOrcamentoConvertUiGate({
      row: selected,
      dirty,
      simulacaoDirty,
      editingId: editing?.id,
    }),
    [selected, dirty, simulacaoDirty, editing?.id],
  );
  const pendingConvertGate = useMemo(
    () => evaluateOrcamentoConvertUiGate({
      row: pendingConversion,
      dirty,
      simulacaoDirty,
      editingId: editing?.id,
    }),
    [pendingConversion, dirty, simulacaoDirty, editing?.id],
  );
  const conversionDataEntregaGate = evaluatePedidoDataEntregaUiGate({ tipoOperacao: conversion.tipo_operacao, dataEntregaSolicitada: conversion.data_entrega_solicitada });
  const queryKey = buildHttpListQueryKey({
    prefix: 'orcamentos-http',
    groupId,
    empresaId,
    page,
    pageSize,
    filters: appliedFilters,
  });
  const listQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.list(buildOrcamentoListRequestParams(appliedFilters, { page, pageSize, signal })),
    enabled: contextReady && canView,
    retry: 1,
  });
  const canLoadClientesEmpresa = canLoadClienteEmpresasHttp(hasPermission);
  const canLoadCondicoes = canLoadCondicoesPagamentoHttp(hasPermission);
  const canLoadProdutos = canLoadProdutosHttp(hasPermission);
  const mastersQuery = useQuery({
    queryKey: ['orcamento-masters', groupId, empresaId],
    queryFn: async ({ signal }) => {
      const [clientesEmpresaPayload, clientesPayload, condicoesPayload, produtosPayload, unidadesPayload] = await Promise.all([
        canLoadClientesEmpresa
          ? clienteEmpresasApi.list({ ativo: true, habilitadoOperacao: true, limit: 200, signal })
          : Promise.resolve({ data: [] }),
        clientesApi.list({ ativo: true, limit: 200, orderBy: 'nome', signal }),
        canLoadCondicoes
          ? condicoesApi.list({ ativo: true, limit: 200, signal })
          : Promise.resolve({ data: [] }),
        canLoadProdutos
          ? produtosApi.list({ ativo: true, limit: 200, signal })
          : Promise.resolve({ data: [] }),
        unidadesApi.list({ ativo: true, limit: 200, signal }),
      ]);
      return {
        clientesEmpresa: normalizeClienteEmpresasListPayload(clientesEmpresaPayload),
        clientes: normalizeClientesListPayload(clientesPayload),
        condicoes: normalizeCondicoesListPayload(condicoesPayload),
        produtos: normalizeProdutosListPayload(produtosPayload),
        unidades: normalizeUnidadesListPayload(unidadesPayload),
      };
    },
    enabled: contextReady && canView,
    staleTime: 30000,
    retry: 1,
  });
  const masters = mastersQuery.data || { clientesEmpresa: [], clientes: [], condicoes: [], produtos: [], unidades: [] };
  const mastersBlocked = isMasterPickerBlocked(mastersQuery);
  const clientePickerState = resolveHttpMasterPickerState({
    isLoading: mastersQuery.isLoading,
    isError: mastersQuery.isError,
    rowCount: masters.clientesEmpresa.length,
    allowed: canLoadClientesEmpresa,
  });
  const condicaoPickerState = resolveHttpMasterPickerState({
    isLoading: mastersQuery.isLoading,
    isError: mastersQuery.isError,
    rowCount: masters.condicoes.length,
    allowed: canLoadCondicoes,
  });
  const produtoPickerState = resolveHttpMasterPickerState({
    isLoading: mastersQuery.isLoading,
    isError: mastersQuery.isError,
    rowCount: masters.produtos.length,
    allowed: canLoadProdutos,
  });
  const mastersBannerText = mastersQuery.isError
    ? buildMastersHttpBannerText(mastersQuery.error, { entityLabel: 'Orçamento' })
    : 'Carregando cadastros mestres (cliente, condição e produto)...';
  const clientesById = useMemo(() => new Map(masters.clientes.map((item) => [item.id, item])), [masters.clientes]);
  const clienteLabel = (linkId) => {
    const link = masters.clientesEmpresa.find((item) => item.id === linkId);
    return buildClienteDisplayLabel(clientesById.get(link?.cliente_id), link?.codigo || linkId);
  };
  const condicaoLabel = (id) => masters.condicoes.find((item) => item.id === id)?.nome || id;
  const produtoLabel = (produto) => buildProdutoDisplayLabel(produto);
  const clientePickerRows = useMemo(
    () => filterActiveMasterRowsKeepingSelection(masters.clientesEmpresa, form.cliente_empresa_id, {
      requireHabilitadoOperacao: true,
      rejectBloqueado: true,
      placeholderById: form.cliente_empresa_id
        ? { [form.cliente_empresa_id]: { codigo: editing?.cliente_empresa_codigo || form.cliente_empresa_id } }
        : {},
    }),
    [masters.clientesEmpresa, form.cliente_empresa_id, editing],
  );
  const condicaoPickerRows = useMemo(
    () => filterActiveMasterRowsKeepingSelection(masters.condicoes, form.condicao_pagamento_id, {
      placeholderById: form.condicao_pagamento_id
        ? {
          [form.condicao_pagamento_id]: {
            codigo: condicaoSnapshot?.codigo || editing?.condicao_pagamento_codigo_snapshot,
            nome: condicaoSnapshot?.nome || editing?.condicao_pagamento_nome_snapshot,
          },
        }
        : {},
    }),
    [masters.condicoes, form.condicao_pagamento_id, condicaoSnapshot, editing],
  );
  const produtoPickerRows = useMemo(
    () => filterActiveMasterRowsKeepingSelection(
      masters.produtos,
      (form.itens || []).map((item) => item.produto_id),
      {
        placeholderById: Object.fromEntries(
          (form.itens || [])
            .filter((item) => item?.produto_id)
            .map((item) => [String(item.produto_id), { nome: item.descricao, descricao: item.descricao }]),
        ),
      },
    ),
    [masters.produtos, form.itens],
  );
  const clienteInactiveHint = inactiveMasterSelectionHint(clientePickerRows, 'Cliente');
  const condicaoInactiveHint = inactiveMasterSelectionHint(condicaoPickerRows, 'Condição');
  const produtoInactiveHint = inactiveMasterSelectionHint(produtoPickerRows, 'Produto');
  const orcamentoDetailSummary = resolveOrcamentoDetailSummaryUiState(selected, { clienteNome: selected ? clienteLabel(selected.cliente_empresa_id) : '', condicaoLabel: selected ? (selected.condicao_pagamento_nome_snapshot || condicaoLabel(selected.condicao_pagamento_id)) : '' });
  const orcamentoResumoPreview = resolveOrcamentoResumoPreviewState(selected, {
    empresaNome: empresaAtual?.razao_social || empresaAtual?.nome_fantasia || empresaAtual?.nome || 'Empresa',
    clienteNome: selected ? clienteLabel(selected.cliente_empresa_id) : 'Cliente',
  });

  useEffect(() => {
    // Troca de grupo/empresa: limpa cache HTTP de outro tenant e descarta rascunho fail-closed (sem prompt).
    clearComercialHttpCacheOnTenantSwitch(queryClient, { groupId, empresaId });
    const reset = buildOrcamentoTenantSwitchReset({ emptyForm });
    setPage(reset.page);
    setSelected(reset.selected);
    setSelectedIds(reset.selectedIds || []);
    setDetailOpen(reset.detailOpen);
    setResumoOpen(false);
    setFormOpen(reset.formOpen);
    setEditing(reset.editing);
    setForm(reset.form);
    setDirty(reset.dirty);
    setPendingCancel(reset.pendingCancel); setCancelMotivo('');
    setPendingConversion(reset.pendingConversion);
    setFilters(reset.filters);
    setAppliedFilters(reset.appliedFilters);
    setPromoBps(reset.promoBps);
    setPromoCupom(reset.promoCupom);
    setSimulacaoPreview(reset.simulacaoPreview);
    setLastSimulation(reset.lastSimulation);
    setSimulacaoDirty(reset.simulacaoDirty);
    setSimularHttpError(reset.simularHttpError);
    setCondicaoSnapshot(reset.condicaoSnapshot);
    setTabelaSnapshot(reset.tabelaSnapshot);
    setPromocaoSnapshot(reset.promocaoSnapshot);
  }, [groupId, empresaId, queryClient]);
  useEffect(() => bindComercialFormBeforeUnload(typeof window !== 'undefined' ? window : null, () => dirty || simulacaoDirty), [dirty, simulacaoDirty]);

  const resetSimulacaoUi = () => {
    setSimulacaoPreview(null); setLastSimulation(null); setSimulacaoDirty(false); setSimularHttpError(null); setPromoBps(''); setPromoCupom('');
    setCondicaoSnapshot(null);
    setTabelaSnapshot(null);
    setPromocaoSnapshot(null);
  };
  const invalidateSimulacaoPreview = () => {
    setSimulacaoPreview(null);
    setLastSimulation(null);
    setSimulacaoDirty(true);
    setSimularHttpError(null);
  };
  const applyPersistedSnapshotsFromRow = (row) => {
    const snaps = collectPersistedCommercialSnapshots(row);
    setCondicaoSnapshot(snaps.condicao);
    setTabelaSnapshot(snaps.tabela);
    setPromocaoSnapshot(snaps.promocao);
    const promoInputs = promoInputsFromPersistedSnapshot(snaps.promocao);
    setPromoBps(promoInputs.promoBps);
    setPromoCupom(promoInputs.promoCupom);
    setSimulacaoPreview(null);
    setLastSimulation(null);
    setSimulacaoDirty(false);
    setSimularHttpError(null);
    return snaps;
  };
  const discardFormState = () => {
    setFormOpen(false); setDirty(false); setEditing(null); resetSimulacaoUi();
  };
  const closeForm = () => {
    if (!confirmComercialFormAbandon({ dirty, simulacaoDirty, entity: 'orcamento' })) return;
    discardFormState();
  };
  const handleFormDialogOpenChange = (nextOpen) => {
    const decision = resolveComercialFormDialogOpenChange({
      nextOpen,
      dirty,
      simulacaoDirty,
      entity: 'orcamento',
    });
    if (decision.abandoned) {
      discardFormState();
      return;
    }
    if (decision.formOpen) setFormOpen(true);
  };
  const openCreate = () => {
    if (formOpen && !confirmComercialFormAbandon({ dirty, simulacaoDirty, entity: 'orcamento' })) return;
    setEditing(null); setForm(emptyForm()); setDirty(false); resetSimulacaoUi(); setFormOpen(true);
  };
  const openEdit = (row) => {
    if (!canEdit(row)) return;
    if (formOpen && !confirmComercialFormAbandon({ dirty, simulacaoDirty, entity: 'orcamento' })) return;
    setEditing(row);
    setForm(mapOrcamentoRowToForm(row));
    setDirty(false); setDetailOpen(false);
    applyPersistedSnapshotsFromRow(row);
    setFormOpen(true);
  };
  const changeForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    if (shouldInvalidateSimulacaoOnFormKey(key)) {
      invalidateSimulacaoPreview();
      if (key === 'condicao_pagamento_id') setCondicaoSnapshot(null);
    }
  };
  const changeClienteEmpresa = async (clienteEmpresaId) => {
    setForm((current) => ({ ...current, cliente_empresa_id: clienteEmpresaId }));
    setDirty(true);
    invalidateSimulacaoPreview();
    setCondicaoSnapshot(null);
    if (!clienteEmpresaId || !contextReady) return;
    setResolvingCondicao(true);
    try {
      const raw = await condicoesApi.resolve(clienteEmpresaId);
      const resolved = assertCondicaoResolucaoNoContexto(raw, { groupId, empresaId });
      setForm((current) => {
        const applied = applyResolvedCondicaoToForm(
          { ...current, cliente_empresa_id: clienteEmpresaId },
          resolved,
        );
        return applied.form;
      });
      const previewApplied = applyResolvedCondicaoToForm(
        { cliente_empresa_id: clienteEmpresaId, condicao_pagamento_id: '' },
        resolved,
      );
      setCondicaoSnapshot(buildCondicaoSnapshotPreview(previewApplied.snapshot));
      if (resolved.fonte === 'nenhuma') {
        toast.message('Nenhuma condição padrão resolvida para este cliente.');
      }
    } catch (error) {
      setCondicaoSnapshot(null);
      toast.error(error?.message || errorMessage(error));
    } finally {
      setResolvingCondicao(false);
    }
  };
  const changeItem = (index, key, value) => {
    setForm((current) => ({ ...current, itens: current.itens.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
    setDirty(true); invalidateSimulacaoPreview();
  };
  const selectProduct = async (index, produtoId) => {
    const produto = masters.produtos.find((item) => item.id === produtoId);
    const unidadeId = produto?.unidade_medida_id || '';
    const unidade = masters.unidades.find((item) => item.id === unidadeId);
    setForm((current) => ({ ...current, itens: current.itens.map((item, i) => i === index ? {
      ...item, produto_id: produtoId, unidade_id: unidadeId, descricao: produto?.descricao || produto?.nome || '', unidade_sigla: unidade?.sigla || '',
    } : item) }));
    setDirty(true); invalidateSimulacaoPreview();
    const clienteEmpresaId = form.cliente_empresa_id;
    if (!clienteEmpresaId || !produtoId || !unidadeId || !contextReady) return;
    setResolvingPreco(true);
    try {
      const raw = await tabelasApi.resolveClientPrice({
        clienteEmpresaId,
        produtoId,
        unidadeMedidaId: unidadeId,
        businessDate: form.validade_em || undefined,
      });
      const resolved = assertPrecoResolucaoNoContexto(raw, { groupId, empresaId });
      if (!resolved) {
        toast.message('Nenhum preço vigente para este produto no cliente.');
        return;
      }
      setForm((current) => ({
        ...current,
        itens: current.itens.map((item, i) => {
          if (i !== index) return item;
          const applied = applyResolvedPrecoToItem({
            ...item,
            produto_id: produtoId,
            unidade_id: unidadeId,
            descricao: produto?.descricao || produto?.nome || '',
            unidade_sigla: unidade?.sigla || '',
          }, resolved);
          return applied.item;
        }),
      }));
    } catch (error) {
      toast.error(error?.message || errorMessage(error));
    } finally {
      setResolvingPreco(false);
    }
  };
  const localTotals = useMemo(() => {
    try { const total = calculateTotals(form.itens); return { subtotal: microsToDecimal(total.subtotal), desconto: microsToDecimal(total.desconto), total: microsToDecimal(total.total) }; }
    catch { return { subtotal: '0', desconto: '0', total: '0' }; }
  }, [form.itens]);
  const totals = useMemo(
    () => resolveDisplayTotals(simulacaoPreview, localTotals),
    [simulacaoPreview, localTotals],
  );
  const descontoAlcada = useMemo(
    () => evaluateDescontoAlcadaUi({
      items: form.itens,
      hasPermission,
      entity: 'orcamento',
      mode: editing ? 'update' : 'create',
      actorId,
      // Create: criador = actor (sem autoaprovação). Update: criador desconhecido na UI —
      // com `aprovar` permite tentativa; backend segrega via audit. Sem `aprovar` bloqueia.
      criadorActorId: editing ? null : actorId,
    }),
    [form.itens, hasPermission, editing, actorId],
  );
  const margemCostLookup = useMemo(
    () => resolveMargemCostLookupFromItems(form.itens),
    [form.itens],
  );
  const margemAlcada = useMemo(
    () => evaluateMargemAlcadaUi({
      items: form.itens,
      costLookup: margemCostLookup,
      hasPermission,
      entity: 'orcamento',
    }),
    [form.itens, margemCostLookup, hasPermission],
  );
  const parcelaScheduleUi = useMemo(
    () => resolveParcelaScheduleUiState({ simulacaoPreview, condicaoSnapshot }),
    [simulacaoPreview, condicaoSnapshot],
  );
  const simulacaoDirtyGate = useMemo(
    () => evaluateSimulacaoDirtySaveGate({ simulacaoDirty, canSimular }),
    [simulacaoDirty, canSimular],
  );
  const itemLinesGate = useMemo(
    () => evaluateItemLinesGate(form.itens),
    [form.itens],
  );
  const observacoesUi = useMemo(
    () => evaluateObservacoesUiGate(form.observacoes, COMERCIAL_OBSERVACOES_MAX_LENGTH),
    [form.observacoes],
  );
  const runSimularVenda = async () => {
    if (!canSimular || simulating || submitting) return;
    if (itemLinesGate.blockSimular) {
      toast.error(itemLinesGate.simularIssues[0]?.message || itemLinesGate.hint || 'Corrija os itens antes de simular.');
      return;
    }
    setSimulating(true);
    setSimularHttpError(null);
    try {
      const requestedPromo = String(promoBps || '').trim() !== '';
      const payload = buildSimularVendaPayload(form, {
        baseDate: form.validade_em || undefined,
        promocaoBps: requestedPromo ? promoBps : undefined,
        cupom: promoCupom,
      });
      const raw = await comercialApi.simularVenda(payload);
      const simulation = assertSimulacaoNoContexto(raw, { groupId, empresaId });
      assertPromocaoAplicadaOuFalhar(simulation, requestedPromo);
      assertParcelaScheduleFromSimulacao(simulation);
      setLastSimulation(simulation);
      setSimulacaoPreview(buildSimulacaoPreviewState(simulation));
      setSimulacaoDirty(false);
      setSimularHttpError(null);
      toast.success('Simulação atualizada com preços e parcelas do servidor.');
    } catch (error) {
      setLastSimulation(null);
      setSimulacaoPreview(null);
      setSimulacaoDirty(true);
      setSimularHttpError(isComercialRetryableHttpError(error) ? error : null);
      toast.error(error?.message || errorMessage(error));
    } finally {
      setSimulating(false);
    }
  };
  const applyLastSimulacao = () => {
    if (!lastSimulation || !canSimular) return;
    try {
      const next = applySimulacaoToForm(form, lastSimulation);
      setForm(next);
      setDirty(true);
      setSimulacaoPreview(buildSimulacaoPreviewState(lastSimulation));
      setSimulacaoDirty(false);
      toast.success('Preços, descontos e condição da simulação aplicados ao formulário.');
    } catch (error) {
      toast.error(error?.message || errorMessage(error));
    }
  };
  const save = async () => {
    if (submitting || !beginSaveOnce(saveInFlightRef)) return;
    if (itemLinesGate.blockSave) {
      endSaveOnce(saveInFlightRef);
      toast.error(itemLinesGate.hint || 'Corrija quantidade e preço dos itens antes de salvar.');
      return;
    }
    if (validadeUi.blockSave) {
      endSaveOnce(saveInFlightRef);
      toast.error(validadeUi.hint || 'Validade inválida — salvar bloqueado.');
      return;
    }
    if (observacoesUi.blockSave) {
      endSaveOnce(saveInFlightRef);
      toast.error(observacoesUi.hint || 'Observações acima do limite — salvar bloqueado.');
      return;
    }
    if (simulacaoDirtyGate.blockSave) {
      endSaveOnce(saveInFlightRef);
      toast.error(simulacaoDirtyGate.hint || 'Simule novamente antes de salvar.');
      return;
    }
    try {
      assertSimulacaoFreshForSave({ simulacaoDirty, canSimular });
    } catch (error) {
      endSaveOnce(saveInFlightRef);
      toast.error(error?.message || errorMessage(error));
      return;
    }
    if (!descontoAlcada.canSave) {
      endSaveOnce(saveInFlightRef);
      toast.error(descontoAlcada.hint || 'Desconto acima da alçada — salvar bloqueado.');
      return;
    }
    const margemGate = evaluateMargemAlcadaUi({
      items: form.itens,
      costLookup: resolveMargemCostLookupFromItems(form.itens),
      hasPermission,
      entity: 'orcamento',
    });
    if (!margemGate.canSave) {
      endSaveOnce(saveInFlightRef);
      toast.error(margemGate.hint || 'Margem abaixo da mínima — salvar bloqueado.');
      return;
    }
    setSubmitting(true);
    try {
      const formToSave = mergeSimulacaoBeforeSave(form, lastSimulation, { groupId, empresaId });
      if (formToSave !== form) setForm(formToSave);
      const payload = buildOrcamentoPayload(formToSave, {
        promocao: simulacaoPreview?.promocao?.aplicada
          ? { aplicada: true, bps: simulacaoPreview.promocao.bps, cupom: promoCupom }
          : undefined,
      });
      const saved = editing ? await api.update(editing.id, payload) : await api.create(payload);
      toast.success(editing ? 'Orçamento atualizado.' : 'Orçamento criado.');
      setSelected(saved);
      setEditing(saved);
      setForm(mapOrcamentoRowToForm(saved));
      setDirty(false);
      applyPersistedSnapshotsFromRow(saved);
      setFormOpen(true);
      await queryClient.invalidateQueries({ queryKey: ['orcamentos-http', groupId, empresaId] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); endSaveOnce(saveInFlightRef); }
  };
  const showDetail = async (row) => {
    try { const detail = await api.get(row.id); setSelected(detail); setDetailOpen(true); }
    catch (error) { toast.error(errorMessage(error)); }
  };
  const performCancel = async (row, motivo) => {
    if (!row || submitting) return;
    const gate = evaluateOrcamentoCancelMotivoUiGate(motivo);
    if (gate.blockConfirm) { toast.error(gate.hint || 'Informe o motivo do cancelamento.'); return; }
    setSubmitting(true);
    try {
      const cancelled = await api.cancel(row.id, gate.motivo); setSelected(cancelled);
      toast.success('Orçamento cancelado e preservado.');
      await queryClient.invalidateQueries({ queryKey: ['orcamentos-http', groupId, empresaId] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };
  const cancel = (row) => {
    if (!canCancel(row) || submitting) return;
    setCancelMotivo('');
    setPendingCancel(row);
  };
  const cancelMotivoUi = evaluateOrcamentoCancelMotivoUiGate(cancelMotivo);
const convertToPedido = async () => {
    if (!pendingConversion || submitting) return;
    const convertGate = evaluateOrcamentoConvertUiGate({
      row: pendingConversion,
      dirty,
      simulacaoDirty,
      editingId: editing?.id,
    });
    if (convertGate.blockConvert) {
      toast.error(convertGate.bannerText || convertGate.title || 'Conversão bloqueada.');
      return;
    }
    if (!conversion.data_entrega_solicitada) { toast.error('Informe a data solicitada pelo cliente.'); return; }
    const dataEntregaGate = evaluatePedidoDataEntregaUiGate({ tipoOperacao: conversion.tipo_operacao, dataEntregaSolicitada: conversion.data_entrega_solicitada });
    if (dataEntregaGate.blockSave) { toast.error(dataEntregaGate.hint || 'Data de entrega do cliente inválida.'); return; }
    setSubmitting(true);
    try {
      await pedidosApi.convertOrcamento(pendingConversion.id, { tipo_operacao: conversion.tipo_operacao, data_entrega_solicitada: new Date(`${conversion.data_entrega_solicitada}T12:00:00`).toISOString() });
      toast.success('Orçamento convertido em pedido.'); setPendingConversion(null); setDetailOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['pedidos-http', groupId, empresaId] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };
  const printPdfGate = evaluateOrcamentoPrintPdfUiGate({ row: selected, groupId, empresaId, canPrint });
  const shareGate = evaluateOrcamentoShareUiGate({ row: selected, groupId, empresaId, canShare });
  const printOrcamento = (row) => {
    const gate = evaluateOrcamentoPrintPdfUiGate({ row, groupId, empresaId, canPrint });
    if (gate.blockPrint) { toast.error(gate.hint || 'Impressão bloqueada (fail-closed).'); return; }
    const opened = gerarPDFOrcamento(row, { empresa: empresaAtual, clienteNome: clienteLabel(row.cliente_empresa_id), condicaoPagamento: condicaoLabel(row.condicao_pagamento_id) });
    if (!opened) toast.error('Permita a abertura da janela de impressão para gerar o PDF.');
  };
  const prepareShare = async (row, channel) => {
    const gate = evaluateOrcamentoShareUiGate({ row, groupId, empresaId, canShare });
    if (gate.blockShare) { toast.error(gate.hint || 'Compartilhamento bloqueado (fail-closed).'); return; }
    try {
      const text = buildOrcamentoShareText(row, { empresaNome: empresaAtual?.razao_social || empresaAtual?.nome_fantasia || empresaAtual?.nome || 'Empresa', clienteNome: clienteLabel(row.cliente_empresa_id) });
      await navigator.clipboard.writeText(text);
      toast.success(`Texto para ${channel} copiado. Revise antes de enviar.`);
    } catch (error) {
      toast.error(error?.message || 'Não foi possível copiar o texto. Use a visualização de impressão.');
    }
  };
  const openOrcamentoResumo = () => { if (!selected) return; setResumoOpen(true); };
  const printOrcamentoResumo = () => {
    if (!orcamentoResumoPreview.canPrint || !orcamentoResumoPreview.text) {
      toast.error(orcamentoResumoPreview.hint || 'Resumo texto indisponível (fail-closed).');
      return;
    }
    const opened = openComercialResumoTextoWindow(orcamentoResumoPreview.text, { title: `Orçamento ${selected?.numero || ''}` });
    if (!opened) toast.error('Permita a abertura da janela para imprimir o resumo texto.');
  };
  const copyOrcamentoResumo = async () => {
    if (!orcamentoResumoPreview.canCopy || !orcamentoResumoPreview.text) {
      toast.error(orcamentoResumoPreview.hint || 'Resumo texto indisponível (fail-closed).');
      return;
    }
    try {
      await navigator.clipboard.writeText(orcamentoResumoPreview.text);
      toast.success('Resumo texto copiado. Revise antes de usar.');
    } catch {
      toast.error('Não foi possível copiar. Use Imprimir texto.');
    }
  };

  if (!canView) return <div className="w-full h-full flex items-center justify-center p-6"><Alert className="max-w-lg"><AlertCircle className="h-4 w-4" /><AlertDescription>Acesso negado aos Orçamentos.</AlertDescription></Alert></div>;
  const rows = listQuery.data?.data || [];
  const listBulkUi = resolveComercialListBulkUiState({ selectedIds, pageRows: rows });
  const listHasActiveFilters = hasActiveComercialListFilters(appliedFilters, ORCAMENTO_LIST_FILTER_DEFAULTS);
  const listEmptyMessage = formatHttpListEmptyMessage({
    entityLabel: 'orçamento',
    hasActiveFilters: listHasActiveFilters,
  });
  const listView = resolveHttpListViewState({ isLoading: listQuery.isLoading, isError: listQuery.isError, rowCount: rows.length });

  const listPageExportUi = resolveComercialListPageExportUi({ listView, rowCount: rows.length, canView });
  const exportListPageCsv = () => {
    if (listPageExportUi.blockExport) {
      toast.error(listPageExportUi.hint || listPageExportUi.title || 'Exportação bloqueada.');
      return;
    }
    const csv = buildComercialListCsv(mapOrcamentoRowsForCsv(rows, clienteLabel), ORCAMENTO_LIST_CSV_COLUMNS);
    const result = downloadComercialCsvText(`orcamentos-pagina-${page}.csv`, csv);
    if (!result.ok) {
      toast.error(result.reason || 'Falha ao exportar CSV.');
      return;
    }
    toast.success(`CSV da página (${rows.length} registro(s)) gerado.`);
  };
  const meta = listQuery.data?.meta || { total: 0 };
  return <div className={`w-full h-full flex flex-col bg-slate-50 ${windowMode ? 'p-3' : 'p-4'}`} data-permission="Comercial.orcamento.visualizar">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div><h2 className="text-xl font-semibold">Orçamentos</h2><p className="text-sm text-slate-500">Propostas comerciais da empresa ativa</p></div>
      {canCreate && <Button onClick={openCreate} disabled={!contextReady} data-permission="Comercial.orcamento.criar"><FilePlus2 className="w-4 h-4 mr-2" />Novo orçamento</Button>}
    </div>
    {!contextReady && <Alert {...buildComercialBannerA11yProps('polite')}><AlertCircle className="h-4 w-4" /><AlertDescription>Selecione uma empresa e entre com um usuário válido.</AlertDescription></Alert>}
    {(mastersQuery.isLoading || mastersQuery.isError) && <Alert {...buildComercialBannerA11yProps(mastersQuery.isError ? 'error' : 'loading')} variant={mastersQuery.isError ? 'destructive' : 'default'} className="mb-3" data-testid="orcamento-masters-error" data-retryable={mastersQuery.isError && isComercialRetryableHttpError(mastersQuery.error) ? 'true' : 'false'}><AlertCircle className="h-4 w-4" /><AlertDescription className="flex flex-wrap items-center gap-2"><span>{mastersBannerText}</span>{mastersQuery.isError && isComercialRetryableHttpError(mastersQuery.error) && <Button type="button" size="sm" variant="outline" aria-label={comercialActionAriaLabel('retry')} data-testid="orcamento-masters-retry" onClick={() => mastersQuery.refetch()}><RefreshCw className="w-4 h-4 mr-1" />Tentar novamente</Button>}</AlertDescription></Alert>}
    <form className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setSelectedIds([]); setAppliedFilters(normalizeOrcamentoListFilters(filters)); }}>
      <div className="md:col-span-2"><Label htmlFor="orc-search" className="sr-only">Pesquisar número</Label><Input id="orc-search" value={filters.search} maxLength={80} placeholder="Pesquisar número" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
      <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}><SelectTrigger aria-label="Filtrar status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="EM_ABERTO">Em aberto</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select>
      <Select value={filters.clienteEmpresaId} onValueChange={(value) => setFilters((current) => ({ ...current, clienteEmpresaId: value }))} disabled={mastersBlocked || clientePickerState === 'denied'}><SelectTrigger aria-label="Filtrar cliente"><SelectValue placeholder={formatMasterPickerPlaceholder(clientePickerState, 'cliente')} /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os clientes</SelectItem>{masters.clientesEmpresa.map((item) => <SelectItem key={item.id} value={item.id}>{clienteLabel(item.id)}</SelectItem>)}</SelectContent></Select>
      <div className="grid grid-cols-2 gap-2"><Input aria-label="Validade inicial" type="date" value={filters.validadeDe} onChange={(event) => setFilters((current) => ({ ...current, validadeDe: event.target.value }))} /><Input aria-label="Validade final" type="date" value={filters.validadeAte} onChange={(event) => setFilters((current) => ({ ...current, validadeAte: event.target.value }))} /></div>
      <div className="flex gap-2"><Button type="submit" variant="outline" className="flex-1"><Search className="w-4 h-4 mr-2" />Filtrar</Button><Button type="button" size="icon" variant="ghost" title="Limpar filtros" onClick={() => { const clean = { ...ORCAMENTO_LIST_FILTER_DEFAULTS }; setFilters(clean); setAppliedFilters(clean); setPage(1); setSelectedIds([]); }}><RefreshCw className="w-4 h-4" /></Button><Button type="button" size="sm" variant="outline" data-testid="orcamento-list-export-csv" data-action="Comercial.orcamento.export-csv-pagina" data-export-scope={listPageExportUi.scope} aria-label={listPageExportUi.title} title={listPageExportUi.title} disabled={listPageExportUi.blockExport} onClick={exportListPageCsv}><Download className="w-4 h-4 mr-1" />CSV</Button></div>
    </form>
    {listBulkUi.selectedCount > 0 && <div className="flex flex-wrap items-center gap-2 mb-2" data-testid="orcamento-list-bulk-bar" data-bulk-enabled="false" data-action="Comercial.orcamento.bulk-stub"><span className="text-sm text-slate-600">{listBulkUi.selectedCount} selecionado(s)</span><Button type="button" size="sm" variant="outline" disabled title={listBulkUi.cancelTitle} data-testid="orcamento-list-bulk-cancel" aria-label={listBulkUi.cancelTitle} data-bulk-reason={listBulkUi.bulkReason}>Cancelar em lote</Button><Button type="button" size="sm" variant="outline" disabled title={listBulkUi.exportTitle} data-testid="orcamento-list-bulk-export" aria-label={listBulkUi.exportTitle} data-bulk-reason={listBulkUi.bulkReason}>Exportar</Button><Button type="button" size="sm" variant="ghost" data-testid="orcamento-list-bulk-clear" onClick={() => setSelectedIds([])}>Limpar seleção</Button></div>}
    {listView === 'loading' ? <div className="flex-1 flex items-center justify-center" {...buildComercialBannerA11yProps('loading')}>Carregando orçamentos...</div> : listView === 'error' ? <div className="flex-1 flex flex-col items-center justify-center gap-3" data-testid="orcamento-list-error" data-retryable={isComercialRetryableHttpError(listQuery.error) ? 'true' : 'false'} {...buildComercialBannerA11yProps('error')}><p>{errorMessage(listQuery.error)}</p>{isComercialRetryableHttpError(listQuery.error) && <Button variant="outline" aria-label={comercialActionAriaLabel('retry')} data-testid="orcamento-list-retry" onClick={() => listQuery.refetch()}><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button>}</div> : listView === 'empty' ? <div className="flex-1 flex flex-col items-center justify-center text-slate-500" data-testid="orcamento-list-empty" data-empty-filtered={listHasActiveFilters ? 'true' : 'false'}><FilePlus2 className="w-10 h-10 mb-2" /><p>{listEmptyMessage}</p></div> : <div className="flex-1 min-h-0 overflow-auto border bg-white rounded-md">
      <Table data-testid="orcamento-list-ready"><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={listBulkUi.headerChecked} data-testid="orcamento-list-select-all" aria-label="Selecionar todos da página" data-indeterminate={listBulkUi.headerIndeterminate ? 'true' : 'false'} onCheckedChange={() => setSelectedIds(toggleComercialListPageSelection(selectedIds, rows))} /></TableHead><TableHead>Número</TableHead><TableHead>Cliente</TableHead><TableHead>Criado</TableHead><TableHead>Validade</TableHead><TableHead>Itens</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id} data-selected={listBulkUi.selectedIds.includes(row.id) ? 'true' : 'false'}><TableCell><Checkbox checked={listBulkUi.selectedIds.includes(row.id)} aria-label={`Selecionar orçamento ${row.numero}`} data-testid={`orcamento-list-select-${row.id}`} onCheckedChange={() => setSelectedIds(toggleComercialListRowSelection(selectedIds, row.id))} /></TableCell><TableCell className="font-mono">{row.numero}</TableCell><TableCell>{clienteLabel(row.cliente_empresa_id)}</TableCell><TableCell>{date(row.created_at)}</TableCell><TableCell><span className="inline-flex items-center gap-1">{date(row.validade_em)}{isOrcamentoValidadeExpirada(row.validade_em) && <Badge variant="destructive">Expirado</Badge>}</span></TableCell><TableCell>{row.itens?.length || 0}</TableCell><TableCell className="text-right">{money(row.subtotal)}</TableCell><TableCell className="text-right">{money(row.desconto)}</TableCell><TableCell className="text-right font-semibold">{money(row.total)}</TableCell><TableCell><Badge variant={row.status === 'EM_ABERTO' ? 'default' : 'secondary'}>{row.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado'}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Visualizar" aria-label={`Visualizar orçamento ${row.numero}`} onClick={() => showDetail(row)}><Eye className="w-4 h-4" /></Button>{canEdit(row) && <Button size="icon" variant="ghost" title="Editar" aria-label={`Editar orçamento ${row.numero}`} onClick={() => openEdit(row)}><Pencil className="w-4 h-4" /></Button>}{canCancel(row) && <Button size="icon" variant="ghost" title="Cancelar" aria-label={comercialActionAriaLabel('cancelar', { entityLabel: 'orçamento', numero: row.numero })} onClick={() => cancel(row)}><XCircle className="w-4 h-4" /></Button>}</div></TableCell></TableRow>)}</TableBody></Table>
    </div>}
    <PaginationControls currentPage={page} totalItems={meta.total || 0} itemsPerPage={pageSize} onPageChange={setPage} onItemsPerPageChange={setPageSize} isLoading={listQuery.isFetching} />

    <Dialog open={formOpen} onOpenChange={handleFormDialogOpenChange} data-testid="orcamento-form-dialog" data-dirty={dirty || simulacaoDirty ? 'true' : 'false'}><DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-auto"><DialogHeader><DialogTitle>{editing ? `Editar orçamento ${editing.numero}` : 'Novo orçamento'}</DialogTitle><DialogDescription>Os totais serão conferidos novamente pelo servidor.</DialogDescription></DialogHeader>
      {(mastersQuery.isLoading || mastersQuery.isError) && <Alert {...buildComercialBannerA11yProps(mastersQuery.isError ? 'error' : 'loading')} variant={mastersQuery.isError ? 'destructive' : 'default'} className="mb-3" data-testid="orcamento-masters-form-banner" data-retryable={mastersQuery.isError && isComercialRetryableHttpError(mastersQuery.error) ? 'true' : 'false'}><AlertCircle className="h-4 w-4" /><AlertDescription className="flex flex-wrap items-center gap-2"><span>{mastersBannerText}</span>{mastersQuery.isError && isComercialRetryableHttpError(mastersQuery.error) && <Button type="button" size="sm" variant="outline" aria-label={comercialActionAriaLabel('retry')} data-testid="orcamento-masters-form-retry" onClick={() => mastersQuery.refetch()}><RefreshCw className="w-4 h-4 mr-1" />Tentar novamente</Button>}</AlertDescription></Alert>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3"><div className="md:col-span-2"><Label htmlFor="orc-cliente">Cliente</Label><Select value={form.cliente_empresa_id} onValueChange={(v) => { void changeClienteEmpresa(v); }} disabled={mastersBlocked || clientePickerState === 'denied'}><SelectTrigger id="orc-cliente" data-testid="orcamento-cliente-picker" data-picker-state={clientePickerState}><SelectValue placeholder={formatMasterPickerPlaceholder(clientePickerState, 'cliente')} /></SelectTrigger><SelectContent>{clientePickerRows.map((item) => <SelectItem key={item.id} value={item.id} data-inactive={item.ativo === false || item._inactiveSelection ? 'true' : 'false'}>{formatMasterPickerOptionLabel(item, { labelFn: (row) => clienteLabel(row.id) })}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-condicao">Condição de pagamento</Label><Select value={form.condicao_pagamento_id} onValueChange={(v) => changeForm('condicao_pagamento_id', v)} disabled={mastersBlocked || condicaoPickerState === 'denied' || resolvingCondicao}><SelectTrigger id="orc-condicao" data-testid="orcamento-condicao-picker" data-picker-state={condicaoPickerState}><SelectValue placeholder={resolvingCondicao ? 'Resolvendo...' : formatMasterPickerPlaceholder(condicaoPickerState, 'condição')} /></SelectTrigger><SelectContent>{condicaoPickerRows.map((item) => <SelectItem key={item.id} value={item.id} data-inactive={item.ativo === false || item._inactiveSelection ? 'true' : 'false'}>{formatMasterPickerOptionLabel(item)}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-validade">Validade *</Label><Input id="orc-validade" data-testid="orcamento-validade" type="date" min={validadeUi.minDay} value={form.validade_em} onChange={(e) => changeForm('validade_em', e.target.value)} aria-invalid={validadeUi.blockSave ? 'true' : undefined} aria-describedby="orc-validade-hint" data-block-save={validadeUi.blockSave ? 'true' : 'false'} data-mode={validadeUi.mode} /><p id="orc-validade-hint" className={`text-xs mt-1 ${validadeUi.blockSave ? 'text-amber-700' : 'text-slate-500'}`} data-action="Comercial.orcamento.validade-hint" data-testid="orcamento-validade-hint">{validadeUi.hint || 'Proposta válida até o meio-dia desta data (servidor bloqueia se expirada).'}</p></div><div className="md:col-span-4"><div className="flex items-center justify-between gap-2"><Label htmlFor="orc-observacoes">Observações</Label><span className="text-xs text-slate-500 tabular-nums" data-testid="orcamento-observacoes-counter" aria-live="polite">{observacoesUi.counterLabel}</span></div><Textarea id="orc-observacoes" data-testid="orcamento-observacoes" maxLength={observacoesUi.max} value={form.observacoes} onChange={(e) => changeForm('observacoes', clampObservacoesInput(e.target.value, observacoesUi.max))} aria-invalid={observacoesUi.blockSave ? 'true' : undefined} aria-describedby="orc-observacoes-hint" data-block-save={observacoesUi.blockSave ? 'true' : 'false'} /><span className="sr-only" id="orc-observacoes-hint">{observacoesUi.hint || `Máximo ${observacoesUi.max} caracteres.`}</span></div></div>{validadeUi.blockSave && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-validade-gate" data-action="Comercial.orcamento.validade" data-mode={validadeUi.mode}><AlertCircle className="h-4 w-4" /><AlertDescription>{validadeUi.hint}</AlertDescription></Alert>}{observacoesUi.blockSave && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-observacoes-gate" data-action="Comercial.orcamento.observacoes"><AlertCircle className="h-4 w-4" /><AlertDescription>{observacoesUi.hint}</AlertDescription></Alert>}
      {(clienteInactiveHint || condicaoInactiveHint || produtoInactiveHint) && <Alert {...buildComercialBannerA11yProps('polite')} data-testid="orcamento-inactive-master-hint" data-action="Comercial.master-inactive-kept"><AlertCircle className="h-4 w-4" /><AlertDescription>{[clienteInactiveHint, condicaoInactiveHint, produtoInactiveHint].filter(Boolean).join(' ')}</AlertDescription></Alert>}
      {condicaoSnapshot?.parcelas?.length > 0 && <div className="border rounded-md p-3 space-y-2 bg-white" data-action="Comercial.condicao-snapshot-preview" data-testid="orcamento-condicao-snapshot" data-persistido={condicaoSnapshot.persistido ? 'true' : 'false'}><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Resolução: {condicaoSnapshot.fonte || 'manual'}</Badge><Badge variant="outline">{condicaoSnapshot.nome || condicaoSnapshot.codigo || condicaoSnapshot.id}</Badge>{condicaoSnapshot.persistido && <Badge variant="secondary">Persistido</Badge>}<span className="text-xs text-slate-500">{condicaoSnapshot.persistido ? 'Snapshot recarregado do servidor após salvar (id+codigo+nome+parcelas).' : 'Pré-visualização — ao salvar, o servidor persiste snapshot id+nome+parcelas (não-retroativo).'}</span></div><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Dias</TableHead><TableHead>%</TableHead></TableRow></TableHeader><TableBody>{condicaoSnapshot.parcelas.map((parcela) => <TableRow key={`${parcela.ordem}-${parcela.dias}-${parcela.percentual}`}><TableCell>{parcela.ordem}</TableCell><TableCell>{parcela.dias}</TableCell><TableCell>{parcela.percentual}</TableCell></TableRow>)}</TableBody></Table>{parcelaScheduleUi.mode === 'template' && <p className="text-xs text-slate-500" data-testid="orcamento-parcela-template-hint">{parcelaScheduleUi.hint}</p>}</div>}
      {tabelaSnapshot?.id && <div className="border rounded-md p-3 bg-white" data-action="Comercial.tabela-snapshot-preview" data-testid="orcamento-tabela-snapshot" data-persistido={tabelaSnapshot.persistido ? 'true' : 'false'}><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Tabela: {tabelaSnapshot.fonte || 'manual'}</Badge><Badge variant="outline">{tabelaSnapshot.nome || tabelaSnapshot.codigo || tabelaSnapshot.id}</Badge>{tabelaSnapshot.persistido && <Badge variant="secondary">Persistido</Badge>}<span className="text-xs text-slate-500">{tabelaSnapshot.persistido ? 'Snapshot codigo+nome recarregado do servidor após salvar.' : 'Snapshot codigo+nome persistido pelo servidor (não-retroativo).'}</span></div></div>}
      {promocaoSnapshot?.persistido && <div className="border rounded-md p-3 bg-white" data-action="Comercial.promocao-snapshot-preview" data-testid="orcamento-promocao-snapshot" data-persistido="true"><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Promoção: persistido</Badge>{promocaoSnapshot.aplicada ? <Badge>Promo {promocaoSnapshot.bps} bps{promocaoSnapshot.cupom ? ` · ${promocaoSnapshot.cupom}` : ''}</Badge> : <Badge variant="secondary">Sem promoção</Badge>}<span className="text-xs text-slate-500">Snapshot de promoção recarregado do servidor após salvar (migration 030).</span></div></div>}
      <div className="space-y-2"><div className="flex justify-between"><h3 className="font-semibold">Itens</h3><Button type="button" variant="outline" size="sm" onClick={() => changeForm('itens', [...form.itens, emptyItem()])}><Plus className="w-4 h-4 mr-1" />Item</Button></div>{form.itens.map((item, index) => { let itemTotals = { subtotal: '0', total: '0' }; try { itemTotals = calculateItem(item); } catch { itemTotals = { subtotal: '0', total: '0' }; } const lineHint = itemLinesGate.lineHints[index]; const lineIssues = [...itemLinesGate.issues, ...itemLinesGate.simularIssues]; const qtdA11y = buildItemLineFieldA11y({ index, field: 'quantidade', issues: lineIssues, lineHint, idPrefix: 'orcamento-item' }); const precoA11y = buildItemLineFieldA11y({ index, field: 'preco_unitario', issues: lineIssues, lineHint, idPrefix: 'orcamento-item' }); const descA11y = buildItemLineFieldA11y({ index, field: 'desconto', issues: lineIssues, lineHint, idPrefix: 'orcamento-item' }); const lineHintId = buildItemLineHintId(index, 'orcamento-item'); return <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 border rounded-md p-2" data-testid={index === 0 ? 'orcamento-item-line' : undefined} data-line-invalid={lineHint ? 'true' : 'false'}><div className="md:col-span-3"><Label>Produto</Label><Select value={item.produto_id} onValueChange={(v) => { void selectProduct(index, v); }} disabled={mastersBlocked || produtoPickerState === 'denied' || resolvingPreco}><SelectTrigger data-testid={index === 0 ? 'orcamento-produto-picker' : undefined} data-picker-state={produtoPickerState}><SelectValue placeholder={resolvingPreco ? 'Resolvendo preço...' : formatMasterPickerPlaceholder(produtoPickerState, 'produto')} /></SelectTrigger><SelectContent>{produtoPickerRows.map((p) => <SelectItem key={p.id} value={p.id} data-inactive={p.ativo === false || p._inactiveSelection ? 'true' : 'false'}>{formatMasterPickerOptionLabel(p, { labelFn: produtoLabel })}</SelectItem>)}</SelectContent></Select></div><div className="md:col-span-3"><Label>Descrição</Label><Input value={item.descricao} onChange={(e) => changeItem(index, 'descricao', e.target.value)} /></div><div><Label>Unidade</Label><Input value={item.unidade_sigla} readOnly /></div><div><Label>Quantidade</Label><Input inputMode="decimal" value={item.quantidade} aria-invalid={qtdA11y['aria-invalid']} aria-describedby={qtdA11y['aria-describedby']} onChange={(e) => changeItem(index, 'quantidade', e.target.value)} /></div><div><Label>Preço</Label><Input inputMode="decimal" value={item.preco_unitario} aria-invalid={precoA11y['aria-invalid']} aria-describedby={precoA11y['aria-describedby']} onChange={(e) => changeItem(index, 'preco_unitario', e.target.value)} /></div><div><Label>Desconto</Label><Input inputMode="decimal" value={item.desconto} aria-invalid={descA11y['aria-invalid']} aria-describedby={descA11y['aria-describedby']} onChange={(e) => changeItem(index, 'desconto', e.target.value)} /></div><div><Label>Total</Label><div className="h-10 flex items-center font-medium">{money(itemTotals.total)}</div></div><div className="flex items-end"><Button type="button" size="icon" variant="ghost" title="Remover item" aria-label={`Remover item ${index + 1}`} disabled={form.itens.length === 1} onClick={() => changeForm('itens', form.itens.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button></div>{lineHint && <p id={lineHintId} className="md:col-span-12 text-xs text-amber-700" data-testid={index === 0 ? 'orcamento-item-line-hint' : undefined} data-action="Comercial.orcamento.item-line-validation">{lineHint}</p>}</div>; })}</div>
      {itemLinesGate.blockSave && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-item-lines-gate" data-action="Comercial.orcamento.item-line-validation"><AlertCircle className="h-4 w-4" /><AlertDescription>{itemLinesGate.hint}</AlertDescription></Alert>}
      <div className="flex justify-end gap-5 text-sm"><span>Subtotal: <strong>{money(totals.subtotal)}</strong></span><span>Desconto: <strong>{money(totals.desconto)}</strong></span><span>Total: <strong>{money(totals.total)}</strong></span></div>
      {descontoAlcada.excedeu && <Alert {...buildComercialBannerA11yProps(descontoAlcada.canSave ? 'polite' : 'error')} variant={descontoAlcada.canSave ? 'default' : 'destructive'} className="border-amber-300" data-action="Comercial.orcamento.desconto-alcada" data-testid="orcamento-desconto-alcada-alert"><AlertCircle className="h-4 w-4" /><AlertDescription>{descontoAlcada.hint}{descontoAlcada.descontoBps > 0 ? ` (${descontoAlcada.descontoBps} bps).` : ''}</AlertDescription></Alert>}
      {margemAlcada.anyAbaixo && <Alert {...buildComercialBannerA11yProps(margemAlcada.canSave ? 'polite' : 'error')} variant={margemAlcada.canSave ? 'default' : 'destructive'} className="border-amber-300" data-action="Comercial.orcamento.margem-alcada" data-testid="orcamento-margem-alcada-alert"><AlertCircle className="h-4 w-4" /><AlertDescription>{margemAlcada.hint}{margemAlcada.linesAbaixo > 0 ? ` (${margemAlcada.linesAbaixo} linha(s)).` : ''}</AlertDescription></Alert>}
      {canSimular && <div className="border rounded-md p-3 space-y-3 bg-slate-50" data-permission="Comercial.orcamento.visualizar" data-action="Comercial.simular-venda">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label htmlFor="orc-promo-bps">Promoção (bps)</Label><Input id="orc-promo-bps" inputMode="numeric" value={promoBps} placeholder="opcional" onChange={(e) => { setPromoBps(e.target.value); invalidateSimulacaoPreview(); }} /></div>
          <div><Label htmlFor="orc-promo-cupom">Cupom</Label><Input id="orc-promo-cupom" value={promoCupom} maxLength={64} placeholder="opcional" onChange={(e) => { setPromoCupom(e.target.value); invalidateSimulacaoPreview(); }} /></div>
          <Button type="button" variant="outline" aria-label={comercialActionAriaLabel('simular', { busy: simulating })} onClick={runSimularVenda} disabled={simulating || submitting || !contextReady || itemLinesGate.blockSimular} title={itemLinesGate.blockSimular ? (itemLinesGate.simularIssues[0]?.message || itemLinesGate.hint || undefined) : undefined}>{simulating ? 'Simulando...' : 'Simular venda'}</Button>
          <Button type="button" variant="secondary" onClick={applyLastSimulacao} disabled={!lastSimulation || simulating || submitting}>Aplicar preços da simulação</Button>
        </div>
        <p className="text-xs text-slate-500">A simulação usa preço e parcelas do servidor; ao salvar, o backend reaplica promoção/desconto/total (fail-closed). Totais do formulário são rascunho até a simulação.</p>
        {simularHttpError && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-simular-network-error" data-retryable="true" data-action="Comercial.simular-venda.retry"><AlertCircle className="h-4 w-4" /><AlertDescription className="flex flex-wrap items-center gap-2"><span>{buildSimularHttpErrorBannerText(simularHttpError, { entityLabel: 'Orçamento' })}</span><Button type="button" size="sm" variant="outline" aria-label={comercialActionAriaLabel('retry')} data-testid="orcamento-simular-retry" onClick={() => { void runSimularVenda(); }} disabled={simulating || submitting || itemLinesGate.blockSimular}><RefreshCw className="w-4 h-4 mr-1" />Tentar novamente</Button></AlertDescription></Alert>}
        {simulacaoDirtyGate.dirty && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-simulacao-dirty" data-action="Comercial.simular-venda.dirty"><AlertCircle className="h-4 w-4" /><AlertDescription>{simulacaoDirtyGate.hint}</AlertDescription></Alert>}
        {simulacaoPreview && <div className="space-y-2" data-testid="orcamento-parcela-schedule-preview" data-schedule-mode={parcelaScheduleUi.mode}>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">Condição: {simulacaoPreview.condicaoNome || simulacaoPreview.condicaoCodigo || simulacaoPreview.condicaoId}</Badge>
            <Badge variant="outline">Total simulado: {money(simulacaoPreview.total)}</Badge>
            {simulacaoPreview.promocao?.aplicada && <Badge>Promo {simulacaoPreview.promocao.bps} bps</Badge>}
            {(simulacaoPreview.aprovacaoDescontoExigida || descontoAlcada.aprovacaoExigida) && <Badge variant="secondary" data-testid="orcamento-desconto-alcada-badge">Exige aprovação de desconto</Badge>}
            {margemAlcada.aprovacaoExigida && <Badge variant="secondary" data-testid="orcamento-margem-alcada-badge">Exige aprovação de margem</Badge>}
          </div>
          {parcelaScheduleUi.mode === 'missing' && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-action="Comercial.parcela-schedule-missing" data-testid="orcamento-parcela-schedule-missing"><AlertCircle className="h-4 w-4" /><AlertDescription>{parcelaScheduleUi.hint}</AlertDescription></Alert>}
          {parcelaScheduleUi.mode === 'server' && parcelaScheduleUi.parcelas.length > 0 && <Table data-action="Comercial.parcela-schedule-preview"><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Dias</TableHead><TableHead>%</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{parcelaScheduleUi.parcelas.map((parcela) => <TableRow key={`${parcela.ordem}-${parcela.vencimento}`}><TableCell>{parcela.ordem}</TableCell><TableCell>{parcela.dias}</TableCell><TableCell>{parcela.percentual}</TableCell><TableCell>{parcela.vencimento}</TableCell><TableCell className="text-right">{money(parcela.valor)}</TableCell></TableRow>)}</TableBody></Table>}
        </div>}
      </div>}
      <DialogFooter><Button variant="outline" aria-label={comercialActionAriaLabel('fechar')} onClick={closeForm}>Fechar</Button><Button aria-label={comercialActionAriaLabel('salvar', { entityLabel: 'orçamento', busy: submitting })} onClick={save} disabled={submitting || mastersBlocked || validadeUi.blockSave || !descontoAlcada.canSave || !margemAlcada.canSave || simulacaoDirtyGate.blockSave || itemLinesGate.blockSave || observacoesUi.blockSave} title={validadeUi.blockSave ? (validadeUi.hint || undefined) : (observacoesUi.blockSave ? (observacoesUi.hint || undefined) : (itemLinesGate.blockSave ? (itemLinesGate.hint || undefined) : (simulacaoDirtyGate.blockSave ? (simulacaoDirtyGate.hint || undefined) : (!margemAlcada.canSave ? (margemAlcada.hint || undefined) : (!descontoAlcada.canSave ? (descontoAlcada.hint || undefined) : (mastersQuery.isError ? mastersBannerText : undefined))))))} data-action="Comercial.orcamento.salvar" data-permission={(descontoAlcada.aprovacaoExigida || margemAlcada.aprovacaoExigida) ? 'Comercial.orcamento.aprovar' : 'Comercial.orcamento.criar'}>{submitting ? 'Salvando...' : 'Salvar orçamento'}</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-4xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Orçamento {selected?.numero}</DialogTitle><DialogDescription>{selected?.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado'} · validade {date(selected?.validade_em)}{selectedConvertGate.validade ? ' · expirado' : ''}</DialogDescription></DialogHeader>{selected && <div className="space-y-4" data-testid="orcamento-detail-summary" data-detail-mode={orcamentoDetailSummary.mode} data-action="Comercial.orcamento.detail-summary">{orcamentoDetailSummary.mode === 'snapshot_gap' && orcamentoDetailSummary.hint && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-detail-snapshot-gap"><AlertCircle className="h-4 w-4" /><AlertDescription>{orcamentoDetailSummary.hint}</AlertDescription></Alert>}{selectedConvertGate.blockConvert && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-convert-blocked-banner" data-action="Comercial.orcamento.convert-blocked" data-convert-validade={selectedConvertGate.validade ? 'true' : 'false'} data-convert-snapshot={selectedConvertGate.snapshot ? 'true' : 'false'} data-convert-dirty={selectedConvertGate.dirty ? 'true' : 'false'} data-convert-simular={selectedConvertGate.simularDirty ? 'true' : 'false'}><AlertCircle className="h-4 w-4" /><AlertDescription>{selectedConvertGate.bannerText}</AlertDescription></Alert>}<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"><div><span className="text-slate-500">Cliente</span><p>{clienteLabel(selected.cliente_empresa_id)}</p></div><div><span className="text-slate-500">Condição</span><p>{selected.condicao_pagamento_nome_snapshot || condicaoLabel(selected.condicao_pagamento_id)}</p></div><div><span className="text-slate-500">Tabela</span><p>{selected.tabela_preco_nome_snapshot || selected.tabela_preco_id || '—'}</p></div><div><span className="text-slate-500">Criado</span><p>{date(selected.created_at)}</p></div><div><span className="text-slate-500">Atualizado</span><p>{date(selected.updated_at)}</p></div><div><span className="text-slate-500">Promoção</span><p>{orcamentoDetailSummary.fields?.promocaoAplicada ? 'Aplicada' : 'Não aplicada'}</p></div></div><p className="text-sm whitespace-pre-wrap">{selected.observacoes || 'Sem observações.'}</p><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Un.</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{selected.itens.map((item) => <TableRow key={item.id}><TableCell>{item.descricao}</TableCell><TableCell>{item.unidade_sigla}</TableCell><TableCell className="text-right">{item.quantidade}</TableCell><TableCell className="text-right">{money(item.preco_unitario)}</TableCell><TableCell className="text-right">{money(item.desconto)}</TableCell><TableCell className="text-right">{money(item.total)}</TableCell></TableRow>)}</TableBody></Table><div className="flex justify-end gap-5"><span>Subtotal: <strong>{money(selected.subtotal)}</strong></span><span>Desconto: <strong>{money(selected.desconto)}</strong></span><span>Total: <strong>{money(selected.total)}</strong></span></div></div>}<DialogFooter className="flex flex-wrap gap-2"><Button variant="outline" data-action="Comercial.orcamento.resumo-texto" data-testid="orcamento-resumo-texto-open" aria-label={comercialActionAriaLabel('resumo', { entityLabel: 'orçamento', numero: selected?.numero })} onClick={openOrcamentoResumo} disabled={!selected}><FileText className="w-4 h-4 mr-2" />Resumo texto</Button><Button variant="outline" data-action="Comercial.orcamento.imprimir-pdf" data-testid="orcamento-print-pdf" data-permission="Comercial.orcamento.imprimir" data-print-mode={printPdfGate.mode} aria-label={comercialActionAriaLabel('imprimir', { entityLabel: 'orçamento', numero: selected?.numero })} title={printPdfGate.blockPrint ? (printPdfGate.hint || 'Impressão bloqueada') : 'Imprimir/PDF'} disabled={!selected || printPdfGate.blockPrint} onClick={() => printOrcamento(selected)}><Printer className="w-4 h-4 mr-2" />Imprimir/PDF</Button><Button variant="outline" data-action="Comercial.orcamento.compartilhar-whatsapp" data-testid="orcamento-share-whatsapp" data-share-mode={shareGate.mode} title={shareGate.blockShare ? (shareGate.hint || 'Compartilhamento bloqueado') : 'Preparar texto para WhatsApp'} disabled={!selected || shareGate.blockShare} onClick={() => { void prepareShare(selected, 'WhatsApp'); }}><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</Button><Button variant="outline" data-action="Comercial.orcamento.compartilhar-email" data-testid="orcamento-share-email" data-share-mode={shareGate.mode} title={shareGate.blockShare ? (shareGate.hint || 'Compartilhamento bloqueado') : 'Preparar texto para e-mail'} disabled={!selected || shareGate.blockShare} onClick={() => { void prepareShare(selected, 'e-mail'); }}><Mail className="w-4 h-4 mr-2" />E-mail</Button>{canConvert && selected?.status === 'EM_ABERTO' && <Button aria-label={comercialActionAriaLabel('converter')} data-testid="orcamento-convert-open" onClick={() => { setConversion({ tipo_operacao: 'ENTREGA', data_entrega_solicitada: '' }); setPendingConversion(selected); }} disabled={selectedConvertGate.blockConvert} title={selectedConvertGate.title || undefined}><FilePlus2 className="w-4 h-4 mr-2" />Converter em pedido</Button>}{canEdit(selected) && <Button variant="outline" onClick={() => openEdit(selected)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>}{canCancel(selected) && <Button variant="destructive" aria-label={comercialActionAriaLabel('cancelar', { entityLabel: 'orçamento', numero: selected?.numero })} onClick={() => cancel(selected)} disabled={submitting}><XCircle className="w-4 h-4 mr-2" />Cancelar orçamento</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={resumoOpen} onOpenChange={setResumoOpen}><DialogContent className="max-w-3xl max-h-[90vh] overflow-auto" data-testid="orcamento-resumo-texto-dialog" data-resumo-mode={orcamentoResumoPreview.mode}><DialogHeader><DialogTitle>Resumo texto — Orçamento {selected?.numero}</DialogTitle><DialogDescription>Somente leitura a partir do documento carregado e snapshots. Sem módulo PDF novo.</DialogDescription></DialogHeader>{orcamentoResumoPreview.mode === 'blocked' && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-action="Comercial.orcamento.resumo-texto-blocked" data-testid="orcamento-resumo-texto-blocked"><AlertCircle className="h-4 w-4" /><AlertDescription>{orcamentoResumoPreview.hint}</AlertDescription></Alert>}{orcamentoResumoPreview.mode === 'invalid' && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-resumo-texto-invalid"><AlertCircle className="h-4 w-4" /><AlertDescription>{orcamentoResumoPreview.hint}</AlertDescription></Alert>}{orcamentoResumoPreview.mode === 'ready' && orcamentoResumoPreview.text && <pre className="text-xs whitespace-pre-wrap font-mono border rounded-md p-3 bg-slate-50 max-h-[55vh] overflow-auto" data-testid="orcamento-resumo-texto-body">{orcamentoResumoPreview.text}</pre>}<DialogFooter className="flex flex-wrap gap-2"><Button variant="outline" aria-label={comercialActionAriaLabel('fechar')} onClick={() => setResumoOpen(false)}>Fechar</Button><Button variant="outline" data-action="Comercial.orcamento.resumo-texto-copiar" disabled={!orcamentoResumoPreview.canCopy} onClick={() => { void copyOrcamentoResumo(); }}>Copiar</Button><Button data-action="Comercial.orcamento.resumo-texto-imprimir" disabled={!orcamentoResumoPreview.canPrint} onClick={printOrcamentoResumo}><Printer className="w-4 h-4 mr-2" />Imprimir texto</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(pendingConversion)} onOpenChange={(open) => { if (!open && !submitting) setPendingConversion(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Converter em pedido</DialogTitle><DialogDescription>O orçamento original será preservado e vinculado ao novo pedido.</DialogDescription></DialogHeader>{pendingConvertGate.blockConvert && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-convert-dialog-blocked-banner" data-action="Comercial.orcamento.convert-blocked" data-convert-validade={pendingConvertGate.validade ? 'true' : 'false'} data-convert-snapshot={pendingConvertGate.snapshot ? 'true' : 'false'} data-convert-dirty={pendingConvertGate.dirty ? 'true' : 'false'} data-convert-simular={pendingConvertGate.simularDirty ? 'true' : 'false'}><AlertCircle className="h-4 w-4" /><AlertDescription>{pendingConvertGate.bannerText}</AlertDescription></Alert>}<div className="space-y-3"><div><Label>Operação</Label><Select value={conversion.tipo_operacao} onValueChange={(value) => setConversion((current) => ({ ...current, tipo_operacao: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ENTREGA">Entrega</SelectItem><SelectItem value="RETIRADA">Retirada</SelectItem></SelectContent></Select></div><div><Label>Data solicitada pelo cliente{conversion.tipo_operacao === 'ENTREGA' ? ' *' : ''}</Label><Input type="date" data-testid="orcamento-convert-data-entrega" data-block-save={conversionDataEntregaGate.blockSave ? 'true' : 'false'} aria-invalid={conversionDataEntregaGate.blockSave ? 'true' : undefined} value={conversion.data_entrega_solicitada} onChange={(event) => setConversion((current) => ({ ...current, data_entrega_solicitada: event.target.value }))} />{conversionDataEntregaGate.blockSave && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" className="mt-2" data-testid="orcamento-convert-data-entrega-gate" data-action="Comercial.pedido.data-entrega"><AlertCircle className="h-4 w-4" /><AlertDescription>{conversionDataEntregaGate.hint}</AlertDescription></Alert>}</div></div><DialogFooter><Button variant="outline" onClick={() => setPendingConversion(null)} disabled={submitting}>Voltar</Button><Button aria-label={comercialActionAriaLabel('converter', { busy: submitting })} data-testid="orcamento-convert-confirm" onClick={convertToPedido} disabled={submitting || pendingConvertGate.blockConvert || conversionDataEntregaGate.blockSave} title={pendingConvertGate.title || (conversionDataEntregaGate.blockSave ? (conversionDataEntregaGate.hint || undefined) : undefined)}>{submitting ? 'Convertendo...' : 'Criar pedido'}</Button></DialogFooter></DialogContent></Dialog>    <Dialog open={Boolean(pendingCancel)} onOpenChange={(open) => { if (!open && !submitting) { setPendingCancel(null); setCancelMotivo(''); } }}><DialogContent className="max-w-md" data-testid="orcamento-cancel-dialog" data-action="Comercial.orcamento.cancelar"><DialogHeader><DialogTitle>Cancelar orçamento {pendingCancel?.numero}?</DialogTitle><DialogDescription>O registro e seus itens serão preservados. Informe o motivo (obrigatório).</DialogDescription></DialogHeader><div className="space-y-2"><div className="flex items-center justify-between gap-2"><Label htmlFor="orc-cancel-motivo">Motivo</Label><span className="text-xs text-slate-500 tabular-nums" data-testid="orcamento-cancel-motivo-counter" aria-live="polite">{cancelMotivoUi.counterLabel}</span></div><Textarea id="orc-cancel-motivo" data-testid="orcamento-cancel-motivo" maxLength={ORCAMENTO_CANCEL_MOTIVO_MAX} value={cancelMotivo} onChange={(e) => setCancelMotivo(clampOrcamentoCancelMotivo(e.target.value))} aria-invalid={cancelMotivoUi.blockConfirm ? 'true' : undefined} aria-describedby="orc-cancel-motivo-hint" rows={3} /><span className="sr-only" id="orc-cancel-motivo-hint">{cancelMotivoUi.hint || 'Mínimo 3 e máximo 500 caracteres.'}</span>{cancelMotivoUi.blockConfirm && cancelMotivo.trim() !== '' && <Alert {...buildComercialBannerA11yProps('error')} variant="destructive" data-testid="orcamento-cancel-motivo-gate"><AlertCircle className="h-4 w-4" /><AlertDescription>{cancelMotivoUi.hint}</AlertDescription></Alert>}</div><DialogFooter><Button variant="outline" onClick={() => { setPendingCancel(null); setCancelMotivo(''); }} disabled={submitting}>Voltar</Button><Button variant="destructive" data-testid="orcamento-cancel-confirm" aria-label={comercialActionAriaLabel('cancelar', { entityLabel: 'orçamento', numero: pendingCancel?.numero, busy: submitting })} disabled={submitting || cancelMotivoUi.blockConfirm} title={cancelMotivoUi.blockConfirm ? (cancelMotivoUi.hint || undefined) : undefined} onClick={() => { const row = pendingCancel; const motivo = cancelMotivoUi.motivo; setPendingCancel(null); setCancelMotivo(''); void performCancel(row, motivo); }}>{submitting ? 'Cancelando...' : 'Cancelar orçamento'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
