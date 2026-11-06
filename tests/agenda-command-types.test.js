import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {primitiveUiBoundaryRemainder} from './helpers/primitiveUiBoundaryRemainder.js';

const file='src/pages/Agenda.jsx';
const source=fs.readFileSync(file,'utf8');
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
function find(name){
  let result;
  function visit(node){
    if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.equal(result,undefined);result=node;}
    ts.forEachChild(node,visit);
  }
  visit(ast);assert.ok(result);return result;
}
function member(name,key){
  const config=find(name).initializer.arguments[0];
  const result=config.properties.find(p=>p.name?.getText(ast)===key)?.initializer;
  assert.ok(result);return result;
}
function bind(name,key,deps){return new Function(...Object.keys(deps),`return (${member(name,key).getText(ast)});`)(...Object.values(deps));}
function initialForm(){
  let result;
  function visit(node){
    if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)==='eventoForm')result=node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node,visit);
  }
  visit(ast);assert.ok(result);return result;
}
function payload(){return {...new Function(`return (${initialForm()});`)(),titulo:'Synthetic event',data_inicio:'2026-01-02',data_fim:'2026-01-02'};}

test('Agenda: full emitted runtime unchanged, including handlers, audit, scope and existing sync producer',()=>{
  const emitted=ts.transpileModule(primitiveUiBoundaryRemainder(file,source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),'af4c1d9eeb172ace8fd6aa033a62d079a6aca8c611068ec1ae6bc38c3833b0c8');
});

test('four actual Agenda command parameters accept current form and reject invalid payloads',()=>{
  const cases=[
    ['createEventoMutation','eventoForm',"{...eventoForm,data_inicio:123}"],
    ['updateEventoMutation',"{id:'synthetic-event',data:eventoForm}","{id:'synthetic-event'}"],
    ['deleteEventoMutation',"'synthetic-event'",'123'],
    ['concluirEventoMutation',"{id:'synthetic-event',custom:true}","{id:123}"],
  ];
  let fixture=`import {useMutation} from '@tanstack/react-query';\nconst eventoForm=${initialForm()};\n`;
  for(const [i,[name,good]] of cases.entries())fixture+=`const c${i}=useMutation({mutationFn:async (${member(name,'mutationFn').parameters[0].getFullText(ast)})=>{}});\nc${i}.mutate(${good});\n`;
  const firstNegative=fixture.split('\n').length-1;
  for(const [i,[,,bad]] of cases.entries())fixture+=`c${i}.mutate(${bad});\n`;
  const filename=path.resolve('tests/synthetic-agenda-command.js');
  const options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;
  host.readFile=p=>path.resolve(p)===filename?fixture:read(p);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,4,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),cases.map((_,i)=>firstNegative+i));
  assert.ok(errors.every(e=>[2322,2345].includes(e.code)));
});

test('create preserves stamped payload, date defaults and notification opt-in branches',async()=>{
  for(const flags of [{},{participantes:['synthetic-participant']},{notificar_email:true},{notificar_whatsapp:true}]){
    const writes=[],notifications=[],data={...payload(),...flags};
    const run=bind('createEventoMutation','mutationFn',{
      base44:{entities:{Evento:{create:async p=>{writes.push(p);return {id:'synthetic-event'};}},Notificacao:{create:async p=>notifications.push(p)}}},
      carimbarContexto:p=>({...p,group_id:'synthetic-group',empresa_id:'synthetic-a'}),
      user:{id:'synthetic-user',full_name:'Synthetic user',email:'user@example.invalid'},window:{location:{href:'https://example.invalid/agenda'}},
    });
    assert.deepEqual(await run(data),{id:'synthetic-event'});
    assert.equal(writes.length,1);assert.equal(writes[0].empresa_id,'synthetic-a');assert.equal(writes[0].group_id,'synthetic-group');
    assert.equal(writes[0].data_inicio,'2026-01-02T00:00:00');assert.equal(writes[0].data_fim,'2026-01-02T23:59:00');
    assert.equal(writes[0].responsavel_id,'synthetic-user');
    assert.equal(notifications.length,Object.keys(flags).length?1:0);
    if(notifications.length)assert.equal(notifications[0].registro_id,'synthetic-event');
  }
});

