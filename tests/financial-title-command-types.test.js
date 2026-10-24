import { portalReadRemainder } from './helpers/portalReadRemainder.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {buildFinanceiroTitulosScopeSwitchReset} from '../src/components/financeiro/financeiroLaunchpadAccess.js';

const policy='src/components/financeiro/financeiroLaunchpadAccess.js';
const pagar='src/components/financeiro/ContasPagarTab.jsx',receber='src/components/financeiro/ContasReceberTab.jsx';
for(const [file,hash] of [[policy,'e67dfcf158ad233218fff8809ddff7c1a1e182a6dd5fac51eeb778e2ad25cb85'],[pagar,'0898138298e1e1ecc4981110d7d04e43e7eeb1207e744dfd5cbbf9fe25225d5b'],[receber,'cfdaadd2fddf6086814801b08ebf0dc0e941b22884360e02c2381ef41c2700cb']])test(`${file}: full executable runtime unchanged`,()=>{
  const emitted=ts.transpileModule(portalReadRemainder(file,fs.readFileSync(file,'utf8')),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),hash);
});
function parse(file){return ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);}
function command(file,name){
  const ast=parse(file);let fn;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.equal(fn,undefined);fn=node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)==='mutationFn').initializer;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(fn);return {ast,fn};
}
function bind(file,name,deps){const {ast,fn}=command(file,name);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
function initial(file){
  const ast=parse(file);let value;
  function visit(node){if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)==='dadosBaixa')value=node.initializer.arguments[0].getText(ast);ts.forEachChild(node,visit);}
  visit(ast);assert.ok(value);return value;
}
const names=['enviarParaCaixaMutation','baixarTituloMutation','baixarMultiplaMutation'];
test('six actual command parameters and reset overloads preserve pagar/receber shapes without erasing fallback union',()=>{
  let source=`import {useMutation} from '@tanstack/react-query';
import {buildFinanceiroTitulosScopeSwitchReset as reset} from '../src/components/financeiro/financeiroLaunchpadAccess';
const p=reset('pagar'),r=reset('receber'),d=reset();
/** @type {string} */ const dateP=p.dadosBaixa.data_pagamento;
/** @type {string} */ const dateR=r.dadosBaixa.data_recebimento;
/** @type {boolean} */ const dialog=d.gerarCobrancaDialogOpen;
`;
  const negativeLines=[];
  for(const file of [pagar,receber])for(const name of names){
    const {ast,fn}=command(file,name);
    source+=`{\nconst dadosBaixa=${initial(file)};\nconst c=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\n`;
    const good=name==='enviarParaCaixaMutation'?"[{id:'synthetic-record',valor:10}]":name==='baixarTituloMutation'?"{id:'synthetic-record',dados:dadosBaixa}":'dadosBaixa';
    const bad=name==='enviarParaCaixaMutation'?'[123]':name==='baixarTituloMutation'?'{id:123,dados:dadosBaixa}':"{...dadosBaixa,juros:'invalid'}";
    source+=`c.mutate(${good});\n`;negativeLines.push(source.split('\n').length-1);source+=`c.mutate(${bad});\n}\n`;
  }
  const filename=path.resolve('tests/synthetic-financial-title.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,negativeLines.length,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),negativeLines);
  // JS permits reads of missing inferred object properties; TS checks the exported shapes.
  const typedFilename=path.resolve('tests/synthetic-financial-reset.ts');
  const typedSource=`import {buildFinanceiroTitulosScopeSwitchReset as reset} from '../src/components/financeiro/financeiroLaunchpadAccess';
const p=reset('pagar'),r=reset('receber'),d=reset();
const dateP:string=p.dadosBaixa.data_pagamento;
const dateR:string=r.dadosBaixa.data_recebimento;
const dialog:boolean=d.gerarCobrancaDialogOpen;
p.dadosBaixa.data_recebimento;
r.dadosBaixa.data_pagamento;
reset(false);
reset('legacy-unknown-kind').dadosBaixa.valor_pago;
`;
  const typedHost=ts.createCompilerHost(options),typedRead=typedHost.readFile;
  typedHost.readFile=file=>path.resolve(file)===typedFilename?typedSource:typedRead(file);
  const typedErrors=ts.createProgram([typedFilename],options,typedHost).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===typedFilename);
  assert.deepEqual(typedErrors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),[5,6,7,8],JSON.stringify(typedErrors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
});

test('reset keeps distinct fields and fresh empty selections/rascunhos, including existing default/fallback behavior',()=>{
  const p=buildFinanceiroTitulosScopeSwitchReset('pagar'),r=buildFinanceiroTitulosScopeSwitchReset('receber');
  assert.equal(p.contaAtual,null);assert.equal(r.contaAtual,null);assert.deepEqual(p.contasSelecionadas,[]);assert.deepEqual(r.contasSelecionadas,[]);
  assert.notEqual(p.contasSelecionadas,r.contasSelecionadas);assert.equal(p.dadosBaixa.valor_pago,0);assert.equal(r.dadosBaixa.valor_recebido,0);
  assert.ok(!Object.hasOwn(p,'gerarCobrancaDialogOpen'));assert.equal(r.gerarCobrancaDialogOpen,false);
  assert.deepEqual(buildFinanceiroTitulosScopeSwitchReset(),r);assert.deepEqual(buildFinanceiroTitulosScopeSwitchReset('legacy-unknown-kind'),r);
});
function environment(override={}){
  const calls=[],audits=[];
  return {calls,audits,deps:{contextoValido:true,podeEnviarCaixaPagar:true,podeEnviarCaixaReceber:true,podeBaixarPagar:true,podeBaixarReceber:true,
    podeBaixarMultiplaPagar:override.podeBaixarPagar!==false,podeBaixarMultiplaReceber:override.podeBaixarReceber!==false,
    groupId:'synthetic-group',empresaId:'synthetic-a',authUser:{id:'synthetic-user',full_name:'Synthetic user'},
    window:{confirm:()=>true},sanitizeText:value=>String(value||'').trim(),
    contasList:[{id:'synthetic-record',valor:100,empresa_id:'synthetic-a',group_id:'synthetic-group',descricao:'Synthetic title'}],contasSelecionadas:['synthetic-record'],
    createInContext:async(...args)=>{calls.push(['create',...args]);return {id:'synthetic-created'};},
    updateInContext:async(...args)=>{calls.push(['update',...args]);return {id:args[1]};},
    auditarFinanceiro:async value=>audits.push(value),baixarTituloMutation:{mutateAsync:async value=>calls.push(['single',value])},...override}};
}
const form=file=>new Function(`return (${initial(file)});`)();
function payload(file,name){return name==='enviarParaCaixaMutation'?[{id:'synthetic-record',valor:100}]:name==='baixarTituloMutation'?{id:'synthetic-record',dados:form(file)}:form(file);}
test('six actual financial commands keep context and granular action denial before writes',async()=>{
  for(const file of [pagar,receber])for(const name of names){
    const permission=name==='enviarParaCaixaMutation'?(file===pagar?'podeEnviarCaixaPagar':'podeEnviarCaixaReceber'):(file===pagar?'podeBaixarPagar':'podeBaixarReceber');
    for(const override of [{contextoValido:false},{[permission]:false}]){
      const {calls,deps}=environment(override);await assert.rejects(bind(file,name,deps)(payload(file,name)));assert.deepEqual(calls,[]);
    }
  }
});

test('send-to-caixa rejects empty/nonpositive lists, awaits cancellation audit and preserves explicit operation type',async()=>{
  for(const file of [pagar,receber]){
    for(const input of [[],[{id:'synthetic-record',valor:0}]]){const {calls,deps}=environment();await assert.rejects(bind(file,names[0],deps)(input));assert.deepEqual(calls,[]);}
    const denied=environment({window:{confirm:()=>false}});await assert.rejects(bind(file,names[0],denied.deps)(payload(file,names[0])));assert.deepEqual(denied.calls,[]);assert.equal(denied.audits[0].sucesso,false);
    const allowed=environment();await bind(file,names[0],allowed.deps)(payload(file,names[0]));
    assert.equal(allowed.calls.length,1);const row=allowed.calls[0][2];assert.equal(allowed.calls[0][1],'CaixaOrdemLiquidacao');
    assert.equal(row.tipo_operacao,file===pagar?'Pagamento':'Recebimento');assert.equal(row.group_id,'synthetic-group');assert.equal(row.empresa_id,'synthetic-a');
    assert.equal(row.titulos_vinculados[0].titulo_id,'synthetic-record');assert.equal(row.valor_total,100);
  }
});

test('single and multiple commands preserve current calculations, write ordering and data forwarding only in synthetic dependencies',async()=>{
  for(const file of [pagar,receber]){
    const single=environment(),dados={...form(file),juros:2,multa:3,desconto:4,valor_recebido:101};
    await bind(file,'baixarTituloMutation',single.deps)({id:'synthetic-record',dados});
    if(file===pagar){assert.equal(single.calls[0][1],'CaixaMovimento');assert.equal(single.calls[0][2].valor,101);assert.equal(single.calls[1][1],'ContaPagar');}
    else{assert.equal(single.calls.length,1);assert.equal(single.calls[0][1],'ContaReceber');assert.equal(single.calls[0][3].valor_recebido,101);}
    const multiple=environment();await bind(file,'baixarMultiplaMutation',multiple.deps)(dados);
    assert.equal(multiple.calls.length,1);assert.equal(multiple.calls[0][0],'single');assert.equal(multiple.calls[0][1].id,'synthetic-record');
    if(file===pagar)assert.equal(multiple.calls[0][1].dados,dados);else assert.equal(multiple.calls[0][1].dados.valor_recebido,101);
  }
});

test('storage failure propagates without claiming transactionality or idempotency',async()=>{
  for(const file of [pagar,receber]){
    const fail=async()=>{throw new Error('synthetic storage failure');};
    const {deps}=environment({createInContext:fail,updateInContext:fail});
    await assert.rejects(bind(file,'baixarTituloMutation',deps)({id:'synthetic-record',dados:form(file)}),/synthetic storage failure/);
  }
});
