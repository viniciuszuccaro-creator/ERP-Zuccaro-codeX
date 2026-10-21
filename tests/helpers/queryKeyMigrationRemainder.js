import assert from 'node:assert/strict';
import ts from 'typescript';
import {biometricEvidenceRemainder} from './biometricEvidenceRemainder.js';
import {portalIdentityRemainder} from './portalIdentityRemainder.js';

export const queryKeyMigrationCalls=Object.freeze({
  'src/components/compras/OrdensCompraTab.jsx':{ordensCompra:6,fornecedores:2,movimentacoes:1,produtos:1,contasPagar:1,ContaPagar:1},
  'src/components/NotificationCenter.jsx':{notificacoes:3},
  'src/components/portal/AprovacaoComAssinatura.jsx':{'orcamentos-aprovacao':2,'pedidos-dashboard':1},
  'src/components/portal/SolicitarOrcamento.jsx':{'minhas-oportunidades':1},
  'src/components/rh/PontoEletronicoBiometrico.jsx':{'pontos-hoje':1},
});

// Restore only the exact, independently tested v5 filter conversions for old runtime hashes.
export function queryKeyMigrationRemainder(file,source){
  const expected=queryKeyMigrationCalls[file];if(!expected)return source;
  source=biometricEvidenceRemainder(file,source);
  source=portalIdentityRemainder(file,source);
  const existing=file==='src/components/portal/AprovacaoComAssinatura.jsx'?{'cliente-portal':1,'orcamentos-aprovados-flag':1}:{};
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),found={},foundExisting={},edits=[];
  function visit(node){
    if(ts.isCallExpression(node)&&node.expression.getText(ast)==='queryClient.invalidateQueries'){
      assert.equal(node.arguments.length,1,'Unexpected invalidate options');
      const arg=node.arguments[0];assert.ok(ts.isObjectLiteralExpression(arg),'Expected v5 filter object');
      assert.equal(arg.properties.length,1,'Unapproved filter property');const property=arg.properties[0];
      assert.ok(ts.isPropertyAssignment(property)&&property.name.getText(ast)==='queryKey','Expected queryKey');
      const value=property.initializer;assert.ok(ts.isArrayLiteralExpression(value)&&value.elements.length===1&&ts.isStringLiteral(value.elements[0]),'Expected frozen one-part prefix');
      const key=value.elements[0].text;
      assert.ok(Object.hasOwn(expected,key)||Object.hasOwn(existing,key),'Unapproved query prefix');
      if(Object.hasOwn(existing,key))foundExisting[key]=(foundExisting[key]||0)+1;
      else{found[key]=(found[key]||0)+1;edits.push({start:arg.getStart(ast),end:arg.end,text:value.getText(ast)});}
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);assert.deepEqual(found,expected,'Exact key/count migration required');assert.deepEqual(foundExisting,existing,'Preexisting filters must remain unchanged');
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  return source;
}
