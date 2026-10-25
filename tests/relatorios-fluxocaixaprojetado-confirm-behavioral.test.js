import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadFluxo({
  canExport = true,
  canView = true,
  confirmResult = true,
  hasContext = true,
} = {}) {
  const source = await readFile(
    new URL('../src/components/relatorios/FluxoCaixaProjetado.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, audits: [], exportHooks: [] };
  const module = { exports: {} };
  const ui = new Proxy({}, {
    get: () => (props) => React.createElement('div', null, props?.children),
  });

  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (path) => {
      if (path === 'react') return require(path);
      if (path.includes('confirm-dialog')) {
        return {
          useConfirm: () => ({
            confirm: async (opts) => {
              state.confirms += 1;
              state.lastConfirm = opts;
              return confirmResult;
            },
            ConfirmDialog: () => null,
          }),
        };
      }
      if (path.includes('usePermissions')) {
        return {
          __esModule: true,
          default: () => ({
            hasPermission: (_m, _e, acao) => {
              if (acao === 'exportar') return canExport;
              if (acao === 'visualizar') return canView;
              return canView || canExport;
            },
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          __esModule: true,
          default: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            estaNoGrupo: false,
            filterInContext: async () => [],
            createInContext: async (entity, payload) => {
              if (entity === 'AuditLog') state.audits.push(payload);
              return payload;
            },
          }),
        };
      }
      if (path.includes('UserContext')) {
        return { useUser: () => ({ user: { id: 'u1', email: 't@t.com' } }) };
      }
      if (path.includes('@tanstack/react-query')) {
        return { useQuery: () => ({ data: [] }) };
      }
      if (path.includes('base44Client')) {
        return { base44: { entities: { AuditLog: { create: async (row) => { state.audits.push(row); } } } } };
      }
      if (path.includes('ExportMenu')) {
        return {
          __esModule: true,
          default: (props) => {
            state.exportHooks.push(props);
            return React.createElement('div', { 'data-action': 'Relatorios.exportar' }, props?.children);
          },
        };
      }
      if (path.includes('date-fns')) {
        return {
          format: () => '2026-01',
          addMonths: (d) => d,
          startOfMonth: (d) => d,
          endOfMonth: (d) => d,
          isBefore: () => false,
          isAfter: () => false,
          isWithinInterval: () => false,
        };
      }
      if (path.includes('recharts')) return new Proxy({}, { get: () => () => null });
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { warn: () => {}, error: () => {}, log: () => {} },
  });
  return { Form: module.exports.default, state };
}

test('comportamental: sem permissão desabilita export e não abre confirm', async () => {
  const { Form, state } = await loadFluxo({ canExport: false });
  renderToStaticMarkup(React.createElement(Form, {}));
  assert.ok(state.exportHooks[0]?.disabled, 'export deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita export', async () => {
  const { Form, state } = await loadFluxo({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, {}));
  assert.ok(state.exportHooks[0]?.disabled, 'export fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: exportação usa confirm-dialog e só segue se confirmado', async () => {
  const denied = await loadFluxo({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {}));
  const okDenied = await denied.state.exportHooks[0].onBeforeExport({ formato: 'csv', quantidade: 6 });
  assert.equal(okDenied, false);
  assert.equal(denied.state.confirms, 1);
  assert.ok(denied.state.audits.some((a) => a.acao === 'Cancelamento'));

  const allowed = await loadFluxo({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {}));
  const ok = await allowed.state.exportHooks[0].onBeforeExport({ formato: 'csv', quantidade: 6 });
  assert.equal(ok, true);
  assert.equal(allowed.state.confirms, 1);
  assert.doesNotMatch(
    await readFile(new URL('../src/components/relatorios/FluxoCaixaProjetado.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/relatorios/FluxoCaixaProjetado.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
