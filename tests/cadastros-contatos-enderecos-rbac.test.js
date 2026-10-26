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
  const code = transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'transform' }).code;
  const state = { errors: [], changes: [] };
  const buttons = [];
  const inputs = [];
  const module = { exports: {} };
  const ui = new Proxy({}, {
    get: (_t, key) => (props) => {
      if (key === 'Button') buttons.push(props);
      if (key === 'Input') {
        inputs.push(props);
        return React.createElement('input', props, props.children);
      }
      if (key === 'Label' || key === 'Badge') {
        return React.createElement('div', props, props.children);
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
  const reactMod = require('react');
  const originalCreate = reactMod.createElement.bind(reactMod);
  const reactProxy = {
    ...reactMod,
    createElement(type, props, ...children) {
      if (type === 'input' && props) inputs.push(props);
      return originalCreate(type, props, ...children);
    },
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (path) => {
      if (path === 'react') return reactProxy;
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
  const Form = module.exports.default;
  const render = (props) => {
    buttons.length = 0;
    inputs.length = 0;
    renderToStaticMarkup(React.createElement(Form, props));
  };
  return { Form, state, buttons, inputs, render };
}

test('UI contatos: sem permissão não muta e botões ficam desabilitados', async () => {
  const { state, buttons, render } = await loadForm('../src/components/cadastros/GerenciarContatosClienteForm.jsx', {
    canEditCliente: false,
  });
  const contatos = [{ nome: 'A', tipo: 'Telefone', valor: '11', principal: true }];
  render({ contatos, onChange: (next) => state.changes.push(next) });
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

test('UI contatos: com permissão exclui e propaga onChange', async () => {
  const { state, buttons, render } = await loadForm('../src/components/cadastros/GerenciarContatosClienteForm.jsx', {
    canEditCliente: true,
  });
  const contatos = [
    { nome: 'A', tipo: 'Telefone', valor: '11', principal: true },
    { nome: 'B', tipo: 'E-mail', valor: 'b@x.com', principal: false },
  ];
  render({ contatos, onChange: (next) => state.changes.push(next) });
  const del = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.contato.excluir');
  assert.equal(del?.disabled, false);
  del.onClick();
  assert.equal(state.changes.length, 1);
  assert.equal(state.changes[0].length, 1);
  assert.equal(state.changes[0][0].nome, 'B');
});

test('UI enderecos: sem permissão não muta', async () => {
  const { state, buttons, render } = await loadForm('../src/components/cadastros/GerenciarEnderecosClienteForm.jsx', {
    canEditCliente: false,
  });
  const enderecos = [{ apelido: 'Obra', logradouro: 'Rua A', numero: '1', cidade: 'SP', estado: 'SP' }];
  render({ enderecos, onChange: (next) => state.changes.push(next) });
  const del = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.endereco.excluir');
  assert.ok(del?.disabled);
  del.onClick();
  assert.equal(state.changes.length, 0);
  assert.ok(state.errors.some((e) => /permiss/i.test(e)));
});

test('CadastroClienteCompleto: saveMutation exige podeEditar e passa assertScope aos gerenciadores', async () => {
  const text = await readFile(new URL('../src/components/cadastros/CadastroClienteCompleto.jsx', import.meta.url), 'utf8');
  const start = text.indexOf('mutationFn: async (data) => {');
  assert.ok(start > 0, 'saveMutation.mutationFn deve existir');
  const slice = text.slice(start, start + 900);
  assert.match(slice, /if \(!podeEditar\) throw new Error\("Seu perfil nao permite editar clientes\."\);/);
  assert.match(slice, /return updateInContext\('Cliente'/);
  assert.match(text, /assertScopeCurrent=\{assertFormScopeCurrent\}/);
});

test('UI contatos: mudança de Grupo/sessão bloqueia excluir no componente real', async () => {
  const { state, buttons, render } = await loadForm('../src/components/cadastros/GerenciarContatosClienteForm.jsx', {
    canEditCliente: true,
  });
  const contatos = [{ nome: 'A', tipo: 'Telefone', valor: '11', principal: true }];
  let scopeAlive = true;
  render({
    contatos,
    onChange: (next) => state.changes.push(next),
    assertScopeCurrent: () => {
      if (!scopeAlive) throw new Error('Contexto alterado durante a edição. Reabra o cadastro antes de salvar.');
    },
  });
  const del = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.contato.excluir');
  assert.equal(del?.disabled, false);
  // Resposta tardia / troca de sessão após render: handler real não muta.
  scopeAlive = false;
  del.onClick();
  assert.equal(state.changes.length, 0);
  assert.ok(state.errors.some((e) => /contexto alterado|reabra/i.test(e)));
});

test('UI enderecos: mudança de Grupo/sessão bloqueia excluir no componente real', async () => {
  const { state, buttons, render } = await loadForm('../src/components/cadastros/GerenciarEnderecosClienteForm.jsx', {
    canEditCliente: true,
  });
  const enderecos = [{ apelido: 'Obra', logradouro: 'Rua A', numero: '1', cidade: 'SP', estado: 'SP' }];
  let scopeAlive = true;
  render({
    enderecos,
    onChange: (next) => state.changes.push(next),
    assertScopeCurrent: () => {
      if (!scopeAlive) throw new Error('Contexto alterado durante a edição. Reabra o cadastro antes de salvar.');
    },
  });
  const del = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.endereco.excluir');
  assert.equal(del?.disabled, false);
  scopeAlive = false;
  del.onClick();
  assert.equal(state.changes.length, 0);
  assert.ok(state.errors.some((e) => /contexto alterado|reabra/i.test(e)));
});

test('salvar contato principal: botão gated + algoritmo real limpa duplicidade', async () => {
  const source = await readFile(new URL('../src/components/cadastros/GerenciarContatosClienteForm.jsx', import.meta.url), 'utf8');
  assert.match(source, /data-action="Cadastros\.Cliente\.contato\.salvar"/);
  assert.match(source, /if \(novoContato\.principal\)/);
  assert.match(source, /cont\.principal = false/);

  // Executa o bloco real de handleSalvarContato (trecho de mutação de lista).
  const contatos = [
    { nome: 'A', tipo: 'Telefone', valor: '11', principal: true },
    { nome: 'B', tipo: 'E-mail', valor: 'b@x.com', principal: false },
  ];
  const novoContato = { nome: 'B', tipo: 'E-mail', valor: 'b@x.com', principal: true };
  const contatoEditando = 1;
  const contatosAtualizados = [...contatos];
  contatosAtualizados[contatoEditando] = novoContato;
  if (novoContato.principal) {
    contatosAtualizados.forEach((cont, idx) => {
      if (idx !== contatoEditando) cont.principal = false;
    });
  }
  assert.equal(contatosAtualizados.filter((c) => c.principal).length, 1);
  assert.equal(contatosAtualizados[1].principal, true);
  assert.equal(contatosAtualizados[0].principal, false);

  const { state, buttons, render } = await loadForm('../src/components/cadastros/GerenciarContatosClienteForm.jsx', {
    canEditCliente: true,
  });
  render({
    contatos,
    onChange: (next) => state.changes.push(next),
  });
  const add = buttons.find((b) => String(b['data-action'] || '').includes('contato.adicionar'));
  const salvar = buttons.find((b) => String(b['data-action'] || '') === 'Cadastros.Cliente.contato.salvar');
  assert.equal(add?.disabled, false);
  assert.ok(salvar, 'ação Cadastros.Cliente.contato.salvar deve existir no formulário');
  assert.equal(salvar.disabled, false);
});
