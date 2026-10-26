import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadRepresentante({ canDelete = true, confirmResult = true, contextoValido = true } = {}) {
  const source = await readFile(new URL('../src/components/cadastros/RepresentanteFormCompleto.jsx', import.meta.url), 'utf8');
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
      if (path.includes('@tanstack/react-query')) {
        return {
          useQuery: () => ({ data: [] }),
          useQueryClient: () => ({ invalidateQueries: () => {} }),
          useMutation: (opts) => ({
            isPending: false,
            mutate: (id) => {
              try {
                opts.mutationFn?.(id);
                state.deletes.push(id);
                opts.onSuccess?.();
              } catch (e) {
                state.toasts.push(String(e?.message || e));
              }
            },
          }),
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
      if (path.includes('use-toast') || path.includes('useToast')) {
        return { useToast: () => ({ toast: (o) => state.toasts.push(o) }) };
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
          __esModule: true,
          default: () => ({
            empresaAtual: contextoValido ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: contextoValido ? { id: 'g1' } : null,
            createInContext: async () => ({}),
            updateInContext: async () => ({}),
            deleteInContext: async (entity, id) => ({ entity, id }),
            filterInContext: async () => [],
          }),
          useContextoVisual: () => ({
            empresaAtual: contextoValido ? { id: 'e1', group_id: 'g1' } : null,
            grupoAtual: contextoValido ? { id: 'g1' } : null,
            createInContext: async () => ({}),
            updateInContext: async () => ({}),
            deleteInContext: async (entity, id) => ({ entity, id }),
            filterInContext: async () => [],
          }),
        };
      }
      if (path.includes('useCadastroFormScopeGuard')) {
        return {
          __esModule: true,
          default: () => ({
            isCurrent: () => true,
            assertCurrent: () => {},
          }),
        };
      }
      if (path.includes('FormWrapper')) {
        return { __esModule: true, default: (props) => React.createElement('form', null, props.children) };
      }
      if (path.includes('BuscaDadosPublicos') || path.includes('CadastroCodigoRegistroField')) {
        return { __esModule: true, default: () => null, BotaoBuscaAutomatica: () => null };
      }
      if (path.includes('lucide-react')) return new Proxy({}, { get: () => () => null });
      if (path.includes('@/components/ui/')) return ui;
      throw new Error(`Import inesperado: ${path}`);
    },
  });
  return { Form: module.exports.default, state, buttons };
}

const representante = {
  id: 'rep1',
  nome: 'Rep Alpha',
  status: 'Ativo',
  percentual_comissao: 5,
  tipo_pessoa: 'Pessoa Física',
  tipo_representante: 'Representante Comercial',
  tipo_comissao: 'Percentual',
  forma_pagamento_comissao: 'PIX',
  regioes_atendimento: [],
  endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', estado: '' },
  dados_bancarios: { banco: '', agencia: '', conta: '', tipo_conta: 'Corrente', pix_chave: '', tipo_pix: 'CPF' },
};

test('comportamental: exclusão sem permissão desabilita botão e não abre confirm', async () => {
  const { Form, state, buttons } = await loadRepresentante({ canDelete: false });
  renderToStaticMarkup(React.createElement(Form, {
    windowMode: true,
    representante,
    isOpen: true,
  }));
  const excluir = buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.ok(excluir?.disabled, 'botão Excluir deve estar desabilitado');
  assert.equal(state.confirms, 0);
  assert.equal(state.deletes.length, 0);
});

test('comportamental: exclusão autorizada usa confirm-dialog e só deleta se confirmado', async () => {
  const denied = await loadRepresentante({ canDelete: true, confirmResult: false });
  renderToStaticMarkup(React.createElement(denied.Form, {
    windowMode: true,
    representante,
    isOpen: true,
  }));
  const excluirDenied = denied.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  assert.equal(excluirDenied?.disabled, false);
  await excluirDenied.onClick();
  assert.equal(denied.state.confirms, 1);
  assert.equal(denied.state.deletes.length, 0);

  const allowed = await loadRepresentante({ canDelete: true, confirmResult: true });
  renderToStaticMarkup(React.createElement(allowed.Form, {
    windowMode: true,
    representante,
    isOpen: true,
  }));
  const excluir = allowed.buttons.find((b) => String(b['data-permission'] || '').includes('excluir'));
  await excluir.onClick();
  assert.equal(allowed.state.confirms, 1);
  assert.equal(allowed.state.deletes.length, 1);
  assert.equal(allowed.state.deletes[0], 'rep1');
  const source = await readFile(new URL('../src/components/cadastros/RepresentanteFormCompleto.jsx', import.meta.url), 'utf8');
  assert.match(source, /useConfirm/);
  assert.doesNotMatch(source, /window\.confirm/);
});
