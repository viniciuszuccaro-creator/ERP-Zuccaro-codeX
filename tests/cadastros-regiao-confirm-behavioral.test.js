import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadRegiao({ canDelete = true, confirmResult = true, scopeCurrent = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/RegiaoAtendimentoForm.jsx', import.meta.url), 'utf8');
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
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            filterInContext: async () => [],
            getInContext: async () => null,
            empresaAtual: { id: 'e1', group_id: 'g1' },
            grupoAtual: { id: 'g1' },
            contexto: 'empresa',
          }),
        };
      }
      if (path.includes('useCadastroFormScopeGuard')) {
        return {
          __esModule: true,
          default: () => ({ isCurrent: () => scopeCurrent }),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return { useQuery: () => ({ data: [] }) };
      }
      if (path.includes('sonner')) {
        return { toast: { error: (m) => state.toasts.push(m), success: () => {} } };
      }
      if (path.includes('CadastroCodigoRegistroField')) {
        return { __esModule: true, default: () => null };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
  });
  return { Form: module.exports.default, state, buttons };
}

const regiao = {
  id: 'r1',
  nome_regiao: 'Sul',
  codigo_regiao: 'SUL',
  tipo_regiao: 'Personalizada',
  estados_abrangidos: ['SP'],
  cidades_abrangidas: [],
  ativo: true,
  logistica: {},
  comercial: {},
};

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadRegiao({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    windowMode: true,
    regiaoId: regiao.id,
    item: regiao,
    onSubmit: (payload) => state.deletes.push(payload),
    onOpenChange: () => {},
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
  assert.equal(state.deletes.length, 0);
});

test('comportamental: escopo inválido desabilita Excluir', async () => {
  const { Form, state, buttons } = await loadRegiao({ canDelete: true, scopeCurrent: false });
  renderToStaticMarkup(React.createElement(Form, {
    windowMode: true,
    regiaoId: regiao.id,
    item: regiao,
    onSubmit: (payload) => state.deletes.push(payload),
    onOpenChange: () => {},
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'Excluir fail-closed sem escopo atual');
  assert.equal(state.confirms, 0);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadRegiao({ canDelete: true, confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    windowMode: true,
    regiaoId: regiao.id,
    item: regiao,
    onSubmit: (payload) => denied.state.deletes.push(payload),
    onOpenChange: () => {},
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.equal(excluirDenied?.disabled, false);
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);

  const allowed = await loadRegiao({ canDelete: true, confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    windowMode: true,
    regiaoId: regiao.id,
    item: regiao,
    onSubmit: (payload) => allowed.state.deletes.push(payload),
    onOpenChange: () => {},
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0]._delete, true);
  const source = await readFile(new URL('../src/components/cadastros/RegiaoAtendimentoForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /useConfirm/);
  assert.doesNotMatch(source, /window\.confirm/);
});
