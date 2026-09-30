import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildOrcamentoPayload,
  buildOrcamentoResumoTexto,
  buildOrcamentoShareText,
  calculateItem,
  calculateTotals,
  canUseOrcamentoAction,
  collectItemLineIssues,
  comercialDocumentoSnapshotGapHint,
  evaluateItemLinesGate,
  evaluateOrcamentoConvertUiGate,
  isOrcamentoValidadeExpirada,
  mapOrcamentoRowToForm,
  microsToDecimal,
  ORCAMENTO_CONVERT_DIRTY_HINT,
  ORCAMENTO_CONVERT_SIMULAR_DIRTY_HINT,
  orcamentoConvertSnapshotHint,
  orcamentoValidadeHint,
  evaluateOrcamentoValidadeUiGate,
  evaluateOrcamentoPrintPdfUiGate,
  evaluateOrcamentoShareUiGate,
  resolveOrcamentoDetailSummaryUiState,
  evaluateOrcamentoCancelMotivoUiGate,
  ORCAMENTO_CANCEL_MOTIVO_MAX,
  todayOrcamentoValidadeCalendarDay,
  resolveOrcamentoResumoPreviewState,
  resolveOrcamentoPrintPermission,
  resolveOrcamentoSharePermission,
} from '../src/components/comercial/orcamentoUiPolicy.js';

const form = () => ({
  cliente_empresa_id: 'cliente-empresa-1',
  condicao_pagamento_id: 'condicao-1',
  validade_em: '2026-10-01',
  observacoes: '  proposta sintética  ',
  groupId: 'nao-enviar', empresaId: 'nao-enviar', total: '999', status: 'CANCELADO', numero: 99,
  itens: [{
    produto_id: 'produto-1', unidade_id: 'unidade-1', descricao: 'Produto sintético',
    unidade_sigla: 'UN', quantidade: '2.500000', preco_unitario: '10.200000', desconto: '0.500000',
  }],
});

test('calculo de orcamento usa inteiros decimais e nao float', () => {
  assert.deepEqual(calculateItem(form().itens[0]), { subtotal: '25.500000', total: '25.000000' });
  const totals = calculateTotals(form().itens);
  assert.equal(microsToDecimal(totals.subtotal), '25.500000');
  assert.equal(microsToDecimal(totals.desconto), '0.500000');
  assert.equal(microsToDecimal(totals.total), '25.000000');
});

test('payload permite somente campos comerciais e ignora tenant, status, numero e totais', () => {
  const payload = buildOrcamentoPayload(form());
  assert.equal(payload.observacoes, 'proposta sintética');
  assert.deepEqual(Object.keys(payload).sort(), ['cliente_empresa_id', 'condicao_pagamento_id', 'itens', 'observacoes', 'validade_em']);
  assert.equal(payload.itens[0].quantidade, '2.500000');
  assert.equal('groupId' in payload, false);
  assert.equal('total' in payload, false);
});

test('payload inclui refs de promoção quando a simulação aplicada confirma', () => {
  const payload = buildOrcamentoPayload(form(), {
    promocao: { aplicada: true, bps: 500, cupom: 'CPA10' },
  });
  assert.deepEqual(payload.promocao, { bps: 500, cupom: 'CPA10' });
  const fromPersisted = buildOrcamentoPayload({
    ...form(),
    promocao_aplicada: true,
    promocao_bps: 250,
    promocao_cupom: 'VIP5',
  });
  assert.deepEqual(fromPersisted.promocao, { bps: 250, cupom: 'VIP5' });
  assert.equal('promocao' in buildOrcamentoPayload(form()), false);
});

test('politica visual exige permissao exata e estado editavel', () => {
  const allow = (module, section, action) => module === 'Comercial' && section === 'orcamento' && action !== 'cancelar';
  assert.equal(canUseOrcamentoAction(allow, 'visualizar'), true);
  assert.equal(canUseOrcamentoAction(allow, 'editar', 'EM_ABERTO'), true);
  assert.equal(canUseOrcamentoAction(allow, 'editar', 'CANCELADO'), false);
  assert.equal(canUseOrcamentoAction(allow, 'cancelar', 'EM_ABERTO'), false);
});

