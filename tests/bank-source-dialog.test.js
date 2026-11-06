import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const path='src/components/financeiro/ExtratoBancarioImportDialog.jsx';
const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
function namedFunction(name){
  let result;
  function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)result=node.getText(ast);ts.forEachChild(node,visit);}
  visit(ast);assert.ok(result,`${name} actual component function`);return result;
}
function fixture(overrides={}){
  const state={page:null,file:new File(['SYNTHETIC'],'test.ofx'),pending:false,error:'',offset:0};
  const env={scope:{groupId:'group',empresaId:'company',actorId:'actor'},accountId:'original-account',batchId:'stable-batch',
    file:state.file,page:null,canImport:true,pinned:false,setSourceIdentityHash:()=>{},setProposals:()=>{},busy:{current:false},alive:{current:true},controller:{current:new AbortController()},
    setPending:v=>{state.pending=v;},setError:v=>{state.error=v;},setPage:v=>{state.page=v;},
    setOffset:v=>{state.offset=v;},setFile:v=>{state.file=v;},bankStatementApi:{upload:async()=>{},page:async()=>({total:1,data:[]})},...overrides};
  const load=new Function(...Object.keys(env),`${namedFunction('load')};return load;`)(...Object.values(env));
  return {state,env,load};
}

test('actual dialog handler awaits audited upload then reads exact batch and blocks double click',async()=>{
  let finish,calls=0,reads=0;
  let started;const entered=new Promise(resolve=>{started=resolve;});
  const f=fixture({bankStatementApi:{upload:async(scope,input)=>{
    calls++;assert.equal(input.accountId,'original-account');assert.equal(input.batchId,'stable-batch');
    assert.equal(await input.file.text(),'SYNTHETIC');await new Promise(resolve=>{finish=resolve;started();});
  },page:async(scope,input)=>{reads++;assert.equal(input.batchId,'stable-batch');return {total:1,data:[]};}}});
  const first=f.load(true,0);await entered;await f.load(true,0);assert.equal(calls,1);assert.equal(reads,0);
  finish();await first;assert.equal(reads,1);assert.equal(f.state.file,null);assert.equal(f.state.pending,false);
});

test('actual dialog handler retains same file and batch after failure, never reads or leaks server errors',async()=>{
  let reads=0,calls=0;
  const f=fixture({bankStatementApi:{upload:async(_scope,input)=>{calls++;assert.equal(input.batchId,'stable-batch');throw new Error('PRIVATE BANK RAW');},
    page:async()=>{reads++;}}});
  await f.load(true,0);await f.load(true,0);
  assert.equal(calls,2);assert.equal(reads,0);assert.ok(f.state.file);assert.ok(f.state.error);
  assert.ok(!f.state.error.includes('PRIVATE'));assert.equal(f.env.busy.current,false);
});

test('actual source paging preserves source hash and never creates financial records',async()=>{
  const f=fixture({page:{statementHash:'verified-hash'},bankStatementApi:{upload:async()=>{throw new Error('unexpected upload');},
    page:async(_scope,input)=>{assert.equal(input.offset,50);assert.equal(input.limit,50);
      assert.equal(input.statementHash,'verified-hash');return {total:101,data:[{amountRaw:'-0.01',sourceId:'0001'}]};}}});
  await f.load(false,50);assert.equal(f.state.offset,50);assert.equal(f.state.page.data[0].amountRaw,'-0.01');
  assert.doesNotMatch(source,/createInContext|InvokeLLM|CaixaMovimento|ContaPagar|ContaReceber|localStorage/);
});

test('actual dialog handler discards late upload on close and denies unauthorized upload before API',async()=>{
  let reads=0;
  const f=fixture();
  f.env.bankStatementApi.upload=async()=>{f.env.alive.current=false;f.env.controller.current.abort();};
  f.env.bankStatementApi.page=async()=>{reads++;};
  await f.load(true,0);assert.equal(reads,0);assert.equal(f.state.page,null);
  const denied=fixture({canImport:false,bankStatementApi:{upload:async()=>{throw new Error('must not call');},page:async()=>{reads++;}}});
  await denied.load(true,0);assert.equal(reads,0);assert.ok(denied.state.file);
});

test('account pagination resets selected identity, batch, file and page; host keys actor and company',()=>{
  const values={};
  const names=['setAccountOffset','setAccountId','setBatchId','setFile','setPage','setOffset','setError','setMovementOffset','setMovementId','setSourceIdentityHash','setLinkReceipt','setProposals','setLinkOffset','setRecoveryId'];
  const command={current:{synthetic:true}};
  const move=new Function(...names,'command',`${namedFunction('moveAccounts')};return moveAccounts;`)(...names.map(name=>value=>{values[name]=value;}),command);
  move(20);assert.deepEqual(values,{setAccountOffset:20,setAccountId:'',setBatchId:'',setFile:null,setPage:null,setOffset:0,setError:'',setMovementOffset:0,setMovementId:'',setSourceIdentityHash:'',setLinkReceipt:null,setProposals:[],setLinkOffset:0,setRecoveryId:''});assert.equal(command.current,null);
  const host=readFileSync(new URL('../src/components/financeiro/ConciliacaoBancariaTab.jsx',import.meta.url),'utf8');
  assert.match(host,/sourceOpen&&sourceScope&&podeLerFonte&&<ExtratoBancarioImportDialog/);
  assert.match(host,/sourceScope.actorId.*sourceScope.groupId.*sourceScope.empresaId/);
  assert.match(host,/onClick=\{\(\)=>setSourceOpen\(true\)\}/);
});

test('real lifecycle cancels and closes on session change, removes listener on unmount',()=>{
  let expression;
  function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect')expression=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}
  visit(ast);assert.ok(expression);
  let listener,closed=0,removed=0;
  const alive={current:false},controller={current:new AbortController()};
  const window={addEventListener:(name,fn)=>{assert.equal(name,'context');listener=fn;},
    removeEventListener:(name,fn)=>{assert.equal(name,'context');assert.equal(fn,listener);removed++;}};
  const effect=new Function('window','HTTP_CONTEXT_CHANGED','alive','controller','close',`return (${expression});`)(
    window,'context',alive,controller,{current:()=>{closed++;}});
  const cleanup=effect();assert.equal(alive.current,true);
  listener();assert.equal(closed,1);assert.equal(controller.current.signal.aborted,true);assert.equal(alive.current,false);
  cleanup();assert.equal(removed,1);
});
