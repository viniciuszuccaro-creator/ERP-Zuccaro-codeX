import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadChatbotIntents({ canEdit = true, confirmResult = true, hasContext = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/ChatbotIntentsForm.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = {
    confirms: 0,
    submits: [],
    updates: [],
    audits: [],
    alerts: [],
    childOnSubmit: null,
  };
  const module = { exports: {} };
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
      if (path.includes('ChatbotIntentForm')) {
        return {
          __esModule: true,
          default: (props) => {
            state.childOnSubmit = props.onSubmit;
            return null;
          },
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
            createInContext: async (entity, payload) => ({ id: 'new1', ...payload }),
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
          },
        };
      }
      throw new Error(`Import inesperado: ${path}`);
    },
    alert: (msg) => { state.alerts.push(msg); },
    console: { error: () => {}, log: () => {} },
  });
  return { Form: module.exports.default, state };
}

test('comportamental: desativação cancelada no confirm não persiste', async () => {
  const { Form, state } = await loadChatbotIntents({ confirmResult: false });
  renderToStaticMarkup(React.createElement(Form, {
    intent: { id: 'i1', __entity: 'ChatbotIntent', nome_intent: 'Saudacao', ativo: true, group_id: 'g1' },
    onSubmit: (payload) => state.submits.push(payload),
  }));
  assert.equal(typeof state.childOnSubmit, 'function');
  await state.childOnSubmit({ nome_intent: 'Saudacao', ativo: false, tipo_intent: 'consulta' });
  assert.equal(state.confirms, 1);
  assert.equal(state.updates.length, 0);
  assert.equal(state.submits.length, 0);
  assert.ok(state.audits.some((a) => a.acao === 'ChatbotIntent.desativacao_cancelada'));
});

test('comportamental: desativação confirmada usa dialog e persiste', async () => {
  const { Form, state } = await loadChatbotIntents({ confirmResult: true });
  renderToStaticMarkup(React.createElement(Form, {
    intent: { id: 'i1', __entity: 'ChatbotIntent', nome_intent: 'Saudacao', ativo: true, group_id: 'g1' },
    onSubmit: (payload) => state.submits.push(payload),
  }));
  await state.childOnSubmit({ nome_intent: 'Saudacao', ativo: false, tipo_intent: 'consulta' });
  assert.equal(state.confirms, 1);
  assert.equal(state.updates.length, 1);
  assert.equal(state.submits.length, 1);
  assert.equal(state.updates[0].payload.ativo, false);
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/ChatbotIntentsForm.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/ChatbotIntentsForm.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});

test('comportamental: sem contexto bloqueia salvar sem abrir confirm de desativação', async () => {
  const { Form, state } = await loadChatbotIntents({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, {
    intent: { id: 'i1', __entity: 'ChatbotIntent', nome_intent: 'Saudacao', ativo: true },
    onSubmit: (payload) => state.submits.push(payload),
  }));
  await state.childOnSubmit({ nome_intent: 'Saudacao', ativo: false, tipo_intent: 'consulta' });
  assert.equal(state.confirms, 0);
  assert.equal(state.updates.length, 0);
  assert.ok(state.alerts.length >= 1);
});
