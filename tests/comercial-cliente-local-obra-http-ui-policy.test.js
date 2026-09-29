import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertClienteLocalNoContexto,
  assertObraNoContexto,
  buildClienteLocalAddressSummary,
  buildClienteLocalDisplayLabel,
  buildObraAddressSummary,
  buildObraDisplayLabel,
  canLoadClienteLocaisHttp,
  canLoadObrasHttp,
  normalizeClienteLocaisListPayload,
  normalizeObrasListPayload,
  resolveClienteIdFromEmpresaLink,
  resolveDeliveryAddressUiState,
} from '../src/components/comercial/comercialClienteLocalObraHttpUiPolicy.js';

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLIENTE = '22222222-2222-4222-8222-222222222222';
const LOCAL = '33333333-3333-4333-8333-333333333333';
const OBRA = '44444444-4444-4444-8444-444444444444';

test('canLoadClienteLocaisHttp fail-closed sem hasPermission', () => {
  assert.equal(canLoadClienteLocaisHttp(undefined), false);
  assert.equal(canLoadClienteLocaisHttp(() => false), false);
});

test('canLoadClienteLocaisHttp libera Cadastros ou Pedido visualizar', () => {
  assert.equal(
    canLoadClienteLocaisHttp((module, section, action) => (
      module === 'Cadastros' && section === 'cliente_local' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadClienteLocaisHttp((module, section, action) => (
      module === 'Comercial' && section === 'pedido' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadClienteLocaisHttp((module, section, action) => (
      module === 'Comercial' && section === 'orcamento' && action === 'visualizar'
    )),
    false,
  );
});

test('canLoadObrasHttp fail-closed e libera Cadastros.obra ou Pedido', () => {
  assert.equal(canLoadObrasHttp(undefined), false);
  assert.equal(
    canLoadObrasHttp((module, section, action) => (
      module === 'Cadastros' && section === 'obra' && action === 'visualizar'
    )),
    true,
  );
  assert.equal(
    canLoadObrasHttp((module, section, action) => (
      module === 'Comercial' && section === 'pedido' && action === 'visualizar'
    )),
    true,
  );
});

test('normalize payloads filtram inativos', () => {
  assert.deepEqual(
    normalizeClienteLocaisListPayload({
      data: [
        { id: 'a', ativo: true },
        { id: 'b', ativo: false },
      ],
    }).map((row) => row.id),
    ['a'],
  );
  assert.deepEqual(
    normalizeObrasListPayload([{ id: 'o', ativo: true }, { id: 'x', ativo: false }]).map((r) => r.id),
    ['o'],
  );
  assert.deepEqual(normalizeClienteLocaisListPayload(null), []);
});

test('resolveClienteIdFromEmpresaLink valida UUID', () => {
  assert.equal(resolveClienteIdFromEmpresaLink({ cliente_id: CLIENTE }), CLIENTE);
  assert.equal(resolveClienteIdFromEmpresaLink({ cliente_id: 'x' }), '');
  assert.equal(resolveClienteIdFromEmpresaLink(null), '');
});

test('assertClienteLocalNoContexto e assertObraNoContexto falham cross-tenant', () => {
  assert.throws(
    () => assertClienteLocalNoContexto({ id: LOCAL, group_id: GROUP }, {}),
    /grupo/,
  );
  assert.throws(
    () => assertClienteLocalNoContexto(
      { id: LOCAL, group_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', cliente_id: CLIENTE },
      { groupId: GROUP, clienteId: CLIENTE },
    ),
    /grupo ativo/,
  );
  assert.throws(
    () => assertObraNoContexto(
      { id: OBRA, group_id: GROUP, cliente_id: '55555555-5555-4555-8555-555555555555' },
      { groupId: GROUP, clienteId: CLIENTE },
    ),
    /cliente selecionado/,
  );
  assert.equal(
    assertClienteLocalNoContexto(
      { id: LOCAL, group_id: GROUP, cliente_id: CLIENTE },
      { groupId: GROUP, clienteId: CLIENTE },
    ).id,
    LOCAL,
  );
  assert.equal(
    assertObraNoContexto(
      { id: OBRA, group_id: GROUP, cliente_id: CLIENTE },
      { groupId: GROUP, clienteId: CLIENTE },
    ).id,
    OBRA,
  );
});

test('display labels preferem nome/código', () => {
  assert.equal(buildClienteLocalDisplayLabel({ nome: 'Depósito' }), 'Depósito');
  assert.equal(buildObraDisplayLabel({ codigo: '000001', nome: 'Torre' }), '000001 — Torre');
});

test('buildClienteLocalAddressSummary monta linhas sem inventar campos', () => {
  const summary = buildClienteLocalAddressSummary({
    id: LOCAL,
    nome: 'Obra Norte',
    logradouro: 'Rua A',
    numero: '100',
    complemento: 'Galpão',
    bairro: 'Centro',
    cidade: 'Campinas',
    uf: 'SP',
    cep: '13000-000',
    endereco_incompleto: false,
  });
  assert.equal(summary.kind, 'local');
  assert.equal(summary.incomplete, false);
  assert.equal(summary.lines[0], 'Rua A, 100 — Galpão');
  assert.match(summary.lines.join(' '), /Campinas\/SP/);
  assert.match(summary.lines.join(' '), /CEP 13000-000/);
  assert.equal(buildClienteLocalAddressSummary(null), null);
});

test('buildClienteLocalAddressSummary marca incompleto sem logradouro/cidade', () => {
  const summary = buildClienteLocalAddressSummary({
    id: LOCAL,
    nome: 'X',
    logradouro: '',
    cidade: '',
    uf: 'SP',
  });
  assert.equal(summary.incomplete, true);
});

test('buildObraAddressSummary prefere local enriquecido; senão local_principal', () => {
  const enriched = buildObraAddressSummary(
    { id: OBRA, codigo: '000001', nome: 'Torre', local_principal: { id: LOCAL, nome: 'LP', cidade: 'X', uf: 'SP' } },
    {
      id: LOCAL,
      nome: 'Principal',
      logradouro: 'Av B',
      numero: '10',
      bairro: 'Jardim',
      cidade: 'Campinas',
      uf: 'SP',
      cep: '13010-000',
    },
  );
  assert.equal(enriched.kind, 'obra');
  assert.equal(enriched.source, 'obra+local');
  assert.match(enriched.line, /Av B, 10/);
  assert.equal(enriched.incomplete, false);

  const partial = buildObraAddressSummary({
    id: OBRA,
    codigo: '000002',
    nome: 'Lote',
    local_principal: { id: LOCAL, nome: 'Canteiro', cidade: 'Valinhos', uf: 'SP' },
  });
  assert.equal(partial.source, 'obra_local_principal');
  assert.equal(partial.incomplete, false);
  assert.match(partial.line, /Valinhos\/SP/);

  const bare = buildObraAddressSummary({ id: OBRA, codigo: '000003', nome: 'Sem local' });
  assert.equal(bare.source, 'obra_sem_local');
  assert.equal(bare.incomplete, true);
});

test('resolveDeliveryAddressUiState fail-closed em erro HTTP get e loading', () => {
  const none = resolveDeliveryAddressUiState({ tipoOperacao: 'ENTREGA' });
  assert.equal(none.mode, 'none');
  assert.equal(none.blockSave, true);
  assert.match(none.hint, /Entrega exige Local/);

  const retiradaNone = resolveDeliveryAddressUiState({ tipoOperacao: 'RETIRADA' });
  assert.equal(retiradaNone.mode, 'none');
  assert.equal(retiradaNone.blockSave, false);
  assert.equal(retiradaNone.hint, null);

  const loading = resolveDeliveryAddressUiState({
    clienteLocalId: LOCAL,
    isLoading: true,
  });
  assert.equal(loading.mode, 'loading');
  assert.equal(loading.blockSave, true);

  const erro = resolveDeliveryAddressUiState({
    clienteLocalId: LOCAL,
    localError: { status: 500 },
  });
  assert.equal(erro.mode, 'error');
  assert.equal(erro.blockSave, true);
  assert.match(erro.hint, /fail-closed/);

  const missing = resolveDeliveryAddressUiState({
    clienteLocalId: LOCAL,
    localRow: null,
  });
  assert.equal(missing.mode, 'error');
  assert.equal(missing.blockSave, true);

  const ready = resolveDeliveryAddressUiState({
    tipoOperacao: 'ENTREGA',
    clienteLocalId: LOCAL,
    localRow: {
      id: LOCAL,
      group_id: GROUP,
      cliente_id: CLIENTE,
      nome: 'Depósito',
      logradouro: 'Rua C',
      numero: '1',
      bairro: 'Centro',
      cidade: 'Campinas',
      uf: 'SP',
      cep: '13000-111',
    },
    scope: { groupId: GROUP, clienteId: CLIENTE },
  });
  assert.equal(ready.mode, 'ready');
  assert.equal(ready.blockSave, false);
  assert.equal(ready.summaries[0].kind, 'local');

  const cross = resolveDeliveryAddressUiState({
    clienteLocalId: LOCAL,
    localRow: {
      id: LOCAL,
      group_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      cliente_id: CLIENTE,
      logradouro: 'Rua',
      cidade: 'X',
      uf: 'SP',
    },
    scope: { groupId: GROUP, clienteId: CLIENTE },
  });
  assert.equal(cross.mode, 'error');
  assert.equal(cross.blockSave, true);
});

test('resolveDeliveryAddressUiState ENTREGA bloqueia endereço incompleto; RETIRADA não', () => {
  const incompleteLocal = {
    id: LOCAL,
    group_id: GROUP,
    cliente_id: CLIENTE,
    nome: 'Sem cidade',
    logradouro: 'Rua X',
  };
  const entregaIncomplete = resolveDeliveryAddressUiState({
    tipoOperacao: 'ENTREGA',
    clienteLocalId: LOCAL,
    localRow: incompleteLocal,
    scope: { groupId: GROUP, clienteId: CLIENTE },
  });
  assert.equal(entregaIncomplete.mode, 'incomplete');
  assert.equal(entregaIncomplete.blockSave, true);
  assert.match(entregaIncomplete.hint, /fail-closed/);

  const retiradaIncomplete = resolveDeliveryAddressUiState({
    tipoOperacao: 'RETIRADA',
    clienteLocalId: LOCAL,
    localRow: incompleteLocal,
    scope: { groupId: GROUP, clienteId: CLIENTE },
  });
  assert.equal(retiradaIncomplete.mode, 'incomplete');
  assert.equal(retiradaIncomplete.blockSave, false);
});

test('resolveDeliveryAddressUiState obra usa getLocal do principal', () => {
  const state = resolveDeliveryAddressUiState({
    obraId: OBRA,
    obraRow: {
      id: OBRA,
      group_id: GROUP,
      cliente_id: CLIENTE,
      codigo: '000001',
      nome: 'Torre',
      local_principal: { id: LOCAL, nome: 'Canteiro', cidade: 'Campinas', uf: 'SP' },
    },
    obraPrincipalLocal: {
      id: LOCAL,
      group_id: GROUP,
      cliente_id: CLIENTE,
      nome: 'Canteiro',
      logradouro: 'Rua Obra',
      numero: '50',
      cidade: 'Campinas',
      uf: 'SP',
      cep: '13020-000',
    },
    scope: { groupId: GROUP, clienteId: CLIENTE },
  });
  assert.equal(state.mode, 'ready');
  assert.equal(state.summaries[0].source, 'obra+local');
  assert.match(state.summaries[0].line, /Rua Obra, 50/);
});
