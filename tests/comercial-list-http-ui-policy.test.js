import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  ORCAMENTO_LIST_FILTER_DEFAULTS,
  PEDIDO_LIST_FILTER_DEFAULTS,
  formatComercialHttpError,
  formatHttpListEmptyMessage,
  isHttpListQueryKeyScoped,
  buildHttpListQueryKey,
  buildOrcamentoListRequestParams,
  buildPedidoListRequestParams,
  buildOrcamentoTenantSwitchReset,
  buildPedidoTenantSwitchReset,
  clearComercialHttpCacheOnTenantSwitch,
  didComercialTenantScopeChange,
  hasActiveComercialListFilters,
  isStaleComercialHttpCacheQueryKey,
  normalizeOrcamentoListFilters,
  normalizePedidoListFilters,
  resolveHttpListViewState,
  resolveHttpMasterPickerState,
  formatMasterPickerPlaceholder,
  buildMastersHttpBannerText,
  buildSimularHttpErrorBannerText,
  isComercialRetryableHttpError,
  isMasterPickerBlocked,
  sanitizeListSearchText,
  sanitizeObservacoesText,
  COMERCIAL_OBSERVACOES_MAX_LENGTH,
  evaluateObservacoesUiGate,
  clampObservacoesInput,
  COMERCIAL_HTTP_CACHE_PREFIXES,
  isComercialMasterRowActive,
  isInactiveMasterSelectionKept,
  buildInactiveMasterSelectionPlaceholder,
  formatMasterPickerOptionLabel,
  inactiveMasterSelectionHint,
  filterActiveMasterRowsKeepingSelection,
  resolveComercialBannerAriaLive,
  buildComercialBannerA11yProps,
  buildItemLineHintId,
  buildItemLineFieldA11y,
  comercialActionAriaLabel,
  isComercialFormDirtyForAbandon,
  comercialFormAbandonMessage,
  confirmComercialFormAbandon,
  resolveComercialFormDialogOpenChange,
  createComercialFormBeforeUnloadHandler,
  bindComercialFormBeforeUnload,
  COMERCIAL_LIST_BULK_STUB_REASON,
  COMERCIAL_LIST_PAGE_EXPORT_SCOPE,
  ORCAMENTO_LIST_CSV_COLUMNS,
  PEDIDO_LIST_CSV_COLUMNS,
  escapeComercialCsvCell,
  buildComercialListCsv,
  resolveComercialListPageExportUi,
  downloadComercialCsvText,
  mapOrcamentoRowsForCsv,
  mapPedidoRowsForCsv,
  normalizeComercialListSelectedIds,
  isComercialListRowSelected,
  toggleComercialListRowSelection,
  toggleComercialListPageSelection,
  comercialListPageRowIds,
  isComercialListBulkActionEnabled,
  comercialListBulkActionTitle,
  resolveComercialListBulkUiState,
} from '../src/components/comercial/comercialListHttpUiPolicy.js';
import { buildOrcamentoPayload } from '../src/components/comercial/orcamentoUiPolicy.js';
import { buildPedidoPayload } from '../src/components/comercial/pedidoUiPolicy.js';

test('resolveHttpListViewState: 403/5xx nunca viram empty', () => {
  assert.equal(resolveHttpListViewState({ isLoading: true, isError: false, rowCount: 0 }), 'loading');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: true, rowCount: 0 }), 'error');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: true, rowCount: 12 }), 'error');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: false, rowCount: 0 }), 'empty');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: false, rowCount: 3 }), 'ready');
});

test('empty search result permanece empty — nunca error banner', () => {
  // Busca sem matches: rowCount=0 + isError=false → empty (não error)
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: false, rowCount: 0 }), 'empty');
  assert.match(
    formatHttpListEmptyMessage({ entityLabel: 'pedido', hasActiveFilters: true }),
    /filtros desta empresa/i,
  );
  assert.match(
    formatHttpListEmptyMessage({ entityLabel: 'orçamento', hasActiveFilters: false }),
    /encontrado nesta empresa/i,
  );
  assert.doesNotMatch(formatHttpListEmptyMessage({ hasActiveFilters: true }), /permissão|servidor|comunicar/i);
  // 403/5xx continuam error mesmo com rowCount 0
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: true, rowCount: 0 }), 'error');
  assert.match(formatComercialHttpError({ status: 403 }), /permissão/i);
  assert.match(formatComercialHttpError({ status: 500 }), /servidor/i);
});

test('sanitizeListSearchText e normalize filtros Orçamento/Pedido', () => {
  assert.equal(sanitizeListSearchText('  42  '), '42');
  assert.equal(sanitizeListSearchText('<b>12</b>'), 'b12/b');
  assert.equal(sanitizeListSearchText('javascript:alert(1)'), 'alert(1)');
  assert.equal(sanitizeListSearchText(''), '');
  const orc = normalizeOrcamentoListFilters({
    search: '  <x>99</x>  ',
    status: 'EM_ABERTO',
    clienteEmpresaId: 'ce-1',
    validadeDe: '2027-01-01',
    validadeAte: 'bad',
  });
  assert.equal(orc.search, 'x99/x');
  assert.equal(orc.status, 'EM_ABERTO');
  assert.equal(orc.clienteEmpresaId, 'ce-1');
  assert.equal(orc.validadeDe, '2027-01-01');
  assert.equal(orc.validadeAte, '');
  const ped = normalizePedidoListFilters({
    search: '  7  ',
    status: 'FATURADO',
    clienteEmpresaId: 'TODOS',
    tipoOperacao: 'ENTREGA',
  });
  assert.deepEqual(ped, {
    search: '7',
    status: 'FATURADO',
    clienteEmpresaId: 'TODOS',
    tipoOperacao: 'ENTREGA',
    dataEntregaDe: '',
    dataEntregaAte: '',
  });
  const pedDates = normalizePedidoListFilters({
    dataEntregaDe: '2027-03-01',
    dataEntregaAte: 'bad',
  });
  assert.equal(pedDates.dataEntregaDe, '2027-03-01');
  assert.equal(pedDates.dataEntregaAte, '');
  assert.equal(hasActiveComercialListFilters(orc, ORCAMENTO_LIST_FILTER_DEFAULTS), true);
  assert.equal(hasActiveComercialListFilters(ORCAMENTO_LIST_FILTER_DEFAULTS, ORCAMENTO_LIST_FILTER_DEFAULTS), false);
  assert.equal(hasActiveComercialListFilters(PEDIDO_LIST_FILTER_DEFAULTS, PEDIDO_LIST_FILTER_DEFAULTS), false);
  assert.equal(hasActiveComercialListFilters(pedDates, PEDIDO_LIST_FILTER_DEFAULTS), true);
});

