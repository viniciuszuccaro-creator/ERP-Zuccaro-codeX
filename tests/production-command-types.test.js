import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';

const hashes={
  'src/pages/ProducaoMobile.jsx':'883f842f7858638b1546786663b624fba9c703a8c96400cfd52d5fec8306bea3',
  'src/components/producao/FormularioOrdemProducao.jsx':'48e3a21004e5ca4d9c91f509681193247fc617d31d94050225bbecbfd1da678b',
  'src/components/producao/KanbanProducaoInteligente.jsx':'f7664fa534d3a58781977966658b6e1223278e7a39f2d0b73f951f5593a99957',
  'src/components/producao/ConfiguracaoProducao.jsx':'2cf1a23c55a464a1f5ca240b3c508cd1dd5fd54c04e1e060bd91b897fea38e96',
  'src/components/cadastros/VisualizadorProdutos.jsx':'f66a24a75f1c50d47b0b8331350dc82f91cd4e2235de676cc5d7aedd9d3cbf57',
  'src/components/producao/SeletorProdutosProducao.jsx':'2f5a5f946d7673a535f7ac347ffcf327de07c5e533442c26add3fbe66862ce59',
};
for(const [file,hash] of Object.entries(hashes))test(`${file}: full emitted runtime unchanged by command annotations`,()=>{
  let source=iaResponseValidationRemainder(file,fs.readFileSync(file,'utf8'));
  // Git uses LF; the untagged prompt template has CRLF in this Windows checkout.
  if(file.endsWith('/FormularioOrdemProducao.jsx'))source=source.replaceAll('\r\n','\n');
  const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});

test('JavaScript normalizes CRLF in untagged prompt templates to LF',()=>{
  const crlf=new Function('return `synthetic\r\nprompt`;')();
  const lf=new Function('return `synthetic\nprompt`;')();
  assert.equal(crlf,lf);assert.equal(crlf,'synthetic\nprompt');
});

function parse(file){return ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);}
function find(ast,name){
  let result;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.equal(result,undefined);result=node;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(result);return result;
}
function mutation(file,name){const ast=parse(file),config=find(ast,name).initializer.arguments[0];
  const fn=config.properties.find(p=>p.name?.getText(ast)==='mutationFn').initializer;return {ast,fn};}
function bind(file,name,dependencies){const {ast,fn}=mutation(file,name);
  return new Function(...Object.keys(dependencies),`return (${fn.getText(ast)});`)(...Object.values(dependencies));}
function compile(filename,source,checkJs){
  const options={allowJs:true,checkJs,noEmit:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ESNext,
    module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,
    baseUrl:process.cwd(),paths:{'@/*':['./src/*']}};
  const host=ts.createCompilerHost(options),read=host.readFile;
  host.readFile=file=>path.resolve(file)===filename?source:read(file);
  return ts.createProgram([filename],options,host).getSemanticDiagnostics()
    .filter(error=>error.file&&path.resolve(error.file.fileName)===filename);
}

test('seven actual production command parameters reject invalid IDs, values, flags and record shapes',()=>{
  const cases=[
    ['src/pages/ProducaoMobile.jsx','apontarMutation','apontamento',"{...apontamento,peso_produzido_kg:'invalid'}"],
    ['src/pages/ProducaoMobile.jsx','finalizarEEnviarMutation',"'synthetic-op'",'123'],
    ['src/components/producao/FormularioOrdemProducao.jsx','saveMutation',"{empresa_id:'synthetic-company',status:'Planejada',itens:[]}","{empresa_id:123}"],
    ['src/components/producao/KanbanProducaoInteligente.jsx','updateStatusMutation',"{id:'synthetic-op',status:'Em Corte'}","{id:'synthetic-op'}"],
    ['src/components/producao/ConfiguracaoProducao.jsx','saveMutation',"{empresa_id:'synthetic-company',preco_aco_kg:8}",'123'],
    ['src/components/producao/ConfiguracaoProducao.jsx','toggleBloquear','false',"'false'"],
    ['src/components/cadastros/VisualizadorProdutos.jsx','updateSetorMutation',"{setorId:'synthetic-sector',setorNome:'Synthetic'}","{setorId:123}"],
  ];
  const mobile=parse(cases[0][0]);
  let initial;
  function visit(node){
    if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(mobile)==='apontamento')initial=node.initializer.arguments[0].getText(mobile);
    ts.forEachChild(node,visit);
  }
  visit(mobile);assert.ok(initial);
  let source=`import {useMutation} from '@tanstack/react-query';\nconst apontamento=${initial};\n`;
  for(const [i,[file,name,good]] of cases.entries()){
    const {ast,fn}=mutation(file,name);assert.equal(fn.parameters.length,1);
    source+=`const command${i}=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\ncommand${i}.mutate(${good});\n`;
  }
  const firstNegative=source.split('\n').length-1;
  for(const [i,[,,,bad]] of cases.entries())source+=`command${i}.mutate(${bad});\n`;
  const errors=compile(path.resolve('tests/synthetic-production-commands.js'),source,true);
  assert.equal(errors.length,cases.length,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),cases.map((_,i)=>firstNegative+i));
  assert.ok(errors.every(e=>[2322,2345].includes(e.code)));
});

