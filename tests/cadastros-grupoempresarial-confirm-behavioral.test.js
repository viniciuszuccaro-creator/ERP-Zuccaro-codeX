import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadGrupoEmpresarial({ canDelete = true, confirmResult = true, hasContext = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/GrupoEmpresarialForm.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { deletes: [], confirms: 0, alerts: [] };
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
            contexto: hasContext ? 'grupo' : null,
          }),
        };
      }
      if (path.includes('useCadastroRecordState')) {
        return {
          __esModule: true,
          default: (initial) => {
            const [value, setValue] = React.useState(initial);
            return [value, setValue];
          },
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return { useQuery: () => ({ data: [] }) };
      }
      if (path.includes('base44Client')) {
        return { base44: { entities: { Empresa: { list: async () => [] } } } };
      }
      if (path.includes('CadastroCodigoRegistroField')) {
        return { __esModule: true, default: () => null };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
    alert: (msg) => { state.alerts.push(msg); },
  });
  return { Form: module.exports.default, state, buttons };
}

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadGrupoEmpresarial({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    grupo: { id: 'g1', nome: 'Grupo CPA', status: 'Ativo' },
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
  assert.equal(state.deletes.length, 0);
});

test('comportamental: sem contexto grupo/empresa desabilita Excluir em registro sem id de contexto', async () => {
  const { Form, state, buttons } = await loadGrupoEmpresarial({ canDelete: true, hasContext: false });
  // Sem grupo visual e sem id no registro: contextoValido=false e botão de exclusão não aparece.
  renderToStaticMarkup(React.createElement(Form, {
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.equal(excluir, undefined, 'Excluir ausente sem registro/contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadGrupoEmpresarial({ canDelete: true, confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    grupo: { id: 'g1', nome: 'Grupo CPA', status: 'Ativo' },
    onSubmit: (payload) => denied.state.deletes.push(payload),
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);

  const allowed = await loadGrupoEmpresarial({ canDelete: true, confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    grupo: { id: 'g1', nome: 'Grupo CPA', status: 'Ativo' },
    onSubmit: (payload) => allowed.state.deletes.push(payload),
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0]._action, 'delete');
  assert.doesNotMatch(
    await readFile(new URL('../src/components/cadastros/GrupoEmpresarialForm.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/GrupoEmpresarialForm.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
