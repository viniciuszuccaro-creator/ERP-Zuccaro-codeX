import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

const companies = [
  { id: 'e1', group_id: 'g1', nome_fantasia: 'Origem SA' },
  { id: 'e2', group_id: 'g1', nome_fantasia: 'Destino SA' },
];
const products = [
  {
    id: 'p1',
    group_id: 'g1',
    empresa_id: 'e1',
    descricao: 'Bitola 8',
    status: 'Ativo',
    unidade_medida: 'UN',
    estoque_atual: 100,
  },
];
const formSeed = {
  empresa_origem_id: 'e1',
  empresa_destino_id: 'e2',
  produto_id: 'p1',
  quantidade: 5,
  unidade: 'UN',
  motivo: 'reequilibrio',
  gerar_financeiro: false,
  observacoes: '',
};

async function loadForm({
  canCreate = true,
  confirmResult = true,
  hasContext = true,
  withData = true,
} = {}) {
  const source = await readFile(
    new URL('../src/components/estoque/TransferenciaEntreEmpresasForm.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, audits: [], mutates: [], forms: [] };
  const buttons = [];
  const module = { exports: {} };
  let useStateCall = 0;
  const realReact = require('react');
  const reactMock = {
    ...realReact,
    useState(initial) {
      useStateCall += 1;
      if (withData && useStateCall === 1) return realReact.useState(formSeed);
      return realReact.useState(initial);
    },
    createElement(type, props, ...children) {
      if (type === 'form' && props) state.forms.push(props);
      if (typeof type === 'string' && type === 'button' && props) buttons.push(props);
      return realReact.createElement(type, props, ...children);
    },
  };

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
          default: () => ({ canCreate: () => canCreate }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            contexto: hasContext ? 'grupo' : null,
            createInContext: async (entity, payload) => {
              if (entity === 'AuditLog') {
                state.audits.push(payload);
                return payload;
              }
              return { id: 'new-1', ...payload };
            },
            updateInContext: async (_e, id, payload) => ({ id, ...payload }),
          }),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return {
          useQueryClient: () => ({ invalidateQueries: () => {} }),
          useMutation: (opts) => ({
            isPending: false,
            mutate: (payload) => {
              state.mutates.push(payload);
              opts?.onSuccess?.({ id: 't1' });
            },
          }),
        };
      }
      if (path.includes('estoqueMovimentoPolicy')) {
        return {
          createTransferenciaFormState: () => ({ ...formSeed, quantidade: 0 }),
          resolveTransferenciaEntreEmpresas: ({ form }) => ({
            form: { ...formSeed, ...form },
            product: products[0],
            origin: companies[0],
            destination: companies[1],
          }),
          summarizeTransferenciaAudit: (x) => x,
        };
      }
      if (path.includes('TransferenciaEntreEmpresasFields')) {
        return {
          __esModule: true,
          default: (props) => {
            const btnProps = {
              type: 'submit',
              disabled: Boolean(props.disabled || props.isPending),
              'data-action': 'Estoque.Transferencias.confirmar',
            };
            buttons.push(btnProps);
            return React.createElement('button', btnProps, 'Confirmar');
          },
        };
      }
      if (path === 'sonner') return { toast: { error: () => {}, success: () => {} } };
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { error: () => {}, warn: () => {}, log: () => {} },
  });
  return {
    Form: module.exports.default,
    state,
    buttons,
    props: {
      empresasDoGrupo: hasContext ? companies : [],
      produtos: products,
    },
  };
}

test('comportamental: sem permissão desabilita confirmar e não abre confirm', async () => {
  const { Form, state, buttons, props } = await loadForm({ canCreate: false });
  renderToStaticMarkup(React.createElement(Form, props));
  const confirmar = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Transferencias.confirmar');
  assert.ok(confirmar?.disabled, 'confirmar deve estar desabilitado');
  assert.equal(state.confirms, 0);
});

test('comportamental: sem contexto de grupo/empresas desabilita confirmar', async () => {
  const { Form, state, buttons, props } = await loadForm({ hasContext: false });
  renderToStaticMarkup(React.createElement(Form, props));
  const confirmar = buttons.find((b) => String(b['data-action'] || '') === 'Estoque.Transferencias.confirmar');
  assert.ok(confirmar?.disabled, 'confirmar fail-closed sem contexto');
  assert.equal(state.confirms, 0);
});

test('comportamental: transferência usa confirm-dialog e só muta se confirmado', async () => {
  const denied = await loadForm({ confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, denied.props));
  assert.ok(denied.state.forms[0]?.onSubmit, 'form onSubmit capturado');
  await denied.state.forms[0].onSubmit({ preventDefault() {} });
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.mutates.length, 0);
  assert.ok(denied.state.audits.some((a) => a.acao === 'TransferenciaEntreEmpresas.cancelada'));

  const allowed = await loadForm({ confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, allowed.props));
  await allowed.state.forms[0].onSubmit({ preventDefault() {} });
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.mutates.length, 1);
  assert.equal(allowed.state.mutates[0].produto_id, 'p1');
  assert.doesNotMatch(
    await readFile(new URL('../src/components/estoque/TransferenciaEntreEmpresasForm.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/estoque/TransferenciaEntreEmpresasForm.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
