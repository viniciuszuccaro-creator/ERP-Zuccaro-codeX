import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('real mounted Grupo form: linked companies, code, rejection and session cache isolation', { timeout: 120000 }, async () => {
  const cache = path.join(os.homedir(), '.cache/ms-playwright');
  const installed = existsSync(cache) ? readdirSync(cache).filter(n => /^chromium-\d+$/.test(n))
    .flatMap(n => ['chrome-linux/chrome', 'chrome-linux64/chrome'].map(f => path.join(cache, n, f))) : [];
  const binary = process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', ...installed].find(existsSync));
  assert.ok(binary && existsSync(binary), 'Existing browser required, no installation');
  const entry = `
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Form from './src/components/cadastros/GrupoEmpresarialForm.jsx';
window.IS_REACT_ACT_ENVIRONMENT=true;window.__actor='actor';window.__company=null;window.__pending=[];
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
client.setQueryData(['empresas','g'],[]);
const host=document.getElementById('root'),root=createRoot(host),checks=[];let calls=0,fail=false,payload;
const record={id:'g',group_id:'g',nome:'Synthetic group',codigo:'001',empresas_ids:['a','b'],version:'v1'};
const submit=async p=>{calls++;payload=p;if(fail)throw Error('synthetic rejection');};
const render=()=>act(async()=>root.render(<QueryClientProvider client={client}><Form item={record} onSubmit={submit}/></QueryClientProvider>));
const pause=()=>act(async()=>{await new Promise(r=>setTimeout(r,70));});
const check=(name,value)=>{checks.push({name,pass:!!value});if(!value)throw Error(name);};
const companies=[{id:'a',group_id:'g',razao_social:'Synthetic A'},{id:'b',group_id:'g',razao_social:'Synthetic B'}];
async function run(){
 await render();await pause();check('loading_not_false_empty',host.textContent.includes('Carregando empresas vinculadas'));
 check('new_lookup_not_poisoned_by_filial_cache',window.__pending.length===1);
 await act(async()=>window.__pending.shift()(companies));await pause();
 check('both_existing_links_visible',host.textContent.includes('Synthetic A')&&host.textContent.includes('Synthetic B'));
 check('checked_links_readonly',Array.from(host.querySelectorAll('input[type=checkbox]')).filter(i=>i.checked&&i.disabled).length===2);
 check('code_not_technical_id',host.querySelector('[data-action="codigo-registro-grupo-empresarial"]').value==='001');
 fail=true;await act(async()=>host.querySelector('form').requestSubmit());await pause();
 check('rejection_preserves_form',calls===1&&Array.from(host.querySelectorAll('input')).some(i=>i.value==='Synthetic group'));
 check('payload_keeps_ids_and_links',payload.id==='g'&&payload.empresas_ids.join(',')==='a,b');
 fail=false;await act(async()=>host.querySelector('form').requestSubmit());await pause();check('retry_after_rejection',calls===2);
 window.__actor='actorB';window.dispatchEvent(new Event('erp-http-context-changed'));await render();await pause();
 check('new_actor_no_old_companies',!host.textContent.includes('Synthetic A')&&window.__pending.length===1);
 await act(async()=>window.__pending.shift()(Promise.reject(Error('synthetic read failure'))));await pause();
 check('read_failure_not_empty',host.textContent.includes('indisponível')&&!host.textContent.includes('Nenhuma empresa cadastrada'));
 window.dispatchEvent(new Event('erp-http-context-changed'));await pause();check('same_actor_session_renewal_refetch',window.__pending.length===1);
 await act(async()=>window.__pending.shift()(companies));await pause();check('renewed_session_links_visible',host.textContent.includes('Synthetic B'));
 await act(async()=>root.unmount());return{checks};
}
run().then(r=>fetch('/result',{method:'POST',body:JSON.stringify(r)})).catch(e=>fetch('/result',{method:'POST',body:JSON.stringify({error:String(e),checks})}));`;
  for (const reverseCacheFix of [true, false]) {
    const plugin = { name: 'organizacional-synthetic-boundaries', setup(b) {
      if (reverseCacheFix) b.onLoad({ filter: /GrupoEmpresarialForm\.jsx$/ }, args => {
        const source = readFileSync(args.path, 'utf8');
        return { contents: source.replace(/queryKey: \["grupo-empresas-vinculadas"[^\n]+/, 'queryKey: ["empresas", groupId],'), loader: 'jsx', resolveDir: path.dirname(args.path) };
      });
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'mode', namespace: 'boundary' }));
      b.onResolve({ filter: /^@\/components\/lib\/usePermissions$/ }, () => ({ path: 'permissions', namespace: 'boundary' }));
      b.onResolve({ filter: /^@\/components\/lib\/useContextoVisual$/ }, () => ({ path: 'context', namespace: 'boundary' }));
      b.onResolve({ filter: /^@\/components\/ui\// }, args => ({ path: args.path.split('/').at(-1), namespace: 'boundary' }));
      b.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: args.path === 'mode' ? 'export const isHttpBackendMode=true;'
        : args.path === 'permissions' ? `export default()=>({user:{id:window.__actor},canCreate:()=>false,canEdit:()=>true,canDelete:()=>false,hasPermission:()=>true,isLoading:false});`
        : args.path === 'context' ? `export const useContextoVisual=()=>({grupoAtual:{id:'g'},empresaAtual:null,filterInContext:()=>new Promise(r=>window.__pending.push(r))});`
        : `import React from 'react';const Part=({children,...p})=>React.createElement('${args.path === 'input' ? 'input' : args.path === 'textarea' ? 'textarea' : args.path === 'button' ? 'button' : 'div'}',p,children);export {Part as Input,Part as Textarea,Part as Label,Part as Button,Part as Card,Part as CardContent,Part as Switch,Part as Badge};`, loader: 'js', resolveDir: process.cwd() }));
    } };
    const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: process.cwd() }, bundle: true, write: false,
      format: 'iife', platform: 'browser', plugins: [plugin], logLevel: 'silent', define: { 'import.meta.env': '{}' } });
    let finish; const result = new Promise(r => { finish = r; });
    const server = createServer((req, res) => {
      if (req.url === '/result') { let body = ''; req.on('data', d => { body += d; }); req.on('end', () => { res.end('ok'); finish(JSON.parse(body)); }); }
      else if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle.outputFiles[0].contents); }
      else res.end('<div id="root"></div><script src="/bundle.js"></script>');
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const profile = await mkdtemp(path.join(os.tmpdir(), 'erp-org-mounted-'));
    const child = spawn(binary, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile,
      'http://127.0.0.1:' + server.address().port], { stdio: 'ignore', windowsHide: true });
    child.on('error', e => finish({ error: e.code }));
    const timer = setTimeout(() => finish({ error: 'MOUNTED_ORG_TIMEOUT' }), 45000);
    try {
      const report = await result;
      if (reverseCacheFix) assert.match(report.error, /loading_not_false_empty|new_lookup_not_poisoned_by_filial_cache/);
      else { assert.equal(report.error, undefined, JSON.stringify(report)); assert.ok(report.checks.length >= 11); }
    } finally {
      clearTimeout(timer); child.kill();
      if (child.exitCode === null && child.signalCode === null) await new Promise(r => child.once('exit', r));
      server.closeAllConnections(); await new Promise(r => server.close(r));
      assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'erp-org-mounted-'));
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    }
  }
});