test('Comercial integra orcamentos sem persistencia Base44 paralela', async () => {
  const page = await readFile(new URL('../src/pages/Comercial.jsx', import.meta.url), 'utf8');
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const meta = await readFile(new URL('../server/src/api/router.ts', import.meta.url), 'utf8');
  assert.match(page, /sectionKey: 'orcamento'[\s\S]*exactPermission: true/);
  assert.match(tab, /createHttpApiClient[\s\S]*\.orcamentos/);
  assert.match(tab, /\['orcamentos-http', groupId, empresaId/);
  assert.doesNotMatch(tab, /base44\.entities\.Orcamento/);
  assert.match(meta, /orcamento:\s*\{[\s\S]*frontendHttp: true/);
});

test('payload invalido e bloqueado antes da chamada HTTP', () => {
  assert.throws(() => buildOrcamentoPayload({ ...form(), cliente_empresa_id: '' }), /cliente/i);
  assert.throws(() => buildOrcamentoPayload({ ...form(), itens: [] }), /item/i);
  assert.throws(() => buildOrcamentoPayload({ ...form(), itens: [{ ...form().itens[0], quantidade: '0' }] }), /quantidade/i);
  assert.throws(() => buildOrcamentoPayload({ ...form(), itens: [{ ...form().itens[0], preco_unitario: '0' }] }), /preço unitário/i);
  assert.throws(() => buildOrcamentoPayload({ ...form(), itens: [{ ...form().itens[0], desconto: '99' }] }), /desconto/i);
  assert.throws(
    () => buildOrcamentoPayload({ ...form(), validade_em: '2020-01-01' }, { now: new Date('2026-09-29T15:00:00.000Z') }),
    /Validade expirada/i,
  );
});

test('gate de itens bloqueia save com preço/quantidade zero e simular sem produto', () => {
  assert.throws(() => calculateItem({ ...form().itens[0], preco_unitario: '0' }), /preço unitário/i);
  const zeroPrice = evaluateItemLinesGate([{ ...form().itens[0], preco_unitario: '0' }]);
  assert.equal(zeroPrice.blockSave, true);
  assert.equal(zeroPrice.ok, false);
  assert.match(zeroPrice.hint || '', /preço unitário/i);
  assert.match(zeroPrice.lineHints[0] || '', /preço unitário/i);

  const zeroQty = evaluateItemLinesGate([{ ...form().itens[0], quantidade: '0' }]);
  assert.equal(zeroQty.blockSave, true);
  assert.match(zeroQty.hint || '', /quantidade/i);

  const empty = evaluateItemLinesGate([]);
  assert.equal(empty.blockSave, true);
  assert.equal(empty.blockSimular, true);

  const missingProduct = collectItemLineIssues({
    produto_id: '', unidade_id: '', descricao: '', unidade_sigla: '', quantidade: '1', preco_unitario: '0',
  }, 0, { purpose: 'simular' });
  assert.ok(missingProduct.some((issue) => issue.field === 'produto_id'));
  const simGate = evaluateItemLinesGate([{
    produto_id: '', unidade_id: '', descricao: '', unidade_sigla: '', quantidade: '1', preco_unitario: '0',
  }]);
  assert.equal(simGate.blockSimular, true);
  assert.equal(simGate.blockSave, true);

  const ok = evaluateItemLinesGate([form().itens[0]]);
  assert.equal(ok.ok, true);
  assert.equal(ok.blockSave, false);
  assert.equal(ok.blockSimular, false);
});

test('hint e detecção de validade expirada no UI policy', () => {
  const now = new Date('2026-09-29T15:00:00.000Z');
  assert.equal(isOrcamentoValidadeExpirada('2020-01-01', now), true);
  assert.equal(isOrcamentoValidadeExpirada('2027-01-01', now), false);
  assert.match(orcamentoValidadeHint('2020-01-01', now), /expirada/i);
  assert.equal(orcamentoValidadeHint('2027-01-01', now), null);
  const emptyGate=evaluateOrcamentoValidadeUiGate('', now);
  assert.equal(emptyGate.blockSave, true);
  assert.equal(emptyGate.mode, 'required');
  const expiredGate=evaluateOrcamentoValidadeUiGate('2020-01-01', now);
  assert.equal(expiredGate.blockSave, true);
  assert.equal(expiredGate.mode, 'expired');
  const okGate=evaluateOrcamentoValidadeUiGate('2027-01-01', now);
  assert.equal(okGate.blockSave, false);
  assert.equal(okGate.mode, 'ready');
  assert.match(okGate.minDay, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(todayOrcamentoValidadeCalendarDay(now), okGate.minDay);
});

test('hint de convert snapshot incompleto (pós-031) no UI policy', () => {
  assert.match(
    String(orcamentoConvertSnapshotHint({
      tabela_preco_id: '55555555-5555-4555-8555-555555555555',
    })),
    /tabela/i,
  );
  assert.match(
    String(orcamentoConvertSnapshotHint({
      condicao_pagamento_codigo_snapshot: 'SNAP',
      condicao_pagamento_nome_snapshot: '',
    })),
    /condição/i,
  );
  assert.equal(orcamentoConvertSnapshotHint({
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: '28 dias',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: '55555555-5555-4555-8555-555555555555',
    tabela_preco_codigo_snapshot: 'TAB',
    tabela_preco_nome_snapshot: 'Tabela',
    promocao_aplicada: false,
  }), null);
  assert.equal(orcamentoConvertSnapshotHint({ condicao_pagamento_id: 'x' }), null);
});

test('evaluateOrcamentoConvertUiGate consolida validade+snapshot+dirty+simular', () => {
  const now = new Date('2026-09-29T15:00:00.000Z');
  const okRow = {
    id: 'orc-1',
    status: 'EM_ABERTO',
    validade_em: '2027-01-01',
    condicao_pagamento_codigo_snapshot: 'SNAP-28',
    condicao_pagamento_nome_snapshot: '28 dias',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
  };
  const ready = evaluateOrcamentoConvertUiGate({ row: okRow, now });
  assert.equal(ready.blockConvert, false);
  assert.equal(ready.bannerText, null);
  assert.deepEqual(ready.reasons, []);

  const expired = evaluateOrcamentoConvertUiGate({
    row: { ...okRow, validade_em: '2020-01-01' },
    now,
  });
  assert.equal(expired.blockConvert, true);
  assert.equal(expired.validade, true);
  assert.match(String(expired.bannerText), /Conversão bloqueada/);
  assert.match(String(expired.bannerText), /expirada/i);

  const snap = evaluateOrcamentoConvertUiGate({
    row: {
      ...okRow,
      tabela_preco_id: '55555555-5555-4555-8555-555555555555',
      tabela_preco_codigo_snapshot: '',
    },
    now,
  });
  assert.equal(snap.blockConvert, true);
  assert.equal(snap.snapshot, true);
  assert.match(String(snap.bannerText), /tabela/i);

  const dirtyOnlyOther = evaluateOrcamentoConvertUiGate({
    row: okRow,
    dirty: true,
    simulacaoDirty: true,
    editingId: 'outro',
    now,
  });
  assert.equal(dirtyOnlyOther.blockConvert, false);

  const dirtySame = evaluateOrcamentoConvertUiGate({
    row: okRow,
    dirty: true,
    editingId: 'orc-1',
    now,
  });
  assert.equal(dirtySame.blockConvert, true);
  assert.equal(dirtySame.dirty, true);
  assert.match(String(dirtySame.bannerText), /não salvas/i);
  assert.equal(dirtySame.title, ORCAMENTO_CONVERT_DIRTY_HINT);

  const simDirty = evaluateOrcamentoConvertUiGate({
    row: okRow,
    simulacaoDirty: true,
    editingId: 'orc-1',
    now,
  });
  assert.equal(simDirty.blockConvert, true);
  assert.equal(simDirty.simularDirty, true);
  assert.equal(simDirty.title, ORCAMENTO_CONVERT_SIMULAR_DIRTY_HINT);

  const all = evaluateOrcamentoConvertUiGate({
    row: {
      ...okRow,
      validade_em: '2020-01-01',
      tabela_preco_id: '55555555-5555-4555-8555-555555555555',
    },
    dirty: true,
    simulacaoDirty: true,
    editingId: 'orc-1',
    now,
  });
  assert.equal(all.blockConvert, true);
  assert.equal(all.validade, true);
  assert.equal(all.snapshot, true);
  assert.equal(all.dirty, true);
  assert.equal(all.simularDirty, true);
  assert.equal(all.reasons.length, 4);
  assert.match(String(all.bannerText), / · /);
});

test('tela Orçamento: convert banner consolidado (validade+snapshot+dirty+simular)', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const meta = await readFile(new URL('../server/src/api/router.ts', import.meta.url), 'utf8');
  assert.match(tab, /evaluateOrcamentoConvertUiGate/);
  assert.match(tab, /selectedConvertGate/);
  assert.match(tab, /pendingConvertGate/);
  assert.match(tab, /orcamento-convert-blocked-banner/);
  assert.match(tab, /orcamento-convert-dialog-blocked-banner/);
  assert.match(tab, /data-convert-validade/);
  assert.match(tab, /data-convert-snapshot/);
  assert.match(tab, /data-convert-dirty/);
  assert.match(tab, /data-convert-simular/);
  assert.match(tab, /Comercial\.orcamento\.convert-blocked/);
  assert.doesNotMatch(tab, /selectedExpired|selectedSnapshotHint|pendingExpired|pendingSnapshotHint/);
  assert.match(meta, /convertDisabledReasonsBannerFailClosed: true/);
  assert.match(meta, /evaluateOrcamentoConvertUiGate/);
  assert.match(meta, /Pedido backend HTTP is active/);
});

test('tela contempla estados, detalhe, edicao, confirmacao e invalidacao por empresa', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const listPolicy = await readFile(new URL('../src/components/comercial/comercialListHttpUiPolicy.js', import.meta.url), 'utf8');
  assert.match(tab, /Carregando orçamentos/);
  assert.match(tab, /formatHttpListEmptyMessage/);
  assert.match(tab, /listEmptyMessage/);
  assert.match(listPolicy, /Nenhum \$\{entity\} encontrado para os filtros desta empresa/);
  assert.match(tab, /Pesquisar número/);
  assert.match(tab, /clienteEmpresaId/);
  assert.match(tab, /validadeDe/);
  assert.match(tab, /validadeAte/);
  assert.match(tab, /Tentar novamente/);
  assert.match(tab, /showDetail/);
  assert.match(tab, /openEdit/);
  assert.match(tab, /Cancelar orçamento \{pendingCancel\?\.numero\}\?/);
  assert.match(tab, /bindComercialFormBeforeUnload/);
  assert.match(tab, /\[groupId, empresaId, queryClient\]/);
  assert.match(tab, /clearComercialHttpCacheOnTenantSwitch/);
  assert.match(tab, /buildOrcamentoTenantSwitchReset/);
  assert.match(tab, /invalidateQueries\(\{ queryKey: \['orcamentos-http', groupId, empresaId\]/);
  assert.match(tab, /evaluateOrcamentoValidadeUiGate/);
  assert.match(tab, /orcamento-validade-gate/);
  assert.match(tab, /validadeUi\.blockSave/);
  assert.match(tab, /min=\{validadeUi\.minDay\}/);
  assert.match(tab, /orcamentoValidadeHint|Comercial\.orcamento\.validade-hint/);
  assert.match(listPolicy, /ORCAMENTO_VALIDADE_EXPIRADA/);
  assert.match(tab, /formatComercialHttpError|resolveHttpListViewState/);
  assert.match(tab, /isOrcamentoValidadeExpirada/);
  assert.match(tab, /evaluateOrcamentoConvertUiGate|Comercial\.orcamento\.convert-blocked/);
});
test('preparacao de compartilhamento usa somente resumo comercial revisavel', () => {
  const text = buildOrcamentoShareText({ numero: '00000042', status: 'EM_ABERTO', validade_em: '2027-01-31T00:00:00.000Z', total: '125.500000' }, { empresaNome: 'Empresa Sintetica', clienteNome: 'Cliente Sintetico' });
  assert.match(text, /Orçamento 00000042/);
  assert.match(text, /Cliente Sintetico/);
  assert.match(text, /R\$\s*125,50/);
  assert.doesNotMatch(text, /groupId|empresaId|actorId|token/i);
});

test('resumo texto orçamento inclui snapshots e bloqueia incompletos pós-031', () => {
  const completo = {
    numero: '00000077',
    status: 'EM_ABERTO',
    validade_em: '2027-03-01T12:00:00.000Z',
    condicao_pagamento_id: 'cp1',
    condicao_pagamento_codigo_snapshot: '28D',
    condicao_pagamento_nome_snapshot: '28 dias',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 28, percentual: '100.000000' }],
    tabela_preco_id: 'tab1',
    tabela_preco_codigo_snapshot: 'ATAC',
    tabela_preco_nome_snapshot: 'Atacado',
    promocao_aplicada: true,
    promocao_bps: 250,
    promocao_cupom: 'CPA',
    subtotal: '100.000000',
    desconto: '2.500000',
    total: '97.500000',
    itens: [{ descricao: 'Barra', unidade_sigla: 'UN', quantidade: '1.000000', preco_unitario: '100.000000', desconto: '2.500000', total: '97.500000' }],
  };
  const text = buildOrcamentoResumoTexto(completo, { empresaNome: 'Zuccaro', clienteNome: 'Cliente A' });
  assert.match(text, /Orçamento 00000077/);
  assert.match(text, /28D — 28 dias/);
  assert.match(text, /#1 · 28 dias · 100\.000000%/);
  assert.match(text, /ATAC — Atacado/);
  assert.match(text, /Promoção: 250 bps · cupom CPA/);
  assert.match(text, /Barra/);
  assert.doesNotMatch(text, /groupId|empresaId|token/i);
  const ready = resolveOrcamentoResumoPreviewState(completo, { clienteNome: 'Cliente A' });
  assert.equal(ready.mode, 'ready');
  assert.equal(ready.canPrint, true);
  const incompleto = {
    ...completo,
    condicao_pagamento_nome_snapshot: '',
    condicao_pagamento_parcelas_snapshot: [],
  };
  const blocked = resolveOrcamentoResumoPreviewState(incompleto);
  assert.equal(blocked.mode, 'blocked');
  assert.equal(blocked.canPrint, false);
  assert.match(blocked.hint || '', /Snapshots de condição incompletos/);
  assert.equal(comercialDocumentoSnapshotGapHint(incompleto, { purpose: 'resumo', entityLabel: 'orçamento' }), blocked.hint);
  assert.match(orcamentoConvertSnapshotHint(incompleto) || '', /antes de converter/);
  const legado = { numero: '00000001', status: 'EM_ABERTO', validade_em: '2027-01-01', total: '10', itens: [] };
  assert.equal(comercialDocumentoSnapshotGapHint(legado), null);
  assert.equal(resolveOrcamentoResumoPreviewState(legado).mode, 'ready');
});

test('painel orçamento wire resumo texto sem PDF novo', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(tab, /resolveOrcamentoResumoPreviewState/);
  assert.match(tab, /openComercialResumoTextoWindow/);
  assert.match(tab, /orcamento-resumo-texto-dialog/);
  assert.match(tab, /Comercial\.orcamento\.resumo-texto/);
  assert.match(tab, /Resumo texto/);
  assert.doesNotMatch(tab, /jspdf|pdfkit|html2pdf/i);
});

test('painel orçamento wire gate de itens quantidade/preço fail-closed', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(tab, /evaluateItemLinesGate/);
  assert.match(tab, /orcamento-item-lines-gate/);
  assert.match(tab, /itemLinesGate\.blockSave/);
  assert.match(tab, /itemLinesGate\.blockSimular/);
  assert.match(tab, /Comercial\.orcamento\.item-line-validation/);
});

