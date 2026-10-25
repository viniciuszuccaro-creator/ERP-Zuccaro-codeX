import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

const produtos = [
  {
    id: 'p1',
    descricao: 'Bitola 8',
    estoque_atual: 10,
    custo_aquisicao: 5,
    group_id: 'g1',
    empresa_id: 'e1',
  },
];

async function loadRelatorio({
  canExport = true,
  canView = true,
  confirmResult = true,
  hasContext = true,
} = {}) {
  const source = await readFile(
    new URL('../src/components/estoque/RelatoriosEstoque.jsx', import.meta.url),
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
            hasPermission: (_mod, _ent, acao) => {
              if (acao === 'exportar') return canExport;
              if (acao === 'visualizar') return canView;
              return canView || canExport;
            },
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            contexto: hasContext ? 'empresa' : null,
            createInContext: async (entity, payload) => {
              if (entity === 'AuditLog') state.audits.push(payload);
              return payload;
            },
          }),
        };
      }
      if (path.includes('ExportButton')) {
        return {
          __esModule: true,
          default: (props) => {
            state.exportHooks.push(props);
            return React.createElement('div', null, props?.children);
          },
        };
      }
      if (path.includes('ProtectedField')) {
        return { __esModule: true, default: (props) => React.createElement('div', null, props?.children) };
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
  const { Form, state } = await loadRelatorio({ canExport: false });
  renderToStaticMarkup(React.createElement(Form, { produtos, movimentacoes: [] }));
  const exportBtn = state.exportHooks.find((p) => String(p['data-action'] || '') === 'RelatoriosEstoque.exportar_abc');
  assert.ok(exportBtn?.disabled, 'export deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita export', async () => {
  const { Form, state } = await loadRelatorio({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, { produtos, movimentacoes: [] }));
  const exportBtn = state.exportHooks.find((p) => String(p['data-action'] || '') === 'RelatoriosEstoque.exportar_abc');
  assert.ok(exportBtn?.disabled, 'export fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: exportação usa confirm-dialog e só audita sucesso se confirmado', async () => {
  const denied = await loadRelatorio({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, { produtos, movimentacoes: [] }));
  const btnDenied = denied.state.exportHooks.find((p) => String(p['data-action'] || '') === 'RelatoriosEstoque.exportar_abc');
  const allowedDenied = await btnDenied.onBeforeExport('csv');
  assert.equal(allowedDenied, false);
  assert.equal(denied.state.confirms, 1);
  assert.ok(denied.state.audits.some((a) => a.acao === 'RelatoriosEstoque.exportar_cancelado'));

  const allowed = await loadRelatorio({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, { produtos, movimentacoes: [] }));
  const btn = allowed.state.exportHooks.find((p) => String(p['data-action'] || '') === 'RelatoriosEstoque.exportar_abc');
  const ok = await btn.onBeforeExport('csv');
  assert.equal(ok, true);
  assert.equal(allowed.state.confirms, 1);
  assert.ok(allowed.state.audits.some((a) => a.acao === 'RelatoriosEstoque.exportar'));
  assert.doesNotMatch(
    await readFile(new URL('../src/components/estoque/RelatoriosEstoque.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/estoque/RelatoriosEstoque.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
