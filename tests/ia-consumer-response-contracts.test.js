import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import {
  validarPosicoesCorteDobraIA, validarOrcamentoProjetoIA, validarPrecificacaoTabelaIA,
  validarSelecaoProducaoIA, validarSugestoesAtendimentoIA,
} from '../src/components/lib/iaResponsePolicy.js';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';

const entries = {
  cut: ['comercial/CorteDobraIATab', '9fdbbbc78b46ad2a3ce3b311ad63c1b25671546ac631ddc7a9b649efbf975f25', 'handleUploadIA'],
  quote: ['site/OrcamentoAutomaticoIA', 'bb5a5b347a1e9e0f1c621d187837daad06b2b3d1339641c9e282d4879e5f3c23', 'processarComIA'],
  price: ['cadastros/TabelaPrecoFormCompleto', 'c14257497523df4afd8d1450b3597fa0aeb31455435eca35b3c9c8b124b3a7c4', 'handleSugerirPrecosIA'],
  production: ['cadastros/ConversaoProducaoMassa', 'c9fd2adcd6ee64ad24bd200782e183db672ccb919f753f3823ff1bb6a016259f', 'analisarComIA'],
  support: ['chatbot/SugestoesIA', '43dfba1d6549778d6fb465d47972ad0a32fb9f1f11f08ffc886dd10dea05c675', null],
};
const file = key => 'src/components/' + entries[key][0] + '.jsx';
const read = key => fs.readFileSync(file(key), 'utf8').replace(/\r\n/g, '\n');
test('previous shared response validators remain executable-identical to stage43', () => {
  const source=fs.readFileSync('src/components/lib/iaResponsePolicy.js','utf8').replace(/\r\n/g,'\n');
  const marker='\nconst projectQuoteSchema =';assert.equal(source.split(marker).length,2);
  const output=ts.transpileModule(source.split(marker)[0],{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,removeComments:true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(output).digest('hex'),'066c71407d970086796db1596578b3bdec27a2877f07053afd02db949af17334');
});
function actual(key) {
  const tree = ts.createSourceFile(file(key), read(key), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); let fn;
  function visit(node) {
    if (entries[key][2] && ts.isVariableDeclaration(node) && node.name.getText(tree) === entries[key][2]) {assert.ok(fn === undefined); fn = node.initializer;}
    if (!entries[key][2] && ts.isPropertyAssignment(node) && node.name.getText(tree) === 'queryFn') {assert.ok(fn === undefined); fn = node.initializer;}
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(fn, key); return {tree, fn};
}
function bind(key, deps) {const {tree,fn}=actual(key);return new Function(...Object.keys(deps), `return (${fn.getText(tree)});`)(...Object.values(deps));}
for (const [key, [,hash]] of Object.entries(entries)) test(`${key}: only exact validator boundary and grounded price sample; rest of executable code preserved`, () => {
  const source = iaResponseValidationRemainder(file(key), read(key));
  const output = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022,module: ts.ModuleKind.ESNext,jsx: ts.JsxEmit.React,removeComments: true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(output).digest('hex'), hash);
});
const quote = () => ({pecas:[{tipo:'Synthetic beam',quantidade:2,comprimento:3,peso_kg:4,preco_total:20}],resumo:{total_pecas:2,peso_total_kg:4,valor_estimado:20,prazo_dias:3},confianca:80});
const price = () => ({markup_sugerido_geral:20,markup_por_setor:{Synthetic:25},produtos_promocao:['synthetic-product'],estrategia:'Synthetic suggestion'});
const support = () => ({respostas_sugeridas:[{texto:'Synthetic response',tom:'formal'}],acoes_recomendadas:['Synthetic action'],alerta:{tem_alerta:false,tipo:'info'}});
const validators = [
  ['quote',validarOrcamentoProjetoIA,quote],
  ['price',response => validarPrecificacaoTabelaIA(response,[{produto_id:'synthetic-product'}]),price],
  ['production',response => validarSelecaoProducaoIA(response,2),()=>({indices_producao:[0,1],justificativa:'Synthetic suggestion'})],
  ['support',validarSugestoesAtendimentoIA,support],
];
for (const [name,validate,valid] of validators) {
  test(`${name}: validates object/JSON and preserves extension metadata without coercing fields`, () => {
    const response={...valid(),synthetic_extension:{unchanged:true}};
    assert.deepEqual(validate(response),response); assert.deepEqual(validate(JSON.stringify(response)),response);
  });
  test(`${name}: rejects non-object, malformed/oversized JSON with a fixed sanitized error`, () => {
    for (const input of [null,[],true,123,'SYNTHETIC_PRIVATE_CONTENT','{', ' '.repeat(1000001)]) assert.throws(()=>validate(input),error => /invalida/.test(error.message) && !error.message.includes('SYNTHETIC_PRIVATE_CONTENT'));
  });
}
test('project rejects missing summary, zero quantity, nonfinite/negative measures or money, and out-of-range confidence', () => {
  const mutations=[r=>{delete r.resumo;},r=>{r.pecas[0].quantidade=0;},r=>{r.pecas[0].quantidade='2';},r=>{r.pecas[0].comprimento=-1;},r=>{r.pecas[0].preco_total=Infinity;},r=>{r.resumo.valor_estimado=-1;},r=>{r.confianca=101;},r=>{r.pecas=Array(501).fill(r.pecas[0]);}];
  for(const mutate of mutations){const r=quote();mutate(r);assert.throws(()=>validarOrcamentoProjetoIA(r),/invalida/);}
  const zero=quote();zero.confianca=0;zero.pecas[0].preco_total=0;assert.equal(validarOrcamentoProjetoIA(zero).confianca,0);
});
test('price rejects ungrounded, duplicate or ambiguous promotion IDs, nonfinite markup and coercible strings', () => {
  for(const items of [[],[{produto_id:123}],[{produto_id:'synthetic-product'},{produto_id:'synthetic-product'}]])assert.throws(()=>validarPrecificacaoTabelaIA(price(),items),/invalida/);
  for(const patch of [{produtos_promocao:['synthetic-product','synthetic-product']},{markup_sugerido_geral:'20'},{markup_por_setor:{Synthetic:NaN}},{produtos_promocao:[123]}])assert.throws(()=>validarPrecificacaoTabelaIA({...price(),...patch},[{produto_id:'synthetic-product'}]),/invalida/);
});
test('production indices must be unique integers within the exact sent sample, never the unsent tail', () => {
  for(const indices of [[-1],[0.5],[0,0],[2],['0'],[Infinity]])assert.throws(()=>validarSelecaoProducaoIA({indices_producao:indices},2),/invalida/);
  for(const count of [-1,21,1.5,NaN])assert.throws(()=>validarSelecaoProducaoIA({indices_producao:[]},count),/invalida/);
  assert.deepEqual(validarSelecaoProducaoIA({},0),{});assert.deepEqual(validarSelecaoProducaoIA({indices_producao:[19]},20).indices_producao,[19]);
});
test('support validates optional structures and enum values, not invented content', () => {
  assert.deepEqual(validarSugestoesAtendimentoIA({}),{});
  for(const patch of [{respostas_sugeridas:[{texto:123}]},{respostas_sugeridas:[{texto:'Synthetic',tom:'invalid'}]},{alerta:{tem_alerta:'false'}},{acoes_recomendadas:[{}]}])assert.throws(()=>validarSugestoesAtendimentoIA(patch),/invalida/);
});
function environment(response, overrides={}) {
  const states=[],writes=[],requests=[],notices=[];
  const setters={};for(const name of ['setProcessandoIA','setFormData','setProcessando','setErro','setEtapa','setOrcamentoGerado','setItensTabela','setRegraCalculo','setCalculando','setAnalisandoIA','setProdutosSelecionados'])setters[name]=value=>states.push([name,value]);
  const toast=Object.assign(value=>notices.push(value),{success:value=>notices.push(value),error:value=>notices.push(value),info:value=>notices.push(value)});
  const deps={...setters,toast,console:{error(){},warn(){}},setTimeout(){throw new Error('Unexpected delayed callback');},
    base44:{integrations:{Core:{UploadFile:async()=>({file_url:'synthetic-file-url'}),InvokeLLM:async request=>{requests.push(request);return response;}}}},
    validarPosicoesCorteDobraIA,validarOrcamentoProjetoIA,validarPrecificacaoTabelaIA,validarSelecaoProducaoIA,validarSugestoesAtendimentoIA,
    bitolas:[],calcularPesoPosicao:()=>4,etapasObra:[],
    empresaAtual:{id:'synthetic-company',group_id:'synthetic-group'},grupoAtual:{id:'synthetic-group'},
    dados:{arquivo:{name:'synthetic-project.pdf'},nome:'Synthetic customer',email:'synthetic@example.invalid',descricao:'Synthetic description'},
    filterInContext:async()=>[],createInContext:async(entity,data)=>{writes.push([entity,data]);return{id:'synthetic-created',...data};},
    matchClienteSite:()=>null,stampSiteOrigem:data=>data,buildSiteLeadPayload:data=>data,onOrcamentoCriado:()=>states.push(['onOrcamentoCriado']),
    itensTabela:[{produto_id:'synthetic-product',produto_descricao:'Synthetic product',setor_atividade_nome:'Synthetic',custo_base:10,preco:10}],formData:{nome:'Synthetic table',tipo:'Venda'},
    produtosConversiveis:[{id:'synthetic-product',descricao:'Synthetic product'}],contextoValido:true,podeEditarProduto:true,auditConversao:async()=>{},
    conversa:{id:'synthetic-conversation',canal:'Synthetic'},mensagens:[{tipo_remetente:'Cliente',mensagem:'Synthetic message'}],canUseIA:true,groupId:'synthetic-group',empresaId:'synthetic-company',sanitizePromptText:value=>String(value||''),...overrides};
  return{deps,states,writes,requests,notices};
}
test('cut consumer applies validated JSON only; malformed response cannot append positions or project metadata', async () => {
  const valid={posicoes:[{codigo:'SYNTHETIC',bitola:'6.3',formato:'reto',quantidade:2,medidas:{A:10}}],confianca:80};
  for(const [response,applies] of [[JSON.stringify(valid),true],[{posicoes:'invalid'},false]]){
    const e=environment(response);await bind('cut',e.deps)({target:{files:[{name:'synthetic.pdf'}]}});
    const edits=e.states.filter(([name])=>name==='setFormData');assert.equal(edits.length,applies?1:0);assert.deepEqual(e.states.at(-1),['setProcessandoIA',false]);
    if(applies){const data=edits[0][1]({itens_corte_dobra:[],projetos_ia:[]});assert.equal(data.itens_corte_dobra.length,1);assert.equal(data.projetos_ia[0].pecas_detectadas,1);}
  }
});
test('site validates before any entity creation; invalid response returns to first step with no generated quote', async () => {
  const denied=environment({resumo:{valor_estimado:20}});await bind('quote',denied.deps)();assert.deepEqual(denied.writes,[]);assert.equal(denied.states.some(([name])=>name==='setOrcamentoGerado'),false);assert.ok(denied.states.some(([name,value])=>name==='setEtapa'&&value===1));
  const e=environment(JSON.stringify(quote()));await bind('quote',e.deps)();assert.deepEqual(e.writes.map(row=>row[0]),['OrcamentoSite','Oportunidade','AuditoriaIA','Notificacao']);assert.equal(e.writes[2][1].empresa_id,'synthetic-company');assert.equal(e.states.find(([name])=>name==='setOrcamentoGerado')[1].produtos[0].preco_unitario,10);
  const missing=environment(quote(),{empresaAtual:null});await bind('quote',missing.deps)();assert.deepEqual(missing.writes,[]);assert.deepEqual(missing.requests,[]);
});
test('price sends source IDs and refuses unseen promotions before modifying prices or calculation rules', async () => {
  for(const [response,applies] of [[JSON.stringify(price()),true],[{...price(),produtos_promocao:['synthetic-unseen']},false]]){
    const e=environment(response);await bind('price',e.deps)();const changes=e.states.filter(([name])=>name==='setItensTabela');assert.equal(changes.length,applies?1:0);
    assert.ok(e.requests[0].prompt.includes('synthetic-product'));assert.equal(e.states.filter(([name])=>name==='setRegraCalculo').length,applies?1:0);if(applies)assert.equal(changes[0][1][0].preco,12.5);
  }
  const e=environment({...price(),produtos_promocao:['synthetic-tail']},{itensTabela:Array.from({length:16},(_,i)=>({produto_id:i===15?'synthetic-tail':`synthetic-${i}`,custo_base:10,setor_atividade_nome:'Synthetic'}))});await bind('price',e.deps)();assert.equal(e.states.some(([name])=>name==='setItensTabela'),false);
});
test('production retains context/permission gates and blocks invalid or unsent selection indices', async () => {
  for(const override of [{contextoValido:false},{podeEditarProduto:false}]){const e=environment({indices_producao:[0]},override);await bind('production',e.deps)();assert.deepEqual(e.requests,[]);assert.equal(e.states.some(([name])=>name==='setProdutosSelecionados'),false);}
  for(const [response,applies] of [[{indices_producao:[0]},true],[{indices_producao:[1]},false]]){const e=environment(response);await bind('production',e.deps)();const changes=e.states.filter(([name])=>name==='setProdutosSelecionados');assert.equal(changes.length,applies?1:0);if(applies)assert.deepEqual(changes[0][1],['synthetic-product']);}
});
test('support query validates before success audit; existing canned failure fallback remains distinct from provider success', async () => {
  const e=environment(JSON.stringify(support()));assert.deepEqual(await bind('support',e.deps)(),support());assert.equal(e.writes[0][0],'AuditLog');
  const invalid=environment({respostas_sugeridas:'invalid'});const fallback=await bind('support',invalid.deps)();assert.equal(fallback.respostas_sugeridas.length,3);assert.deepEqual(invalid.writes,[]);
  const denied=environment(support(),{canUseIA:false});assert.equal(await bind('support',denied.deps)(),null);assert.deepEqual(denied.requests,[]);
});
test('provider rejection cannot create site records or apply cut/price/production suggestions; support preserves its old canned fallback', async () => {
  for(const key of Object.keys(entries)){
    const e=environment(null);e.deps.base44.integrations.Core.InvokeLLM=async()=>{throw new Error('Synthetic provider unavailable');};
    const result=await bind(key,e.deps)(...key==='cut'?[{target:{files:[{name:'synthetic.pdf'}]}}]:[]);
    assert.deepEqual(e.writes,[]);
    assert.equal(e.states.some(([name])=>['setFormData','setItensTabela','setProdutosSelecionados','setOrcamentoGerado'].includes(name)),false);
    if(key==='support')assert.equal(result.respostas_sugeridas.length,3);
  }
});
test('remainder helper rejects missing validation, changed source scope, duplicate wrappers and unrelated edits', () => {
  const source=read('production');
  for(const changed of [source.replace('Math.min(produtosConversiveis.length, 20)','produtosConversiveis.length'),source.replace('validarSelecaoProducaoIA(await','other(await'),source.replace('const indicados =','validarSelecaoProducaoIA(await base44.integrations.Core.InvokeLLM({}), Math.min(produtosConversiveis.length, 20)); const indicados =')])assert.throws(()=>iaResponseValidationRemainder(file('production'),changed));
  const restored=iaResponseValidationRemainder(file('production'),source.replace("setProdutosSelecionados(produtosIndicados)","setProdutosSelecionados([])"));
  const output=ts.transpileModule(restored,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
  assert.notEqual(crypto.createHash('sha256').update(output).digest('hex'),entries.production[1]);
});
