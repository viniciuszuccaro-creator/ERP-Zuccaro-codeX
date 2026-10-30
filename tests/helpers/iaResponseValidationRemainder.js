import assert from 'node:assert/strict';
import ts from 'typescript';
import {partialInputRemainder} from './partialInputRemainder.js';
import {cadastroCodigoRegistroRemainder} from './cadastroCodigoRegistroRemainder.js';

const entries = {
  'src/components/comercial/CorteDobraIATab.jsx': ['validarPosicoesCorteDobraIA'],
  'src/components/site/OrcamentoAutomaticoIA.jsx': ['validarOrcamentoProjetoIA'],
  'src/components/cadastros/TabelaPrecoFormCompleto.jsx': ['validarPrecificacaoTabelaIA', 'amostra'],
  'src/components/cadastros/ConversaoProducaoMassa.jsx': ['validarSelecaoProducaoIA', 'Math.min(produtosConversiveis.length, 20)'],
  'src/components/chatbot/SugestoesIA.jsx': ['validarSugestoesAtendimentoIA'],
  'src/components/cadastros/ProdutoFormV22_Completo.jsx': ['validarClassificacaoProdutoIA'],
  'src/components/crm/FunilComercialInteligente.jsx': ['validarPrioridadesOportunidadesIA', 'oportunidades'],
  'src/components/producao/FormularioOrdemProducao.jsx': ['validarPlanoProducaoIA'],
  'src/components/compras/SolicitacoesCompraTab.jsx': ['validarSugestoesCompraIA', 'produtosBaixos'],
  'src/components/estoque/ImportadorProdutosPlanilha.jsx': ['validarSugestoesNcmIA', 'itens'],
  'src/components/expedicao/RoteirizacaoInteligente.jsx': ['validarRoteirizacaoEntregaIA', 'entregasSelecionadas'],
  'src/components/expedicao/SeparacaoConferenciaIA.jsx': ['validarRotaPickingIA', 'itens.map(i => ({ produto: sanitizeText(i.produto_descricao || i.descricao), localizacao: sanitizeText(i.localizacao || "Nao definida") }))'],
};

export function iaResponseValidationRemainder(file, source) {
  const entry = entries[file]; if (!entry) return source;
  source=partialInputRemainder(file,source);
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  assert.equal(tree.parseDiagnostics.length, 0);
  const edits = [], imports = [], calls = [];
  for (const node of tree.statements) if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === '@/components/lib/iaResponsePolicy') {
    assert.equal(node.importClause.name, undefined);
    assert.equal(node.importClause.namedBindings.elements.length, 1);
    assert.equal(node.importClause.namedBindings.elements[0].getText(tree), entry[0]); imports.push(node);
  }
  assert.equal(imports.length, 1);
  edits.push({start: imports[0].getStart(tree), end: imports[0].end, text: ''});
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === entry[0]) {
      assert.equal(node.arguments.length, entry[1] ? 2 : 1);
      assert.ok(ts.isAwaitExpression(node.arguments[0]));
      const invoke = node.arguments[0].expression;
      assert.ok(ts.isCallExpression(invoke)); assert.equal(invoke.expression.getText(tree), 'base44.integrations.Core.InvokeLLM');
      assert.equal(invoke.arguments.length, 1); assert.ok(ts.isObjectLiteralExpression(invoke.arguments[0]));
      if (entry[1]) assert.equal(node.arguments[1].getText(tree), entry[1]);
      calls.push(node); edits.push({start: node.getStart(tree), end: node.end, text: node.arguments[0].getText(tree)});
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.equal(calls.length, 1);
  for (const edit of edits.sort((a,b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  if (file.endsWith('TabelaPrecoFormCompleto.jsx')) {
    const added = /        produto_id: i\.produto_id,\r?\n/g;
    assert.equal([...source.matchAll(added)].length, 1); source = source.replace(added, '');
  }
  if (file.endsWith('RoteirizacaoInteligente.jsx')) {
    const added = /^  entrega_id: e\.id,\r?\n/gm;
    assert.equal([...source.matchAll(added)].length, 1); source = source.replace(added, '');
    const literal = '.map((id) => entregasSelecionadas.find((e) => e.id === id))';
    assert.equal(source.split(literal).length, 2);
    source = source.replace(literal, '.map((id) => entregasSelecionadas.find((e) => String(e.id) === String(id)))');
  }
  // #353 classe A: CodigoField em TabelaPreco — pin IA permanece após strip autorizado.
  source = cadastroCodigoRegistroRemainder(file, source);
  // #447 keep-both: chrome sky windowMode no Produto V22 — peela para golden simples
  // (pin stage46 / query-v5 intactos; não é pin cego de hash).
  if (file.endsWith('ProdutoFormV22_Completo.jsx')) {
    const skyChrome =
      /if \(windowMode\) \{\r?\n    return \(\r?\n      <div className="w-full h-full overflow-auto bg-white p-6">\r?\n        <div className="max-w-5xl mx-auto">\r?\n          <div className="flex items-center gap-3 mb-6 pb-4 border-b bg-gradient-to-r from-sky-50 to-sky-100 -mx-6 px-6 py-4">\r?\n            <Package className="w-8 h-8 text-sky-600" \/>\r?\n            <h2 className="text-2xl font-bold text-slate-900">\r?\n              \{produto\?\.id \? 'Editar Produto' : 'Novo Produto'\}\r?\n            <\/h2>\r?\n          <\/div>\r?\n          \{\/\* ID técnico sem data-action novo — campo id-tecnico-produto já existe no form\. \*\/\}\r?\n          \{produto\?\.id \? \(\r?\n            <p className="text-xs text-slate-500 mb-4">\r?\n              ID técnico: <span className="font-mono">\{String\(produto\.id\)\}<\/span>\r?\n            <\/p>\r?\n          \) : null\}\r?\n          \{content\}\r?\n        <\/div>\r?\n      <\/div>\r?\n    \);\r?\n  \}/;
    assert.equal(
      [...source.matchAll(new RegExp(skyChrome.source, 'g'))].length,
      1,
      'ProdutoFormV22 sky windowMode chrome deve existir exatamente 1× para peel',
    );
    const nl = source.includes('\r\n') ? '\r\n' : '\n';
    source = source.replace(
      skyChrome,
      `if (windowMode) {${nl}    return <div className="w-full h-full bg-white">{content}</div>;${nl}  }`,
    );
  }
  return source;
}
