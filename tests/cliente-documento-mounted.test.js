import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clienteDocumentoRemainder, clienteDocumentoHunks } from './helpers/clienteLocalOperationalRemainder.js';

test('document fix retains every ancestral byte and rejects malformed hunks', () => {
  const file = 'src/components/cadastros/CadastroClienteCompleto.jsx';
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const previous = execFileSync('git', ['show', '98ecfb6e:' + file], { encoding: 'utf8' }).replace(/\r\n/g, '\n');
  assert.equal(clienteDocumentoRemainder(source), previous);
  assert.equal(clienteDocumentoRemainder(previous), previous);
  for (const [after] of clienteDocumentoHunks) {
    for (const replacement of ['', after + after, after.replace(/\S/, '!')])
      assert.throws(() => clienteDocumentoRemainder(source.replace(after, replacement)));
  }
  assert.notEqual(clienteDocumentoRemainder(source + '\n// OUTSIDE_DOCUMENT_FIX\n'), previous);
});

// Existing mounted tests cover locais and organizational forms, not Cliente's first paint.
// Mount the real Cliente and identity hook; only service/context and UI primitives are synthetic.
test('Cliente montado: documento canonico no primeiro carregamento PF/PJ', { timeout: 60000 }, async () => {
  const cache = path.join(os.homedir(), '.cache/ms-playwright');
  const installed = existsSync(cache) ? readdirSync(cache).filter(n => /^chromium-\d+$/.test(n))
    .flatMap(n => ['chrome-linux/chrome', 'chrome-linux64/chrome'].map(f => path.join(cache, n, f))) : [];
  const binary = process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', ...installed].find(existsSync));
  assert.ok(binary && existsSync(binary), 'Existing browser required; no installation');
  const entry = `
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Form from './src/components/cadastros/CadastroClienteCompleto.jsx';
window.IS_REACT_ACT_ENVIRONMENT=true;window.__writes=[];window.__reject=false;const root=createRoot(document.getElementById('root')),checks=[];
const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
const check=(name,value)=>{checks.push(name);if(!value)throw Error(name);};
const render=async(record)=>{await act(async()=>root.render(<QueryClientProvider client={client}><Form key={record.id} cliente={record} windowMode/></QueryClientProvider>));};
async function run(){
 const base={group_id:'g',status:'Ativo',nome:'Synthetic only',codigo:'001'};
 for(const [tipo,documento,field,other] of [['Pessoa Física','01234567890','cpf','cnpj'],['Pessoa Jurídica','00123456000100','cnpj','cpf']]){
  await render({...base,id:field,tipo,documento});
  check(field+'_first_mount_preserves_leading_zero',document.getElementById(field)?.value===documento);
  check(field+'_not_other_document',!document.getElementById(other));
  check(field+'_editable',!document.getElementById(field).disabled);
  const edited=field==='cpf'?'00123456789':'00012345000100';
  await act(async()=>{const el=document.getElementById(field);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,edited);el.dispatchEvent(new Event('input',{bubbles:true}));});
  const save=()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Salvar Cliente');
  window.__reject=true;await act(async()=>save().click());
  check(field+'_rejection_keeps_edited_draft',document.getElementById(field).value===edited);
  window.__reject=false;await act(async()=>save().click());
  const write=window.__writes.at(-1);
  check(field+'_canonical_wire_document',write.id===field&&write.wire.documento===edited);
  check(field+'_no_unknown_contacts_or_locais_wipe',!('contatos' in write.wire)&&!('locais_entrega' in write.wire));
  const attempted=window.__writes.length;
  await act(async()=>{const el=document.getElementById(field);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'');el.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>save().click());
  check(field+'_clear_not_false_success',window.__writes.length===attempted&&document.getElementById(field).value==='');
  await act(async()=>root.render(null));await render({...base,...write.wire,id:field});
  check(field+'_reopened_from_canonical_boundary',document.getElementById(field)?.value===edited);
 }
 await render({...base,id:'missing',tipo:'Pessoa Física'});
 check('missing_not_invented',document.getElementById('cpf')?.value==='');
 await act(async()=>root.unmount());client.clear();return{checks};
}
run().then(r=>fetch('/result',{method:'POST',body:JSON.stringify(r)})).catch(e=>fetch('/result',{method:'POST',body:JSON.stringify({error:String(e),checks})}));`;
  const plugin = { name: 'cliente-documento-boundaries', setup(b) {
    b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'api', namespace: 'boundary' }));
    b.onResolve({ filter: /^@\/api\/erpHttpSession$/ }, () => ({ path: 'session', namespace: 'boundary' }));
    b.onResolve({ filter: /^@\/components\/lib\/useContextoVisual$/ }, () => ({ path: 'context', namespace: 'boundary' }));
    b.onResolve({ filter: /^@\/components\/lib\/usePermissions$/ }, () => ({ path: 'permissions', namespace: 'boundary' }));
    b.onResolve({ filter: /(?:GerenciarContatosClienteForm|GerenciarEnderecosClienteForm|ClienteLocaisRevisao|HistoricoOrigemCliente|TimelineCliente|BuscaDadosPublicos)$/ }, () => ({ path: 'child', namespace: 'boundary' }));
    b.onResolve({ filter: /^@\/components\/ui\// }, args => ({ path: args.path.split('/').at(-1), namespace: 'boundary' }));
    b.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ loader: 'jsx', resolveDir: process.cwd(), contents:
      args.path === 'api' ? `export const isHttpBackendMode=true;export const base44={auth:{me:async()=>({id:'actor'})}};`
        : args.path === 'session' ? `export const readErpHttpSession=()=>({actorId:'actor',groupId:'g',empresaId:null,token:'synthetic'});`
        : args.path === 'context' ? `import {toClienteMasterHttpPayload} from '@/api/clienteHttpPayload';const empty=async()=>[];export default()=>({grupoAtual:{id:'g'},empresaAtual:null,filterInContext:empty,updateInContext:async(_entity,id,payload)=>{const wire=toClienteMasterHttpPayload(payload,{mode:'update'});window.__writes.push({id,wire});if(window.__reject)throw Error('synthetic rejection');return{id,...wire};}});`
        : args.path === 'permissions' ? `export default()=>({canCreate:()=>true,canEdit:()=>true,canDelete:()=>false,hasPermission:()=>true});`
        : args.path === 'child' ? `export default()=>null;export const ResumoHistorico=()=>null;export const BotaoBuscaAutomatica=()=>null;`
        : args.path === 'use-toast' ? `export const useToast=()=>({toast:()=>{}});`
        : `import React from 'react';const Part=React.forwardRef(({children,...props},ref)=>React.createElement('${args.path === 'input' ? 'input' : args.path === 'textarea' ? 'textarea' : args.path === 'button' ? 'button' : 'div'}',{...props,ref},children));
const Empty=()=>null;const TabsContent=({value,children})=>value==='dados-gerais'?children:null;
export {Part as Input,Part as Textarea,Part as Label,Part as Button,Part as Dialog,Part as DialogContent,Part as DialogHeader,Part as DialogTitle,Part as ScrollArea,Part as Tabs,Part as TabsList,Part as TabsTrigger,TabsContent,Part as Badge,Part as Card,Part as CardContent,Part as Alert,Part as AlertDescription,Part as Select,Part as SelectContent,Part as SelectItem,Empty as SelectTrigger,Empty as SelectValue};` }));
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
  const profile = await mkdtemp(path.join(os.tmpdir(), 'erp-cliente-documento-'));
  const child = spawn(binary, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + profile,
    'http://127.0.0.1:' + server.address().port], { stdio: 'ignore', windowsHide: true });
  child.on('error', e => finish({ error: e.code }));
  const timer = setTimeout(() => finish({ error: 'CLIENTE_DOCUMENTO_TIMEOUT' }), 45000);
  try { const report = await result; assert.equal(report.error, undefined, JSON.stringify(report)); assert.equal(report.checks.length, 17); }
  finally {
    clearTimeout(timer); child.kill();
    if (child.exitCode === null && child.signalCode === null) await new Promise(r => child.once('exit', r));
    server.closeAllConnections(); await new Promise(r => server.close(r));
    assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'erp-cliente-documento-'));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
});
