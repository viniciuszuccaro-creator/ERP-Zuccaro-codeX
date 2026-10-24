import test from 'node:test';
import {commandAuditRemainder} from './helpers/commandAuditRemainder.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import {iaResponseValidationRemainder} from './helpers/iaResponseValidationRemainder.js';
import {buildReposicaoSuggestions, assertForecastUiContext} from '../src/components/lib/iaTransversalPolicy.js';
import {buildDocumentoFromOportunidade, stampOportunidadeConvertida} from '../src/components/lib/crmOportunidadePolicy.js';
import {stampMovimentacaoRecebimentoOc, stampContaPagarRecebimentoOc, findContaPagarOc} from '../src/components/lib/comprasOrdemPolicy.js';

const entries = {
  stock: {file: 'estoque/IAReposicao', hash: '70108036cf8376d2557cedc01ac52b54772e4a10c49de4db19ea097b01fdec12', names: ['gerarSolicitacaoMutation']},
  request: {file: 'estoque/SolicitacoesTab', hash: '8bdd86f9de2411d15a6b73aee884c5d9b539ac719099e9dd1e80a11bd566be03', names: ['aprovarSolicitacaoMutation','rejeitarSolicitacaoMutation']},
  crm: {file: 'crm/OportunidadesLista', hash: '3dde6824a32763be296d3a20918a107967f04e5aa6fe533feb911cfbb700ba7b', names: ['convertMutation']},
  funnel: {file: 'crm/FunilComercialInteligente', hash: '46605320887ab58b62dff04ea67ddb271e1147efef488a2bef902786fe89bf19', names: ['updateEtapaMutation']},
  purchase: {file: 'compras/OrdensCompraTab', hash: '4fd71e268eb4ac9a454d986314501dd362d06fcf76aea9e09cc78b753dddd78c', names: ['receberMutation']},
  config: {file: 'expedicao/financeiro/ConfigFinanceiroLogistica', hash: 'f1dc46fb48eb29876ad48dbe758babbc55c1a4b56c1557270328ccb7dd7ad9de', names: ['saveMutation'], state: 'form'},
  cashier: {file: 'financeiro/caixa-central/LiquidarReceberPagar', hash: 'b9856099444f6c2ffc68e8ecf1cb7c48aced6a48f0dbccedb7146224945976b8', names: ['enviarParaCaixaMutation']},
  allocation: {file: 'financeiro/RateioMultiempresa', hash: 'b292e05282b44f1e3cf44dfca4f0b44316a5ff40d3d78bfe18fe18b020ef88ff', names: ['criarRateioMutation'], state: 'formRateio'},
};
const read = kind => fs.readFileSync('src/components/' + entries[kind].file + '.jsx', 'utf8').replace(/\r\n/g, '\n');
function variable(kind, name) {
  const tree = ts.createSourceFile('source.jsx', read(kind), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX); let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && (name === entries[kind].state ? ts.isArrayBindingPattern(node.name) && node.name.elements[0]?.getText(tree) === name : node.name.getText(tree) === name)) {
      assert.ok(found === undefined, `Duplicate variable: ${name}`); found = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found, name); return {tree, node: found};
}
function command(kind, name) {
  const {tree, node} = variable(kind, name);
  return {tree, fn: node.initializer.arguments[0].properties.find(prop => prop.name?.getText(tree) === 'mutationFn').initializer};
}
function bind(kind, name, deps) {
  const {tree, fn} = command(kind, name);
  return new Function(...Object.keys(deps), `return (${fn.getText(tree)});`)(...Object.values(deps));
}
const suggestion = () => buildReposicaoSuggestions({produtos: [{id: 'synthetic-product', descricao: 'Synthetic product', codigo: 'SYNTHETIC', estoque_atual: 1, estoque_minimo: 3, empresa_id: 'synthetic-company'}], movimentacoes: [], empresaId: 'synthetic-company', hoje: new Date('2026-10-20T12:00:00Z')}).sugestoes[0];
const order = () => ({id: 'synthetic-order', empresa_id: 'synthetic-company', group_id: 'synthetic-group', fornecedor_id: 'synthetic-supplier', fornecedor_nome: 'Synthetic supplier', data_envio_fornecedor: '2026-10-10', numero_oc: 'SYNTHETIC', valor_total: 20, itens: [], historico: [], status: 'Enviada ao Fornecedor'});
function payload(kind, name) {
  if (kind === 'stock') return suggestion();
  if (kind === 'request') return {solicitacao: {id: 'synthetic-request'}, aprovador: 'Synthetic actor', ...(name.startsWith('rejeitar') ? {motivo: 'Synthetic reason'} : {})};
  if (kind === 'crm') return {oportunidade: {id: 'synthetic-opportunity', cliente_id: 'synthetic-client', empresa_id: 'synthetic-company', group_id: 'synthetic-group', valor_estimado: 20}, tipo: 'pedido'};
  if (kind === 'funnel') return {id: 'synthetic-opportunity', etapa: 'Proposta'};
  if (kind === 'purchase') return {id: 'synthetic-order', oc: order(), dados: {data_entrega_real: '2026-10-20', nota_fiscal_entrada: 'SYNTHETIC'}};
  if (kind === 'config') return {centro_custo_id: '', plano_contas_id: '', forma_recebimento: 'PIX', forma_pagamento: 'Cartao', custo_km: 2.5, dias_vencimento: 7};
  if (kind === 'cashier') return {titulos: [{id: 'synthetic-title', valor: 20, cliente: 'Synthetic client'}], tipo: 'receber'};
  return {tipo_documento: 'ContaPagar', descricao: 'Synthetic allocation', categoria: 'Synthetic category', valor_total: 20, data_vencimento: '2026-10-20', criterio_rateio: 'percentual', distribuicao: [{empresa_id: 'synthetic-company', empresa_nome: 'Synthetic company', percentual: 100, valor: '20.00', observacao: ''}]};
}
function invalid(kind, name) {
  const data = payload(kind, name);
  if (kind === 'stock') return {...data, quantidade_sugerida: false};
  if (kind === 'request') return {...data, aprovador: false};
  if (kind === 'crm') return {...data, oportunidade: {...data.oportunidade, id: false}};
  if (kind === 'funnel') return {...data, etapa: false};
  if (kind === 'purchase') return {...data, dados: {...data.dados, data_entrega_real: false}};
  if (kind === 'config') return {...data, custo_km: false};
  if (kind === 'cashier') return {...data, titulos: [{id: false, valor: 20}]};
  return {...data, distribuicao: [{...data.distribuicao[0], valor: false}]};
}
for (const [kind, entry] of Object.entries(entries)) test(`${entry.file}: whole executable remainder frozen before stage43`, () => {
  let source = commandAuditRemainder('src/components/'+entry.file+'.jsx',read(kind));
  if (kind === 'allocation') {
    const replace = (after, before, count) => { assert.equal(source.split(after).length - 1, count); source = source.split(after).join(before); };
    replace('Number(dist.valor) > 0', 'dist.valor > 0', 1);
    replace('parseFloat(String(dist.valor))', 'parseFloat(dist.valor)', 1);
    replace('parseFloat(String(d.percentual))', 'parseFloat(d.percentual)', 3);
    replace('parseFloat(String(d.valor))', 'parseFloat(d.valor)', 1);
  }
  const output = ts.transpileModule(iaResponseValidationRemainder('src/components/'+entry.file+'.jsx',source), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React, removeComments: true}}).outputText;
  assert.equal(crypto.createHash('sha256').update(output).digest('hex'), entry.hash);
});
test('nine actual mutation payloads accept producer-shaped inputs and reject malformed fields', () => {
  let source = "import React,{useState} from 'react';\nimport {useMutation} from '@tanstack/react-query';\nimport {buildReposicaoSuggestions} from '../lib/iaTransversalPolicy.js';\nimport {buildDocumentoFromOportunidade} from '../lib/crmOportunidadePolicy.js';\n";
  const negative = [];
  for (const [kind, entry] of Object.entries(entries)) for (const name of entry.names) {
    const {tree, fn} = command(kind, name); source += '{\n';
    if (kind === 'allocation') {
      const component = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'RateioMultiempresa');
      source += component.jsDoc.filter(doc => doc.getText(tree).includes('@typedef')).map(doc => doc.getText(tree)).join('\n') + '\n';
      source += "const empresas=[{id:'synthetic-company',razao_social:'Synthetic company'}];\n";
    }
    if (entry.state) { const state = variable(kind, entry.state); source += state.node.parent.parent.getFullText(state.tree) + '\n'; }
    source += `const c=useMutation({mutationFn:async (${fn.parameters[0].getFullText(tree)})=>{}});\nc.mutate(${JSON.stringify(payload(kind,name))});\n`;
    negative.push(source.split('\n').length - 1); source += `c.mutate(${JSON.stringify(invalid(kind,name))});\n}\n`;
  }
  const filename = path.resolve('src/components/financeiro/synthetic-scoped-command.js');
  const options = {allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true};
  const host = ts.createCompilerHost(options), readFile = host.readFile; host.readFile = file => path.resolve(file) === filename ? source : readFile(file);
  const errors = ts.createProgram([filename], options, host).getSemanticDiagnostics().filter(e => e.file && path.resolve(e.file.fileName) === filename);
  assert.deepEqual(errors.map(e => e.file.getLineAndCharacterOfPosition(e.start).line), negative, errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n')); assert.equal(negative.length, 9);
});
function environment(overrides = {}) {
  const writes = [], audits = [], reads = [];
  const createInContext = async (entity, data) => { writes.push(['create', entity, data]); return {id: 'synthetic-created', ...data}; };
  const updateInContext = async (entity, id, data) => { writes.push(['update', entity, id, data]); return {id, ...data}; };
  const base44 = {entities: {}};
  for (const entity of ['RateioFinanceiro','ContaPagar','ContaReceber']) base44.entities[entity] = {create: data => createInContext(entity, data), update: (id,data) => updateInContext(entity,id,data)};
  const deps = {createInContext, updateInContext, base44, filterInContext: async (entity, filter) => {reads.push([entity,filter]); return [];},
    contextoValido: true, podeSolicitar: true, podeAprovarSolicitacao: true, canConvert: true, canReceiveOC: true, canEditConfig: true, podeEnviarCaixa: true,
    groupId: 'synthetic-group', empresaId: 'synthetic-company', scopeType: 'empresa', grupoId: 'synthetic-group', effectiveGroupId: 'synthetic-group', effectiveEmpresaId: 'synthetic-company',
    empresaAtual: {id: 'synthetic-company'}, user: {id: 'synthetic-user', full_name: 'Synthetic user'}, authUser: {id: 'synthetic-user'}, fornecedores: [],
    requireIaHumanConfirm: () => true, assertForecastUiContext, buildDocumentoFromOportunidade, stampOportunidadeConvertida, stampMovimentacaoRecebimentoOc, stampContaPagarRecebimentoOc, findContaPagarOc,
    auditConfig: async row => audits.push(row), auditOrdemCompra: async row => audits.push(row), auditLiquidacao: async (...args) => audits.push(args),
    cfgKey: 'synthetic-config', sanitizeText: value => String(value || '').trim(), window: {confirm: () => true}, formatCurrency: String,
    withContext: data => ({...data, group_id: 'synthetic-group', grupo_id: 'synthetic-group', empresa_id: 'synthetic-company'}), ...overrides};
  return {deps, writes, audits, reads};
}
test('stock suggestion uses the real local forecast producer; context, permission and human cancellation prevent writes', async () => {
  const input = suggestion(); assert.equal(input.quantidade_sugerida, 2);
  for (const override of [{groupId: null}, {empresaId: null}, {podeSolicitar: false}, {requireIaHumanConfirm: () => false}]) {
    const e = environment(override); await assert.rejects(bind('stock', 'gerarSolicitacaoMutation', e.deps)(input)); assert.deepEqual(e.writes, []);
  }
  const e = environment(); await bind('stock', 'gerarSolicitacaoMutation', e.deps)(input);
  assert.deepEqual(e.writes.map(row => row[1]), ['SolicitacaoCompra','AuditLog']); assert.equal(e.writes[0][2].empresa_id, 'synthetic-company'); assert.equal(e.writes[0][2].quantidade_solicitada, 2);
});
test('request approve/reject retain permission denial, exact transition and actor/reason fields', async () => {
  for (const name of entries.request.names) {
    const denied = environment({podeAprovarSolicitacao: false}); await assert.rejects(bind('request', name, denied.deps)(payload('request',name))); assert.deepEqual(denied.writes, []);
    const e = environment(); await bind('request',name,e.deps)(payload('request',name)); const patch = e.writes[0][3];
    assert.equal(patch.status, name.startsWith('aprovar') ? 'Aprovada' : 'Rejeitada'); assert.equal(patch.aprovador, 'Synthetic actor');
    if (name.startsWith('rejeitar')) assert.equal(patch.motivo_rejeicao, 'Synthetic reason');
  }
});
test('CRM preserves canonical conversion policy, permission failure and create-before-source update', async () => {
  const denied = environment({canConvert: false}); await assert.rejects(bind('crm','convertMutation',denied.deps)(payload('crm'))); assert.deepEqual(denied.writes, []);
  for (const tipo of ['pedido','orcamento']) {
    const e = environment(); await bind('crm','convertMutation',e.deps)({...payload('crm'),tipo});
    assert.deepEqual(e.writes.map(row => row[1]), ['Pedido','Oportunidade']); assert.equal(e.writes[0][2].empresa_id, 'synthetic-company'); assert.equal(e.writes[1][3].status, 'Ganho');
  }
  const e = environment(); await bind('funnel','updateEtapaMutation',e.deps)(payload('funnel')); assert.deepEqual(e.writes[0].slice(1), ['Oportunidade','synthetic-opportunity',{etapa:'Proposta',etapa_funil:'Proposta'}]);
});
test('logistics config keeps context/permission/confirmation audit gates, sanitization and create versus update', async () => {
  for (const override of [{contextoValido:false},{canEditConfig:false},{window:{confirm:()=>false}}]) {
    const e = environment(override); await assert.rejects(bind('config','saveMutation',e.deps)(payload('config'))); assert.deepEqual(e.writes, []); assert.equal(e.audits[0].sucesso,false);
  }
  for (const existing of [false,true]) {
    const e = environment({filterInContext: async()=>existing?[{id:'synthetic-config'}]:[]}); await bind('config','saveMutation',e.deps)({...payload('config'),custo_km:-2});
    assert.equal(e.writes[0][0],existing?'update':'create'); const data=e.writes[0].at(-1); assert.equal(data.valor_json.custo_km,0); assert.equal(data.empresa_id,'synthetic-company'); assert.equal(data.group_id,'synthetic-group');
  }
});
test('cashier requests retain all guards, scoped order payload and audit; they do not execute payment', async () => {
  for (const override of [{contextoValido:false},{empresaId:null},{podeEnviarCaixa:false},{window:{confirm:()=>false}}]) {
    const e=environment(override); await assert.rejects(bind('cashier','enviarParaCaixaMutation',e.deps)(payload('cashier'))); assert.deepEqual(e.writes,[]);
  }
  for (const titulos of [[],[{id:'synthetic-title',valor:0}]]) {const e=environment(); await assert.rejects(bind('cashier','enviarParaCaixaMutation',e.deps)({...payload('cashier'),titulos})); assert.deepEqual(e.writes,[]);}
  for (const tipo of ['receber','pagar']) {
    const e=environment(); await bind('cashier','enviarParaCaixaMutation',e.deps)({...payload('cashier'),tipo}); const data=e.writes[0][2];
    assert.equal(e.writes[0][1],'CaixaOrdemLiquidacao'); assert.equal(data.status,'Pendente'); assert.equal(data.empresa_id,'synthetic-company'); assert.equal(data.titulos_vinculados[0].titulo_id,'synthetic-title'); assert.equal(e.audits.at(-1)[0],'titulos_enviados_caixa');
  }
});
test('purchase receipt preserves denial/audit, existing title reuse and scoped title creation with real policy', async () => {
  for (const override of [{contextoValido:false},{canReceiveOC:false}]) {const e=environment(override); await assert.rejects(bind('purchase','receberMutation',e.deps)(payload('purchase'))); assert.deepEqual(e.writes,[]); assert.equal(e.audits[0].sucesso,false);}
  for (const reuse of [false,true]) {
    const e=environment({filterInContext:async()=>reuse?[{id:'synthetic-existing-title',origem_documento_id:'synthetic-order',origem_tipo:'ordem_compra'}]:[]});
    const result=await bind('purchase','receberMutation',e.deps)(payload('purchase')); assert.equal(result.leadTimeReal,10); assert.equal(result.contaPagarReuso,reuse);
    const titles=e.writes.filter(row=>row[1]==='ContaPagar'); assert.equal(titles.length,reuse?0:1);
    if(!reuse){assert.equal(titles[0][2].empresa_id,'synthetic-company');assert.equal(titles[0][2].origem_documento_id,'synthetic-order');}
  }
});
test('allocation keeps numeric and formatted string inputs equivalent without changing amounts or distribution', async () => {
  for(const value of [20,'20.00',0,'0',-1,'-1']) {
    const e=environment(), input=payload('allocation'); input.distribuicao[0].valor=value;
    await bind('allocation','criarRateioMutation',e.deps)(input); const titles=e.writes.filter(row=>['ContaPagar','ContaReceber'].includes(row[1]));
    assert.equal(titles.length,Number(value)>0?1:0); if(titles.length){assert.equal(titles[0][2].valor,20);assert.equal(titles[0][2].group_id,'synthetic-group');assert.equal(titles[0][2].empresa_id,'synthetic-company');}
  }
  for(const value of [0,-0,1,-1,100,0.01,'20.00','',null,undefined,NaN,Infinity]) {
    assert.ok(Object.is(parseFloat(value),parseFloat(String(value)))); assert.equal(value>0,Number(value)>0);
  }
});
test('write/query/audit failures propagate; synthetic handlers do not prove transactional rollback', async () => {
  const fail=async()=>{throw new Error('synthetic boundary failure');};
  for(const [kind,entry] of Object.entries(entries))for(const name of entry.names){const e=environment({createInContext:fail,updateInContext:fail});for(const entity of Object.values(e.deps.base44.entities)){entity.create=fail;entity.update=fail;}await assert.rejects(Promise.resolve().then(()=>bind(kind,name,e.deps)(payload(kind,name))),/synthetic boundary failure/);}
  const audit=environment({auditLiquidacao:fail});await assert.rejects(bind('cashier','enviarParaCaixaMutation',audit.deps)(payload('cashier')));assert.equal(audit.writes.length,1);
  const query=environment({filterInContext:fail});await assert.rejects(bind('config','saveMutation',query.deps)(payload('config')));assert.deepEqual(query.writes,[]);
});
