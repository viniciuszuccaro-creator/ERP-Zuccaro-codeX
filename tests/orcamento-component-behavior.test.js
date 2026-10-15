import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/comercial/orcamentoUiPolicy.js';
import * as picker from '../src/components/comercial/comercialMasterPicker.js';

const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const cpa = { groupId: 'g', empresaId: 'cpa', actorId: 'u' };
const tresZ = { ...cpa, empresaId: '3z' };
const row = () => ({ id: 'o-1', numero: '1', status: 'EM_ABERTO', cliente_empresa_id: 'ce-1',
  condicao_pagamento_id: 'cp-1', validade_em: '2027-01-31', observacoes: 'Sintetico', total: '10',
  itens: [{ id: 'i-1', produto_id: 'p-1', unidade_id: 'un-1', descricao: 'Item', unidade_sigla: 'UN',
    quantidade: '1', preco_unitario: '10', desconto: '0', total: '10' }] });

// Executa o componente real com hooks deterministas e transporte controlado.
// As policies e os pickers continuam sendo as implementacoes de producao.
async function mount() {
  const source = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
  const state = []; const effects = []; const scheduled = []; let slot = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initial) { const i = slot++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = slot++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
    useMemo(fn) { slot++; return fn(); },
    useEffect(fn, deps) { const i = slot++; const prev = effects[i];
      if (prev && deps.every((v, k) => Object.is(v, prev.deps[k]))) return;
      prev?.cleanup?.(); scheduled.push(() => { effects[i] = { deps, cleanup: fn() }; }); },
  };
  let active = cpa; let permission = true; let current = row(); let props = { ...cpa };
  const calls = []; const invalidations = []; const messages = []; const pending = {};
  const request = (method, scope, args) => { calls.push({ method, scope, args }); return pending[method]?.promise || Promise.resolve(current); };
  const modules = {
    react: { __esModule: true, default: react, ...react },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries: (key) => invalidations.push(key) }),
      useQuery: ({ queryKey }) => queryKey[0] === 'orcamentos-http'
        ? { data: { data: [current], meta: { total: 1 } } }
        : { data: { clientesEmpresa: [], clientes: [], condicoes: [], produtos: [], unidades: [], tabelas: [] } } },
    '@/api/erpHttpSession': { readErpHttpSession: () => active },
    '@/api/httpApiClient': { createHttpApiClient: ({ getScope }) => ({
      orcamentos: Object.fromEntries(['update', 'create', 'get', 'cancel'].map((method) => [method, (...args) => request(method, getScope(), args)])),
      pedidos: { convertOrcamento: (...args) => request('convert', getScope(), args) },
    }) },
    './orcamentoUiPolicy': policy, './comercialMasterPicker': picker,
    sonner: { toast: Object.fromEntries(['error', 'success'].map((kind) => [kind, (text) => messages.push({ kind, text })])) },
    '@/components/lib/exportacaoPDF': { gerarPDFOrcamento: () => true },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, Date, Intl, window: { addEventListener() {}, removeEventListener() {}, confirm: () => true },
    require: (id) => modules[id] || (id === 'lucide-react' || id.startsWith('@/components/ui/')
      ? new Proxy({ __esModule: true, default: 'ConfirmDialog' }, { get: (obj, key) => obj[key] ?? key })
      : (() => { throw new Error(`Import inesperado: ${id}`); })()) });
  let tree;
  const render = () => { slot = 0; tree = exports.default({ ...props, hasPermission: () => permission, filterInContext: async () => [] });
    scheduled.splice(0).forEach((fn) => fn()); return tree; };
  const walk = (node) => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)];
  const nodes = () => walk(tree);
  const text = (node) => typeof node === 'string' ? node : (node?.children || []).map(text).join('');
  const find = (predicate) => { const found = nodes().find(predicate); assert.ok(found, 'controle esperado no componente real'); return found; };
  render(); render();
  return { calls, invalidations, messages, pending, render,
    title: (title) => find((n) => n.props?.title === title),
    button: (label) => find((n) => n.type === 'Button' && text(n) === label),
    find, nodes, setSession: (scope) => { active = scope; }, setProps: (scope) => { props = scope; },
    revoke: () => { permission = false; }, setRecord: (record) => { current = record; } };
}

