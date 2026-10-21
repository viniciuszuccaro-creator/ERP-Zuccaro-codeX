import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {primitiveUiBoundaryRemainder} from './helpers/primitiveUiBoundaryRemainder.js';
import {queryKeyMigrationRemainder} from './helpers/queryKeyMigrationRemainder.js';
import {commandAuditRemainder} from './helpers/commandAuditRemainder.js';
import {partialInputRemainder} from './helpers/partialInputRemainder.js';
import {validarAnomaliasPontoIA} from '../src/components/lib/iaResponsePolicy.js';

const entries={
  com:{file:'comercial/ComissoesTab',state:'formData',hash:'607ca50f47dc604a41855afd0441fe2d5da4f8616c75c3c7ea48c4c7be6609e5',names:['aprovarComissaoMutation','recusarComissaoMutation','pagarComissaoMutation']},
  mov:{file:'estoque/MovimentacoesTab',state:'novaMovimentacao',hash:'5b1250a041a07300e08dc70bfc7f515fc38930fa9ee5a7a40a2521b744e3178e',names:['createMutation']},
  req:{file:'estoque/RequisicoesAlmoxarifadoTab',state:'formData',hash:'13a0cc8d20a1d62f3428f2095c53357f82c4a5f2d33ed4b8c847ba6d3d32ece3',names:['createMutation','aprovarMutation']},
  ponto:{file:'rh/PontoTab',state:'formData',hash:'8dd0af3b4ee555a34439b921bc4cb89a7604cbd246cec7e5016b994d2c74d658',names:['createMutation','aprovarMutation','rejeitarMutation']},
  bio:{file:'rh/PontoEletronicoBiometrico',state:'registroPonto',hash:'b5971442075bd17af52ae391afd92f9be1a10ac00713e036cf28a04c08a19c65',names:['registrarPontoMutation','validarPontoIAMutation']},
  chamado:{file:'portal/ChamadosCliente',state:'formChamado',hash:'6c06bd3e4e5faffc2744d2f30a732e498466321e188e68274fc2577e0c061b88',names:['criarChamadoMutation','avaliarChamadoMutation']},
  orc:{file:'portal/SolicitarOrcamento',state:'formData',hash:'eec59444919fdb494bd777efc6d59c1e2ae95729c6e5c555db8e1b16bddce2d1',names:['criarOportunidadeMutation']},
};
function variable(kind,name){
  const file='src/components/'+entries[kind].file+'.jsx',ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let found;
  function visit(node){if(ts.isVariableDeclaration(node)&&(name===entries[kind].state
    ? ts.isArrayBindingPattern(node.name)&&node.name.elements[0]?.getText(ast)===name
    : node.name.getText(ast)===name)){assert.ok(found===undefined,`Duplicate variable: ${name}`);found=node;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(found,name);return {ast,node:found};
}
function command(kind,name,callback='mutationFn'){const {ast,node}=variable(kind,name);return {ast,fn:callback?node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)===callback).initializer:node.initializer};}
function bind(kind,name,deps,callback){const {ast,fn}=command(kind,name,callback);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
function initial(kind){const {ast,node}=variable(kind,entries[kind].state);return node.initializer.arguments[0].getText(ast);}
function form(kind){return new Function(`return (${initial(kind)});`)();}
function payload(kind,name){
  if(kind==='com')return name==='aprovarComissaoMutation'?{id:'synthetic-record',aprovador:'Synthetic approver'}:name==='recusarComissaoMutation'?{id:'synthetic-record',motivo:'Synthetic reason'}:{id:'synthetic-record',comissao:{vendedor:'Synthetic seller',valor_comissao:20,numero_pedido:'SYNTHETIC'}};
  if(kind==='mov')return {...form(kind),quantidade:'2',tipo_movimentacao:'entrada',produto_id:'synthetic-product'};
  if(kind==='req'){const data={...form(kind),itens:[{produto_id:'synthetic-product',produto_descricao:'Synthetic product',quantidade:2,unidade_medida:'UN'}]};return name==='createMutation'?data:{id:'synthetic-record',itens:data.itens};}
  if(kind==='ponto')return name==='createMutation'?{...form(kind),entrada_manha:'08:00',saida_almoco:'12:00',retorno_almoco:'13:00',saida_tarde:'18:00'}:{id:'synthetic-record'};
  if(kind==='chamado'&&name==='avaliarChamadoMutation')return {chamadoId:'synthetic-record',avaliacao:{nota:5,comentario:'Synthetic comment'}};
  return form(kind);
}
for(const [kind,entry] of Object.entries(entries))test(`${entry.file}: whole prior runtime retained outside proven numeric conversions and explicit absence`,()=>{
  const file='src/components/'+entry.file+'.jsx';
    let source=queryKeyMigrationRemainder(file,primitiveUiBoundaryRemainder(file,commandAuditRemainder(file,fs.readFileSync(file,'utf8'))));
  if(kind==='ponto')source=partialInputRemainder(file,source);
  if(kind==='mov'){
    const needle='const quantidade = parseFloat(String(data.quantidade));';assert.equal(source.split(needle).length,2);
    source=source.replace(needle,'const quantidade = parseFloat(data.quantidade);');
  }
  const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(output).digest('hex'),entry.hash);
});
test('fourteen actual command parameters preserve concrete state and reject invalid payloads',()=>{
  let source="import {useMutation} from '@tanstack/react-query';\n";const negative=[];
  for(const [kind,entry] of Object.entries(entries))for(const name of entry.names){
    const {ast,fn}=command(kind,name);source+=`{\nconst ${entry.state}=${initial(kind)};\nconst c=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\n`;
    source+=`c.mutate(${JSON.stringify(payload(kind,name))});\n`;
    const data=payload(kind,name);
    let bad={...data,id:123};
    if(kind==='com'&&name==='pagarComissaoMutation')bad={...data,comissao:{...data.comissao,valor_comissao:'invalid'}};
    if(kind==='mov')bad={...data,quantidade:true};
    if(kind==='req'&&name==='createMutation')bad={...data,itens:[{...data.itens[0],quantidade:'invalid'}]};
    if(kind==='ponto'&&name==='createMutation')bad={...data,entrada_manha:123};
    if(kind==='bio')bad={...data,biometria_validada:'false'};
    if(kind==='chamado')bad=name==='criarChamadoMutation'?{...data,titulo:123}:{...data,avaliacao:{nota:'invalid',comentario:''}};
    if(kind==='orc')bad={...data,valor_estimado:123};
    negative.push(source.split('\n').length-1);source+=`c.mutate(${JSON.stringify(bad)});\n}\n`;
  }
  const filename=path.resolve('tests/synthetic-command-batch.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),negative,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
});
function environment(override={}){
  const writes=[],audits=[],commands=[],notices=[],client={id:'synthetic-client',empresa_id:'synthetic-a',group_id:'synthetic-group'};
  const create=entity=>async row=>{writes.push(['create',entity,row]);return {id:'synthetic-created',...row};};
  const update=entity=>async(id,row)=>{writes.push(['update',entity,id,row]);return {id,...row};};
  const base44={auth:{me:async()=>({id:'synthetic-user',full_name:'Synthetic user',email:'synthetic@example.invalid'})},entities:{},integrations:{Core:{InvokeLLM:async()=>{throw new Error('synthetic provider disabled');}}}};
  for(const entity of ['Ponto','Chamado','Oportunidade','Cliente'])base44.entities[entity]={create:create(entity),update:update(entity),filter:async()=>[client]};
  const deps={base44,contextoValido:true,canCreateMovimentacao:true,canCreateRequisicao:true,canApproveComissao:true,canRejectComissao:true,canPayComissao:true,
    empresaAtual:{id:'synthetic-a',group_id:'synthetic-group'},grupoAtual:{id:'synthetic-group'},contexto:'empresa',groupId:'synthetic-group',empresaId:'synthetic-a',
    produtos:[{id:'synthetic-product',descricao:'Synthetic product',estoque_atual:10}],
    createInContext:async(entity,row)=>create(entity)(row),updateInContext:async(entity,id,row)=>update(entity)(id,row),
    withComissaoContext:row=>({...row,empresa_id:'synthetic-a',group_id:'synthetic-group'}),sanitizeOnWrite:row=>row,comissoes:[{id:'synthetic-record',observacoes:'Synthetic previous'}],
    user:{id:'synthetic-user',full_name:'Synthetic user'},clienteData:client,clienteId:client.id,clienteNome:'Synthetic client',
    auditComissao:async(...args)=>audits.push(args),sonnerToast:{error:message=>notices.push(message)},
    prompt:()=> 'Synthetic answer',window:{confirm:()=>true},
    aprovarComissaoMutation:{mutate:row=>commands.push(row)},recusarComissaoMutation:{mutate:row=>commands.push(row)},pagarComissaoMutation:{mutate:row=>commands.push(row)},
    colaboradorSelecionado:null,validarAnomaliasPontoIA,...override};
  return {writes,audits,commands,notices,deps};
}
test('commission UI wrappers preserve context/action denial and cancel paths before commands',async()=>{
  for(const [name,permission] of [['handleAprovar','canApproveComissao'],['handleRecusar','canRejectComissao'],['handlePagar','canPayComissao']]){
    for(const override of [{contextoValido:false},{[permission]:false},{prompt:()=>null,window:{confirm:()=>false}}]){
      const e=environment(override);await bind('com',name,e.deps,null)({id:'synthetic-record',vendedor:'Synthetic seller',valor_comissao:20});assert.deepEqual(e.commands,[]);assert.deepEqual(e.writes,[]);
    }
    const e=environment();await bind('com',name,e.deps,null)({id:'synthetic-record',vendedor:'Synthetic seller',valor_comissao:20});assert.equal(e.commands.length,1);
  }
});
test('commission commands preserve status, prior notes, scoped account creation and write order',async()=>{
  const a=environment();await bind('com','aprovarComissaoMutation',a.deps)(payload('com','aprovarComissaoMutation'));assert.equal(a.writes[0][3].status,'Aprovada');
  const r=environment();await bind('com','recusarComissaoMutation',r.deps)(payload('com','recusarComissaoMutation'));assert.match(r.writes[0][3].observacoes,/Synthetic previous/);assert.match(r.writes[0][3].observacoes,/Synthetic reason/);
  const p=environment();await bind('com','pagarComissaoMutation',p.deps)(payload('com','pagarComissaoMutation'));assert.equal(p.writes[0][3].status,'Paga');assert.equal(p.writes[1][1],'ContaPagar');assert.equal(p.writes[1][2].valor,20);assert.equal(p.writes[1][2].empresa_id,'synthetic-a');
});
test('stock commands retain context/action/quantity/negative-stock checks before writes',async()=>{
  for(const [kind,name,permission] of [['mov','createMutation','canCreateMovimentacao'],['req','createMutation','canCreateRequisicao'],['req','aprovarMutation','canCreateRequisicao']])for(const override of [{contextoValido:false},{[permission]:false}]){
    const e=environment(override);await assert.rejects(bind(kind,name,e.deps)(payload(kind,name)));assert.deepEqual(e.writes,[]);
  }
  for(const quantity of [0,-1,'invalid',Infinity]){const e=environment();await assert.rejects(bind('mov','createMutation',e.deps)({...payload('mov','createMutation'),quantidade:quantity}));assert.deepEqual(e.writes,[]);}
  for(const name of ['createMutation','aprovarMutation']){const e=environment(),input=payload('req',name);input.itens[0].quantidade=11;await assert.rejects(bind('req',name,e.deps)(input),/negativo/);assert.deepEqual(e.writes,[]);}
});
test('stock movement normalizes legitimate numeric/string inputs identically and preserves legacy type alias',async()=>{
  for(const quantity of ['2.5',2.5,'2.5units']){
    const e=environment();await bind('mov','createMutation',e.deps)({...payload('mov','createMutation'),quantidade:quantity});assert.equal(e.writes[0][2].quantidade,2.5);assert.equal(e.writes[0][2].empresa_id,'synthetic-a');assert.equal(e.writes[0][2].origem_movimento,'manual');
  }
  const e=environment(),input={...payload('mov','createMutation'),tipo_movimento:'saida'};delete input.tipo_movimentacao;await bind('mov','createMutation',e.deps)(input);assert.equal(e.writes[0][2].tipo_movimento,'saida');
});
test('request multi-item and single-item fallback preserve movement/update/audit order, not transaction proof',async()=>{
  for(const fallback of [false,true]){
    const e=environment(),input=payload('req','createMutation');if(fallback){Object.assign(input,input.itens[0]);delete input.itens;}
    await bind('req','createMutation',e.deps)(input);assert.deepEqual(e.writes.map(row=>row[1]),['MovimentacaoEstoque','Produto','AuditLog']);assert.equal(e.writes[1][3].estoque_atual,8);assert.equal(e.writes[2][2].empresa_id,'synthetic-a');
  }
});
test('daily point calculations/statuses preserve existing completed and missing-time behavior',async()=>{
  const e=environment();await bind('ponto','createMutation',e.deps)(payload('ponto','createMutation'));assert.equal(e.writes[0][2].horas_trabalhadas,9);assert.equal(e.writes[0][2].horas_extras,1);
  const incomplete=environment();await bind('ponto','createMutation',incomplete.deps)(form('ponto'));assert.equal(incomplete.writes[0][2].horas_trabalhadas,undefined);
  for(const [name,status] of [['aprovarMutation','Aprovado'],['rejeitarMutation','Rejeitado']]){const item=environment();await bind('ponto',name,item.deps)({id:'synthetic-record'});assert.equal(item.writes[0][3].status,status);}
});
test('electronic point forwards synthetic input; IA request remains provider-disabled without narrowing response',async()=>{
  const e=environment(),input=payload('bio','registrarPontoMutation');await bind('bio','registrarPontoMutation',e.deps)(input);assert.equal(e.writes[0][2],input);
  await assert.rejects(bind('bio','validarPontoIAMutation',e.deps)(input),/synthetic provider disabled/);assert.equal(e.writes.length,1);
});
test('portal ticket context resolution remains fail-closed and stamps resolved identity',async()=>{
  for(const client of [null,{id:'synthetic-client',group_id:'synthetic-group'}]){
    const e=environment({clienteData:client});e.deps.base44.entities.Cliente.filter=async()=>client?[client]:[];
    await assert.rejects(bind('chamado','criarChamadoMutation',e.deps)(payload('chamado','criarChamadoMutation')),/Contexto/);assert.deepEqual(e.writes,[]);
  }
  const e=environment();await bind('chamado','criarChamadoMutation',e.deps)(payload('chamado','criarChamadoMutation'));assert.equal(e.writes[0][2].cliente_id,'synthetic-client');assert.equal(e.writes[0][2].empresa_id,'synthetic-a');
  await bind('chamado','avaliarChamadoMutation',e.deps)(payload('chamado','avaliarChamadoMutation'));assert.equal(e.writes[1][3].avaliacao.nota,5);
});
test('portal quote request preserves resolved context/value mapping and blocks failed lookup',async()=>{
  const e=environment();await bind('orc','criarOportunidadeMutation',e.deps)({...form('orc'),valor_estimado:'20.5'});assert.equal(e.writes[0][2].valor_estimado,20.5);assert.equal(e.writes[0][2].group_id,'synthetic-group');
  const failed=environment({console:{error:()=>{}}});failed.deps.base44.entities.Cliente.filter=async()=>{throw new Error('synthetic lookup failure');};await assert.rejects(bind('orc','criarOportunidadeMutation',failed.deps)(form('orc')),/indisponivel/);assert.deepEqual(failed.writes,[]);
});
test('existing command write failures propagate; later failure does not imply earlier writes rolled back',async()=>{
  const fail=async()=>{throw new Error('synthetic write failure');};
  for(const [kind,entry] of Object.entries(entries))for(const name of entry.names){
    const e=environment({createInContext:fail,updateInContext:fail});for(const entity of Object.values(e.deps.base44.entities)){entity.create=fail;entity.update=fail;}e.deps.base44.integrations.Core.InvokeLLM=fail;
    await assert.rejects(bind(kind,name,e.deps)(payload(kind,name)),/synthetic write failure/);
  }
  const e=environment({createInContext:fail});await assert.rejects(bind('com','pagarComissaoMutation',e.deps)(payload('com','pagarComissaoMutation')),/synthetic write failure/);assert.equal(e.writes[0][3].status,'Paga');
});