test('build list request params omite TODOS e inclui search sanitizado', () => {
  const orcParams = buildOrcamentoListRequestParams(
    normalizeOrcamentoListFilters({ search: '10', status: 'TODOS', clienteEmpresaId: 'ce', validadeDe: '', validadeAte: '' }),
    { page: 2, pageSize: 10 },
  );
  assert.equal(orcParams.limit, 10);
  assert.equal(orcParams.offset, 10);
  assert.equal(orcParams.search, '10');
  assert.equal(orcParams.clienteEmpresaId, 'ce');
  assert.equal(orcParams.status, undefined);
  const pedParams = buildPedidoListRequestParams(
    normalizePedidoListFilters({ search: '', status: 'EM_ABERTO', tipoOperacao: 'RETIRADA', dataEntregaDe: '2027-03-01', dataEntregaAte: '2027-03-31' }),
    { page: 1, pageSize: 20 },
  );
  assert.equal(pedParams.search, undefined);
  assert.equal(pedParams.status, 'EM_ABERTO');
  assert.equal(pedParams.tipoOperacao, 'RETIRADA');
  assert.equal(pedParams.dataEntregaDe, '2027-03-01');
  assert.equal(pedParams.dataEntregaAte, '2027-03-31');
  assert.equal(pedParams.offset, 0);
});

test('formatComercialHttpError distingue 403, 5xx e rede sem mascarar como vazio', () => {
  assert.match(formatComercialHttpError({ status: 403 }), /permissão/i);
  assert.match(formatComercialHttpError({ status: 500 }), /servidor/i);
  assert.match(formatComercialHttpError({ status: 503 }), /servidor/i);
  assert.match(formatComercialHttpError({ message: 'Failed to fetch' }), /comunicar com o servidor/i);
  assert.match(formatComercialHttpError({ status: 404 }, { entityLabel: 'Pedido' }), /Pedido/i);
  assert.match(
    formatComercialHttpError({ status: 409 }, { conflictMessage: 'O orçamento foi alterado e não está mais em aberto.' }),
    /não está mais em aberto/i,
  );
  assert.match(
    formatComercialHttpError({
      status: 403,
      body: { error: { code: 'DESCONTO_ALCADA_DENIED', message: 'exige permissão de aprovar' } },
    }, { entityLabel: 'Orçamento' }),
    /alçada/i,
  );
  assert.doesNotMatch(formatComercialHttpError({ status: 403 }), /nenhum|vazio|encontrado nesta empresa/i);
  assert.doesNotMatch(formatComercialHttpError({ status: 500 }), /nenhum|vazio|encontrado nesta empresa/i);
});

test('queryKey list HTTP exige groupId + empresaId + filters', () => {
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1', 'e1', 1], { prefix: 'pedidos-http' }), true);
  assert.equal(isHttpListQueryKeyScoped(['orcamentos-http', 'g1', 'e1'], {
    prefix: 'orcamentos-http', groupId: 'g1', empresaId: 'e1',
  }), true);
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1'], { prefix: 'pedidos-http' }), false);
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1', 'e2'], {
    prefix: 'pedidos-http', groupId: 'g1', empresaId: 'e1',
  }), false);
  const filters = normalizePedidoListFilters({ search: '9' });
  const key = buildHttpListQueryKey({
    prefix: 'pedidos-http', groupId: 'g1', empresaId: 'e1', page: 1, pageSize: 20, filters,
  });
  assert.equal(isHttpListQueryKeyScoped(key, {
    prefix: 'pedidos-http', groupId: 'g1', empresaId: 'e1', requireFilters: true, filters,
  }), true);
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1', 'e1', 1, 20], {
    prefix: 'pedidos-http', requireFilters: true,
  }), false);
  assert.equal(isHttpListQueryKeyScoped(key, {
    prefix: 'pedidos-http', filters: normalizePedidoListFilters({ search: 'other' }),
  }), false);
});

test('sanitizeObservacoesText remove markup perigoso', () => {
  assert.equal(sanitizeObservacoesText('  ok  '), 'ok');
  assert.equal(sanitizeObservacoesText('<script>alert(1)</script>nota'), 'scriptalert(1)/scriptnota');
  assert.equal(sanitizeObservacoesText('javascript:alert(1)'), 'alert(1)');
  assert.equal(sanitizeObservacoesText(''), '');
});

test('evaluateObservacoesUiGate fail-closed no limite canônico 1000', () => {
  assert.equal(COMERCIAL_OBSERVACOES_MAX_LENGTH, 1000);
  const ok = evaluateObservacoesUiGate('nota curta');
  assert.equal(ok.blockSave, false);
  assert.equal(ok.overLimit, false);
  assert.equal(ok.max, 1000);
  assert.equal(ok.counterLabel, '10/1000');
  assert.equal(ok.hint, null);

  const atLimit = evaluateObservacoesUiGate('x'.repeat(1000));
  assert.equal(atLimit.blockSave, false);
  assert.equal(atLimit.length, 1000);
  assert.equal(atLimit.nearLimit, true);
  assert.equal(atLimit.counterLabel, '1000/1000');

  const over = evaluateObservacoesUiGate('x'.repeat(1001));
  assert.equal(over.blockSave, true);
  assert.equal(over.overLimit, true);
  assert.match(over.hint, /1000/);
  assert.equal(over.counterLabel, '1001/1000');

  assert.equal(clampObservacoesInput('x'.repeat(1500)).length, 1000);
  assert.equal(clampObservacoesInput('abc', 2), 'ab');
});

