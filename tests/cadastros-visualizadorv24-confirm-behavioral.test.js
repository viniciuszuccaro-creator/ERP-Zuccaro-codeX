import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const emptyComponent = (props) => React.createElement('div', null, props?.children);

async function loadViz({
  canDelete = true,
  confirmResult = true,
  hasContext = true,
} = {}) {
  const source = await readFile(
    new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url),
    'utf8',
  );
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { confirms: 0, deletes: [], audits: [] };
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
  const stubDefault = { __esModule: true, default: emptyComponent };

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
            isLoading: false,
          }),
        };
      }
      if (path.includes('useContextoVisual')) {
        return {
          useContextoVisual: () => ({
            empresaAtual: hasContext ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: hasContext ? { id: 'g1' } : null,
            empresasDoGrupo: hasContext ? [{ id: 'e1' }] : [],
            contextoCanonico: hasContext ? 'empresa' : null,
            createInContext: async () => ({}),
            updateInContext: async () => ({}),
            deleteInContext: async (entity, id) => {
              state.deletes.push({ entity, id });
            },
            getInContext: async () => null,
            filterInContext: async () => [],
          }),
        };
      }
      if (path.includes('@tanstack/react-query')) {
        return {
          useQuery: () => ({
            data: [{ id: 'r1', nome: 'Registro' }],
            isFetching: false,
            isError: false,
            status: 'success',
          }),
          useQueryClient: () => ({ invalidateQueries: () => {} }),
        };
      }
      if (path.includes('base44Client')) {
        return {
          base44: {
            functions: { invoke: async () => ({ data: [{ id: 'r1', nome: 'Registro' }] }) },
            entities: {
              AuditLog: { create: async (row) => { state.audits.push(row); } },
            },
          },
        };
      }
      if (path.includes('useEntityCounts')) {
        return {
          __esModule: true,
          default: () => ({ counts: { Marca: 1 }, isLoading: false }),
        };
      }
      if (path.includes('useWindow')) {
        return { useWindow: () => ({ openWindow: () => {} }) };
      }
      if (path.includes('cadastroEditLoadPolicy')) {
        return {
          assertCadastroRecordInTenant: () => {},
          buildCadastroEditSavePayload: (x) => x,
          classifyCadastroEditLoad: () => 'ok',
          getCadastroEntityPermissionKey: (e, a) => `Cadastros.${e}.${a}`,
          hasCadastroEntityPermission: (_e, action) => {
            if (action === 'excluir') return canDelete;
            return true;
          },
          isCadastroEditLoadComplete: () => true,
          mergeCadastroEditHydration: (x) => x,
        };
      }
      if (path.includes('contextoMultiempresaPolicy')) {
        return {
          assertCadastroFormScopeCurrent: () => {},
          buildCadastroScopeSwitchReset: () => ({
            bumpEditRequest: false,
            isLoadingEdit: false,
            editLoadBlocked: false,
            editError: null,
            editItem: null,
            showForm: false,
            isSaving: false,
            selectedIds: new Set(),
            deselectedIds: new Set(),
            crossPageAll: false,
            formKey: 0,
          }),
          buildMultiempresaReadFilter: () => ({}),
          getScopedCadastroPlaceholder: (prev) => prev,
          isEditRequestCurrent: () => true,
          isTenantMasterEntity: () => false,
          loadEmpresaForEdit: async () => null,
        };
      }
      if (path.includes('useClienteCadastroNavigation')) {
        return { __esModule: true, default: () => ({}) };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      if (
        path.includes('CadastroClienteCompleto')
        || path.includes('CadastroFornecedorCompleto')
        || path.includes('TransportadoraForm')
        || path.includes('ColaboradorForm')
        || path.includes('RepresentanteFormCompleto')
        || path.includes('ContatoB2BForm')
        || path.includes('SegmentoClienteForm')
        || path.includes('RegiaoAtendimentoForm')
        || path.includes('DetalhesCliente')
      ) {
        return stubDefault;
      }
      throw new Error(`Import inesperado: ${path}`);
    },
    console: { error: () => {}, warn: () => {}, log: () => {} },
    alert: () => {},
    Set,
    Map,
    Promise,
    JSON,
    Math,
    Number,
    String,
    Array,
    Boolean,
    Object,
    Error,
    parseInt,
    isNaN,
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
    await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8'),
    /window\.confirm/,
  );
  assert.match(
    await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8'),
    /useConfirm/,
  );
});
