/**
 * P1 Codex #6441849832 — graduação ID-only→reopen não pode aceitar remoção
 * da negativa de submit. Guarda estrutural + handler real sem permissão.
 *
 * Arquivo separado de `cursor-identidade-consolidacao.test.js` para não
 * adulterar o pin CANAL `53ed9f42…` / consolidation81Remainder.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/components/cadastros/cadastroReopenPolicy.js';

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const GRADUATED_SUBMIT_GATES = {
  OperadorCaixa: {
    path: 'src/components/cadastros/OperadorCaixaForm.jsx',
    boundId: 'operadorBoundId',
    gate: /if\s*\(\s*!podeSalvar\s*\)\s*\{[\s\S]*?return;\s*\}/,
  },
  CondicaoComercial: {
    path: 'src/components/cadastros/CondicaoComercialForm.jsx',
    boundId: 'condicaoBoundId',
    gate: /if\s*\(\s*!podeSalvar\s*\)\s*\{[\s\S]*?return;\s*\}/,
  },
  MoedaIndice: {
    path: 'src/components/cadastros/MoedaIndiceForm.jsx',
    boundId: 'moedaBoundId',
    gate: /if\s*\(\s*moedaBoundId\s*&&\s*!podeEditar\s*\)\s*\{[\s\S]*?return;\s*\}[\s\S]*?if\s*\(\s*!moedaBoundId\s*&&\s*!podeCriar\s*\)\s*\{[\s\S]*?return;\s*\}/,
  },
  ContatoB2B: {
    path: 'src/components/cadastros/ContatoB2BForm.jsx',
    boundId: 'contatoBoundId',
    gate: /if\s*\(\s*!podeSalvar\s*\)\s*\{[\s\S]*?return;\s*\}/,
  },
};

function assertSubmitGateIntact(name, source = read(GRADUATED_SUBMIT_GATES[name].path)) {
  const spec = GRADUATED_SUBMIT_GATES[name];
  assert.match(source, /useCadastroReopenOnIdentity/);
  assert.match(source, new RegExp(spec.boundId));
  assert.match(source, spec.gate, `${name}: negativa de submit ausente`);
  const matches = source.match(new RegExp(spec.gate.source, 'g')) || [];
  assert.equal(matches.length, 1, `${name}: ocorrência única do hunk de negativa`);
}

test('graduados preservam negativa de submit (hunk único) e rejeitam remoção', () => {
  for (const name of Object.keys(GRADUATED_SUBMIT_GATES)) {
    const source = read(GRADUATED_SUBMIT_GATES[name].path);
    assertSubmitGateIntact(name, source);
    const stripped = source.replace(GRADUATED_SUBMIT_GATES[name].gate, 'if (false) { /* submit gate removed */ }');
    assert.notEqual(stripped, source);
    assert.throws(
      () => assertSubmitGateIntact(name, stripped),
      (err) => err instanceof assert.AssertionError,
      `${name}: remoção da negativa deve falhar a guarda`,
    );
  }
});

