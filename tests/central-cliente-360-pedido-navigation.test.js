import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { centralOpenErrorMessage, createCentralOpenGate, isCanonicalPedidoId, openCentralOrcamentoWindow, openCentralPedidoWindow } from '../src/components/comercial/centralCliente360Navigation.js';
import { sameOrcamentoScope } from '../src/components/comercial/orcamentoUiPolicy.js';

const id = '11111111-1111-4111-8111-111111111111';
const row = { id, numero: '00000042' };
const block = { status: 'ok', data: [row] };
const props = { groupId: 'g', empresaId: 'e', actorId: 'u', sessionToken: 'synthetic-token' };

test('Central abre Pedido existente uma vez por tenant/ator/ID técnico no painel canônico', async () => {
  const calls = [];
  const Panel = () => null;
  const result = await openCentralPedidoWindow({ row, block, allowed: true,
    assertCurrent: () => calls.push('scope'),
    loadPanel: async () => { calls.push('load'); return Panel; },
    openWindow: (component, windowProps, options) => calls.push({ component, windowProps, options }), props });
  assert.equal(result, true);
  assert.deepEqual(calls.slice(0, 3), ['scope', 'load', 'scope']);
  assert.equal(calls[3].component, Panel);
  assert.equal(calls[3].windowProps.initialSelectedId, id);
  assert.equal(calls[3].windowProps.canonicalHttp, true);
  assert.equal(calls[3].windowProps.sessionToken, 'synthetic-token');
  assert.match(calls[3].options.uniqueKey, /comercial-pedido-/);
  assert.equal(calls[3].options.title, 'Pedido 00000042');
});

test('Central bloqueia registro fora do bloco, ID adulterado e RBAC sem carregar painel', async () => {
  let loads = 0;
  for (const input of [
    { row, block, allowed: false },
    { row, block: { status: 'forbidden', data: [row] }, allowed: true },
    { row: { id: 'not-an-id' }, block, allowed: true },
    { row: { id: '22222222-2222-4222-8222-222222222222' }, block, allowed: true },
  ]) {
    assert.equal(await openCentralPedidoWindow({ ...input, props, assertCurrent: () => {},
      loadPanel: async () => { loads++; return () => null; }, openWindow: () => { throw Error('opened'); } }), false);
  }
  assert.equal(loads, 0);
  assert.equal(isCanonicalPedidoId(id), true);
  assert.equal(isCanonicalPedidoId('00000042'), false);
});

test('Central descarta import tardio após troca de sessão antes de abrir janela', async () => {
  let current = true;
  const calls = [];
  await assert.rejects(openCentralPedidoWindow({ row, block, allowed: true, props,
    assertCurrent: () => { if (!current) throw Error('context changed'); },
    loadPanel: async () => { current = false; return () => null; },
    openWindow: () => calls.push('opened') }), /context changed/);
  assert.deepEqual(calls, []);
});

test('Central abre Orçamento pelo mesmo contrato canônico, sem confundir número e ID', async () => {
  const calls = [];
  assert.equal(await openCentralOrcamentoWindow({ row, block, allowed: true, props,
    assertCurrent: () => {}, loadPanel: async () => () => null,
    openWindow: (_component, windowProps, options) => calls.push({ windowProps, options }) }), true);
  assert.equal(calls[0].windowProps.initialSelectedId, id);
  assert.equal(calls[0].options.title, 'Orçamento 00000042');
  assert.match(calls[0].options.uniqueKey, /comercial-orcamento-/);
  assert.equal(sameOrcamentoScope({ ...props, token: 'old' }, props, { ...props, token: 'new' }), false);
  assert.equal(sameOrcamentoScope({ ...props, token: 'old' }, props, { ...props, token: 'old' }), true);
});

test('Central sinaliza nova abertura ao reutilizar a mesma janela sem criar chave duplicada', async () => {
  const calls = [];
  const input = { row, block, allowed: true, props, assertCurrent: () => {}, loadPanel: async () => () => null,
    openWindow: (_component, windowProps, options) => calls.push({ windowProps, options }) };
  await openCentralPedidoWindow(input);
  await openCentralPedidoWindow(input);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.uniqueKey, calls[1].options.uniqueKey);
  assert.equal(calls[0].options.refreshPropsOnReuse, true);
  assert.notEqual(calls[0].windowProps.reopenRequestId, calls[1].windowProps.reopenRequestId);
});

