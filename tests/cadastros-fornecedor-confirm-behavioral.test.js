import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadFornecedor({ canDelete = true, confirmResult = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/CadastroFornecedorCompleto.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { deletes: [], confirms: 0, toasts: [] };
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
      if (path.includes('@tanstack/react-query')) {
        return {
          useQueryClient: () => ({ invalidateQueries: () => {} }),
          useMutation: (opts) => ({
            isPending: false,
            mutate: (id) => {
              try {
                opts.mutationFn?.(id);
                state.deletes.push(id);
                opts.onSuccess?.();
              } catch (e) {
                state.toasts.push(String(e?.message || e));
              }
            },
          }),
        };
      }
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
      if (path.includes('use-toast') || path.includes('useToast')) {
        return { useToast: () => ({ toast: (o) => state.toasts.push(o) }) };
      }
      if (path.includes('usePermissions')) {
        return {
          __esModule: true,
          default: () => ({
            canCreate: () => true,
            canEdit: () => true,
            canDelete: () => canDelete,
            isAdmin: () => false,
            hasFieldPermission: () => true,
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        const ctx = {
          empresaAtual: { id: 'e1', group_id: 'g1' },
          grupoAtual: { id: 'g1' },
          createInContext: async () => ({}),
          updateInContext: async () => ({}),
          deleteInContext: async (_e, id) => ({ id }),
          filterInContext: async () => [],
        };
        return { __esModule: true, default: () => ctx, useContextoVisual: () => ctx };
      }
      if (path.includes('useCadastroFormScopeGuard')) {
        return { __esModule: true, default: () => ({ isCurrent: () => true, assertCurrent: () => {} }) };
      }
      if (path.includes('localCadastroMasterPolicy') || path.includes('normalizeFornecedor')) {
        return { normalizeFornecedorCadastro: (v) => v };
      }
      if (path.includes('FornecedorFormSections') || path.includes('CadastroCodigoRegistroField')) {
        return {
          __esModule: true,
          default: () => null,
          FornecedorContatoEnderecoSection: () => null,
          FornecedorDadosGeraisSection: () => null,
          FornecedorFiscalFinanceiroSection: () => null,
        };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
  });
  return { Form: module.exports.default, state, buttons };
}

const fornecedor = {
  id: 'f1',
  nome: 'Fornecedor Alpha',
  status: 'Ativo',
  endereco: '',
  cidade: '',
  estado: '',
};

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadFornecedor({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    windowMode: true,
    fornecedor,
    isOpen: true,
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
  assert.equal(state.deletes.length, 0);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadFornecedor({ canDelete: true, confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    windowMode: true,
    fornecedor,
    isOpen: true,
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.equal(excluirDenied?.disabled, false);
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);

  const allowed = await loadFornecedor({ canDelete: true, confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    windowMode: true,
    fornecedor,
    isOpen: true,
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0], 'f1');
  const source = await readFile(new URL('../src/components/cadastros/CadastroFornecedorCompleto.jsx', import.meta.url), 'utf8');
  assert.match(source, /useConfirm/);
  assert.doesNotMatch(source, /window\.confirm/);
});
