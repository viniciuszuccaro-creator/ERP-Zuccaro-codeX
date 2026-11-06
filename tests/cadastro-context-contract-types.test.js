import test from 'node:test';
import { contextReadRemainder } from './helpers/contextReadBoundaryRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {classifyCadastroEditLoad,mergeCadastroEditHydration} from '../src/components/cadastros/cadastroEditLoadPolicy.js';
import {normalizeMultiempresaContext,validateMultiempresaContext} from '../src/components/lib/contextoMultiempresaPolicy.js';

const hook='src/components/lib/useContextoVisual.jsx';
const policy='src/components/cadastros/cadastroEditLoadPolicy.js';
for(const [file,hash] of [[hook,'a441be7f3145c2afbd0d828c36f87d09a7d56e64634bd3d989a046128dce6f98'],[policy,'145389c4e91a9de08be176aff27842a19dd58ad4ee91ac071d3c8b7b60039774']])test(`${file}: complete executable runtime unchanged by contracts`,()=>{
  const emitted=ts.transpileModule(contextReadRemainder(file,fs.readFileSync(file,'utf8')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});
const ast=ts.createSourceFile(hook,fs.readFileSync(hook,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let filter;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='getFiltroContexto'){assert.equal(filter,undefined);filter=node.initializer;}ts.forEachChild(node,visit);}
visit(ast);assert.ok(filter);
function bind(input,selected='todas'){
  const deps={contextoCanonico:normalizeMultiempresaContext(input),validacaoContexto:validateMultiempresaContext(input),filtroEmpresa:selected};
  return new Function(...Object.keys(deps),`return (${filter.getText(ast)});`)(...Object.values(deps));
}

test('actual filter retains company/group/custom-field branches and returns a fresh empty object for invalid context',()=>{
  const company=bind({scopeType:'empresa',groupId:' synthetic-group ',empresaId:' synthetic-a '});
  assert.deepEqual(company(),{empresa_id:'synthetic-a'});
  assert.deepEqual(company('empresa_dona_id',true),{group_id:'synthetic-group',empresa_dona_id:'synthetic-a'});
  const group=bind({scopeType:'grupo',groupId:'synthetic-group'});
  assert.deepEqual(group(),{});assert.deepEqual(group('empresa_id',true),{group_id:'synthetic-group'});
  assert.deepEqual(bind({scopeType:'grupo',groupId:'synthetic-group'},'synthetic-b')('empresa_id',true),{group_id:'synthetic-group',empresa_id:'synthetic-b'});
  for(const input of [{},{scopeType:'empresa',groupId:'synthetic-group'},{scopeType:'empresa',empresaId:'synthetic-a'}]){
    const run=bind(input),first=run('empresa_id',true);assert.deepEqual(first,{});assert.notEqual(first,run('empresa_id',true));
  }
});

test('actual context filter return and classify options compile with concrete fields, rejecting malformed callers',()=>{
  const filename=path.resolve('tests/synthetic-cadastro-context.js');
  let source=`import {classifyCadastroEditLoad} from '../src/components/cadastros/cadastroEditLoadPolicy.js';
const validacaoContexto={valid:true};
const contextoCanonico={scopeType:'empresa',groupId:'synthetic-group',empresaId:'synthetic-a'};
const filtroEmpresa='todas';
const getFilter=${filter.getText(ast)};
const result=getFilter('empresa_dona_id',true);
const key=result.empresa_dona_id;
classifyCadastroEditLoad();
classifyCadastroEditLoad({entityName:'Produto',expectedId:42,fullRecord:{id:42,codigo:'synthetic-code',descricao:'Synthetic'}});
classifyCadastroEditLoad({loadError:{message:'synthetic'},listRow:null,fullRecord:null});
`;
  const firstNegative=source.split('\n').length-1;
  for(const line of ["getFilter(123,true);","getFilter('empresa_id','true');","/** @type {number} */ const bad=result.group_id;","classifyCadastroEditLoad({entityName:123});","classifyCadastroEditLoad({expectedId:{id:42}});","classifyCadastroEditLoad({fullRecord:'invalid'});"])source+=line+'\n';
  const options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;
  host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,6,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),Array.from({length:6},(_,i)=>firstNegative+i));
});

test('classification keeps missing/mismatched IDs, empty identity and backend errors blocked',()=>{
  assert.equal(classifyCadastroEditLoad().kind,'load_incomplete');
  for(const options of [
    {entityName:'Produto',expectedId:'synthetic-a',fullRecord:{id:'synthetic-b',codigo:'x',descricao:'Synthetic'}},
    {entityName:'Produto',expectedId:'synthetic-a',fullRecord:{id:'synthetic-a'}},
    {entityName:'Marca',expectedId:'synthetic-a',fullRecord:{id:'synthetic-a',nome:''}},
  ])assert.equal(classifyCadastroEditLoad(options).kind,'load_incomplete');
  const failed=classifyCadastroEditLoad({entityName:'Produto',expectedId:'synthetic-a',loadError:new Error('synthetic transport failure'),fullRecord:{id:'synthetic-a',codigo:'x',descricao:'Synthetic'}});
  assert.equal(failed.kind,'load_failed');assert.ok(failed.message);
});

test('hydration preserves absent list fields but respects explicit empty/null values and numeric/string identity compatibility',()=>{
  const row={id:42,codigo:'synthetic-code',descricao:'Synthetic',custom:{value:1}};
  const full={id:42,custom:undefined};
  const merged=mergeCadastroEditHydration(row,full);assert.deepEqual(merged,row);assert.equal(merged.custom,row.custom);
  assert.equal(classifyCadastroEditLoad({entityName:'Produto',expectedId:'42',listRow:row,fullRecord:full}).kind,'ok');
  for(const cleared of ['',null]){
    const complete={id:42,codigo:cleared,descricao:cleared};
    assert.equal(classifyCadastroEditLoad({entityName:'Produto',expectedId:42,listRow:row,fullRecord:complete}).kind,'load_incomplete');
  }
});