test('Central bloqueia import concorrente por tipo, libera retry e invalida ticket de contexto antigo', () => {
  const gate = createCentralOpenGate();
  const first = gate.begin('pedido', 'group-a/company-a/token-1');
  assert.ok(first);
  assert.equal(gate.begin('pedido', 'group-a/company-a/token-1'), null);
  const quote = gate.begin('orcamento', 'group-a/company-a/token-1');
  assert.ok(quote, 'outro tipo continua independente');
  const changedScope = gate.begin('pedido', 'group-a/company-b/token-2');
  assert.ok(changedScope, 'novo contexto não espera import antigo');
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(changedScope), true);
  assert.equal(gate.end(first), false, 'import antigo não libera ticket novo');
  assert.equal(gate.end(changedScope), true);
  assert.ok(gate.begin('pedido', 'group-a/company-a/token-1'), 'falha libera retry');
  gate.reset();
  assert.equal(gate.end(quote), false, 'callback antigo não libera estado do novo contexto');
  assert.equal(gate.isCurrent(quote), false);
  assert.ok(gate.begin('pedido', 'group-a/company-b/token-2'));
});

test('Central bloqueia import antigo quando sessão A→B→A retorna aos mesmos valores', async () => {
  const gate = createCentralOpenGate();
  const ticket = gate.begin('pedido', 'A');
  let scope = 'A';
  const opened = [];
  await assert.rejects(openCentralPedidoWindow({ row, block, allowed: true, props,
    assertCurrent: () => { if (scope !== 'A' || !gate.isCurrent(ticket)) throw Error('stale ticket'); },
    loadPanel: async () => { scope = 'B'; gate.reset(); scope = 'A'; gate.begin('pedido', 'A'); return () => null; },
    openWindow: () => opened.push('opened') }), /stale ticket/);
  assert.deepEqual(opened, []);
});

test('falha tardia do ticket A não pinta erro nem libera a nova tentativa A', async () => {
  const gate = createCentralOpenGate();
  const oldTicket = gate.begin('pedido', 'A');
  let error = '';
  let releaseOld;
  const oldImport = new Promise((_resolve, reject) => { releaseOld = reject; });
  const oldAttempt = oldImport.catch(() => {
    if (gate.isCurrent(oldTicket)) error = centralOpenErrorMessage();
  }).finally(() => { gate.end(oldTicket); });
  gate.reset();
  const currentTicket = gate.begin('pedido', 'A');
  releaseOld(new Error('falha privada no import antigo'));
  await oldAttempt;
  assert.equal(error, '');
  assert.equal(gate.isCurrent(currentTicket), true);
  assert.equal(gate.begin('pedido', 'A'), null, 'ticket novo permanece protegido contra clique duplo');
});

test('Central não expõe erro bruto de import nem abre registro fora do bloco', async () => {
  const privateError = new Error('private://internal/module-path?token=secret');
  assert.equal(centralOpenErrorMessage(privateError).includes('secret'), false);
  let imported = false;
  const opened = await openCentralPedidoWindow({ row: { id: 'not-uuid' }, block, allowed: true, props,
    assertCurrent: () => {}, loadPanel: async () => { imported = true; return () => null; }, openWindow: () => {} });
  assert.equal(opened, false);
  assert.equal(imported, false);
});

test('Central e Pedido consomem a mesma seleção inicial sem cadastrar fonte paralela', async () => {
  const central = await readFile(new URL('../src/components/comercial/CentralCliente360Panel.jsx', import.meta.url), 'utf8');
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const orcamento = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(central, /openCentralPedidoWindow/);
  assert.match(central, /data-action="central360-pedido-abrir"/);
  assert.match(pedido, /initialSelectedId/);
  assert.match(pedido, /void show\(\{id:initialSelectedId\}\)/);
  assert.match(central, /data-action="central360-orcamento-abrir"/);
  assert.match(orcamento, /void showDetail\(\{ id: initialSelectedId \}\)/);
  assert.match(central, /if\(!opened&&openGate\.current\.isCurrent\(ticket\)&&viewRef\.current===openedKey\)setError\(centralOpenErrorMessage\(\)\)/);
  assert.match(central, /catch\{if\(openGate\.current\.isCurrent\(ticket\)&&viewRef\.current===openedKey\)setError\(centralOpenErrorMessage\(\)\);\}/);
  assert.match(central, /disabled=\{Boolean\(openingRecord\.pedido\)\}/);
});