test('impressao de orcamento escapa campos livres e nao depende de credencial externa', async () => {
  const source = await readFile(new URL('../src/components/lib/exportacaoPDF.jsx', import.meta.url), 'utf8');
  assert.match(source, /export function gerarPDFOrcamento/);
  assert.match(source, /escapeDocumentText\(item\.descricao\)/);
  assert.match(source, /escapeDocumentText\(orcamento\.observacoes/);
  assert.match(source, /printWindow\.opener = null/);
  assert.doesNotMatch(source, /api[_-]?key|access[_-]?token|service[_-]?role/i);
});

test('mapOrcamentoRowToForm recarrega campos canônicos sem inventar snapshots', () => {
  const mapped = mapOrcamentoRowToForm({
    id: 'o1',
    numero: '00000001',
    cliente_empresa_id: 'ce',
    condicao_pagamento_id: 'cp',
    validade_em: '2026-12-01T12:00:00.000Z',
    observacoes: 'ok',
    condicao_pagamento_nome_snapshot: '28 dias',
    itens: [{
      produto_id: 'p', unidade_id: 'u', descricao: 'X', unidade_sigla: 'UN',
      quantidade: '1.000000', preco_unitario: '10.000000', desconto: '0.000000',
    }],
  });
  assert.equal(mapped.cliente_empresa_id, 'ce');
  assert.equal(mapped.condicao_pagamento_id, 'cp');
  assert.equal(mapped.validade_em, '2026-12-01');
  assert.equal(mapped.observacoes, 'ok');
  assert.equal(mapped.itens.length, 1);
  assert.equal('condicao_pagamento_nome_snapshot' in mapped, false);
  assert.equal('numero' in mapped, false);
});

test('orcamento print/share RBAC sem fallback visualizar', () => {
  const onlyView = (_m, _r, a) => a === 'visualizar';
  assert.equal(resolveOrcamentoPrintPermission(onlyView), false);
  assert.equal(resolveOrcamentoSharePermission(onlyView), false);
  const printer = (_m, _r, a) => a === 'imprimir' || a === 'exportar';
  assert.equal(resolveOrcamentoPrintPermission(printer), true);
  assert.equal(resolveOrcamentoSharePermission(printer), false);
  const sharer = (_m, _r, a) => a === 'compartilhar' || a === 'notificar';
  assert.equal(resolveOrcamentoPrintPermission(sharer), false);
  assert.equal(resolveOrcamentoSharePermission(sharer), true);
});

test('orcamento print/share gates fail-closed', () => {
  assert.equal(evaluateOrcamentoPrintPdfUiGate({ row: { numero: '1', itens: [] }, groupId: '', empresaId: 'e', canPrint: true }).mode, 'context');
  assert.equal(evaluateOrcamentoPrintPdfUiGate({ row: { numero: '1', itens: [] }, groupId: 'g', empresaId: 'e', canPrint: false }).mode, 'permission');
  assert.equal(evaluateOrcamentoPrintPdfUiGate({ row: null, groupId: 'g', empresaId: 'e', canPrint: true }).mode, 'missing');
  assert.equal(evaluateOrcamentoPrintPdfUiGate({ row: { numero: '1' }, groupId: 'g', empresaId: 'e', canPrint: true }).mode, 'invalid');
  assert.equal(evaluateOrcamentoPrintPdfUiGate({ row: { numero: '1', itens: [] }, groupId: 'g', empresaId: 'e', canPrint: true }).blockPrint, false);
  assert.equal(evaluateOrcamentoShareUiGate({ row: { numero: '1' }, groupId: 'g', empresaId: 'e', canShare: false }).mode, 'permission');
  assert.equal(evaluateOrcamentoShareUiGate({ row: { numero: '1' }, groupId: 'g', empresaId: 'e', canShare: true }).blockShare, false);
  const gapRow = {
    numero: '1',
    itens: [],
    tabela_preco_id: 't1',
    tabela_preco_codigo_snapshot: 'T1',
    tabela_preco_nome_snapshot: '',
  };
  const gapPrint = evaluateOrcamentoPrintPdfUiGate({ row: gapRow, groupId: 'g', empresaId: 'e', canPrint: true });
  assert.equal(gapPrint.mode, 'snapshot_gap');
  assert.equal(gapPrint.blockPrint, true);
  assert.match(gapPrint.hint, /imprimir ou compartilhar/i);
  const gapShare = evaluateOrcamentoShareUiGate({ row: gapRow, groupId: 'g', empresaId: 'e', canShare: true });
  assert.equal(gapShare.mode, 'snapshot_gap');
  assert.equal(gapShare.blockShare, true);
});

test('painel orçamento wire Imprimir/PDF e share fail-closed', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(tab, /resolveOrcamentoPrintPermission/);
  assert.match(tab, /resolveOrcamentoSharePermission/);
  assert.match(tab, /const canPrint = resolveOrcamentoPrintPermission\(hasPermission\)/);
  assert.match(tab, /const canShare = resolveOrcamentoSharePermission\(hasPermission\)/);
  assert.doesNotMatch(tab, /canPrint = .* \|\| canView/);
  assert.doesNotMatch(tab, /canShare = .* \|\| canPrint/);
  assert.match(tab, /evaluateOrcamentoPrintPdfUiGate/);
  assert.match(tab, /evaluateOrcamentoShareUiGate/);
  assert.match(tab, /orcamento-print-pdf/);
  assert.match(tab, /orcamento-share-whatsapp/);
  assert.match(tab, /orcamento-share-email/);
  assert.match(tab, /printPdfGate\.blockPrint/);
  assert.match(tab, /shareGate\.blockShare/);
  assert.doesNotMatch(tab, /api\.whatsapp|twilio/i);
});

