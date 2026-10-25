import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadProduto({ canDelete = true, confirmResult = true, hasContext = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8');
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
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            carimbarContexto: (v) => v,
            filterInContext: async () => [],
            createInContext: async () => ({}),
            updateInContext: async () => ({}),
            deleteInContext: async (...args) => { state.deleteInContext.push(args); },
          }),
        };
      }
      if (path.includes('useCadastroFormScopeGuard')) {
        return {
          __esModule: true,
          default: () => ({
            isCurrent: () => true,
            assertCurrent: () => {},
          }),
        };
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
      if (path.includes('useProdutoHttpEditLoad')) {
        return { __esModule: true, default: () => ({ readyId: null, loading: false }) };
      }
      if (path.includes('produtoHttpPolicy') || path.includes('produtoTipoPolicy')) {
        return {
          isProdutoHttpEditReady: () => true,
          toProdutoHttpPayload: (v) => v,
          validateProdutoPimQuantities: () => ({ ok: true }),
          PRODUTO_TIPOS_CANONICOS: [],
          getProdutoTipoOptions: () => [],
          normalizeProdutoTipoItem: (v) => v,
        };
      }
      if (path.includes('FormWrapper')) {
        return {
          __esModule: true,
          default: (props) => React.createElement('form', null, props.children),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return { useQuery: () => ({ data: [] }) };
      }
      if (path.includes('base44Client')) {
        return {
          base44: { auth: { me: async () => ({ id: 'u1' }) }, entities: {} },
          getHttpProdutoApi: () => ({ delete: async () => {} }),
          isHttpBackendMode: false,
          isHttpProdutoEnabled: false,
        };
      }
      if (path.includes('iaResponsePolicy')) {
        return { validarClassificacaoProdutoIA: () => ({ ok: true }) };
      }
      if (path.includes('BuscaDadosPublicos')) {
        return { BotaoBuscaAutomatica: () => null };
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
      // Lazy/sibling produto tabs etc.
      if (path.includes('./produto/') || path.includes('/produto/')) {
        return { __esModule: true, default: () => null };
      }
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { error: () => {}, log: () => {} },
    Suspense: React.Suspense,
  });
  return { Form: module.exports.default, state, buttons };
}

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadProduto({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    produto: { id: 'p1', descricao: 'Bitola 8', status: 'Ativo' },
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto grupo/empresa desabilita Excluir', async () => {
  const { Form, state, buttons } = await loadProduto({ canDelete: true, hasContext: false });
  renderToStaticMarkup(React.createElement(Form, {
    produto: { id: 'p1', descricao: 'Bitola 8', status: 'Ativo' },
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'Excluir fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadProduto({ canDelete: true, confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    produto: { id: 'p1', descricao: 'Bitola 8', status: 'Ativo' },
    onSubmit: (payload) => denied.state.deletes.push(payload),
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deleteInContext.length, 0);

  const allowed = await loadProduto({ canDelete: true, confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    produto: { id: 'p1', descricao: 'Bitola 8', status: 'Ativo' },
    onSubmit: (payload) => allowed.state.deletes.push(payload),
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deleteInContext.length, 1);
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/ProdutoFormV22_Completo.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
