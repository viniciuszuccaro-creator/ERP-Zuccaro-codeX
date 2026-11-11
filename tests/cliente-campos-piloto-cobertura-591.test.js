/**
 * #591 — cobertura UI dos campos MASTER vs lacunas do piloto100.
 * Matriz privada dos 14 campos extras (Codex ae4c6aa2): nomes não no GitHub;
 * UI cobre ALLOWED_KEYS + classificação omit/não-carregado/quarentena/BFF.
 * Sem PII / sem inventar registros.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { toClienteMasterHttpPayload } from '../src/api/clienteHttpPayload.js';

const completo = readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
const tab = readFileSync('src/components/comercial/ClientesTab.jsx', 'utf8');
const bloco = readFileSync('src/components/cadastros/blocks/Bloco1Pessoas.jsx', 'utf8');

function actualClienteFormPayload() {
  const source = completo;
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

test('Completo expõe nome_social, escalares e procedência (≠ só nome/documento)', () => {
  assert.match(completo, /data-campo="nome_social"/);
  assert.match(completo, /data-campo="email"/);
  assert.match(completo, /data-campo="telefone"/);
  assert.match(completo, /data-campo="celular"/);
  assert.match(completo, /data-campo="inscricao_estadual"/);
  assert.match(completo, /data-campo="inscricao_municipal"/);
  assert.match(completo, /data-campo="observacoes"/);
  assert.match(completo, /data-fonte="cliente-procedencia"/);
  assert.match(completo, /data-campo="codigo_legado"/);
  assert.match(completo, /Celular ≠ WhatsApp/);
  assert.match(completo, /Omit ≠ limpar|omitir ≠ limpar|Omitir no save ≠ limpar/i);
  assert.match(completo, /Não recuperado nesta carga/);
});

test('Listagem Cliente inclui fantasia/IE/origem além de nome', () => {
  assert.match(tab, /nome_fantasia/);
  assert.match(tab, /inscricao_estadual/);
  assert.match(tab, /origem/);
  assert.match(bloco, /nome_fantasia/);
  assert.match(bloco, /inscricao_estadual/);
  assert.match(bloco, /origem/);
});

test('buildPayload: IE/e-mail/obs não carregados são omitidos (≠ "")', () => {
  const { mapToForm, buildPayload } = actualClienteFormPayload();
  const draft = mapToForm({
    id: 'synthetic-cli-rich',
    tipo: 'Pessoa Jurídica',
    documento: '11.222.333/0001-81',
    razao_social: 'SYNTHETIC LTDA',
    nome: 'SYNTHETIC LTDA',
    // sem IE / email / observacoes na carga
  });
  assert.equal(Object.hasOwn(draft, 'inscricao_estadual'), false);
  assert.equal(Object.hasOwn(draft, 'email'), false);
  const ui = buildPayload(draft);
  assert.equal(Object.hasOwn(ui, 'inscricao_estadual'), false);
  assert.equal(Object.hasOwn(ui, 'email'), false);
  assert.equal(Object.hasOwn(ui, 'observacoes'), false);
  const wire = toClienteMasterHttpPayload(ui);
  assert.equal(Object.hasOwn(wire, 'inscricao_estadual'), false);
  assert.equal(Object.hasOwn(wire, 'email'), false);
  assert.equal(wire.nome || wire.razao_social, 'SYNTHETIC LTDA');
});

test('buildPayload: valores carregados de IE/e-mail/nome_social preservados no fio', () => {
  const { mapToForm, buildPayload } = actualClienteFormPayload();
  const draft = mapToForm({
    id: 'synthetic-cli-ie',
    tipo: 'Pessoa Jurídica',
    documento: '11.222.333/0001-81',
    razao_social: 'SYNTHETIC LTDA',
    nome: 'SYNTHETIC LTDA',
    nome_social: 'SYNTHETIC SOCIAL',
    inscricao_estadual: '012345678',
    email: 'kept@example.test',
    observacoes: 'nota importada',
    origem: 'MIGRACAO',
    codigo_legado: 'LEG-9',
  });
  const ui = buildPayload(draft);
  assert.equal(ui.inscricao_estadual, '012345678');
  assert.equal(ui.email, 'kept@example.test');
  assert.equal(ui.nome_social, 'SYNTHETIC SOCIAL');
  assert.equal(ui.origem, 'MIGRACAO');
  const wire = toClienteMasterHttpPayload(ui);
  assert.equal(wire.inscricao_estadual, '012345678');
  assert.equal(wire.email, 'kept@example.test');
  assert.equal(wire.nome_social, 'SYNTHETIC SOCIAL');
  assert.equal(wire.origem, 'MIGRACAO');
});

test('RG significativo continua fail-closed no HTTP (ainda não incorporado no BFF)', () => {
  const { buildPayload } = actualClienteFormPayload();
  const ui = buildPayload({
    id: 'synthetic-cli-rg',
    nome: 'SYNTHETIC',
    tipo: 'Pessoa Física',
    rg: '12.345.678-9',
  });
  assert.throws(
    () => toClienteMasterHttpPayload(ui),
    (err) => err?.code === 'CLIENTE_HTTP_UNSUPPORTED_FIELDS' && Array.isArray(err.fields) && err.fields.includes('rg'),
  );
});
