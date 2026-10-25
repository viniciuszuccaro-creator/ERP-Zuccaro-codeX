import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getProdutoMediaScanLabel,
  getProdutoWorkflowActions,
  prepareProdutoMediaFile,
} from '../src/components/cadastros/produto/produtoHttpPolicy.js';

const require = createRequire(import.meta.url);

async function loadSection({
  canPublish = true,
  canView = true,
  confirmResult = true,
  hasEmpresa = true,
  workflowCalls,
} = {}) {
  const source = await readFile(
    new URL('../src/components/cadastros/produto/ProdutoRelationsDamSection.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, workflows: workflowCalls || [] };
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
      if (path.includes('base44Client')) {
        return {
          getHttpProdutoApi: () => ({
            variantes: { list: async () => [], create: async () => ({}), update: async () => ({}) },
            equivalentes: { list: async () => [], create: async () => ({}), update: async () => ({}), deactivate: async () => ({}) },
            midias: { list: async () => [] },
            outboxMetrics: async () => ({ byStatus: {} }),
            outboxList: async () => ({ rows: [] }),
            workflow: async (produtoId, target) => {
              state.workflows.push({ produtoId, target });
              return { workflow_status: target };
            },
            get: async () => ({ workflow_status: 'APROVADO' }),
            filter: async () => [],
            midiaReserve: async () => ({}),
            midiaConfirm: async () => ({}),
          }),
        };
      }
      if (path.includes('produtoHttpPolicy')) {
        return {
          getProdutoMediaScanLabel,
          getProdutoWorkflowActions,
          prepareProdutoMediaFile,
        };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { error: () => {}, warn: () => {}, log: () => {} },
  });
  return { Form: module.exports.default, state, buttons, props: {
    produtoId: 'p1',
    groupId: 'g1',
    empresaId: hasEmpresa ? 'e1' : null,
    canView,
    canEdit: true,
    canApprove: true,
    canPublish,
    canReprocess: false,
    canDiscard: false,
    canDeactivate: true,
    workflowStatus: 'APROVADO',
    onWorkflowChanged: () => {},
  } };
}

test('comportamental: sem permissão de publicar não mostra ação PUBLICADO', async () => {
  const { Form, state, buttons, props } = await loadSection({ canPublish: false });
  renderToStaticMarkup(React.createElement(Form, props));
  const publicar = buttons.find((b) => String(b['data-action'] || '') === 'produto-workflow-publicado');
  assert.equal(publicar, undefined, 'Publicar não deve aparecer sem canPublish');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem empresa não renderiza seção', async () => {
  const { Form, state, buttons, props } = await loadSection({ hasEmpresa: false });
  const html = renderToStaticMarkup(React.createElement(Form, props));
  assert.equal(html, '');
  assert.equal(buttons.length, 0);
  assert.equal(state.confirms, 0);
});

test('comportamental: publicação usa confirm-dialog e só persiste se confirmado', async () => {
  const denied = await loadSection({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, denied.props));
  const btnDenied = denied.buttons.find((b) => String(b['data-action'] || '') === 'produto-workflow-publicado');
  assert.ok(btnDenied, 'botão Publicar deve existir');
  await btnDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.workflows.length, 0);

  const allowed = await loadSection({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, allowed.props));
  const btn = allowed.buttons.find((b) => String(b['data-action'] || '') === 'produto-workflow-publicado');
  await btn.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.workflows.length, 1);
  assert.equal(allowed.state.workflows[0].target, 'PUBLICADO');
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/produto/ProdutoRelationsDamSection.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/produto/ProdutoRelationsDamSection.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
