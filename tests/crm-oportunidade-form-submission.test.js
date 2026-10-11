import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createCrmFormSubmissionGate } from '../src/components/crm/crmFormSubmission.js';
import { isCadastroSelfManagedScopeCurrent } from '../src/components/cadastros/cadastroEditLoadPolicy.js';

const require=createRequire(import.meta.url);
for(const [file,entity] of [['OportunidadeForm','oportunidade'],['InteracaoForm','interacao'],['CampanhaForm','campanha']]) {
  test(`${file} aguarda callback único e preserva payload validado/carimbado`,async()=>{
    const source=await readFile(new URL(`../src/components/crm/${file}.jsx`,import.meta.url),'utf8');
    const code=transformSync(source,{loader:'jsx',format:'cjs',jsx:'transform'}).code;
    let wrapper;let calls=0;let finish;let settled=false;let current=true;
    const module={exports:{}};
    const ui=new Proxy({}, {get:()=>props=>React.createElement('div',null,props.children)});
    runInNewContext(code,{module,exports:module.exports,require:path=>{
      if(path==='react'||path==='zod')return require(path);
      if(path==='./crmFormSubmission')return {createCrmFormSubmissionGate};
      if(path.includes('FormWrapper'))return {__esModule:true,default:props=>{wrapper=props;return React.createElement('div',null,props.children);}};
      if(path.includes('useContextoVisual'))return {__esModule:true,default:()=>({grupoAtual:{id:'group'},empresaAtual:{id:'company'}})};
      if(path.includes('useCadastroFormScopeGuard'))return {__esModule:true,default:()=>({assertCurrent:()=>{if(!current)throw new Error('changed context');}})};
      return ui;
    }});
    const payload={id:'original',titulo:'Title',nome:'Campaign',cliente_nome:'Client',data_inicio:'2026-10-11',
      tipo:'Ligação',duracao:'25.5',orcamento:'35.5',descricao:'Keep',extension:{reference:'original'},group_id:'group',empresa_id:'company'};
    renderToString(React.createElement(module.exports.default,{[entity]:payload,onSubmit:async data=>{
      calls++;assert.equal(data.id,'original');assert.equal(data.group_id,'group');assert.equal(data.empresa_id,'company');
      assert.deepEqual(data.extension,{reference:'original'});assert.equal(data.descricao,'Keep');
      if(entity==='interacao')assert.equal(data.duracao,25.5);
      if(entity==='campanha')assert.equal(data.orcamento,35.5);
      return new Promise(resolve=>{finish=resolve;});
    }}));
    const first=wrapper.onSubmit(payload).then(()=>{settled=true;});const second=wrapper.onSubmit(payload);
    await Promise.resolve();assert.equal(calls,1);assert.equal(settled,false);
    finish({id:'original'});await Promise.all([first,second]);assert.equal(settled,true);assert.equal(calls,1);
    current=false;await wrapper.onSubmit(payload);assert.equal(calls,1);
  });
}

test('submissão concorrente grava uma vez, espera persistência e preserva todos os campos',async()=>{
  const gate=createCrmFormSubmissionGate();let finish;let calls=0;const states=[];
  const payload={id:'original',titulo:'Antes',descricao:'preservada',extension:{items:[1,2]},group_id:'group',empresa_id:'company'};
  const submit=async data=>{calls++;assert.deepEqual(data,{...payload,titulo:'Antes',extension:{items:[1,2]}});return new Promise(resolve=>{finish=resolve;});};
  const args={payload,submit,assertCurrent:()=>{},onPending:v=>states.push(v)};
  const first=gate.run(args),second=gate.run(args);assert.equal(first,second);
  payload.titulo='Depois';payload.extension.items.push(3);
  await Promise.resolve();assert.equal(calls,1);assert.deepEqual(states,[true]);
  finish({id:'original'});assert.deepEqual(await first,{id:'original'});assert.deepEqual(states,[true,false]);
});

test('falha permite tentativa explícita, sem repetição automática ou perda dos campos',async()=>{
  const gate=createCrmFormSubmissionGate();let calls=0;const payload={titulo:'Preservado',observacoes:'Manter'};
  const args={payload,assertCurrent:()=>{},submit:async()=>{calls++;throw new Error('synthetic failure');}};
  await assert.rejects(gate.run(args),/synthetic failure/);assert.equal(calls,1);
  assert.deepEqual(payload,{titulo:'Preservado',observacoes:'Manter'});
  assert.equal(await gate.run({...args,submit:async data=>{calls++;return data.titulo;}}),'Preservado');assert.equal(calls,2);
});

test('troca de tenant/ator/sessão bloqueia antes da escrita e retorno tardio pede consulta',async()=>{
  const opened={groupId:'group',empresaId:'company',actorId:'actor',token:'synthetic-session'};
  for(const field of Object.keys(opened)){
    let active={...opened,[field]:'changed'};let calls=0;
    const assertCurrent=()=>{if(!isCadastroSelfManagedScopeCurrent(opened,active,active))throw new Error('stale context');};
    const gate=createCrmFormSubmissionGate();const args={payload:{titulo:'Keep'},assertCurrent,submit:async()=>{calls++;return 'saved';}};
    await assert.rejects(gate.run(args),/stale context/);assert.equal(calls,0);
    active={...opened};
    await assert.rejects(gate.run({...args,submit:async()=>{calls++;active={...opened,[field]:'changed'};return 'saved';}}),/pode ter sido concluída/);
    assert.equal(calls,1);
    await assert.rejects(gate.run(args),/stale context/);assert.equal(calls,1);
  }
});