test('orcamento detail summary UI fail-closed e snapshot gap', () => {
  const completo = {
    numero: '00000077', status: 'EM_ABERTO', validade_em: '2027-04-01T12:00:00.000Z',
    condicao_pagamento_id: 'cp', condicao_pagamento_codigo_snapshot: 'AV', condicao_pagamento_nome_snapshot: 'À vista',
    condicao_pagamento_parcelas_snapshot: [{ ordem: 1, dias: 0, percentual: '100.000000' }],
    tabela_preco_id: 'tab', tabela_preco_codigo_snapshot: 'VAREJ', tabela_preco_nome_snapshot: 'Varejo',
    promocao_aplicada: false, subtotal: '10', desconto: '0', total: '10',
    itens: [{ id: 'i1', descricao: 'X', unidade_sigla: 'UN', quantidade: '1', preco_unitario: '10', desconto: '0', total: '10' }],
  };
  const ready = resolveOrcamentoDetailSummaryUiState(completo, { clienteNome: 'Cli' });
  assert.equal(ready.mode, 'ready');
  assert.equal(ready.fields.clienteNome, 'Cli');
  assert.equal(resolveOrcamentoDetailSummaryUiState(null).mode, 'missing');
  assert.equal(resolveOrcamentoDetailSummaryUiState({ numero: '1' }).mode, 'invalid');
  const gap = resolveOrcamentoDetailSummaryUiState({ ...completo, tabela_preco_nome_snapshot: '' });
  assert.equal(gap.mode, 'snapshot_gap');
});