test('production selector keeps callback required and quantity optional/numeric',()=>{
  const filename=path.resolve('tests/synthetic-production-selector.tsx');
  const source=`import Selector from '../src/components/producao/SeletorProdutosProducao';
const good=<><Selector onSelecionarProduto={produto=>String(produto.id)}/><Selector onSelecionarProduto={()=>{}} quantidadeNecessaria={5}/></>;
const missing=<Selector/>;
const invalid=<Selector onSelecionarProduto={()=>{}} quantidadeNecessaria="invalid"/>;`;
  assert.deepEqual(compile(filename,source,false).map(e=>e.code),[2741,2322]);
});

test('actual Kanban command preserves context, move/progress/approval gates, history and audit calls',async()=>{
  const file='src/components/producao/KanbanProducaoInteligente.jsx';
  for(const scenario of [
    {override:{contextoValido:false},status:'Planejada',denied:true},
    {override:{canMoverOP:false},status:'Planejada',denied:true},
    {override:{canAprovarOP:false},status:'Concluida',denied:true},
    {override:{canApontarOP:false,canEditOP:false,canAprovarOP:false},status:'Em Corte',denied:true},
    {override:{},status:'Em Corte',denied:false},
  ]){
    const writes=[],audits=[],row={id:'synthetic-op',group_id:'synthetic-group',empresa_id:'synthetic-a',status:'Planejada',historico_mudancas_status:[]};
    const deps={ops:[row],contextoValido:true,canMoverOP:true,canAprovarOP:true,canApontarOP:true,canEditOP:true,
      groupId:'synthetic-group',empresaId:'synthetic-a',user:{id:'synthetic-user'},
      auditarKanban:async data=>audits.push(data),updateInContext:async(...args)=>{writes.push(args);return {id:'synthetic-op'};},...scenario.override};
    const run=bind(file,'updateStatusMutation',deps);
    if(scenario.denied){await assert.rejects(run({id:row.id,status:scenario.status}));assert.equal(writes.length,0);continue;}
    assert.deepEqual(await run({id:row.id,status:scenario.status}),{id:row.id});
    assert.equal(writes.length,1);assert.equal(audits.length,1);
    const [entity,id,data]=writes[0];assert.equal(entity,'OrdemProducao');assert.equal(id,row.id);
    assert.equal(data.group_id,row.group_id);assert.equal(data.empresa_id,row.empresa_id);
    assert.equal(data.status,scenario.status);assert.equal(data.historico_mudancas_status[0].status_anterior,row.status);
    assert.equal(data.historico_mudancas_status[0].status_novo,scenario.status);
  }
});

test('actual OP save command preserves mandatory company, creation/edit/approval checks and context stamping',async()=>{
  const file='src/components/producao/FormularioOrdemProducao.jsx';
  const payload={empresa_id:'synthetic-a',group_id:'synthetic-group',status:'Planejada',numero_op:'synthetic-op'};
  for(const scenario of [
    {override:{contextoValido:false},data:payload,denied:true},
    {override:{},data:{status:'Planejada'},denied:true},
    {override:{canCreateOP:false},data:payload,denied:true},
    {override:{op:{id:'synthetic-op'},canEditOP:false,canAprovarOP:false},data:payload,denied:true},
    {override:{canAprovarOP:false},data:{...payload,status:'Concluida'},denied:true},
    {override:{},data:payload,denied:false},
  ]){
    const writes=[],audits=[];
    const write=async(...args)=>{writes.push(args);return {id:'synthetic-op'};};
    const deps={contextoValido:true,op:null,canCreateOP:true,canEditOP:true,canAprovarOP:true,empresaId:'synthetic-a',groupId:'synthetic-group',
      createInContext:write,updateInContext:write,auditarOP:async data=>audits.push(data),...scenario.override};
    const run=bind(file,'saveMutation',deps);
    if(scenario.denied){await assert.rejects(run(scenario.data));assert.equal(writes.length,0);continue;}
    assert.deepEqual(await run(scenario.data),{id:'synthetic-op'});
    assert.equal(writes.length,1);assert.equal(audits.length,1);
    assert.equal(writes[0][0],'OrdemProducao');assert.equal(writes[0][1].empresa_id,'synthetic-a');
    assert.equal(writes[0][1].group_id,'synthetic-group');assert.equal(writes[0][1].grupo_id,'synthetic-group');
  }
});
