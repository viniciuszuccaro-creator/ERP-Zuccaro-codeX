import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

const itensSeed = [
  { produto_id: 'p1', produto_descricao: 'Bitola 8', unidade: 'UN', saldo_sistema: 10, contagem: 8, ajuste: -2 },
];

async function loadContagem({ disabled = false, confirmResult = true } = {}) {
  const source = await readFile(
    new URL('../src/components/estoque/InventarioContagem.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, changes: [] };
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
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
  });
  return {
    Form: module.exports.default,
    state,
    buttons,
    props: {
      itens: itensSeed,
      disabled,
      onChange: (next) => { state.changes.push(next); },
    },
  };
}

test('comportamental: desabilitado não remove e não abre confirm', async () => {
  const { Form, state, buttons, props } = await loadContagem({ disabled: true });
  renderToStaticMarkup(React.createElement(Form, props));
  const remover = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Inventario.Contagem.remover');
  assert.ok(remover?.disabled, 'remover deve estar desabilitado');
  await remover.onClick();
  assert.equal(state.confirms, 0);
  assert.equal(state.changes.length, 0);
});

test('comportamental: cancelar confirm não altera itens', async () => {
  const { Form, state, buttons, props } = await loadContagem({ confirmResult: false });
  renderToStaticMarkup(React.createElement(Form, props));
  const remover = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Inventario.Contagem.remover');
  await remover.onClick();
  assert.equal(state.confirms, 1);
  assert.equal(state.changes.length, 0);
});

test('comportamental: confirmar remove item via confirm-dialog', async () => {
  const { Form, state, buttons, props } = await loadContagem({ confirmResult: true });
  renderToStaticMarkup(React.createElement(Form, props));
  const remover = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Inventario.Contagem.remover');
  await remover.onClick();
  assert.equal(state.confirms, 1);
  assert.equal(state.changes.length, 1);
  assert.equal(state.changes[0].length, 0);
  assert.doesNotMatch(
    await readFile(new URL('../src/components/estoque/InventarioContagem.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/estoque/InventarioContagem.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