test('painéis Pedido/Orçamento aplicam gate UX de observações (maxLength + contador)', async () => {
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const orcamento = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  for (const source of [pedido, orcamento]) {
    assert.match(source, /evaluateObservacoesUiGate/);
    assert.match(source, /clampObservacoesInput/);
    assert.match(source, /COMERCIAL_OBSERVACOES_MAX_LENGTH|observacoesUi\.max/);
    assert.match(source, /observacoes-counter/);
    assert.match(source, /observacoesUi\.blockSave/);
    assert.match(source, /maxLength=\{observacoesUi\.max\}/);
  }
  assert.match(pedido, /pedido-observacoes/);
  assert.match(orcamento, /orcamento-observacoes/);
});

test('payload Orçamento/Pedido sanitiza observacoes no save', () => {
  const orc = buildOrcamentoPayload({
    cliente_empresa_id: 'c',
    condicao_pagamento_id: 'f',
    validade_em: '2027-01-01',
    observacoes: '  <b>proposta</b>  ',
    itens: [{
      produto_id: 'p', unidade_id: 'u', descricao: 'Item', unidade_sigla: 'UN',
      quantidade: '1', preco_unitario: '10', desconto: '0',
    }],
  });
  assert.equal(orc.observacoes, 'bproposta/b');
  const ped = buildPedidoPayload({
    cliente_empresa_id: 'c',
    condicao_pagamento_id: 'f',
    tipo_operacao: 'ENTREGA',
    data_entrega_solicitada: '2027-01-01',
    observacoes: '<img onerror=x>livre',
    itens: [{
      produto_id: 'p', unidade_id: 'u', descricao: 'Item', unidade_sigla: 'UN',
      quantidade: '1', preco_unitario: '10', desconto: '0', requer_producao: false,
    }],
  });
  assert.equal(ped.observacoes, 'img onerror=xlivre');
});

test('painéis Pedido/Orçamento usam list search/filter fail-closed e queryKey tenant+filters', async () => {
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const orcamento = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  for (const source of [pedido, orcamento]) {
    assert.match(source, /resolveHttpListViewState/);
    assert.match(source, /formatComercialHttpError/);
    assert.match(source, /formatHttpListEmptyMessage/);
    assert.match(source, /hasActiveComercialListFilters/);
    assert.match(source, /buildHttpListQueryKey/);
    assert.match(source, /Tentar novamente/);
    assert.match(source, /masters-error|Masters não carregados|não trate como lista vazia/);
    assert.match(source, /resolveHttpMasterPickerState/);
    assert.match(source, /formatMasterPickerPlaceholder/);
    assert.match(source, /buildMastersHttpBannerText/);
    assert.match(source, /isMasterPickerBlocked/);
    assert.match(source, /filterActiveMasterRowsKeepingSelection/);
    assert.match(source, /formatMasterPickerOptionLabel/);
    assert.match(source, /inactiveMasterSelectionHint/);
    assert.match(source, /masters-form-banner/);
    assert.match(source, /data-empty-filtered/);
    assert.match(source, /clearComercialHttpCacheOnTenantSwitch/);
    assert.match(source, /inactive-master-hint/);
    assert.match(source, /data-inactive/);
  }
  assert.match(pedido, /normalizePedidoListFilters/);
  assert.match(pedido, /buildPedidoListRequestParams/);
  assert.match(pedido, /PEDIDO_LIST_FILTER_DEFAULTS/);
  assert.match(pedido, /buildPedidoTenantSwitchReset/);
  assert.match(pedido, /pedido-list-data-entrega-de|dataEntregaDe/);
  assert.match(pedido, /pedido-list-data-entrega-ate|dataEntregaAte/);
  assert.match(pedido, /Comercial\.pedido\.list-data-entrega-filter/);
  assert.match(orcamento, /normalizeOrcamentoListFilters/);
  assert.match(orcamento, /buildOrcamentoListRequestParams/);
  assert.match(orcamento, /ORCAMENTO_LIST_FILTER_DEFAULTS/);
  assert.match(orcamento, /buildOrcamentoTenantSwitchReset/);
  assert.match(pedido, /prefix:\s*'pedidos-http'|prefix:'pedidos-http'/);
  assert.match(orcamento, /prefix:\s*'orcamentos-http'/);
  assert.match(pedido, /pedido-list-error/);
  assert.match(orcamento, /orcamento-list-error/);
  assert.match(pedido, /listView\s*===\s*'error'|listView==='error'/);
  assert.match(orcamento, /listView === 'error'/);
  assert.match(pedido, /pedido-condicao-picker/);
  assert.match(pedido, /pedido-tabela-picker/);
  assert.match(pedido, /pedido-produto-picker/);
  assert.match(pedido, /pedido-cliente-picker/);
  assert.match(orcamento, /orcamento-condicao-picker/);
  assert.match(orcamento, /orcamento-produto-picker/);
  assert.match(orcamento, /orcamento-cliente-picker/);
  assert.match(pedido, /canLoadTabelasPrecoHttp/);
  assert.match(orcamento, /canLoadCondicoesPagamentoHttp/);
  // erro não colapsa no empty state
  assert.doesNotMatch(pedido, /list\.isError\s*\?\s*rows\.length/);
  assert.doesNotMatch(orcamento, /listQuery\.isError\s*\?\s*rows\.length/);
});

