import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('real mounted organizational forms and A1 panel with synthetic API boundaries', { timeout: 120000 }, async () => {
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
import Empresa from './src/components/cadastros/EmpresaForm.jsx';
import A1Panel from './src/components/fiscal/CertificadoA1Panel.jsx';
window.IS_REACT_ACT_ENVIRONMENT=true;window.__actor='actor';window.__company=null;window.__pending=[];window.__contextReady=false;
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
 check('no_lookup_before_context_ready',window.__pending.length===0);
 window.__contextReady=true;await render();await pause();check('new_lookup_not_poisoned_by_filial_cache',window.__pending.length===1);
 await act(async()=>window.__pending.shift()(companies));await pause();
 check('both_existing_links_visible',host.textContent.includes('Synthetic A')&&host.textContent.includes('Synthetic B'));
 check('checked_links_readonly',Array.from(host.querySelectorAll('input[type=checkbox]')).filter(i=>i.checked&&i.disabled).length===2);
 check('code_not_technical_id',host.querySelector('[data-action="codigo-registro-grupo-empresarial"]').value==='001');
 check('technical_id_preserved_separately',host.querySelector('[data-action="id-tecnico-grupo-empresarial"]').value==='g');
 fail=true;await act(async()=>host.querySelector('form').requestSubmit());await pause();
 check('rejection_preserves_form',calls===1&&Array.from(host.querySelectorAll('input')).some(i=>i.value==='Synthetic group'));
 check('payload_keeps_ids_and_links',payload.id==='g'&&payload.empresas_ids.join(',')==='a,b');
 fail=false;await act(async()=>host.querySelector('form').requestSubmit());await pause();check('retry_after_rejection',calls===2);
 await act(async()=>root.render(null));window.dispatchEvent(new Event('erp-http-context-changed'));await render();await pause();
 check('reopened_form_requires_fresh_authorized_links',window.__pending.length===1&&!host.textContent.includes('Synthetic A'));
 await act(async()=>window.__pending.shift()(companies));await pause();
 window.__actor='actorB';window.dispatchEvent(new Event('erp-http-context-changed'));await render();await pause();
 check('new_actor_no_old_companies',!host.textContent.includes('Synthetic A')&&window.__pending.length===1);
 await act(async()=>window.__pending.shift()(Promise.reject(Error('synthetic read failure'))));await pause();
 check('read_failure_not_empty',host.textContent.includes('indisponível')&&!host.textContent.includes('Nenhuma empresa cadastrada'));
 window.dispatchEvent(new Event('erp-http-context-changed'));await pause();check('same_actor_session_renewal_refetch',window.__pending.length===1);
 await act(async()=>window.__pending.shift()(companies));await pause();check('renewed_session_links_visible',host.textContent.includes('Synthetic B'));
 window.__contextReady=false;window.__contextFailed=true;await render();await pause();
 check('missing_context_not_empty_or_infinite_loading',host.textContent.includes('Contexto de Grupo indisponivel')&&!host.textContent.includes('Synthetic B')&&!host.textContent.includes('Nenhuma empresa cadastrada'));
 window.__contextReady=true;window.__fiscal=true;calls=0;fail=false;
 let company={id:'a',group_id:'g',razao_social:'Synthetic A',cnpj:'00000000000191',codigo:'001',version:'v1',inscricao_estadual:null,regime_tributario:null,supported_fields:['inscricao_estadual','regime_tributario']};
 const renderCompany=()=>act(async()=>root.render(<QueryClientProvider client={client}><Empresa item={company} onSubmit={submit}/></QueryClientProvider>));
 await renderCompany();await pause();
 const ie=()=>host.querySelector('[data-action="editar-inscricao-estadual-empresa"]');
 check('fiscal_loaded_null_not_default',!ie().disabled&&ie().value===''&&host.querySelector('select').value==='');
 const setInput=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
 await act(async()=>setInput(ie(),'001.002.003'));
 fail=true;await act(async()=>host.querySelector('form').requestSubmit());await pause();
 check('fiscal_rejection_preserves_draft',calls===1&&ie().value==='001.002.003');
 check('fiscal_payload_no_vault_secrets',payload.id==='a'&&payload.codigo==='001'&&payload.inscricao_estadual==='001.002.003'&&!('certificado_digital' in payload));
 fail=false;await act(async()=>host.querySelector('form').requestSubmit());await pause();check('fiscal_retry_one_call',calls===2);
 company={...company,version:'v2',inscricao_estadual:'000987',regime_tributario:'Lucro Real'};await renderCompany();await pause();
 check('fiscal_rehydration_same_identity_new_version',ie().value==='000987'&&host.querySelector('select').value==='Lucro Real');
 window.__fiscal=false;await renderCompany();await pause();check('fiscal_permission_distinct',ie().disabled&&host.querySelector('select').disabled);
 window.__fiscal=true;company={...company,version:'v3',supported_fields:[]};await renderCompany();await pause();check('fiscal_missing_storage_blocked',ie().disabled&&host.querySelector('select').disabled);
 window.__fiscal=true;window.__uploads=[];
 const panelScope={groupId:'g',empresaId:'a',actorId:'actor'};let refreshed=0;
 const renderPanel=()=>act(async()=>root.render(<A1Panel scope={panelScope} ready={true} onUploaded={async()=>{refreshed++;}}/>));
 await renderPanel();await pause();
 const attach=()=>{const dt=new DataTransfer();dt.items.add(new File(['SYNTHETIC NOT CERTIFICATE'],'synthetic.pfx',{type:'application/x-pkcs12'}));host.querySelector('input[type=file]').files=dt.files;host.querySelector('input[type=password]').value='SYNTHETIC ONLY';};
 attach();await act(async()=>host.querySelector('button').click());await pause();
 check('a1_manual_upload_single_request',window.__uploads.length===1);
 check('a1_sensitive_fields_not_echoed',!host.textContent.includes('SYNTHETIC ONLY')&&host.textContent.includes('Validando arquivo'));
 const oldUpload=window.__uploads[0];window.__fiscal=false;await renderPanel();await pause();
 check('a1_permission_loss_aborts_and_erases',oldUpload.signal.aborted&&host.querySelector('input[type=file]').files.length===0&&host.querySelector('input[type=password]').value==='');
 window.__fiscal=true;await renderPanel();await pause();attach();
 await act(async()=>oldUpload.resolve({}));await pause();
 check('a1_late_result_cannot_clear_new_selection',host.querySelector('input[type=file]').files.length===1&&host.querySelector('input[type=password]').value==='SYNTHETIC ONLY'&&refreshed===0);
 await act(async()=>host.querySelector('button').click());await pause();
 await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent.includes('Cancelar')).click());await pause();
 check('a1_cancel_erases_without_false_rollback',window.__uploads[1].signal.aborted&&host.querySelector('input[type=file]').files.length===0&&host.querySelector('input[type=password]').value===''&&host.textContent.includes('Consulte o cofre'));
 await act(async()=>window.__uploads[1].resolve({}));await pause();check('a1_cancel_no_success',refreshed===0&&!host.textContent.includes('armazenado no cofre'));
 await act(async()=>root.unmount());return{checks};
}
run().then(r=>fetch('/result',{method:'POST',body:JSON.stringify(r)})).catch(e=>fetch('/result',{method:'POST',body:JSON.stringify({error:String(e),checks})}));`;
  for (const [reverseCacheFix, reverseContextFix] of [[true, false], [false, true], [false, false]]) {
    const plugin = { name: 'organizacional-synthetic-boundaries', setup(b) {
      if (reverseCacheFix || reverseContextFix) b.onLoad({ filter: /GrupoEmpresarialForm\.jsx$/ }, args => {
        let source = readFileSync(args.path, 'utf8');
        if (reverseCacheFix) source = source.replace(/queryKey: \["grupo-empresas-vinculadas"[^\n]+/, 'queryKey: ["empresas", groupId],');
        if (reverseContextFix) source = source.replace('enabled: contextoValido && empresasContextReady', 'enabled: contextoValido').replace(', contextoCanonico?.groupId]', ']');
        return { contents: source, loader: 'jsx', resolveDir: path.dirname(args.path) };
      });
      b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'mode', namespace: 'boundary' }));
      b.onResolve({ filter: /^@\/components\/lib\/usePermissions$/ }, () => ({ path: 'permissions', namespace: 'boundary' }));
      b.onResolve({ filter: /^@\/components\/lib\/useContextoVisual$/ }, () => ({ path: 'context', namespace: 'boundary' }));
      b.onResolve({ filter: /\/useCertificadoA1$/ }, () => ({ path: 'vault', namespace: 'boundary' }));
      b.onResolve({ filter: /^@\/components\/common\/FormWrapper$/ }, () => ({ path: 'wrapper', namespace: 'boundary' }));
      b.onResolve({ filter: /^@\/api\/httpApiClient$/ }, args => args.importer.endsWith('CertificadoA1Panel.jsx') ? ({path:'a1api',namespace:'boundary'}) : undefined);
      b.onResolve({ filter: /^@\/components\/ui\// }, args => ({ path: args.path.split('/').at(-1), namespace: 'boundary' }));
      b.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: args.path === 'mode' ? 'export const isHttpBackendMode=true;'
        : args.path === 'permissions' ? `export default()=>({user:{id:window.__actor},canCreate:()=>false,canEdit:()=>true,canDelete:()=>false,hasPermission:(m)=>m==='Fiscal'?window.__fiscal!==false:true,hasPermissionKey:()=>false,isLoading:false});`
        : args.path === 'a1api' ? `export const a1CertificateApi={upload:(_scope,_input,{signal})=>new Promise(resolve=>window.__uploads.push({resolve,signal}))};`
        : args.path === 'vault' ? `export default()=>({scopeMatches:false,allowed:false,certificate:null,certificateQuery:{isLoading:false,isSuccess:false,error:null},a1Scope:{},panelKey:'unconfigured',certificateQueryKey:['vault']});`
        : args.path === 'wrapper' ? `import React from 'react';export default({children,onSubmit})=><form onSubmit={e=>{e.preventDefault();onSubmit();}}>{children}</form>;`
        : args.path === 'context' ? `export const useContextoVisual=()=>({grupoAtual:window.__contextReady?{id:'g'}:null,empresaAtual:null,contextoCanonico:{groupId:window.__contextReady?'g':null},isLoading:!window.__contextReady&&!window.__contextFailed,filterInContext:()=>window.__contextReady?new Promise(r=>window.__pending.push(r)):Promise.resolve([])});`
        : `import React from 'react';const Part=React.forwardRef(({children,...p},ref)=>React.createElement('${args.path === 'input' ? 'input' : args.path === 'textarea' ? 'textarea' : args.path === 'button' ? 'button' : 'div'}',{...p,ref},children));const Select=({value,onValueChange,disabled,children})=>React.createElement('select',{value,onChange:e=>onValueChange(e.target.value),disabled},React.createElement('option',{value:''},''),children);const SelectItem=({value,children})=>React.createElement('option',{value},children);const Empty=()=>null;const SelectContent=({children})=>children;export {Part as Input,Part as Textarea,Part as Label,Part as Button,Part as Card,Part as CardContent,Part as Switch,Part as Badge,Part as Alert,Part as AlertDescription,Select,SelectItem,SelectContent,Empty as SelectTrigger,Empty as SelectValue};`, loader: 'jsx', resolveDir: process.cwd() }));
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
      if (reverseCacheFix || reverseContextFix) assert.match(report.error, /loading_not_false_empty|new_lookup_not_poisoned_by_filial_cache|no_lookup_before_context_ready/);
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
