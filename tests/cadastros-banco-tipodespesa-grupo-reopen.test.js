/**
 * Aceite #462 sobre tip composição: reopen canônico = useCadastroReopenOnIdentity/boundId
 * (≠ useCadastroRecordState da origem) + sky + ID técnico. Sem prevIdRef / count+1.
 * Cadastro Banco = mestre financeiro ≠ infraestrutura de banco de dados.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

for (const [label, file, bound] of [
  ['BancoForm', 'src/components/cadastros/BancoForm.jsx', 'bancoBoundId'],
  ['TipoDespesaForm', 'src/components/cadastros/TipoDespesaForm.jsx', 'tipoDespesaBoundId'],
  ['GrupoProdutoForm', 'src/components/cadastros/GrupoProdutoForm.jsx', 'grupoProdutoBoundId'],
]) {
  test(`${label}: reopen boundId + sky + ID técnico (#462 aceite)`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /useCadastroReopenOnIdentity/);
    assert.match(source, new RegExp(bound));
    assert.match(source, /from-sky-50/);
    assert.match(source, /to-sky-100/);
    assert.match(source, /ID técnico/);
    assert.doesNotMatch(source, /prevIdRef/);
    assert.doesNotMatch(source, /count\s*\+\s*1/);
    // Não regressar para o hook legado do tip #462 — boundId é o canônico atual.
    assert.doesNotMatch(source, /useCadastroRecordState/);
  });
}

test('Home reusa Dashboard canônico (placeholder desconectado)', () => {
  const home = fs.readFileSync('src/pages/Home.jsx', 'utf8');
  assert.match(home, /from ['"]\.\/Dashboard['"]/);
  assert.match(home, /<Dashboard/);
  assert.doesNotMatch(home, /Placeholder file/);
});

test('GrupoProduto HTTP form mirrors separate backend permissions and ignores legacy fallbacks', () => {
  const source = fs.readFileSync('src/components/cadastros/GrupoProdutoForm.jsx', 'utf8');
  const code = transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
  const record = { id: 'synthetic-group', nome_grupo: 'Synthetic', natureza: 'Revenda', ativo: true };
  const mount = ({ http = true, permissoes, loading = false, current = record } = {}) => {
    const actions = [];
    const submissions = [];
    let submit;
    const module = { exports: {} };
    const ui = new Proxy({}, { get: (_obj, key) => (props) => {
      if (props['data-action']) actions.push(props);
      return React.createElement('div', null, key === 'Input' ? null : props.children);
    } });
    const react = {
      ...React,
      createElement(type, props, ...children) {
        if (type === 'form') submit = props.onSubmit;
        return React.createElement(type, props, ...children);
      },
    };
    runInNewContext(code, {
      module, exports: module.exports, alert: () => {},
      window: { confirm: () => true },
      require(path) {
        if (path === 'react') return react;
        if (path.includes('base44Client')) return { isHttpBackendMode: http };
        if (path.includes('usePermissions')) return { default: () => ({
          hasPermission: (key) => key.startsWith('Cadastros.Produto.'), isLoading: loading, user: { permissoes },
        }), __esModule: true };
        if (path.includes('useContextoVisual')) return { useContextoVisual: () => ({ grupoAtual: { id: 'synthetic-scope' } }) };
        if (path.includes('useCadastroReopenOnIdentity')) return { default: (initial) => ({ boundId: initial?.id }), __esModule: true };
        if (path.includes('CadastroCodigoRegistroField')) return { default: () => null, __esModule: true };
        if (path === 'lucide-react') return new Proxy({}, { get: () => () => null });
        return ui;
      },
    });
    renderToStaticMarkup(React.createElement(module.exports.default, { item: current, onSubmit: (value) => submissions.push(value) }));
    return { action: (id) => actions.find((a) => a['data-action'] === id), submit, submissions };
  };
  const save = 'salvar-grupo-produto';
  const archive = 'excluir-grupo-produto';
  const status = 'alternar-status-grupo-produto';
  for (const permissoes of [{ Cadastros: { produto: ['editar','inativar'] } }, { '*': ['editar','inativar'] },
    { Cadastros: { grupo_produto: ['visualizar'] } }]) {
    const m = mount({ permissoes });
    for (const key of [save, archive, status]) assert.equal(m.action(key).disabled, true);
    m.submit({ preventDefault() {} });
    m.action(archive).onClick();
    assert.equal(m.submissions.length, 0);
  }
  const editor = mount({ permissoes: { Cadastros: { grupo_produto: ['editar'] } } });
  assert.equal(editor.action(save).disabled, false);
  assert.equal(editor.action(status).disabled, false);
  assert.equal(editor.action(archive).disabled, true);
  editor.submit({ preventDefault() {} });
  assert.equal(editor.submissions[0].id, record.id);
  const archiver = mount({ permissoes: { Cadastros: { grupo_produto: ['inativar'] } } });
  assert.equal(archiver.action(save).disabled, true);
  assert.equal(archiver.action(archive)['data-permission'], 'Cadastros.grupo_produto.inativar');
  assert.equal(archiver.action(archive).disabled, false);
  archiver.action(archive).onClick();
  assert.equal(archiver.submissions[0]._action, 'delete');
  assert.equal(archiver.submissions[0].id, record.id);
  const pending = mount({ loading: true, permissoes: { Cadastros: { grupo_produto: ['editar'] } } });
  assert.equal(pending.action(save).disabled, true);
  const creator = mount({ current: null, permissoes: { Cadastros: { grupo_produto: ['criar'] } } });
  assert.equal(creator.action(save).disabled, false);
  assert.equal(creator.action(status).disabled, true);
  assert.equal(mount({ http: false }).action(save).disabled, false);
});
