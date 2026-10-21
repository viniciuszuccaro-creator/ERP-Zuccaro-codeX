import { portalReadRemainder } from './helpers/portalReadRemainder.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import crypto from 'node:crypto';
import {queryKeyMigrationRemainder} from './helpers/queryKeyMigrationRemainder.js';
import {nativeDomAttributeRemainder} from './helpers/nativeDomAttributeRemainder.js';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';

const cases=[
  {file:'src/components/compras/ImportacaoNFeRecebimento.jsx',name:'auditImportacao',hash:'9102904194633e691c60b152b550938c91b2bb556832d7a121e11559a4402eaa',kind:'record',error:'synthetic audit failure'},
  {file:'src/components/compras/OrdensCompraTab.jsx',name:'auditOrdemCompra',hash:'e647200f64d6e115f479bbed8740244962417e1301f88f7798537975e2904ed3',kind:'record',error:'Auditoria obrigatoria falhou para ordem de compra.'},
  {file:'src/components/compras/SolicitacoesCompraTab.jsx',name:'auditSolicitacaoCompra',hash:'aebd4dfc9c1fd5aaa78de56cba53cb10510cfe30c21d185e85d2defe25204b1a',kind:'record'},
  {file:'src/components/estoque/ImportadorProdutosPlanilha.jsx',name:'auditImportadorProdutos',hash:'662fff9f0c0fbcb56de2da4e37a4c396484e4ec19cc247fac430e7f73b0464f3',kind:'record',error:'Auditoria obrigatoria falhou para importacao de migracao.'},
  {file:'src/components/financeiro/ContasPagarTab.jsx',name:'auditarFinanceiro',hash:'0898138298e1e1ecc4981110d7d04e43e7eeb1207e744dfd5cbbf9fe25225d5b',kind:'financial'},
  {file:'src/components/financeiro/ContasReceberTab.jsx',name:'auditarFinanceiro',hash:'cfdaadd2fddf6086814801b08ebf0dc0e941b22884360e02c2381ef41c2700cb',kind:'financial'},
  {file:'src/components/financeiro/CartoesACompensar.jsx',name:'auditarCartao',hash:'a852813df03f95e6a4f37ccda51a93da4aa8f9cd2162926d776b6aa56e4bbe0a',kind:'cartao'},
  {file:'src/components/financeiro/caixa-central/OrdensLiquidacaoPendentes.jsx',name:'auditarOrdem',hash:'0cf6ee6db1ec49d7905908157c7a6a760c8b1c2bec37a64e7537f20a484a36e8',kind:'ordem'},
];
for(const entry of cases)test(`${entry.file}: whole executable runtime unchanged`,()=>{
  const emitted=ts.transpileModule(queryKeyMigrationRemainder(entry.file,nativeDomAttributeRemainder(entry.file,iaResponseValidationRemainder(entry.file,portalReadRemainder(entry.file,fs.readFileSync(entry.file,'utf8'))))),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(emitted).digest('hex'),entry.hash);
});
function actual(entry){
  const ast=ts.createSourceFile(entry.file,fs.readFileSync(entry.file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let variable;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)===entry.name){assert.equal(variable,undefined);variable=node;}ts.forEachChild(node,visit);}
  visit(ast);assert.ok(variable);return {ast,fn:variable.initializer,statement:variable.parent.parent};
}
function bind(entry,deps){const {ast,fn}=actual(entry);return new Function(...Object.keys(deps),`return (${fn.getText(ast)});`)(...Object.values(deps));}
function payload(entry){
  if(entry.kind==='record')return {acao:'Synthetic'};
  if(entry.kind==='financial')return {acao:'Synthetic',entidade:'Synthetic entity',descricao:'Synthetic audit'};
  return {acao:'Synthetic',descricao:'Synthetic audit',[entry.kind]:null};
}
function environment({groupId='synthetic-group',empresaId='synthetic-a',file=null,fail=false}={}){
  const writes=[],logs=[];
  const write=async data=>{writes.push(data);if(fail)throw new Error('synthetic audit failure');};
  return {writes,logs,deps:{base44:{entities:{AuditLog:{create:write}}},createInContext:async(entity,data)=>{assert.equal(entity,'AuditLog');await write(data);},
    console:{warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},
    authUser:{id:'synthetic-user',full_name:'Synthetic user'},user:{id:'synthetic-user',full_name:'Synthetic user'},
    groupId,empresaId,contextoGrupoId:groupId,contextoEmpresaId:empresaId,contexto:'empresa',arquivo:file}};
}

