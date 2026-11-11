import OrcamentoProposalAside, { PROPOSTA_CAPACIDADES } from './OrcamentoProposalAside';
import { createComercialProposalFixture } from './comercialProposalFixture';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Eye, FilePlus2, Mail, MessageCircle, MoreHorizontal, Pencil, Plus, Printer, RefreshCw, Search, Send, SlidersHorizontal, Trash2, XCircle } from 'lucide-react';
import { createHttpApiClient } from '@/api/httpApiClient';
import { readErpHttpSession } from '@/api/erpHttpSession';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PaginationControls from '@/components/ui/PaginationControls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { buildOrcamentoPayload, buildOrcamentoShareText, calculateItem, calculateTotals, canUseOrcamentoAction, createOrcamentoActionGate, mapOrcamentoRowToCreateDraft, microsToDecimal, revalidateOrcamentoDraftAgainstMasters, sameOrcamentoScope } from './orcamentoUiPolicy';
import { explainPedidoPersistenceError } from './pedidoUiPolicy';
import {
  clienteEmpresaPickerLabel,
  filterClienteEmpresaOptions,
  filterProdutoOptions,
  clienteHydrationSettlementKey,
  collectSettledClienteHydration,
  mergeComercialSelectedCliente,
  nextClienteHydrationBatch,
  ORCAMENTO_PERSISTENCE_GAPS,
  produtoPickerLabel,
  resolveComercialMasterPages,
  resolveComercialSelectedCliente,
  unionComercialClienteCatalog,
} from './comercialMasterPicker';
import { gerarPDFOrcamento } from '@/components/lib/exportacaoPDF';
import { isCanonicalComercialId } from './centralCliente360Navigation';
import ValidadorEstoquePedido, { conversionStockOkFromAvailability } from './ValidadorEstoquePedido';
import {
  CENTRAL_VENDAS360_COLUMNS,
  readCentralColumnHiddenKeys,
  sumCentralPesoKg,
  writeCentralColumnHiddenKeys,
} from './centralVendas360Layout';

const emptyItem = () => ({ produto_id: '', unidade_id: '', descricao: '', unidade_sigla: '', quantidade: '1', preco_unitario: '0', desconto: '0' });
const emptyForm = () => ({ cliente_empresa_id: '', condicao_pagamento_id: '', tabela_preco_id: '', validade_em: '', observacoes: '', itens: [emptyItem()] });
const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : '-';
const errorMessage = (error) => {
  // Conversão orçamento→pedido pode falhar por schema 044 no destino — não mascarar.
  const pedidoSchema = explainPedidoPersistenceError(error);
  if (pedidoSchema) return pedidoSchema;
  if (error?.message === 'COMERCIAL_REFERENCE_PAGINATION_REQUIRED') return 'Catalogo auxiliar incompleto para esta selecao.';
  if (error?.message === 'COMERCIAL_MASTERS_INVALID') return 'Nao foi possivel validar os cadastros vinculados nesta empresa.';
  if (error?.status === 403) return 'Seu perfil não possui permissão para esta ação.';
  if (error?.status === 404) return 'Orçamento não encontrado neste contexto.';
  if (error?.status === 409) return 'O orçamento foi alterado e não está mais em aberto.';
  if (error?.status === 422) return error?.body?.error?.message || 'Revise os dados informados.';
  if (error?.status === 400) return 'Contexto ou identificador inválido.';
  return 'Não foi possível comunicar com o servidor. Tente novamente.';
};

// Cache generations never contain credentials and are unique across remounts.
let orcamentoSessionSequence = 0;

