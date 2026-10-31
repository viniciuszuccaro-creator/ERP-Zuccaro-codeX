import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';

const report='src/components/relatorios/AgendamentoRelatorios.jsx';
const backup='src/components/sistema/ConfiguracaoBackup.jsx';
const monitor='src/components/sistema/ConfiguracaoMonitoramento.jsx';
const preferences='src/pages/ConfiguracoesUsuario.jsx';
for(const [file,hash] of [
  [report,'9a82460dfe4943f24497ee134b980934fad2d5f67dedc496ad030edf1d521d0f'],
  [backup,'5df6765b7cdb241db299b5a0069f7a4f3a6c6021f749eefa86472bae71d605bf'],
  [monitor,'5a87ca5d2df7f7023171bf36131c6b0d0241abc94c1dcc1424f5083b4184cf97'],
  [preferences,'7a94792014c371cf3a477aa445cb6b157668432c710d63dc623ade88ad6aec6e'],
])test(`${file}: full executable runtime unchanged by annotations`,()=>{
  const emitted=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});
function parse(file){return ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);}
function find(ast,name){
  let result;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.equal(result,undefined);result=node;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(result);return result;
}
function member(file,name,key){const ast=parse(file),config=find(ast,name).initializer.arguments[0];
  const fn=config.properties.find(p=>p.name?.getText(ast)===key)?.initializer;assert.ok(fn);return {ast,fn};}
function bind(file,name,key,deps){const {ast,fn}=member(file,name,key);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
function initial(file,name){
  const ast=parse(file);let result;
  function visit(node){if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)===name)result=node.initializer.arguments[0].getText(ast);ts.forEachChild(node,visit);}
  visit(ast);assert.ok(result);return result;
}

test('four actual configuration command parameters retain concrete form types or extensible unknown records',()=>{
  const cases=[
    [report,'salvarMutation','agendamento',"{...agendamento,ativo:'invalid'}"],
    [backup,'salvarMutation','{custom:true,retencao_dias:30}','123'],
    [monitor,'salvarMutation','{custom:true,thresholds:{query_lenta_ms:1000}}','123'],
    [preferences,'updateUserMutation','preferencesForm',"{...preferencesForm,configuracoes_sistema:{}}"],
  ];
  let source=`import {useMutation} from '@tanstack/react-query';\nconst agendamento=${initial(report,'agendamento')};\nconst preferencesForm=${initial(preferences,'preferencesForm')};\n`;
  for(const [i,[file,name,good]] of cases.entries()){
    const {ast,fn}=member(file,name,'mutationFn');assert.equal(fn.parameters.length,1);
    source+=`const c${i}=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\nc${i}.mutate(${good});\n`;
  }
  const firstNegative=source.split('\n').length-1;
  for(const [i,[,,,bad]] of cases.entries())source+=`c${i}.mutate(${bad});\n`;
  const filename=path.resolve('tests/synthetic-configuration-command.js');
  const options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;
  host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,4,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),cases.map((_,i)=>firstNegative+i));
  assert.ok(errors.every(e=>[2322,2345,2739].includes(e.code)));
});

function reportDeps(overrides={}){
  const calls=[],audits=[];
  const deps={contextoValido:true,canEditAgendamento:true,user:{id:'synthetic-user'},
    empresaSelecionadaId:'synthetic-a',groupId:'synthetic-group',
    base44:{entities:{AuditLog:{create:async p=>audits.push(p)}}},
    sanitizeEmails:value=>String(value||'').replace(/[<>]/g,'').split(',').map(v=>v.trim()).filter(Boolean).join(', '),
    window:{confirm:()=>true},filterInContext:async()=>[],
    createInContext:async(...args)=>{calls.push(['create',...args]);return {id:'synthetic-config'};},
    updateInContext:async(...args)=>{calls.push(['update',...args]);return {id:'synthetic-config'};},...overrides};
  return {deps,calls,audits};
}
const reportData=()=>new Function(`return (${initial(report,'agendamento')});`)();
test('report command preserves context/RBAC denial, recipient requirement and explicit confirmation',async()=>{
  for(const scenario of [
    {override:{contextoValido:false},data:reportData(),audit:true},
    {override:{canEditAgendamento:false},data:reportData(),audit:true},
    {override:{},data:{...reportData(),ativo:true},audit:false},
    {override:{window:{confirm:()=>false}},data:reportData(),audit:true},
  ]){
    const {deps,calls,audits}=reportDeps(scenario.override);
    await assert.rejects(bind(report,'salvarMutation','mutationFn',deps)(scenario.data));
    assert.equal(calls.length,0);assert.equal(audits.length,scenario.audit?1:0);
  }
});

