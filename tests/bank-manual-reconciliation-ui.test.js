import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {buildBankReconciliationCommand} from '../src/components/financeiro/conciliacao/bankReconciliationUiPolicy.js';
import {bankManualReconciliationHunks,bankManualReconciliationRemainder} from './helpers/bankManualReconciliationRemainder.js';
import {consolidation80Hunks} from './helpers/consolidation80Remainder.js';

const file='src/components/financeiro/ExtratoBancarioImportDialog.jsx';
const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
const scope={groupId:'11111111-1111-4111-8111-111111111111',empresaId:'22222222-2222-4222-8222-222222222222',actorId:'33333333-3333-4333-8333-333333333333'};
const accountId='44444444-4444-4444-8444-444444444444',movementId='55555555-5555-4555-8555-555555555555',batchId='66666666-6666-4666-8666-666666666666',operationId='77777777-7777-4777-8777-777777777777',otherId='88888888-8888-4888-8888-888888888888';
const bank={sourceId:'SYNTHETIC-FIT',postedRaw:'20261016103000[-3:BRT]',amountRaw:'-90071992547409.93',amountMinor:'-9007199254740993',identityHash:'a'.repeat(64),contentHash:'b'.repeat(64)};
const page={batchId,sourceSha256:'c'.repeat(64),statementHash:'d'.repeat(64),total:1,limit:50,offset:0,data:[bank]};
const movement={groupId:scope.groupId,empresaId:scope.empresaId,id:movementId,accountId,currency:'BRL',amountMinor:bank.amountMinor,occurredAt:'2026-10-16T10:30:00-03:00',revision:'1',state:'POSTED',origin:'MANUAL',linked:false};
const movementPage={accountId,total:1,limit:20,offset:0,data:[movement]};
function named(name){let result;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name){assert.ok(result===undefined);result=n.getText(ast);}ts.forEachChild(n,visit);}visit(ast);assert.ok(result,name);return result;}
function fixture(overrides={}){
 const state={pending:false,error:'',receipt:null,selected:movementId,closed:0},calls=[];
 const env={scope,accountId,batchId,page:structuredClone(page),movementOffset:0,sourceIdentityHash:bank.identityHash,movementId,
  busy:{current:false},alive:{current:true},controller:{current:new AbortController()},command:{current:null},uncertain:{current:false},
  permissions:{current:{canReadMovements:true,canReconcile:true,canReverseLink:true}},
  setPending:value=>{state.pending=value;},setError:value=>{state.error=value;},setLinkReceipt:value=>{state.receipt=value;},setMovementId:value=>{state.selected=value;},
  crypto:{randomUUID:()=>{calls.push('uuid');return operationId;}},buildBankReconciliationCommand,
  bankStatementApi:{page:async(_scope,input)=>{calls.push(['source',input]);return structuredClone(page);}},
  financialMovementApi:{list:async(_scope,input)=>{calls.push(['list',input]);return structuredClone(movementPage);},
   reconcile:async(_scope,command)=>{calls.push(['link',structuredClone(command)]);return {id:command.operationId,active:true,replay:false};},
   reverseLink:async(_scope,command)=>{calls.push(['reverse',structuredClone(command)]);return {id:command.operationId,active:false,replay:false};}},
  movements:{refetch:async()=>{calls.push('refetch');}},links:{refetch:async()=>{calls.push('history-refetch');}},
  setProposals:()=>{},onClose:()=>{state.closed++;},...overrides};
 const bind=name=>new Function(...Object.keys(env),'linkReceipt',`${named(name)};return ${name};`)(...Object.values(env),state.receipt);
 return {state,env,calls,run:reverse=>bind('reconcileSource')(reverse),close:()=>bind('requestClose')()};
}
for(const file of Object.keys(bankManualReconciliationHunks))test(file+': full previous source outside exact manual-link integration',()=>{
 const text=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');bankManualReconciliationRemainder(file,text);
 assert.throws(()=>bankManualReconciliationRemainder(file,text+'\n// unrelated'));
 const [oldHunk]=bankManualReconciliationHunks[file].hunks[0];
 const hunk=text.includes(oldHunk)?oldHunk:consolidation80Hunks[file].hunks[0][0];
 assert.throws(()=>bankManualReconciliationRemainder(file,text.replace(hunk,'')));assert.throws(()=>bankManualReconciliationRemainder(file,text+hunk));
});
test('pair policy preserves exact signed cents and raw evidence; duplicate, cross-company, linked and reversed input blocks',()=>{
 const input={scope,accountId,source:page,movements:movementPage,sourceIdentityHash:bank.identityHash,movementId,operationId};
 assert.deepEqual(buildBankReconciliationCommand(input),{accountId,operationId,movementId,movementRevision:'1',batchId,identityHash:bank.identityHash,contentHash:bank.contentHash});
 for(const patch of [{amountMinor:'9007199254740993'},{amountMinor:'-9007199254740992'},{linked:true},{state:'REVERSED'},{revision:'2'},{groupId:otherId},{empresaId:otherId},{accountId:otherId}])assert.throws(()=>buildBankReconciliationCommand({...input,movements:{...movementPage,data:[{...movement,...patch}]}}));
 assert.throws(()=>buildBankReconciliationCommand({...input,movementId:otherId}));
 assert.throws(()=>buildBankReconciliationCommand({...input,source:{...page,total:2,data:[bank,bank]}}));
 assert.equal(buildBankReconciliationCommand({...input,source:{...page,data:[{...bank,amountRaw:'0.00',amountMinor:'0'}]},
  movements:{...movementPage,data:[{...movement,amountMinor:'0'}]}}).movementId,movementId);
});
test('actual link handler rereads both canonical pages and submits only an explicit 1:1 command; unlink leaves movement alone',async()=>{
 const f=fixture();await f.run(false);assert.equal(f.state.receipt.active,true);assert.equal(f.env.uncertain.current,false);
 assert.deepEqual(f.calls.map(c=>Array.isArray(c)?c[0]:c),['source','list','uuid','link','refetch','history-refetch']);
 assert.deepEqual(f.calls[0][1],{accountId,batchId,limit:50,offset:0,statementHash:page.statementHash});
 assert.deepEqual(f.calls[1][1],{accountId,limit:20,offset:0});assert.equal(f.env.command.current.movementRevision,'1');
 const saved=structuredClone(f.env.command.current);await f.run(true);assert.equal(f.state.receipt.active,false);assert.equal(f.env.command.current,null);assert.equal(f.state.selected,'');
 assert.deepEqual(f.calls.find(c=>Array.isArray(c)&&c[0]==='reverse')[1],saved);
 assert.equal('reverseMovement' in f.env.financialMovementApi,false);assert.equal(f.calls.filter(c=>c==='uuid').length,1);
});
test('actual command blocks no read grant, no action grant, missing source and source/query failures before writing',async()=>{
 for(const mode of ['read','write','page','query','pair']){
  const f=fixture();if(mode==='read')f.env.permissions.current.canReadMovements=false;if(mode==='write')f.env.permissions.current.canReconcile=false;if(mode==='page')f.env.page=null;
  if(mode==='query')f.env.financialMovementApi.list=async()=>{throw new Error('SYNTHETIC_SECRET');};
  if(mode==='pair')f.env.financialMovementApi.list=async()=>({...movementPage,data:[{...movement,linked:true}]});
  await f.run(false);assert.ok(!f.calls.some(c=>Array.isArray(c)&&c[0]==='link'));assert.equal(f.state.receipt,null);assert.ok(!f.state.error.includes('SYNTHETIC_SECRET'));assert.equal(f.env.uncertain.current,false);
 }
});
test('late permission change or abort after source read prevents the next read/write; late write revocation hides receipt',async()=>{
 for(const mode of ['revoke','abort']){
  const f=fixture();f.env.bankStatementApi.page=async()=>{if(mode==='revoke')f.env.permissions.current.canReconcile=false;else f.env.controller.current.abort();return page;};
  await f.run(false);assert.equal(f.calls.length,0);assert.equal(f.state.receipt,null);
 }
 const f=fixture();f.env.financialMovementApi.reconcile=async()=>{f.env.permissions.current.canReconcile=false;return {id:operationId,active:true,replay:false};};
 await f.run(false);assert.equal(f.state.receipt,null);assert.equal(f.env.uncertain.current,true);assert.equal(f.env.command.current.operationId,operationId);
});
test('double click submits once; ambiguous retry preserves identical operation ID and command, never manufactures a new posting',async()=>{
 const f=fixture();let finish,entered;const started=new Promise(resolve=>{entered=resolve;});
 f.env.financialMovementApi.reconcile=async(_scope,cmd)=>{f.calls.push(['link',structuredClone(cmd)]);entered();return new Promise(resolve=>{finish=resolve;});};
 const first=f.run(false);await started;await f.run(false);assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0]==='link').length,1);
 finish({id:operationId,active:true,replay:false});await first;
 const retry=fixture();let writes=0;retry.env.financialMovementApi.reconcile=async(_scope,cmd)=>{retry.calls.push(['link',structuredClone(cmd)]);if(++writes===1)throw new Error('SYNTHETIC_SECRET');return {id:cmd.operationId,active:true,replay:true};};
 await retry.run(false);assert.equal(retry.env.uncertain.current,true);retry.close();assert.equal(retry.state.closed,0);
 await retry.run(false);assert.equal(retry.state.receipt.replay,true);assert.equal(retry.calls.filter(c=>c==='uuid').length,1);
 const commands=retry.calls.filter(c=>Array.isArray(c)&&c[0]==='link');assert.deepEqual(commands[0][1],commands[1][1]);
});
test('reverse action requires its own grant; failed refresh never turns a confirmed receipt into an uncertain write',async()=>{
 const f=fixture();await f.run(false);f.env.permissions.current.canReverseLink=false;await f.run(true);assert.ok(!f.calls.some(c=>Array.isArray(c)&&c[0]==='reverse'));assert.equal(f.state.receipt.active,true);
 const refresh=fixture();refresh.env.movements.refetch=async()=>{throw new Error('SYNTHETIC_SECRET');};await refresh.run(false);assert.equal(refresh.state.receipt.active,true);assert.equal(refresh.env.uncertain.current,false);assert.match(refresh.state.error,/confirmado/);assert.ok(!refresh.state.error.includes('SYNTHETIC_SECRET'));
});
test('host canonical Caixa/PII/link/reverse permissions are independent; legacy aliases do not grant manual access',()=>{
 const host='src/components/financeiro/ConciliacaoBancariaTab.jsx',tree=ts.createSourceFile(host,fs.readFileSync(host,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),found={};
 function visit(node){if(ts.isVariableDeclaration(node)&&['podeLerMovimentos','podeVincularFonte','podeDesfazerVinculo'].includes(node.name.getText(tree)))found[node.name.getText(tree)]=node.initializer.getText(tree);ts.forEachChild(node,visit);}visit(tree);
 const evaluate=grants=>new Function('hasPermission','podeLerFonte',`const podeLerMovimentos=${found.podeLerMovimentos};return {read:podeLerMovimentos,link:${found.podeVincularFonte},reverse:${found.podeDesfazerVinculo}};`)((...args)=>grants.has(args.join('.')),true);
 const read=['Financeiro.Caixa.visualizar','Financeiro.Caixa.dados-sensiveis.visualizar'];assert.deepEqual(evaluate(new Set(read)),{read:true,link:false,reverse:false});
 assert.deepEqual(evaluate(new Set([...read,'Financeiro.conciliacao.conciliar'])),{read:true,link:true,reverse:false});
 assert.deepEqual(evaluate(new Set([...read,'Financeiro.conciliacao.estornar'])),{read:true,link:false,reverse:true});
 assert.deepEqual(evaluate(new Set([...read,'Financeiro.ContaReceber.conciliar','Financeiro.conciliacao.editar'])),{read:true,link:false,reverse:false});
});
test('manual buttons require human confirmation; absent movement permission query handler cannot call transport',async()=>{
 const attrs=[];let query;
 function visit(n){if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='onClick'&&n.initializer?.expression?.getText(ast).includes('reconcileSource'))attrs.push(n.initializer.expression.getText(ast));
 if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='movements')query=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(ast);assert.equal(attrs.length,3);
 for(const text of attrs){let calls=0;new Function('window','reconcileSource',`return (${text});`)({confirm:()=>false},()=>calls++)();assert.equal(calls,0);}
 const fn=query.properties.find(p=>p.name?.getText(ast)==='queryFn').initializer.getText(ast);
 let reads=0;const callback=new Function('permissions','page','accountId','financialMovementApi',`return (${fn});`)({current:{canReadMovements:false}},page,accountId,{list:()=>reads++});
 assert.throws(()=>callback({signal:new AbortController().signal}));assert.equal(reads,0);
 const key=query.properties.find(p=>p.name?.getText(ast)==='queryKey').initializer.getText(ast);
 assert.deepEqual(new Function('scope','accountId','movementOffset',`return (${key});`)(scope,accountId,20),['bank-source-movements',scope.actorId,scope.groupId,scope.empresaId,accountId,20]);
});
