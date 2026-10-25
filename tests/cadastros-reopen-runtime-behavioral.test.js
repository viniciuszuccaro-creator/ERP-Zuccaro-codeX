import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';

/**
 * Executa RepresentanteForm real com hooks deterministas.
 * Prova reopen por id/updated_date sem depender de assert de texto-fonte.
 */
async function mountRepresentante(initial) {
  const formSource = await readFile(new URL('../src/components/cadastros/RepresentanteForm.jsx', import.meta.url), 'utf8');
  const hookSource = await readFile(new URL('../src/components/cadastros/useCadastroReopenOnIdentity.js', import.meta.url), 'utf8');
  const compile = (source) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;

  const state = [];
  const effects = [];
  const scheduled = [];
  let slot = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState(initialValue) {
      const i = slot++;
      if (!(i in state)) state[i] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
    },
    useRef(initialValue) {
      const i = slot++;
      if (!(i in state)) state[i] = { current: initialValue };
      return state[i];
    },
    useEffect(fn, deps) {
      const i = slot++;
      const prev = effects[i];
      if (prev && deps && prev.deps && deps.every((v, k) => Object.is(v, prev.deps[k]))) return;
      prev?.cleanup?.();
      scheduled.push(() => { effects[i] = { deps, cleanup: fn() }; });
    },
  };

  let props = { item: initial, onSubmit: () => {}, isSubmitting: false };
  const confirms = [];
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    window: {
      confirm(message) {
        confirms.push(message);
        return sandbox.__confirmResult !== false;
      },
    },
    __confirmResult: true,
    __modules: {},
  };

  const hookExports = {};
  sandbox.exports = hookExports;
  sandbox.module = { exports: hookExports };
  sandbox.__modules = {
    react: { __esModule: true, default: react, ...react },
    './cadastroReopenPolicy': policy,
    './cadastroReopenPolicy.js': policy,
  };
  vm.runInNewContext(compile(hookSource), sandbox);

  const formExports = {};
  sandbox.exports = formExports;
  sandbox.module = { exports: formExports };
  sandbox.__modules = {
    react: { __esModule: true, default: react, ...react },
    '@/components/ui/input': { Input: 'Input' },
    '@/components/ui/label': { Label: 'Label' },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/select': {
      Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem',
      SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue',
    },
    '@/components/ui/switch': { Switch: 'Switch' },
    '@/components/lib/usePermissions': {
      __esModule: true,
      default: () => ({
        canCreate: () => true,
        canEdit: () => true,
        hasPermission: () => true,
      }),
    },
    '@/components/lib/useContextoVisual': {
      __esModule: true,
      useContextoVisual: () => ({ empresaAtual: { id: 'e1', group_id: 'g1' }, grupoAtual: { id: 'g1' }, contexto: 'empresa' }),
    },
    '@/components/cadastros/CadastroCodigoRegistroField': {
      __esModule: true,
      default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p, children: [] }),
    },
    '@/components/cadastros/useCadastroReopenOnIdentity': {
      __esModule: true,
      default: hookExports.default || sandbox.module.exports.default || hookExports,
    },
    'lucide-react': new Proxy({}, { get: () => 'Icon' }),
  };
  // hookExports may be module.exports after CJS transpile
  const hookFn = hookExports.default || hookExports;
  sandbox.__modules['@/components/cadastros/useCadastroReopenOnIdentity'] = {
    __esModule: true,
    default: typeof hookFn === 'function' ? hookFn : hookFn.default,
  };
  vm.runInNewContext(compile(formSource), sandbox);

  let tree;
  const Component = formExports.default || sandbox.module.exports.default || formExports;
  const render = (nextProps) => {
    if (nextProps) props = { ...props, ...nextProps };
    slot = 0;
    tree = Component(props);
    scheduled.splice(0).forEach((fn) => fn());
    return tree;
  };
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  const findInput = (placeholder) => walk(tree).find((n) => n.type === 'Input' && n.props?.placeholder === placeholder);
  render();
  render();
  return {
    render,
    findInput,
    confirms,
    setConfirm(result) { sandbox.__confirmResult = result; },
    getNome: () => findInput('Nome do representante')?.props?.value,
  };
}

test('comportamental: troca de id reidrata nome/código sem manter rascunho do registro anterior', async () => {
  const h = await mountRepresentante({
    id: 'r1', codigo: '000001', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
  });
  assert.equal(h.getNome(), 'Alpha');
  h.render({
    item: {
      id: 'r2', codigo: '000002', nome: 'Beta', updated_date: '2026-01-02T00:00:00Z', ativo: true,
    },
  });
  h.render();
  assert.equal(h.getNome(), 'Beta');
});

