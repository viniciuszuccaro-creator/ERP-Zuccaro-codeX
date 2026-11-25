import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const baseline = process.env.CADASTROS_COMPARE_BASE;
for (const before of baseline ? [true, false] : [false]) {
test(`Cadastros no Chrome: ${before ? 'referencia antes do ajuste' : 'menu e categoria sem leitura antes de selecionar entidade'}`, { timeout: 30000 }, async t => {
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const installed = existsSync(cache) ? readdirSync(cache).filter(name => /^chromium-\d+$/.test(name))
    .flatMap(name => ['chrome-linux/chrome', 'chrome-linux64/chrome'].map(file => join(cache, name, file))) : [];
  const binary = process.env.CHROME_BIN || (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', ...installed].find(existsSync));
  assert.ok(binary && existsSync(binary), 'Chrome existente necessario; nenhum browser sera instalado');
  const bundle = await build({ stdin: { loader: 'jsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import { WindowProvider, useWindowManager } from './src/components/lib/WindowManager.jsx';
    import WindowRenderer from './src/components/lib/WindowRenderer.jsx';
    import Cadastros from './src/pages/Cadastros.jsx';
    window.probe = { counts: 0, lists: 0 };
    window.addEventListener('error', event=>fetch('/result',{method:'POST',body:JSON.stringify({error:event.message})}));
    const root=document.querySelector('#root');
    const started=performance.now();
    function ScopeProbe(){const state=useWindowManager();window.probe.windows=state.windows.length;return null;}
    createRoot(root).render(<QueryClientProvider client={new QueryClient()}><WindowProvider><ScopeProbe/><Cadastros/><WindowRenderer/></WindowProvider></QueryClientProvider>);
    const assert=(ok,label)=>{if(!ok)throw Error(label);};
    async function wait(predicate,label){
      for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}
      throw Error(label);
    }
    async function run(){
      await wait(()=>root.querySelector('[aria-expanded]'),'menu');
      const menuMs=performance.now()-started;
      if (${before}) await wait(()=>window.probe.counts>0,'eager count in reference');
      else {
        assert(!root.querySelector('[aria-expanded="true"]'),'initial block open');
        assert(!window.probe.counts&&!window.probe.lists,'initial reads');
        root.querySelector('[aria-expanded]').click();
      }
      const clientButton=()=>root.querySelector('button[data-action="Cadastros.Cliente.abrir"]');
      await wait(()=>clientButton()&&!clientButton().disabled,'entity shortcut');
      if (!${before}) assert(!window.probe.counts&&!window.probe.lists,'category reads');
      assert(!window.probe.lists,'early visualizer');
      const countsBeforeClick=window.probe.counts;
      const clicked=performance.now();
      clientButton().closest('div[data-action="Cadastros.Cliente.abrir"]').click();
      await wait(()=>window.probe.lists===1&&window.probe.counts>0,'read after click');
      return {menuMs,pageProbeMs:performance.now()-clicked,countsBeforeClick,...window.probe};
    }
    run().then(result=>fetch('/result',{method:'POST',body:JSON.stringify(result)}))
      .catch(error=>fetch('/result',{method:'POST',body:JSON.stringify({error:String(error),...window.probe})}));
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'cadastros-synthetic-transport', setup(b) {
    if (before) b.onLoad({ filter: /[\\/](Cadastros|useCadastrosAllCounts)\.jsx$/ }, ({ path }) => {
      const target = path.endsWith('useCadastrosAllCounts.jsx')
        ? 'src/components/cadastros/hooks/useCadastrosAllCounts.jsx' : 'src/pages/Cadastros.jsx';
      return { contents: execFileSync('git',['show',baseline+':'+target],{encoding:'utf8'}), loader:'jsx' };
    });
    const modules = {
      api: `export const base44={functions:{invoke:async(_n,p)=>{window.probe.counts++;return{data:Object.fromEntries(p.entities.map(x=>[x.entityName,0]))};}},entities:{}};`,
      context: `export const useContextoVisual=()=>({empresaAtual:{id:'e',group_id:'g'},grupoAtual:{id:'g'},empresasDoGrupo:[],createInContext:async()=>{}});`,
      permissions: `export default()=>({isAdmin:()=>true,hasPermission:()=>true,hasPermissionKey:()=>true});`,
      user: `export const useUser=()=>({user:{id:'synthetic'}});`,
      session: `export const readErpHttpSession=()=>({actorId:'synthetic'});`,
      http: `export const central360SessionKey=()=>null;`,
      toast: `export const useToast=()=>({toast:()=>{}});`,
      empty: `export default()=>null;`,
      visualizer: `import React,{useEffect} from 'react';export default function Visualizer(){useEffect(()=>{window.probe.lists++;},[]);return <div>Lista de teste</div>;}`,
    };
    const hooks = /(?:^|\/)(base44Client|useContextoVisual|usePermissions|UserContext|erpHttpSession|httpApiClient|use-toast|VisualizadorUniversalEntidadeV24|ExternalAppsHub)(?:\.[\w]+)?$/;
    b.onResolve({ filter: hooks }, ({ path }) => ({ namespace: 'synthetic', path: ({
      base44Client:'api',useContextoVisual:'context',usePermissions:'permissions',UserContext:'user',
      erpHttpSession:'session',httpApiClient:'http','use-toast':'toast',VisualizadorUniversalEntidadeV24:'visualizer',
      ExternalAppsHub:'empty',
    })[path.split('/').pop().split('.')[0]] }));
    b.onResolve({ filter: /(?:Form(?:Completo)?|Tab|Modal|CadastroClienteCompleto|CadastroFornecedorCompleto|ProdutoFormV22_Completo|VisualizadorProdutos)(?:\.jsx)?$/ }, ({ path }) =>
      path.includes('cadastros/') || path.includes('/rh/') ? {namespace:'synthetic',path:'empty'} : undefined);
    b.onLoad({ filter: /.*/, namespace: 'synthetic' }, ({ path }) =>
      ({ contents: modules[path], loader: 'jsx', resolveDir: process.cwd() }));
  } }] });
  let finish;
  const report = new Promise(resolve => { finish = resolve; });
  const server = createServer((req,res)=>{
    if(req.url==='/result'){
      let body='';req.on('data',chunk=>{body+=chunk;});
      req.on('end',()=>{res.end('ok');finish(JSON.parse(body));});
    }else if(req.url==='/bundle.js'){
      res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents);
    }else res.end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
  });
  const profile=await mkdtemp(join(tmpdir(),'erp-cadastros-browser-'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const child=spawn(binary,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--user-data-dir='+profile,'http://127.0.0.1:'+server.address().port],{stdio:'ignore',windowsHide:true});
  child.on('error', error=>finish({error:error.code}));
  const timer=setTimeout(()=>finish({error:'CADASTROS_BROWSER_TIMEOUT'}),20000);
  try{
    const result=await report;
    assert.equal(result.error,undefined,JSON.stringify(result));
    assert.equal(result.lists,1);
    assert.ok(result.counts>0);
    assert.equal(result.countsBeforeClick>0,before);
    t.diagnostic(JSON.stringify(result));
  }finally{
    clearTimeout(timer);
    if(child.pid&&child.exitCode===null&&child.signalCode===null){
      const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;
    }
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300});
  }
});
}