test('painel orçamento wire detalhe summary snapshot gap', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(tab, /resolveOrcamentoDetailSummaryUiState/);
  assert.match(tab, /orcamento-detail-summary/);
  assert.match(tab, /orcamento-detail-snapshot-gap/);
  assert.match(tab, /Comercial\.orcamento\.detail-summary/);
});

test('orcamento cancel motivo gate fail-closed (paridade Pedido)', () => {
  assert.equal(evaluateOrcamentoCancelMotivoUiGate('').blockConfirm, true);
  assert.equal(evaluateOrcamentoCancelMotivoUiGate('ab').blockConfirm, true);
  assert.equal(evaluateOrcamentoCancelMotivoUiGate('abc').blockConfirm, false);
  assert.equal(ORCAMENTO_CANCEL_MOTIVO_MAX, 500);
});

test('painel orçamento wire cancel motivo fail-closed', async () => {
  const tab = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(tab, /evaluateOrcamentoCancelMotivoUiGate/);
  assert.match(tab, /orcamento-cancel-dialog/);
  assert.match(tab, /orcamento-cancel-motivo/);
  assert.match(tab, /cancelMotivoUi\.blockConfirm/);
  assert.match(tab, /api\.cancel\(row\.id, gate\.motivo\)/);
  assert.doesNotMatch(tab, /ConfirmDialog/);
});
