import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {readBoundaryRemainder} from './helpers/readBoundaryRemainder.js';
import {filtrarFilaAtendimento,ordenarFilaAtendimento,buildAssumirConversa} from '../src/components/lib/atendimentoConversaPolicy.js';

const policy='src/components/lib/atendimentoConversaPolicy.js',tags='src/components/chatbot/TagsCategorizacao.jsx';
const queue='src/components/chatbot/ChatbotFilaEspera.jsx',chat='src/pages/ChatbotAtendimento.jsx';
for(const [file,hash] of [
  [policy,'205bfcc4ae90b8a0665f8e1896b6e33812e2c5e5c39dd7f0dc0e320cf4c18d51'],
  [tags,'8f84f0cbf472b810e769dc3ec1cf7d4a50f3591016f8ed6703ccb561441e6b46'],
  [queue,'4273dc5de415d4f5ca704329853b051da2b6b4cebd86708f495c0f36f99e2e6a'],
  [chat,'02a2f24dfdf119960e5ef8aed2f5932c67b155eb4dfe6de00b41e6c27444a959'],
])test(`${file}: full executable runtime unchanged by annotations`,()=>{
  const output=ts.transpileModule(readBoundaryRemainder(file,fs.readFileSync(file,'utf8')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(output).digest('hex'),hash);
});
function command(file,name){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let fn;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.equal(fn,undefined);fn=node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)==='mutationFn').initializer;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(fn);return {ast,fn};
}
function bind(file,name,deps){const {ast,fn}=command(file,name);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}

