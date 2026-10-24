import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import {financialFileCommandAnnotations,financialFileCommandRemainder} from './helpers/financialFileCommandRemainder.js';

const cnab='src/components/financeiro/GestaoRemessaRetorno.jsx',sped='src/components/fiscal/ExportacaoSPED.jsx';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,removeComments:true};
const emit=source=>ts.transpileModule(source,{compilerOptions:options}).outputText;
const hash=source=>crypto.createHash('sha256').update(source).digest('hex');
for(const [file,before,runtime] of [
 [cnab,'2447ef7bf00c446f5d0242ccb2d9e97812f2267504891f6ef49a18b30a32c00a','455248daaabb3fb9f8b734e6747535aea9201ab1455bb885262bb42baa93e4df'],
 [sped,'9bce493aad8a928cf712c3edeafac5a13a0f3c20ec5dc273868fd21967d25a3b','79a87cc9d40e9ddb27aa2ad48c5aa4d1284e44bdb620366d2658cd530198b208'],
])test(`${file}: complete prior source and emitted runtime retained outside exact command annotations`,()=>{
 const source=read(file),previous=financialFileCommandRemainder(file,source);
 assert.equal(hash(previous),before);assert.equal(hash(emit(source)),runtime);assert.equal(emit(source),emit(previous));
 for(const annotation of financialFileCommandAnnotations[file]){
  assert.throws(()=>financialFileCommandRemainder(file,source.replace(annotation,'')));
  assert.throws(()=>financialFileCommandRemainder(file,source.replace(annotation,annotation+annotation)));
 }
});
function command(file,name){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let declaration;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.ok(declaration===undefined);declaration=node;}ts.forEachChild(node,visit);}
 visit(ast);assert.ok(declaration);
 const fn=declaration.initializer.arguments[0].properties.find(property=>property.name?.getText(ast)==='mutationFn').initializer;
 return {ast,fn};
}
function bind(file,name,deps){const {ast,fn}=command(file,name),exports={};new Function(...Object.keys(deps),'exports',emit('exports.callback='+fn.getText(ast)))(...Object.values(deps),exports);return exports.callback;}
test('actual TypeScript command annotations reject incompatible IDs, title lists, files and period inputs',()=>{
 const cases=[
  [cnab,'gerarRemessaMutation',"{bancoId:'synthetic-bank',titulosIds:['synthetic-title']}","{bancoId:123,titulosIds:['synthetic-title']}"],
  [cnab,'gerarRemessaMutation',"{bancoId:'synthetic-bank',titulosIds:[]}","{bancoId:'synthetic-bank',titulosIds:[123]}"],
  [cnab,'processarRetornoMutation',"new File(['synthetic'],'synthetic.ret')","{name:'synthetic.ret',size:1}"],
  [sped,'gerarSPEDMutation',"{tipoSped:'synthetic',periodoInicial:'2099-01-01',periodoFinal:'2099-01-31'}","{tipoSped:'synthetic',periodoInicial:123,periodoFinal:'2099-01-31'}"],
 ];
 let source="import {useMutation} from '@tanstack/react-query';\n";const negatives=[];
 for(const [i,[file,name,good,bad]] of cases.entries()){
  const {ast,fn}=command(file,name);
  source+=`const f${i}=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\nf${i}.mutate(${good});\n`;
  negatives.push(source.split('\n').length-1);source+=`f${i}.mutate(${bad});\n`;
 }
 const filename=path.resolve('tests/synthetic-financial-file-commands.js');
 const config={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
 const host=ts.createCompilerHost(config),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
 const errors=ts.getPreEmitDiagnostics(ts.createProgram([filename],config,host));
 assert.equal(errors.length,4);assert.ok(errors.every(error=>error.file&&path.resolve(error.file.fileName)===filename));
 assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),negatives);
});
function bank({context=true,remittance=true,returns=true,titles=[]}={}){
 const deps={contextoValido:context,podeGerarRemessa:remittance,podeProcessarRetorno:returns,
  bancos:[],contasReceber:titles,
  createInContext:()=>assert.fail('no synthetic bank write should reach persistence'),
  updateInContext:()=>assert.fail('no title posting or settlement should occur'),
 };
 return {generate:bind(cnab,'gerarRemessaMutation',deps),process:bind(cnab,'processarRetornoMutation',deps)};
}
for(const [label,settings] of [['context',{context:false}],['permission',{remittance:false,returns:false}]])test(`actual CNAB commands keep ${label} denial before file reads and writes`,async()=>{
 const h=bank(settings),file=new File(['synthetic'],'synthetic.ret');
 file.text=()=>assert.fail('must reject before reading file');
 await assert.rejects(()=>h.generate({bancoId:'synthetic-bank',titulosIds:['synthetic-title']}),/Sem contexto/);
 await assert.rejects(()=>h.process(file),/Sem contexto/);
});
test('actual remittance selection still rejects empty or unavailable title selections',async()=>{
 for(const ids of [[],['synthetic-missing']])await assert.rejects(()=>bank().generate({bancoId:'synthetic-bank',titulosIds:ids}),/Selecione ao menos/);
});
test('actual return command rejects missing/empty/oversized files before reading or writing',async()=>{
 const h=bank();
 for(const file of [null,new File([''],'synthetic.ret'),new File(['x'.repeat(5*1024*1024+1)],'synthetic.ret')]){
  if(file)file.text=()=>assert.fail('invalid size must reject before reading');
  await assert.rejects(()=>h.process(file),/Arquivo de retorno invalido/);
 }
});
test('actual return command rejects executable content before records or title updates',async()=>{
 for(const content of ['<script>synthetic</script>','javascript:synthetic'])await assert.rejects(()=>bank().process(new File([content],'synthetic.ret')),/conteudo bloqueado/);
});
test('actual return read failure propagates before any persistence',async()=>{
 const file=new File(['synthetic'],'synthetic.ret');file.text=async()=>{throw Error('synthetic read failure');};
 await assert.rejects(()=>bank().process(file),/synthetic read failure/);
});
function fiscal({context=true,permission=true,auditFailure=false}={}){
 const audits=[];
 const fn=bind(sped,'gerarSPEDMutation',{
  contextoValido:context,canGenerateSPED:permission,
  base44:{entities:{AuditLog:{create:async row=>{audits.push(row);if(auditFailure)throw Error('synthetic audit failure');}}}},
  user:{id:'synthetic-actor'},empresaSelecionadaId:'synthetic-company',groupId:'synthetic-group',
  setTimeout:()=>assert.fail('blocked command must not start fiscal simulation'),
  filterInContext:()=>assert.fail('blocked command must not query fiscal records'),
  createInContext:()=>assert.fail('no SPED write should reach persistence'),
 });
 return {fn,audits};
}
const period={tipoSped:'synthetic',periodoInicial:'2099-01-01',periodoFinal:'2099-01-31'};
for(const [label,settings] of [['context',{context:false}],['permission',{permission:false}]])test(`actual SPED command retains ${label} denial and scoped audit before generation`,async()=>{
 const h=fiscal(settings);await assert.rejects(()=>h.fn(period),/Selecione grupo/);
 assert.equal(h.audits.length,1);const row=h.audits[0];assert.equal(row.sucesso,false);
 assert.equal(row.group_id,'synthetic-group');assert.equal(row.empresa_id,'synthetic-company');assert.deepEqual(row.dados_novos,period);
});
test('actual denied SPED audit failure propagates without falling through to generation',async()=>{
 await assert.rejects(()=>fiscal({context:false,auditFailure:true}).fn(period),/synthetic audit failure/);
});