test('tenant switch: detecta mudança e marca cache de outro tenant como stale', () => {
  assert.equal(didComercialTenantScopeChange({ groupId: 'g1', empresaId: 'e1' }, { groupId: 'g1', empresaId: 'e1' }), false);
  assert.equal(didComercialTenantScopeChange({ groupId: 'g1', empresaId: 'e1' }, { groupId: 'g1', empresaId: 'e2' }), true);
  assert.equal(didComercialTenantScopeChange({ groupId: 'g1', empresaId: 'e1' }, { groupId: 'g2', empresaId: 'e1' }), true);
  assert.equal(didComercialTenantScopeChange({}, { groupId: 'g1', empresaId: 'e1' }), true);
  assert.ok(COMERCIAL_HTTP_CACHE_PREFIXES.includes('orcamentos-http'));
  assert.ok(COMERCIAL_HTTP_CACHE_PREFIXES.includes('pedidos-http'));
  assert.ok(COMERCIAL_HTTP_CACHE_PREFIXES.includes('pedido-delivery'));
  assert.equal(
    isStaleComercialHttpCacheQueryKey(['pedidos-http', 'g1', 'e1', 1, 20, {}], { groupId: 'g1', empresaId: 'e2' }),
    true,
  );
  assert.equal(
    isStaleComercialHttpCacheQueryKey(['pedidos-http', 'g1', 'e2', 1, 20, {}], { groupId: 'g1', empresaId: 'e2' }),
    false,
  );
  assert.equal(
    isStaleComercialHttpCacheQueryKey(['orcamento-masters', 'g1', 'e1'], { groupId: 'g1', empresaId: 'e1' }),
    false,
  );
  assert.equal(
    isStaleComercialHttpCacheQueryKey(['unrelated', 'g1', 'e9'], { groupId: 'g1', empresaId: 'e1' }),
    false,
  );
  // Sem escopo atual: qualquer chave comercial prefixada é stale (fail-closed)
  assert.equal(isStaleComercialHttpCacheQueryKey(['pedidos-http', 'g1', 'e1'], {}), true);
});

test('tenant switch: clearComercialHttpCache remove stale e invalida atual', () => {
  const removed = [];
  const invalidated = [];
  const client = {
    removeQueries: ({ predicate }) => {
      const samples = [
        { queryKey: ['pedidos-http', 'g-old', 'e-old', 1, 20, {}] },
        { queryKey: ['pedidos-http', 'g-new', 'e-new', 1, 20, {}] },
        { queryKey: ['orcamentos-http', 'g-old', 'e-old'] },
        { queryKey: ['pedido-masters', 'g-new', 'e-new'] },
        { queryKey: ['other', 'g-old', 'e-old'] },
      ];
      for (const sample of samples) {
        if (predicate(sample)) removed.push(sample.queryKey[0] + ':' + sample.queryKey[1] + ':' + sample.queryKey[2]);
      }
    },
    invalidateQueries: ({ queryKey }) => {
      invalidated.push(queryKey.join('|'));
    },
  };
  const result = clearComercialHttpCacheOnTenantSwitch(client, { groupId: 'g-new', empresaId: 'e-new' });
  assert.equal(result.removedStale, true);
  assert.equal(result.invalidatedCurrent, true);
  assert.deepEqual(removed.sort(), [
    'orcamentos-http:g-old:e-old',
    'pedidos-http:g-old:e-old',
  ].sort());
  assert.ok(invalidated.some((key) => key.startsWith('pedidos-http|g-new|e-new')));
  assert.ok(invalidated.some((key) => key.startsWith('orcamentos-http|g-new|e-new')));
  assert.throws(
    () => clearComercialHttpCacheOnTenantSwitch(null, { groupId: 'g', empresaId: 'e' }),
    /queryClient obrigatório/,
  );
});

test('tenant switch: reset Orçamento/Pedido descarta form dirty e diálogos', () => {
  const orc = buildOrcamentoTenantSwitchReset({
    emptyForm: () => ({ cliente_empresa_id: '', itens: [] }),
  });
  assert.equal(orc.formOpen, false);
  assert.equal(orc.detailOpen, false);
  assert.equal(orc.dirty, false);
  assert.equal(orc.editing, null);
  assert.equal(orc.selected, null);
  assert.deepEqual(orc.selectedIds, []);
  assert.equal(orc.pendingCancel, null);
  assert.equal(orc.pendingConversion, null);
  assert.equal(orc.simulacaoDirty, false);
  assert.equal(orc.simulacaoPreview, null);
  assert.equal(orc.lastSimulation, null);
  assert.equal(orc.simularHttpError, null);
  assert.equal(orc.condicaoSnapshot, null);
  assert.deepEqual(orc.filters, ORCAMENTO_LIST_FILTER_DEFAULTS);
  assert.deepEqual(orc.appliedFilters, ORCAMENTO_LIST_FILTER_DEFAULTS);
  assert.deepEqual(orc.form, { cliente_empresa_id: '', itens: [] });
  const ped = buildPedidoTenantSwitchReset({
    emptyForm: () => ({ cliente_empresa_id: '', tipo_operacao: 'ENTREGA', itens: [] }),
  });
  assert.equal(ped.formOpen, false);
  assert.equal(ped.dirty, false);
  assert.equal(ped.editing, null);
  assert.deepEqual(ped.selectedIds, []);
  assert.deepEqual(ped.history, []);
  assert.equal(ped.pendingCancel, null);
  assert.equal(ped.pendingTransition, null);
  assert.deepEqual(ped.filters, PEDIDO_LIST_FILTER_DEFAULTS);
  assert.deepEqual(ped.applied, PEDIDO_LIST_FILTER_DEFAULTS);
  assert.equal(ped.promocaoSnapshot, null);
  assert.equal(ped.simularHttpError, null);
});

test('resolveHttpMasterPickerState: 403/5xx e denied nunca viram empty silencioso', () => {
  assert.equal(resolveHttpMasterPickerState({ isLoading: true, isError: false, rowCount: 0 }), 'loading');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: true, rowCount: 0 }), 'error');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: true, rowCount: 5 }), 'error');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: false, rowCount: 0, allowed: false }), 'denied');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: false, rowCount: 0 }), 'empty');
  assert.equal(resolveHttpMasterPickerState({ isLoading: false, isError: false, rowCount: 2 }), 'ready');
});

