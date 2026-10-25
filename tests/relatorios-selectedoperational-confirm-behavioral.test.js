import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadReport({
  canExport = true,
  confirmResult = true,
  hasContext = true,
} = {}) {
  const source = await readFile(
    new URL('../src/components/relatorios/SelectedOperationalReport.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, audits: [], exports: [], buttons: [] };
  const module = { exports: {} };
  const ui = new Proxy({}, {
    get: (_t, key) => (props) => {
      const p = props || {};
      if (key === 'Button') state.buttons.push(p);
      return React.createElement('div', null, p.children);
    },
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
              return canExport;
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
          }),
        };
      }
      if (path.includes('UserContext')) {
        return { useUser: () => ({ user: { id: 'u1', email: 't@t.com' } }) };
      }
      if (path.includes('base44Client')) {
        return {
          base44: {
            entities: {
              AuditLog: {
                create: async (row) => { state.audits.push(row); },
              },
            },
          },
        };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { warn: () => {}, error: () => {}, log: () => {} },
  });
  return { Form: module.exports.default, state };
}

function reportProps(onExport) {
  return {
    selectedReport: {
      titulo: 'Operacional teste',
      descricao: 'desc',
      getData: () => [{ id: 1 }, { id: 2 }],
    },
    filtros: { data_inicio: '2026-01-01', data_fim: '2026-01-31' },
    onExport: onExport || ((dados, titulo) => {}),
    onClose: () => {},
  };
}

test('comportamental: sem permissão desabilita export e não abre confirm', async () => {
  const { Form, state } = await loadReport({ canExport: false });
  const exports = [];
  renderToStaticMarkup(React.createElement(Form, reportProps((d, t) => exports.push({ d, t }))));
  const btn = state.buttons.find((b) => String(b['data-action'] || '') === 'Relatorios.exportar_csv');
  assert.ok(btn?.disabled, 'export deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita export', async () => {
  const { Form, state } = await loadReport({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, reportProps()));
  const btn = state.buttons.find((b) => String(b['data-action'] || '') === 'Relatorios.exportar_csv');
  assert.ok(btn?.disabled, 'export fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: exportação usa confirm-dialog e só exporta se confirmado', async () => {
  const denied = await loadReport({ confirmResult: false });
  const exportsDenied = [];
  renderToStaticMarkup(React.createElement(denied.Form, reportProps((d, t) => exportsDenied.push({ d, t }))));
  const btnDenied = denied.state.buttons.find((b) => String(b['data-action'] || '') === 'Relatorios.exportar_csv');
  await btnDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(exportsDenied.length, 0);
  assert.ok(denied.state.audits.some((a) => a.sucesso === false));

  const allowed = await loadReport({ confirmResult: true });
  const exportsOk = [];
  renderToStaticMarkup(React.createElement(allowed.Form, reportProps((d, t) => exportsOk.push({ d, t }))));
  const btn = allowed.state.buttons.find((b) => String(b['data-action'] || '') === 'Relatorios.exportar_csv');
  await btn.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(exportsOk.length, 1);
  assert.equal(exportsOk[0].d.length, 2);
  assert.ok(allowed.state.audits.some((a) => a.sucesso === true && a.acao === 'Exportacao'));
  assert.doesNotMatch(
    await readFile(new URL('../src/components/relatorios/SelectedOperationalReport.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/relatorios/SelectedOperationalReport.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