test('eight actual audit parameter contracts retain supported omissions and reject invalid flags/required fields',()=>{
  let source='';
  for(const [i,entry] of cases.entries()){
    const {ast,fn,statement}=actual(entry);assert.equal(statement.jsDoc.length,1);
    source+=`${statement.jsDoc[0].getText(ast)}\nconst f${i}=async (${fn.parameters[0].getText(ast)})=>{};\nf${i}(${JSON.stringify(payload(entry))});\n`;
  }
  const bad=cases.map((entry,i)=>`f${i}({...${JSON.stringify(payload(entry))},sucesso:'false'});`);
  bad.push("f0({acao:'Synthetic',dados:123});","f4({acao:'Synthetic',entidade:'Synthetic entity'});","f6({acao:'Synthetic',descricao:'Synthetic audit'});");
  const firstNegative=source.split('\n').length-1;source+=bad.join('\n')+'\n';
  const filename=path.resolve('tests/synthetic-purchase-financial-audit.js'),options={allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true};
  const host=ts.createCompilerHost(options),read=host.readFile;host.readFile=file=>path.resolve(file)===filename?source:read(file);
  const errors=ts.createProgram([filename],options,host).getSemanticDiagnostics().filter(e=>e.file&&path.resolve(e.file.fileName)===filename);
  assert.equal(errors.length,bad.length,JSON.stringify(errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))));
  assert.deepEqual(errors.map(e=>e.file.getLineAndCharacterOfPosition(e.start).line),bad.map((_,i)=>firstNegative+i));
});

test('actual callbacks preserve success/failure metadata and active-context forwarding',async()=>{
  for(const entry of cases)for(const success of [true,false]){
    const {writes,deps}=environment();await bind(entry,deps)({...payload(entry),sucesso:success});
    assert.equal(writes.length,1);const row=writes[0];assert.equal(row.acao,'Synthetic');assert.equal(row.sucesso,success);
    assert.equal(row.group_id,'synthetic-group');assert.equal(row.empresa_id,'synthetic-a');assert.ok(row.data_hora);
    assert.equal(row.tipo_auditoria,success?(entry.kind==='record'?'entidade':'operacional'):'seguranca');
  }
});

test('record audit callbacks keep active IDs ahead of metadata and retain fallback when active IDs are absent',async()=>{
  for(const entry of cases.filter(row=>row.kind==='record')){
    const dados={group_id:'synthetic-metadata-group',empresa_id:'synthetic-metadata-company',custom:9};
    const active=environment();await bind(entry,active.deps)({...payload(entry),dados});
    assert.equal(active.writes[0].group_id,'synthetic-group');assert.equal(active.writes[0].empresa_id,'synthetic-a');assert.equal(active.writes[0].dados_novos.custom,9);
    const fallback=environment({groupId:null,empresaId:null});await bind(entry,fallback.deps)({...payload(entry),dados});
    assert.equal(fallback.writes[0].group_id,dados.group_id);assert.equal(fallback.writes[0].empresa_id,dados.empresa_id);
  }
});

test('financial audit callbacks preserve before/after snapshots and optional record ID handling',async()=>{
  for(const entry of cases.filter(row=>row.kind!=='record')){
    const {writes,deps}=environment(),before={value:'Synthetic before'},after={value:'Synthetic after'};
    const record={id:'synthetic-record',group_id:'synthetic-group',empresa_id:'synthetic-a'};
    const input={...payload(entry),dadosAnteriores:before,dadosNovos:after};
    if(entry.kind==='financial')input.registroId=record.id;else input[entry.kind]=record;
    await bind(entry,deps)(input);assert.equal(writes[0].registro_id,record.id);
    assert.equal(writes[0].dados_anteriores,before);assert.equal(writes[0].dados_novos,after);
    await bind(entry,deps)(payload(entry));assert.equal(writes[1].registro_id,null);
    assert.equal(writes[1].dados_anteriores,undefined);assert.equal(writes[1].dados_novos,undefined);
  }
});

test('spreadsheet audit retains file-name precedence, context and previous snapshot without reading a file',async()=>{
  const {writes,deps}=environment({file:{name:'synthetic-input.txt'}}),before={custom:1};
  await bind(cases[3],deps)({acao:'Synthetic',dados:{arquivo:'synthetic-metadata.txt',dados_anteriores:before},motivo:'Synthetic reason'});
  assert.equal(writes[0].dados_novos.arquivo,'synthetic-input.txt');assert.equal(writes[0].dados_novos.contexto,'empresa');
  assert.equal(writes[0].dados_anteriores,before);assert.equal(writes[0].descricao,'Synthetic reason');
});

test('actual audit failures keep existing rethrow, translated-error or log-only behavior',async()=>{
  for(const entry of cases){
    const {writes,logs,deps}=environment({fail:true});
    if(entry.error)await assert.rejects(bind(entry,deps)(payload(entry)),{message:entry.error});
    else await bind(entry,deps)(payload(entry));
    assert.equal(writes.length,1);assert.equal(logs.length,1);
  }
});
