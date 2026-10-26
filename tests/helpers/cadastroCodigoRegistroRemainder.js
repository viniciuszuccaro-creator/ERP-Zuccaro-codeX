import assert from 'node:assert/strict';
import ts from 'typescript';

/**
 * Delta autorizado (#353): CadastroCodigoRegistroField em forms cujo freeze
 * e36231b3 ainda não tinha o campo. Remainder remove SOMENTE o import+JSX
 * exatamente pinados — recusa spread, children, atributos extras e expressões
 * que mutem rascunho (ex.: Object.assign) antes de normalizar.
 *
 * P1 6420465114: envelope frouxo aceitava `{...Object.assign(formData,...)}`
 * e produzia bytes idênticos ao pin após strip. Este helper fecha o envelope.
 */
const MODULE = '@/components/cadastros/CadastroCodigoRegistroField';

/** @type {Record<string, { action: string, attrs: string[] }>} */
const AUTHORIZED = {
  'src/components/cadastros/TabelaPrecoForm.jsx': {
    action: 'codigo-registro-tabela-preco',
    attrs: [
      'hasId={Boolean(dadosIniciais?.id)}',
      'entityId={dadosIniciais?.id}',
      'value={dadosIniciais?.codigo ?? formData.codigo}',
      'action="codigo-registro-tabela-preco"',
    ],
  },
  'src/components/cadastros/TabelaPrecoFormCompleto.jsx': {
    action: 'codigo-registro-tabela-preco',
    attrs: [
      'hasId={Boolean(tabela?.id)}',
      'entityId={tabela?.id}',
      'value={tabela?.codigo}',
      'action="codigo-registro-tabela-preco"',
    ],
  },
  'src/components/cadastros/RotaPadraoForm.jsx': {
    action: 'codigo-registro-rota-padrao',
    attrs: [
      'hasId={Boolean(dadosIniciais?.id)}',
      'entityId={dadosIniciais?.id}',
      'value={dadosIniciais?.codigo ?? formData.codigo}',
      'action="codigo-registro-rota-padrao"',
    ],
  },
};

function assertNoDraftMutation(exprText, file) {
  const compact = String(exprText).replace(/\s+/g, '');
  assert.equal(
    /Object\.assign|\.assign\(|Object\.defineProperty|eval\(|Function\(/.test(compact),
    false,
    `${file}: expressão do CodigoField não pode mutar rascunho (${exprText})`,
  );
}

function assertAuthorizedImport(node, tree, file) {
  assert.ok(node.importClause, `${file}: import CodigoField sem clause`);
  assert.equal(node.importClause.isTypeOnly, false, `${file}: import CodigoField não é type-only`);
  assert.equal(node.importClause.name?.getText(tree), 'CadastroCodigoRegistroField', `${file}: default import`);
  assert.equal(node.importClause.namedBindings, undefined, `${file}: sem named bindings no import CodigoField`);
  assert.equal(node.moduleSpecifier.text, MODULE, `${file}: módulo CodigoField`);
}

function assertAuthorizedJsx(node, tree, file, expectedAttrs) {
  assert.ok(ts.isJsxSelfClosingElement(node), `${file}: CodigoField deve ser self-closing (sem children)`);
  assert.equal(node.tagName.getText(tree), 'CadastroCodigoRegistroField');
  const attrs = node.attributes.properties;
  // Spreads e mutações antes do pin de comprimento — evita mascarar Object.assign como "5!==4".
  for (let i = 0; i < attrs.length; i += 1) {
    const attr = attrs[i];
    if (ts.isJsxSpreadAttribute(attr)) {
      const expr = attr.expression?.getText(tree) ?? attr.getText(tree);
      assertNoDraftMutation(expr, file);
      assert.fail(`${file}: attr[${i}] não pode ser spread (${expr})`);
    }
    assert.ok(ts.isJsxAttribute(attr), `${file}: attr[${i}] não pode ser spread`);
    if (attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
      assertNoDraftMutation(attr.initializer.expression.getText(tree), file);
    }
  }
  assert.equal(attrs.length, expectedAttrs.length, `${file}: attrs CodigoField`);
  for (let i = 0; i < attrs.length; i += 1) {
    const attr = attrs[i];
    assert.equal(attr.getText(tree), expectedAttrs[i], `${file}: attr[${i}] pin`);
  }
}

export function cadastroCodigoRegistroRemainder(file, source) {
  const spec = AUTHORIZED[file];
  if (!spec) return source;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  assert.equal(tree.parseDiagnostics.length, 0, `${file}: parse CodigoField remainder`);
  const edits = [];
  const imports = [];
  const elements = [];

  for (const node of tree.statements) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier?.text === MODULE) {
      assertAuthorizedImport(node, tree, file);
      imports.push(node);
      edits.push({ start: node.getStart(tree), end: node.end, text: '' });
    }
  }

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'CadastroCodigoRegistroField') {
      assertAuthorizedJsx(node, tree, file, spec.attrs);
      elements.push(node);
      edits.push({ start: node.getStart(tree), end: node.end, text: '' });
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'CadastroCodigoRegistroField') {
      assert.fail(`${file}: CodigoField com children não é delta autorizado`);
    }
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(tree) === 'CadastroCodigoRegistroField') {
      for (const attr of node.attributes.properties) {
        assert.ok(ts.isJsxAttribute(attr), `${file}: spread em CodigoField rejeitado`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);

  assert.equal(imports.length, 1, `${file}: exatamente um import CadastroCodigoRegistroField`);
  assert.equal(elements.length, 1, `${file}: exatamente um CadastroCodigoRegistroField`);

  let next = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  }
  return next;
}

export const CADASTRO_CODIGO_REGISTRO_AUTHORIZED_FILES = Object.freeze(Object.keys(AUTHORIZED));
