import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import crypto from 'node:crypto';
import {QueryClient,QueryObserver,keepPreviousData} from '@tanstack/react-query';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';

const cases=[
  {file:'src/components/cadastros/ProdutoFormV22_Completo.jsx',count:5,hash:'67a27312ee2786c0576e0a330e81025ff85562b8bb6c9c30bd7079d5e30a0520'},
  {file:'src/components/estoque/ProdutosTab.jsx',count:4,hash:'cd8dd5ebcac1f1558ef3b2e27f86e26748e0ede0e486cd222139aae8babd59f4'},
];
function queries(file){
  const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),result=[];
  function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useQuery')result.push(node.arguments[0]);ts.forEachChild(node,visit);}
  visit(ast);return {source,ast,result};
}
const emit=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
for(const entry of cases)test(`${entry.file}: exactly ${entry.count} obsolete options replaced; entire remaining runtime frozen`,()=>{
  const {source,ast,result}=queries(entry.file),edits=[];
  assert.equal(result.length,entry.count);
  for(const query of result){
    assert.ok(ts.isObjectLiteralExpression(query));
    assert.ok(!query.properties.some(p=>p.name?.getText(ast)==='keepPreviousData'));
    const property=query.properties.filter(p=>p.name?.getText(ast)==='placeholderData');assert.equal(property.length,1);
    assert.equal(property[0].initializer.getText(ast),'undefined');
    edits.push({start:property[0].getStart(ast),end:property[0].end});
  }
  let restored=source;
  for(const edit of edits.sort((a,b)=>b.start-a.start))restored=restored.slice(0,edit.start)+'keepPreviousData: true'+restored.slice(edit.end);
  assert.equal(crypto.createHash('sha256').update(emit(iaResponseValidationRemainder(entry.file,restored))).digest('hex'),entry.hash);
});

function options(file,query){
  const {ast,result}=queries(file),node=result[query];
  const property=node.properties.find(p=>p.name?.getText(ast)==='placeholderData');assert.ok(property);
  return {placeholderData:new Function(`return (${property.initializer.getText(ast)});`)()};
}
function client(){return new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});}
function switchPending(config){
  const cache=client();cache.setQueryData(['synthetic-product','scope-a'],[{id:'synthetic-a'}]);
  const observer=new QueryObserver(cache,{queryKey:['synthetic-product','scope-a'],enabled:false,...config});
  assert.deepEqual(observer.getCurrentResult().data,[{id:'synthetic-a'}]);
  observer.setOptions({queryKey:['synthetic-product','scope-b'],enabled:false,...config});
  const result=observer.getCurrentResult();observer.destroy();cache.clear();return result;
}

test('installed v5 ignores the legacy flag; explicit undefined preserves actual behavior, unlike keepPreviousData callback',()=>{
  const old=switchPending({keepPreviousData:true}),current=switchPending({placeholderData:undefined});
  assert.equal(old.data,undefined);assert.equal(current.data,undefined);
  assert.equal(old.status,current.status);assert.equal(old.isPlaceholderData,false);assert.equal(current.isPlaceholderData,false);
  const retaining=switchPending({placeholderData:keepPreviousData});
  assert.deepEqual(retaining.data,[{id:'synthetic-a'}]);assert.equal(retaining.isPlaceholderData,true);
});

for(const entry of cases)for(let i=0;i<entry.count;i++)test(`${entry.file} query ${i+1}: no old-scope placeholder; existing new-scope cache still available`,()=>{
  const config=options(entry.file,i),result=switchPending(config);
  assert.equal(result.data,undefined);assert.equal(result.isPlaceholderData,false);
  const cache=client();cache.setQueryData(['synthetic-product','scope-b'],[{id:'synthetic-b'}]);
  const observer=new QueryObserver(cache,{queryKey:['synthetic-product','scope-b'],enabled:false,...config});
  assert.deepEqual(observer.getCurrentResult().data,[{id:'synthetic-b'}]);observer.destroy();cache.clear();
});

test('a delayed old-key result remains in its own cache and cannot replace the selected key data',async()=>{
  const cache=client();let completeA;
  const pendingA=cache.fetchQuery({queryKey:['synthetic-product','scope-a'],queryFn:()=>new Promise(resolve=>{completeA=resolve;})});
  cache.setQueryData(['synthetic-product','scope-b'],[{id:'synthetic-b'}]);
  const observer=new QueryObserver(cache,{queryKey:['synthetic-product','scope-b'],enabled:false,...options(cases[0].file,0)});
  completeA([{id:'synthetic-a'}]);await pendingA;
  assert.deepEqual(cache.getQueryData(['synthetic-product','scope-a']),[{id:'synthetic-a'}]);
  assert.deepEqual(observer.getCurrentResult().data,[{id:'synthetic-b'}]);observer.destroy();cache.clear();
});
