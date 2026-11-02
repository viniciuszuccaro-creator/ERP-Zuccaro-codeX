/**
 * Unificação overlaps: CadastroClienteCompleto é o runtime canônico.
 * comercial/ClienteForm* permanecem (não apagar) mas sem consumidores de montagem.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

const consumers = [
  'src/components/comercial/ClientesTab.jsx',
  'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx',
  'src/components/AcoesRapidasGlobal.jsx',
  'src/components/cadastros/PainelDinamicoCliente.jsx',
  'src/components/cadastros/blocks/Bloco1Pessoas.jsx',
];

test('consumidores runtime montam CadastroClienteCompleto (não comercial/ClienteForm*)', () => {
  for (const path of consumers) {
    const source = read(path);
    assert.match(source, /CadastroClienteCompleto/, `${path} deve importar/usar CadastroClienteCompleto`);
    assert.doesNotMatch(
      source,
      /from ["']@\/components\/comercial\/ClienteFormCompleto["']/,
      `${path} não deve montar ClienteFormCompleto`,
    );
    assert.doesNotMatch(
      source,
      /from ["']@\/components\/comercial\/ClienteForm["']/,
      `${path} não deve montar ClienteForm simples`,
    );
  }
});

test('comercial/ClienteForm* marcados não-canônicos e preservados', () => {
  const completo = read('src/components/comercial/ClienteFormCompleto.jsx');
  const simples = read('src/components/comercial/ClienteForm.jsx');
  assert.match(completo, /NÃO-CANÔNICO/);
  assert.match(completo, /CadastroClienteCompleto/);
  assert.match(simples, /NÃO-CANÔNICO/);
  assert.match(simples, /CadastroClienteCompleto/);
  assert.match(completo, /export default/);
  assert.match(simples, /export default/);
});

const representanteConsumers = [
  'src/components/cadastros/RepresentantesTab.jsx',
  'src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx',
  'src/components/cadastros/blocks/Bloco1Pessoas.jsx',
];

test('Representante: Completo canônico; Form simples não montado', () => {
  for (const path of representanteConsumers) {
    const source = read(path);
    assert.match(source, /RepresentanteFormCompleto/, path);
    assert.doesNotMatch(source, /from ["']\.\/RepresentanteForm["']/, path);
    assert.doesNotMatch(source, /from ["']@\/components\/cadastros\/RepresentanteForm["']/, path);
  }
  const simples = read('src/components/cadastros/RepresentanteForm.jsx');
  assert.match(simples, /NÃO-CANÔNICO/);
  assert.match(simples, /RepresentanteFormCompleto/);
});

const tabelaConsumers = [
  'src/components/cadastros/blocks/Bloco2Produtos.jsx',
  'src/components/AcoesRapidasGlobal.jsx',
];

test('TabelaPreco: Completo canônico; Form simples não montado nas ações', () => {
  for (const path of tabelaConsumers) {
    const source = read(path);
    assert.match(source, /TabelaPrecoFormCompleto/, path);
    assert.doesNotMatch(source, /from ["']@\/components\/cadastros\/TabelaPrecoForm["']/, path);
  }
  const simples = read('src/components/cadastros/TabelaPrecoForm.jsx');
  assert.match(simples, /NÃO-CANÔNICO|não montar/i);
  assert.match(simples, /TabelaPrecoFormCompleto/);
});

const formaConsumers = [
  'src/components/cadastros/blocks/Bloco3Financeiro.jsx',
  'src/components/cadastros/GestorFormasPagamento.jsx',
];

test('FormaPagamento: Completo canônico; Form simples não montado', () => {
  for (const path of formaConsumers) {
    const source = read(path);
    assert.match(source, /FormaPagamentoFormCompleto/, path);
    assert.doesNotMatch(source, /from ["']@\/components\/cadastros\/FormaPagamentoForm["']/, path);
    assert.doesNotMatch(source, /from ["']\.\/FormaPagamentoForm["']/, path);
  }
  const simples = read('src/components/cadastros/FormaPagamentoForm.jsx');
  assert.match(simples, /NÃO-CANÔNICO/);
  assert.match(simples, /FormaPagamentoFormCompleto/);
});

test('Pedido: Comercial monta PedidoFormCompleto; Form simples NÃO-CANÔNICO', () => {
  const comercial = read('src/pages/Comercial.jsx');
  assert.match(comercial, /PedidoFormCompleto/);
  assert.doesNotMatch(comercial, /from ["'].*\/PedidoForm["']/);
  assert.doesNotMatch(comercial, /openWindow\(\s*PedidoForm\b/);
  const simples = read('src/components/comercial/PedidoForm.jsx');
  assert.match(simples, /NÃO-CANÔNICO/);
  assert.match(simples, /PedidoFormCompleto/);
});
