import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadPerfil({ canDelete = true, confirmResult = true, scopeCurrent = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/PerfilAcessoForm.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { deletes: [], confirms: 0, toasts: [] };
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
      if (path.includes('useCadastroRecordState')) {
        return {
          __esModule: true,
          default: (initial) => {
            const [v, setV] = React.useState(initial);
            return [v, setV];
          },
        };
      }
      if (path.includes('useCadastroFormScopeGuard')) {
        return { __esModule: true, default: () => ({ isCurrent: () => scopeCurrent }) };
      }
      if (path.includes('cadastroEditLoadPolicy')) {
        return {
          assertCadastroRecordInTenant: () => {},
          getCadastroEntityPermissionKey: (_e, action) => `Sistema.ControleAcesso.${action}`,
        };
      }
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
            isLoading: false,
            canCreate: () => true,
            canEdit: () => true,
            canDelete: () => canDelete,
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: { id: 'e1', group_id: 'g1' },
            grupoAtual: { id: 'g1' },
            contexto: 'empresa',
          }),
        };
      }
      if (path.includes('sonner')) {
        return { toast: { error: (m) => state.toasts.push(m), success: () => {} } };
      }
      if (path.includes('base44Client') || path.includes('/api/base44')) {
        return { base44: { integrations: { Core: { InvokeLLM: async () => ({}) } } } };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
  });
  return { Form: module.exports.default, state, buttons };
}

const perfil = {
  id: 'p1',
  nome: 'Vendedor',
  descricao: 'Perfil teste',
  nivel_acesso: 'Básico',
  ativo: true,
  permissoes: { cadastros: {}, financeiro: {}, comercial: {} },
};

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadPerfil({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    perfil,
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
  assert.equal(state.deletes.length, 0);
});

test('comportamental: escopo inválido bloqueia exclusão sem mutação', async () => {
  const { Form, state, buttons } = await loadPerfil({ canDelete: true, scopeCurrent: false });
  renderToStaticMarkup(React.createElement(Form, {
    perfil,
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir, 'botão Excluir presente');
  await excluir.onClick();
  assert.equal(state.confirms, 0, 'não abre confirm sem escopo');
  assert.equal(state.deletes.length, 0);
  assert.ok(state.toasts.length >= 1);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadPerfil({ canDelete: true, confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    perfil,
    onSubmit: (payload) => denied.state.deletes.push(payload),
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);

  const allowed = await loadPerfil({ canDelete: true, confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    perfil,
    onSubmit: (payload) => allowed.state.deletes.push(payload),
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0]._action, 'delete');
  const source = await readFile(new URL('../src/components/cadastros/PerfilAcessoForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /useConfirm/);
  assert.doesNotMatch(source, /window\.confirm/);
});