test('formatMasterPickerPlaceholder e banner masters não mascaram erro como vazio', () => {
  assert.equal(formatMasterPickerPlaceholder('loading'), 'Carregando...');
  assert.equal(formatMasterPickerPlaceholder('error'), 'Falha ao carregar');
  assert.equal(formatMasterPickerPlaceholder('denied'), 'Sem permissão');
  assert.match(formatMasterPickerPlaceholder('empty', 'produto'), /Nenhum produto/);
  assert.equal(formatMasterPickerPlaceholder('ready'), 'Selecione');
  assert.match(buildMastersHttpBannerText({ status: 403 }), /permissão/i);
  assert.match(buildMastersHttpBannerText({ status: 403 }), /não trate como lista vazia/i);
  assert.match(buildMastersHttpBannerText({ status: 500 }), /servidor/i);
  assert.doesNotMatch(buildMastersHttpBannerText({ status: 403 }), /nenhum encontrado nesta empresa/i);
  assert.equal(isMasterPickerBlocked({ isLoading: true, isError: false }), true);
  assert.equal(isMasterPickerBlocked({ isLoading: false, isError: true }), true);
  assert.equal(isMasterPickerBlocked({ isLoading: false, isError: false }), false);
});

test('filterActiveMasterRowsKeepingSelection: esconde inativos exceto seleção atual', () => {
  const rows = [
    { id: 'a', nome: 'Ativa', ativo: true },
    { id: 'b', nome: 'Inativa', ativo: false },
    { id: 'c', nome: 'Outra inativa', ativo: false },
    { id: 'd', nome: 'Bloqueada', ativo: true, bloqueado: true, habilitado_operacao: true },
    { id: 'e', nome: 'Desabilitada', ativo: true, bloqueado: false, habilitado_operacao: false },
  ];
  // Sem flags CE: inativos somem; ativo+bloqueado ainda entra (flag rejectBloqueado off)
  const onlyActive = filterActiveMasterRowsKeepingSelection(rows, null);
  assert.deepEqual(onlyActive.map((r) => r.id).sort(), ['a', 'd', 'e']);

  const keepB = filterActiveMasterRowsKeepingSelection(rows, 'b');
  assert.deepEqual(keepB.map((r) => r.id).sort(), ['a', 'b', 'd', 'e']);
  assert.equal(isInactiveMasterSelectionKept(keepB.find((r) => r.id === 'b')), true);
  assert.match(formatMasterPickerOptionLabel(keepB.find((r) => r.id === 'b')), /inativo/i);
  assert.equal(isInactiveMasterSelectionKept(keepB.find((r) => r.id === 'a')), false);

  // outros inativos continuam ocultos
  assert.equal(keepB.some((r) => r.id === 'c'), false);

  // seleção ausente da lista → ghost via placeholder
  const ghost = filterActiveMasterRowsKeepingSelection(rows, 'ghost-1', {
    placeholderById: { 'ghost-1': { codigo: 'LEG', nome: 'Legado' } },
  });
  assert.ok(ghost.some((r) => r.id === 'ghost-1'));
  const ghostRow = ghost.find((r) => r.id === 'ghost-1');
  assert.equal(ghostRow._inactiveSelection, true);
  assert.equal(ghostRow.ativo, false);
  assert.match(formatMasterPickerOptionLabel(ghostRow), /Legado \(inativo\)/);

  // ClienteEmpresa: exige habilitado e rejeita bloqueado, mas mantém seleção
  const ce = filterActiveMasterRowsKeepingSelection(rows, 'd', {
    requireHabilitadoOperacao: true,
    rejectBloqueado: true,
  });
  assert.deepEqual(ce.map((r) => r.id).sort(), ['a', 'd']);
  assert.ok(ce.some((r) => r.id === 'd'));
  assert.equal(ce.some((r) => r.id === 'e'), false);
  assert.equal(isComercialMasterRowActive(rows[3], { rejectBloqueado: true }), false);
  assert.equal(isComercialMasterRowActive(rows[4], { requireHabilitadoOperacao: true }), false);
  assert.match(inactiveMasterSelectionHint(ce, 'Cliente'), /Cliente atual está inativo/i);

  // sem seleção: placeholder não vaza
  assert.equal(buildInactiveMasterSelectionPlaceholder(''), null);
  assert.equal(buildInactiveMasterSelectionPlaceholder(null), null);
  assert.equal(inactiveMasterSelectionHint([{ id: 'a', ativo: true }]), null);

  // múltiplas seleções de produto (linhas)
  const produtos = filterActiveMasterRowsKeepingSelection(
    [{ id: 'p1', descricao: 'P1', ativo: true }, { id: 'p2', descricao: 'P2', ativo: false }],
    ['p1', 'p2', ''],
    { placeholderById: { p2: { descricao: 'Linha antiga' } } },
  );
  assert.deepEqual(produtos.map((r) => r.id).sort(), ['p1', 'p2']);
});

test('a11y: aria-live assertive em erro e polite em loading/info', () => {
  assert.equal(resolveComercialBannerAriaLive('error'), 'assertive');
  assert.equal(resolveComercialBannerAriaLive('destructive'), 'assertive');
  assert.equal(resolveComercialBannerAriaLive('loading'), 'polite');
  assert.equal(resolveComercialBannerAriaLive('info'), 'polite');
  assert.deepEqual(buildComercialBannerA11yProps('error'), {
    role: 'alert',
    'aria-live': 'assertive',
    'aria-atomic': true,
  });
  assert.deepEqual(buildComercialBannerA11yProps('loading'), {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': true,
  });
});

