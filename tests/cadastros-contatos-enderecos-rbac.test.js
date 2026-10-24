import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);

async function loadForm(relativePath, { canEditCliente = true } = {}) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const state = { errors: [], changes: [] };
  const buttons = [];
  const module = { exports: {} };
  const ui = new Proxy({}, {
    get: (_t, key) => (props) => {
      if (key === 'Button') buttons.push(props);
      if (key === 'Input' || key === 'Label' || key === 'Badge') {
        return React.createElement(key === 'Input' ? 'input' : 'div', props, props.children);
      }
      if (key === 'Dialog' || key === 'DialogContent' || key === 'DialogHeader' || key === 'DialogTitle') {
        return React.createElement('div', null, props.children);
      }
      if (key === 'Select' || key === 'SelectTrigger' || key === 'SelectValue' || key === 'SelectContent' || key === 'SelectItem') {
        return React.createElement('div', null, props.children);
      }
      return React.createElement('div', null, props.children);
    },
  });
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (path) => {
      if (path === 'react') return require(path);
      if (path === 'sonner') return { toast: { error: (msg) => state.errors.push(msg), success: () => {} } };
      if (path.includes('usePermissions')) {
        return {
          __esModule: true,
          default: () => ({
            canEdit: (moduleName, section) => {
              if (moduleName !== 'Cadastros') return false;
              if (section === 'Cliente' || section == null) return canEditCliente;
              return false;
            },
          }),
        };
      }
      if (path.includes('BuscaCEP')) return { __esModule: true, default: () => null };
      if (path.includes('react-router')) return { Link: (props) => React.createElement('a', props, props.children) };
      if (path.includes('@/utils') || path.endsWith('/utils')) return { createPageUrl: (p) => `/${p}` };
      if (path.includes('lucide-react')) {
        return new Proxy({}, { get: () => () => null });
      }
      return ui;
    },
  });
  return { Form: module.exports.default, state, buttons };
}

test('contatos: sem permissão não muta e botões ficam desabilitados', async () => {
  const { Form, state, buttons } = await loadForm('../src/components/cadastros/GerenciarContatosClienteForm.jsx', {
    canEditCliente: false,
  });
  const contatos = [{ nome: 'A', tipo: 'Telefone', valor: '11', principal: true }];
  renderToStaticMarkup(React.createElement(Form, {
    contatos,
    onChange: (next) => state.changes.push(next),
  }));
  const add = buttons.find((b) => String(b['data-action'] || '').includes('contato.adicionar'));
  const edit = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.contato.editar');
  const del = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.contato.excluir');
  assert.ok(add?.disabled, 'adicionar deve desabilitar sem editar');
  assert.ok(edit?.disabled, 'editar deve desabilitar sem editar');
  assert.ok(del?.disabled, 'excluir deve desabilitar sem editar');
  del.onClick();
  assert.equal(state.changes.length, 0);
  assert.ok(state.errors.some((e) => /permiss/i.test(e)));
});

test('contatos: com permissão exclui e propaga onChange', async () => {
  const { Form, state, buttons } = await loadForm('../src/components/cadastros/GerenciarContatosClienteForm.jsx', {
    canEditCliente: true,
  });
  const contatos = [
    { nome: 'A', tipo: 'Telefone', valor: '11', principal: true },
    { nome: 'B', tipo: 'E-mail', valor: 'b@x.com', principal: false },
  ];
  renderToStaticMarkup(React.createElement(Form, {
    contatos,
    onChange: (next) => state.changes.push(next),
  }));
  const del = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.contato.excluir');
  assert.equal(del?.disabled, false);
  del.onClick();
  assert.equal(state.changes.length, 1);
  assert.equal(state.changes[0].length, 1);
  assert.equal(state.changes[0][0].nome, 'B');
});

test('enderecos: sem permissão não muta', async () => {
  const { Form, state, buttons } = await loadForm('../src/components/cadastros/GerenciarEnderecosClienteForm.jsx', {
    canEditCliente: false,
  });
  const enderecos = [{ apelido: 'Obra', logradouro: 'Rua A', numero: '1', cidade: 'SP', estado: 'SP' }];
  renderToStaticMarkup(React.createElement(Form, {
    enderecos,
    onChange: (next) => state.changes.push(next),
  }));
  const del = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.endereco.excluir');
  assert.ok(del?.disabled);
  del.onClick();
  assert.equal(state.changes.length, 0);
  assert.ok(state.errors.some((e) => /permiss/i.test(e)));
});

test('fonte: contatos/endereços usam usePermissions e toast fail-closed', async () => {
  for (const file of [
    '../src/components/cadastros/GerenciarContatosClienteForm.jsx',
    '../src/components/cadastros/GerenciarEnderecosClienteForm.jsx',
  ]) {
    const src = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(src, /usePermissions/);
    assert.match(src, /canEdit\("Cadastros", "Cliente"\)/);
    assert.match(src, /toast\.error/);
    assert.doesNotMatch(src, /\balert\(/);
    assert.match(src, /data-permission="Cadastros\.Cliente\.editar"/);
  }
});
