import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadMulti({
  canEdit = true,
  confirmResult = true,
  hasContext = true,
  preselect = false,
} = {}) {
  const source = await readFile(new URL('../src/components/cadastros/MultiTabelasEditor.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, audits: [], toasts: [], updates: [], filters: [] };
  const buttons = [];
  const module = { exports: {} };
  let useStateCall = 0;
  const reactMock = {
    ...require('react'),
    useState(initial) {
      useStateCall += 1;
      // First useState in component is tabelasSelecionadas
      if (useStateCall === 1 && preselect) {
        return require('react').useState(['t1']);
      }
      return require('react').useState(initial);
    },
  };
  const ui = new Proxy({}, {
    get: (_t, key) => (props) => {
      const p = props || {};
      if (key === 'Button') buttons.push(p);
      return React.createElement('div', null, p.children);
    },
  });
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (path) => {
      if (path === 'react') return reactMock;
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
            canEdit: () => canEdit,
            hasPermission: () => canEdit,
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            contexto: hasContext ? 'empresa' : null,
            filterInContext: async (entity) => {
              state.filters.push(entity);
              return [];
            },
            updateInContext: async (...args) => {
              state.updates.push(args);
              return {};
            },
          }),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return { useQueryClient: () => ({ invalidateQueries: () => {} }) };
      }
      if (path.includes('base44Client')) {
        return {
          base44: {
            auth: { me: async () => ({ email: 't@t.com' }) },
            entities: {
              AuditLog: {
                create: async (row) => { state.audits.push(row); },
              },
            },
          },
        };
      }
      if (path === 'sonner') {
        return {
          toast: {
            error: (msg) => state.toasts.push(msg),
            success: () => {},
            info: () => {},
          },
        };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { warn: () => {}, error: () => {}, log: () => {} },
  });
  return { Form: module.exports.default, state, buttons };
}

const tabelas = [{ id: 't1', nome: 'Tabela A', tipo: 'Padrão' }];

test('comportamental: sem permissão desabilita aplicar e não abre confirm', async () => {
  const { Form, state, buttons } = await loadMulti({ canEdit: false });
  renderToStaticMarkup(React.createElement(Form, { isOpen: true, onClose: () => {}, tabelas }));
  const aplicar = buttons.find((b) => String(b['data-action'] || '') === 'MultiTabelasEditor.aplicarRegra');
  assert.ok(aplicar?.disabled, 'aplicar deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita aplicar', async () => {
  const { Form, state, buttons } = await loadMulti({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, { isOpen: true, onClose: () => {}, tabelas }));
  const aplicar = buttons.find((b) => String(b['data-action'] || '') === 'MultiTabelasEditor.aplicarRegra');
  assert.ok(aplicar?.disabled, 'aplicar fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: recálculo usa confirm-dialog e só segue se confirmado', async () => {
  const denied = await loadMulti({ confirmResult: false, preselect: true });
  renderToStaticMarkup(React.createElement(denied.Form, { isOpen: true, onClose: () => {}, tabelas }));
  const aplicarDenied = denied.buttons.find((b) => String(b['data-action'] || '') === 'MultiTabelasEditor.aplicarRegra');
  assert.equal(aplicarDenied?.disabled, false);
  await aplicarDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.filters.length, 0);
  assert.ok(denied.state.audits.some((a) => a.acao === 'TabelaPrecoItem.recalculo_multi_cancelado'));

  const allowed = await loadMulti({ confirmResult: true, preselect: true });
  renderToStaticMarkup(React.createElement(allowed.Form, { isOpen: true, onClose: () => {}, tabelas }));
  const aplicar = allowed.buttons.find((b) => String(b['data-action'] || '') === 'MultiTabelasEditor.aplicarRegra');
  await aplicar.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.ok(allowed.state.filters.includes('Produto'), 'após confirm busca produtos para recálculo');
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/MultiTabelasEditor.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/MultiTabelasEditor.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
