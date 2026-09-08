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

test('segunda via e pix do portal sao escopados e idempotentes', async () => {
  const {
    buildPixCopiaColaPortal,
    buildSegundaViaPortal,
    calcularSaldoPortal,
    filtrarTitulosPortal,
  } = await import('../src/components/lib/portalClientePolicy.js');

  const cliente = { id: 'cli-a', nome: 'Cliente A' };
  const titulo = {
    id: 'cr1',
    cliente_id: 'cli-a',
    status: 'Pendente',
    valor: 150.5,
    data_vencimento: '2026-09-01',
  };

  assert.throws(
    () => buildSegundaViaPortal({ titulo: { ...titulo, cliente_id: 'cli-b' }, cliente }),
    /nao pertence/,
  );

  const first = buildSegundaViaPortal({ titulo, cliente });
  assert.equal(first.reuse, false);
  assert.ok(first.record.pix_copia_cola.includes('BR.GOV.BCB.PIX'));
  assert.equal(first.record.visivel_no_portal, true);

  const retry = buildSegundaViaPortal({ titulo: first.record, cliente });
  assert.equal(retry.reuse, true);
  assert.equal(buildPixCopiaColaPortal(titulo, cliente), first.record.pix_copia_cola);

  const saldo = calcularSaldoPortal([
    titulo,
    { id: 'cr2', cliente_id: 'cli-a', status: 'Recebido', valor: 10 },
    { id: 'cr3', cliente_id: 'cli-b', status: 'Pendente', valor: 99 },
  ], 'cli-a');
  assert.equal(saldo.quantidade, 1);
  assert.equal(saldo.aberto, 150.5);
  assert.equal(filtrarTitulosPortal([titulo, { id: 'x', cliente_id: 'cli-b', status: 'Pendente' }], 'cli-a').length, 1);
});

test('nfe alias e write de titulo sao escopados ao cliente do portal', async () => {
  const {
    applyPortalReadScope,
    assertPortalTituloWrite,
    buildPortalDocumentoLinks,
  } = await import('../src/components/lib/portalClientePolicy.js');

  const nfes = applyPortalReadScope({
    entityName: 'NotaFiscal',
    portalClienteId: 'cli-a',
    records: [
      { id: 'n1', cliente_fornecedor_id: 'cli-a' },
      { id: 'n2', destinatario_id: 'cli-b' },
      { id: 'n3', cliente_id: 'cli-a' },
    ],
  });
  assert.deepEqual(nfes.map((item) => item.id).sort(), ['n1', 'n3']);

  assert.throws(
    () => assertPortalTituloWrite({
      before: { id: 'cr1', cliente_id: 'cli-b' },
      patch: { pix_copia_cola: 'x' },
      portalClienteId: 'cli-a',
    }),
    /nao pertence/,
  );

  assert.throws(
    () => assertPortalTituloWrite({
      before: { id: 'cr1', cliente_id: 'cli-a' },
      patch: { cliente_id: 'cli-b' },
      portalClienteId: 'cli-a',
    }),
    /nao pode ser alterado/,
  );

  const links = buildPortalDocumentoLinks({
    nfe: { id: 'n1', cliente_fornecedor_id: 'cli-a', danfe_url: 'https://x/danfe.pdf', xml_url: 'https://x/xml.xml' },
    clienteId: 'cli-a',
  });
  assert.equal(links.danfe, 'https://x/danfe.pdf');
});

test('portal page no longer redirects to dashboard and dashboard stops infinite spinner', async () => {
  const page = await readFile(new URL('../src/pages/PortalCliente.jsx', import.meta.url), 'utf8');
  const dash = await readFile(new URL('../src/components/portal/DashboardCliente.jsx', import.meta.url), 'utf8');
  const boletos = await readFile(new URL('../src/components/portal/BoletosList.jsx', import.meta.url), 'utf8');
  const docs = await readFile(new URL('../src/components/portal/DocumentosCliente.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const config = await readFile(new URL('../src/components/portal/ConfiguracoesPortal.jsx', import.meta.url), 'utf8');
  assert.match(page, /PortalTabsNav/);
  assert.match(page, /DashboardCliente/);
  assert.match(page, /searchParams/);
  assert.match(page, /documentos-novos/);
  assert.doesNotMatch(page, /location\.replace\('\/Dashboard'/);
  assert.match(dash, /data-portal-state/);
  assert.match(dash, /resolvePortalSessionState/);
  assert.match(dash, /BoletosList/);
  assert.match(boletos, /buildSegundaViaPortal/);
  assert.doesNotMatch(boletos, /emitirBoleto/);
  assert.match(docs, /buildSegundaViaPortal/);
  assert.match(docs, /buildPortalDocumentoLinks/);
  assert.match(client, /assertPortalTituloWrite/);
  assert.match(config, /portal_preferencias/);
  assert.match(config, /sem_vinculo/);
});
