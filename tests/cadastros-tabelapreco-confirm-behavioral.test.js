import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadTabelaPreco({ canDelete = true, confirmResult = true, hasContext = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/TabelaPrecoFormCompleto.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { deletes: [], confirms: 0, toasts: [], deleteInContext: [] };
  const buttons = [];
  const module = { exports: {} };
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
            canCreate: () => true,
            canEdit: () => true,
            canDelete: () => canDelete,
            hasPermission: () => true,
            hasFieldPermission: () => true,
            isAdmin: () => true,
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        const ctx = {
          empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
          grupoAtual: hasContext ? { id: 'g1' } : null,
          filterInContext: async () => [],
          createInContext: async () => ({}),
          updateInContext: async () => ({}),
          deleteInContext: async (...args) => { state.deleteInContext.push(args); },
        };
        return { __esModule: true, default: () => ctx, useContextoVisual: () => ctx };
      }
      if (path.includes('useCadastroRecordState')) {
        return {
          __esModule: true,
          default: (initial) => {
            const [value, setValue] = React.useState(initial);
            return [value, setValue];
          },
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return {
          useQuery: () => ({ data: [] }),
          useQueryClient: () => ({ invalidateQueries: () => {} }),
        };
      }
      if (path.includes('base44Client')) {
        return { base44: { auth: { me: async () => ({ id: 'u1' }) } } };
      }
      if (path.includes('iaResponsePolicy')) {
        return { validarPrecificacaoTabelaIA: () => ({ ok: true }) };
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
  });
  return { Form: module.exports.default, state, buttons };
}

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadTabelaPreco({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    tabela: { id: 'tp1', nome: 'Tabela A', ativo: true },
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
  assert.equal(state.deletes.length, 0);
});

test('comportamental: sem contexto grupo/empresa desabilita Excluir', async () => {
  const { Form, state, buttons } = await loadTabelaPreco({ canDelete: true, hasContext: false });
  renderToStaticMarkup(React.createElement(Form, {
    tabela: { id: 'tp1', nome: 'Tabela A', ativo: true },
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'Excluir fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadTabelaPreco({ canDelete: true, confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    tabela: { id: 'tp1', nome: 'Tabela A', ativo: true },
    onSubmit: (payload) => denied.state.deletes.push(payload),
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);
  assert.equal(denied.state.deleteInContext.length, 0);

  const allowed = await loadTabelaPreco({ canDelete: true, confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    tabela: { id: 'tp1', nome: 'Tabela A', ativo: true },
    onSubmit: (payload) => allowed.state.deletes.push(payload),
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0]._action, 'delete');
  assert.equal(allowed.state.deleteInContext.length, 1);
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/TabelaPrecoFormCompleto.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/TabelaPrecoFormCompleto.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
