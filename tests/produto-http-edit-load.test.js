import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { isProdutoHttpEditLoadComplete, isProdutoHttpEditReady, toProdutoHttpPayload } from '../src/components/cadastros/produto/produtoHttpPolicy.js';

const fullProduto = (id) => ({ id, descricao: 'Peça sintética', codigo: 'P-001',
  material: 'Aço', liga: null, norma_tecnica: null, descricao_tecnica: 'ASTM sintético',
  descricao_comercial: null, titulo_seo: null, descricao_seo: null, embalagem_tipo: null });

const deferred = () => {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function mountRealLoadHook(file='useProdutoHttpEditLoad.js') {
  const source = await readFile(new URL(`../src/components/cadastros/produto/${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const state = []; const effects = []; let index = 0; const scheduled = [];
  const react = {
    useRef(initial) {const slot=index++;if(!(slot in state))state[slot]={current:initial};return state[slot];},
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], (value) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    },
    useEffect(effect, dependencies) {
      const slot = index++;
      const previous = effects[slot];
      if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
      previous?.cleanup?.();
      scheduled.push(() => { effects[slot] = { dependencies, cleanup: effect() }; });
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, AbortController, require: (id) => {
    if (id === 'react') return react;
    if (id === './produtoHttpPolicy.js') return { isProdutoHttpEditLoadComplete };
    throw new Error(`Import inesperado: ${id}`);
  } });
  return {
    render(props) { index = 0; const result = exports.default(props); scheduled.splice(0).forEach((run) => run()); return result; },
    unmount() { effects.forEach((entry) => entry?.cleanup?.()); },
  };
}

test('GET real do Produto: falha, retry, carga completa, save e reabertura preservam PIM', async () => {
  const hook = await mountRealLoadHook();
  let current = { descricao: 'Peça sintética', material: '', descricao_tecnica: '' };
  const calls = [];
  const errors = [];
  const props = {
    enabled: true, produtoId: 'produto-cpa', scopeKey: 'grupo-cpa:empresa-cpa',
    isScopeCurrent: () => true,
    load: (id) => { calls.push(id); return calls.length === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(fullProduto(id)); },
    onLoaded: (row) => { current = { ...current, ...row }; },
    onError: (error) => errors.push(error.message),
  };
  let view = hook.render(props);
  await flush();
  view = hook.render(props);
  assert.equal(view.loadError, true);
  assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), false);
  assert.deepEqual(errors, ['rede']);
  view.retry();
  hook.render(props);
  await flush();
  view = hook.render(props);
  assert.equal(view.loadError, false);
  assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), true);
  assert.equal(calls.length, 2);
  const payload = toProdutoHttpPayload(current, { update: true });
  assert.equal(payload.descricao, 'Peça sintética');
  assert.equal(payload.material, 'Aço');
  assert.equal(payload.descricao_tecnica, 'ASTM sintético');
  assert.equal(hook.render({ ...props, scopeKey: 'grupo-cpa:empresa-3z', isScopeCurrent: () => false }).readyId, 'produto-cpa');
  assert.equal(hook.render({ ...props, scopeKey: 'grupo-cpa:empresa-3z', isScopeCurrent: () => false }).readyId, null);
  hook.unmount();

  const reopened = await mountRealLoadHook();
  const persisted = { ...current };
  const reopenedProps = { ...props, load: async () => persisted, onLoaded: (row) => { current = { ...row }; } };
  reopened.render(reopenedProps);
  await flush();
  assert.equal(reopened.render(reopenedProps).readyId, 'produto-cpa');
  assert.equal(current.material, 'Aço');
  reopened.unmount();
});

test('GET/retry antigo da CPA não preenche nem libera save após troca para 3Z', async () => {
  const hook = await mountRealLoadHook();
  let scopeCurrent = true;
  const first = deferred(); const second = deferred();
  const loaded = []; const errors = []; let calls = 0;
  const props = {
    enabled: true, produtoId: 'produto-cpa', scopeKey: 'grupo-cpa:empresa-cpa',
    isScopeCurrent: () => scopeCurrent,
    load: () => (++calls === 1 ? first.promise : second.promise),
    onLoaded: (row) => loaded.push(row), onError: (error) => errors.push(error.message),
  };
  hook.render(props); await flush();
  first.reject(new Error('falha')); await flush();
  let view = hook.render(props);
  assert.equal(view.loadError, true);
  view.retry(); hook.render(props); await flush();
  scopeCurrent = false;
  second.resolve(fullProduto('produto-cpa')); await flush();
  view = hook.render({ ...props, scopeKey: 'grupo-cpa:empresa-3z' });
  assert.equal(calls, 2);
  assert.equal(view.readyId, null);
  assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), false);
  assert.deepEqual(loaded, []);
  assert.deepEqual(errors, ['falha']);
  hook.unmount();
});

test('GET parcial {id} ou sem campo PIM não libera PATCH; retry completo preserva PIM', async () => {
  const hook = await mountRealLoadHook();
  const rows = [{ id: 'produto-cpa' }, { ...fullProduto('produto-cpa'), material: undefined }, fullProduto('produto-cpa')];
  const loaded = []; const errors = [];
  const props = { enabled: true, produtoId: 'produto-cpa', scopeKey: 'grupo-cpa:empresa-cpa',
    isScopeCurrent: () => true, load: async () => rows.shift(),
    onLoaded: (row) => loaded.push(row), onError: (error) => errors.push(error.message) };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let view = hook.render(props);
    await flush(); view = hook.render(props);
    assert.equal(isProdutoHttpEditReady(true, props.produtoId, view.readyId), attempt === 2);
    if (attempt < 2) { assert.equal(view.loadError, true); view.retry(); }
  }
  assert.equal(errors.length, 2);
  assert.equal(loaded.length, 1);
  assert.equal(toProdutoHttpPayload(loaded[0], { update: true }).material, 'Aço');
  hook.unmount();
});

const produtoLink=(empresa='company-a',version=1)=>({id:`link-${empresa}`,group_id:'group-synthetic',empresa_id:empresa,produto_id:'product-synthetic',ativo:true,habilitado_operacao:true,version});
const linkProps=(api,extra={})=>({produtoId:'product-synthetic',groupId:'group-synthetic',empresaId:'company-a',canView:true,canManage:true,api,isScopeCurrent:()=>true,...extra});

test('Form ProdutoEmpresa real: vínculo ausente, criação CAS, duplo envio e resposta confirmada',async()=>{
  const hook=await mountRealLoadHook('useProdutoEmpresaOperacao.js'),pending=deferred();const puts=[];
  const api={empresaOperacao:{get:async()=>{throw Object.assign(new Error('missing'),{status:404,code:'PRODUTO_EMPRESA_NOT_FOUND'});},update:(id,payload,options)=>{puts.push({id,payload,options});return pending.promise;}}};
  const props=linkProps(api);hook.render(props);await flush();let view=hook.render(props);
  assert.equal(view.canSave,true);assert.equal(view.row,null);
  view.changeDraft({ativo:true});view=hook.render(props);view.changeDraft({habilitado_operacao:true});view=hook.render(props);
  const first=view.save(),duplicate=view.save();assert.equal(puts.length,1);assert.deepEqual({...puts[0].payload},{ativo:true,habilitado_operacao:true,expected_version:0});
  assert.equal(puts[0].options.signal.aborted,false);pending.resolve(produtoLink());await Promise.all([first,duplicate]);view=hook.render(props);
  assert.equal(view.row.version,1);assert.equal(view.phase,'ready');assert.equal(view.draft.habilitado_operacao,true);
  const oldView=view,b={...props,empresaId:'company-b'};hook.render(b);await flush();view=hook.render(b);
  oldView.changeDraft({ativo:true,habilitado_operacao:true});view=hook.render(b);assert.equal(view.draft.ativo,false);assert.equal(view.row,null);hook.unmount();
});

test('Form ProdutoEmpresa real: leitura/escrita tardias de outra empresa ou sessão não substituem vínculo',async()=>{
  const hook=await mountRealLoadHook('useProdutoEmpresaOperacao.js'),oldRead=deferred(),oldWrite=deferred();let gets=0,valid=true;const puts=[];
  const api={empresaOperacao:{get:()=>++gets===1?oldRead.promise:Promise.resolve(produtoLink('company-b',3)),update:(id,payload,options)=>{puts.push({payload,options});return oldWrite.promise;}}};
  const a=linkProps(api,{isScopeCurrent:()=>valid}),b=linkProps(api,{empresaId:'company-b',isScopeCurrent:()=>valid});
  hook.render(a);await flush();hook.render(b);await flush();let view=hook.render(b);assert.equal(view.row.empresa_id,'company-b');
  oldRead.resolve(produtoLink('company-a',9));await flush();view=hook.render(b);assert.equal(view.row.version,3);
  const save=view.save();assert.equal(puts.length,1);valid=false;view=hook.render(b);assert.equal(view.row,null);assert.equal(view.canSave,false);
  oldWrite.resolve(produtoLink('company-b',4));await save;view=hook.render(b);assert.equal(view.row,null);assert.equal(view.canSave,false);await view.save();assert.equal(puts.length,1);hook.unmount();
});

test('Form ProdutoEmpresa real: 409/503/JSON inválido exigem consulta, sem retry automático ou grant por visão Grupo',async()=>{
  const hook=await mountRealLoadHook('useProdutoEmpresaOperacao.js');let gets=0,puts=0;
  const api={empresaOperacao:{get:async()=>produtoLink('company-a',++gets),update:async()=>{puts++;throw Object.assign(new Error('conflict'),{status:409});}}};
  const props=linkProps(api);hook.render(props);await flush();let view=hook.render(props);await view.save();view=hook.render(props);
  assert.equal(view.phase,'blocked');assert.equal(view.canSave,false);await view.save();assert.equal(puts,1);assert.equal(gets,1);
  view.reload();hook.render(props);await flush();view=hook.render(props);assert.equal(view.row.version,2);assert.equal(view.canSave,true);hook.unmount();
  for(const response of [()=>{throw Object.assign(new Error('off'),{status:503});},()=>({id:'wrong-identity',version:1}),()=>{throw Object.assign(new Error('route missing'),{status:404});}]){
    const blocked=await mountRealLoadHook('useProdutoEmpresaOperacao.js');let writes=0;
    const p=linkProps({empresaOperacao:{get:async()=>response(),update:async()=>{writes++;}}});blocked.render(p);await flush();const v=blocked.render(p);assert.equal(v.canSave,false);await v.save();assert.equal(writes,0);blocked.unmount();
  }
  const group=await mountRealLoadHook('useProdutoEmpresaOperacao.js');let reads=0;
  const p=linkProps({empresaOperacao:{get:async()=>{reads++;},update:async()=>{throw Error('no Group write');}}},{empresaId:null});group.render(p);await flush();const v=group.render(p);assert.equal(v.canSave,false);await v.save();assert.equal(reads,0);group.unmount();
});

test('Form ProdutoEmpresa real: ACK de outra identidade/estado/versão não libera nova gravação',async()=>{
  for(const ack of [undefined,produtoLink('company-b'),{...produtoLink(),version:0},{...produtoLink(),ativo:false,habilitado_operacao:false}]) {
    const hook=await mountRealLoadHook('useProdutoEmpresaOperacao.js');let writes=0;
    const p=linkProps({empresaOperacao:{get:async()=>produtoLink(),update:async()=>{writes++;return ack;}}});
    hook.render(p);await flush();let v=hook.render(p);await v.save();v=hook.render(p);
    assert.equal(v.phase,'blocked');assert.equal(v.canSave,false);await v.save();assert.equal(writes,1);hook.unmount();
  }
});
