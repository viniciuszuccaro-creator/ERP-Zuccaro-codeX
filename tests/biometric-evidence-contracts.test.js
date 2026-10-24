import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {validarAnomaliasPontoIA} from '../src/components/lib/iaResponsePolicy.js';
import {biometricEvidenceFile as file,biometricEvidenceHunks,biometricEvidenceRemainder,pointValidatorAddition} from './helpers/biometricEvidenceRemainder.js';

const policy='src/components/lib/iaResponsePolicy.js';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
for(const [path,hash,hunks] of [[file,'61eeef9aef6a63bb442d78433d5b2b82d21a6f3cc489c0ace873714e1b5e7503',biometricEvidenceHunks],[policy,'fc4a1e07da5b30c8180c5b7b2f4fc70ba2180559d33d6d529422c27b3b81da32',[[pointValidatorAddition,'']]]])test(`${path}: full prior source retained outside exact evidence/validator hunks`,()=>{
 const source=read(path);assert.equal(crypto.createHash('sha256').update(biometricEvidenceRemainder(path,source)).digest('hex'),hash);
 for(const [after] of hunks){assert.throws(()=>biometricEvidenceRemainder(path,source.replace(after,'')));assert.throws(()=>biometricEvidenceRemainder(path,source.replace(after,after+after)));}
});
const response=patch=>({risco:'Baixo',requer_aprovacao_gestor:false,observacoes_ia:'synthetic observation',...patch});
test('point IA validator accepts structured or JSON responses using only the existing risk vocabulary',()=>{
 for(const risco of ['Baixo','Médio','Alto'])for(const review of [false,true]){
  const input=response({risco,requer_aprovacao_gestor:review,anomalias_detectadas:['synthetic']});
  assert.deepEqual(validarAnomaliasPontoIA(input),input);assert.deepEqual(validarAnomaliasPontoIA(JSON.stringify(input)),input);
 }
});
test('point IA validator rejects malformed, incomplete, unbounded and injected fields without coercion or defaults',()=>{
 const invalid=[null,undefined,[],1,false,'not json','{}',{},response({risco:'low'}),response({risco:'Medio'}),
  response({requer_aprovacao_gestor:'false'}),response({observacoes_ia:123}),response({observacoes_ia:'x'.repeat(4001)}),
  response({anomalias_detectadas:Array(101).fill('synthetic')}),response({biometria_validada:true}),
  {risco:'Baixo',observacoes_ia:''},{risco:'Baixo',requer_aprovacao_gestor:false},'x'.repeat(100001)];
 for(const input of invalid)assert.throws(()=>validarAnomaliasPontoIA(input),/Resposta de analise de ponto IA invalida/);
});
function variable(name,source=read(file)){
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let match;
 function visit(node){if(ts.isVariableDeclaration(node)&&(node.name.getText(ast)===name||(ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)===name))){assert.ok(match===undefined);match=node;}ts.forEachChild(node,visit);}
 visit(ast);assert.ok(match,name);return {ast,node:match};
}
function bind(name,deps={},before=false,mutation=false){
 const {ast,node}=variable(name,before?biometricEvidenceRemainder(file,read(file)):read(file));
 const fn=mutation?node.initializer.arguments[0].properties.find(property=>property.name?.getText(ast)==='mutationFn').initializer:node.initializer;
 return new Function(...Object.keys(deps),'return ('+fn.getText(ast)+');')(...Object.values(deps));
}
function initial(){const {ast,node}=variable('registroPonto');return new Function('return ('+node.initializer.arguments[0].getText(ast)+');')();}
test('counterproof: simulated fingerprint formerly set verified=true; current handler keeps verification false',()=>{
 for(const before of [true,false]){
  let state={...initial(),biometria_validada:false};const notices=[];
  bind('simularBiometria',{setRegistroPonto:fn=>{state=fn(state);},toast:row=>notices.push(row)},before)();
  assert.equal(state.biometria_validada,before);assert.equal(notices.length,1);
  if(!before)assert.equal(notices[0].title,'Leitor biometrico indisponivel');
 }
});
test('simulation also clears an unproven stale true flag, without fabricating a hardware receipt',()=>{
 let state={...initial(),biometria_validada:true};
 bind('simularBiometria',{setRegistroPonto:fn=>{state=fn(state);},toast:()=>{}})();assert.equal(state.biometria_validada,false);
});
test('photo capture preserves canvas/image/stream cleanup but no longer asserts facial identity verification',()=>{
 const output=[];
 for(const before of [true,false]){
  const calls=[],notices=[];let state=initial();
  const video={videoWidth:8,videoHeight:6,srcObject:{getTracks:()=>[{stop:()=>calls.push('stop')}]}};
  const canvas={width:0,height:0,getContext:()=>({drawImage:()=>calls.push('draw')}),toDataURL:()=> 'data:image/jpeg;base64,c3ludGhldGlj'};
  bind('capturarFotoFacial',{videoRef:{current:video},document:{createElement:name=>{assert.equal(name,'canvas');return canvas;}},setRegistroPonto:fn=>{state=fn(state);},setCameraAtiva:value=>calls.push(['camera',value]),toast:row=>notices.push(row)},before)();
  assert.equal(state.biometria_validada,false);assert.equal(canvas.width,8);assert.equal(canvas.height,6);
  assert.deepEqual(calls,['draw','stop',['camera',false]]);output.push(state.foto_facial_url);
  if(!before)assert.equal(notices[0].description,'Captura concluida; identidade facial nao verificada.');
 }
 assert.equal(output[0],output[1]);
});
function handler({before=false,reply=response(),failure=false,selected=true}={}){
 const notices=[],commands=[],provider=[];
 const state=initial();
 class FixedDate extends Date{constructor(value){super(value===undefined?'2099-01-01T00:00:00.000Z':value);}}
 const analysis=bind('validarPontoIAMutation',{
  base44:{integrations:{Core:{InvokeLLM:async input=>{provider.push(input);if(failure)throw Error('synthetic provider failure');return reply;}}}},
  colaboradorSelecionado:{ultimo_ponto:'synthetic'},validarAnomaliasPontoIA,Date:FixedDate,
 },before,true);
 const run=bind('handleRegistrarPonto',{
  registroPonto:state,colaboradorSelecionado:selected?{id:'synthetic-person',nome_completo:'Synthetic person'}:null,
  toast:row=>notices.push(row),validarPontoIAMutation:{mutateAsync:analysis},registrarPontoMutation:{mutate:data=>commands.push(data)},Date:FixedDate,
 },before);
 return {run,notices,commands,provider};
}
test('counterproof: incomplete IA used to fall through into registration; now blocked with a user-visible error',async()=>{
 const old=handler({before:true,reply:{}}),now=handler({reply:{}});await old.run('entrada');await now.run('entrada');
 assert.equal(old.commands.length,1);assert.deepEqual(now.commands,[]);assert.equal(now.notices.at(-1).title,'Analise indisponivel');
});
test('invalid IA and provider failure cannot register a point or expose the response in the notice',async()=>{
 for(const options of [{reply:'synthetic-private-marker'},{reply:response({requer_aprovacao_gestor:'false',observacoes_ia:'synthetic-private-marker'})},{failure:true}]){
  const h=handler(options);await h.run('saida');assert.deepEqual(h.commands,[]);assert.equal(h.notices.length,1);
  assert.equal(h.notices[0].variant,'destructive');assert.ok(!JSON.stringify(h.notices).includes('synthetic-private-marker'));
 }
});
test('no selected employee still blocks before analysis or registration',async()=>{
 const h=handler({selected:false});await h.run('entrada');assert.deepEqual(h.provider,[]);assert.deepEqual(h.commands,[]);assert.equal(h.notices.length,1);
});
test('valid structured IA preserves the existing high-risk-or-review flag rule; it never validates biometrics',async()=>{
 for(const [risco,review,flag] of [['Baixo',false,false],['Médio',false,false],['Alto',false,true],['Baixo',true,true]]){
  const old=handler({before:true,reply:response({risco,requer_aprovacao_gestor:review})}),now=handler({reply:response({risco,requer_aprovacao_gestor:review})});
  await old.run('entrada');await now.run('entrada');assert.equal(now.commands.length,1);
  const clean=data=>{const {data_hora,...rest}=data;assert.ok(data_hora);return rest;};assert.deepEqual(clean(now.commands[0]),clean(old.commands[0]));
  assert.equal(now.commands[0].biometria_validada,false);assert.equal(now.commands[0].requer_aprovacao===true,flag);
  assert.deepEqual(now.provider,old.provider);
 }
});
test('JSON high-risk response now uses the same rule instead of ignoring its fields as a string',async()=>{
 const h=handler({reply:JSON.stringify(response({risco:'Alto'}))});await h.run('entrada');assert.equal(h.commands[0].requer_aprovacao,true);
});
test('actual registration command still propagates storage failure without an invented success',async()=>{
 let calls=0;const fn=bind('registrarPontoMutation',{base44:{entities:{Ponto:{create:async()=>{calls++;throw Error('synthetic persistence failure');}}}}},false,true);
 await assert.rejects(()=>fn(initial()),/synthetic persistence failure/);assert.equal(calls,1);
});
test('producer point payload reuses the actual registration command type and rejects wrong optional metadata in real TypeScript',()=>{
 const state=variable('registroPonto'),registration=variable('registrarPontoMutation'),payload=variable('pontoFinal');
 const registrationFn=registration.node.initializer.arguments[0].properties.find(property=>property.name?.getText(registration.ast)==='mutationFn').initializer;
 const source=`import {useMutation} from '@tanstack/react-query';
const registroPonto=${state.node.initializer.arguments[0].getText(state.ast)};
const registrarPontoMutation=useMutation({mutationFn:async (${registrationFn.parameters[0].getFullText(registration.ast)})=>data});
const colaboradorSelecionado={id:'synthetic',nome_completo:'Synthetic'};const tipo='entrada';
${payload.node.parent.parent.getFullText(payload.ast).trim()}
pontoFinal.requer_aprovacao=true;pontoFinal.observacoes_ia='synthetic';registrarPontoMutation.mutate(pontoFinal);
pontoFinal.observacoes_ia=123;
pontoFinal.biometria_validada='true';`;
 const filename=path.resolve('tests/synthetic-point-producer.js'),config={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,types:[]};
 const host=ts.createCompilerHost(config),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
 const errors=ts.getPreEmitDiagnostics(ts.createProgram([filename],config,host));assert.equal(errors.length,2);assert.ok(errors.every(error=>error.code===2322&&error.file&&path.resolve(error.file.fileName)===filename));
 const lines=source.trimEnd().split('\n').length;assert.deepEqual(errors.map(error=>error.file.getLineAndCharacterOfPosition(error.start).line),[lines-2,lines-1]);
});
