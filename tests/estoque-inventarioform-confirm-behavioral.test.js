import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

const invSeed = {
  id: 'i1',
  descricao: 'Inventario teste',
  data_referencia: '2026-01-01',
  status: 'Em Aprovação',
  itens: [],
};

async function loadForm({
  canApprove = true,
  canSave = true,
  confirmResult = true,
  hasContext = true,
  withId = true,
} = {}) {
  const source = await readFile(
    new URL('../src/components/estoque/InventarioForm.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, audits: [], updates: [], creates: [], invokes: [] };
  const buttons = [];
  const module = { exports: {} };
  let useStateCall = 0;
  const reactMock = {
    ...require('react'),
    useState(initial) {
      useStateCall += 1;
      if (withId && useStateCall === 1) return require('react').useState(invSeed);
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
            canCreate: () => canSave,
            canEdit: () => canSave,
            canApprove: () => canApprove,
            hasPermission: () => canSave || canApprove,
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            contexto: hasContext ? 'empresa' : null,
            carimbarContexto: (payload) => ({ ...payload, empresa_id: 'e1', group_id: 'g1' }),
            createInContext: async (entity, payload) => {
              if (entity === 'AuditLog') {
                state.audits.push(payload);
                return payload;
              }
              state.creates.push({ entity, payload });
              return { id: 'new-1', ...payload };
            },
            updateInContext: async (entity, id, payload) => {
              state.updates.push({ entity, id, payload });
              return { id, ...payload };
            },
          }),
        };
      }
      if (path.includes('base44Client')) {
        return {
          base44: {
            entities: {
              AuditLog: {
                create: async (row) => { state.audits.push(row); },
              },
            },
            functions: {
              invoke: async (name, payload) => {
                state.invokes.push({ name, payload });
                return { data: { movimentos_count: 0 } };
              },
            },
          },
        };
      }
      if (path.includes('InventarioContagem')) {
        return { __esModule: true, default: () => null };
      }
      if (path.includes('FormWrapper')) {
        return {
          __esModule: true,
          default: (props) => React.createElement('form', {
            onSubmit: (e) => { e?.preventDefault?.(); props.onSubmit?.(); },
          }, props.children),
        };
      }
      if (path === 'zod') {
        const chain = new Proxy({}, { get: () => () => chain });
        return { z: { object: () => chain, string: () => chain } };
      }
      if (path === 'sonner') {
        return { toast: { error: () => {}, success: () => {} } };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { error: () => {}, warn: () => {}, log: () => {} },
  });
  return { Form: module.exports.default, state, buttons };
}

test('comportamental: sem permissão de aprovar desabilita e não abre confirm', async () => {
  const { Form, state, buttons } = await loadForm({ canApprove: false });
  renderToStaticMarkup(React.createElement(Form, {}));
  const aprovar = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Inventario.aprovarAplicar');
  assert.ok(aprovar?.disabled, 'aprovar deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita aprovar', async () => {
  const { Form, state, buttons } = await loadForm({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, {}));
  const aprovar = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Inventario.aprovarAplicar');
  assert.ok(aprovar?.disabled, 'aprovar fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: aprovação sensível usa confirm-dialog e só grava se confirmado', async () => {
  const denied = await loadForm({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {}));
  const btnDenied = denied.buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Inventario.aprovarAplicar');
  await btnDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.updates.length, 0);
  assert.ok(denied.state.audits.some((a) => a.acao === 'Inventario.salvar_cancelado'));

  const allowed = await loadForm({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {}));
  const btn = allowed.buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Inventario.aprovarAplicar');
  await btn.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.updates.length, 1);
  assert.equal(allowed.state.updates[0].payload.status, 'Aprovado');
  assert.doesNotMatch(
    await readFile(new URL('../src/components/estoque/InventarioForm.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/estoque/InventarioForm.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
