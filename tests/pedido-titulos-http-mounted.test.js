import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('Pedido: baixa parcial retoma o mesmo evento e reabre quitada', { timeout: 60000 }, async () => {
  const chrome = process.env.CHROME_BIN || (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
  const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import PedidoTitulosHttp from '@/components/comercial/pedido/PedidoTitulosHttp';
const pedido={id:'pedido-a',group_id:'grupo-a',empresa_id:'empresa-a'};
const root=createRoot(document.querySelector('#root'));
const mount=key=>root.render(<PedidoTitulosHttp pedido={pedido} key={key}/>);
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const wait=async(fn,name)=>{
  for(let i=0;i<150;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,20));}
  throw Error(name);
};
const click=async text=>(await wait(()=>{const b=button(text);return b&&!b.disabled&&b},text)).click();
const select=(index,value)=>{
  const el=document.querySelectorAll('select')[index];
  el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
};
const amount=value=>{
  const el=document.querySelector('input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
};
const fillPayment=async value=>{
  select(0,'1');
  await new Promise(r=>setTimeout(r,0));
  amount(value);
};
const money=value=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const hasSaldo=value=>document.querySelector('tbody tr td:last-child')?.textContent===money(value);
const report=error=>fetch('/result',{method:'POST',body:JSON.stringify({error})});
(async()=>{
  mount('first');
  await click('Selecionar v\u00ednculos');
  await wait(()=>document.querySelectorAll('select option').length===4,'accounting');
  select(0,'centro-a');select(1,'plano-a');
  await click('Gerar t\u00edtulos');
  await wait(()=>hasSaldo(100),'initial balance');
  await fillPayment('40,00');
  const label='Registrar baixa';
  await click(label);button(label)?.click();
  await wait(()=>document.querySelector('[role=alert]'),'lost response');
  await click(label);
  await wait(()=>hasSaldo(60),'partial balance');
  await fillPayment('60,00');await click(label);
  await wait(()=>hasSaldo(0)&&!button(label),'settled balance');
  mount('reopened');
  await wait(()=>!document.querySelector('tbody'),'new mount');
  await click('Consultar t\u00edtulos');
  await wait(()=>hasSaldo(0)&&!button(label),'reopened balance');
  await report(null);
})().catch(e=>report(e.message));`;
  const bundle = await build({
    stdin: { contents: entry, loader: 'jsx', resolveDir: process.cwd() }, bundle: true, write: false,
    format: 'iife', platform: 'browser', define: { 'import.meta.env': '{"VITE_ERP_API_SAME_ORIGIN":"true"}' },
    plugins: [{ name: 'pedido-fixture', setup(b) {
      b.onResolve({ filter: /^@\/components\/lib\/usePermissions$|^@\/api\/erpHttpSession$/ }, a => ({ path: a.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: a.path.endsWith('usePermissions')
        ? 'export default () => ({ hasPermission: () => true, isLoading: false });'
        : "export const HTTP_CONTEXT_CHANGED='erp-http-context-changed';export const readErpHttpSession=()=>({groupId:'grupo-a',empresaId:'empresa-a',actorId:'actor-a',token:'synthetic'});" }));
    } }],
  });
  const events = new Map();
  const attempts = [];
  let billCount = 0;
  let received = 0;
  let finish;
  const result = new Promise(resolve => { finish = resolve; });
  const rows = () => [{ parcela: 1, data_vencimento: '2026-11-25', valor: '100.00',
    valor_recebido: received.toFixed(2), saldo: (100 - received).toFixed(2) }];
  const server = createServer(async (req, res) => {
    try {
      if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(bundle.outputFiles[0].contents); }
      if (req.url === '/') return res.end('<div id="root"></div><script src="/bundle.js"></script>');
      if (req.url === '/favicon.ico') { res.statusCode = 204; return res.end(); }
      let body = '';
      for await (const chunk of req) body += chunk;
      if (req.url === '/result') { res.end(); return finish(JSON.parse(body)); }
      assert.equal(req.headers['x-group-id'], 'grupo-a');
      assert.equal(req.headers['x-empresa-id'], 'empresa-a');
      assert.equal(req.headers.authorization, 'Bearer synthetic');
      const operation = req.url.replace(/^\/api\/v1\/pedidos\/pedido-a\//, '');
      let data;
      if (operation === 'vinculos-contabeis') data = { centros: [{ id: 'centro-a', descricao: 'Centro A' }], planos: [{ id: 'plano-a', descricao: 'Plano A' }] };
      else if (operation === 'faturar') {
        assert.deepEqual(JSON.parse(body), { centro_custo_id: 'centro-a', plano_contas_id: 'plano-a' });
        billCount++;
        data = { titulos: rows() };
      } else if (operation === 'titulos/baixa') {
        const { parcela, valor, evento } = JSON.parse(body);
        assert.equal(parcela, 1);
        assert.match(evento, /^[a-f0-9-]{36}$/);
        attempts.push({ valor, evento });
        if (!events.has(evento)) { events.set(evento, valor); received += Number(valor); }
        else assert.equal(events.get(evento), valor);
        if (attempts.length === 1) { res.statusCode = 502; res.end(); return; }
        data = { titulos: rows() };
      } else if (operation === 'titulos') data = rows();
      else throw Error('Unexpected fixture route');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data }));
    } catch (error) {
      res.statusCode = 500; res.end(); finish({ error: error.message });
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = await mkdtemp(path.join(os.tmpdir(), 'erp-pedido-titulos-'));
  const child = spawn(chrome, ['--headless', '--no-first-run', '--user-data-dir=' + profile,
    'http://127.0.0.1:' + server.address().port], { stdio: 'ignore', windowsHide: true });
  const exited = new Promise(resolve => child.once('close', resolve));
  child.once('error', error => finish({ error: error.code }));
  child.once('exit', code => finish({ error: 'Chrome exited: ' + code }));
  const timer = setTimeout(() => finish({ error: 'PEDIDO_TITULOS_TIMEOUT' }), 45000);
  try {
    assert.deepEqual(await result, { error: null }, 'Fixture requests: ' + JSON.stringify({ billCount, attempts: attempts.map(a => a.valor) }));
    assert.equal(billCount, 1);
    assert.deepEqual(attempts.map(a => a.valor), ['40.00', '40.00', '60.00']);
    assert.equal(attempts[0].evento, attempts[1].evento);
    assert.equal(events.size, 2);
    assert.equal(received, 100);
  } finally {
    clearTimeout(timer);
    child.kill();
    await exited;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'erp-pedido-titulos-'));
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
});
