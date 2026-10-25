import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const parse = (path, source = read(path)) => ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
function nodes(tree, predicate) {
  const found = [];
  const visit = node => { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); };
  visit(tree); return found;
}
function once(source, current, previous) {
  assert.equal(source.split(current).length - 1, 1, 'exact integration hunk');
  return source.replace(current, previous);
}
// previousHash: stage48 + P1 reopen + boundId coorte (#353 Banco/Cargo/+; switch-reject).
const forms = [
  ['CadastroClienteCompleto', 'cliente', 'Cliente', '65aad99e4b57c9bbadbcd9c21c0288627056833d022d7510ab9e1b41635a7aca'],
  ['CadastroFornecedorCompleto', 'fornecedor', 'Fornecedor', 'b8def9d66502f8dba814f1ecf457e40b59215cbdc2d31866590fad491db587fb'],
  ['RepresentanteFormCompleto', 'representante', 'Representante', '961a1d5e46395bad4e738f9671c6a86051a27ed8076346a87457ead41a9dc910'],
];
for (const [name, recordKey, entity, previousHash] of forms) {
  const path = `src/components/cadastros/${name}.jsx`;
  test(`${name}: stage48 complete source retained except payload annotation and proven default export`, () => {
    let source = once(read(path), '    /** @param {Record<string, unknown>} data */\n    mutationFn: async (data) => {', '    mutationFn: async (data) => {');
    if (name === 'CadastroClienteCompleto') source = once(source, 'default: m.default }', 'default: m.default || m.TimelineCliente }');
    assert.match(source, /useCadastroReopenOnIdentity/);
    assert.equal(createHash('sha256').update(source).digest('hex'), previousHash);
  });
  const tree = parse(path);
  const declaration = nodes(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'saveMutation')[0];
  const options = declaration.initializer.arguments[0];
  const callback = key => options.properties.find(node => node.name?.getText(tree) === key).initializer.getText(tree);
  const make = (text, bindings) => new Function(...Object.keys(bindings), `return (${text});`)(...Object.values(bindings));
  test(`${name}: actual insert/update passes its canonical payload, existing company ownership and permission gates`, async () => {
    const input = { nome: 'Synthetic record', group_id: 'group-a', empresa_id: 'company-a' };
    for (const editing of [false, true]) {
      const calls = [];
      const canonical = { ...input, normalized: true };
      const boundId = editing ? 'synthetic-a' : null;
      const fn = make(callback('mutationFn'), {
        assertFormScopeCurrent() {}, contextoValido: true,
        podeEditar: true, podeCriar: true, [recordKey]: editing ? { id: 'synthetic-a' } : null,
        // P1 switch-reject: mutação usa identidade do rascunho (formData.id / *BoundId), não só props.
        formData: editing ? { id: 'synthetic-a' } : {},
        representanteBoundId: recordKey === 'representante' ? boundId : undefined,
        clienteBoundId: recordKey === 'cliente' ? boundId : undefined,
        fornecedorBoundId: recordKey === 'fornecedor' ? boundId : undefined,
        buildPayload(value) { assert.equal(value, input); return canonical; },
        updateInContext: (...args) => { calls.push(['update', ...args]); return Promise.resolve({ id: 'synthetic-a' }); },
        createInContext: (...args) => { calls.push(['create', ...args]); return Promise.resolve({ id: 'synthetic-a' }); },
      });
      assert.deepEqual(await fn(input), { id: 'synthetic-a' });
      const expected = editing ? ['update', entity, 'synthetic-a', canonical] : ['create', entity, canonical];
      if (entity === 'Fornecedor') expected.push('empresa_dona_id');
      assert.deepEqual(calls, [expected]);
    }
    for (const blocked of ['context', 'scope', 'create', 'update']) {
      let writes = 0;
      const boundId = blocked === 'update' ? 'synthetic-a' : null;
      const fn = make(callback('mutationFn'), {
        assertFormScopeCurrent() { if (blocked === 'scope') throw Error('Synthetic scope changed'); },
        contextoValido: blocked !== 'context', podeEditar: false, podeCriar: false,
        [recordKey]: blocked === 'update' ? { id: 'synthetic-a' } : null,
        formData: blocked === 'update' ? { id: 'synthetic-a' } : {},
        representanteBoundId: recordKey === 'representante' ? boundId : undefined,
        clienteBoundId: recordKey === 'cliente' ? boundId : undefined,
        fornecedorBoundId: recordKey === 'fornecedor' ? boundId : undefined,
        buildPayload: value => value,
        createInContext() { writes++; }, updateInContext() { writes++; },
      });
      await assert.rejects(fn(input)); assert.equal(writes, 0);
    }
  });
  test(`${name}: actual success callback retains submitted variables and ignores stale scope`, () => {
    for (const current of [true, false]) {
      const events = [], payload = { nome: 'Synthetic submitted' }, fallback = { nome: 'Synthetic fallback' };
      const fn = make(callback('onSuccess'), {
        isFormScopeCurrent: () => current,
        queryClient: { invalidateQueries: value => events.push(['invalidate', value]) },
        toast: value => events.push(['toast', value]), [recordKey]: null,
        representanteBoundId: null, clienteBoundId: null, fornecedorBoundId: null,
        onSuccess: () => events.push(['success']), onSubmit: value => events.push(['submit', value]),
        onCloseNorm: () => events.push(['close']), buildPayload: () => fallback, formData: {},
      });
      fn({ id: 'synthetic-result' }, payload);
      if (!current) assert.deepEqual(events, []);
      else {
        assert.deepEqual(events.find(event => event[0] === 'submit'), ['submit', entity === 'Fornecedor' ? fallback : payload]);
        assert.equal(events.at(-1)[0], 'close');
      }
    }
  });
}

