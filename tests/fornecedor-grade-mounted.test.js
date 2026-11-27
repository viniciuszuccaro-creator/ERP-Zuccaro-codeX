import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

for (const entity of ['Fornecedor', 'Produto', 'Cliente']) {
test(`grade de ${entity} usa leitura HTTP paginada no contexto atual`, { timeout: 30000 }, async () => {
  const produto = entity === 'Produto';
  const cliente = entity === 'Cliente';
  const binary = process.env.CHROME_BIN || (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
  assert.ok(existsSync(binary), 'Chrome existente necessário');
  const modules = {
    base44Client: `export const isHttpBackendMode=true,isHttpProdutoEnabled=${produto},isHttpClienteListMode=${cliente},isLocalOnlyMode=false,erpBackendMode='http';
      export const getHttpProdutoApi=()=>({
        listCatalogPage:async ({offset,search,signal})=>{
          const company=window.company||'Grupo';
          if(window.pendingCompanyContext)throw Error('REQUEST_BEFORE_CONTEXT');
          if(company==='CPA'&&window.holdCpa) {
            window.cpaSignal=signal;
            await new Promise(resolve=>{window.releaseCpa=resolve;});
            return {data:[{id:'late',codigo:'002',descricao:'CPA-LATE-RESPONSE'}],meta:{total:1,hasMore:false}};
          }
          return {data:[{id:'p',codigo:'001',descricao:company+'-page-'+offset+(search||'')}],
            meta:{total:search?1:21,hasMore:offset===0&&!search}};
        }
      });
      export const base44={entities:{},functions:{invoke:async()=>{throw Error('LEGACY_LIST');}}};
      export async function listHttpClientePage(payload,signal){
        if(!${cliente}||!(signal instanceof AbortSignal))throw Error('MISSING_NATIVE_ABORT_SIGNAL');
        const company=window.company||'Grupo';
        const search=payload.search;
        if(search==='falha')throw Error('HTTP_FAILED');
        return {data: search==='zero' ? [] : [{id:'c',codigo:'001',nome:company+'-page-'+payload.skip+(search||'')}],
          meta:{total:search==='zero'?0:search?1:21,hasMore:payload.skip===0&&!search}};
      }`,
    useContextoVisual: `export const useContextoVisual=()=>({empresaAtual:{id:window.company},grupoAtual:{id:'group'},empresasDoGrupo:[]});`,
    usePermissions: `export default()=>({hasPermission:()=>true,hasPermissionKey:()=>true,canView:()=>true,canCreate:()=>true,canEdit:()=>true,canDelete:()=>true});`,
    useEntityCounts: `export default names=>{if(names.length&&!${cliente})throw Error('LEGACY_COUNTS');return{counts:${cliente}?{Cliente:15972}:{}};};`,
    useWindow: `export const useWindow=()=>({openWindow:()=>{throw Error('LEGACY_FORM');}});`,
    useClienteCadastroNavigation: `export default()=>({});`,
    erpHttpSession: `export const HTTP_CONTEXT_CHANGED='fixture-context';
      export const readErpHttpSession=()=>({groupId:'group',empresaId:window.pendingCompanyContext?'CPA':window.company,actorId:'actor',token:'synthetic'});`,
    httpApiClient: `export const fornecedorReadApi={
      list:async ({offset,search})=>({items:[{id:'f',codigo:'001',nome:window.company+'-page-'+offset+(search||''),status:'Ativo'}],hasMore:offset===0}),
      get:async()=>({codigo:'001',razao_social:'Detalhe oficial'})};`,
    empty: `export default()=>null;`,
  };
  const bundle = await build({ stdin: { loader: 'jsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import Grid from './src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx';
    window.company='CPA';
    const root=document.getElementById('root'), next=()=>root.querySelector('[data-action="Cadastros.${entity}.proxima-pagina"]');
    const wait=async condition=>{for(let n=0;n<200;n++){if(condition())return;await new Promise(r=>setTimeout(r,20));}throw Error('EXPECTED_UI_STATE');};
    const report=result=>fetch('/result',{method:'POST',body:JSON.stringify(result)});
    window.addEventListener('error',e=>report({error:e.message}));
    createRoot(root).render(<QueryClientProvider client={new QueryClient()}><Grid nomeEntidade="${entity}"/></QueryClientProvider>);
    (async()=>{
      await wait(()=>root.textContent.includes('CPA-page-0'));
      if (${cliente}) {
        if (!root.textContent.includes('21 total') || next().disabled) throw Error('PAGE_META_NOT_USED');
        next().click();
        await wait(()=>root.textContent.includes('CPA-page-20')&&next().disabled);
        window.company='3Z';window.dispatchEvent(new Event('fixture-context'));
        await wait(()=>root.textContent.includes('3Z-page-0'));
        if(root.textContent.includes('CPA-page-'))throw Error('STALE_COMPANY');
        const search=root.querySelector('input[placeholder*="Buscar"]');
        const fill=value=>{
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,value);
          search.dispatchEvent(new Event('input',{bubbles:true}));
        };
        fill('001');
        await wait(()=>root.textContent.includes('3Z-page-0001')&&root.textContent.includes('1 total')&&next().disabled);
        fill('zero');
        await wait(()=>root.querySelector('[data-fonte-estado="busca-vazia"]')&&root.textContent.includes('0 total'));
        fill('falha');
        await wait(()=>root.querySelector('[data-fonte-estado="erro-api"]')&&root.textContent.includes('total indisponível'));
        await report({ok:true});
        return;
      }
      const writes=root.querySelectorAll('[data-action="Cadastros.${entity}.criar"],[data-action="Cadastros.${entity}.editar"],[data-action="Cadastros.${entity}.excluir"]');
      if([...writes].some(button=>!button.disabled))throw Error('LEGACY_WRITE_ENABLED');
      next().click();
      await wait(()=>root.textContent.includes('CPA-page-20')&&next().disabled);
      if (${produto}) {
        if (!root.textContent.includes('21 total')) throw Error('TOTAL_NOT_FROM_API');
        window.company=null;window.dispatchEvent(new Event('fixture-context'));
        await wait(()=>root.textContent.includes('Grupo-page-0'));
      } else {
        root.querySelector('[aria-label="Visualizar fornecedor"]').click();
        await wait(()=>document.body.textContent.includes('Detalhe oficial'));
      }
      window.pendingCompanyContext=${produto};
      window.company='3Z';window.dispatchEvent(new Event('fixture-context'));
      if (${produto}) {
        await wait(()=>root.querySelector('[data-fonte-estado="aguardando-contexto"]'));
        if(root.querySelector('[data-fonte-estado="lista-vazia"]') || root.textContent.includes('Grupo-page-0'))throw Error('PENDING_CONTEXT_DISPLAY');
        window.pendingCompanyContext=false;
        window.dispatchEvent(new Event('fixture-context'));
      }
      await wait(()=>root.textContent.includes('3Z-page-0')&&!document.body.textContent.includes('Detalhe oficial'));
      if(root.textContent.includes('CPA-page-'))throw Error('STALE_COMPANY');
      const search=root.querySelector('input[placeholder*="Buscar"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(search,'001');
      search.dispatchEvent(new Event('input',{bubbles:true}));
      await wait(()=>root.textContent.includes('3Z-page-0001'));
      if (${produto}) {
        window.holdCpa=true;
        window.company='CPA';window.dispatchEvent(new Event('fixture-context'));
        await wait(()=>window.releaseCpa);
        window.company='3Z';window.dispatchEvent(new Event('fixture-context'));
        await wait(()=>window.cpaSignal?.aborted&&root.textContent.includes('3Z-page-0'));
        let leaked=false;
        const observer=new MutationObserver(()=>{leaked||=root.textContent.includes('CPA-LATE-RESPONSE');});
        observer.observe(root,{childList:true,subtree:true,characterData:true});
        window.releaseCpa();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        observer.disconnect();
        if(leaked||!root.textContent.includes('3Z-page-0'))throw Error('LATE_COMPANY_RESPONSE');
      }
      await report({ok:true});
    })().catch(e=>report({error:e.message}));
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser',
  define: { 'import.meta.env': '{"VITE_ERP_HTTP_FORNECEDOR_READ":"true"}' },
  plugins: [{ name: 'fornecedor-fixture', setup(b) {
    b.onResolve({ filter: /(?:^|\/)(base44Client|useContextoVisual|usePermissions|useEntityCounts|useWindow|useClienteCadastroNavigation|erpHttpSession|httpApiClient)(?:\.[\w]+)?$/ }, ({ path }) =>
      ({ namespace: 'fixture', path: path.split('/').pop().split('.')[0] }));
    b.onResolve({ filter: /(?:CadastroClienteCompleto|CadastroFornecedorCompleto|DetalhesCliente|TransportadoraForm|ColaboradorForm|RepresentanteFormCompleto|ContatoB2BForm|SegmentoClienteForm|RegiaoAtendimentoForm)$/ }, () =>
      ({ namespace: 'fixture', path: 'empty' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: modules[path], loader: 'js' }));
  } }] });
  let complete;
  const result = new Promise(resolve => { complete = resolve; });
  const server = createServer((req, res) => {
    if (req.url === '/result') {
      let raw = '';
      req.on('data', part => { raw += part; });
      req.on('end', () => { res.end(); complete(JSON.parse(raw)); });
    } else if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(bundle.outputFiles[0].contents);
    } else res.end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
  });
  const profile = await mkdtemp(join(tmpdir(), 'erp-fornecedor-browser-'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const child = spawn(binary, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + profile, 'http://127.0.0.1:' + server.address().port], { stdio: 'ignore', windowsHide: true });
  child.on('error', error => complete({ error: error.code }));
  const timer = setTimeout(() => complete({ error: 'FORNECEDOR_BROWSER_TIMEOUT' }), 20000);
  try {
    assert.deepEqual(await result, { ok: true });
  } finally {
    clearTimeout(timer);
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
}
