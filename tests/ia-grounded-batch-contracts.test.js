import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import * as policies from '../src/components/lib/iaResponsePolicy.js';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';

const entries = {
  product:['cadastros/ProdutoFormV22_Completo','c26ca71d17bf6867e58d364e0736df4e23ccf6701ed20a05dd798ff5ab94af3c','analisarDescricaoIA'],
  crm:['crm/FunilComercialInteligente','46605320887ab58b62dff04ea67ddb271e1147efef488a2bef902786fe89bf19','priorizarIAMutation'],
  production:['producao/FormularioOrdemProducao','48e3a21004e5ca4d9c91f509681193247fc617d31d94050225bbecbfd1da678b','handleGerarIA'],
  purchase:['compras/SolicitacoesCompraTab','aebd4dfc9c1fd5aaa78de56cba53cb10510cfe30c21d185e85d2defe25204b1a','sugerirComprasIA'],
  ncm:['estoque/ImportadorProdutosPlanilha','662fff9f0c0fbcb56de2da4e37a4c396484e4ec19cc247fac430e7f73b0464f3','sugerirNCMsIA'],
  delivery:['expedicao/RoteirizacaoInteligente','30c1fe08a8a41af00ef9cd6f3b0f2b3a57f591792b3f126571523754ec51fc98','gerarRotaIAMutation'],
  picking:['expedicao/SeparacaoConferenciaIA','565a41b245980e05df70d4acefe76eeae9572ee8adf84c9aae14d133ad205391','otimizarRotaMutation'],
};
const file=key=>'src/components/'+entries[key][0]+'.jsx';
const read=key=>fs.readFileSync(file(key),'utf8').replace(/\r\n/g,'\n');
const emit=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React,removeComments:true}}).outputText;
const hash=source=>crypto.createHash('sha256').update(emit(source)).digest('hex');
for(const [key,[,expected]]of Object.entries(entries))test(`${key}: all stage46 executable code retained outside the exact validator and source-ID hunks`,()=>{
  assert.equal(hash(iaResponseValidationRemainder(file(key),read(key))),expected);
});
test('all preexisting shared validators retain their stage46 executable code',()=>{
  const source=fs.readFileSync('src/components/lib/iaResponsePolicy.js','utf8').replace(/\r\n/g,'\n');
  const marker='\nconst productionPlanSchema =';assert.equal(source.split(marker).length,2);
  assert.equal(hash(source.split(marker)[0]),'aff0a9632d458daef4412591402db40a82298eb67ae4ec2e208711ccbc30d367');
});
function actual(key){
  const tree=ts.createSourceFile(file(key),read(key),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let found;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)===entries[key][2]){assert.ok(found===undefined);found=node.initializer;}ts.forEachChild(node,visit);}
  visit(tree);assert.ok(found);
  if(ts.isCallExpression(found))found=found.arguments[0].properties.find(node=>node.name?.getText(tree)==='mutationFn').initializer;
  return{tree,fn:found};
}
function bind(key,deps){const {tree,fn}=actual(key);return new Function(...Object.keys(deps),`return (${fn.getText(tree)});`)(...Object.values(deps));}
const plan=()=>({sequenciamento_sugerido:'Synthetic sequence',otimizacao_corte:'Synthetic suggestion',tempo_previsto_horas:2,gargalos:['Synthetic risk']});
const purchase=()=>({sugestoes:[{produto_codigo:'SYNTHETIC',quantidade_sugerida:2,justificativa:'Synthetic',prioridade:'Alta'}]});
const ncm=()=>({sugestoes:[{chave:'company-a:SKU',ncm_sugerido:'12345678',confianca:80}]});
const delivery=()=>({sequencia_otimizada:['delivery-a','delivery-b'],distancia_total_km:2,tempo_total_minutos:3,custo_estimado:4,economia_vs_manual:{observacao:'Synthetic extension'}});
const picking=()=>({rota_otimizada:[{ordem:1,produto:'Synthetic A',localizacao:'A1',distancia_estimada_m:2},{ordem:2,produto:'Synthetic B',localizacao:'B1'}],distancia_total_m:2,tempo_estimado_min:3});
const products=[{codigo:'SYNTHETIC'}],ncmItems=[{chave:'company-a:SKU'}],deliveries=[{id:'delivery-a'},{id:'delivery-b'}],pickItems=[{produto:'Synthetic A',localizacao:'A1'},{produto:'Synthetic B',localizacao:'B1'}];
const cases=[
  ['production',policies.validarPlanoProducaoIA,plan],
  ['purchase',value=>policies.validarSugestoesCompraIA(value,products),purchase],
  ['ncm',value=>policies.validarSugestoesNcmIA(value,ncmItems),ncm],
  ['delivery',value=>policies.validarRoteirizacaoEntregaIA(value,deliveries),delivery],
  ['picking',value=>policies.validarRotaPickingIA(value,pickItems),picking],
];
for(const [name,validate,valid]of cases){
  test(`${name}: real validator accepts object/JSON and preserves extensions without converting values`,()=>{
    const data={...valid(),synthetic_extension:{retained:true}};assert.deepEqual(validate(data),data);assert.deepEqual(validate(JSON.stringify(data)),data);
  });
  test(`${name}: rejects malformed, oversized and non-record responses`,()=>{
    for(const bad of [null,undefined,[],true,123,'invalid','{', 'x'.repeat(1000001)])assert.throws(()=>validate(bad));
  });
}
test('production rejects nonfinite time, invalid arrays and missing consumed text',()=>{
  for(const bad of [{}, {...plan(),sequenciamento_sugerido:5},{...plan(),otimizacao_corte:''},{...plan(),tempo_previsto_horas:-1},{...plan(),tempo_previsto_horas:Infinity},{...plan(),gargalos:[{}]}])assert.throws(()=>policies.validarPlanoProducaoIA(bad));
});
test('purchase references only uniquely identified sent products with positive numeric quantities',()=>{
  const validate=policies.validarSugestoesCompraIA;
  for(const change of [{produto_codigo:'outside'},{produto_codigo:1},{quantidade_sugerida:0},{quantidade_sugerida:-1},{quantidade_sugerida:'2'},{quantidade_sugerida:NaN},{prioridade:'Inventada'}])assert.throws(()=>validate({sugestoes:[{...purchase().sugestoes[0],...change}]},products));
  assert.throws(()=>validate({sugestoes:[...purchase().sugestoes,...purchase().sugestoes]},products));
  assert.throws(()=>validate(purchase(),[...products,...products]));
  assert.deepEqual(validate({sugestoes:[]},products),{sugestoes:[]});
});
test('NCM validates only shape and exact company-qualified key, never fiscal correctness',()=>{
  const validate=policies.validarSugestoesNcmIA;
  for(const change of [{chave:'company-b:SKU'},{chave:'SKU'},{ncm_sugerido:'12.34.56.78'},{ncm_sugerido:'123456789'},{ncm_sugerido:12345678},{confianca:101}])assert.throws(()=>validate({sugestoes:[{...ncm().sugestoes[0],...change}]},ncmItems));
  assert.throws(()=>validate(ncm(),[...ncmItems,...ncmItems]));
  assert.throws(()=>validate({sugestoes:[...ncm().sugestoes,...ncm().sugestoes]},ncmItems));
});
test('delivery sequence must be a complete literal source permutation; absent/empty retains existing local fallback',()=>{
  const validate=policies.validarRoteirizacaoEntregaIA;
  for(const ids of [['delivery-a'],['delivery-a','delivery-a'],['delivery-a','outside'],['delivery-a','delivery-b','outside']])assert.throws(()=>validate({...delivery(),sequencia_otimizada:ids},deliveries));
  assert.throws(()=>validate({...delivery(),sequencia_otimizada:['1']},[{id:1}]));
  assert.throws(()=>validate(delivery(),[{id:'delivery-a'},{id:'delivery-a'}]));
  assert.deepEqual(validate({sequencia_otimizada:[]},deliveries),{sequencia_otimizada:[]});
  assert.deepEqual(validate({},deliveries),{});
  for(const change of [{distancia_total_km:-1},{tempo_total_minutos:NaN},{custo_estimado:Infinity},{economia_vs_manual:[]}])assert.throws(()=>validate({...delivery(),...change},deliveries));
});
test('picking requires unambiguous product/location pairs and a complete order without invented items',()=>{
  const validate=policies.validarRotaPickingIA;
  for(const routes of [[],[picking().rota_otimizada[0]],[picking().rota_otimizada[0],picking().rota_otimizada[0]],[{...picking().rota_otimizada[0],produto:'outside'},picking().rota_otimizada[1]],[{...picking().rota_otimizada[0],ordem:3},picking().rota_otimizada[1]],[{...picking().rota_otimizada[0],localizacao:'B1'},picking().rota_otimizada[1]]])assert.throws(()=>validate({...picking(),rota_otimizada:routes},pickItems));
  assert.throws(()=>validate(picking(),[pickItems[0],pickItems[0]]));
  assert.throws(()=>validate({...picking(),distancia_total_m:'2'},pickItems));
});
function environment(response){
  const events=[],calls=[];
  const toast=Object.assign(value=>events.push(['toast',value]),{info:value=>events.push(['info',value]),success:value=>events.push(['success',value]),error:value=>events.push(['error',value])});
  return{events,calls,deps:{...policies,toast,base44:{integrations:{Core:{InvokeLLM:async input=>{calls.push(input);return response;}}}}}};
}
test('actual product consumer rejects invalid confidence before either suggestion state and resets busy flag',async()=>{
  for(const response of [{confianca:80}, {confianca:Infinity},'bad']){
    const h=environment(response),suggestions=[],busy=[];
    await bind('product',{...h.deps,setProcessandoIA:value=>busy.push(value),setIaSugestao:value=>suggestions.push(value),setSugestoesIA:value=>suggestions.push(value)})('Synthetic product');
    assert.equal(suggestions.length,response.confianca===80?2:0);assert.deepEqual(busy,[true,false]);
  }
});
test('actual OP consumer cannot change form or report success after invalid suggestions; permissions still block first',async()=>{
  for(const [response,allowed]of [[plan(),true],[{gargalos:['bad']},true],[plan(),false]]){
    const h=environment(response),forms=[],audit=[];
    await bind('production',{...h.deps,contextoValido:true,canUseIA:allowed,pedidos:[{id:'synthetic-order'}],formData:{pedido_id:'synthetic-order',observacoes:'Retained'},setFormData:update=>forms.push(update({observacoes:'Retained'})),auditarOP:async value=>audit.push(value)})();
    assert.equal(forms.length,allowed&&response.sequenciamento_sugerido?1:0);
    assert.equal(h.calls.length,allowed?1:0);if(!forms.length)assert.equal(h.events.filter(([kind])=>kind==='success').length,0);
    assert.ok(audit.length>0);
  }
});
test('actual CRM consumer rejects ungrounded or ambiguous titles before success',async()=>{
  for(const opportunities of [[{titulo:'Synthetic lead'}],[{titulo:'Other'}],[{titulo:'Synthetic lead'},{titulo:'Synthetic lead'}]]){
    const h=environment({oportunidades_priorizadas:[{titulo:'Synthetic lead',score_ia:80,motivo_priorizacao:'Synthetic'}]});
    const action=bind('crm',{...h.deps,oportunidades:opportunities});
    if(opportunities.length===1&&opportunities[0].titulo==='Synthetic lead')await action();else{await assert.rejects(action);assert.equal(h.events.filter(([kind])=>kind==='success').length,0);}
  }
});
test('actual purchase consumer validates every suggestion before its first write, retaining authorization and scoped calls',async()=>{
  for(const [response,allowed]of [[purchase(),true],[{sugestoes:[purchase().sugestoes[0],{...purchase().sugestoes[0],produto_codigo:'outside'}]},true],[purchase(),false]]){
    const h=environment(response),writes=[],audit=[];
    const action=bind('purchase',{...h.deps,contextoValido:true,canCreateSolicitacao:allowed,groupId:'synthetic-group',empresaId:'synthetic-company',filterInContext:async()=>[{id:'synthetic-product',codigo:'SYNTHETIC',status:'Ativo',estoque_minimo:2}],createInContext:async(entity,data)=>{writes.push({entity,data});return{id:'synthetic-request'};},auditSolicitacaoCompra:async value=>audit.push(value)});
    if(allowed&&response.sugestoes.length===1){await action();assert.equal(writes.length,1);assert.equal(writes[0].entity,'SolicitacaoCompra');}else{await assert.rejects(action);assert.equal(writes.length,0);}
    assert.equal(h.calls.length,allowed?1:0);
  }
});
test('actual NCM consumer rejects foreign company key before replacing draft suggestions, without importing',async()=>{
  for(const key of ['company-a:SKU','company-b:SKU']){
    const h=environment({sugestoes:[{chave:key,ncm_sugerido:'12345678'}]}),updates=[],busy=[];
    await bind('ncm',{...h.deps,setSuggesting:value=>busy.push(value),getProdutosAlvo:()=>[{empresa_id:'company-a',codigo:'SKU'}],invalidNCMKeys:new Set(['company-a:SKU']),makeKey:(company,code)=>`${company}:${code}`,setNcmSuggestions:value=>updates.push(value)})();
    assert.equal(h.calls.length,1);assert.equal(updates.length,key==='company-a:SKU'?1:0);assert.deepEqual(busy,[true,false]);
  }
});
test('actual picking mutation rejects fabricated or ambiguous items before its success consumer; denied context never calls IA',async()=>{
  for(const [response,allowed]of [[picking(),true],[{...picking(),rota_otimizada:[]},true],[picking(),false]]){
    const h=environment(response),audit=[];
    const action=bind('picking',{...h.deps,contextoValido:allowed,canUseSeparacaoIA:true,sanitizeText:value=>String(value||'').trim(),auditarSeparacaoIA:async value=>audit.push(value)});
    const items=pickItems.map(item=>({produto_descricao:item.produto,localizacao:item.localizacao}));
    if(allowed&&response.rota_otimizada.length)assert.deepEqual(await action(items),response);else await assert.rejects(()=>action(items));
    assert.equal(h.calls.length,allowed?1:0);
  }
});
test('actual delivery handler sends literal IDs and discards invalid AI references into its existing audited local fallback',async()=>{
  for(const ids of [['delivery-b','delivery-a'],['outside','delivery-a']]){
    const h=environment({...delivery(),sequencia_otimizada:ids}),writes=[],audit=[];
    const source=deliveries.map(item=>({...item,endereco_entrega_completo:{logradouro:'Synthetic',numero:'1'}}));
    const result=await bind('delivery',{...h.deps,contextoValido:true,canGenerateRoteirizacao:true,entregas:source,motoristas:[{id:'synthetic-driver'}],veiculos:[{id:'synthetic-vehicle'}],empresaAtual:{},dataRota:'2026-01-01',groupId:'synthetic-group',empresaId:'synthetic-company',user:{id:'synthetic-actor'},auditIA:async value=>audit.push(value),resolveCoordenadas:()=>({latitude:1,longitude:2}),otimizarRotaAvancada:()=>({pontos:source,distancia_total_km:2,tempo_estimado_minutos:3,algoritmo:'synthetic-local',alertas:[]}),createInContext:async(entity,data)=>{writes.push({entity,data});return{id:'synthetic-route'};},updateInContext:async(entity,id,data)=>writes.push({entity,id,data}),stampEntregaAtribuicaoRota:({sequencia})=>({sequencia})})({entregasIds:deliveries.map(item=>item.id),motoristaId:'synthetic-driver',veiculoId:'synthetic-vehicle'});
    assert.equal(result.id,'synthetic-route');assert.equal(writes.length,3);
    assert.equal(writes[0].data.group_id,'synthetic-group');assert.equal(writes[0].data.empresa_id,'synthetic-company');
    assert.deepEqual(writes[0].data.entregas_ids,ids[0]==='outside'?['delivery-a','delivery-b']:ids);
    assert.equal(writes[0].data.otimizacao_ia.llm_fallback,ids[0]==='outside');
    for(const id of deliveries.map(item=>item.id))assert.ok(h.calls[0].prompt.includes(`"entrega_id":"${id}"`));
    if(ids[0]==='outside')assert.ok(audit.some(item=>item.acao==='RoteirizacaoIA.llm.fallback'&&item.sucesso===false));
  }
});
test('exact consumer normalizer rejects missing/duplicated validator, changed grounding, or missing sent IDs',()=>{
  const path=file('delivery'),source=read('delivery');
  assert.throws(()=>iaResponseValidationRemainder(path,source.replace('validarRoteirizacaoEntregaIA(await','unvalidated(await')));
  assert.throws(()=>iaResponseValidationRemainder(path,source.replace('}), entregasSelecionadas);','}), entregas);')));
  assert.throws(()=>iaResponseValidationRemainder(path,source.replace('  entrega_id: e.id,\n','')));
  assert.throws(()=>iaResponseValidationRemainder(path,source+'\nvalidarRoteirizacaoEntregaIA(await base44.integrations.Core.InvokeLLM({}), entregasSelecionadas);'));
});

test('actual delivery lookup preserves literal IDs even when number and string have identical text',()=>{
  const tree=ts.createSourceFile(file('delivery'),read('delivery'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let initializer;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='entregasOrdenadas'){assert.ok(initializer===undefined);initializer=node.initializer;}ts.forEachChild(node,visit);}
  visit(tree);assert.ok(initializer);
  const source=[{id:1,marker:'numeric'},{id:'1',marker:'text'}],ids=['1',1];
  const validated=policies.validarRoteirizacaoEntregaIA({sequencia_otimizada:ids},source);
  const result=new Function('sequenciaIds','entregasSelecionadas',`return ${initializer.getText(tree)};`)(validated.sequencia_otimizada,source);
  assert.deepEqual(result.map(item=>item.marker),['text','numeric']);
});
