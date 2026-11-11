import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createComercialProposalFixture } from '../src/components/comercial/comercialProposalFixture.js';

async function mountAside(props) {
  const source = await readFile(new URL('../src/components/comercial/OrcamentoProposalAside.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const state = [];
  let slot = 0;
  const react = {
    createElement: (type, p, ...children) => ({ type, props: p || {}, children: children.flat(Infinity) }),
    useState(initial) {
      const i = slot++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
    },
  };
  const modules = {
    react: { __esModule: true, default: react, ...react },
    './centralCliente360Money': { formatCentral360Money: (value) => `R$ ${value}` },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/badge': { Badge: 'Badge' },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => modules[id] || { __esModule: true, default: id },
  });
  const render = () => {
    slot = 0;
    return exports.default(props);
  };
  return { render, state };
}

test('347 aside expõe painéis cliente/produtos/resumo/ações sem alegar dados recuperados', async () => {
  const fixture = createComercialProposalFixture();
  const h = await mountAside({
    cliente: fixture.clientes[0].razao_social,
    clienteCodigo: fixture.clientes[0].codigo,
    clienteIdTecnico: fixture.clientes[0].id,
    itens: [{
      produto_id: fixture.produtos[0].id,
      produto_codigo: fixture.produtos[0].codigo,
      descricao: fixture.produtos[0].descricao,
      preco_unitario: '10.00',
      unidade_sigla: 'UN',
    }],
    totals: { subtotal: '10', desconto: '0', total: '10' },
    condicao: '001 — Condição ilustrativa',
    tabela: 'Tabela ilustrativa',
    historicoIlustrativo: fixture.historicoIlustrativo,
    formasPagamentoIlustrativas: fixture.formasPagamentoIlustrativas,
  });
  let tree = h.render();
  const tabButtons = (node, acc = []) => {
    if (!node || typeof node !== 'object') return acc;
    if (node.type === 'Button' && String(node.props?.['data-action'] || '').startsWith('proposta-painel-')) acc.push(node);
    for (const child of node.children || []) tabButtons(child, acc);
    return acc;
  };
  const tabs = tabButtons(tree);
  assert.deepEqual(
    tabs.map((btn) => btn.props['data-action']),
    ['proposta-painel-cliente', 'proposta-painel-produtos', 'proposta-painel-resumo', 'proposta-painel-acoes'],
  );
  assert.match(JSON.stringify(tree), /DEMONSTRAÇÃO SINTÉTICA/);
  assert.match(JSON.stringify(tree), /000001/);
  assert.match(JSON.stringify(tree), /preview-cliente/);

  tabs.find((btn) => btn.props['data-action'] === 'proposta-painel-acoes').props.onClick();
  tree = h.render();
  assert.match(JSON.stringify(tree), /Ações próximas/);
  assert.match(JSON.stringify(tree), /Gravação bloqueada/);
  assert.match(JSON.stringify(tree), /proposta-capacidades/);
  assert.match(JSON.stringify(tree), /data-capacidade/);
  assert.ok(JSON.stringify(tree).includes('"disabled":true') || JSON.stringify(tree).includes('disabled": true'));
});

test('347 Voltar/Avançar só setPanel; clique repetido e teclado sem efeitos de negócio', async () => {
  const fixture = createComercialProposalFixture();
  const h = await mountAside({
    cliente: fixture.clientes[0].razao_social,
    clienteCodigo: fixture.clientes[0].codigo,
    clienteIdTecnico: fixture.clientes[0].id,
    itens: [],
    totals: { subtotal: '0', desconto: '0', total: '0' },
    condicao: '',
    tabela: '',
  });
  let tree = h.render();
  const findAction = (node, action, acc = []) => {
    if (!node || typeof node !== 'object') return acc;
    if (node.type === 'Button' && node.props?.['data-action'] === action) acc.push(node);
    for (const child of node.children || []) findAction(child, action, acc);
    return acc;
  };
  const findNav = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.props?.['aria-label'] === 'Navegação de painéis da proposta') return node;
    for (const child of node.children || []) {
      const hit = findNav(child);
      if (hit) return hit;
    }
    return null;
  };
  assert.equal(h.state[0], 'cliente');
  findAction(tree, 'proposta-avancar')[0].props.onClick();
  findAction(tree = h.render(), 'proposta-avancar')[0].props.onClick();
  assert.equal(h.state[0], 'resumo');
  findAction(tree = h.render(), 'proposta-voltar')[0].props.onClick();
  assert.equal(h.state[0], 'produtos');
  let nav = findNav(tree = h.render());
  assert.ok(nav?.props?.onKeyDown);
  nav.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} });
  assert.equal(h.state[0], 'resumo');
  nav = findNav(tree = h.render());
  nav.props.onKeyDown({ key: 'ArrowLeft', preventDefault() {} });
  assert.equal(h.state[0], 'produtos');
  // Limites: repetir no último/primeiro não salva nem avança além.
  h.state[0] = 'acoes';
  findAction(tree = h.render(), 'proposta-avancar')[0].props.onClick();
  findAction(tree = h.render(), 'proposta-avancar')[0].props.onClick();
  assert.equal(h.state[0], 'acoes');
  h.state[0] = 'cliente';
  findAction(tree = h.render(), 'proposta-voltar')[0].props.onClick();
  assert.equal(h.state[0], 'cliente');
});

test('347 fixture sintética não usa IDs/códigos de cadastro operacional', () => {
  const fixture = createComercialProposalFixture();
  for (const bucket of ['clientes', 'produtos', 'clientesEmpresa', 'condicoes', 'tabelas']) {
    for (const row of fixture[bucket]) {
      assert.match(String(row.id), /^preview-/);
    }
  }
});