test('report command preserves create/update choice, scoped payload and post-write audit',async()=>{
  for(const existing of [false,true]){
    const {deps,calls,audits}=reportDeps({filterInContext:async()=>existing?[{id:'synthetic-old'}]:[]});
    const data={...reportData(),ativo:true,destinatarios:' a@example.invalid, b@example.invalid '};
    assert.deepEqual(await bind(report,'salvarMutation','mutationFn',deps)(data),{id:'synthetic-config'});
    assert.equal(calls.length,1);assert.equal(calls[0][0],existing?'update':'create');
    const stamped=calls[0].at(-1);assert.equal(stamped.empresa_id,'synthetic-a');assert.equal(stamped.group_id,'synthetic-group');
    assert.equal(stamped.configuracoes_sistema.destinatarios,'a@example.invalid, b@example.invalid');
    assert.equal(audits.length,1);assert.equal(audits[0].sucesso,true);
  }
});

test('report query and audit failures propagate instead of being reported as success',async()=>{
  const query=reportDeps({filterInContext:async()=>{throw new Error('synthetic query');}});
  await assert.rejects(bind(report,'salvarMutation','mutationFn',query.deps)(reportData()),/synthetic query/);assert.equal(query.calls.length,0);
  const audit=reportDeps({base44:{entities:{AuditLog:{create:async()=>{throw new Error('synthetic audit');}}}}});
  await assert.rejects(bind(report,'salvarMutation','mutationFn',audit.deps)(reportData()),/synthetic audit/);
  assert.equal(audit.calls.length,1); // Existing UI command is not a database transaction.
});

test('backup command keeps mandatory group guard before authentication or writes',async()=>{
  let calls=0;
  const run=bind(backup,'salvarMutation','mutationFn',{grupoAtivoId:null,base44:{auth:{me:async()=>calls++}}});
  await assert.rejects(run({ativo:false}),/Selecione o grupo/);assert.equal(calls,0);
});

test('monitor configuration preserves context stamping and create/update branches',async()=>{
  for(const existing of [false,true]){
    const calls=[];const write=async(...args)=>{calls.push(args);return {id:'synthetic-monitor'};};
    const run=bind(monitor,'salvarMutation','mutationFn',{
      empresaAtivaId:'synthetic-a',grupoAtivoId:'synthetic-group',config:existing?{id:'synthetic-old'}:null,
      createInContext:write,updateInContext:write,base44:{auth:{me:async()=>({id:'synthetic-user'})}},
    });
    const data={ativo:false,thresholds:{query_lenta_ms:123}};
    assert.deepEqual(await run(data),{id:'synthetic-monitor'});
    assert.equal(calls.length,2);assert.equal(calls[0][0],'ConfiguracaoMonitoramento');
    assert.deepEqual(calls[0].at(-1),{...data,empresa_id:'synthetic-a',group_id:'synthetic-group'});
    assert.equal(calls[1][0],'AuditLog');assert.equal(calls[1].at(-1).usuario_id,'synthetic-user');
  }
});

test('preferences command forwards the existing nested payload and propagates authentication failure',async()=>{
  const data=new Function(`return (${initial(preferences,'preferencesForm')});`)(),calls=[];
  const run=bind(preferences,'updateUserMutation','mutationFn',{base44:{auth:{updateMe:async p=>{calls.push(p);return {id:'synthetic-user'};}}}});
  assert.deepEqual(await run(data),{id:'synthetic-user'});assert.equal(calls[0],data);
  const denied=bind(preferences,'updateUserMutation','mutationFn',{base44:{auth:{updateMe:async()=>{throw new Error('synthetic authentication denial');}}}});
  await assert.rejects(denied(data),/synthetic authentication denial/);
});
