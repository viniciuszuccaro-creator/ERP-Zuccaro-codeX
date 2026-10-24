import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {stampAutomacaoResult} from '../src/components/lib/automacaoAvancadaPolicy.js';
import {metricEvidenceHunks,metricEvidenceRemainder} from './helpers/metricEvidenceRemainder.js';

const dashboard='src/components/producao/DashboardProducaoRealtime.jsx',policy='src/components/lib/automacaoAvancadaPolicy.js';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true};
for(const [file,hash] of [[dashboard,'2ff5577129e4ce9470efd37a5bd28468e912b7b28da666e8319eacda3f82b2a7'],[policy,'0cde0308e345267c4a327712c1ab253106c9aaa4ed4f51dd95d8536d1c5d7f7c']])test(`${file}: whole stage62 source retained outside exact evidence/result hunks`,()=>{
 const source=read(file);assert.equal(crypto.createHash('sha256').update(metricEvidenceRemainder(file,source)).digest('hex'),hash);
 for(const [after] of metricEvidenceHunks[file]){
  assert.throws(()=>metricEvidenceRemainder(file,source.replace(after,'')));
  assert.throws(()=>metricEvidenceRemainder(file,source.replace(after,after+after)));
 }
 if(file===policy){const emit=text=>ts.transpileModule(text,{compilerOptions:{...options,removeComments:true}}).outputText;assert.equal(emit(source),emit(metricEvidenceRemainder(file,source)));}
});
const ui=new Proxy({}, {get:(_,name)=>name==='__esModule'?true:({children})=>React.createElement('div',null,children)});
function loadDashboard({before=false,ops=[],apontamentos=[],metricas,allowed=true,contextValid=true}={}){
 const effects=[],updates=[],queries=[];
 const react={...React,useState:initial=>[metricas??initial,value=>updates.push(value)],useEffect:callback=>effects.push(callback)};
 const dependencies={react,'@tanstack/react-query':{useQuery:options=>{queries.push(options);return {data:options.queryKey[0]==='ordens-producao-dashboard'?ops:apontamentos};}},
  '@/api/base44Client':{base44:{}},'lucide-react':ui,recharts:ui,
  '@/components/lib/usePermissions':()=>({hasPermission:()=>allowed}),
  '@/components/lib/useContextoVisual':{useContextoVisual:()=>({contexto:'empresa',empresaAtual:contextValid?{id:'synthetic-e',group_id:'synthetic-g'}:null,grupoAtual:contextValid?{id:'synthetic-g'}:null,filterInContext:()=>assert.fail('no real query execution')})},
 };
 for(const key of ['card','badge'])dependencies['@/components/ui/'+key]=ui;
 const source=before?metricEvidenceRemainder(dashboard,read(dashboard)):read(dashboard),exports={};
 const code=ts.transpileModule(source,{compilerOptions:options}).outputText;
 new Function('require','exports',code)(name=>{assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name];},exports);
 const render=()=>exports.default.type({});
 return {exports,render,effects,updates,queries};
}
test('OEE formula retains valid measurements, including measured zero, without creating a missing availability value',()=>{
 const {calcularOEE}=loadDashboard().exports;
 for(const a of [0,33.3,85,100])for(const p of [0,50,100])for(const q of [0,99,100])assert.equal(calcularOEE(a,p,q),a*p*q/10000);
});
test('OEE rejects unknown/invalid factors without coercion, clamping or a synthetic 85 percent fallback',()=>{
 const {calcularOEE}=loadDashboard().exports;let coerced=false;const opaque={valueOf(){coerced=true;throw Error('unexpected coercion');}};
 for(const value of [null,undefined,NaN,Infinity,-1,101,'85',false,[],opaque])for(const index of [0,1,2]){
  const args=[100,100,100];args[index]=value;assert.equal(calcularOEE(...args),null);
 }
 assert.equal(coerced,false);
});
test('actual effect counterproof: a fabricated 85 percent OEE becomes unknown; all measured non-OEE outputs retain precision',()=>{
 const data={ops:[{status:'Em Corte',progresso_fisico_percentual:90,data_previsao_conclusao:'2099-01-01'}],apontamentos:[{data_hora_inicio:new Date().toISOString(),peso_produzido_kg:100,peso_refugo_kg:0,tempo_total_minutos:60}]};
 const current=loadDashboard(data),old=loadDashboard({...data,before:true});current.render();old.render();
 for(const fn of current.effects)fn();for(const fn of old.effects)fn();
 assert.equal(current.updates.length,1);assert.equal(old.updates.length,1);
 const {oee,...remaining}=current.updates[0],{oee:oldOee,...oldRemaining}=old.updates[0];
 assert.equal(oee,null);assert.equal(oldOee,'85.0');assert.deepEqual(remaining,oldRemaining);
 assert.deepEqual(remaining,{eficienciaGeral:'100.0',opsAtrasadas:0,pesoProducaoHoje:'100.00',tempoMedioProducao:'60',taxaRefugo:'0.00'});
 const html=renderToStaticMarkup(loadDashboard({metricas:current.updates[0]}).render());
 assert.ok(html.includes('Sem dados'));assert.ok(!html.includes('85.0%'));assert.ok(!html.includes('Produção operando dentro dos padrões!'));assert.ok(!html.includes('OEE abaixo do ideal'));
 const oldHtml=renderToStaticMarkup(loadDashboard({before:true,metricas:old.updates[0]}).render());assert.ok(oldHtml.includes('85.0%'));assert.ok(oldHtml.includes('Produção operando dentro dos padrões!'));
});
test('initial/no-orders state does not invent OEE or an OEE warning, and existing queries remain disabled on denial',()=>{
 const current=loadDashboard();const html=renderToStaticMarkup(current.render());for(const fn of current.effects)fn();assert.deepEqual(current.updates,[]);
 assert.ok(html.includes('Sem dados'));assert.ok(!html.includes('OEE abaixo do ideal'));
 for(const props of [{allowed:false},{contextValid:false}]){const denied=loadDashboard(props);const result=renderToStaticMarkup(denied.render());assert.ok(denied.queries.every(query=>query.enabled===false));assert.ok(!result.includes('Distribuição por Status'));}
});
test('OEE presentational branches distinguish measured zero/low/high from missing data without changing thresholds',()=>{
 for(const [oee,value,low,healthy] of [[null,'Sem dados',false,false],[0,'0.0%',true,false],[74.9,'74.9%',true,false],[75,'75.0%',false,true],[85,'85.0%',false,true]]){
  const html=renderToStaticMarkup(loadDashboard({metricas:{eficienciaGeral:'100.0',opsAtrasadas:0,pesoProducaoHoje:'1.00',tempoMedioProducao:'1',taxaRefugo:'0.00',oee}}).render());
  assert.ok(html.includes(value));assert.equal(html.includes('OEE abaixo do ideal'),low);assert.equal(html.includes('Produção operando dentro dos padrões!'),healthy);
 }
});
test('result stamping retains defaults, exact caller payload fields and override precedence; it is not an authorization or execution proof',()=>{
 assert.deepEqual(stampAutomacaoResult(),{ok:true,modo:'sugestao',executado:false});
 assert.deepEqual(stampAutomacaoResult(undefined),stampAutomacaoResult());assert.throws(()=>stampAutomacaoResult(null),TypeError);
 for(const payload of [{reason:'synthetic'}, {executado:false,cancelado:true,acoes:[]},{executado:true,acoes:[{tipo:'synthetic',titulo_id:'synthetic-title'}]}, {ok:false,modo:'synthetic',executado:false},{ok:undefined,modo:null,executado:'metadata-only'}]){
  const expected={ok:payload.ok!==false,modo:String(payload.modo||'').trim()||'sugestao',executado:payload.executado===true,...payload};
  const actual=stampAutomacaoResult(payload);assert.deepEqual(actual,expected);assert.notEqual(actual,payload);if(payload.acoes)assert.equal(actual.acoes,payload.acoes);
 }
});
test('actual TypeScript result contract preserves payload-specific types, optional branch metadata and exact overridden field types',()=>{
 const filename=path.resolve('tests/synthetic-stamp-result.ts');
 const source=`import {stampAutomacaoResult} from '../src/components/lib/automacaoAvancadaPolicy.js';
const empty=stampAutomacaoResult();const ok:boolean=empty.ok;
const explicitUndefined=stampAutomacaoResult(undefined);const defaultFlag:boolean=explicitUndefined.executado;
const metadata=stampAutomacaoResult({reason:'synthetic',count:1});const reason:string=metadata.reason;
const cancelled=stampAutomacaoResult({executado:false,cancelado:true,acoes:[]});
const executed=stampAutomacaoResult({executado:true,acoes:[{tipo:'synthetic',titulo_id:'synthetic'}]});
const result=Math.random()>0.5?cancelled:executed;
if(result.cancelado){}const count:number=(result.acoes||[]).length;
const title:string=executed.acoes[0].titulo_id;
const overridden=stampAutomacaoResult({executado:'metadata-only'});const raw:string=overridden.executado;
// Negative fixtures, no suppression directives.
executed.acoes[0].titulo_id=123;
const wrong:boolean=overridden.executado;
metadata.inexistente;`;
 const options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
 const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
 const errors=ts.getPreEmitDiagnostics(ts.createProgram([filename],options,host));
 assert.deepEqual(errors.filter(error=>!error.file||path.resolve(error.file.fileName)!==filename).map(error=>ts.flattenDiagnosticMessageText(error.messageText,'\n')),[]);
 assert.deepEqual(errors.map(error=>error.code),[2322,2322,2339]);
 const firstNegative=source.split('\n').findIndex(line=>line.startsWith('// Negative fixtures'));
 assert.ok(errors.every(error=>error.file.getLineAndCharacterOfPosition(error.start).line>firstNegative));
});
