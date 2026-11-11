import assert from 'node:assert/strict';
import ts from 'typescript';

// Exclude only the independently tested OFX-dialog integration from the old full-JS invariant.
export function bankSourceHostRemainder(source){
  const ast=ts.createSourceFile('host.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const found={imports:0,state:0,scope:0,read:0,write:0,reset:0,dialog:0,button:0};
  const transform=context=>{
    const visit=node=>{
      if(ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='./ExtratoBancarioImportDialog'){
        found.imports++;return undefined;
      }
      if(ts.isVariableStatement(node)&&node.declarationList.declarations.length===1){
        const name=node.declarationList.declarations[0].name.getText(ast);
        const key={'[sourceOpen,setSourceOpen]':'state',sourceScope:'scope',podeLerFonte:'read',podeImportarFonte:'write'}[name];
        if(key){found[key]++;return undefined;}
      }
      if(ts.isExpressionStatement(node)&&node.expression.getText(ast)==='setSourceOpen(false)'){
        found.reset++;return undefined;
      }
      if(ts.isJsxExpression(node)&&node.expression?.getText(ast).startsWith('sourceOpen&&sourceScope&&podeLerFonte&&<ExtratoBancarioImportDialog')){
        found.dialog++;return undefined;
      }
      if(ts.isJsxOpeningElement(node)&&node.tagName.getText(ast)==='Button'
        &&node.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(ast)==='data-action'
          &&p.initializer?.getText(ast)==='"ConciliacaoBancaria.importar_ofx"')){
        found.button++;
        const properties=node.attributes.properties.flatMap(p=>{
          if(!ts.isJsxAttribute(p))return [p];
          const name=p.name.getText(ast);
          if(name==='onClick')return [];
          if(name==='disabled')return [ts.factory.updateJsxAttribute(p,p.name,
            ts.factory.createJsxExpression(undefined,ts.factory.createIdentifier('controlesDesabilitados')))];
          if(name==='data-permission')return [ts.factory.updateJsxAttribute(p,p.name,
            ts.factory.createStringLiteral('Financeiro.ConciliacaoBancaria.criar'))];
          return [p];
        });
        return ts.factory.updateJsxOpeningElement(node,node.tagName,node.typeArguments,ts.factory.createJsxAttributes(properties));
      }
      return ts.visitEachChild(node,visit,context);
    };
    return root=>ts.visitNode(root,visit);
  };
  const transformed=ts.transform(ast,[transform]);
  try{
    assert.deepEqual(found,{imports:1,state:1,scope:1,read:1,write:1,reset:1,dialog:1,button:1});
    return ts.createPrinter().printFile(transformed.transformed[0]);
  }finally{transformed.dispose();}
}
