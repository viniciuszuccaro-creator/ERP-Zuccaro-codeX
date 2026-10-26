import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadTransportadora({ canDelete = true, confirmResult = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/TransportadoraForm.jsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { deletes: [], confirms: 0, errors: [] };
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
      if (path.includes('use-toast') || path.includes('useToast')) {
        return { useToast: () => ({ toast: (o) => state.errors.push(o) }) };
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
          }),
        };
      }
      if (path.includes('FormWrapper')) {
        return {
          __esModule: true,
          default: (props) => React.createElement('form', { onSubmit: (e) => { e?.preventDefault?.(); props.onSubmit?.(); } }, props.children),
        };
      }
      if (path.includes('BuscaDadosPublicos') || path.includes('CadastroCodigoRegistroField')) {
        return { __esModule: true, default: () => null, BotaoBuscaAutomatica: () => null };
      }
      if (path === 'zod' || path.includes('zod')) {
        const chain = {
          min() { return chain; },
          optional() { return chain; },
          nullable() { return chain; },
        };
        return {
          z: {
            object: () => chain,
            string: () => chain,
          },
        };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
  });
  return { Form: module.exports.default, state, buttons };
}

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadTransportadora({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    transportadora: { id: 't1', razao_social: 'Trans Alpha', status: 'Ativo' },
    onSubmit: (payload) => state.deletes.push(payload),
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
  assert.equal(state.deletes.length, 0);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadTransportadora({ canDelete: true, confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    transportadora: { id: 't1', razao_social: 'Trans Alpha', status: 'Ativo' },
    onSubmit: (payload) => denied.state.deletes.push(payload),
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);

  const allowed = await loadTransportadora({ canDelete: true, confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    transportadora: { id: 't1', razao_social: 'Trans Alpha', status: 'Ativo' },
    onSubmit: (payload) => allowed.state.deletes.push(payload),
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0]._action, 'delete');
  const source = await readFile(new URL('../src/components/cadastros/TransportadoraForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /useConfirm/);
  assert.match(source, /onClick=\{solicitarExclusao\}/);
  // handleExcluir com window.confirm permanece só para retention harness (publication baseline).
  assert.match(source, /const handleExcluir = \(\) =>/);
});
