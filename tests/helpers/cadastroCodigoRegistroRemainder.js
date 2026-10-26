import assert from 'node:assert/strict';
import ts from 'typescript';

/**
 * Delta autorizado (#353): CadastroCodigoRegistroField em forms que o freeze
 * e36231b3 ainda não tinha. Remainder remove import+JSX para comparar o restante
 * byte-idêntico ao pin — não mascara outras mudanças de payload/handlers.
 */
const AUTHORIZED = new Set([
  'src/components/cadastros/TabelaPrecoForm.jsx',
  'src/components/cadastros/TabelaPrecoFormCompleto.jsx',
  'src/components/cadastros/RotaPadraoForm.jsx',
]);

export function cadastroCodigoRegistroRemainder(file, source) {
  if (!AUTHORIZED.has(file)) return source;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  assert.equal(tree.parseDiagnostics.length, 0);
  const edits = [];
  let imports = 0;
  let elements = 0;
  for (const node of tree.statements) {
    if (ts.isImportDeclaration(node)
      && node.moduleSpecifier?.text === '@/components/cadastros/CadastroCodigoRegistroField') {
      imports += 1;
      edits.push({ start: node.getStart(tree), end: node.end, text: '' });
    }
  }
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node)
      && node.tagName.getText(tree) === 'CadastroCodigoRegistroField') {
      elements += 1;
      edits.push({ start: node.getStart(tree), end: node.end, text: '' });
    }
    if (ts.isJsxElement(node)
      && node.openingElement.tagName.getText(tree) === 'CadastroCodigoRegistroField') {
      elements += 1;
      edits.push({ start: node.getStart(tree), end: node.end, text: '' });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.equal(imports, 1, `${file}: import CadastroCodigoRegistroField`);
  assert.equal(elements, 1, `${file}: um CadastroCodigoRegistroField`);
  let next = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
  }
  return next;
}