test('comportamental: mesmo id com updated_date novo reidrata campos após save externo limpo', async () => {
  const h = await mountRepresentante({
    id: 'r1', codigo: '000001', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
  });
  assert.equal(h.getNome(), 'Alpha');
  h.render({
    item: {
      id: 'r1', codigo: '000001', nome: 'Alpha Revisado', updated_date: '2026-01-03T12:00:00Z', ativo: true,
    },
  });
  h.render();
  assert.equal(h.getNome(), 'Alpha Revisado');
  assert.equal(h.confirms.length, 0);
});

test('comportamental: mesmo id e mesmo updated_date não apaga edição suja local', async () => {
  const h = await mountRepresentante({
    id: 'r1', codigo: '000001', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
  });
  const nomeInput = h.findInput('Nome do representante');
  assert.ok(nomeInput);
  nomeInput.props.onChange({ target: { value: 'Rascunho local' } });
  h.render({
    item: {
      id: 'r1', codigo: '000001', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
    },
  });
  h.render();
  assert.equal(h.getNome(), 'Rascunho local');
  assert.equal(h.confirms.length, 0);
});

test('P1 contraprova: mesmo id + updated_date novo com rascunho sujo exige confirmação e preserva se recusar', async () => {
  const h = await mountRepresentante({
    id: 'r1', codigo: '000001', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
  });
  h.findInput('Nome do representante').props.onChange({ target: { value: 'Rascunho local nao salvo' } });
  h.setConfirm(false);
  h.render({
    item: {
      id: 'r1', codigo: '000001', nome: 'Alteracao externa', updated_date: '2026-01-03T12:00:00Z', ativo: true,
    },
  });
  h.render();
  assert.equal(h.getNome(), 'Rascunho local nao salvo');
  assert.equal(h.confirms.length, 1);
  assert.match(h.confirms[0], /não salvas|Descartar o rascunho/i);
});

test('P1: mesmo id + updated_date novo com rascunho sujo reidrata se confirmar descarte', async () => {
  const h = await mountRepresentante({
    id: 'r1', codigo: '000001', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
  });
  h.findInput('Nome do representante').props.onChange({ target: { value: 'Rascunho local nao salvo' } });
  h.setConfirm(true);
  h.render({
    item: {
      id: 'r1', codigo: '000001', nome: 'Alteracao externa', updated_date: '2026-01-03T12:00:00Z', ativo: true,
    },
  });
  h.render();
  assert.equal(h.getNome(), 'Alteracao externa');
  assert.equal(h.confirms.length, 1);
});

test('troca de registro com rascunho sujo exige confirmação explícita', async () => {
  const h = await mountRepresentante({
    id: 'r1', codigo: '000001', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
  });
  h.findInput('Nome do representante').props.onChange({ target: { value: 'Rascunho A' } });
  h.setConfirm(false);
  h.render({
    item: {
      id: 'r2', codigo: '000002', nome: 'Beta', updated_date: '2026-01-02T00:00:00Z', ativo: true,
    },
  });
  h.render();
  assert.equal(h.getNome(), 'Rascunho A');
  assert.equal(h.confirms.length, 1);
  assert.match(h.confirms[0], /outro registro/i);
});

test('eco do próprio save (form == servidor) aplica updated_date sem prompt', async () => {
  const h = await mountRepresentante({
    id: 'r1', codigo: '000001', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z', ativo: true,
  });
  h.findInput('Nome do representante').props.onChange({ target: { value: 'Alpha Salvo' } });
  h.render({
    item: {
      id: 'r1', codigo: '000001', nome: 'Alpha Salvo', updated_date: '2026-01-04T00:00:00Z', ativo: true,
    },
  });
  h.render();
  assert.equal(h.getNome(), 'Alpha Salvo');
  assert.equal(h.confirms.length, 0);
});

test('política canônica: cenários decideCadastroReopen', () => {
  assert.equal(policy.decideCadastroReopen({
    idChanged: false, updatedChanged: false, isDirty: true, matchesIncoming: false,
  }), 'keep');
  assert.equal(policy.decideCadastroReopen({
    idChanged: true, updatedChanged: false, isDirty: false, matchesIncoming: false,
  }), 'apply');
  assert.equal(policy.decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: false, matchesIncoming: false,
  }), 'apply');
  assert.equal(policy.decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: true, matchesIncoming: true,
  }), 'apply');
  assert.equal(policy.decideCadastroReopen({
    idChanged: false, updatedChanged: true, isDirty: true, matchesIncoming: false,
    confirmDiscard: () => false,
  }), 'acknowledge');
  assert.equal(policy.decideCadastroReopen({
    idChanged: true, updatedChanged: false, isDirty: true, matchesIncoming: false,
    confirmSwitch: () => false,
  }), 'acknowledge');
});