test('queue generics preserve concrete record fields but never validate unknown fields; actual commands reject invalid payloads',()=>{
  const cases=[
    [tags,'salvarTagsMutation',"['Synthetic']",'[123]'],
    [queue,'assumirMutation',"{id:'synthetic-conversation',custom:1}",'{id:false}'],
    [chat,'enviarMensagemMutation',"'Synthetic message'",'123'],
  ];
  let source=`import {useMutation} from '@tanstack/react-query';
import {filtrarFilaAtendimento,ordenarFilaAtendimento} from '../lib/atendimentoConversaPolicy';
const rows=[{id:'synthetic-conversation',status:'Nova',cliente_nome:'Synthetic',custom:{count:1}}];
const ordered=ordenarFilaAtendimento(rows);
/** @type {number} */ const count=ordered[0].custom.count;
/** @type {string} */ const name=filtrarFilaAtendimento(rows)[0].cliente_nome;
/** @type {import('../lib/atendimentoConversaPolicy').AtendimentoRecord[]} */ const raw=[];
`;
  for(const [i,[file,name,good]] of cases.entries()){
    const {ast,fn}=command(file,name);source+=`const c${i}=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\nc${i}.mutate(${good});\n`;
  }
  const negatives=cases.map((entry,i)=>`c${i}.mutate(${entry[3]});`);
  negatives.push('/** @type {string} */ const unvalidated=ordenarFilaAtendimento(raw)[0].cliente_nome;','ordenarFilaAtendimento([123]);','filtrarFilaAtendimento([{id:false}]);');
  const firstNegative=source.split('\n').length-1;source+=negatives.join('\n')+'\n';
  const filename=path.resolve('src/components/chatbot/synthetic-queue-command.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,6,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),negatives.map((_,i)=>firstNegative+i));
});

test('real queue filter/sort keeps priority/sentiment/time ordering, object identity and input order',()=>{
  const rows=[
    {id:'normal-new',status:'Nova',prioridade:'Normal',created_date:'2026-01-02'},
    {id:'high',status:'Nova',prioridade:'Alta',created_date:'2026-01-02'},
    {id:'normal-old',status:'Nova',created_date:'2026-01-01'},
    {id:'urgent',status:'Nova',prioridade:'Urgente',created_date:'2026-01-02'},
    {id:'frustrated',status:'Nova',sentimento_geral:'Frustrado',created_date:'2026-01-02'},
    {id:'closed',status:'Resolvida',prioridade:'Urgente'},
  ];
  const original=[...rows],result=ordenarFilaAtendimento(rows);
  assert.deepEqual(result.map(row=>row.id),['urgent','high','frustrated','normal-old','normal-new']);
  assert.deepEqual(rows,original);for(const row of result)assert.equal(row,rows.find(item=>item.id===row.id));
  assert.equal(filtrarFilaAtendimento(rows).length,5);assert.deepEqual(ordenarFilaAtendimento(),[]);assert.deepEqual(ordenarFilaAtendimento(null),[]);
});

test('actual tag command preserves context/edit denial and forwards the same array',async()=>{
  for(const override of [{contextoValido:false},{canEditTags:false}]){
    const writes=[];const run=bind(tags,'salvarTagsMutation',{contextoValido:true,canEditTags:true,conversa:{id:'synthetic-conversation'},updateInContext:async(...args)=>writes.push(args),...override});
    await assert.rejects(run(['Synthetic']));assert.deepEqual(writes,[]);
  }
  const writes=[],values=['Synthetic','Another'];
  await bind(tags,'salvarTagsMutation',{contextoValido:true,canEditTags:true,conversa:{id:'synthetic-conversation'},updateInContext:async(...args)=>writes.push(args)})(values);
  assert.deepEqual(writes,[['ConversaOmnicanal','synthetic-conversation',{tags:values}]]);assert.equal(writes[0][2].tags,values);
});

function queueDeps(override={}){
  const writes=[];return {writes,deps:{canAssume:true,buildAssumirConversa,user:{id:'synthetic-user',full_name:'Synthetic'},empresaId:'synthetic-a',groupId:'synthetic-group',
    updateInContext:async(...args)=>writes.push(['update',...args]),createInContext:async(...args)=>writes.push(['create',...args]),...override}};
}
test('actual queue command preserves permission/company/owner/closed guards and same-owner replay',async()=>{
  const row={id:'synthetic-conversation',empresa_id:'synthetic-a',group_id:'synthetic-group',status:'Nova'};
  for(const [override,data] of [
    [{canAssume:false},row],[{}, {...row,empresa_id:'synthetic-b'}],[{}, {...row,atendente_id:'synthetic-other'}],[{}, {...row,status:'Resolvida'}],
  ]){
    const {writes,deps}=queueDeps(override);await assert.rejects(bind(queue,'assumirMutation',deps)(data));assert.deepEqual(writes,[]);
  }
  const replay=queueDeps();const owned={...row,status:'Em Progresso',atendente_id:'synthetic-user'};
  assert.equal(await bind(queue,'assumirMutation',replay.deps)(owned),owned);assert.deepEqual(replay.writes,[]);
});

test('actual queue command keeps update-before-audit and does not claim rollback for audit failure',async()=>{
  const row={id:'synthetic-conversation',empresa_id:'synthetic-a',group_id:'synthetic-group',status:'Nova'};
  const allowed=queueDeps();await bind(queue,'assumirMutation',allowed.deps)(row);
  assert.equal(allowed.writes.length,2);assert.equal(allowed.writes[0][0],'update');assert.equal(allowed.writes[1][0],'create');
  assert.equal(allowed.writes[0][2],row.id);assert.equal(allowed.writes[0][3].atendente_id,'synthetic-user');
  assert.equal(allowed.writes[1][1],'AuditLog');assert.equal(allowed.writes[1][2].empresa_id,row.empresa_id);
  const denied=queueDeps({createInContext:async()=>{throw new Error('synthetic audit failure');}});
  await assert.rejects(bind(queue,'assumirMutation',denied.deps)(row),/synthetic audit failure/);assert.equal(denied.writes.length,1);
});

test('actual chat command denies missing context, permission or session before intent/provider/storage',async()=>{
  for(const override of [{contextoValido:false},{canUseChatbot:false},{sessaoAtual:null}]){
    const calls=[];const run=bind(chat,'enviarMensagemMutation',{contextoValido:true,canUseChatbot:true,sessaoAtual:'synthetic-session',detectarIntent:async()=>calls.push('unexpected'),...override});
    await assert.rejects(run('Synthetic'));assert.deepEqual(calls,[]);
  }
});
