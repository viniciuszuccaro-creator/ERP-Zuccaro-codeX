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
  });
  assert.equal(hasActiveComercialListFilters(orc, ORCAMENTO_LIST_FILTER_DEFAULTS), true);
  assert.equal(hasActiveComercialListFilters(ORCAMENTO_LIST_FILTER_DEFAULTS, ORCAMENTO_LIST_FILTER_DEFAULTS), false);
  assert.equal(hasActiveComercialListFilters(PEDIDO_LIST_FILTER_DEFAULTS, PEDIDO_LIST_FILTER_DEFAULTS), false);
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
    normalizePedidoListFilters({ search: '', status: 'EM_ABERTO', tipoOperacao: 'RETIRADA' }),
    { page: 1, pageSize: 20 },
  );
  assert.equal(pedParams.search, undefined);
  assert.equal(pedParams.status, 'EM_ABERTO');
  assert.equal(pedParams.tipoOperacao, 'RETIRADA');
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
  assert.deepEqual(ped.history, []);
  assert.equal(ped.pendingCancel, null);
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
