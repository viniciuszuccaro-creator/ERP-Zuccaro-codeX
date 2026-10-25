import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadHistorico({ canEdit = true, confirmResult = true, hasContext = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/HistoricoProduto.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, updates: [], audits: [], toasts: [] };
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
            canEdit: () => canEdit,
            canDelete: () => true,
            hasPermission: () => true,
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
            updateInContext: async (entity, id, payload) => {
              state.updates.push({ entity, id, payload });
              return { id, ...payload };
            },
          }),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return { useQuery: () => ({ data: [] }) };
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
      if (path.includes('produtoTipoPolicy')) {
        return {
          PRODUTO_TIPOS_CANONICOS: { MATERIA_PRIMA: 'Materia-Prima' },
          isProdutoMateriaPrima: () => false,
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
      if (path.includes('recharts')) {
        return new Proxy({}, { get: () => () => null });
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    window: { location: { reload: () => { state.reloaded = true; } } },
  });
  return { Form: module.exports.default, state, buttons };
}

test('comportamental: sem permissão desabilita conversão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadHistorico({ canEdit: false });
  renderToStaticMarkup(React.createElement(Form, {
    produtoId: 'p1',
    produto: { id: 'p1', tipo_item: 'Revenda', group_id: 'g1' },
  }));
  const btn = buttons.find((b) => String(b['data-action'] || '') === 'converter-produto-producao');
  assert.ok(btn?.disabled, 'botão converter deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita conversão', async () => {
  const { Form, state, buttons } = await loadHistorico({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, {
    produtoId: 'p1',
    produto: { id: 'p1', tipo_item: 'Revenda' },
  }));
  const btn = buttons.find((b) => String(b['data-action'] || '') === 'converter-produto-producao');
  assert.ok(btn?.disabled, 'converter fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: conversão usa confirm-dialog e só persiste se confirmado', async () => {
  const denied = await loadHistorico({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    produtoId: 'p1',
    produto: { id: 'p1', tipo_item: 'Revenda', group_id: 'g1' },
  }));
  const btnDenied = denied.buttons.find((b) => String(b['data-action'] || '') === 'converter-produto-producao');
  await btnDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.updates.length, 0);
  assert.ok(denied.state.audits.some((a) => a.acao === 'Produto.converter_producao_cancelado'));

  const allowed = await loadHistorico({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    produtoId: 'p1',
    produto: { id: 'p1', tipo_item: 'Revenda', group_id: 'g1' },
  }));
  const btn = allowed.buttons.find((b) => String(b['data-action'] || '') === 'converter-produto-producao');
  await btn.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.updates.length, 1);
  assert.equal(allowed.state.updates[0].entity, 'Produto');
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/HistoricoProduto.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/HistoricoProduto.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
