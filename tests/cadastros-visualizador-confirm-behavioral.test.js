import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadViz({
  canDelete = true,
  confirmResult = true,
  hasContext = true,
} = {}) {
  const source = await readFile(
    new URL('../src/components/cadastros/VisualizadorUniversalEntidade.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, deletes: [] };
  const buttons = [];
  const module = { exports: {} };
  const realReact = require('react');
  const reactMock = {
    ...realReact,
    createElement(type, props, ...children) {
      if (type === 'button' && props) buttons.push(props);
      return realReact.createElement(type, props, ...children);
    },
  };
  const ui = new Proxy({}, {
    get: () => (props) => React.createElement('div', null, props?.children),
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
            filterInContext: async () => [{ id: 'r1', nome: 'Registro' }],
            deleteInContext: async (entity, id) => {
              state.deletes.push({ entity, id });
            },
          }),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return {
          useQuery: () => ({
            data: [{ id: 'r1', nome: 'Registro' }],
            isLoading: false,
            isFetching: false,
          }),
          useQueryClient: () => ({ invalidateQueries: () => {} }),
        };
      }
      if (path.includes('base44Client')) {
        return { base44: { entities: {} } };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { error: () => {}, warn: () => {}, log: () => {} },
    alert: () => {},
  });
  return { Form: module.exports.default, state, buttons };
}

const vizProps = {
  nomeEntidade: 'Marca',
  tituloDisplay: 'Marca',
  camposPrincipais: ['nome'],
};

test('comportamental: sem permissão desabilita excluir e não abre confirm', async () => {
  const { Form, state, buttons } = await loadViz({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, vizProps));
  const excluir = buttons.find((b) => b.title === 'Excluir');
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto desabilita excluir', async () => {
  const { Form, state, buttons } = await loadViz({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, vizProps));
  const excluir = buttons.find((b) => b.title === 'Excluir');
  assert.ok(excluir?.disabled, 'Excluir fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: exclusão usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadViz({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, vizProps));
  const excluirDenied = denied.buttons.find((b) => b.title === 'Excluir');
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);

  const allowed = await loadViz({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, vizProps));
  const excluir = allowed.buttons.find((b) => b.title === 'Excluir');
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0].id, 'r1');
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidade.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidade.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
