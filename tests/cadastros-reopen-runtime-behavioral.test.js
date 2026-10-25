import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

/**
 * Executa RepresentanteForm real com hooks deterministas.
 * Prova reopen por id/updated_date sem depender de assert de texto-fonte.
 */
async function mountRepresentante(initial) {
  const source = await readFile(new URL('../src/components/cadastros/RepresentanteForm.jsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
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
  const messages = [];
  const modules = {
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
    'lucide-react': new Proxy({}, { get: () => 'Icon' }),
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => {
      if (!modules[id]) throw new Error(`Import inesperado: ${id}`);
      return modules[id];
    },
  });
  let tree;
  const render = (nextProps) => {
    if (nextProps) props = { ...props, ...nextProps };
    slot = 0;
    tree = exports.default(props);
    scheduled.splice(0).forEach((fn) => fn());
    return tree;
  };
  const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
  const findInput = (placeholder) => walk(tree).find((n) => n.type === 'Input' && n.props?.placeholder === placeholder);
  render();
  render(); // second pass applies effects
  return { render, findInput, messages, getNome: () => findInput('Nome do representante')?.props?.value };
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

test('comportamental: mesmo id com updated_date novo reidrata campos após save externo', async () => {
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
});