test('Orcamento real: save duplo envia uma mutacao; falha libera retry e reabertura', async () => {
  const h = await mount(); h.title('Editar').props.onClick(); h.render();
  h.pending.update = deferred(); const click = h.button('Salvar orçamento').props.onClick;
  const first = click(); await click(); assert.equal(h.calls.length, 1);
  h.pending.update.reject(new Error('rede')); await first;
  h.pending.update = deferred(); h.render(); const retry = h.button('Salvar orçamento').props.onClick();
  assert.equal(h.calls.length, 2); const saved = { ...row(), observacoes: 'Sintetico' };
  h.pending.update.resolve(saved); await retry;
  assert.equal(h.invalidations.length, 1); h.setRecord(saved); h.render(); h.title('Editar').props.onClick(); h.render();
  assert.equal(h.find((n) => n.type === 'Textarea').props.value, saved.observacoes);
});

test('Orcamento real: resposta e erro tardios nao afetam empresa nova antes do rerender', async () => {
  for (const failure of [false, true]) {
    const h = await mount(); h.title('Editar').props.onClick(); h.render(); h.pending.update = deferred();
    const result = h.button('Salvar orçamento').props.onClick(); h.setSession(tresZ);
    if (failure) h.pending.update.reject({ status: 422, body: { error: { message: 'texto anterior privado' } } });
    else h.pending.update.resolve(row());
    await result; assert.equal(h.calls[0].scope.empresaId, 'cpa');
    assert.equal(h.invalidations.length, 0); assert.equal(h.messages.length, 0);
    h.setProps(tresZ); h.render(); h.render();
    assert.equal(h.find((n) => n.type === 'Dialog' && n.props.open === false).props.open, false);
  }
});

test('Orcamento real: cancelar/converter bloqueiam clique duplo e callback tardio', async () => {
  for (const method of ['cancel', 'convert']) {
    const h = await mount(); h.pending[method] = deferred(); let click;
    if (method === 'cancel') { h.title('Cancelar').props.onClick(); h.render(); click = h.find((n) => typeof n.props.onConfirm === 'function').props.onConfirm; }
    else { await h.title('Visualizar').props.onClick(); h.render(); h.button('Converter em pedido').props.onClick(); h.render();
      h.nodes().filter((n) => n.type === 'Input' && n.props.type === 'date').at(-1).props.onChange({ target: { value: '2027-02-01' } });
      h.render(); click = h.button('Criar pedido').props.onClick; }
    const result = click(); click(); assert.equal(h.calls.filter((c) => c.method === method).length, 1);
    h.setSession(tresZ); h.pending[method].resolve(row()); await result; await flush();
    assert.equal(h.invalidations.length, 0); assert.equal(h.messages.filter((m) => m.kind === 'success').length, 0);
  }
});

test('Orcamento real: permissao revogada com formulario aberto impede envio', async () => {
  for (const method of ['update', 'cancel', 'convert']) {
    const h = await mount(); let click;
    if (method === 'update') { h.title('Editar').props.onClick(); h.render(); click = h.button('Salvar orçamento').props.onClick; }
    else if (method === 'cancel') { h.title('Cancelar').props.onClick(); h.render(); click = h.find((n) => typeof n.props.onConfirm === 'function').props.onConfirm; }
    else { await h.title('Visualizar').props.onClick(); h.render(); h.button('Converter em pedido').props.onClick(); h.render(); click = h.button('Criar pedido').props.onClick; }
    const before = h.calls.length; h.revoke(); await click();
    assert.equal(h.calls.length, before); assert.equal(h.messages.at(-1).kind, 'error');
  }
});

test('Orcamento real: detalhe tardio nao reabre dialogo na empresa seguinte', async () => {
  const h = await mount(); h.pending.get = deferred();
  const loading = h.title('Visualizar').props.onClick(); h.setSession(tresZ); h.setProps(tresZ); h.render(); h.render();
  h.pending.get.resolve(row()); await loading; h.render();
  assert.equal(h.nodes().some((n) => n.type === 'Dialog' && n.props.open === true), false);
  assert.equal(h.messages.length, 0);
});
