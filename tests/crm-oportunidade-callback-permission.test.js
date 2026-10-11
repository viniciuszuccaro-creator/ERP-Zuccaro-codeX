import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
const require=createRequire(import.meta.url);
const query=require('@tanstack/react-query');

async function fixture(edit=false) {
  const source=await readFile(new URL('../src/components/crm/OportunidadesLista.jsx',import.meta.url),'utf8');
  const code=transformSync(source,{loader:'jsx',format:'cjs'}).code;
  const state={allowed:true,writes:0,success:0,submitted:null,late:false};
  let form;const buttons=[];const module={exports:{}};
  const ui=new Proxy({}, {get:(_target,key)=>props=>{
    if(key==='Button')buttons.push(props);
    return React.createElement('div',null,props.children);
  }});
  const save=async(...args)=>{state.writes++;state.submitted=args;if(state.late)state.allowed=false;return {id:'saved'};};
  runInNewContext(code,{module,exports:module.exports,require:path=>{
    if(path==='react')return require(path);
    if(path==='@tanstack/react-query')return query;
    if(path==='sonner')return {toast:{success:()=>state.success++,error:()=>{}}};
    if(path.includes('useWindow'))return {useWindow:()=>({openWindow:(_component,props)=>{form=props;}})};
    if(path.includes('usePermissions'))return {__esModule:true,default:()=>({hasPermission:()=>state.allowed})};
    if(path.includes('useContextoVisual'))return {__esModule:true,default:()=>({createInContext:save,updateInContext:save,empresaAtual:{id:'company'}})};
    if(path.includes('crmOportunidadePolicy'))return {oportunidadeAberta:()=>false};
    if(path.includes('OportunidadeForm')||path.includes('ConverterOportunidade'))return {__esModule:true,default:()=>null};
    return ui;
  }});
  const client=new query.QueryClient({defaultOptions:{mutations:{retry:false}}});
  renderToString(React.createElement(query.QueryClientProvider,{client},
    React.createElement(module.exports.default,{oportunidades:edit?[{id:'original',titulo:'Keep',status:'Aberto'}]:[]})));
  const button=edit?buttons.find(item=>item.children==='Abrir'):buttons[0];
  assert.ok(button?.onClick,'existing action must remain present');button.onClick();assert.ok(form?.onSubmit);
  return {state,form,close:()=>client.clear()};
}

for(const edit of [false,true]) {
  test(`${edit?'edição':'criação'} revalida permissão ao submeter janela e após gravação`,async()=>{
    const f=await fixture(edit);
    try {
      f.state.allowed=false;
      await assert.rejects(f.form.onSubmit({titulo:'Keep',extension:{reference:'original'}}),/Sem permissão/);
      assert.equal(f.state.writes,0);assert.equal(f.state.success,0);
      f.state.allowed=true;await f.form.onSubmit({titulo:'Keep',extension:{reference:'original'}});
      assert.equal(f.state.writes,1);assert.equal(f.state.success,1);
      assert.equal(f.state.submitted[0],'Oportunidade');
      if(edit)assert.equal(f.state.submitted[1],'original');
      assert.deepEqual(f.state.submitted.at(-1).extension,{reference:'original'});
      f.state.late=true;
      await assert.rejects(f.form.onSubmit({titulo:'After'}),/pode ter sido concluída/);
      assert.equal(f.state.writes,2);assert.equal(f.state.success,1);
      await assert.rejects(f.form.onSubmit({titulo:'Retry'}),/Sem permissão/);
      assert.equal(f.state.writes,2);
    }finally{f.close();}
  });
}
