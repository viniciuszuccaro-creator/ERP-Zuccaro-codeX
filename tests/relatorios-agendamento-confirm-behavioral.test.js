import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadForm({
  canEdit = true,
  canView = true,
  confirmResult = true,
  hasContext = true,
} = {}) {
  const source = await readFile(
    new URL('../src/components/relatorios/AgendamentoRelatorios.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, audits: [], saves: [], buttons: [] };
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
              if (acao === 'editar') return canEdit;
              if (acao === 'visualizar') return canView;
              return canView || canEdit;
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
            filterInContext: async () => [],
            createInContext: async (entity, payload) => {
              state.saves.push({ entity, payload, op: 'create' });
              return payload;
            },
            updateInContext: async (entity, id, payload) => {
              state.saves.push({ entity, id, payload, op: 'update' });
              return payload;
            },
          }),
        };
      }
      if (path.includes('UserContext')) {
        return { useUser: () => ({ user: { id: 'u1', email: 't@t.com' } }) };
      }
      if (path.includes('@tanstack/react-query')) {
        return {
          useQueryClient: () => ({ invalidateQueries: () => {} }),
          useMutation: ({ mutationFn, onSuccess, onError }) => ({
            isPending: false,
            mutate: (data) => {
              Promise.resolve()
                .then(() => mutationFn(data))
                .then((r) => onSuccess?.(r))
                .catch((e) => onError?.(e));
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
          },
        };
      }
      if (path.includes('use-toast')) {
        return { useToast: () => ({ toast: () => {} }) };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { warn: () => {}, error: () => {}, log: () => {} },
  });
  return { Form: module.exports.default, state };
}

function wait(ms = 30) {
  return new Promise((r) => setTimeout(r, ms));
}

test('comportamental: sem permissão desabilita salvar e não abre confirm', async () => {
  const { Form, state } = await loadForm({ canEdit: false });
  renderToStaticMarkup(React.createElement(Form, {}));
  const btn = state.buttons.find((b) => String(b['data-action'] || '') === 'AgendamentoRelatorios.salvar');
  assert.ok(btn?.disabled, 'salvar deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita salvar', async () => {
  const { Form, state } = await loadForm({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, {}));
  const btn = state.buttons.find((b) => String(b['data-action'] || '') === 'AgendamentoRelatorios.salvar');
  assert.ok(btn?.disabled, 'salvar fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: salvar usa confirm-dialog e só persiste se confirmado', async () => {
  const denied = await loadForm({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {}));
  const btnDenied = denied.state.buttons.find((b) => String(b['data-action'] || '') === 'AgendamentoRelatorios.salvar');
  btnDenied.onClick();
  await wait(50);
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.saves.length, 0);
  assert.ok(denied.state.audits.some((a) => a.acao === 'Cancelamento'));

  const allowed = await loadForm({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {}));
  const btn = allowed.state.buttons.find((b) => String(b['data-action'] || '') === 'AgendamentoRelatorios.salvar');
  btn.onClick();
  await wait(50);
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.saves.length, 1);
  assert.ok(allowed.state.audits.some((a) => a.sucesso === true && a.acao === 'Salvar'));
  assert.doesNotMatch(
    await readFile(new URL('../src/components/relatorios/AgendamentoRelatorios.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/relatorios/AgendamentoRelatorios.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
