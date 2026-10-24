import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {primitiveUiEdits,primitiveUiBoundaryRemainder,reportRecoveryEdits} from './helpers/primitiveUiBoundaryRemainder.js';
import {assertSeparacaoChecklist} from '../src/components/lib/expedicaoFluxoOperacionalPolicy.js';

const hashes = [
  ['src/components/auditoria/LogsAuditoria.jsx','f53b4b621ff640917f6563bdebfa30776622e938d95bac5b51955817d8a79468'],
  ['src/components/expedicao/SeparacaoConferencia.jsx','9af59334bb27c7a5339dde13038db7139e3158f9e971b59470ed1509ed9db0c8'],
  ['src/components/expedicao/painel-logistico/ControlsBar.jsx','a52ba3fde12196a19cbbbb90251bb64ad423af80045ffd2dbb7b374902c00e81'],
  ['src/pages/Agenda.jsx','af4c1d9eeb172ace8fd6aa033a62d079a6aca8c611068ec1ae6bc38c3833b0c8'],
  ['src/pages/Relatorios.jsx','77f4036cb1c0fa5fdaefb96bff7483b2fc11d607be97139aa138891a80e7d4ee'],
  ['src/components/chatbot/MonitorSLA.jsx','1c502a26db270d419e5b58ac9afaee7bc82b818a01a8098ca89f53635698a006'],
  ['src/components/comercial/MonitoramentoCanaisRealtime.jsx','9c53a8836a3958abd3d2948c95eb691e9d74f16d063ca62a18d648f119856dff'],
  ['src/components/estoque/ControleLotesValidade.jsx','2be7914bbf1697d54f4610730e5f4c4077068f73cff615c2def39bb9c934901b'],
  ['src/components/expedicao/painel-logistico/AlertsPanel.jsx','28a3289b866db08bda07a3c589ddd14a6c1a5b10117910ef0b6d80163845a214'],
  ['src/components/expedicao/painel-logistico/BottlenecksPanel.jsx','ec3181c6ace8a34d0e6acffd6d041ee4c51553137593d7b2696d031f0c6b4645'],
  ['src/components/producao/RelatoriosProducao.jsx','723d550c7191303284206d36395eaffa4a87303ffc294a1ecd3c6ee76fd1ecbf'],
  ['src/components/portal/ChamadosCliente.jsx','6c06bd3e4e5faffc2744d2f30a732e498466321e188e68274fc2577e0c061b88'],
  ['src/components/chatbot/DashboardAtendente.jsx','ea837f257d99bb269547b841e80b395f9714a5ca3d9397070c05ba19be80997e'],
  ['src/components/crm/FunilVendasAvancado.jsx','f06224b74b17273cf6f10edb54d4c8bab18574990e7f968b0b9e674130ffa588'],
  ['src/pages/DashboardCorporativo.jsx','5b7e965aa4955815f753684167f36221e5b9d985355ec125603044e7919248de'],
  ['src/components/cadastros/DashboardCanaisOrigem.jsx','5753ef70c87aeb32d6f25e4be14892b88cf1aaf6bfd137fcd6c6dabbfc050dfb'],
  ['src/components/cadastros/HistoricoProduto.jsx','bfdd237c2e172268d275a6727778f72ad229b34f77057860525a87c5aa054c2c'],
  ['src/components/producao/DashboardRefugoIA.jsx','65e14a60239cbf60dee4ed080cf43e3c874d23187663497bb5fd0c70dac7192e'],
];
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const emit=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
const hash=source=>crypto.createHash('sha256').update(emit(source)).digest('hex');
function find(file,predicate){const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),found=[];function visit(node){if(predicate(node,tree))found.push(node);ts.forEachChild(node,visit);}visit(tree);return{tree,found};}
const evaluate=(expression,deps)=>new Function(...Object.keys(deps),`return (${expression});`)(...Object.values(deps));
for(const [file,beforeHash]of hashes)test(`${file}: exact primitive boundary edits only; remainder equals stage44`,()=>{
  assert.equal(hash(primitiveUiBoundaryRemainder(file,read(file))),beforeHash);
});
test('thirteen actual checkbox callbacks preserve booleans and map indeterminate to false without losing other fields',()=>{
  const counts={'src/components/auditoria/LogsAuditoria.jsx':3,'src/components/expedicao/SeparacaoConferencia.jsx':5,'src/pages/Agenda.jsx':4,'src/pages/Relatorios.jsx':1};let total=0;
  for(const [file,count]of Object.entries(counts)){
    const {tree,found}=find(file,node=>ts.isJsxAttribute(node)&&node.name.getText()==='onCheckedChange'&&node.initializer?.getText().includes('=== true'));
    assert.equal(found.length,count);total+=count;
    for(const attribute of found)for(const checked of [true,false,'indeterminate',undefined,null,'true',1]){
      const values=[],state={synthetic:'retained'},set=value=>values.push(value);
      const deps={setFiltroCritico:set,setShowDescricao:set,setShowIP:set,setChecklist:set,checklist:state,setEventoForm:set,eventoForm:state,setAgendamentoForm:set,agendamentoForm:state};
      evaluate(attribute.initializer.expression.getText(tree),deps)(checked);assert.equal(values.length,1);
      const value=values[0];if(typeof value==='object'){assert.equal(value.synthetic,'retained');const fields=Object.entries(value).filter(([key])=>key!=='synthetic');assert.equal(fields.length,1);assert.equal(fields[0][1],checked===true);}else assert.equal(value,checked===true);
    }
  }
  assert.equal(total,13);
});
test('indeterminate cannot complete the existing separation checklist',()=>{
  const file='src/components/expedicao/SeparacaoConferencia.jsx';const {tree,found}=find(file,node=>ts.isJsxAttribute(node)&&node.name.getText()==='onCheckedChange');
  let checklist={conferiu_quantidade:true,conferiu_qualidade:true,conferiu_embalagem:true,conferiu_etiquetas:true,conferiu_documentos:true};
  assert.equal(assertSeparacaoChecklist(checklist),true);
  for(const attribute of found){const prior={...checklist};evaluate(attribute.initializer.expression.getText(tree),{checklist:prior,setChecklist:value=>{checklist=value;}})('indeterminate');assert.throws(()=>assertSeparacaoChecklist(checklist),/incompleto/);checklist=prior;}
});
test('dialog state accepts only closed/rules/simulation values and keeps its original false initializer',()=>{
  const file='src/components/expedicao/painel-logistico/ControlsBar.jsx';const {tree,found}=find(file,node=>ts.isVariableDeclaration(node)&&node.name.getText()==='[open, setOpen]');assert.equal(found.length,1);
  const node=found[0];assert.ok(ts.isArrowFunction(node.initializer.arguments[0]));assert.equal(node.initializer.arguments[0].body.getText(tree),'false');
  const source=`import React from 'react';\n${node.parent.parent.getFullText(tree)}\nsetOpen(true);setOpen(false);setOpen('sim');\nsetOpen('other');\nsetOpen(1);\nconst rules=open===true, simulation=open==='sim';\n`;
  const filename=path.resolve('tests/synthetic-dialog-state.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),readFile=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:readFile(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);assert.equal(errors.length,2,errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n')).join('\n'));
  for(const value of [false,true,'sim'])assert.deepEqual([value===true,value==='sim'],value===false?[false,false]:value===true?[true,false]:[false,true]);
});
test('four actual tooltip formatters preserve finite values and never invent numeric data for unsupported values',()=>{
  let total=0;
  for(const file of ['src/components/cadastros/DashboardCanaisOrigem.jsx','src/components/cadastros/HistoricoProduto.jsx','src/components/producao/DashboardRefugoIA.jsx']){
    const {tree,found}=find(file,node=>ts.isJsxAttribute(node)&&node.name.getText()==='formatter'&&node.initializer?.getText().includes('Number.isFinite(value)'));
    for(const attribute of found){total++;const fn=evaluate(attribute.initializer.expression.getText(tree),{});
      const previous=evaluate(primitiveUiBoundaryRemainder(file,read(file)).match(/formatter=\{(\(value\) => `[^`]+`)\}/)?.[1]||'()=>null',{});
      for(const value of [0,1.25,-12.5,999999.99]){const result=fn(value);assert.ok(result.includes(value.toFixed(file.endsWith('DashboardRefugoIA.jsx')?1:2)));if(!file.endsWith('DashboardRefugoIA.jsx'))assert.equal(result,previous(value));}
      for(const value of [NaN,Infinity,-Infinity,'12',[],[1],null,undefined]){const result=fn(value);assert.ok(result.includes('-'));assert.equal(/NaN|Infinity|undefined|null/.test(result),false);}
    }
  }
  assert.equal(total,4);
});
test('six actual native Date operand conversions preserve timestamps, invalid dates and rounded durations',()=>{
  let count=0;const values=['2024-02-29T12:00:00Z','2024-11-03T01:30:00-04:00','2024-11-03T01:30:00-05:00','invalid','1970-01-01',0,-86400000];
  for(const edits of Object.values(primitiveUiEdits))for(const [after,before]of edits)if(after.includes('.getTime()')&&!after.startsWith('!')){
    count++;for(const value of values){const date=new Date(value),now=new Date('2026-10-20T12:00:00Z'),deps={agora:now,ultimaAtualizacao:date,dataValidade:date,hoje:now,now,prev:date,tsPronto:date,saida:date};const a=evaluate(after,deps),b=evaluate(before,deps);assert.ok(Object.is(a,b));for(const unit of [1000,36e5,86400000])for(const round of [Math.floor,Math.round])assert.ok(Object.is(round(a/unit),round(b/unit)));}
  }
  assert.equal(count,6);
});
test('numeric coercions in five indicator expressions and seven parseFloat calls preserve values and thresholds',()=>{
  const files=['src/components/chatbot/MonitorSLA.jsx','src/components/crm/FunilVendasAvancado.jsx','src/components/producao/RelatoriosProducao.jsx','src/components/chatbot/DashboardAtendente.jsx','src/pages/DashboardCorporativo.jsx'];let numbers=0,parses=0;
  for(const file of files){const {tree,found}=find(file,node=>ts.isBinaryExpression(node)&&ts.isCallExpression(node.left)&&node.left.expression.getText()==='Number'||ts.isCallExpression(node)&&node.expression.getText()==='parseFloat'&&node.arguments[0]?.getText().startsWith('String('));
    for(const node of found){const expression=node.getText(tree),number=ts.isBinaryExpression(node);number?numbers++:parses++;
      const previous=number?expression.replace(/Number\(([^)]+)\)/,'$1'):expression.replace(/parseFloat\(String\((.*)\)\)/,'parseFloat($1)');
      for(const value of [0,1,-1,5,20,100,'0','5.5','20.0','invalid','',NaN,Infinity]){const deps={metricas:{tfrMedio:value,trMedio:value,taxaConversao:value,tempoMedioResposta:value},metasSLA:{tempo_primeira_resposta_minutos:2,tempo_resolucao_minutos:4},variacaoCusto:value,taxaRefugo:value,otd:value};assert.ok(Object.is(evaluate(expression,deps),evaluate(previous,deps)));}
    }
  }
  assert.equal(numbers,5);assert.equal(parses,7);
});
test('rating prompt and Agenda date predicate retain their original accepted inputs without type assertions',()=>{
  const rating='src/components/portal/ChamadosCliente.jsx',r=find(rating,node=>ts.isIfStatement(node)&&node.expression.getText().includes('Number(nota)'));assert.equal(r.found.length,1);
  const current=r.found[0].expression.getText(r.tree),previous=current.replaceAll('Number(nota)','nota');for(const nota of [null,'','0','1','1.5','5','6','bad','Infinity',' 2 '])assert.ok(Object.is(evaluate(current,{nota}),evaluate(previous,{nota})));
  const agenda='src/pages/Agenda.jsx',a=find(agenda,node=>ts.isIfStatement(node)&&node.expression.getText()==='!Number.isNaN(parsed.getTime())');assert.equal(a.found.length,1);
  for(const value of ['invalid','2026-10-20','2024-02-29',0,null,undefined]){const parsed=new Date(value);assert.equal(evaluate(a.found[0].expression.getText(a.tree),{parsed}),!isNaN(parsed));}
});
test('exact boundary helper cannot hide missing, duplicate, reordered formulas or unrelated executable changes',()=>{
  assert.equal(hashes.length,18);assert.equal(Object.keys(primitiveUiEdits).length,18);
  for(const [file,edits]of Object.entries(primitiveUiEdits)){const source=read(file),[after]=edits[0];assert.throws(()=>primitiveUiBoundaryRemainder(file,source.replace(after,'SYNTHETIC_MISSING')));assert.throws(()=>primitiveUiBoundaryRemainder(file,source+'\n'+after));}
  const [file,beforeHash]=hashes[0];assert.notEqual(hash(primitiveUiBoundaryRemainder(file,read(file))+'\nthrow new Error("synthetic unrelated edit");'),beforeHash);
});

test('#348 recovery exclusions reject missing/duplicated hunks and preserve the original full-page remainder hash',()=>{
  const file='src/pages/Relatorios.jsx',source=read(file),beforeHash=hashes.find(([name])=>name===file)[1];
  assert.equal(hash(primitiveUiBoundaryRemainder(file,source)),beforeHash);
  for(const [after] of reportRecoveryEdits) {
    assert.throws(()=>primitiveUiBoundaryRemainder(file,source.replace(after,'')));
    assert.throws(()=>primitiveUiBoundaryRemainder(file,source+'\n'+after));
  }
  assert.notEqual(hash(primitiveUiBoundaryRemainder(file,source+'\nthrow new Error("synthetic unauthorized edit");')),beforeHash);
});