export default function OrcamentosTab({
  groupId,
  empresaId,
  actorId,
  actorEmail,
  sessionToken = undefined,
  empresaAtual,
  hasPermission,
  filterInContext,
  windowMode = false,
  initialSelectedId = null,
  reopenRequestId = null,
  initialCreateClienteEmpresaId = null,
  createRequestId = null,
  proposalMode = false,
  /** Embutido na Central de Vendas360° (versão 6) — sem chrome duplicado. */
  centralLayout = false,
  centralSituacao = null,
  centralSearch = '',
  onCentralSelect = null,
  selectedCentralId = null,
}) {
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
  const actionGate = useRef(createOrcamentoActionGate());
  const initialOpened = useRef(null);
  const initialCreateOpened = useRef(null);
  const detailRequest = useRef(0);
  const formScope = useRef(null);
  const cancelScope = useRef(null);
  const conversionScope = useRef(null);
  const renderedScope = useRef(null);
  const sessionIdentity = sessionToken || readErpHttpSession()?.token || null;
  const sessionCacheGeneration = useMemo(() => ++orcamentoSessionSequence, [sessionIdentity]);
  renderedScope.current = { groupId, empresaId, actorId, token: sessionIdentity };
  const activeScope = () => readErpHttpSession();
  const beginAction = (opened) => {
    const ticket = actionGate.current.begin(opened, renderedScope.current, activeScope());
    if (!ticket) { toast.error('Contexto alterado ou operação em andamento. Reabra o orçamento.'); return null; }
    setSubmitting(true);
    return ticket;
  };
  const actionCurrent = (ticket) => actionGate.current.isCurrent(ticket, renderedScope.current, activeScope());
  const endAction = (ticket) => { if (actionGate.current.end(ticket)) setSubmitting(false); };
  const [pendingCancel, setPendingCancel] = useState(null);
  const [pendingConversion, setPendingConversion] = useState(null);
  const [conversion, setConversion] = useState({ tipo_operacao: 'ENTREGA', data_entrega_solicitada: '' });
  const [conversionStockOk, setConversionStockOk] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' });
  const [appliedFilters, setAppliedFilters] = useState({ search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' });
  const [clienteQuery, setClienteQuery] = useState('');
  const [produtoQuery, setProdutoQuery] = useState('');
  /** Preferências de colunas Central: escopo actor+grupo+empresa (sem compartilhar). */
  const [centralHiddenColumns, setCentralHiddenColumns] = useState(() => new Set());
  /** Proposta visual: A lista → B edição → C acompanhamento (sintético; sem save/convert). */
  const [proposalStage, setProposalStage] = useState('lista');
  // Pesquisa universal da Central → filtros da listagem (sem gravação).
  useEffect(() => {
    if (!centralLayout) return undefined;
    const nextSearch = String(centralSearch || '').slice(0, 80);
    setFilters((prev) => (prev.search === nextSearch ? prev : { ...prev, search: nextSearch }));
    setAppliedFilters((prev) => (prev.search === nextSearch ? prev : { ...prev, search: nextSearch }));
    setPage(1);
    return undefined;
  }, [centralLayout, centralSearch]);
  useEffect(() => {
    if (!centralLayout) return undefined;
    if (centralSituacao === 'VENCIDOS') {
      const today = new Date().toISOString().slice(0, 10);
      setFilters((prev) => ({ ...prev, status: 'EM_ABERTO', validadeAte: today }));
      setAppliedFilters((prev) => ({ ...prev, status: 'EM_ABERTO', validadeAte: today }));
    } else if (centralSituacao === 'ORCAMENTOS_ABERTOS' || !centralSituacao) {
      setFilters((prev) => ({ ...prev, status: 'EM_ABERTO', validadeAte: '' }));
      setAppliedFilters((prev) => ({ ...prev, status: 'EM_ABERTO', validadeAte: '' }));
    }
    return undefined;
  }, [centralLayout, centralSituacao]);
  useEffect(() => {
    if (!centralLayout) return undefined;
    const scope = { actorId, groupId, empresaId };
    const loaded = readCentralColumnHiddenKeys(scope);
    setCentralHiddenColumns(new Set(Array.isArray(loaded) ? loaded : []));
    return undefined;
  }, [centralLayout, actorId, groupId, empresaId]);
  const centralVisibleColumns = useMemo(
    () => CENTRAL_VENDAS360_COLUMNS.filter((col) => !centralHiddenColumns.has(col.key)),
    [centralHiddenColumns],
  );
  const toggleCentralColumn = (key) => {
    if (key === 'numero') return;
    setCentralHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeCentralColumnHiddenKeys({ actorId, groupId, empresaId }, [...next]);
      return next;
    });
  };
  const canView = canUseOrcamentoAction(hasPermission, 'visualizar');
  const canCreate = canUseOrcamentoAction(hasPermission, 'criar');
  const canEdit = (row) => canUseOrcamentoAction(hasPermission, 'editar', row?.status);
  const canCancel = (row) => canUseOrcamentoAction(hasPermission, 'cancelar', row?.status);
  const contextReady = Boolean(groupId && empresaId && actorId);
  const http = useMemo(() => createHttpApiClient({
    getScope: () => ({ groupId, empresaId, actorId, actorEmail, token: sessionIdentity }),
  }), [groupId, empresaId, actorId, actorEmail, sessionIdentity]);
  const api = http.orcamentos;
  const pedidosApi = http.pedidos;
  const canConvert = hasPermission('Comercial', 'pedido', 'converter-pedido');
  const queryKey = ['orcamentos-http', groupId, empresaId, actorId, sessionCacheGeneration, proposalMode ? 'proposal':'operacional', page, pageSize, appliedFilters];
  const listQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.list({ limit: pageSize, offset: (page - 1) * pageSize, search: appliedFilters.search || undefined, status: appliedFilters.status === 'TODOS' ? undefined : appliedFilters.status, clienteEmpresaId: appliedFilters.clienteEmpresaId === 'TODOS' ? undefined : appliedFilters.clienteEmpresaId, validadeDe: appliedFilters.validadeDe || undefined, validadeAte: appliedFilters.validadeAte || undefined, signal }),
    enabled: contextReady && canView && !proposalMode,
    retry: 1,
  });
  // Keep the legacy prop compatible, but operational lookup must share the HTTP session/source.
  void filterInContext;
  const mastersQuery = useQuery({
    queryKey: ['orcamento-masters', groupId, empresaId, actorId, sessionCacheGeneration,
      proposalMode ? 'proposal':'operacional', clienteQuery, produtoQuery],
    queryFn: async ({ signal }) => {
      const opened = { ...renderedScope.current };
      if (!sameOrcamentoScope(opened, renderedScope.current, activeScope())) throw new Error('CONTEXT_CHANGED');
      const pages = await http.comercialMasters.list({ clienteSearch: clienteQuery.trim(), produtoSearch: produtoQuery.trim(), signal });
      if (signal?.aborted || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) throw new Error('CONTEXT_CHANGED');
      return resolveComercialMasterPages(pages, opened);
    },
    enabled: contextReady && canView && !proposalMode,
    staleTime: 30000,
  });
  const proposalMasters = useMemo(createComercialProposalFixture,[]);
  const listRows = proposalMode ? [] : listQuery.data?.data || [];
  /** Catálogo acumulado: labels de listagem/PDF/share independentes da página temporária de busca (P2 #4413844021). */
  const [clienteCatalog, setClienteCatalog] = useState({ clientes: [], clientesEmpresa: [] });
  /** Tentativas terminadas (ok ou 404/erro) por identidade — evita starvation failure-only. */
  const [clienteHydrationAttemptedIds, setClienteHydrationAttemptedIds] = useState(() => new Set());
  const [clienteHydrationFailures, setClienteHydrationFailures] = useState(() => ({}));
  const selectedClienteQuery = useQuery({
    queryKey: ['orcamento-selected-cliente', groupId, empresaId, actorId, sessionCacheGeneration, form.cliente_empresa_id],
    queryFn: async ({ signal }) => resolveComercialSelectedCliente(
      await http.comercialMasters.resolveClienteEmpresa({ clienteEmpresaId: form.cliente_empresa_id, signal }),
      { groupId, empresaId },
      form.cliente_empresa_id,
    ),
    enabled: contextReady && canView && !proposalMode && formOpen && isCanonicalComercialId(form.cliente_empresa_id),
    staleTime: 30000,
    retry: false,
  });
  const neededClienteEmpresaIds = useMemo(() => {
    const ids = new Set();
    for (const row of listRows) {
      if (row?.cliente_empresa_id) ids.add(row.cliente_empresa_id);
    }
    if (selected?.cliente_empresa_id) ids.add(selected.cliente_empresa_id);
    if (editing?.cliente_empresa_id) ids.add(editing.cliente_empresa_id);
    if (form.cliente_empresa_id) ids.add(form.cliente_empresa_id);
    return [...ids].filter((id) => isCanonicalComercialId(id));
  }, [listRows, selected?.cliente_empresa_id, editing?.cliente_empresa_id, form.cliente_empresa_id]);
  // Lote limitado; catálogo + tentativas (incl. 404) avançam a fila (P2 residual failure-only).
  const missingClienteEmpresaIds = useMemo(() => {
    const knownLinkIds = (clienteCatalog.clientesEmpresa || []).map((link) => link.id);
    if (selectedClienteQuery.data?.clientesEmpresa?.[0]?.id) {
      knownLinkIds.push(selectedClienteQuery.data.clientesEmpresa[0].id);
    }
    for (const link of mastersQuery.data?.clientesEmpresa || []) knownLinkIds.push(link.id);
    return nextClienteHydrationBatch(neededClienteEmpresaIds, {
      knownLinkIds,
      attemptedIds: clienteHydrationAttemptedIds,
      limit: 20,
    });
  }, [neededClienteEmpresaIds, clienteCatalog.clientesEmpresa, selectedClienteQuery.data, mastersQuery.data, clienteHydrationAttemptedIds]);
  const rowClienteQueries = useQueries({
    queries: missingClienteEmpresaIds.map((clienteEmpresaId) => ({
      queryKey: ['orcamento-row-cliente', groupId, empresaId, actorId, sessionCacheGeneration, clienteEmpresaId],
      queryFn: async ({ signal }) => resolveComercialSelectedCliente(
        await http.comercialMasters.resolveClienteEmpresa({ clienteEmpresaId, signal }),
        { groupId, empresaId },
        clienteEmpresaId,
      ),
      enabled: contextReady && canView && !proposalMode && isCanonicalComercialId(clienteEmpresaId),
      staleTime: 60000,
      retry: false,
    })),
  });
  // IDs do lote atual por índice — useQueries não devolve queryKey no resultado.
  const rowHydrationKey = clienteHydrationSettlementKey(rowClienteQueries, missingClienteEmpresaIds);
  useEffect(() => {
    setClienteCatalog({ clientes: [], clientesEmpresa: [] });
    setClienteHydrationAttemptedIds(new Set());
    setClienteHydrationFailures({});
  }, [groupId, empresaId, actorId, sessionIdentity, proposalMode]);
  useEffect(() => {
    if (proposalMode || !mastersQuery.data) return undefined;
    setClienteCatalog((prev) => unionComercialClienteCatalog(prev, mastersQuery.data));
    return undefined;
  }, [mastersQuery.data, proposalMode]);
  useEffect(() => {
    if (proposalMode || !selectedClienteQuery.data) return undefined;
    setClienteCatalog((prev) => mergeComercialSelectedCliente(prev, selectedClienteQuery.data));
    return undefined;
  }, [selectedClienteQuery.data, proposalMode]);
  useEffect(() => {
    if (proposalMode || !rowHydrationKey) return undefined;
    const settled = collectSettledClienteHydration(rowClienteQueries, missingClienteEmpresaIds);
    setClienteHydrationAttemptedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of settled.attemptedIds) {
        if (!next.has(id)) { next.add(id); changed = true; }
      }
      return changed ? next : prev;
    });
    if (Object.keys(settled.failures).length) {
      setClienteHydrationFailures((prev) => ({ ...prev, ...settled.failures }));
    }
    setClienteCatalog((prev) => {
      let next = prev;
      for (const payload of settled.successPayloads) {
        next = mergeComercialSelectedCliente(next, payload);
      }
      return next;
    });
    return undefined;
  }, [proposalMode, rowHydrationKey]);
  // Hidratações da página atual entram no useMemo (sem effect — evita loop por referência de useQueries).
  const masters = useMemo(() => {
    if (proposalMode) return proposalMasters;
    const core = mastersQuery.data || {
      clientesEmpresa: [], clientes: [], condicoes: [], produtos: [], unidades: [], tabelas: [],
    };
    let next = {
      ...core,
      clientes: clienteCatalog.clientes,
      clientesEmpresa: clienteCatalog.clientesEmpresa,
    };
    next = mergeComercialSelectedCliente(next, selectedClienteQuery.data);
    for (const query of rowClienteQueries) {
      if (query.data) next = mergeComercialSelectedCliente(next, query.data);
    }
    // Página de busca atual permanece disponível no seletor mesmo antes do effect acumular.
    next = unionComercialClienteCatalog(next, mastersQuery.data || {});
    return next;
  }, [proposalMode, proposalMasters, mastersQuery.data, clienteCatalog, selectedClienteQuery.data, rowClienteQueries]);
  const clientesById = useMemo(() => new Map(masters.clientes.map((item) => [item.id, item])), [masters.clientes]);
  const clienteLabel = (linkId) => {
    const link = masters.clientesEmpresa.find((item) => item.id === linkId);
    const cliente = clientesById.get(link?.cliente_id);
    return clienteEmpresaPickerLabel(link, cliente) || linkId;
  };
  const condicaoLabel = (id) => {
    const row = masters.condicoes.find((item) => item.id === id);
    return row ? (row.codigo ? `${row.codigo} — ${row.nome || ''}` : (row.nome || id)) : id;
  };
  const tabelaLabel = (id) => {
    if (!id) return 'Não informada';
    const row = (masters.tabelas || []).find((item) => item.id === id);
    if (!row) return 'Desconhecida';
    return row.codigo ? `${row.codigo} — ${row.nome || ''}` : (row.nome || id);
  };
  const clienteOptions = useMemo(
    () => filterClienteEmpresaOptions(masters.clientesEmpresa, clientesById, clienteQuery, form.cliente_empresa_id),
    [masters.clientesEmpresa, clientesById, clienteQuery, form.cliente_empresa_id],
  );
  const produtoOptions = useMemo(
    () => filterProdutoOptions(masters.produtos, produtoQuery),
    [masters.produtos, produtoQuery],
  );

  useEffect(() => { actionGate.current.invalidate(); formScope.current = null; cancelScope.current = null; conversionScope.current = null; setSubmitting(false); setPage(1); setSelected(null); setDetailOpen(false); setFormOpen(false); setPendingCancel(null); setPendingConversion(null); setProposalStage('lista'); setFilters({ search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' }); setAppliedFilters({ search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' }); }, [groupId, empresaId, actorId, sessionIdentity, proposalMode]);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const closeForm = () => {
    if (dirty && !window.confirm(
      proposalMode
        ? 'Descartar o rascunho sintético desta proposta visual?'
        : 'Descartar as alterações deste orçamento?'
    )) return;
    setFormOpen(false); setDirty(false); setEditing(null);
    if (proposalMode) setProposalStage('lista');
  };
  /** Volta à lista sem descartar rascunho (Voltar de etapa ≠ desfazer negócio). */
  const proposalBackToLista = () => {
    setFormOpen(false);
    setProposalStage('lista');
    if (dirty) {
      toast.message('Rascunho sintético preservado — reabra a etapa B para continuar.');
    }
  };
  const openCreate = () => {
    // Clique duplo / segundo "Novo" não abre outro fluxo nem zera rascunho já em criação.
    if (formOpen && !editing) return;
    formScope.current = renderedScope.current;
    setEditing(null);
    setForm(emptyForm());
    setDirty(false);
    setFormOpen(true);
    if (proposalMode) {
      setProposalStage('edicao');
      toast.message('Negociação sintética — sem gravação nem reserva de código operacional.');
    }
  };
  const openEdit = (row) => {
    if (!proposalMode && !canEdit(row)) return;
    formScope.current = renderedScope.current;
    setEditing(row);
    setForm({
      cliente_empresa_id: row.cliente_empresa_id,
      condicao_pagamento_id: row.condicao_pagamento_id || (proposalMode ? 'preview-condicao' : ''),
      tabela_preco_id: row.tabela_preco_id || (proposalMode ? 'preview-tabela' : ''),
      validade_em: String(row.validade_em || '').slice(0, 10),
      observacoes: row.observacoes || '',
      itens: (row.itens || []).map((item) => ({ produto_id: item.produto_id, unidade_id: item.unidade_id || (proposalMode ? 'preview-unidade' : ''), descricao: item.descricao, unidade_sigla: item.unidade_sigla, quantidade: item.quantidade, preco_unitario: item.preco_unitario, desconto: item.desconto })),
    });
    setDirty(false); setDetailOpen(false); setFormOpen(true);
    if (proposalMode) setProposalStage('edicao');
  };
  const changeForm = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setDirty(true); };
  const changeItem = (index, key, value) => {
    setForm((current) => ({ ...current, itens: current.itens.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
    setDirty(true);
  };
  const selectProduct = (index, produtoId) => {
    const produto = masters.produtos.find((item) => item.id === produtoId);
    const unidade = masters.unidades.find((item) => item.id === produto?.unidade_medida_id);
    setForm((current) => ({ ...current, itens: current.itens.map((item, i) => i === index ? {
      ...item,
      ...(proposalMode ? { preco_unitario: produto?.preco_venda || '0', produto_codigo: produto?.codigo || '' } : {}),
      produto_id: produtoId,
      unidade_id: produto?.unidade_medida_id || '',
      descricao: produto?.descricao || produto?.nome || '',
      unidade_sigla: unidade?.sigla || '',
    } : item) }));
    setDirty(true);
  };
  const totals = useMemo(() => {
    try { const total = calculateTotals(form.itens); return { subtotal: microsToDecimal(total.subtotal), desconto: microsToDecimal(total.desconto), total: microsToDecimal(total.total) }; }
    catch { return { subtotal: '0', desconto: '0', total: '0' }; }
  }, [form.itens]);
  const save = async () => {
    if (mastersQuery.isError) { toast.error(errorMessage(mastersQuery.error)); return; }
    if (proposalMode) { toast.error('Proposta visual: gravação desabilitada.'); return; }
    if (!canUseOrcamentoAction(hasPermission, editing ? 'editar' : 'criar', editing?.status)) {
      toast.error('Seu perfil não possui permissão para esta ação.'); return;
    }
    const ticket = beginAction(formScope.current);
    if (!ticket) return;
    try {
      const payload = buildOrcamentoPayload(form);
      const saved = editing ? await api.update(editing.id, payload) : await api.create(payload);
      if (!actionCurrent(ticket)) return;
      toast.success(editing ? 'Orçamento atualizado.' : 'Orçamento criado.');
      // Reabertura real: fecha form e abre detalhe com o gravado (inclui tabela_preco_id).
      setDirty(false); setFormOpen(false); setEditing(null); setSelected(saved); setDetailOpen(true);
      await queryClient.invalidateQueries({ queryKey: ['orcamentos-http', groupId, empresaId] });
    } catch (error) { if (actionCurrent(ticket)) toast.error(errorMessage(error)); }
    finally { endAction(ticket); }
  };
  const showDetail = async (row) => {
    if (proposalMode) return;
    const request = ++detailRequest.current;
    const opened = { ...renderedScope.current, token: activeScope()?.token };
    try { const detail = await api.get(row.id); if (request === detailRequest.current && sameOrcamentoScope(opened, renderedScope.current, activeScope())) { setSelected(detail); setDetailOpen(true); } }
    catch (error) { if (request === detailRequest.current && sameOrcamentoScope(opened, renderedScope.current, activeScope())) toast.error(errorMessage(error)); }
  };
  const initialToken = activeScope()?.token;
  useEffect(() => { const active = activeScope(); if (!contextReady || !canView || !isCanonicalComercialId(initialSelectedId) || !active?.token || !sameOrcamentoScope({ ...renderedScope.current, token: active.token }, renderedScope.current, active)) return; const marker = JSON.stringify([groupId, empresaId, actorId, initialSelectedId, active.token, reopenRequestId]); if (initialOpened.current === marker) return; initialOpened.current = marker; void showDetail({ id: initialSelectedId }); }, [initialSelectedId, groupId, empresaId, actorId, initialToken, reopenRequestId, canView, contextReady]);
  // Central 360 → Novo orçamento: abre formulário existente com vínculo pré-selecionado (sem segundo fluxo).
  useEffect(() => {
    if (proposalMode || !contextReady || !canCreate || !isCanonicalComercialId(initialCreateClienteEmpresaId)) return;
    const active = activeScope();
    if (!active?.token || !sameOrcamentoScope({ ...renderedScope.current, token: active.token }, renderedScope.current, active)) return;
    const marker = JSON.stringify([groupId, empresaId, actorId, initialCreateClienteEmpresaId, active.token, createRequestId]);
    if (initialCreateOpened.current === marker) return;
    if (formOpen && dirty) return;
    initialCreateOpened.current = marker;
    formScope.current = renderedScope.current;
    setEditing(null);
    setForm({ ...emptyForm(), cliente_empresa_id: initialCreateClienteEmpresaId });
    setDirty(false);
    setDetailOpen(false);
    setFormOpen(true);
  }, [initialCreateClienteEmpresaId, createRequestId, groupId, empresaId, actorId, initialToken, canCreate, contextReady, proposalMode, formOpen, dirty]);
  const performCancel = async (row) => {
    if (proposalMode) return;
    if (!row) return;
    if (!canCancel(row)) { toast.error('Seu perfil não possui permissão para esta ação.'); return; }
    const ticket = beginAction(cancelScope.current);
    if (!ticket) return;
    try {
      const cancelled = await api.cancel(row.id);
      if (!actionCurrent(ticket)) return;
      setSelected(cancelled);
      toast.success('Orçamento cancelado e preservado.');
      await queryClient.invalidateQueries({ queryKey: ['orcamentos-http', groupId, empresaId] });
    } catch (error) { if (actionCurrent(ticket)) toast.error(errorMessage(error)); }
    finally { endAction(ticket); }
  };
  const cancel = (row) => {
    if (!canCancel(row) || submitting) return;
    cancelScope.current = renderedScope.current;
    setPendingCancel(row);
  };
const convertToPedido = async () => {
    if (proposalMode) return;
    if (!pendingConversion) return;
    if (!hasPermission('Comercial', 'pedido', 'converter-pedido')) {
      toast.error('Seu perfil não possui permissão para esta ação.'); return;
    }
    if (!conversion.data_entrega_solicitada) { toast.error('Informe a data solicitada pelo cliente.'); return; }
    if (!conversionStockOk) {
      toast.error('Estoque insuficiente ou indisponível no contexto. Ajuste quantidades antes de converter.');
      return;
    }
    const opened = conversionScope.current;
    if (!opened?.documentId || opened.documentId !== pendingConversion.id) {
      toast.error('Identidade do orçamento inválida para conversão. Reabra o fechamento.');
      setPendingConversion(null);
      return;
    }
    if (!sameOrcamentoScope(opened, renderedScope.current, activeScope())) {
      toast.error('Contexto alterado. Reabra o orçamento no contexto atual antes de converter.');
      setPendingConversion(null);
      return;
    }
    const ticket = beginAction(opened);
    if (!ticket) return;
    try {
      await pedidosApi.convertOrcamento(pendingConversion.id, { tipo_operacao: conversion.tipo_operacao, data_entrega_solicitada: new Date(`${conversion.data_entrega_solicitada}T12:00:00`).toISOString() });
      if (!actionCurrent(ticket) || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) return;
      toast.success('Orçamento convertido em pedido.'); setPendingConversion(null); setDetailOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['pedidos-http', groupId, empresaId] });
    } catch (error) { if (actionCurrent(ticket)) toast.error(errorMessage(error)); }
    finally { endAction(ticket); }
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
  const centralSelected = selected
    || (selectedCentralId ? listRows.find((r) => r.id === selectedCentralId) : null);
  const requireCentralSelection = (actionLabel) => {
    if (!centralSelected?.id) {
      toast.error(`Selecione um orçamento na grade antes de ${actionLabel}.`);
      return null;
    }
    return centralSelected;
  };
  const applyDraftWarnings = (warnings) => {
    if (warnings?.condicaoAusente) {
      toast.message('Condição de pagamento do documento anterior não está disponível neste contexto — revise antes de salvar.');
    }
    if (warnings?.produtosAusentes?.length) {
      toast.message(`${warnings.produtosAusentes.length} produto(s) do documento anterior não encontrado(s) nos mestres — revise os itens.`);
    }
    if (warnings?.unidadesAusentes?.length) {
      toast.message(`${warnings.unidadesAusentes.length} unidade(s) do documento anterior ausente(s) nos mestres — revise os itens.`);
    }
    if (warnings?.unidadesDivergentes?.length) {
      toast.message(
        `${warnings.unidadesDivergentes.length} item(ns) com unidade diferente da oficial do produto — quantidade/peso não foram convertidos (sem fator). Revise antes de salvar.`,
      );
    }
  };
  const duplicarOrcamentoCentral = async () => {
    if (proposalMode) {
      toast.message('Proposta visual: duplicação sintética não grava.');
      return;
    }
    if (!canCreate) {
      toast.error('Seu perfil não possui permissão para criar orçamento.');
      return;
    }
    const row = requireCentralSelection('duplicar');
    if (!row) return;
    if (formOpen && dirty) {
      toast.error('Há rascunho em edição. Salve ou feche antes de duplicar.');
      return;
    }
    const ticket = beginAction(renderedScope.current);
    if (!ticket) return;
    try {
      const detail = await api.get(row.id);
      if (!actionCurrent(ticket)) return;
      let draft = mapOrcamentoRowToCreateDraft(detail);
      const checked = revalidateOrcamentoDraftAgainstMasters(draft, masters);
      draft = checked.draft;
      applyDraftWarnings(checked.warnings);
      formScope.current = renderedScope.current;
      setEditing(null);
      setForm(draft);
      setDirty(true);
      setDetailOpen(false);
      setFormOpen(true);
      toast.message('Rascunho duplicado aberto — preços, estoque e condições devem ser revalidados antes de salvar. Nada foi gravado.');
    } catch (error) {
      if (actionCurrent(ticket)) toast.error(errorMessage(error));
    } finally {
      endAction(ticket);
    }
  };
  const desmembrarOrcamentoCentral = () => {
    toast.message('Desmembrar orçamento ainda não está disponível neste contrato HTTP — ação não executada (sem fingir sucesso).');
  };
  const incluirItensAnterioresCentral = async () => {
    if (proposalMode) {
      toast.message('Proposta visual: inclusão de itens anteriores desabilitada.');
      return;
    }
    if (!canCreate && !canEdit(centralSelected)) {
      toast.error('Seu perfil não possui permissão para alterar itens.');
      return;
    }
    const clienteEmpresaId = formOpen
      ? form.cliente_empresa_id
      : centralSelected?.cliente_empresa_id;
    if (!clienteEmpresaId) {
      toast.error('Selecione um orçamento (ou abra um rascunho com cliente) para incluir itens anteriores.');
      return;
    }
    const opened = { ...renderedScope.current, documentId: centralSelected?.id || form?.cliente_empresa_id || null };
    const ticket = beginAction(opened);
    if (!ticket) return;
    try {
      // Fontes com RBAC distinto: falha 403 em Pedidos NÃO pode abortar Orçamentos autorizados.
      let pedidos = [];
      let pedidosDenied = false;
      let pedidosFailed = false;
      try {
        const pedidosRes = await pedidosApi.list({ limit: 5, offset: 0, clienteEmpresaId });
        if (!actionCurrent(ticket) || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) return;
        pedidos = Array.isArray(pedidosRes?.data) ? pedidosRes.data : (Array.isArray(pedidosRes) ? pedidosRes : []);
      } catch (error) {
        if (!actionCurrent(ticket) || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) return;
        if (error?.status === 403) pedidosDenied = true;
        else pedidosFailed = true;
      }
      let orcs = [];
      try {
        const orcamentosRes = await api.list({ limit: 5, offset: 0, clienteEmpresaId });
        if (!actionCurrent(ticket) || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) return;
        orcs = Array.isArray(orcamentosRes?.data) ? orcamentosRes.data : (Array.isArray(orcamentosRes) ? orcamentosRes : []);
      } catch (error) {
        if (actionCurrent(ticket)) toast.error(errorMessage(error));
        return;
      }
      if (pedidosDenied) {
        toast.message('Pedidos indisponíveis neste perfil (403) — usando apenas orçamentos autorizados.');
      } else if (pedidosFailed) {
        toast.message('Falha ao consultar Pedidos — usando apenas orçamentos disponíveis.');
      }
      const excludeId = formOpen && editing?.id ? editing.id : centralSelected?.id;
      const candidatos = [
        ...pedidos.map((p) => ({ kind: 'pedido', row: p, at: p.created_at || p.updated_at || '' })),
        ...orcs.filter((o) => o.id !== excludeId).map((o) => ({ kind: 'orcamento', row: o, at: o.created_at || o.updated_at || '' })),
      ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
      if (candidatos.length === 0) {
        toast.error(pedidosDenied
          ? 'Não há orçamento anterior deste cliente neste contexto (Pedidos sem permissão).'
          : 'Não há pedido/orçamento anterior deste cliente neste contexto.');
        return;
      }
      const chosen = candidatos[0];
      let source = chosen.row;
      if (chosen.kind === 'pedido' && source?.id) {
        source = await pedidosApi.get(source.id);
      } else if (chosen.kind === 'orcamento' && source?.id) {
        source = await api.get(source.id);
      }
      if (!actionCurrent(ticket) || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) return;
      const mapped = mapOrcamentoRowToCreateDraft(source, { clearValidade: false });
      const previousItens = mapped.itens.filter((item) => item.produto_id || item.descricao);
      if (previousItens.length === 0) {
        toast.error('O documento anterior não possui itens utilizáveis.');
        return;
      }
      if (formOpen) {
        const nextDraft = {
          ...form,
          itens: [...(form.itens || []).filter((item) => item.produto_id || item.descricao), ...previousItens],
        };
        const checked = revalidateOrcamentoDraftAgainstMasters(nextDraft, masters);
        applyDraftWarnings(checked.warnings);
        setForm(checked.draft);
        setDirty(true);
      } else {
        if (!canCreate) {
          toast.error('Seu perfil não possui permissão para criar orçamento.');
          return;
        }
        let draft = {
          ...mapped,
          validade_em: '',
          observacoes: '',
          itens: previousItens,
        };
        const checked = revalidateOrcamentoDraftAgainstMasters(draft, masters);
        draft = checked.draft;
        applyDraftWarnings(checked.warnings);
        formScope.current = opened;
        setEditing(null);
        setForm(draft);
        setDirty(true);
        setDetailOpen(false);
        setFormOpen(true);
      }
      toast.message(`Itens de ${chosen.kind === 'pedido' ? 'pedido' : 'orçamento'} anterior incluídos no rascunho — revalide preços, estoque e condições antes de salvar.`);
    } catch (error) {
      if (actionCurrent(ticket)) toast.error(errorMessage(error));
    } finally {
      endAction(ticket);
    }
  };
  /**
   * Carrega detalhe do orçamento com captura de identidade + revalidação pós-await.
   * Fast path (itens já em memória) também exige escopo estável — resposta tardia é descartada.
   * Tentativa frontend ≠ escrita cruzada no backend (RBAC/escopo no servidor permanece).
   */
  const loadCentralDetail = async (row, openedScope = null) => {
    if (proposalMode) return row;
    if (!row?.id) return null;
    const opened = openedScope
      ? { ...openedScope, documentId: row.id }
      : { ...renderedScope.current, documentId: row.id };
    const fast = Array.isArray(row?.itens) && row.itens.length > 0 && row.numero;
    if (fast) {
      if (!sameOrcamentoScope(opened, renderedScope.current, activeScope())) {
        toast.error('Contexto alterado. Reabra o orçamento no contexto atual.');
        return null;
      }
      return row;
    }
    const ticket = beginAction(opened);
    if (!ticket) return null;
    try {
      const detail = await api.get(row.id);
      if (!actionCurrent(ticket) || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) return null;
      if (detail?.id && detail.id !== opened.documentId) return null;
      setSelected(detail);
      if (typeof onCentralSelect === 'function') {
        const link = masters.clientesEmpresa.find((item) => item.id === detail?.cliente_empresa_id);
        onCentralSelect(detail, { clienteId: link?.cliente_id || detail?.cliente_id || null });
      }
      return detail;
    } catch (error) {
      if (actionCurrent(ticket)) toast.error(errorMessage(error));
      return null;
    } finally {
      endAction(ticket);
    }
  };
  const imprimirCentral = async () => {
    const row = requireCentralSelection('imprimir');
    if (!row) return;
    const opened = { ...renderedScope.current, documentId: row.id };
    const detail = await loadCentralDetail(row, opened);
    if (!detail || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) return;
    if (detail.id !== opened.documentId) return;
    printOrcamento(detail);
  };
  const enviarCentral = async (channel) => {
    const row = requireCentralSelection('enviar');
    if (!row) return;
    const opened = { ...renderedScope.current, documentId: row.id };
    const detail = await loadCentralDetail(row, opened);
    if (!detail || !sameOrcamentoScope(opened, renderedScope.current, activeScope())) return;
    if (detail.id !== opened.documentId) return;
    await prepareShare(detail, channel);
  };
  /**
   * Fechar Orçamento ≠ Cancelar.
   * Fechar = validações + converter em pedido via backend (estoque/alçada no servidor).
   * Cancelar permanece ação própria (api.cancel).
   * Captura identidade (doc+grupo/empresa/ator/sessão) ANTES do await e revalida depois —
   * inclusive no fast path — para não associar documento antigo a contexto novo (parecer 6796010811).
   */
  const fecharOrcamentoCentral = async () => {
    if (proposalMode) {
      toast.message('Proposta visual: fechamento comercial desabilitado (sem conversão).');
      return;
    }
    const row = requireCentralSelection('fechar');
    if (!row) return;
    if (row.status !== 'EM_ABERTO') {
      toast.error('Somente orçamentos em aberto podem ser fechados.');
      return;
    }
    if (!canConvert) {
      toast.error('Seu perfil não possui permissão para fechar o orçamento (converter em pedido).');
      return;
    }
    const opened = { ...renderedScope.current, documentId: row.id };
    const detail = await loadCentralDetail(row, opened);
    if (!detail) return;
    if (!sameOrcamentoScope(opened, renderedScope.current, activeScope())) {
      toast.error('Contexto alterado durante o carregamento. Reabra o orçamento no contexto atual.');
      return;
    }
    if (detail.id !== opened.documentId) {
      toast.error('Identidade do orçamento divergiu após o carregamento. Operação descartada.');
      return;
    }
    if (!Array.isArray(detail.itens) || detail.itens.length === 0) {
      toast.error('Orçamento sem itens — não é possível fechar.');
      return;
    }
    // Escopo original (não o renderedScope pós-troca) trava convertToPedido se o contexto mudar.
    conversionScope.current = opened;
    setConversion({ tipo_operacao: 'ENTREGA', data_entrega_solicitada: '' });
    setConversionStockOk(true);
    setPendingConversion(detail);
    toast.message('Fechamento comercial: confirme operação, data e estoque. A conversão só grava após resposta do servidor — Cancelar é ação separada.');
  };
  const cancelarOrcamentoCentral = () => {
    const row = requireCentralSelection('cancelar');
    if (!row) return;
    if (!canCancel(row)) {
      toast.error(row.status === 'EM_ABERTO'
        ? 'Seu perfil não possui permissão para cancelar este orçamento.'
        : 'Somente orçamentos em aberto podem ser cancelados.');
      return;
    }
    cancel(row);
  };

  if (!canView) return <div className="w-full h-full flex items-center justify-center p-6"><Alert className="max-w-lg"><AlertCircle className="h-4 w-4" /><AlertDescription>Acesso negado aos Orçamentos.</AlertDescription></Alert></div>;
  // Proposta: filtros só na etapa A — aplicam à lista sintética (sem HTTP).
  const proposalNegociacoesAll = Array.isArray(proposalMasters.negociacoes) ? proposalMasters.negociacoes : [];
  const proposalFiltrosAtivos = Boolean(
    String(appliedFilters.search || '').trim()
    || (appliedFilters.status && appliedFilters.status !== 'TODOS')
    || (appliedFilters.clienteEmpresaId && appliedFilters.clienteEmpresaId !== 'TODOS')
    || appliedFilters.validadeDe
    || appliedFilters.validadeAte
  );
  const proposalListaRows = (() => {
    if (!proposalMode || proposalStage !== 'lista') return [];
    let list = proposalNegociacoesAll;
    const search = String(appliedFilters.search || '').trim().toLowerCase();
    if (search) {
      list = list.filter((row) => String(row.numero || '').toLowerCase().includes(search)
        || String(row.status || '').toLowerCase().includes(search)
        || String(clienteLabel(row.cliente_empresa_id) || '').toLowerCase().includes(search));
    }
    if (appliedFilters.status && appliedFilters.status !== 'TODOS') {
      list = list.filter((row) => row.status === appliedFilters.status);
    }
    if (appliedFilters.clienteEmpresaId && appliedFilters.clienteEmpresaId !== 'TODOS') {
      list = list.filter((row) => row.cliente_empresa_id === appliedFilters.clienteEmpresaId);
    }
    if (appliedFilters.validadeDe) {
      list = list.filter((row) => String(row.validade_em || '') >= appliedFilters.validadeDe);
    }
    if (appliedFilters.validadeAte) {
      list = list.filter((row) => String(row.validade_em || '') <= appliedFilters.validadeAte);
    }
    return list;
  })();
  const rows = proposalMode
    ? proposalListaRows
    : listQuery.data?.data || [];
  const meta = proposalMode
    ? { total: proposalListaRows.length, dataBlock: 'proposta-lista-filtrada' }
    : (listQuery.data?.meta || { total: 0 });
  const proposalAcomp = proposalMasters.acompanhamentoPedido ?? {
    numero_pedido: '',
    status: '',
    origem_orcamento: '',
    credito: '',
    estoque: '',
    producao: '',
    entrega: '',
    nota: '',
    cobranca: '',
  };
  const notifyCentralSelect = (row) => {
    if (typeof onCentralSelect !== 'function') return;
    const link = masters.clientesEmpresa.find((item) => item.id === row?.cliente_empresa_id);
    onCentralSelect(row, { clienteId: link?.cliente_id || row?.cliente_id || null });
  };

  return <div className={`w-full h-full flex flex-col ${centralLayout ? 'bg-transparent p-0' : `bg-slate-50 ${windowMode ? 'p-3' : 'p-4'}`}`} data-permission="Comercial.orcamento.visualizar" data-proposta-stage={proposalMode ? proposalStage : undefined} data-central-layout={centralLayout ? 'versao6' : undefined}>
    {!centralLayout && (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div>
        <h2 className="text-xl font-semibold">{proposalMode ? 'Proposta Comercial 360' : 'Orçamentos'}</h2>
        <p
          className="text-sm text-slate-500"
          data-block={proposalMode ? 'proposta-subtitulo-etapa' : undefined}
          aria-live={proposalMode ? 'polite' : undefined}
        >
          {proposalMode
            ? (proposalStage === 'lista'
              ? 'A · Negociações sintéticas — sem consulta HTTP operacional'
              : proposalStage === 'edicao'
                ? 'B · Edição sintética — Voltar não desfaz o rascunho'
                : 'C · Acompanhamento ilustrativo — Avançar não salva nem converte')
            : 'Propostas comerciais da empresa ativa'}
        </p>
      </div>
      {canCreate && (
        <Button
          onClick={openCreate}
          disabled={!contextReady || (proposalMode && proposalStage === 'acompanhamento')}
          data-permission="Comercial.orcamento.criar"
          data-action={proposalMode ? 'proposta-nova-negociacao' : undefined}
        >
          <FilePlus2 className="w-4 h-4 mr-2" />
          {proposalMode ? 'Nova negociação sintética' : 'Novo orçamento'}
        </Button>
      )}
    </div>
    )}
    {centralLayout && (
      <div className="flex flex-wrap justify-end gap-2 mb-2" data-block="central360-acoes-lista" role="toolbar" aria-label="Ações ABERTO">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-sky-200"
              disabled={!contextReady}
              data-action="central360-prefs-colunas"
              title="Preferências de colunas (somente neste usuário/grupo/empresa)"
            >
              <SlidersHorizontal className="w-4 h-4 mr-1" />
              Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {CENTRAL_VENDAS360_COLUMNS.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={!centralHiddenColumns.has(col.key)}
                disabled={col.key === 'numero'}
                onCheckedChange={() => toggleCentralColumn(col.key)}
                data-action={`central360-col-${col.key}`}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {canCreate && (
          <Button
            onClick={openCreate}
            disabled={!contextReady || (proposalMode && proposalStage === 'acompanhamento')}
            data-permission="Comercial.orcamento.criar"
            data-action={proposalMode ? 'proposta-nova-negociacao' : 'central360-novo-orcamento'}
            className="bg-sky-700 hover:bg-sky-800"
          >
            <FilePlus2 className="w-4 h-4 mr-2" />
            {proposalMode ? 'Nova negociação sintética' : 'Novo Orçamento'}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-sky-200"
          disabled={!contextReady || submitting || !centralSelected}
          onClick={imprimirCentral}
          data-action="central360-imprimir"
          title="Imprimir/PDF do orçamento selecionado"
        >
          <Printer className="w-4 h-4 mr-1" />
          Imprimir
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-sky-200"
              disabled={!contextReady || submitting || !centralSelected}
              data-action="central360-enviar"
              title="Preparar texto para envio (sem disparo automático)"
            >
              <Send className="w-4 h-4 mr-1" />
              Enviar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              data-action="central360-enviar-whatsapp"
              onSelect={() => { void enviarCentral('WhatsApp'); }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp (copiar texto)
            </DropdownMenuItem>
            <DropdownMenuItem
              data-action="central360-enviar-email"
              onSelect={() => { void enviarCentral('e-mail'); }}
            >
              <Mail className="w-4 h-4 mr-2" />
              E-mail (copiar texto)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          size="sm"
          className="bg-sky-700 hover:bg-sky-800"
          disabled={!contextReady || submitting || !centralSelected || centralSelected.status !== 'EM_ABERTO' || !canConvert}
          onClick={() => { void fecharOrcamentoCentral(); }}
          data-action="central360-fechar-orcamento"
          data-permission="Comercial.pedido.converter-pedido"
          title="Fechar orçamento: validações + converter em pedido no servidor (≠ Cancelar)"
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          Fechar Orçamento
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-sky-200"
              disabled={!contextReady || submitting}
              data-action="central360-mais-acoes"
              title="Mais ações sobre o orçamento selecionado"
            >
              <MoreHorizontal className="w-4 h-4 mr-1" />
              Mais Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuItem
              data-action="central360-duplicar"
              disabled={!canCreate || !centralSelected}
              onSelect={() => { void duplicarOrcamentoCentral(); }}
            >
              Duplicar (rascunho — revalidar preços)
            </DropdownMenuItem>
            <DropdownMenuItem
              data-action="central360-itens-anteriores"
              disabled={!centralSelected && !formOpen}
              onSelect={() => { void incluirItensAnterioresCentral(); }}
            >
              Incluir itens anteriores
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-action="central360-cancelar"
              disabled={!centralSelected || !canCancel(centralSelected)}
              onSelect={cancelarOrcamentoCentral}
              className="text-rose-700 focus:text-rose-800"
            >
              Cancelar orçamento (≠ Fechar)
            </DropdownMenuItem>
            <DropdownMenuItem
              data-action="central360-desmembrar"
              onSelect={desmembrarOrcamentoCentral}
            >
              Desmembrar (não suportado)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )}
    {proposalMode && <Alert className="mb-3 border-sky-200 bg-sky-50"><AlertDescription>Proposta visual sintética para aprovação. Não consulta nem grava cadastros, pedidos, estoque ou pagamentos. URL: <code>?proposta=comercial360</code>.</AlertDescription></Alert>}
    {proposalMode && (
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Etapas da proposta visual" data-block="proposta-etapas">
        {[
          ['lista', 'A · Negociações'],
          ['edicao', 'B · Orçamento'],
          ['acompanhamento', 'C · Acompanhamento'],
        ].map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant="outline"
            className={proposalStage === key ? 'bg-sky-700 text-white border-sky-700 hover:bg-sky-800 hover:text-white' : 'bg-white border-sky-200'}
            aria-pressed={proposalStage === key}
            aria-current={proposalStage === key ? 'step' : undefined}
            data-action={`proposta-etapa-${key}`}
            data-proposta-rascunho={key === 'edicao' && dirty ? 'sujo' : undefined}
            onClick={() => {
              if (key === 'lista') {
                proposalBackToLista();
                return;
              }
              if (key === 'edicao') {
                setProposalStage('edicao');
                if (!formOpen) setFormOpen(true);
                return;
              }
              // C: ilustrativo — não salva nem converte.
              setFormOpen(false);
              setProposalStage('acompanhamento');
            }}
          >
            {label}
            {key === 'edicao' && dirty ? (
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide" data-block="proposta-rascunho-sujo" aria-label="Rascunho sintético alterado">
                · rascunho
              </span>
            ) : null}
          </Button>
        ))}
        <p className="text-xs text-slate-500 self-center">Voltar não desfaz o rascunho · Avançar não salva/converte.</p>
        {dirty ? (
          <p
            className="text-xs text-sky-900 self-center"
            data-block="proposta-rascunho-preservado"
            role="status"
          >
            Há rascunho sintético em memória (não gravado).
          </p>
        ) : null}
      </div>
    )}
    {!contextReady && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>Selecione uma empresa e entre com um usuário válido.</AlertDescription></Alert>}
    {Object.keys(clienteHydrationFailures).length > 0 && (
      <Alert className="mb-3" data-testid="orcamento-cliente-hydration-failures" role="status" aria-live="polite">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {Object.keys(clienteHydrationFailures).length} vínculo(s) de cliente sem label neste contexto
          (consulta leve falhou; fila avançou). IDs permanecem visíveis até correção/retry de sessão.
        </AlertDescription>
      </Alert>
    )}
    {(!proposalMode || proposalStage === 'lista') && (
    <form className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3" onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedFilters(filters); }} data-block={proposalMode ? 'proposta-filtros-lista' : undefined}>
      <div className="md:col-span-2"><Label htmlFor="orc-search" className="sr-only">{proposalMode ? 'Pesquisar número ou cliente' : 'Pesquisar número'}</Label><Input id="orc-search" value={filters.search} maxLength={80} placeholder={proposalMode ? 'Pesquisar número ou cliente' : 'Pesquisar número'} data-action={proposalMode ? 'proposta-filtro-search' : undefined} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} onBlur={() => { if (proposalMode) { setAppliedFilters(filters); setPage(1); } }} /></div>
      <Select value={filters.status} onValueChange={(value) => {
        const next = { ...filters, status: value };
        setFilters(next);
        if (proposalMode) { setAppliedFilters(next); setPage(1); }
      }}><SelectTrigger aria-label="Filtrar status" data-action={proposalMode ? 'proposta-filtro-status' : undefined}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="EM_ABERTO">Em aberto</SelectItem><SelectItem value="CANCELADO">Cancelado</SelectItem></SelectContent></Select>
      <Select value={filters.clienteEmpresaId} onValueChange={(value) => {
        const next = { ...filters, clienteEmpresaId: value };
        setFilters(next);
        if (proposalMode) { setAppliedFilters(next); setPage(1); }
      }}><SelectTrigger aria-label="Filtrar cliente" data-action={proposalMode ? 'proposta-filtro-cliente' : undefined}><SelectValue placeholder="Todos os clientes" /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os clientes</SelectItem>{masters.clientesEmpresa.map((item) => <SelectItem key={item.id} value={item.id}>{clienteLabel(item.id)}</SelectItem>)}</SelectContent></Select>
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Validade inicial"
          type="date"
          value={filters.validadeDe}
          data-action={proposalMode ? 'proposta-filtro-validade-de' : undefined}
          onChange={(event) => {
            const next = { ...filters, validadeDe: event.target.value };
            setFilters(next);
            if (proposalMode) { setAppliedFilters(next); setPage(1); }
          }}
        />
        <Input
          aria-label="Validade final"
          type="date"
          value={filters.validadeAte}
          data-action={proposalMode ? 'proposta-filtro-validade-ate' : undefined}
          onChange={(event) => {
            const next = { ...filters, validadeAte: event.target.value };
            setFilters(next);
            if (proposalMode) { setAppliedFilters(next); setPage(1); }
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="outline" className="flex-1" data-action={proposalMode ? 'proposta-filtrar' : undefined}>
          <Search className="w-4 h-4 mr-2" />
          {proposalMode ? 'Aplicar' : 'Filtrar'}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          title="Limpar filtros"
          data-action={proposalMode ? 'proposta-limpar-filtros' : undefined}
          onClick={() => {
            const clean = { search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' };
            setFilters(clean);
            setAppliedFilters(clean);
            setPage(1);
          }}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </form>
    )}
    {proposalMode && proposalStage === 'acompanhamento' ? (
      <div className="flex-1 min-h-0 overflow-auto border bg-white rounded-md p-4 space-y-3" data-block="proposta-acompanhamento" aria-label="Acompanhamento ilustrativo do pedido">
        <h3 className="font-semibold text-sky-950">C · Aprovação / fechamento (ilustrativo)</h3>
        <p className="text-sm text-slate-600">Não é pedido real. Capacidades abaixo reutilizam owners existentes — sem botão fictício como integração pronta.</p>
        {dirty ? (
          <p className="text-xs text-sky-900 rounded-md border border-sky-100 bg-sky-50 px-3 py-2" data-block="proposta-acompanhamento-rascunho" role="status">
            Rascunho da etapa B permanece em memória (não gravado / não convertido).
          </p>
        ) : null}
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-slate-500">Pedido sintético</dt><dd className="font-mono">{proposalAcomp.numero_pedido}</dd></div>
          <div><dt className="text-slate-500">Status</dt><dd>{proposalAcomp.status}</dd></div>
          <div><dt className="text-slate-500">Origem orçamento</dt><dd className="font-mono">{proposalAcomp.origem_orcamento}</dd></div>
          <div><dt className="text-slate-500">Crédito / financeiro</dt><dd data-capacidade="parcial">{proposalAcomp.credito}</dd></div>
          <div><dt className="text-slate-500">Estoque</dt><dd data-capacidade="parcial">{proposalAcomp.estoque}</dd></div>
          <div><dt className="text-slate-500">Produção</dt><dd data-capacidade="parcial">{proposalAcomp.producao}</dd></div>
          <div><dt className="text-slate-500">Entregas / mapa</dt><dd data-capacidade="parcial">{proposalAcomp.entrega}</dd></div>
          <div><dt className="text-slate-500">Nota fiscal</dt><dd data-capacidade="futuro">{proposalAcomp.nota}</dd></div>
          <div><dt className="text-slate-500">Cobrança</dt><dd data-capacidade="parcial">{proposalAcomp.cobranca}</dd></div>
        </dl>
        <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3 space-y-2" data-block="proposta-atalhos-capacidade">
          <h4 className="text-sm font-medium text-sky-950">Atalhos GoTo / atendimento / canais</h4>
          <p className="text-xs text-slate-600">Indicam capacidade do owner — desabilitados nesta prévia (não disparam integração).</p>
          <ul className="space-y-2">
            {PROPOSTA_CAPACIDADES.filter((item) => ['goto-atendimento', 'chatbot', 'site-ecommerce', 'marketplaces'].includes(item.key)).map((item) => (
              <li
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                data-capacidade={item.capacidade}
                data-capacidade-key={item.key}
                data-integracao-pronta={item.capacidade === 'existente' ? 'owner-only' : 'false'}
                title="Indicador de capacidade — sem disparo de integração nesta prévia"
              >
                <span className="min-w-0">
                  <span className="font-medium text-slate-800">{item.label}</span>
                  <span className="block text-[11px] text-slate-500 truncate" title={item.owner}>{item.owner}</span>
                </span>
                <Badge
                  variant="outline"
                  className={
                    item.capacidade === 'existente'
                      ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
                      : item.capacidade === 'parcial'
                        ? 'border-amber-300 text-amber-900 bg-amber-50'
                        : 'border-slate-300 text-slate-700 bg-slate-50'
                  }
                >
                  {item.capacidade === 'existente' ? 'Existente' : item.capacidade === 'parcial' ? 'Parcial' : 'Futuro'}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" variant="outline" className="border-sky-200" data-action="proposta-etapa-voltar-edicao" onClick={() => { setProposalStage('edicao'); setFormOpen(true); }}>Voltar ao orçamento</Button>
          <Button type="button" variant="outline" className="border-sky-200" data-action="proposta-etapa-lista" onClick={proposalBackToLista}>Voltar às negociações</Button>
        </div>
      </div>
    ) : (!proposalMode && listQuery.isLoading) ? <div className="flex-1 flex items-center justify-center">Carregando orçamentos...</div> : (!proposalMode && listQuery.isError) ? <div className="flex-1 flex flex-col items-center justify-center gap-3"><p>{errorMessage(listQuery.error)}</p><Button variant="outline" onClick={() => listQuery.refetch()}><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button></div> : rows.length === 0 ? (proposalMode && proposalStage === 'edicao' ? <div className="flex-1 min-h-0" data-block="proposta-edicao-placeholder" aria-hidden="true" /> : <div className="flex-1 flex flex-col items-center justify-center text-slate-500" data-block={proposalMode ? 'proposta-lista-vazia' : undefined}><FilePlus2 className="w-10 h-10 mb-2" /><p>{proposalMode
      ? (proposalFiltrosAtivos && proposalNegociacoesAll.length > 0
        ? 'Nenhuma negociação sintética para os filtros atuais.'
        : 'Nenhuma negociação sintética nesta etapa.')
      : 'Nenhum orçamento encontrado para os filtros desta empresa.'}</p>{proposalMode && proposalFiltrosAtivos && proposalNegociacoesAll.length > 0 && (
      <Button
        type="button"
        variant="outline"
        className="mt-3 border-sky-200"
        data-action="proposta-limpar-filtros"
        onClick={() => {
          const clean = { search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' };
          setFilters(clean);
          setAppliedFilters(clean);
          setPage(1);
        }}
      >
        Limpar filtros da prévia
      </Button>
    )}</div>) : <div className="flex-1 min-h-0 overflow-auto border bg-white rounded-md" data-block={proposalMode ? 'proposta-negociacoes' : (centralLayout ? 'central360-tabela-12' : undefined)}>
      {centralLayout ? (
        <div className="w-full overflow-x-auto" data-block="central360-scroll-h">
        <Table data-testid="central360-orcamentos-12col">
          <TableHeader className="sticky top-0 bg-white z-10">
            <TableRow>
              {centralVisibleColumns.map((col) => (
                <TableHead key={col.key} className={`text-xs whitespace-nowrap ${col.sticky ? 'sticky left-0 bg-white z-[11]' : ''}`}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const link = masters.clientesEmpresa.find((item) => item.id === row.cliente_empresa_id);
              const cliente = clientesById.get(link?.cliente_id);
              const peso = sumCentralPesoKg(row.itens);
              const selectedRow = selectedCentralId === row.id;
              const cells = {
                numero: <TableCell key="numero" className="font-mono text-xs sticky left-0 bg-inherit">{row.numero || '—'}</TableCell>,
                data: <TableCell key="data" className="text-xs whitespace-nowrap">{date(row.created_at || row.data)}</TableCell>,
                cod_cliente: <TableCell key="cod_cliente" className="font-mono text-xs">{cliente?.codigo || link?.codigo_cliente || '—'}</TableCell>,
                nome_cliente: <TableCell key="nome_cliente" className="text-xs sticky left-0 bg-inherit">{clienteLabel(row.cliente_empresa_id)}</TableCell>,
                origem: <TableCell key="origem" className="text-xs">{row.origem || row.canal || '—'}</TableCell>,
                vendedor: <TableCell key="vendedor" className="text-xs">{row.vendedor_nome || row.nome_vendedor || '—'}</TableCell>,
                peso: <TableCell key="peso" className="text-xs">{peso == null ? '—' : `${peso}`}</TableCell>,
                valor: <TableCell key="valor" className="text-xs text-right font-semibold whitespace-nowrap">{money(row.total)}</TableCell>,
                cidade: <TableCell key="cidade" className="text-xs">{row.cidade || cliente?.cidade || '—'}</TableCell>,
                condicao: <TableCell key="condicao" className="text-xs">{condicaoLabel(row.condicao_pagamento_id)}</TableCell>,
                situacao: (
                  <TableCell key="situacao" className="text-xs">
                    <Badge variant={row.status === 'EM_ABERTO' ? 'default' : 'secondary'}>
                      {proposalMode ? 'Sintético' : (row.status === 'EM_ABERTO' ? 'Aberto' : (row.status === 'CANCELADO' ? 'Cancelado' : row.status))}
                    </Badge>
                  </TableCell>
                ),
                prazo: (
                  <TableCell key="prazo" className="text-xs whitespace-nowrap" title="Validade do orçamento (≠ prazo de entrega)">
                    {date(row.validade_em)}
                  </TableCell>
                ),
              };
              return (
                <TableRow
                  key={row.id}
                  data-selected={selectedRow ? 'true' : undefined}
                  className={selectedRow ? 'bg-sky-50' : 'cursor-pointer'}
                  onClick={() => { setSelected(row); notifyCentralSelect(row); }}
                  onDoubleClick={() => { if (proposalMode || canEdit(row)) openEdit(row); }}
                >
                  {centralVisibleColumns.map((col) => cells[col.key])}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      ) : (
      <Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Cliente</TableHead><TableHead>Criado</TableHead><TableHead>Validade</TableHead><TableHead>Itens</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-mono">{row.numero}</TableCell><TableCell>{clienteLabel(row.cliente_empresa_id)}</TableCell><TableCell>{date(row.created_at)}</TableCell><TableCell>{date(row.validade_em)}</TableCell><TableCell>{row.itens?.length || 0}</TableCell><TableCell className="text-right">{money(row.subtotal)}</TableCell><TableCell className="text-right">{money(row.desconto)}</TableCell><TableCell className="text-right font-semibold">{money(row.total)}</TableCell><TableCell><Badge variant={row.status === 'EM_ABERTO' ? 'default' : 'secondary'}>{proposalMode ? 'Sintético' : (row.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado')}</Badge></TableCell><TableCell><div className="flex justify-end gap-1">{!proposalMode && <Button size="icon" variant="ghost" title="Visualizar" onClick={() => showDetail(row)}><Eye className="w-4 h-4" /></Button>}{(proposalMode || canEdit(row)) && <Button size="icon" variant="ghost" title={proposalMode ? 'Abrir orçamento sintético' : 'Editar'} data-action={proposalMode ? 'proposta-selecionar-negociacao' : undefined} onClick={() => openEdit(row)}><Pencil className="w-4 h-4" /></Button>}{!proposalMode && canCancel(row) && <Button size="icon" variant="ghost" title="Cancelar" onClick={() => cancel(row)}><XCircle className="w-4 h-4" /></Button>}</div></TableCell></TableRow>)}</TableBody></Table>
      )}
    </div>}
    {/* Proposta sintética: lista curta — sem paginação operacional HTTP. */}
    {!proposalMode && (
      <PaginationControls
        currentPage={page}
        totalItems={meta.total || 0}
        itemsPerPage={pageSize}
        onPageChange={setPage}
        onItemsPerPageChange={setPageSize}
        isLoading={listQuery.isFetching}
      />
    )}
    {proposalMode && proposalStage === 'lista' && (
      <div className="mb-2 space-y-1">
        <p className="text-xs text-slate-500" data-block="proposta-sem-paginacao" role="note">
          Prévia sintética — sem paginação de API (lista ilustrativa completa nesta etapa).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p
            className="text-xs text-slate-600"
            data-block="proposta-lista-contagem"
            aria-live="polite"
          >
            {proposalFiltrosAtivos
              ? `${proposalListaRows.length} de ${proposalNegociacoesAll.length} negociação(ões) sintética(s) após filtros.`
              : `${proposalListaRows.length} negociação(ões) sintética(s) nesta etapa.`}
          </p>
          {proposalFiltrosAtivos && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-sky-900"
              data-action="proposta-limpar-filtros"
              onClick={() => {
                const clean = { search: '', status: 'TODOS', clienteEmpresaId: 'TODOS', validadeDe: '', validadeAte: '' };
                setFilters(clean);
                setAppliedFilters(clean);
                setPage(1);
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>
    )}

    <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}><DialogContent style={windowMode ? { zIndex:1000000000 } : undefined} overlayStyle={windowMode ? { zIndex:999999999 } : undefined} className={proposalMode ? 'w-[96vw] max-w-7xl max-h-[92vh] flex flex-col overflow-hidden border-sky-200 bg-sky-50' : 'w-[96vw] max-w-6xl max-h-[92vh] overflow-auto'}><DialogHeader><DialogTitle>{editing ? `Editar orçamento ${editing.numero}` : 'Novo orçamento'}</DialogTitle><DialogDescription>{proposalMode ? 'Escolha cliente e produtos, ajuste quantidades e navegue pelo contexto sem perder o rascunho.' : <>Totais e preço unitário são conferidos pelo servidor ({ORCAMENTO_PERSISTENCE_GAPS.preco_unitario_ui}). Tabela de preço persiste no cabeçalho e alimenta o snapshot.</>}</DialogDescription></DialogHeader>
      {proposalMode && <p className="text-sm font-medium text-sky-900">PRÉVIA SINTÉTICA · aprovação visual pendente · sem gravação</p>}
      {!proposalMode && mastersQuery.isError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{errorMessage(mastersQuery.error)}</AlertDescription></Alert>}
      <div className={proposalMode ? 'grid xl:grid-cols-[minmax(0,1fr)_20rem] gap-4 overflow-auto min-h-0' : 'contents'}>
      <div className={proposalMode ? 'rounded-xl bg-white border p-4 space-y-4 min-w-0' : 'contents'}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3"><div className="md:col-span-2 space-y-2"><Label htmlFor="orc-cliente-busca">Buscar cliente (código ou nome)</Label><Input id="orc-cliente-busca" value={clienteQuery} maxLength={80} placeholder="Digite código ou razão social" onChange={(e) => setClienteQuery(e.target.value)} data-action="orcamento-busca-cliente" /><Label htmlFor="orc-cliente">Cliente</Label><Select data-action="orcamento-cliente" value={form.cliente_empresa_id} onValueChange={(v) => changeForm('cliente_empresa_id', v)}><SelectTrigger id="orc-cliente"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{clienteOptions.map((item) => <SelectItem key={item.id} value={item.id}>{clienteLabel(item.id)}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-condicao">Condição de pagamento</Label><Select value={form.condicao_pagamento_id} onValueChange={(v) => changeForm('condicao_pagamento_id', v)}><SelectTrigger id="orc-condicao"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{masters.condicoes.filter((item) => item.ativo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.codigo ? `${item.codigo} — ` : ''}{item.nome || item.codigo}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-tabela">Tabela de preço</Label><Select value={form.tabela_preco_id || 'NENHUMA'} onValueChange={(v) => changeForm('tabela_preco_id', v === 'NENHUMA' ? '' : v)}><SelectTrigger id="orc-tabela" data-action="orcamento-tabela-preco"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="NENHUMA">Não informada</SelectItem>{(masters.tabelas || []).filter((item) => item.ativo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.codigo ? `${item.codigo} — ` : ''}{item.nome || item.codigo}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="orc-validade">Validade</Label><Input id="orc-validade" type="date" value={form.validade_em} onChange={(e) => changeForm('validade_em', e.target.value)} /></div><div className="md:col-span-4"><Label htmlFor="orc-observacoes">Observações</Label><Textarea id="orc-observacoes" value={form.observacoes} onChange={(e) => changeForm('observacoes', e.target.value)} /></div></div>
      <div className="space-y-2"><div className="flex flex-wrap items-end justify-between gap-2"><h3 className="font-semibold">Itens</h3><div className="flex flex-wrap gap-2 items-end"><div><Label htmlFor="orc-produto-busca" className="sr-only">Buscar produto</Label><Input id="orc-produto-busca" value={produtoQuery} maxLength={80} placeholder="Filtrar produto por código" onChange={(e) => setProdutoQuery(e.target.value)} data-action="orcamento-busca-produto" className="w-56" /></div><Button type="button" variant="outline" size="sm" onClick={() => changeForm('itens', [...form.itens, emptyItem()])}><Plus className="w-4 h-4 mr-1" />Item</Button></div></div>{form.itens.map((item, index) => { let itemTotals = { subtotal: '0', total: '0' }; try { itemTotals = calculateItem(item); } catch { itemTotals = { subtotal: '0', total: '0' }; } return <div key={index} className={proposalMode ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border rounded-md p-3" : "grid grid-cols-1 md:grid-cols-12 gap-2 border rounded-md p-2"}><div className={proposalMode ? "sm:col-span-2" : "md:col-span-3"}><Label>Produto</Label><Select data-action="orcamento-produto" value={item.produto_id} onValueChange={(v) => selectProduct(index, v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{produtoOptions.map((p) => <SelectItem key={p.id} value={p.id}>{produtoPickerLabel(p)}</SelectItem>)}</SelectContent></Select></div><div className={proposalMode ? "sm:col-span-2" : "md:col-span-3"}><Label>Descrição</Label><Input value={item.descricao} onChange={(e) => changeItem(index, 'descricao', e.target.value)} /></div><div><Label>Unidade</Label><Input value={item.unidade_sigla} readOnly title={ORCAMENTO_PERSISTENCE_GAPS.unidade_alternativa} /></div><div><Label>Quantidade</Label><Input inputMode="decimal" value={item.quantidade} onChange={(e) => changeItem(index, 'quantidade', e.target.value)} /></div><div><Label>Preço</Label><Input inputMode="decimal" value={item.preco_unitario} onChange={(e) => changeItem(index, 'preco_unitario', e.target.value)} title="Preview local; servidor aplica tabela autorizada" /></div><div><Label>Desconto</Label><Input inputMode="decimal" value={item.desconto} onChange={(e) => changeItem(index, 'desconto', e.target.value)} /></div><div><Label>Total</Label><div className="h-10 flex items-center font-medium">{money(itemTotals.total)}</div></div><div className="flex items-end"><Button type="button" size="icon" variant="ghost" title="Remover item" disabled={form.itens.length === 1} onClick={() => changeForm('itens', form.itens.filter((_, i) => i !== index))}><Trash2 className="w-4 h-4" /></Button></div></div>; })}</div>
      <div className="flex justify-end gap-5 text-sm"><span>Subtotal: <strong>{money(totals.subtotal)}</strong></span><span>Desconto: <strong>{money(totals.desconto)}</strong></span><span>Total: <strong>{money(totals.total)}</strong></span></div>
      </div>
      {proposalMode && (() => {
        const link = masters.clientesEmpresa.find((item) => item.id === form.cliente_empresa_id);
        const clienteRow = link ? clientesById.get(link.cliente_id) : null;
        return (
          <OrcamentoProposalAside
            cliente={form.cliente_empresa_id ? clienteLabel(form.cliente_empresa_id) : ''}
            clienteCodigo={clienteRow?.codigo || link?.codigo || ''}
            clienteIdTecnico={clienteRow?.id || ''}
            itens={form.itens}
            totals={totals}
            condicao={form.condicao_pagamento_id ? condicaoLabel(form.condicao_pagamento_id) : ''}
            tabela={masters.tabelas.find((item) => item.id === form.tabela_preco_id)?.nome}
            historicoIlustrativo={proposalMasters.historicoIlustrativo || []}
            formasPagamentoIlustrativas={proposalMasters.formasPagamentoIlustrativas || []}
          />
        );
      })()}
      </div>
      <DialogFooter className="flex flex-wrap gap-2">
        {proposalMode && (
          <>
            <Button type="button" variant="outline" className="border-sky-200" data-action="proposta-etapa-voltar-lista" onClick={proposalBackToLista}>Voltar</Button>
            <Button type="button" variant="outline" className="border-sky-200" data-action="proposta-etapa-avancar-acompanhamento" onClick={() => { setFormOpen(false); setProposalStage('acompanhamento'); }}>Avançar</Button>
          </>
        )}
        <Button
          variant="outline"
          onClick={closeForm}
          data-action={proposalMode ? 'proposta-fechar-janela' : 'orcamento-fechar-janela'}
          title="Fecha apenas a janela do formulário — não cancela nem fecha o orçamento comercialmente"
        >Fechar janela</Button>
        <Button
          onClick={save}
          disabled={proposalMode || submitting || mastersQuery.isLoading || mastersQuery.isError}
          title={proposalMode ? 'Gravação desabilitada na proposta visual' : undefined}
          data-action={proposalMode ? 'proposta-salvar-bloqueado' : 'orcamento-salvar'}
        >{submitting ? 'Salvando...' : 'Salvar orçamento'}</Button>
      </DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={detailOpen} onOpenChange={setDetailOpen}><DialogContent style={windowMode ? { zIndex:1000000000 } : undefined} overlayStyle={windowMode ? { zIndex:999999999 } : undefined} className="max-w-4xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Orçamento {selected?.numero}</DialogTitle><DialogDescription>{selected?.status === 'EM_ABERTO' ? 'Em aberto' : 'Cancelado'} · validade {date(selected?.validade_em)}</DialogDescription></DialogHeader>{selected && <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"><div><span className="text-slate-500">Cliente</span><p>{clienteLabel(selected.cliente_empresa_id)}</p></div><div><span className="text-slate-500">Condição</span><p>{condicaoLabel(selected.condicao_pagamento_id)}</p></div><div data-action="orcamento-detalhe-tabela-preco"><span className="text-slate-500">Tabela de preço</span><p>{tabelaLabel(selected.tabela_preco_id)}</p></div><div><span className="text-slate-500">Criado</span><p>{date(selected.created_at)}</p></div><div><span className="text-slate-500">Atualizado</span><p>{date(selected.updated_at)}</p></div></div><p className="text-sm whitespace-pre-wrap">{selected.observacoes || 'Sem observações.'}</p><Table><TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Un.</TableHead><TableHead className="text-right">Qtd.</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Desconto</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader><TableBody>{selected.itens.map((item) => <TableRow key={item.id}><TableCell>{item.descricao}</TableCell><TableCell>{item.unidade_sigla}</TableCell><TableCell className="text-right">{item.quantidade}</TableCell><TableCell className="text-right">{money(item.preco_unitario)}</TableCell><TableCell className="text-right">{money(item.desconto)}</TableCell><TableCell className="text-right">{money(item.total)}</TableCell></TableRow>)}</TableBody></Table><div className="flex justify-end gap-5"><span>Subtotal: <strong>{money(selected.subtotal)}</strong></span><span>Desconto: <strong>{money(selected.desconto)}</strong></span><span>Total: <strong>{money(selected.total)}</strong></span></div></div>}<DialogFooter className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => printOrcamento(selected)}><Printer className="w-4 h-4 mr-2" />Imprimir/PDF</Button><Button variant="outline" title="Preparar texto para WhatsApp" onClick={() => prepareShare(selected, 'WhatsApp')}><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</Button><Button variant="outline" title="Preparar texto para e-mail" onClick={() => prepareShare(selected, 'e-mail')}><Mail className="w-4 h-4 mr-2" />E-mail</Button>{canConvert && selected?.status === 'EM_ABERTO' && <Button data-action="orcamento-detalhe-fechar" onClick={() => { conversionScope.current = { ...renderedScope.current, documentId: selected?.id }; setConversion({ tipo_operacao: 'ENTREGA', data_entrega_solicitada: '' }); setConversionStockOk(true); setPendingConversion(selected); }}><CheckCircle2 className="w-4 h-4 mr-2" />Fechar → pedido</Button>}{canEdit(selected) && <Button variant="outline" onClick={() => openEdit(selected)}><Pencil className="w-4 h-4 mr-2" />Editar</Button>}{canCancel(selected) && <Button variant="destructive" data-action="orcamento-detalhe-cancelar" onClick={() => cancel(selected)} disabled={submitting}><XCircle className="w-4 h-4 mr-2" />Cancelar orçamento</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(pendingConversion)} onOpenChange={(open) => { if (!open && !submitting) { setPendingConversion(null); setConversionStockOk(true); } }}><DialogContent style={windowMode ? { zIndex:1000000000 } : undefined} overlayStyle={windowMode ? { zIndex:999999999 } : undefined} className="max-w-lg max-h-[90vh] overflow-auto" data-block="central360-fechar-conversao"><DialogHeader><DialogTitle>Fechar orçamento → pedido</DialogTitle><DialogDescription>Fechamento comercial via conversão no servidor (estoque/alçada/auditoria). Orçamento original preservado e vinculado. Cancelar é ação separada.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Operação</Label><Select value={conversion.tipo_operacao} onValueChange={(value) => setConversion((current) => ({ ...current, tipo_operacao: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ENTREGA">Entrega</SelectItem><SelectItem value="RETIRADA">Retirada</SelectItem></SelectContent></Select></div><div><Label>Data solicitada pelo cliente</Label><Input type="date" value={conversion.data_entrega_solicitada} onChange={(event) => setConversion((current) => ({ ...current, data_entrega_solicitada: event.target.value }))} /></div>{pendingConversion && <ValidadorEstoquePedido orcamento={pendingConversion} empresaId={empresaId} onAvailabilityChange={(state) => { setConversionStockOk(conversionStockOkFromAvailability(state)); }} />}</div><DialogFooter><Button variant="outline" onClick={() => { setPendingConversion(null); setConversionStockOk(true); }} disabled={submitting}>Voltar</Button><Button onClick={convertToPedido} disabled={submitting || !conversionStockOk} data-action="orcamento-converter-pedido" data-permission="Comercial.pedido.converter-pedido">{submitting ? 'Fechando...' : 'Confirmar fechamento'}</Button></DialogFooter></DialogContent></Dialog>    <ConfirmDialog
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
