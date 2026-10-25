import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadTable({ canDelete = true, confirmResult = true, hasContext = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/CadastrosTableUniversal.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, deletes: [] };
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
          }),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return {
          useQuery: () => ({ data: [{ id: 'r1', nome: 'Registro' }], isLoading: false }),
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
  });
  return { Form: module.exports.default, state, buttons };
}

const columns = [{ field: 'nome', label: 'Nome' }];

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadTable({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    entityName: 'Marca',
    columns,
    onDelete: (item) => state.deletes.push(item),
  }));
  const excluir = buttons.find((b) => String(b['data-action'] || '').includes('.excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto grupo/empresa desabilita Excluir', async () => {
  const { Form, state, buttons } = await loadTable({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, {
    entityName: 'Marca',
    columns,
    onDelete: (item) => state.deletes.push(item),
  }));
  const excluir = buttons.find((b) => String(b['data-action'] || '').includes('.excluir'));
  assert.ok(excluir?.disabled, 'Excluir fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadTable({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    entityName: 'Marca',
    columns,
    onDelete: (item) => denied.state.deletes.push(item),
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-action'] || '').includes('.excluir'));
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);

  const allowed = await loadTable({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    entityName: 'Marca',
    columns,
    onDelete: (item) => allowed.state.deletes.push(item),
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-action'] || '').includes('.excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0].id, 'r1');
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/CadastrosTableUniversal.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/CadastrosTableUniversal.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