test('a11y: item line field aria-invalid + aria-describedby', () => {
  const issues = [
    { index: 0, field: 'quantidade', message: 'Item 1: quantidade deve ser maior que zero.' },
    { index: 1, field: 'preco_unitario', message: 'Item 2: preço unitário inválido.' },
  ];
  const qtd = buildItemLineFieldA11y({
    index: 0,
    field: 'quantidade',
    issues,
    lineHint: issues[0].message,
    idPrefix: 'orcamento-item',
  });
  assert.equal(qtd['aria-invalid'], true);
  assert.equal(qtd['aria-describedby'], 'orcamento-item-0-hint');
  assert.equal(qtd.describedById, buildItemLineHintId(0, 'orcamento-item'));

  const precoOk = buildItemLineFieldA11y({
    index: 0,
    field: 'preco_unitario',
    issues,
    lineHint: issues[0].message,
    idPrefix: 'orcamento-item',
  });
  assert.equal(precoOk['aria-invalid'], false);
  assert.equal(precoOk['aria-describedby'], undefined);

  const byHint = buildItemLineFieldA11y({
    index: 2,
    field: 'preco_unitario',
    issues: [],
    lineHint: 'Item 3: preço unitário deve ser maior que zero.',
    idPrefix: 'pedido-item',
  });
  assert.equal(byHint['aria-invalid'], true);
  assert.equal(byHint['aria-describedby'], 'pedido-item-2-hint');
});

test('a11y: nomes acessíveis Simular/Salvar/Cancelar/Resumo/Converter/Retry', () => {
  assert.equal(comercialActionAriaLabel('simular'), 'Simular venda');
  assert.equal(comercialActionAriaLabel('simular', { busy: true }), 'Simulando venda');
  assert.equal(comercialActionAriaLabel('salvar', { entityLabel: 'pedido' }), 'Salvar pedido');
  assert.equal(comercialActionAriaLabel('salvar', { entityLabel: 'orçamento', busy: true }), 'Salvando orçamento');
  assert.equal(comercialActionAriaLabel('cancelar', { entityLabel: 'pedido', numero: '00000007' }), 'Cancelar pedido 00000007');
  assert.equal(comercialActionAriaLabel('resumo', { entityLabel: 'orçamento', numero: 12 }), 'Abrir resumo texto do orçamento 12');
  assert.equal(comercialActionAriaLabel('converter'), 'Converter orçamento em pedido');
  assert.equal(comercialActionAriaLabel('retry'), 'Tentar novamente');
});

test('isComercialRetryableHttpError: só rede/5xx — 4xx não retry', () => {
  assert.equal(isComercialRetryableHttpError({ status: 500 }), true);
  assert.equal(isComercialRetryableHttpError({ status: 503 }), true);
  assert.equal(isComercialRetryableHttpError({ status: 0 }), true);
  assert.equal(isComercialRetryableHttpError({ message: 'Failed to fetch' }), true);
  assert.equal(isComercialRetryableHttpError({ status: 403 }), false);
  assert.equal(isComercialRetryableHttpError({ status: 404 }), false);
  assert.equal(isComercialRetryableHttpError({ status: 409 }), false);
  assert.equal(isComercialRetryableHttpError({ status: 422 }), false);
  assert.equal(isComercialRetryableHttpError(null), false);
});

test('buildSimularHttpErrorBannerText reusa formatComercialHttpError e fail-closed', () => {
  const net = buildSimularHttpErrorBannerText({ message: 'Failed to fetch' }, { entityLabel: 'Pedido' });
  assert.match(net, /comunicar com o servidor/i);
  assert.match(net, /Tentar novamente/i);
  assert.match(net, /não trate como preview vazio/i);
  assert.doesNotMatch(net, /nenhum|lista vazia|encontrado nesta empresa/i);
  const srv = buildSimularHttpErrorBannerText({ status: 502 }, { entityLabel: 'Orçamento' });
  assert.match(srv, /servidor/i);
  assert.match(srv, /Simulação não aplicada/i);
  // Mensagem base alinhada ao helper compartilhado
  assert.match(formatComercialHttpError({ status: 500 }), /servidor/i);
});