test('Timeline lazy loader uses the actual default export, retaining separate ResumoHistorico loader', async () => {
  const path = 'src/components/cadastros/CadastroClienteCompleto.jsx', tree = parse(path);
  const declaration = nodes(tree, node => ts.isVariableDeclaration(node) && node.name.getText(tree) === 'TimelineCliente')[0];
  const loader = declaration.initializer.arguments[0].getText(tree).replace('import("@/components/cliente/TimelineCliente")', 'Promise.resolve(module)');
  const component = () => null;
  assert.equal((await new Function('module', `return (${loader})();`)({ default: component })).default, component);
  const module = parse('src/components/cliente/TimelineCliente.jsx');
  assert.ok(module.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === 'TimelineCliente'
    && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)));
  assert.ok(read(path).includes('default: m.ResumoHistorico'));
});

const dashboard = 'src/components/administracao-sistema/seguranca-governanca/SegurancaDashboard.jsx';
test('Dashboard stage48 source retained except five exact query-read hunks', () => {
  let source = once(read(dashboard), 'const { data } = useQuery({', 'const { data = {} } = useQuery({');
  for (const field of ['estatisticas', 'perfis', 'usuarios', 'auditoriaAcessos']) source = once(source, `data?.${field} ||`, `data.${field} ||`);
  assert.equal(createHash('sha256').update(source).digest('hex'), '59a7d00ec09641022de0d1703611ffed85391bc0588d9dd65f2f3d7e52ffea09');
});
test('Dashboard query absent/present data renders unchanged fallbacks without authorizing a query', () => {
  const tree = parse(dashboard);
  const fields = ['estatisticas', 'perfis', 'usuarios', 'auditoriaAcessos'];
  const attrs = nodes(tree, node => ts.isJsxAttribute(node) && fields.includes(node.name.getText(tree)));
  assert.equal(attrs.length, 4);
  const evaluate = data => attrs.map(attr => new Function('data', `return (${attr.initializer.expression.getText(tree)});`)(data));
  assert.deepEqual(evaluate(undefined), [{ cobertura: 0, totalUsuarios: 0, conflitosTotal: 0 }, [], [], []]);
  const data = { estatisticas: { cobertura: 50 }, perfis: [{ id: 'profile-a' }], usuarios: [{ id: 'user-a' }], auditoriaAcessos: [{ id: 'audit-a' }] };
  assert.deepEqual(evaluate(data), Object.values(data));
  const query = nodes(tree, node => ts.isCallExpression(node) && node.expression.getText(tree) === 'useQuery')[0];
  const enabled = query.arguments[0].properties.find(node => node.name?.getText(tree) === 'enabled').initializer.getText(tree);
  for (const canView of [false, true]) for (const contextoValido of [false, true]) {
    assert.equal(new Function('canView', 'contextoValido', `return (${enabled});`)(canView, contextoValido), canView && contextoValido);
  }
});
