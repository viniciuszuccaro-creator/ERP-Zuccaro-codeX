import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Eye, FilePlus2, Mail, MessageCircle, Pencil, Plus, Printer, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import { createHttpApiClient } from '@/api/httpApiClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PaginationControls from '@/components/ui/PaginationControls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { buildOrcamentoPayload, buildOrcamentoShareText, calculateItem, calculateTotals, canUseOrcamentoAction, isOrcamentoValidadeExpirada, mapOrcamentoRowToForm, microsToDecimal, orcamentoConvertSnapshotHint, orcamentoValidadeHint } from './orcamentoUiPolicy';
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
  buildHttpListQueryKey,
  buildMastersHttpBannerText,
  buildOrcamentoListRequestParams,
  formatComercialHttpError,
  formatHttpListEmptyMessage,
  formatMasterPickerPlaceholder,
  hasActiveComercialListFilters,
  isMasterPickerBlocked,
  normalizeOrcamentoListFilters,
  resolveHttpListViewState,
  resolveHttpMasterPickerState,
} from './comercialListHttpUiPolicy';
import {
  beginSaveOnce,
  endSaveOnce,
  evaluateDescontoAlcadaUi,
} from './comercialDescontoAlcadaUiPolicy';
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
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(null);
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
  const validadeHint = orcamentoValidadeHint(form.validade_em);
  const selectedExpired = selected ? isOrcamentoValidadeExpirada(selected.validade_em) : false;
  const selectedSnapshotHint = selected ? orcamentoConvertSnapshotHint(selected) : null;
  const pendingExpired = pendingConversion ? isOrcamentoValidadeExpirada(pendingConversion.validade_em) : false;
  const pendingSnapshotHint = pendingConversion ? orcamentoConvertSnapshotHint(pendingConversion) : null;
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

  useEffect(() => {
    const clean = { ...ORCAMENTO_LIST_FILTER_DEFAULTS };
    setPage(1);
    setSelected(null);
    setDetailOpen(false);
    setFormOpen(false);
    setFilters(clean);
    setAppliedFilters(clean);
  }, [groupId, empresaId]);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const resetSimulacaoUi = () => {
    setSimulacaoPreview(null); setLastSimulation(null); setSimulacaoDirty(false); setPromoBps(''); setPromoCupom('');
    setCondicaoSnapshot(null);
    setTabelaSnapshot(null);
    setPromocaoSnapshot(null);
  };
  const invalidateSimulacaoPreview = () => {
    setSimulacaoPreview(null);
    setLastSimulation(null);
    setSimulacaoDirty(true);
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
    return snaps;
  };
  const closeForm = () => {
    if (dirty && !window.confirm('Descartar as alterações deste orçamento?')) return;
    setFormOpen(false); setDirty(false); setEditing(null); resetSimulacaoUi();
  };
  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDirty(false); resetSimulacaoUi(); setFormOpen(true); };
  const openEdit = (row) => {
    if (!canEdit(row)) return;
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
  const parcelaScheduleUi = useMemo(
    () => resolveParcelaScheduleUiState({ simulacaoPreview, condicaoSnapshot }),
    [simulacaoPreview, condicaoSnapshot],
  );
  const simulacaoDirtyGate = useMemo(
    () => evaluateSimulacaoDirtySaveGate({ simulacaoDirty, canSimular }),
    [simulacaoDirty, canSimular],
  );
  const runSimularVenda = async () => {
    if (!canSimular || simulating || submitting) return;
    setSimulating(true);
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
      toast.success('Simulação atualizada com preços e parcelas do servidor.');
    } catch (error) {
      setLastSimulation(null);
      setSimulacaoPreview(null);
      setSimulacaoDirty(true);
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
  const performCancel = async (row) => {
    if (!row || submitting) return;
    setSubmitting(true);
    try {
      const cancelled = await api.cancel(row.id); setSelected(cancelled);
      toast.success('Orçamento cancelado e preservado.');
      await queryClient.invalidateQueries({ queryKey: ['orcamentos-http', groupId, empresaId] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };
  const cancel = (row) => {
    if (!canCancel(row) || submitting) return;
    setPendingCancel(row);
  };
const convertToPedido = async () => {
    if (!pendingConversion || submitting) return;
    if (isOrcamentoValidadeExpirada(pendingConversion.validade_em)) {
      toast.error('Validade expirada — altere a data antes de converter.');
      return;
    }
    const snapshotGap = orcamentoConvertSnapshotHint(pendingConversion);
    if (snapshotGap) {
      toast.error(snapshotGap);
      return;
    }
    if (!conversion.data_entrega_solicitada) { toast.error('Informe a data solicitada pelo cliente.'); return; }
    setSubmitting(true);
    try {
      await pedidosApi.convertOrcamento(pendingConversion.id, { tipo_operacao: conversion.tipo_operacao, data_entrega_solicitada: new Date(`${conversion.data_entrega_solicitada}T12:00:00`).toISOString() });
      toast.success('Orçamento convertido em pedido.'); setPendingConversion(null); setDetailOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['pedidos-http', groupId, empresaId] });
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSubmitting(false); }
  };
  const printOrcamento = (row) => {
    const opened = gerarPDFOrcamento(row, { empresa: empresaAtual, clienteNome: clienteLabel(row.cliente_empresa_id), condicaoPagamento: condicaoLabel(row.condicao_pagamento_id) });
    if (!opened) toast.error('Permita a abertura da janela de impressão para gerar o PDF.');
  };
  const prepareShare = async (row, channel) => {
    const text = buildOrcamentoShareText(row, { empresaNome: empresaAtual?.razao_social || empresaAtual?.nome_fantasia || empresaAtual?.nome || 'Empresa', clienteNome: clienteLabel(row.cliente_empresa_id) });
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Texto para ${channel} copiado. Revise antes de enviar.`);
    } catch {
      toast.error('Não foi possível copiar o texto. Use a visualização de impressão.');
    }
  };

  if (!canView) return <div className="w-full h-full flex items-center justify-center p-6"><Alert className="max-w-lg"><AlertCircle className="h-4 w-4" /><AlertDescription>Acesso negado aos Orçamentos.</AlertDescription></Alert></div>;
  const rows = listQuery.data?.data || [];
  const listHasActiveFilters = hasActiveComercialListFilters(appliedFilters, ORCAMENTO_LIST_FILTER_DEFAULTS);
  const listEmptyMessage = formatHttpListEmptyMessage({
    entityLabel: 'orçamento',
    hasActiveFilters: listHasActiveFilters,
  });
  const listView = resolveHttpListViewState({ isLoading: listQuery.isLoading, isError: listQuery.isError, rowCount: rows.length });
  const meta = listQuery.data?.meta || { total: 0 };
  return <div className={`w-full h-full flex flex-col bg-slate-50 ${windowMode ? 'p-3' : 'p-4'}`} data-permission="Comercial.orcamento.visualizar">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div><h2 className="text-xl font-semibold">Orçamentos</h2><p className="text-sm text-slate-500">Propostas comerciais da empresa ativa</p></div>
      {canCreate && <Button onClick={openCreate} disabled={!contextReady} data-permission="Comercial.orcamento.criar"><FilePlus2 className="w-4 h-4 mr-2" />Novo orçamento</Button>}
    </div>
    {!contextReady && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Selecione uma empresa e entre com um usuário válido.</AlertDescription></Alert>}
    {(mastersQuery.isLoading || mastersQuery.isError) && <Alert variant={mastersQuery.isError ? 'destructive' : 'default'} className="mb-3" data-testid="orcamento-masters-error"><AlertCircle className="h-4 w-4" /><AlertDescription className="flex flex-wrap items-center gap-2"><span>{mastersBannerText}</span>{mastersQuery.isError && <Button type="button" size="sm" variant="outline" onClick={() => mastersQuery.refetch()}><RefreshCw className="w-4 h-4 mr-1" />Tentar novamente</Button>}</AlertDescription></Alert>}
    <form className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedFilters(normalizeOrcamentoListFilters(filters)); }}>
      <div className="md:col-span-2"><Label htmlFor="orc-search" className="sr-only">Pesquisar número</Label><Input id="orc-search" value={filters.search} maxLength={80} placeholder="Pesquisar número" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></div>
      <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}><SelectTrigger aria-label="Filtrar status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="EM_ABERTO">Em aberto</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select>
      <Select value={filters.clienteEmpresaId} onValueChange={(value) => setFilters((current) => ({ ...current, clienteEmpresaId: value }))} disabled={mastersBlocked || clientePickerState === 'denied'}><SelectTrigger aria-label="Filtrar cliente"><SelectValue placeholder={formatMasterPickerPlaceholder(clientePickerState, 'cliente')} /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os clientes</SelectItem>{masters.clientesEmpresa.map((item) => <SelectItem key={item.id} value={item.id}>{clienteLabel(item.id)}</SelectItem>)}</SelectContent></Select>
      <div className="grid grid-cols-2 gap-2"><Input aria-label="Validade inicial" type="date" value={filters.validadeDe} onChange={(event) => setFilters((current) => ({ ...current, validadeDe: event.target.value }))} /><Input aria-label="Validade final" type="date" value={filters.validadeAte} onChange={(event) => setFilters((current) => ({ ...current, validadeAte: event.target.value }))} /></div>
      <div className="flex gap-2"><Button type="submit" variant="outline" className="flex-1"><Search className="w-4 h-4 mr-2" />Filtrar</Button><Button type="button" size="icon" variant="ghost" title="Limpar filtros" onClick={() => { const clean = { ...ORCAMENTO_LIST_FILTER_DEFAULTS }; setFilters(clean); setAppliedFilters(clean); setPage(1); }}><RefreshCw className="w-4 h-4" /></Button></div>
    </form>
    {listView === 'loading' ? <div className="flex-1 flex items-center justify-center">Carregando orçamentos...</div> : listView === 'error' ? <div className="flex-1 flex flex-col items-center justify-center gap-3" data-testid="orcamento-list-error"><p>{errorMessage(listQuery.error)}</p><Button variant="outline" onClick={() => listQuery.refetch()}><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button></div> : listView === 'empty' ? <div className="flex-1 flex flex-col items-center justify-center text-slate-500" data-testid="orcamento-list-empty" data-empty-filtered={listHasActiveFilters ? 'true' : 'false'}><FilePlus2 className="w-10 h-10 mb-2" /><p>{listEmptyMessage}</p></div> : <div className="flex-1 min-h-0 overflow-auto border bg-white rounded-md">
      <Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Cliente</TableHead><TableHead>Criado</TableHead><TableHead>Validade</TableHead><TableHead>Itens</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-mono">{row.numero}</TableCell><TableCell>{clienteLabel(row.cliente_empresa_id)}</TableCell><TableCell>{date(row.created_at)}</TableCell><TableCell><span className="inline-flex items-center gap-1">{date(row.validade_em)}{isOrcamentoValidadeExpirada(row.validade_em) && <Badge variant="destructive">Expirado</Badge>}</span></TableCell><TableCell>{row.itens?.length || 0}</TableCell><TableCell className="text-right">{money(row.subtotal)}</TableCell><TableCell className="text-right">{money(row.desconto)}</TableCell><TableCell className="text-right font-semibold">{money(row.total)}</TableCell><TableCell><Badge variant={row.status === 'EM_ABERTO' ? 'default' : 'secondary'}>{row.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado'}</Badge></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Visualizar" onClick={() => showDetail(row)}><Eye className="w-4 h-4" /></Button>{canEdit(row) && <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(row)}><Pencil className="w-4 h-4" /></Button>}{canCancel(row) && <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancel(row)}><XCircle className="w-4 h-4" /></Button>}</div></TableCell></TableRow>)}</TableBody></Table>
    </div>}
    <PaginationControls currentPage={page} totalItems={meta.total || 0} itemsPerPage={pageSize} onPageChange={setPage} onItemsPerPageChange={setPageSize} isLoading={listQuery.isFetching} />

    <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}><DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-auto"><DialogHeader><DialogTitle>{editing ? `Editar orçamento ${editing.numero}` : 'Novo orçamento'}</DialogTitle><DialogDescription>Os totais serão conferidos novamente pelo servidor.</DialogDescription></DialogHeader>
      {(mastersQuery.isLoading || mastersQuery.isError) && <Alert variant={mastersQuery.isError ? 'destructive' : 'default'} className="mb-3" data-testid="orcamento-masters-form-banner"><AlertCircle className="h-4 w-4" /><AlertDescription className="flex flex-wrap items-center gap-2"><span>{mastersBannerText}</span>{mastersQuery.isError && <Button type="button" size="sm" variant="outline" onClick={() => mastersQuery.refetch()}><RefreshCw className="w-4 h-4 mr-1" />Tentar novamente</Button>}</AlertDescription></Alert>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3"><div className="md:col-span-2"><Label htmlFor="orc-cliente">Cliente</Label><Select value={form.cliente_empresa_id} onValueChange={(v) => { void changeClienteEmpresa(v); }} disabled={mastersBlocked || clientePickerState === 'denied'}><SelectTrigger id="orc-cliente" data-testid="orcamento-cliente-picker" data-picker-state={clientePickerState}><SelectValue placeholder={formatMasterPickerPlaceholder(clientePickerState, 'cliente')} /></SelectTrigger><SelectContent>{masters.clientesEmpresa.filter((item) => item.ativo !== false && item.habilitado_operacao !== false && item.bloqueado !== true).map((item) => <SelectItem key={item.id} value={item.id}>{clienteLabel(item.id)}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-condicao">Condição de pagamento</Label><Select value={form.condicao_pagamento_id} onValueChange={(v) => changeForm('condicao_pagamento_id', v)} disabled={mastersBlocked || condicaoPickerState === 'denied' || resolvingCondicao}><SelectTrigger id="orc-condicao" data-testid="orcamento-condicao-picker" data-picker-state={condicaoPickerState}><SelectValue placeholder={resolvingCondicao ? 'Resolvendo...' : formatMasterPickerPlaceholder(condicaoPickerState, 'condição')} /></SelectTrigger><SelectContent>{masters.condicoes.filter((item) => item.ativo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome || item.codigo}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-validade">Validade</Label><Input id="orc-validade" type="date" value={form.validade_em} onChange={(e) => changeForm('validade_em', e.target.value)} aria-invalid={Boolean(validadeHint && form.validade_em)} /><p className={`text-xs mt-1 ${validadeHint && form.validade_em ? 'text-amber-700' : 'text-slate-500'}`} data-action="Comercial.orcamento.validade-hint">{validadeHint || 'Proposta válida até o meio-dia desta data (servidor bloqueia se expirada).'}</p></div><div className="md:col-span-4"><Label htmlFor="orc-observacoes">Observações</Label><Textarea id="orc-observacoes" value={form.observacoes} onChange={(e) => changeForm('observacoes', e.target.value)} /></div></div>
      {condicaoSnapshot?.parcelas?.length > 0 && <div className="border rounded-md p-3 space-y-2 bg-white" data-action="Comercial.condicao-snapshot-preview" data-testid="orcamento-condicao-snapshot" data-persistido={condicaoSnapshot.persistido ? 'true' : 'false'}><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Resolução: {condicaoSnapshot.fonte || 'manual'}</Badge><Badge variant="outline">{condicaoSnapshot.nome || condicaoSnapshot.codigo || condicaoSnapshot.id}</Badge>{condicaoSnapshot.persistido && <Badge variant="secondary">Persistido</Badge>}<span className="text-xs text-slate-500">{condicaoSnapshot.persistido ? 'Snapshot recarregado do servidor após salvar (id+codigo+nome+parcelas).' : 'Pré-visualização — ao salvar, o servidor persiste snapshot id+nome+parcelas (não-retroativo).'}</span></div><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Dias</TableHead><TableHead>%</TableHead></TableRow></TableHeader><TableBody>{condicaoSnapshot.parcelas.map((parcela) => <TableRow key={`${parcela.ordem}-${parcela.dias}-${parcela.percentual}`}><TableCell>{parcela.ordem}</TableCell><TableCell>{parcela.dias}</TableCell><TableCell>{parcela.percentual}</TableCell></TableRow>)}</TableBody></Table>{parcelaScheduleUi.mode === 'template' && <p className="text-xs text-slate-500" data-testid="orcamento-parcela-template-hint">{parcelaScheduleUi.hint}</p>}</div>}
      {tabelaSnapshot?.id && <div className="border rounded-md p-3 bg-white" data-action="Comercial.tabela-snapshot-preview" data-testid="orcamento-tabela-snapshot" data-persistido={tabelaSnapshot.persistido ? 'true' : 'false'}><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Tabela: {tabelaSnapshot.fonte || 'manual'}</Badge><Badge variant="outline">{tabelaSnapshot.nome || tabelaSnapshot.codigo || tabelaSnapshot.id}</Badge>{tabelaSnapshot.persistido && <Badge variant="secondary">Persistido</Badge>}<span className="text-xs text-slate-500">{tabelaSnapshot.persistido ? 'Snapshot codigo+nome recarregado do servidor após salvar.' : 'Snapshot codigo+nome persistido pelo servidor (não-retroativo).'}</span></div></div>}
      {promocaoSnapshot?.persistido && <div className="border rounded-md p-3 bg-white" data-action="Comercial.promocao-snapshot-preview" data-testid="orcamento-promocao-snapshot" data-persistido="true"><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Promoção: persistido</Badge>{promocaoSnapshot.aplicada ? <Badge>Promo {promocaoSnapshot.bps} bps{promocaoSnapshot.cupom ? ` · ${promocaoSnapshot.cupom}` : ''}</Badge> : <Badge variant="secondary">Sem promoção</Badge>}<span className="text-xs text-slate-500">Snapshot de promoção recarregado do servidor após salvar (migration 030).</span></div></div>}
      <div className="space-y-2"><div className="flex justify-between"><h3 className="font-semibold">Itens</h3><Button type="button" variant="outline" size="sm" onClick={() => changeForm('itens', [...form.itens, emptyItem()])}><Plus className="w-4 h-4 mr-1" />Item</Button></div>{form.itens.map((item, index) => { let itemTotals = { subtotal: '0', total: '0' }; try { itemTotals = calculateItem(item); } catch { itemTotals = { subtotal: '0', total: '0' }; } return <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 border rounded-md p-2"><div className="md:col-span-3"><Label>Produto</Label><Select value={item.produto_id} onValueChange={(v) => { void selectProduct(index, v); }} disabled={mastersBlocked || produtoPickerState === 'denied' || resolvingPreco}><SelectTrigger data-testid={index === 0 ? 'orcamento-produto-picker' : undefined} data-picker-state={produtoPickerState}><SelectValue placeholder={resolvingPreco ? 'Resolvendo preço...' : formatMasterPickerPlaceholder(produtoPickerState, 'produto')} /></SelectTrigger><SelectContent>{masters.produtos.filter((p) => p.ativo !== false).map((p) => <SelectItem key={p.id} value={p.id}>{produtoLabel(p)}</SelectItem>)}</SelectContent></Select></div><div className="md:col-span-3"><Label>Descrição</Label><Input value={item.descricao} onChange={(e) => changeItem(index, 'descricao', e.target.value)} /></div><div><Label>Unidade</Label><Input value={item.unidade_sigla} readOnly /></div><div><Label>Quantidade</Label><Input inputMode="decimal" value={item.quantidade} onChange={(e) => changeItem(index, 'quantidade', e.target.value)} /></div><div><Label>Preço</Label><Input inputMode="decimal" value={item.preco_unitario} onChange={(e) => changeItem(index, 'preco_unitario', e.target.value)} /></div><div><Label>Desconto</Label><Input inputMode="decimal" value={item.desconto} onChange={(e) => changeItem(index, 'desconto', e.target.value)} /></div><div><Label>Total</Label><div className="h-10 flex items-center font-medium">{money(itemTotals.total)}</div></div><div className="flex items-end"><Button type="button" size="icon" variant="ghost" title="Remover item" disabled={form.itens.length === 1} onClick={() => changeForm('itens', form.itens.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button></div></div>; })}</div>
      <div className="flex justify-end gap-5 text-sm"><span>Subtotal: <strong>{money(totals.subtotal)}</strong></span><span>Desconto: <strong>{money(totals.desconto)}</strong></span><span>Total: <strong>{money(totals.total)}</strong></span></div>
      {descontoAlcada.excedeu && <Alert variant={descontoAlcada.canSave ? 'default' : 'destructive'} className="border-amber-300" data-action="Comercial.orcamento.desconto-alcada" data-testid="orcamento-desconto-alcada-alert"><AlertCircle className="h-4 w-4" /><AlertDescription>{descontoAlcada.hint}{descontoAlcada.descontoBps > 0 ? ` (${descontoAlcada.descontoBps} bps).` : ''}</AlertDescription></Alert>}
      {canSimular && <div className="border rounded-md p-3 space-y-3 bg-slate-50" data-permission="Comercial.orcamento.visualizar" data-action="Comercial.simular-venda">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label htmlFor="orc-promo-bps">Promoção (bps)</Label><Input id="orc-promo-bps" inputMode="numeric" value={promoBps} placeholder="opcional" onChange={(e) => { setPromoBps(e.target.value); invalidateSimulacaoPreview(); }} /></div>
          <div><Label htmlFor="orc-promo-cupom">Cupom</Label><Input id="orc-promo-cupom" value={promoCupom} maxLength={64} placeholder="opcional" onChange={(e) => { setPromoCupom(e.target.value); invalidateSimulacaoPreview(); }} /></div>
          <Button type="button" variant="outline" onClick={runSimularVenda} disabled={simulating || submitting || !contextReady}>{simulating ? 'Simulando...' : 'Simular venda'}</Button>
          <Button type="button" variant="secondary" onClick={applyLastSimulacao} disabled={!lastSimulation || simulating || submitting}>Aplicar preços da simulação</Button>
        </div>
        <p className="text-xs text-slate-500">A simulação usa preço e parcelas do servidor; ao salvar, o backend reaplica promoção/desconto/total (fail-closed). Totais do formulário são rascunho até a simulação.</p>
        {simulacaoDirtyGate.dirty && <Alert variant="destructive" data-testid="orcamento-simulacao-dirty" data-action="Comercial.simular-venda.dirty"><AlertCircle className="h-4 w-4" /><AlertDescription>{simulacaoDirtyGate.hint}</AlertDescription></Alert>}
        {simulacaoPreview && <div className="space-y-2" data-testid="orcamento-parcela-schedule-preview" data-schedule-mode={parcelaScheduleUi.mode}>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">Condição: {simulacaoPreview.condicaoNome || simulacaoPreview.condicaoCodigo || simulacaoPreview.condicaoId}</Badge>
            <Badge variant="outline">Total simulado: {money(simulacaoPreview.total)}</Badge>
            {simulacaoPreview.promocao?.aplicada && <Badge>Promo {simulacaoPreview.promocao.bps} bps</Badge>}
            {(simulacaoPreview.aprovacaoDescontoExigida || descontoAlcada.aprovacaoExigida) && <Badge variant="secondary" data-testid="orcamento-desconto-alcada-badge">Exige aprovação de desconto</Badge>}
          </div>
          {parcelaScheduleUi.mode === 'missing' && <Alert variant="destructive" data-action="Comercial.parcela-schedule-missing" data-testid="orcamento-parcela-schedule-missing"><AlertCircle className="h-4 w-4" /><AlertDescription>{parcelaScheduleUi.hint}</AlertDescription></Alert>}
          {parcelaScheduleUi.mode === 'server' && parcelaScheduleUi.parcelas.length > 0 && <Table data-action="Comercial.parcela-schedule-preview"><TableHeader><TableRow><TableHead>#</TableHead><TableHead>Dias</TableHead><TableHead>%</TableHead><TableHead>Vencimento</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{parcelaScheduleUi.parcelas.map((parcela) => <TableRow key={`${parcela.ordem}-${parcela.vencimento}`}><TableCell>{parcela.ordem}</TableCell><TableCell>{parcela.dias}</TableCell><TableCell>{parcela.percentual}</TableCell><TableCell>{parcela.vencimento}</TableCell><TableCell className="text-right">{money(parcela.valor)}</TableCell></TableRow>)}</TableBody></Table>}
        </div>}
      </div>}
      <DialogFooter><Button variant="outline" onClick={closeForm}>Fechar</Button><Button onClick={save} disabled={submitting || mastersBlocked || Boolean(validadeHint && form.validade_em) || !descontoAlcada.canSave || simulacaoDirtyGate.blockSave} title={simulacaoDirtyGate.blockSave ? (simulacaoDirtyGate.hint || undefined) : (!descontoAlcada.canSave ? (descontoAlcada.hint || undefined) : (mastersQuery.isError ? mastersBannerText : undefined))} data-action="Comercial.orcamento.salvar" data-permission={descontoAlcada.aprovacaoExigida ? 'Comercial.orcamento.aprovar' : 'Comercial.orcamento.criar'}>{submitting ? 'Salvando...' : 'Salvar orçamento'}</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent className="max-w-4xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Orçamento {selected?.numero}</DialogTitle><DialogDescription>{selected?.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado'} · validade {date(selected?.validade_em)}{selectedExpired ? ' · expirado' : ''}</DialogDescription></DialogHeader>{selected && <div className="space-y-4">{selectedExpired && <Alert data-action="Comercial.orcamento.validade-hint"><AlertCircle className="h-4 w-4" /><AlertDescription>Validade expirada — edite a data antes de converter em pedido.</AlertDescription></Alert>}{selectedSnapshotHint && <Alert data-action="Comercial.orcamento.convert-snapshot-hint"><AlertCircle className="h-4 w-4" /><AlertDescription>{selectedSnapshotHint}</AlertDescription></Alert>}<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"><div><span className="text-slate-500">Cliente</span><p>{clienteLabel(selected.cliente_empresa_id)}</p></div><div><span className="text-slate-500">Condição</span><p>{selected.condicao_pagamento_nome_snapshot || condicaoLabel(selected.condicao_pagamento_id)}</p></div><div><span className="text-slate-500">Tabela</span><p>{selected.tabela_preco_nome_snapshot || selected.tabela_preco_id || '—'}</p></div><div><span className="text-slate-500">Criado</span><p>{date(selected.created_at)}</p></div><div><span className="text-slate-500">Atualizado</span><p>{date(selected.updated_at)}</p></div></div><p className="text-sm whitespace-pre-wrap">{selected.observacoes || 'Sem observações.'}</p><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Un.</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{selected.itens.map((item) => <TableRow key={item.id}><TableCell>{item.descricao}</TableCell><TableCell>{item.unidade_sigla}</TableCell><TableCell className="text-right">{item.quantidade}</TableCell><TableCell className="text-right">{money(item.preco_unitario)}</TableCell><TableCell className="text-right">{money(item.desconto)}</TableCell><TableCell className="text-right">{money(item.total)}</TableCell></TableRow>)}</TableBody></Table><div className="flex justify-end gap-5"><span>Subtotal: <strong>{money(selected.subtotal)}</strong></span><span>Desconto: <strong>{money(selected.desconto)}</strong></span><span>Total: <strong>{money(selected.total)}</strong></span></div></div>}<DialogFooter className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => printOrcamento(selected)}><Printer className="w-4 h-4 mr-2" />Imprimir/PDF</Button><Button variant="outline" title="Preparar texto para WhatsApp" onClick={() => prepareShare(selected, 'WhatsApp')}><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</Button><Button variant="outline" title="Preparar texto para e-mail" onClick={() => prepareShare(selected, 'e-mail')}><Mail className="w-4 h-4 mr-2" />E-mail</Button>{canConvert && selected?.status === 'EM_ABERTO' && <Button onClick={() => { setConversion({ tipo_operacao: 'ENTREGA', data_entrega_solicitada: '' }); setPendingConversion(selected); }} disabled={selectedExpired || Boolean(selectedSnapshotHint)} title={selectedExpired ? 'Validade expirada' : (selectedSnapshotHint || undefined)}><FilePlus2 className="w-4 h-4 mr-2" />Converter em pedido</Button>}{canEdit(selected) && <Button variant="outline" onClick={() => openEdit(selected)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>}{canCancel(selected) && <Button variant="destructive" onClick={() => cancel(selected)} disabled={submitting}><XCircle className="w-4 h-4 mr-2" />Cancelar orçamento</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(pendingConversion)} onOpenChange={(open) => { if (!open && !submitting) setPendingConversion(null); }}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Converter em pedido</DialogTitle><DialogDescription>O orçamento original será preservado e vinculado ao novo pedido.</DialogDescription></DialogHeader>{pendingExpired && <Alert data-action="Comercial.orcamento.validade-hint"><AlertCircle className="h-4 w-4" /><AlertDescription>Validade expirada — altere a data do orçamento antes de converter.</AlertDescription></Alert>}{pendingSnapshotHint && <Alert data-action="Comercial.orcamento.convert-snapshot-hint"><AlertCircle className="h-4 w-4" /><AlertDescription>{pendingSnapshotHint}</AlertDescription></Alert>}<div className="space-y-3"><div><Label>Operação</Label><Select value={conversion.tipo_operacao} onValueChange={(value) => setConversion((current) => ({ ...current, tipo_operacao: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ENTREGA">Entrega</SelectItem><SelectItem value="RETIRADA">Retirada</SelectItem></SelectContent></Select></div><div><Label>Data solicitada pelo cliente</Label><Input type="date" value={conversion.data_entrega_solicitada} onChange={(event) => setConversion((current) => ({ ...current, data_entrega_solicitada: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setPendingConversion(null)} disabled={submitting}>Voltar</Button><Button onClick={convertToPedido} disabled={submitting || pendingExpired || Boolean(pendingSnapshotHint)}>{submitting ? 'Convertendo...' : 'Criar pedido'}</Button></DialogFooter></DialogContent></Dialog>    <ConfirmDialog
      open={Boolean(pendingCancel)}
      onOpenChange={(open) => { if (!open) setPendingCancel(null); }}
      onConfirm={() => { const row = pendingCancel; setPendingCancel(null); void performCancel(row); }}
      title="Cancelar orçamento?"
      description="O registro e seus itens serão preservados, mas não poderão mais ser editados."
      confirmText="Cancelar orçamento"
      variant="warning"
    />
  </div>;
}
