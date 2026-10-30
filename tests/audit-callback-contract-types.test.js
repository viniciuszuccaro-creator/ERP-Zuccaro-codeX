import test from 'node:test';
import {runtimeProofSource} from './helpers/runtimeProofSource.js';
import {commandAuditRemainder} from './helpers/commandAuditRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';
import {primitiveUiBoundaryRemainder} from './helpers/primitiveUiBoundaryRemainder.js';

const cases=[
  {file:'src/components/cadastros/ConversaoProducaoMassa.jsx',name:'auditConversao',hash:'6ff51c054f22eb22722cd81740fc94058224d4ebc10ea2e0809c05c20a86f641',good:"{acao:'Synthetic'}",throws:false},
  {file:'src/components/cadastros/HistoricoProduto.jsx',name:'auditHistoricoProduto',hash:'9ba1e3f0a0b25adbf1865b4c6418befed8f9272388d10af1eb6afee486e62f41',good:"{acao:'Synthetic'}",throws:false},
  {file:'src/components/comercial/PedidosTab.jsx',name:'auditPedido',hash:'5fb476ef0fb7a467625be75eb2ef75a41221d4b1c6ef7efdfd95cfda4dfaf5ce',good:"{acao:'Synthetic',descricao:'Synthetic audit'}",throws:true},
  {file:'src/components/comercial/PedidosEntregaTab.jsx',name:'auditEntrega',hash:'158c6dc5c5eafdb3b6b06500aea3a00c6952049c84a654602264cfdfad5f0dd2',good:"{acao:'Synthetic'}",throws:false},
  {file:'src/components/comercial/ValidarPedidosExternos.jsx',name:'auditPedidoExterno',hash:'edb2245a08c115b5713264c104575bdd573c66a65d1047a36d9549b871693fb3',good:"{acao:'Synthetic',descricao:'Synthetic audit'}",throws:true},
  {file:'src/components/sistema/RelatorioPermissoes.jsx',name:'auditarRelatorio',hash:'59d6de3ddc78d83d8b54a457a8d82e69718da9f78d7db7e91d6b5ed29e0972e6',good:"{formato:'synthetic',resumo:{total:1}}",throws:false},
];
for(const entry of cases)test(`${entry.file}: complete executable runtime unchanged`,()=>{
  const output=ts.transpileModule(iaResponseValidationRemainder(entry.file,primitiveUiBoundaryRemainder(entry.file,commandAuditRemainder(entry.file,runtimeProofSource(entry.file)))),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(output).digest('hex'),entry.hash);
});
function actual(entry){
  const ast=ts.createSourceFile(entry.file,fs.readFileSync(entry.file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let variable;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===entry.name){assert.equal(variable,undefined);variable=node;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(variable);return {ast,fn:variable.initializer,statement:variable.parent.parent};
}
function bind(entry,deps){const {ast,fn}=actual(entry);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
function environment(fail=false){
  const writes=[],logs=[];
  const write=async data=>{writes.push(data);if(fail)throw new Error('synthetic audit storage failure');};
  return {writes,logs,deps:{base44:{entities:{AuditLog:{create:write}}},createInContext:async(entity,data)=>{assert.equal(entity,'AuditLog');await write(data);},
    console:{warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},
    user:{id:'synthetic-user',full_name:'Synthetic user'},groupId:'synthetic-group',grupoId:'synthetic-group',
    empresaId:'synthetic-a',empresaContextoId:'synthetic-a',effectiveEmpresaId:'synthetic-a',effectiveGroupId:'synthetic-group',
    produtoId:'synthetic-product',contexto:'empresa',getResumoContexto:()=>({contexto:'empresa',group_id:'synthetic-group',empresa_id:'synthetic-a'})}};
}
function payload(entry){return new Function(`return (${entry.good});`)();}

test('actual audit callback annotations compile defaults and reject invalid success flags and required fields',()=>{
  let source='';
  for(const [i,entry] of cases.entries()){
    const {ast,fn,statement}=actual(entry);assert.equal(statement.jsDoc.length,1);
    source+=`${statement.jsDoc[0].getText(ast)}\nconst f${i}=async (${fn.parameters[0].getText(ast)})=>{};\nf${i}(${entry.good});\n`;
  }
  const negatives=cases.map((entry,i)=>`f${i}({...${entry.good},sucesso:'false'});`);
  negatives.push("f2({acao:'Synthetic'});","f5({formato:'synthetic'});","f0({acao:'Synthetic',dados:123});");
  const firstNegative=source.split('\n').length-1;source+=negatives.join('\n')+'\n';
  const filename=path.resolve('tests/synthetic-audit-callback.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,negatives.length,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),negatives.map((_,i)=>firstNegative+i));
});

test('all actual audit callbacks retain success/failure metadata and default context',async()=>{
  for(const entry of cases)for(const success of [true,false]){
    const {writes,deps}=environment();await bind(entry,deps)({...payload(entry),sucesso:success});
    assert.equal(writes.length,1);const row=writes[0];assert.equal(row.sucesso,success);
    assert.equal(row.empresa_id,'synthetic-a');assert.equal(row.group_id,'synthetic-group');assert.ok(row.data_hora);
    if(entry.name==='auditPedido'||entry.name==='auditPedidoExterno'||entry.name==='auditEntrega')assert.equal(row.usuario_id,'synthetic-user');
    if(entry.name==='auditarRelatorio')assert.equal(row.acao,success?'Exportacao':'Bloqueio Exportacao');
    else assert.equal(row.acao,'Synthetic');
  }
});

test('product audits preserve explicit record metadata, before snapshot and extensible details',async()=>{
  for(const entry of cases.slice(0,2)){
    const {writes,deps}=environment(),before={tipo_item:'Synthetic previous'},data={registro_id:'synthetic-record',empresa_id:'synthetic-a',group_id:'synthetic-group',dados_anteriores:before,custom:7};
    await bind(entry,deps)({acao:'Synthetic',dados:data,motivo:'Synthetic reason'});
    const row=writes[0];assert.equal(row.registro_id,'synthetic-record');assert.equal(row.dados_anteriores,before);
    assert.equal(row.dados_novos.custom,7);assert.equal(row.dados_novos.contexto,'empresa');assert.equal(row.descricao,'Synthetic reason');
  }
});

test('pedido and external-pedido audit preserve record identity, fallback IDs and snapshots in details',async()=>{
  for(const entry of [cases[2],cases[4]]){
    const external=entry.name==='auditPedidoExterno',recordName=external?'ext':'pedido',idName=external?'pedido_externo_id':'pedido_id';
    const {writes,deps}=environment();
    await bind(entry,deps)({...payload(entry),[recordName]:{id:'synthetic-record',empresa_id:'synthetic-a',group_id:'synthetic-group'},detalhes:{custom:8}});
    assert.equal(writes[0].registro_id,'synthetic-record');assert.equal(writes[0].detalhes.custom,8);
    await bind(entry,deps)({...payload(entry),detalhes:{[idName]:'synthetic-fallback'}});
    assert.equal(writes[1].registro_id,'synthetic-fallback');
  }
});

test('delivery audit preserves both snapshots and related IDs; permission report retains fallback description and summary',async()=>{
  const delivery=environment(),before={status:'Synthetic previous'},after={status:'Synthetic next'};
  await bind(cases[3],delivery.deps)({acao:'Synthetic',registroId:'synthetic-record',detalhes:{pedido_id:'synthetic-order',entrega_id:'synthetic-delivery'},dadosAnteriores:before,dadosNovos:after});
  assert.equal(delivery.writes[0].dados_anteriores,before);assert.equal(delivery.writes[0].dados_novos,after);
  assert.equal(delivery.writes[0].detalhes.entrega_id,'synthetic-delivery');assert.equal(delivery.writes[0].registro_id,'synthetic-record');
  const report=environment();await bind(cases[5],report.deps)({formato:'synthetic',resumo:{total:3}});
  assert.equal(report.writes[0].dados_novos.total,3);assert.equal(report.writes[0].dados_novos.motivo,null);
  assert.ok(report.writes[0].descricao.includes('synthetic'));
});

test('audit storage failures retain current propagation or logging behavior, without claiming rollback',async()=>{
  for(const entry of cases){
    const {writes,logs,deps}=environment(true),run=bind(entry,deps);
    if(entry.throws)await assert.rejects(run(payload(entry)),{message:entry.name==='auditPedido'?'Auditoria obrigatoria falhou para pedido.':'synthetic audit storage failure'});
    else await run(payload(entry));
    assert.equal(writes.length,1);assert.equal(logs.length,1);
  }
});

function mutation(file,name){
  const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let fn;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===name){assert.equal(fn,undefined);fn=node.initializer.arguments[0].properties.find(p=>p.name?.getText(ast)==='mutationFn').initializer;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(fn);return {ast,fn};
}
function bindMutation(file,name,deps){const {ast,fn}=mutation(file,name);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
const producers=[
  [cases[2].file,'deleteMutation','canDeletePedido'],
  [cases[4].file,'marcarValidado','canValidatePedidoExterno'],
  [cases[4].file,'excluirExterno','canDeletePedidoExterno'],
  [cases[4].file,'importarComoPedido','canImportPedidoExterno'],
];

test('four actual producer parameters reuse required IDs and canonical marketplace identity/items without accepting void',()=>{
  let source=`import {useMutation} from '@tanstack/react-query';\n`;
  for(const [i,[file,name]] of producers.entries()){
    const {ast,fn}=mutation(file,name);
    source+=`const c${i}=useMutation({mutationFn:async (${fn.parameters[0].getFullText(ast)})=>{}});\nc${i}.mutate({id:'synthetic-record',custom:1});\n`;
  }
  source+=`c3.mutate({id:'synthetic-record',origem:'Synthetic',itens:[{sku_interno:'synthetic-sku',quantidade:1}]});\n`;
  const firstNegative=source.split('\n').length-1;
  for(const [i] of producers.entries())source+=`c${i}.mutate({id:123});\n`;
  source+=`c3.mutate({id:'synthetic-record',itens:'invalid'});\n`;
  const filename=path.resolve('src/components/comercial/synthetic-audit-command.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,5,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),Array.from({length:5},(_,i)=>firstNegative+i));
});

test('four actual producer commands preserve context/permission denials and await blocked audit before rejecting',async()=>{
  for(const [file,name,permission] of producers)for(const override of [{contextoValido:false},{[permission]:false}]){
    const audits=[],operations=[];
    const noOperation=async()=>{operations.push('unexpected');throw new Error('synthetic unexpected storage call');};
    const deps={contextoValido:true,canDeletePedido:true,canValidatePedidoExterno:true,canDeletePedidoExterno:true,canImportPedidoExterno:true,
      auditPedido:async row=>audits.push(row),auditPedidoExterno:async row=>audits.push(row),
      filterInContext:noOperation,createInContext:noOperation,updateInContext:noOperation,deleteInContext:noOperation,...override};
    await assert.rejects(bindMutation(file,name,deps)({id:'synthetic-record'}));
    assert.deepEqual(operations,[]);assert.equal(audits.length,1);assert.equal(audits[0].sucesso,false);
  }
});

test('pedido deletion preserves pre-write audit ordering; failed audit prevents synthetic delete',async()=>{
  const events=[],row={id:'synthetic-record'};
  const deps={contextoValido:true,canDeletePedido:true,auditPedido:async data=>{events.push(['audit',data]);},
    deleteInContext:async(...args)=>{events.push(['delete',...args]);return {id:row.id};}};
  assert.deepEqual(await bindMutation(cases[2].file,'deleteMutation',deps)(row),{id:row.id});
  assert.equal(events[0][0],'audit');assert.equal(events[0][1].pedido,row);assert.deepEqual(events[1],['delete','Pedido',row.id]);
  const failed={...deps,auditPedido:async()=>{throw new Error('synthetic mandatory audit failure');}};
  await assert.rejects(bindMutation(cases[2].file,'deleteMutation',failed)(row),/synthetic mandatory audit failure/);
  assert.equal(events.length,2);
});
