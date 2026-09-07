import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyPortalReadScope,
  assertPortalClienteScope,
  resolvePortalSessionState,
  sanitizePortalClienteId,
} from '../src/components/lib/portalClientePolicy.js';

test('url cliente_id is ignored outside admin preview', () => {
  assert.equal(sanitizePortalClienteId({ requestedClienteId: 'cli-b', adminMode: false }), null);
  assert.equal(sanitizePortalClienteId({ requestedClienteId: 'cli-b', adminMode: true }), 'cli-b');
});

test('portal user cannot open another customer', () => {
  assert.throws(
    () => assertPortalClienteScope({
      user: { id: 'u1' },
      cliente: { id: 'cli-a', portal_usuario_id: 'u1' },
      requestedClienteId: 'cli-b',
      adminMode: false,
    }),
    /outro cliente/,
  );
});

test('empty vinculo is an explicit state instead of infinite loading', () => {
  const session = resolvePortalSessionState({
    user: { id: 'u1' },
    vinculoFetched: true,
    vinculoCliente: null,
  });
  assert.equal(session.state, 'sem_vinculo');
});

test('timeout is explicit after the portal wait window', () => {
  const session = resolvePortalSessionState({
    user: { id: 'u1' },
    vinculoLoading: true,
    elapsedMs: 13000,
  });
  assert.equal(session.state, 'timeout');
});

test('pedido of another customer is stripped from portal reads', () => {
  const records = applyPortalReadScope({
    entityName: 'Pedido',
    portalClienteId: 'cli-a',
    records: [{ id: 'p1', cliente_id: 'cli-a' }, { id: 'p2', cliente_id: 'cli-b' }],
  });
  assert.deepEqual(records.map((item) => item.id), ['p1']);
});

test('portal page no longer redirects to dashboard and dashboard stops infinite spinner', async () => {
  const page = await readFile(new URL('../src/pages/PortalCliente.jsx', import.meta.url), 'utf8');
  const dash = await readFile(new URL('../src/components/portal/DashboardCliente.jsx', import.meta.url), 'utf8');
  assert.match(page, /DashboardCliente/);
  assert.doesNotMatch(page, /location\.replace\('\/Dashboard'/);
  assert.match(dash, /data-portal-state/);
  assert.match(dash, /resolvePortalSessionState/);
});
