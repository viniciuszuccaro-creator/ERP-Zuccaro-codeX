import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('React montado: revisao somente leitura, paginacao, negativas e respostas obsoletas', { timeout: 60000 }, async () => {
  const cache = path.join(os.homedir(), '.cache', 'ms-playwright');
  const installed = existsSync(cache) ? readdirSync(cache).filter(name => /^chromium-\d+$/.test(name))
    .flatMap(name => ['chrome-linux/chrome', 'chrome-linux64/chrome'].map(file => path.join(cache, name, file))) : [];
  const binary = process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', ...installed].find(file => existsSync(file)));
  assert.ok(binary && existsSync(binary), 'Chrome existente necessario; nenhum browser sera instalado');
  const entry = `
import React, { act } from 'react'; import { createRoot } from 'react-dom/client'; import { flushSync } from 'react-dom';
import Review from './src/components/cadastros/ClienteLocaisRevisao.jsx';
const host=document.getElementById('root'), root=createRoot(host), pending=[], checks=[], reportFetch=window.fetch.bind(window);
window.IS_REACT_ACT_ENVIRONMENT=true;
window.__allowed=true; window.__session={token:'synthetic-token',actorId:'actor',groupId:'group',empresaId:'company'};
let props={clienteId:'client',groupId:'group',empresaId:'company',finalidade:'FISCAL'};
window.fetch=(url,init)=>new Promise(resolve=>pending.push({url,init,resolve}));
const render=()=>act(()=>flushSync(()=>root.render(<Review {...props}/>)));
// Drain React updates after each response instead of racing a fixed sleep.
const pause=()=>act(async()=>{await new Promise(r=>setTimeout(r,0));});
const check=(name,ok)=>{checks.push(name);if(!ok)throw Error(name);};
const local=(id='synthetic-local')=>({id,cliente_id:props.clienteId,group_id:props.groupId,ativo:false,endereco_incompleto:true,
 finalidades:[{finalidade:props.finalidade,ativo:true}],logradouro:'Rua Sintetica',numero:'',pais:'',origem:'MIGRACAO',legacy_id:'0001'});
const reply=(request,data,total=data.length,offset=0)=>request.resolve(new Response(JSON.stringify({data,meta:{limit:50,offset,total,hasMore:offset+data.length<total}}),{status:200}));
async function run(){
 render();await pause();check('loading_not_zero',host.textContent.includes('Carregando')&&!host.textContent.includes('0 locais'));
 reply(pending.shift(),Array.from({length:50},(_,i)=>local('local-'+i)),51);await pause();
 check('real_rows_not_draft',host.querySelectorAll('li').length===50&&host.textContent.includes('51 locais fiscais'));
 check('fiscal_in_own_section',host.querySelector('[aria-label="Fiscal em revisao"]')&&host.textContent.includes('Endereco fiscal recuperado'));
 check('no_edit_or_activation',host.querySelectorAll('input,select,textarea,a').length===0&&!/Salvar|Ativar|Excluir/.test(host.textContent));
 check('missing_not_invented',host.textContent.includes('Nao informado / pendente')&&host.textContent.includes('FISCAL'));
 host.querySelector('[aria-label="Proxima pagina de revisao"]').click();await pause();
 check('old_page_hidden',host.querySelectorAll('li').length===0);reply(pending.shift(),[local('page-2')],51,50);await pause();
 check('second_page_exact',host.querySelectorAll('li').length===1&&host.textContent.includes('pagina 2'));
 for(const kind of ['cliente','group','company','actor','token','ABA','finalidade']){
  props={clienteId:'client',groupId:'group',empresaId:'company',finalidade:'FISCAL'};window.__session={token:'synthetic-token',actorId:'actor',groupId:'group',empresaId:'company'};
  window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();const old=pending.shift(),oldRow=local('late');
  if(kind==='cliente')props.clienteId='client-new';
  if(kind==='group'){props.groupId='group-new';window.__session.groupId='group-new';}
  if(kind==='company'||kind==='ABA'){props.empresaId='company-new';window.__session.empresaId='company-new';}
  if(kind==='actor')window.__session={...window.__session,actorId:'actor-new'};
  if(kind==='token')window.__session={...window.__session,token:'synthetic-new'};
  if(kind==='finalidade')props.finalidade='ENTREGA';
  window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();
  if(kind==='ABA'){props.empresaId='company';window.__session={...window.__session,empresaId:'company'};window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();}
  reply(old,[{...oldRow,logradouro:'OLD RESPONSE'}]);await pause();check('late_discarded_'+kind,!host.textContent.includes('OLD RESPONSE'));
  const fresh=pending.pop();pending.splice(0);reply(fresh,[local('fresh')]);await pause();check('fresh_visible_'+kind,host.textContent.includes('Rua Sintetica'));
 }
 for(const status of [401,403,422,500]){
  window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();
  pending.shift().resolve(new Response('{}',{status}));await pause();check('error_not_empty_'+status,host.querySelector('[role="alert"]')&&!host.textContent.includes('Nenhum local'));
 }
 window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();pending.shift().resolve(new Response(JSON.stringify({data:[],meta:{total:0}}),{status:200}));await pause();
 check('partial_not_empty',Boolean(host.querySelector('[role="alert"]')));
 window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();reply(pending.shift(),[],0);await pause();check('proven_empty',host.textContent.includes('Nenhum local de entrega inativo'));
 window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();reply(pending.shift(),[{...local(),endereco_incompleto:false}]);await pause();check('inactive_not_fake_review',host.textContent.includes('Sem indicacao de incompletude')&&!host.textContent.includes('Revisao pendente'));
 check('delivery_section_only',host.querySelector('[aria-label="Entrega em revisao"]')&&!host.textContent.includes('Endereco fiscal recuperado'));
 window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();reply(pending.shift(),[{...local(),finalidades:[{finalidade:'FISCAL',ativo:true}]}]);await pause();check('fiscal_not_silently_delivery',Boolean(host.querySelector('[role="alert"]'))&&host.querySelectorAll('li').length===0);
 window.__allowed=false;render();await pause();check('denied_no_read',pending.length===0&&Boolean(host.querySelector('[role="alert"]')));
 window.__allowed=true;window.__session=null;render();await pause();check('expired_no_read',pending.length===0&&Boolean(host.querySelector('[role="alert"]')));
 root.unmount();return{checks:checks.length,passed:true,scope:'React/DOM + cliente HTTP real; transporte e identidade sinteticos; nao HML/PG/E2E'};
}
run().then(result=>reportFetch('/result',{method:'POST',body:JSON.stringify(result)})).catch(error=>reportFetch('/result',{method:'POST',body:JSON.stringify({error:String(error),checks})}));`;
  const plugin = { name: 'synthetic-boundaries', setup(builder) {
    builder.onResolve({ filter: /^@\/api\/erpHttpSession$/ }, () => ({ path: 'session', namespace: 'synthetic' }));
    builder.onResolve({ filter: /^@\/components\/lib\/usePermissions$/ }, () => ({ path: 'permission', namespace: 'synthetic' }));
    builder.onResolve({ filter: /^@\/api\/httpApiClient$/ }, () => ({ path: path.resolve('src/api/httpApiClient.js') }));
    builder.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ contents: args.path === 'session'
      ? `export const HTTP_CONTEXT_CHANGED='erp-http-context-changed';export const readErpHttpSession=()=>window.__session ? {...window.__session} : null;`
      : `export default()=>({hasPermission:()=>window.__allowed});`, loader: 'js' }));
  } };
  const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', platform: 'browser', plugins: [plugin], define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
  let finish;
  const result = new Promise(resolve => { finish = resolve; });
  const server = createServer((req, res) => {
    if (req.url === '/result') { let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => { res.end('ok'); finish(JSON.parse(body)); }); }
    else if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(bundle.outputFiles[0].contents); }
    else res.end('<!doctype html><div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = await mkdtemp(path.join(os.tmpdir(), 'erp-review-locais-'));
  const child = spawn(binary, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + profile, 'http://127.0.0.1:' + server.address().port], { stdio: 'ignore', windowsHide: true });
  child.on('error', error => finish({ error: error.code }));
  const timer = setTimeout(() => finish({ error: 'MOUNTED_REVIEW_TIMEOUT' }), 45000);
  try { const report = await result; assert.equal(report.error, undefined, JSON.stringify(report)); assert.equal(report.passed, true); assert.ok(report.checks >= 25); }
  finally {
    clearTimeout(timer); child.kill();
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once('exit', resolve));
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'erp-review-locais-'));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
});