test('create propagates failed persistence without sending a notification',async()=>{
  let notifications=0;
  const run=bind('createEventoMutation','mutationFn',{
    base44:{entities:{Evento:{create:async()=>{throw new Error('synthetic write failure');}},Notificacao:{create:async()=>notifications++}}},
    carimbarContexto:p=>p,user:{id:'synthetic-user'},
  });
  await assert.rejects(run({...payload(),notificar_email:true}),/synthetic write failure/);assert.equal(notifications,0);
});

test('edit and conclude forward the same record through existing context helper; delete keeps existing ID contract',async()=>{
  const calls=[];
  const deps={updateInContext:async(...args)=>{calls.push(args);return {id:args[1]};}};
  const edit=bind('updateEventoMutation','mutationFn',deps);
  const data={...payload(),hora_inicio:'09:15',hora_fim:'10:45'};
  await edit({id:'synthetic-event',data});
  assert.deepEqual(calls[0],['Evento','synthetic-event',{...data,data_inicio:'2026-01-02T09:15:00',data_fim:'2026-01-02T10:45:00'}]);
  const conclude=bind('concluirEventoMutation','mutationFn',deps);
  const row={id:'synthetic-event',empresa_id:'synthetic-a',group_id:'synthetic-group',status:'Agendado',custom:7};
  await conclude(row);assert.deepEqual(calls[1],['Evento',row.id,{...row,status:'Conclu\u00eddo'}]);
  const ids=[];const remove=bind('deleteEventoMutation','mutationFn',{base44:{entities:{Evento:{delete:async id=>ids.push(id)}}}});
  await remove(row.id);assert.deepEqual(ids,[row.id]);
});

test('update and conclude propagate context-helper denial unchanged',async()=>{
  const deps={updateInContext:async()=>{throw new Error('synthetic scope denial');}};
  await assert.rejects(async()=>bind('updateEventoMutation','mutationFn',deps)({id:'synthetic-event',data:payload()}),/synthetic scope denial/);
  await assert.rejects(async()=>bind('concluirEventoMutation','mutationFn',deps)({id:'synthetic-event'}),/synthetic scope denial/);
});

test('success callbacks await audit before invalidation and UI reset; audit errors propagate',async()=>{
  for(const name of ['createEventoMutation','updateEventoMutation','deleteEventoMutation','concluirEventoMutation']){
    for(const fail of [false,true]){
      const effects=[],audits=[];
      const deps={base44:{entities:{AuditLog:{create:async p=>{audits.push(p);effects.push('audit');if(fail)throw new Error('synthetic audit failure');}}}},
        user:{id:'synthetic-user'},queryClient:{invalidateQueries:p=>effects.push(p)},
        setEventoDialogOpen:v=>effects.push(['dialog',v]),resetForm:()=>effects.push('reset'),
        setVisualizandoEvento:v=>effects.push(['view',v]),toast:()=>effects.push('toast')};
      const run=bind(name,'onSuccess',deps),row={id:'synthetic-event',titulo:'Synthetic event'};
      const args=name==='createEventoMutation'?[row]:name==='updateEventoMutation'?[row,{id:row.id,data:row}]:name==='deleteEventoMutation'?[row,row.id]:[row,row];
      if(fail){await assert.rejects(run(...args),/synthetic audit failure/);assert.deepEqual(effects,['audit']);}
      else{await run(...args);assert.equal(effects[0],'audit');assert.deepEqual(effects[1],{queryKey:['eventos']});assert.equal(effects.at(-1),'toast');}
      assert.equal(audits.length,1);assert.equal(audits[0].registro_id,row.id);assert.equal(audits[0].usuario_id,'synthetic-user');
    }
  }
});
