import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

const resultadoMock = {
  produtos: [
    { descricao: 'Bitola 8', codigo: 'LEG-1', ncm: '7213', duplicado: false, valor_unitario: 10 },
  ],
};

async function loadImportacao({
  canCreate = true,
  confirmResult = true,
  hasContext = true,
  withData = false,
} = {}) {
  const source = await readFile(new URL('../src/components/cadastros/ImportacaoProdutoNFe.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, audits: [], creates: [], toasts: [] };
  const buttons = [];
  const module = { exports: {} };
  let useStateCall = 0;
  const reactMock = {
    ...require('react'),
    useState(initial) {
      useStateCall += 1;
      // 1 arquivo, 2 processando, 3 resultado
      if (withData && useStateCall === 3) return require('react').useState(resultadoMock);
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
            canCreate: () => canCreate,
            hasPermission: () => canCreate,
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            contexto: hasContext ? 'empresa' : null,
            filterInContext: async () => [],
            createInContext: async (entity, payload) => {
              if (entity === 'AuditLog') {
                state.audits.push(payload);
                return payload;
              }
              state.creates.push({ entity, payload });
              return { id: `new-${state.creates.length}` };
            },
          }),
        };
      }
      if (path.includes('base44Client')) {
        return { base44: { auth: { me: async () => ({ email: 't@t.com' }) } } };
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
      if (path === 'sonner') {
        return {
          toast: {
            error: (msg) => state.toasts.push(msg),
            success: () => {},
          },
        };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { error: () => {}, log: () => {} },
  });
  return { Form: module.exports.default, state, buttons };
}

test('comportamental: sem permissão desabilita importar e não abre confirm', async () => {
  const { Form, state, buttons } = await loadImportacao({ canCreate: false, withData: true });
  renderToStaticMarkup(React.createElement(Form, {}));
  const btn = buttons.find((b) => String(b['data-action'] || '').includes('criar-produtos'));
  assert.ok(btn?.disabled, 'importar deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita importar', async () => {
  const { Form, state, buttons } = await loadImportacao({ hasContext: false, withData: true });
  renderToStaticMarkup(React.createElement(Form, {}));
  const btn = buttons.find((b) => String(b['data-action'] || '').includes('criar-produtos'));
  assert.ok(btn?.disabled, 'importar fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: importação usa confirm-dialog e só grava se confirmado', async () => {
  const denied = await loadImportacao({ confirmResult: false, withData: true });
  renderToStaticMarkup(React.createElement(denied.Form, {}));
  const btnDenied = denied.buttons.find((b) => String(b['data-action'] || '').includes('criar-produtos'));
  await btnDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.creates.length, 0);
  assert.ok(denied.state.audits.some((a) => a.acao === 'Produto.importacao_produto_nfe_cancelada'));

  const allowed = await loadImportacao({ confirmResult: true, withData: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {}));
  const btn = allowed.buttons.find((b) => String(b['data-action'] || '').includes('criar-produtos'));
  await btn.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.ok(allowed.state.creates.some((c) => c.entity === 'Produto'));
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/ImportacaoProdutoNFe.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/ImportacaoProdutoNFe.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
