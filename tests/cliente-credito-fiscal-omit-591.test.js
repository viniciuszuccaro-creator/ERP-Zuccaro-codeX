/**
 * #591 — reabertura Cliente: ausência comercial/fiscal ≠ inventar OK/Simples.
 * Omit no save ≠ wipe. Sem dados reais.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { toClienteMasterHttpPayload } from '../src/api/clienteHttpPayload.js';

function actualClienteFormPayload() {
  const source = readFileSync(new URL('../src/components/cadastros/CadastroClienteCompleto.jsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('form.jsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let payload;
  let mapper;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'buildPayload') {
      payload = node.initializer.getText(tree);
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useCadastroReopenOnIdentity') {
      mapper = node.arguments[1].properties.find((p) => p.name?.getText(tree) === 'mapToForm')?.initializer?.getText(tree);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(payload && mapper);
  const helpers = source.slice(source.indexOf('const sanitizeText ='), source.indexOf('export default function'));
  return vm.runInNewContext(`${helpers}; ({ buildPayload: ${payload}, mapToForm: ${mapper} })`, {
    empresaAtual: { id: 'synthetic-company' },
    groupId: 'synthetic-group',
    calcularSituacaoCredito: () => 'OK',
  });
}

test('mapToForm: HTTP sem condicao/fiscal omite — não inventa OK nem Simples Nacional', () => {
  const { mapToForm, buildPayload } = actualClienteFormPayload();
  const draft = mapToForm({
    id: 'synthetic-cli',
    tipo: 'Pessoa Jurídica',
    documento: '11.222.333/0001-81',
    razao_social: 'SYNTHETIC LTDA',
    email: 'kept@example.test',
    observacoes: 'importado',
  });
  assert.equal(Object.hasOwn(draft, 'condicao_comercial'), false);
  assert.equal(Object.hasOwn(draft, 'configuracao_fiscal'), false);
  assert.equal(Object.hasOwn(draft, 'contatos'), false);
  const ui = buildPayload({ ...draft, nome: 'SYNTHETIC LTDA' });
  assert.equal(Object.hasOwn(ui, 'condicao_comercial'), false);
  assert.equal(Object.hasOwn(ui, 'configuracao_fiscal'), false);
  const wire = toClienteMasterHttpPayload(ui);
  assert.equal(wire.email, 'kept@example.test');
  assert.equal(wire.observacoes, 'importado');
  assert.equal(Object.hasOwn(wire, 'condicao_comercial'), false);
});

test('mapToForm: bloco comercial presente (mesmo vazio) é preservado; save não inventa outro', () => {
  const { mapToForm, buildPayload } = actualClienteFormPayload();
  const draft = mapToForm({
    id: 'synthetic-cli-2',
    nome: 'SYNTHETIC',
    condicao_comercial: { limite_credito: 1500, situacao_credito: 'Alerta' },
    configuracao_fiscal: { regime_tributario: 'Lucro Real' },
  });
  assert.equal(draft.condicao_comercial.limite_credito, 1500);
  assert.equal(draft.configuracao_fiscal.regime_tributario, 'Lucro Real');
  const ui = buildPayload(draft);
  assert.equal(ui.condicao_comercial.limite_credito, 1500);
  assert.equal(ui.configuracao_fiscal.regime_tributario, 'Lucro Real');
});

test('UI Completo: banner parcial cobre crédito/fiscal; Desconhecido ≠ OK inventado', () => {
  const src = readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
  assert.match(src, /condicao_comercial === undefined \? "condição comercial\/crédito"/);
  assert.match(src, /configuracao_fiscal === undefined \? "configuração fiscal"/);
  assert.match(src, /return 'Desconhecido'/);
  assert.match(src, /data-credito-estado/);
  assert.match(src, /data-fiscal-carregado/);
  assert.doesNotMatch(
    src,
    /condicao_comercial: record\.condicao_comercial \|\| \{\s*tabela_preco_id/,
  );
});
