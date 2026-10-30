import assert from 'node:assert/strict';
import ts from 'typescript';
import {partialInputRemainder} from './partialInputRemainder.js';
import {cadastroCodigoRegistroRemainder} from './cadastroCodigoRegistroRemainder.js';
import {produtoWindowSkyRemainder} from './produtoWindowSkyRemainder.js';

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
  // #433: peels windowMode sky chrome before stage46 IA/query pins.
  source = produtoWindowSkyRemainder(file, source);
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
  return cadastroCodigoRegistroRemainder(file, source);
}
