import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

const produtoBase = [{ codigo: 'LEG-1', descricao: 'Bitola', tipo_item: '', unidade_medida: 'UN', preco_venda: 10 }];

async function loadImport({
  canImport = true,
  confirmResult = true,
  hasContext = true,
  withData = false,
} = {}) {
  const source = await readFile(
    new URL('../src/components/estoque/ImportadorProdutosPlanilha.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, audits: [], creates: [], toasts: [] };
  const buttons = [];
  const module = { exports: {} };
  let useStateCall = 0;
  const reactMock = {
    ...require('react'),
    useState(initial) {
      useStateCall += 1;
      // 1 arquivo, 10 grupoId, 11 empresaId, 13 baseProdutos
      if (withData && useStateCall === 1) return require('react').useState({ name: 'produtos.csv' });
      if (withData && useStateCall === 10) return require('react').useState('g1');
      if (withData && useStateCall === 11) return require('react').useState(hasContext ? 'e1' : '');
      if (withData && useStateCall === 13) return require('react').useState(produtoBase);
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
            hasPermission: () => canImport,
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            contexto: hasContext ? 'grupo' : null,
            filterInContext: async () => [],
            createInContext: async (entity, payload) => {
              if (entity === 'AuditLog') {
                state.audits.push(payload);
                return payload;
              }
              state.creates.push({ entity, payload });
              return { id: `new-${state.creates.length}` };
            },
            updateInContext: async () => ({}),
            deleteInContext: async () => ({}),
          }),
        };
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
            integrations: {
              Core: {
                UploadFile: async () => ({ file_url: '' }),
                ExtractDataFromUploadedFile: async () => ({ status: 'success', output: { rows: [] } }),
                InvokeLLM: async () => ({}),
              },
            },
          },
        };
      }
      if (path.includes('migracaoErpPolicy')) {
        return {
          assertReconciliacaoMigracao: () => {},
          buildReconciliacaoMigracao: ({ origem }) => ({
            quantidade_origem: origem?.length || 0,
            quantidade_gravados: 0,
            quantidade_reusos: 0,
          }),
          stampMigracaoRecord: (rec) => ({ ...rec, group_id: 'g1' }),
        };
      }
      if (path.includes('produtoTipoPolicy')) {
        return {
          resolveProdutoTipoImportacao: () => ({ value: 'Revenda', requiresReview: false, usedDefault: true }),
        };
      }
      if (path.includes('iaResponsePolicy')) {
        return { validarSugestoesNcmIA: () => [] };
      }
      if (path === 'sonner') {
        return {
          toast: Object.assign((msg) => state.toasts.push(msg), {
            error: (msg) => state.toasts.push(msg),
            success: () => {},
            warning: () => {},
          }),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return { useQuery: () => ({ data: [] }) };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { error: () => {}, log: () => {}, warn: () => {} },
    Set,
    Map,
    Promise,
    Number,
    String,
    Array,
    Object,
    JSON,
    Date,
    Blob: function Blob() {},
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} },
    document: { createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
  });
  return { Form: module.exports.default, state, buttons };
}

test('comportamental: sem permissão desabilita importar e não abre confirm', async () => {
  const { Form, state, buttons } = await loadImport({ canImport: false, withData: true });
  renderToStaticMarkup(React.createElement(Form, {}));
  const btn = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Produtos.importar.executar');
  assert.ok(btn?.disabled, 'importar deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita importar', async () => {
  const { Form, state, buttons } = await loadImport({ hasContext: false, withData: false });
  renderToStaticMarkup(React.createElement(Form, {}));
  const btn = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Produtos.importar.executar');
  assert.ok(btn?.disabled, 'importar fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: importação usa confirm-dialog e cancela sem gravar', async () => {
  const denied = await loadImport({ confirmResult: false, withData: true });
  renderToStaticMarkup(React.createElement(denied.Form, {}));
  const btnDenied = denied.buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Produtos.importar.executar');
  await btnDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.creates.length, 0);
  assert.ok(denied.state.audits.some((a) => String(a.acao || '').includes('cancelada')));

  const allowed = await loadImport({ confirmResult: true, withData: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {}));
  const btn = allowed.buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Produtos.importar.executar');
  await btn.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.ok(!allowed.state.audits.some((a) => String(a.acao || '').includes('cancelada')));
  assert.doesNotMatch(
    await readFile(new URL('../src/components/estoque/ImportadorProdutosPlanilha.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/estoque/ImportadorProdutosPlanilha.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
