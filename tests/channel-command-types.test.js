import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';

const multi='src/components/chatbot/ChatbotMulticanal.jsx',config='src/components/chatbot/ConfiguracaoCanais.jsx';
const template='src/components/chatbot/GerenciadorTemplates.jsx',knowledge='src/components/chatbot/BaseConhecimento.jsx';
for(const [file,hash] of [
  [multi,'e4c83f9d976c5795865b9b84eacbee8ebf680512c177ac5b38057726db571098'],
  [config,'e80058eaa8cba102d8a81fe3fba001cb22ae274c82dfe6cee17585471de7e1f1'],
  [template,'abcda3aab8e5758bce66da52153e2e990bf02ed7b5cd67f6cf9a18f4924ddf32'],
  [knowledge,'19f78b512602af947d422027d0701a8c6464d9dd7523c3c1f4c9e242cb003995'],
])test(`${file}: complete runtime unchanged by command contracts`,()=>{
  const emitted=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});
function parse(file){return ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);}
function command(file,name){
  const ast=parse(file);let fn;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.equal(fn,undefined);fn=node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)==='mutationFn').initializer;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(fn);return {ast,fn};
}
function bind(file,name,deps){const {ast,fn}=command(file,name);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
function initial(file,name){
  const ast=parse(file);let result;
  function visit(node){if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)===name)result=node.initializer.arguments[0].getText(ast);ts.forEachChild(node,visit);}
  visit(ast);assert.ok(result);return result;
}
const newTemplate=()=>new Function(`return (${initial(template,'formData')});`)();
const newKnowledge=()=>new Function(`return (${initial(knowledge,'form')});`)();

