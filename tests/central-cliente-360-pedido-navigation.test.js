import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { isCanonicalPedidoId, openCentralPedidoWindow } from '../src/components/comercial/centralCliente360Navigation.js';

const id = '11111111-1111-4111-8111-111111111111';
const row = { id, numero: '00000042' };
const block = { status: 'ok', data: [row] };
const props = { groupId: 'g', empresaId: 'e', actorId: 'u' };

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

test('Central e Pedido consomem a mesma seleção inicial sem cadastrar fonte paralela', async () => {
  const central = await readFile(new URL('../src/components/comercial/CentralCliente360Panel.jsx', import.meta.url), 'utf8');
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  assert.match(central, /openCentralPedidoWindow/);
  assert.match(central, /data-action="central360-pedido-abrir"/);
  assert.match(pedido, /initialSelectedId/);
  assert.match(pedido, /void show\(\{id:initialSelectedId\}\)/);
});