test('contraprova Codex: OperadorCaixa if (!podeSalvar)→if (false) é detectada; handler sem permissão não persiste', async () => {
  const formPath = 'src/components/cadastros/OperadorCaixaForm.jsx';
  const original = read(formPath);
  assertSubmitGateIntact('OperadorCaixa', original);

  // Achado reproduzido: mutação mínima que a suíte antiga (só presence) aceitava.
  const attacked = original.replace(
    /if\s*\(\s*!podeSalvar\s*\)\s*\{[\s\S]*?return;\s*\}/,
    'if (false) {\n      toast.error("Seu perfil nao permite salvar operador de caixa.");\n      return;\n    }',
  );
  assert.notEqual(attacked, original);
  assert.throws(() => assertSubmitGateIntact('OperadorCaixa', attacked));

  // Handler real sem permissão — não basta procurar o nome da proteção.
  const hookSource = read('src/components/cadastros/useCadastroReopenOnIdentity.js');
  const compile = (source) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const creates = [];
  const updates = [];
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
    useCallback(fn) { return fn; },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) {
      const i = slot++;
      const prev = effects[i];
      if (prev && deps && prev.deps && deps.every((v, k) => Object.is(v, prev.deps[k]))) return;
      prev?.cleanup?.();
      scheduled.push(() => { effects[i] = { deps, cleanup: fn() }; });
    },
  };
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require(id) {
      if (!sandbox.__modules[id]) throw new Error(`Import inesperado: ${id}`);
      return sandbox.__modules[id];
    },
    window: { confirm: () => true },
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
  const hookFn = hookExports.default || hookExports;

  async function runSubmit(formSource, { canCreate, canEdit }) {
    creates.length = 0;
    updates.length = 0;
    state.length = 0;
    effects.length = 0;
    scheduled.length = 0;
    slot = 0;
    const formExports = {};
    sandbox.exports = formExports;
    sandbox.module = { exports: formExports };
    sandbox.__modules = {
      react: { __esModule: true, default: react, ...react },
      '@/components/ui/input': { Input: 'Input' },
      '@/components/ui/label': { Label: 'Label' },
      '@/components/ui/button': { Button: 'Button' },
      '@/components/ui/textarea': { Textarea: 'Textarea' },
      '@/components/ui/card': { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' },
      '@/components/ui/checkbox': { Checkbox: 'Checkbox' },
      '@/components/ui/badge': { Badge: 'Badge' },
      '@/components/ui/select': {
        Select: 'Select', SelectContent: 'SelectContent', SelectItem: 'SelectItem',
        SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue',
      },
      '@/components/lib/usePermissions': {
        __esModule: true,
        default: () => ({
          canCreate: () => canCreate,
          canEdit: () => canEdit,
          canDelete: () => false,
          hasPermission: () => false,
        }),
      },
      '@/components/lib/useContextoVisual': {
        useContextoVisual: () => ({
          empresaAtual: { id: 'emp-1', group_id: 'grp-1' },
          grupoAtual: { id: 'grp-1' },
          contexto: 'empresa',
          filterInContext: async () => [],
          createInContext: async (entity, payload) => { creates.push({ entity, payload }); return payload; },
          updateInContext: async (entity, id, payload) => { updates.push({ entity, id, payload }); return payload; },
        }),
      },
      '@/components/cadastros/CadastroCodigoRegistroField': {
        __esModule: true,
        default: (p) => ({ type: 'CadastroCodigoRegistroField', props: p }),
      },
      '@/components/cadastros/useCadastroReopenOnIdentity': { __esModule: true, default: hookFn },
      'lucide-react': new Proxy({}, { get: () => 'Icon' }),
      sonner: { toast: { success: () => {}, error: () => {} } },
      '@tanstack/react-query': { useQuery: () => ({ data: [], isLoading: false }) },
    };
    vm.runInNewContext(compile(formSource), sandbox);
    const Component = formExports.default || formExports;
    const props = { item: null, onSubmit: () => {} };
    slot = 0;
    let treeNode = Component(props);
    scheduled.splice(0).forEach((fn) => fn());
    state[0] = { ...state[0], nome_caixa: 'X', empresa_id: 'emp-1', colaborador_id: 'c1' };
    slot = 0;
    treeNode = Component(props);
    scheduled.splice(0).forEach((fn) => fn());
    const walk = (node) => (!node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flatMap(walk)]);
    const form = walk(treeNode).find((n) => n.type === 'form' || (n.props && n.props.onSubmit));
    assert.ok(form);
    await form.props.onSubmit({ preventDefault() {} });
    return { creates: creates.slice(), updates: updates.slice() };
  }

  const denied = await runSubmit(original, { canCreate: false, canEdit: false });
  assert.equal(denied.creates.length, 0);
  assert.equal(denied.updates.length, 0);

  // Com a negativa removida, o mesmo perfil sem permissão PERSISTIRIA — prova do furo.
  const leaked = await runSubmit(attacked, { canCreate: false, canEdit: false });
  assert.equal(leaked.creates.length, 1, 'ataque Codex: sem gate, create vaza');
  assert.equal(leaked.creates[0].entity, 'OperadorCaixa');
});