test('painéis Orçamento/Pedido wire a11y banners e labels (sem lib nova)', async () => {
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const ped = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const meta = await readFile(new URL('../server/src/api/router.ts', import.meta.url), 'utf8');
  for (const src of [orc, ped]) {
    assert.match(src, /buildComercialBannerA11yProps/);
    assert.match(src, /buildItemLineFieldA11y/);
    assert.match(src, /comercialActionAriaLabel\('simular'/);
    assert.match(src, /comercialActionAriaLabel\('salvar'/);
    assert.match(src, /comercialActionAriaLabel\('cancelar'/);
    assert.match(src, /comercialActionAriaLabel\('resumo'/);
    assert.match(src, /aria-describedby=\{/);
    assert.match(src, /buildItemLineHintId/);
    assert.doesNotMatch(src, /@radix-ui\/react-toast|react-aria|axe-core/);
  }
  assert.match(orc, /comercialActionAriaLabel\('converter'/);
  assert.match(meta, /Pedido backend HTTP is active/);
  assert.match(meta, /a11y Comercial HTTP/);
});

test('painéis Orçamento/Pedido: retry rede/5xx list/masters/simular fail-closed', async () => {
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const ped = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const meta = await readFile(new URL('../server/src/api/router.ts', import.meta.url), 'utf8');
  for (const src of [orc, ped]) {
    assert.match(src, /isComercialRetryableHttpError/);
    assert.match(src, /buildSimularHttpErrorBannerText/);
    assert.match(src, /simularHttpError/);
    assert.match(src, /simular-network-error/);
    assert.match(src, /data-retryable/);
    assert.match(src, /list-retry|masters-retry|simular-retry/);
    // Retry do list/masters gated por isComercialRetryableHttpError (não em todo isError)
    assert.match(src, /isComercialRetryableHttpError\([^)]*\)\s*&&/);
    assert.match(src, /Tentar novamente/);
    // Retry de simular reinvoca a mesma ação
    assert.match(src, /runSimularVenda/);
    assert.match(src, /setSimularHttpError\(isComercialRetryableHttpError/);
    assert.match(src, /onClick=\{\(\)\s*=>\s*\{\s*void runSimularVenda\(\);\s*\}\}|onClick=\{\(\)=>\{\s*void runSimularVenda\(\);\s*\}\}/);
  }
  assert.match(orc, /orcamento-simular-network-error/);
  assert.match(orc, /orcamento-list-retry/);
  assert.match(orc, /orcamento-masters-retry/);
  assert.match(orc, /orcamento-simular-retry/);
  assert.match(ped, /pedido-simular-network-error/);
  assert.match(ped, /pedido-list-retry/);
  assert.match(ped, /pedido-masters-retry/);
  assert.match(ped, /pedido-simular-retry/);
  assert.match(meta, /retry rede\/5xx/);
  assert.match(meta, /Pedido backend HTTP is active/);
  // Fail-closed: erro de list ainda resolve via resolveHttpListViewState (nunca empty silencioso)
  assert.match(orc, /resolveHttpListViewState/);
  assert.match(ped, /resolveHttpListViewState/);
});

test('dirty form abandon: dirty OU simulacaoDirty exigem confirm; fail-closed sem confirm', () => {
  assert.equal(isComercialFormDirtyForAbandon({}), false);
  assert.equal(isComercialFormDirtyForAbandon({ dirty: false, simulacaoDirty: false }), false);
  assert.equal(isComercialFormDirtyForAbandon({ dirty: true }), true);
  assert.equal(isComercialFormDirtyForAbandon({ simulacaoDirty: true }), true);
  assert.equal(isComercialFormDirtyForAbandon({ dirty: true, simulacaoDirty: true }), true);
  assert.match(comercialFormAbandonMessage('orcamento'), /orçamento/);
  assert.match(comercialFormAbandonMessage('pedido'), /pedido/);
  assert.equal(confirmComercialFormAbandon({ dirty: false }), true);
  assert.equal(confirmComercialFormAbandon({ dirty: true, confirmFn: () => true }), true);
  assert.equal(confirmComercialFormAbandon({ dirty: true, confirmFn: () => false }), false);
  assert.equal(confirmComercialFormAbandon({ simulacaoDirty: true, confirmFn: () => false }), false);
  // Sem confirmFn e sem global confirm → fail-closed (não abandona)
  assert.equal(confirmComercialFormAbandon({ dirty: true, confirmFn: null }), false);
  const kept = resolveComercialFormDialogOpenChange({
    nextOpen: false,
    dirty: true,
    confirmFn: () => false,
  });
  assert.deepEqual(kept, { formOpen: true, abandoned: false });
  const discarded = resolveComercialFormDialogOpenChange({
    nextOpen: false,
    dirty: true,
    entity: 'pedido',
    confirmFn: (msg) => {
      assert.match(msg, /pedido/);
      return true;
    },
  });
  assert.deepEqual(discarded, { formOpen: false, abandoned: true });
  assert.deepEqual(resolveComercialFormDialogOpenChange({ nextOpen: true, dirty: true }), {
    formOpen: true,
    abandoned: false,
  });
});

test('beforeunload handler só dispara com dirty; bind retorna cleanup', () => {
  const calls = [];
  const handler = createComercialFormBeforeUnloadHandler(() => true);
  const event = { preventDefault: () => calls.push('prevent'), returnValue: undefined };
  handler(event);
  assert.deepEqual(calls, ['prevent']);
  assert.equal(event.returnValue, '');
  const cleanHandler = createComercialFormBeforeUnloadHandler(false);
  const event2 = { preventDefault: () => calls.push('bad'), returnValue: undefined };
  cleanHandler(event2);
  assert.deepEqual(calls, ['prevent']);
  assert.equal(event2.returnValue, undefined);

  const listeners = [];
  const fakeWindow = {
    addEventListener: (type, fn) => listeners.push([type, fn]),
    removeEventListener: (type, fn) => {
      const idx = listeners.findIndex((row) => row[0] === type && row[1] === fn);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };
  const unbind = bindComercialFormBeforeUnload(fakeWindow, true);
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0][0], 'beforeunload');
  unbind();
  assert.equal(listeners.length, 0);
  assert.equal(typeof bindComercialFormBeforeUnload(null, true), 'function');
});

test('painéis Orçamento/Pedido: dirty abandon fail-closed (beforeunload + dialog confirm)', async () => {
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const ped = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const meta = await readFile(new URL('../server/src/api/router.ts', import.meta.url), 'utf8');
  for (const src of [orc, ped]) {
    assert.match(src, /bindComercialFormBeforeUnload/);
    assert.match(src, /confirmComercialFormAbandon/);
    assert.match(src, /resolveComercialFormDialogOpenChange/);
    assert.match(src, /handleFormDialogOpenChange/);
    assert.match(src, /dirty \|\| simulacaoDirty|dirty\|\|simulacaoDirty/);
    assert.match(src, /data-testid="(?:orcamento|pedido)-form-dialog"/);
    assert.match(src, /data-dirty=/);
    assert.doesNotMatch(src, /window\.confirm\('Descartar/);
  }
  assert.match(meta, /form dirty abandon fail-closed/);
  assert.match(meta, /Pedido backend HTTP is active/);
});

test('multi-select stub: normalize/toggle/page selection + bulk sempre disabled', () => {
  assert.deepEqual(normalizeComercialListSelectedIds([' a ', '', 'a', 'b', null]), ['a', 'b']);
  assert.deepEqual(normalizeComercialListSelectedIds(null), []);
  assert.equal(isComercialListRowSelected(['x', 'y'], 'y'), true);
  assert.equal(isComercialListRowSelected(['x'], 'z'), false);
  assert.equal(isComercialListRowSelected(['x'], ''), false);
  assert.deepEqual(toggleComercialListRowSelection(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleComercialListRowSelection(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(toggleComercialListRowSelection(['a'], ''), ['a']);
  assert.deepEqual(comercialListPageRowIds([{ id: '1' }, { id: '2' }, { id: '' }]), ['1', '2']);
  assert.deepEqual(
    toggleComercialListPageSelection(['keep'], [{ id: '1' }, { id: '2' }]),
    ['keep', '1', '2'],
  );
  assert.deepEqual(
    toggleComercialListPageSelection(['keep', '1', '2'], [{ id: '1' }, { id: '2' }]),
    ['keep'],
  );
  assert.equal(isComercialListBulkActionEnabled('cancelar'), false);
  assert.equal(isComercialListBulkActionEnabled('exportar'), false);
  assert.equal(COMERCIAL_LIST_BULK_STUB_REASON, 'em breve / sem endpoint');
  assert.match(comercialListBulkActionTitle('cancelar'), /em breve \/ sem endpoint/i);
  assert.match(comercialListBulkActionTitle('exportar'), /Exportar selecionados/);
  const ui = resolveComercialListBulkUiState({
    selectedIds: ['1', 'keep'],
    pageRows: [{ id: '1' }, { id: '2' }],
  });
  assert.equal(ui.selectedCount, 2);
  assert.equal(ui.allPageSelected, false);
  assert.equal(ui.somePageSelected, true);
  assert.equal(ui.headerChecked, false);
  assert.equal(ui.headerIndeterminate, true);
  assert.equal(ui.bulkEnabled, false);
  assert.equal(ui.bulkReason, COMERCIAL_LIST_BULK_STUB_REASON);
  assert.match(ui.cancelTitle, /sem endpoint/i);
  const all = resolveComercialListBulkUiState({
    selectedIds: ['1', '2'],
    pageRows: [{ id: '1' }, { id: '2' }],
  });
  assert.equal(all.headerChecked, true);
  assert.equal(all.headerIndeterminate, false);
  assert.equal(all.bulkEnabled, false);
});

test('painéis Orçamento/Pedido: multi-select UI stub fail-closed (sem API bulk)', async () => {
  const orc = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const ped = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const meta = await readFile(new URL('../server/src/api/router.ts', import.meta.url), 'utf8');
  for (const src of [orc, ped]) {
    assert.match(src, /resolveComercialListBulkUiState/);
    assert.match(src, /toggleComercialListRowSelection/);
    assert.match(src, /toggleComercialListPageSelection/);
    assert.match(src, /selectedIds/);
    assert.match(src, /list-bulk-bar/);
    assert.match(src, /list-bulk-cancel/);
    assert.match(src, /list-select-all/);
    assert.match(src, /data-bulk-enabled="false"/);
    assert.match(src, /data-bulk-reason=\{listBulkUi\.bulkReason\}/);
    assert.doesNotMatch(src, /bulkCancel|bulk-cancel-api|\/bulk\/cancel|cancelMany|cancelSelected\(/i);
  }
  assert.match(meta, /listMultiSelectStubFailClosed: true/);
  assert.match(meta, /multi-select stub fail-closed/);
  assert.match(meta, /em breve \/ sem endpoint/);
  assert.match(meta, /Pedido backend HTTP is active/);
});

test('Export CSV página: escape/build/gate fail-closed', () => {
  assert.equal(escapeComercialCsvCell('a,b'), '"a,b"');
  assert.equal(escapeComercialCsvCell('diz "oi"'), '"diz ""oi"""');
  assert.equal(COMERCIAL_LIST_PAGE_EXPORT_SCOPE, 'pagina-atual');
  const csv = buildComercialListCsv(
    [{ numero: '00000001', total: '10.00', status: 'EM_ABERTO' }],
    [{ key: 'numero', header: 'Numero' }, { key: 'total', header: 'Total' }, { key: 'status', header: 'Status' }],
  );
  assert.equal(csv, 'Numero,Total,Status\n00000001,10.00,EM_ABERTO');
  assert.equal(resolveComercialListPageExportUi({ listView: 'ready', rowCount: 2, canView: true }).canExport, true);
  assert.equal(resolveComercialListPageExportUi({ listView: 'empty', rowCount: 0, canView: true }).blockExport, true);
  assert.equal(resolveComercialListPageExportUi({ listView: 'error', rowCount: 3, canView: true }).blockExport, true);
  assert.equal(resolveComercialListPageExportUi({ listView: 'ready', rowCount: 1, canView: false }).blockExport, true);
  const mappedOrc = mapOrcamentoRowsForCsv([{ id: '1', numero: '1', cliente_empresa_id: 'c', itens: [1], status: 'EM_ABERTO' }], () => 'Cliente X');
  assert.equal(mappedOrc[0].cliente_label, 'Cliente X');
  assert.equal(mappedOrc[0].itens_count, 1);
  const mappedPed = mapPedidoRowsForCsv([{ numero: '2', cliente_empresa_id: 'c', tipo_operacao: 'ENTREGA', total: '1' }], () => 'Y');
  assert.equal(mappedPed[0].cliente_label, 'Y');
  assert.ok(ORCAMENTO_LIST_CSV_COLUMNS.length >= 5);
  assert.ok(PEDIDO_LIST_CSV_COLUMNS.length >= 4);
  const clicks = [];
  const result = downloadComercialCsvText('t.csv', 'a,b\n1,2', {
    createObjectURL: () => 'blob:test',
    revokeObjectURL: () => {},
    document: {
      createElement: () => ({
        click() { clicks.push('click'); },
        remove() {},
        set href(_v) {},
        get href() { return ''; },
        set download(_v) {},
        get download() { return ''; },
        set rel(_v) {},
      }),
      body: { appendChild() {}, removeChild() {} },
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(clicks, ['click']);
  assert.equal(downloadComercialCsvText('t.csv', '').ok, false);
});

test('painéis Orçamento/Pedido: CSV página atual (fail-closed gate)', async () => {
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const orcamento = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  for (const source of [pedido, orcamento]) {
    assert.match(source, /resolveComercialListPageExportUi/);
    assert.match(source, /buildComercialListCsv/);
    assert.match(source, /downloadComercialCsvText/);
    assert.match(source, /list-export-csv/);
    assert.match(source, /export-csv-pagina/);
    assert.match(source, /listPageExportUi\.blockExport/);
  }
  assert.match(orcamento, /mapOrcamentoRowsForCsv/);
  assert.match(pedido, /mapPedidoRowsForCsv/);
});
