import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
import Logistica from './src/components/comercial/LogisticaEntregaTab.jsx';
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
 props={clienteId:'client',groupId:'group',empresaId:'company',finalidade:'FISCAL',allowReviewEdit:true};
 window.__session={token:'synthetic-token',actorId:'actor',groupId:'group',empresaId:'company'};
 const fiscal={...local('55555555-5555-4555-8555-555555555555'),nome:'Fiscal fonte',numero:'42',pais:'BRASIL',bairro:'Centro',cidade:'Sintetica',uf:'SP',cep:'01310100',legacy_id:'0001'};
 const tokens=()=>({version:'a'.repeat(64),reviewVersion:'b'.repeat(64),data:[]});
 const loadFiscal=async()=>{render();await pause();pending.shift().resolve(new Response(JSON.stringify(tokens()),{status:200}));await pause();reply(pending.shift(),[fiscal]);await pause();};
 await loadFiscal();
 const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
 button('Revisar fiscal').click();await pause();
 check('fiscal_editor_real',Boolean(host.querySelector('[aria-label="Revisar fiscal inativo"]')));
 const input=host.querySelector('[aria-label="Revisao numero"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'43');input.dispatchEvent(new Event('input',{bubbles:true}));});
 const save=button('Salvar revisao fiscal sem ativar');save.click();save.click();await pause();
 check('fiscal_double_click_single_request',pending.length===1);
 const rejected=pending.shift(),body=JSON.parse(rejected.init.body);
 check('fiscal_canonical_same_id',rejected.url.includes('/locais/sync')&&body.operations[0].id===fiscal.id&&body.operations[0].data.numero==='43');
 check('fiscal_never_master_or_activate',body.operations[0].op==='review'&&body.operations[0].activate===false&&!('endereco_principal' in body.operations[0].data)&&!('legacy_id' in body.operations[0].data));
 check('fiscal_untouched_or_unloaded_fields_omitted',Object.keys(body.operations[0].data).join(',')==='numero');
 rejected.resolve(new Response(JSON.stringify({error:{code:'CLIENTE_LOCAIS_VERSION_CONFLICT'}}),{status:409}));await pause();
 check('fiscal_conflict_keeps_draft',host.querySelector('[aria-label="Revisao numero"]').value==='43'&&host.textContent.includes('Conflito de versao'));
 button('Cancelar revisao').click();await loadFiscal();button('Revisar fiscal').click();await pause();
 button('Salvar revisao fiscal sem ativar').click();await pause();const oldSave=pending.shift();
 window.__session={...window.__session,actorId:'actor-B'};window.dispatchEvent(new Event('erp-http-context-changed'));render();await pause();
 oldSave.resolve(new Response(JSON.stringify({version:'c'.repeat(64),reviewVersion:'d'.repeat(64),batchAtomic:true,data:[{...fiscal,endereco_incompleto:false}]}),{status:200}));await pause();
 check('fiscal_old_save_no_new_context_success',!host.querySelector('[aria-label="Revisar fiscal inativo"]')&&!host.textContent.includes('Revisao nao salva'));
 await act(async()=>{root.render(null);});pending.splice(0);window.__session={token:'synthetic-token',actorId:'actor',groupId:'group',empresaId:'company'};await loadFiscal();
 button('Revisar fiscal').click();await pause();button('Salvar revisao fiscal sem ativar').click();await pause();
 pending.shift().resolve(new Response(JSON.stringify({version:'c'.repeat(64),reviewVersion:'d'.repeat(64),batchAtomic:true,data:[{...fiscal,endereco_incompleto:false}]}),{status:200}));await pause();
 check('fiscal_success_refreshes_without_master',!host.querySelector('[aria-label="Revisar fiscal inativo"]')&&pending.length===1&&pending[0].url.includes('/locais/snapshot'));
 await act(async()=>{root.render(null);});pending.splice(0);
 const clients=[{id:'client'},{id:'client-B'}];let latest;
 function PedidoDraft(){const [draft,setDraft]=React.useState({cliente_id:'client',itens_revenda:[]});latest=draft;window.setDraft=setDraft;return <Logistica formData={draft} setFormData={setDraft} clientes={clients}/>;}
 const renderPedido=()=>act(()=>flushSync(()=>root.render(<PedidoDraft/>)));
 const localEntrega=(client,id)=>({...fiscal,id,group_id:window.__session.groupId,cliente_id:client,ativo:true,endereco_incompleto:false,finalidades:[{finalidade:'ENTREGA',ativo:true}]});
 const idA=fiscal.id,idB='66666666-6666-4666-8666-666666666666';
 const respondActive=async(client,id)=>{pending.shift().resolve(new Response(JSON.stringify({version:'a'.repeat(64),data:[localEntrega(client,id)]}),{status:200}));await pause();};
 renderPedido();await pause();await respondActive('client',idA);const oldA=window.selectHandler;
 await act(async()=>{window.setDraft({cliente_id:'client-B',itens_revenda:[],marker:'B'});});await pause();await respondActive('client-B',idB);
 await act(async()=>{oldA(idA);});check('pedido_old_A_cannot_write_B',latest.marker==='B'&&!latest.endereco_entrega_principal?.id);
 await act(async()=>{window.setDraft({cliente_id:'client',itens_revenda:[],marker:'new-A'});});await pause();await respondActive('client',idA);
 await act(async()=>{oldA(idA);});check('pedido_ABA_old_handler_no_write',latest.marker==='new-A'&&!latest.endereco_entrega_principal?.id);
 await act(async()=>{window.selectHandler(idA);});check('pedido_current_handler_real_consumer',latest.endereco_entrega_principal?.cliente_local_id===idA&&latest.cliente_id==='client');
 const oldToken=window.selectHandler;window.__session={...window.__session,token:'renewed-token'};window.dispatchEvent(new Event('erp-http-context-changed'));await pause();await respondActive('client',idA);
 await act(async()=>{oldToken(idA);});check('pedido_old_session_no_restore',!latest.endereco_entrega_principal?.id);
 for(const kind of ['actorId','empresaId','groupId']){
  const old=window.selectHandler;window.__session={...window.__session,[kind]:'new-'+kind};window.dispatchEvent(new Event('erp-http-context-changed'));await pause();await respondActive('client',idA);
  await act(async()=>{old(idA);});check('pedido_old_binding_'+kind,!latest.endereco_entrega_principal?.id);
 }
 const denied=window.selectHandler;window.__allowed=false;renderPedido();await pause();
 await act(async()=>{denied(idA);});check('pedido_permission_revoked_no_selection',!latest.endereco_entrega_principal?.id&&pending.length===0);
 check('pedido_draft_only_no_database_write',pending.every(request=>!request.init.method||request.init.method==='GET'));
 root.unmount();return{checks:checks.length,passed:true,scope:'React/DOM + cliente HTTP real; transporte e identidade sinteticos; nao HML/PG/E2E'};
}
run().then(result=>reportFetch('/result',{method:'POST',body:JSON.stringify(result)})).catch(error=>reportFetch('/result',{method:'POST',body:JSON.stringify({error:String(error),checks})}));`;
  for (const reverseCallbackFix of [true, false]) {
  const plugin = { name: 'synthetic-boundaries', setup(builder) {
    if (reverseCallbackFix) builder.onLoad({ filter: /SeletorEnderecoEntregaPedido\.jsx$/ }, args => {
      const source = readFileSync(args.path, 'utf8');
      assert.equal(source.split('const snapshot = renderedSnapshot;').length, 2);
      return { contents: source.replace('const snapshot = renderedSnapshot;', 'const snapshot = listSnapshotRef.current;'), loader: 'jsx', resolveDir: path.dirname(args.path) };
    });
    builder.onResolve({ filter: /^@\/api\/erpHttpSession$/ }, () => ({ path: 'session', namespace: 'synthetic' }));
    builder.onResolve({ filter: /^@\/components\/lib\/usePermissions$/ }, () => ({ path: 'permission', namespace: 'synthetic' }));
    builder.onResolve({ filter: /^@\/api\/httpApiClient$/ }, () => ({ path: path.resolve('src/api/httpApiClient.js') }));
    builder.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'httpmode', namespace: 'synthetic' }));
    builder.onResolve({ filter: /^@\/components\/ui\/select$/ }, () => ({ path: 'select', namespace: 'synthetic' }));
    builder.onResolve({ filter: /^\.\/(BuscaCEP|CriarEtapaEntregaModal)$/ }, () => ({ path: 'empty', namespace: 'synthetic' }));
    builder.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ contents: args.path === 'session'
      ? `export const HTTP_CONTEXT_CHANGED='erp-http-context-changed';export const readErpHttpSession=()=>window.__session ? {...window.__session} : null;`
      : args.path === 'httpmode' ? `export const isHttpBackendMode=true;export const base44={auth:{me:async()=>({id:'synthetic-actor'})},entities:{}};`
      : args.path === 'empty' ? `export default()=>null;`
      : args.path === 'select' ? `import React from 'react';export function Select(p){window.selectHandler=p.onValueChange;return React.createElement('div',null,p.children);}const Part=p=>React.createElement('div',null,p.children);export {Part as SelectContent,Part as SelectItem,Part as SelectTrigger,Part as SelectValue};`
      : `export default()=>({hasPermission:()=>window.__allowed});`, loader: 'js', resolveDir: process.cwd() }));
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
  try { const report = await result;
    if (reverseCallbackFix) {
      assert.equal(report.error, 'Error: pedido_ABA_old_handler_no_write', JSON.stringify(report));
      assert.ok(report.checks.includes('fiscal_canonical_same_id'));
    } else { assert.equal(report.error, undefined, JSON.stringify(report)); assert.equal(report.passed, true); assert.ok(report.checks >= 40); }
  }
  finally {
    clearTimeout(timer); child.kill();
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once('exit', resolve));
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'erp-review-locais-'));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
  }
});
