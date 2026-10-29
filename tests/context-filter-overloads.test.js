import test from 'node:test';
import { contextReadRemainder } from './helpers/contextReadBoundaryRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

const file='src/components/lib/useContextoVisual.jsx';
const source=fs.readFileSync(file,'utf8');
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
let declaration,statement;
function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='filtrarPorContexto'){
    assert.equal(declaration,undefined);declaration=node;statement=node.parent.parent;
  }
  ts.forEachChild(node,visit);
}
visit(ast);
assert.ok(declaration&&ts.isArrowFunction(declaration.initializer));

test('context hook keeps its complete executable JavaScript unchanged',()=>{
  const emitted=ts.transpileModule(contextReadRemainder(file,source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
    jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),
    '0dc4c949db81a011de164f4ea0edab868e7a3aadba7e29e6363837de0f305b15');
});

function bind(context={},backend=async()=>[]){
  const values={estaNoGrupo:false,grupoAtual:null,filtroEmpresa:'todas',empresasDoGrupo:[],
    estaEmEmpresa:false,empresaAtual:null,...context,filterInContext:backend};
  return new Function(...Object.keys(values),`return (${declaration.initializer.getText(ast)});`)(...Object.values(values));
}

test('local list overload stays synchronous, retains record identity and blocks absent context',()=>{
  const filter=bind({estaEmEmpresa:true,grupoAtual:{id:'synthetic-group'},empresaAtual:{id:'synthetic-a'}});
  const allowed={id:'allowed',group_id:'synthetic-group',empresa_id:'synthetic-a'};
  const rows=[allowed,{id:'foreign-company',group_id:'synthetic-group',empresa_id:'synthetic-b'},
    {id:'foreign-group',group_id:'foreign',empresa_id:'synthetic-a'}];
  const result=filter(rows);
  assert.equal(Array.isArray(result),true);assert.deepEqual(result,[allowed]);assert.equal(result[0],allowed);
  assert.deepEqual(bind()(rows),[]);assert.deepEqual(filter(),[]);assert.deepEqual(filter([]),[]);
});

test('local group and selected-company branches preserve configured context fields',()=>{
  const rows=[{id:'group',group_id:'synthetic-group'},
    {id:'company-a',empresa_alocada_id:'synthetic-a'},
    {id:'company-b',empresa_id:'synthetic-b'},
    {id:'foreign',group_id:'foreign',empresa_id:'foreign'}];
  const context={estaNoGrupo:true,grupoAtual:{id:'synthetic-group'},empresasDoGrupo:[{id:'synthetic-a'},{id:'synthetic-b'}]};
  assert.deepEqual(bind(context)(rows,'empresa_alocada_id'),rows.slice(0,3));
  assert.deepEqual(bind({...context,filtroEmpresa:'synthetic-a'})(rows,'empresa_alocada_id'),[rows[1]]);
  assert.deepEqual(bind({...context,grupoAtual:null})(rows),[]);
});

test('entity branch stays asynchronous and forwards exact criteria, order, limit and field',async()=>{
  const calls=[],rows=[{id:'synthetic-record'}];
  const filter=bind({},async(...args)=>{calls.push(args);return rows;});
  const criteria={status:'synthetic-status'};
  const result=filter('SyntheticEntity',criteria,'-created_date',20);
  assert.ok(result instanceof Promise);assert.equal(await result,rows);
  assert.deepEqual(calls[0],['SyntheticEntity',criteria,'-created_date',20,'empresa_id']);
  assert.equal(calls[0][1],criteria);
  await filter('SyntheticEntity','empresa_dona_id','created_date',10);
  assert.deepEqual(calls[1],['SyntheticEntity',{},'created_date',10,'empresa_dona_id']);
});

test('entity branch does not swallow backend failures',async()=>{
  const failure=new Error('synthetic failure');
  const filter=bind({},async()=>{throw failure;});
  await assert.rejects(filter('SyntheticEntity',{}),error=>error===failure);
});

test('actual overloads separate lists and promises, preserve generic fields and reject malformed fifth arguments',()=>{
  const filename=path.resolve('tests/synthetic-context-filter.js');
  const prefix=`const estaNoGrupo=false,grupoAtual={id:'synthetic-group'},filtroEmpresa='todas',empresasDoGrupo=[{id:'synthetic-a'}],estaEmEmpresa=true,empresaAtual={id:'synthetic-a',group_id:'synthetic-group',grupo_id:'synthetic-group'};
/** @param {string} entityName
 * @param {Record<string,unknown>} criteria
 * @param {string} [order]
 * @param {number} [limit]
 * @param {string} [campo]
 * @returns {Promise<Array<{id:string}>>} */
async function filterInContext(entityName,criteria,order,limit,campo){ return [{id:'synthetic-record'}]; }
${statement.getFullText(ast)}
const local=filtrarPorContexto([{id:'synthetic',score:1}]);
local.filter(row=>row.score>0);local[0].id.toUpperCase();
filtrarPorContexto().filter(Boolean);
filtrarPorContexto('SyntheticEntity',{},'-created_date',20).then(rows=>rows[0].id.toUpperCase());
filtrarPorContexto('SyntheticEntity','empresa_id');
filtrarPorContexto('SyntheticEntity',{},'-created_date',20,'empresa_dona_id');
`;
  const negative=[
    "filtrarPorContexto([{id:'synthetic'}],{});",
    "filtrarPorContexto('SyntheticEntity',{}).filter(Boolean);",
    "filtrarPorContexto('SyntheticEntity',{},'-created_date',20,123);",
    "local[0].missingProperty;",
  ];
  const fixture=prefix+negative.join('\n');
  const options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,
    module:ts.ModuleKind.ESNext,skipLibCheck:true,types:[]};
  const host=ts.createCompilerHost(options),read=host.readFile;
  host.readFile=file=>path.resolve(file)===filename?fixture:read(file);
  const errors=ts.getPreEmitDiagnostics(ts.createProgram([filename],options,host));
  assert.equal(errors.length,negative.length,JSON.stringify(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'))));
  const firstNegative=prefix.split('\n').length-1;
  assert.deepEqual(errors.map(error=>({file:path.resolve(error.file.fileName),line:error.file.getLineAndCharacterOfPosition(error.start).line})),
    negative.map((_,i)=>({file:filename,line:firstNegative+i})));
  assert.deepEqual(errors.map(error=>error.code),[2769,2339,2345,2339]);
});