test('five actual command parameter contracts accept existing payloads and reject malformed known fields',()=>{
  const cases=[
    [multi,'toggleCanalMutation',"{canalId:'Portal',ativo:false}","{canalId:'Portal',ativo:'false'}"],
    [config,'salvarConfigMutation','{ativo:false,custom:{value:1}}','123'],
    [template,'salvarTemplateMutation','formData',"{...formData,ativo:'false'}"],
    [template,'excluirTemplateMutation',"{canal_config_id:'synthetic-config',template_id:'synthetic-template'}","{template_id:'synthetic-template'}"],
    [knowledge,'salvarMutation','form',"{...form,resposta:123}"],
  ];
  let source=`import {useMutation} from '@tanstack/react-query';\nconst formData=${initial(template,'formData')};\nconst form=${initial(knowledge,'form')};\n`;
  for(const [i,[file,name,good]] of cases.entries()){
    const {ast,fn}=command(file,name);assert.equal(fn.parameters.length,1);
    source+=`const c${i}=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\nc${i}.mutate(${good});\n`;
  }
  const firstNegative=source.split('\n').length-1;
  for(const [i,[,,,bad]] of cases.entries())source+=`c${i}.mutate(${bad});\n`;
  const filename=path.resolve('tests/synthetic-channel-command.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,5,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),cases.map((_,i)=>firstNegative+i));
});

function dependencies(overrides={}){
  const calls=[];
  return {calls,deps:{contextoValido:true,canEditCanais:true,canEditConfig:true,canEditTemplates:true,canEditBase:true,
    configsCanais:[],configAtual:null,canalSelecionado:'Portal',templateEditando:null,editando:null,
    filterInContext:async(...args)=>{calls.push(['filter',...args]);return [];},
    createInContext:async(...args)=>{calls.push(['create',...args]);return {id:'synthetic-config',...args[1]};},
    updateInContext:async(...args)=>{calls.push(['update',...args]);return {id:args[1]};},...overrides}};
}
const commands=[
  [multi,'toggleCanalMutation','canEditCanais',()=>({canalId:'Portal',ativo:false})],
  [config,'salvarConfigMutation','canEditConfig',()=>({ativo:false})],
  [template,'salvarTemplateMutation','canEditTemplates',newTemplate],
  [template,'excluirTemplateMutation','canEditTemplates',()=>({canal_config_id:'synthetic-config',template_id:'synthetic-template'})],
  [knowledge,'salvarMutation','canEditBase',newKnowledge],
];
test('all five actual commands deny missing context or edit permission before any read/write',async()=>{
  for(const [file,name,permission,payload] of commands)for(const override of [{contextoValido:false},{[permission]:false}]){
    const {calls,deps}=dependencies(override);await assert.rejects(bind(file,name,deps)(payload()));assert.deepEqual(calls,[]);
  }
});

test('channel toggle keeps existing-ID update and new-channel creation distinct',async()=>{
  for(const existing of [false,true]){
    const {calls,deps}=dependencies({configsCanais:existing?[{id:'synthetic-config',canal:'Portal'}]:[]});
    await bind(multi,'toggleCanalMutation',deps)({canalId:'Portal',ativo:false});assert.equal(calls.length,1);
    assert.equal(calls[0][0],existing?'update':'create');assert.equal(calls[0][1],'ConfiguracaoCanal');assert.equal(calls[0].at(-1).ativo,false);
    if(existing){assert.equal(calls[0][2],'synthetic-config');assert.deepEqual(calls[0][3],{ativo:false});}
    else{assert.equal(calls[0][2].canal,'Portal');assert.equal(typeof calls[0][2].mensagem_boas_vindas,'string');}
  }
});

test('configuration save forwards extensible fields and retains selected-channel ownership on creation',async()=>{
  for(const existing of [false,true]){
    const {calls,deps}=dependencies({configAtual:existing?{id:'synthetic-config'}:null});
    const payload={ativo:false,custom:{value:1}};
    await bind(config,'salvarConfigMutation',deps)(payload);assert.equal(calls.length,1);
    assert.equal(calls[0][0],existing?'update':'create');assert.equal(calls[0][1],'ConfiguracaoCanal');
    if(existing)assert.equal(calls[0][3],payload);else assert.deepEqual(calls[0][2],{...payload,canal:'Portal'});
  }
});

test('template save preserves existing update/append logic and other template entries',async()=>{
  for(const editing of [false,true]){
    const other={template_id:'synthetic-other',nome:'Synthetic other'},old={template_id:'synthetic-template',nome:'Synthetic old'};
    const {calls,deps}=dependencies({templateEditando:editing?old:null,filterInContext:async()=>[{id:'synthetic-config',templates_mensagens:[old,other]}]});
    const result=await bind(template,'salvarTemplateMutation',deps)({...newTemplate(),nome:'Synthetic changed'});
    const items=calls[0][3].templates_mensagens;assert.equal(calls[0][2],'synthetic-config');assert.ok(items.includes(other));
    assert.equal(items.length,editing?2:3);assert.equal(result.nome,'Synthetic changed');
    if(editing)assert.equal(result.template_id,old.template_id);else assert.match(result.template_id,/^tpl-\d+$/);
  }
});

test('template deletion reads the requested config ID, preserves unrelated entries and rejects absent config',async()=>{
  const other={template_id:'synthetic-other'};
  const {calls,deps}=dependencies({filterInContext:async(...args)=>{calls.push(['filter',...args]);return [{id:'synthetic-config',templates_mensagens:[{template_id:'synthetic-template'},other]}];}});
  await bind(template,'excluirTemplateMutation',deps)({canal_config_id:'synthetic-config',template_id:'synthetic-template'});
  assert.deepEqual(calls[0],['filter','ConfiguracaoCanal',{id:'synthetic-config'},'canal',1]);
  assert.deepEqual(calls[1],['update','ConfiguracaoCanal','synthetic-config',{templates_mensagens:[other]}]);
  const missing=dependencies();await assert.rejects(bind(template,'excluirTemplateMutation',missing.deps)({canal_config_id:'synthetic-missing',template_id:'synthetic-template'}));
  assert.equal(missing.calls.length,1);assert.equal(missing.calls[0][0],'filter');
});

test('knowledge save preserves append/edit identity and new Portal-config branch',async()=>{
  for(const editing of [false,true]){
    const old={id:'synthetic-entry',pergunta:'Synthetic old'},other={id:'synthetic-other'};
    const {calls,deps}=dependencies({editando:editing?old:null,filterInContext:async()=>[{id:'synthetic-config',base_conhecimento:[old,other]}]});
    await bind(knowledge,'salvarMutation',deps)({...newKnowledge(),pergunta:'Synthetic changed'});
    const entries=calls[0][3].base_conhecimento;assert.equal(entries.length,editing?2:3);assert.ok(entries.includes(other));
    const changed=entries.find(row=>row.pergunta==='Synthetic changed');assert.ok(changed);
    if(editing)assert.equal(changed.id,old.id);else assert.match(changed.id,/^kb-\d+$/);
  }
  const created=dependencies();await bind(knowledge,'salvarMutation',created.deps)(newKnowledge());
  assert.equal(created.calls[1][0],'create');assert.equal(created.calls[1][2].canal,'Portal');assert.equal(created.calls[2][0],'update');
});

test('all five actual commands propagate storage failures',async()=>{
  for(const [file,name,,payload] of commands){
    const fail=async()=>{throw new Error('synthetic storage failure');};
    const {deps}=dependencies({createInContext:fail,updateInContext:fail,filterInContext:fail});
    await assert.rejects(bind(file,name,deps)(payload()),/synthetic storage failure/);
  }
});
