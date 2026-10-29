/**
 * Contraprovas #424 — callbacks/useEffect REAIS via TypeScript AST (não réplicas).
 * Cobre: GET tardio, mutação concorrente, rejeição, skipped/rascunho, audit empresa.
 * Exige: baseline PASS + mutação que desabilita guard epoch/skipped FAZ o teste falhar.
 * Não monta React completo; não exige PG/Auth/VPS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const painelPath = path.join(root, 'src/components/cadastros/PainelDinamicoCliente.jsx');
const formPath = path.join(root, 'src/components/cadastros/GerenciarContatosClienteForm.jsx');
const ctxPath = path.join(root, 'src/components/lib/useContextoVisual.jsx');

function read(p) {
  return readFileSync(p, 'utf8');
}

function parseJsx(file, source) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
}

function slice(source, node) {
  return source.slice(node.getStart(), node.getEnd());
}

/** useEffect cujo callback referencia contatosHydrateEpochRef + Cliente.get */
function extractHydrateEffectSource(painelSource) {
  const tree = parseJsx('PainelDinamicoCliente.jsx', painelSource);
  let found = null;
  const visit = (node) => {
    if (
      ts.isCallExpression(node)
      && node.expression.getText(tree) === 'useEffect'
      && node.arguments[0]
    ) {
      const argText = slice(painelSource, node.arguments[0]);
      if (argText.includes('contatosHydrateEpochRef') && argText.includes('Cliente.get')) {
        found = argText;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(found, 'useEffect real de hidratação Contatos deve existir');
  return found;
}

/** Corpo de persistContatosPainel (inclui epoch += 1 pós-save). */
function extractPersistContatosSource(painelSource) {
  const tree = parseJsx('PainelDinamicoCliente.jsx', painelSource);
  let found = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node)
      && node.name.getText(tree) === 'persistContatosPainel'
      && node.initializer
    ) {
      found = slice(painelSource, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(found, 'persistContatosPainel real deve existir');
  assert.match(found, /contatosHydrateEpochRef\.current\s*\+=\s*1/);
  return found;
}

/** handleSalvarContato real (result.skipped). */
function extractHandleSalvarContatoSource(formSource) {
  const tree = parseJsx('GerenciarContatosClienteForm.jsx', formSource);
  let found = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node)
      && node.name.getText(tree) === 'handleSalvarContato'
      && node.initializer
    ) {
      found = slice(formSource, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(found, 'handleSalvarContato real deve existir');
  assert.match(found, /result\.skipped/);
  return found;
}

/** resolveAuditEmpresaId real. */
function extractResolveAuditEmpresaIdSource(ctxSource) {
  const tree = parseJsx('useContextoVisual.jsx', ctxSource);
  let found = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node)
      && node.name.getText(tree) === 'resolveAuditEmpresaId'
      && node.initializer
    ) {
      found = `const resolveAuditEmpresaId = ${slice(ctxSource, node.initializer)}`;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(found, 'resolveAuditEmpresaId real deve existir');
  return found;
}

function compile(expr) {
  return ts.transpileModule(expr, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
}

/**
 * Harness: executa o useEffect real de hidratação + bump de epoch do persistContatosPainel real.
 * deps (base44/setState/seed) são stubs; a LÓGICA de epoch/cancel vem do source AST.
 */
function createRealHydrateHarness(painelSource) {
  const effectSrc = extractHydrateEffectSource(painelSource);
  const persistSrc = extractPersistContatosSource(painelSource);

  const contatosHydrateEpochRef = { current: 0 };
  const scalarContractLockedRef = { current: false };
  let contatosDraft = { nome: 'seed', canal: 'email' };
  let clienteLive = null;
  let getImpl = async () => null;

  const seedContatosPainelDraft = (fresh) => ({
    nome: fresh?.nome || fresh?.razao_social || '?',
    canal: fresh?.canal || 'email',
  });
  const usesContatosScalarHttpContract = () => false;
  const setContatosDraft = (v) => {
    contatosDraft = typeof v === 'function' ? v(contatosDraft) : v;
  };
  const setClienteLive = (v) => {
    clienteLive = typeof v === 'function' ? v(clienteLive) : v;
  };
  const base44 = {
    entities: {
      Cliente: {
        get: (...args) => getImpl(...args),
      },
    },
  };

  const sandbox = {
    contatosHydrateEpochRef,
    scalarContractLockedRef,
    setContatosDraft,
    setClienteLive,
    seedContatosPainelDraft,
    usesContatosScalarHttpContract,
    base44,
    isOpen: true,
    clienteProp: { id: 'cli-1', nome: 'seed', canal: 'email' },
    console,
  };

  // Effect real → função invocável
  const effectJs = compile(`(${effectSrc})`);
  const runEffect = vm.runInNewContext(effectJs, sandbox);

  // Extrai só o bump de epoch do persist real (mesmo statement do produto)
  assert.match(persistSrc, /contatosHydrateEpochRef\.current\s*\+=\s*1/);
  const bumpJs = compile(`(function bumpEpochAfterSave(){ contatosHydrateEpochRef.current += 1; })`);
  // Garante que o texto do bump veio do persist (não inventado à parte do arquivo)
  const bumpFromPersist = persistSrc.match(/contatosHydrateEpochRef\.current\s*\+=\s*1/)[0];
  const runBump = vm.runInNewContext(
    compile(`(function bumpEpochAfterSave(){ ${bumpFromPersist}; })`),
    { contatosHydrateEpochRef },
  );

  return {
    async openHydrate({ resolveWith, delayMs = 0 } = {}) {
      let resolveGet;
      const pending = new Promise((r) => { resolveGet = r; });
      getImpl = async () => {
        await pending;
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        return resolveWith;
      };
      const cleanup = runEffect();
      return {
        async completeGet() {
          resolveGet();
          // flush microtasks do async IIFE do effect
          await new Promise((r) => setImmediate(r));
          await new Promise((r) => setImmediate(r));
        },
        cleanup,
      };
    },
    afterSaveBump() {
      // Simula sucesso de persist: o produto faz exatamente este bump
      contatosDraft = { nome: 'salvo', canal: 'whatsapp' };
      runBump();
      return { draft: { ...contatosDraft }, epoch: contatosHydrateEpochRef.current };
    },
    getDraft: () => ({ ...contatosDraft }),
    getEpoch: () => contatosHydrateEpochRef.current,
  };
}

/**
 * Harness: executa handleSalvarContato REAL com estado mínimo injetado no closure via rewrite.
 * O body AST é o do form; guards skipped/reject são os do produto.
 */
function createRealFormSaveRunner(formSource) {
  const handlerSrc = extractHandleSalvarContatoSource(formSource);
  // handlerSrc is `async () => { ... }` — body real do form; bindings cobrem o closure do componente
  const bodyMatch = handlerSrc.match(/^async\s*\(\)\s*=>\s*\{([\s\S]*)\}\s*$/);
  assert.ok(bodyMatch, 'handleSalvarContato deve ser async arrow');
  const body = bodyMatch[1];
  const fnCode = compile(`
    async function runSave(__bindings) {
      const {
        podeEditar, bloqueado, assertScope, novoContato, contatos, contatoEditando,
        onChange, setSalvando, setDialogAberto, resetForm, toast
      } = __bindings;
      ${body}
    }
    module.exports = runSave;
  `);

  return async function runFormSave({ onChange, novoContato, contatos = [] }) {
    let dialogAberto = true;
    let formNome = novoContato?.nome ?? '';
    let salvando = false;
    let closed = false;
    let reset = false;
    const sandbox = {
      module: { exports: {} },
      exports: {},
      console,
    };
    vm.runInNewContext(fnCode, sandbox);
    const runSave = sandbox.module.exports;
    const bindings = {
      podeEditar: true,
      bloqueado: false,
      assertScope: () => {},
      novoContato,
      contatos,
      contatoEditando: null,
      onChange,
      setSalvando: (v) => { salvando = v; },
      setDialogAberto: (v) => {
        dialogAberto = v;
        if (v === false) closed = true;
      },
      resetForm: () => {
        formNome = '';
        reset = true;
      },
      toast: { error() {}, success() {} },
    };
    await runSave(bindings);
    return { dialogAberto, formNome, salvando, closed, reset };
  };
}

function mutateDisableEpochGuard(painelSource) {
  // Mesma mutação Codex: desabilita comparação epoch sem apagar nomes/regex finais
  const mutated = painelSource.replace(
    /epoch\s*!==\s*contatosHydrateEpochRef\.current/g,
    'false && epoch !== contatosHydrateEpochRef.current',
  );
  assert.notEqual(mutated, painelSource, 'mutação epoch deve alterar o source');
  return mutated;
}

function mutateDisableSkippedGuard(formSource) {
  const mutated = formSource.replace(
    /if\s*\(\s*result\s*&&\s*typeof\s*result\s*===\s*['"]object['"]\s*&&\s*result\.skipped\s*\)/g,
    'if (false && result && typeof result === \'object\' && result.skipped)',
  );
  assert.notEqual(mutated, formSource, 'mutação skipped deve alterar o source');
  return mutated;
}

test('#424 seam: GET tardio após save NÃO sobrescreve rascunho confirmado (epoch) — callback real', async () => {
  const painel = read(painelPath);
  const harness = createRealHydrateHarness(painel);
  const opening = await harness.openHydrate({
    resolveWith: { id: 'cli-1', nome: 'STALE_GET', canal: 'telefone' },
  });
  const after = harness.afterSaveBump();
  assert.equal(after.draft.nome, 'salvo');
  assert.equal(after.draft.canal, 'whatsapp');
  await opening.completeGet();
  assert.deepEqual(harness.getDraft(), { nome: 'salvo', canal: 'whatsapp' }, 'resposta tardia descartada pelo epoch real');

  // Mutação: desabilitar guard epoch → GET tardio SOBRESCREVE (deve falhar a asserção de preservação)
  const mutated = mutateDisableEpochGuard(painel);
  const bad = createRealHydrateHarness(mutated);
  const open2 = await bad.openHydrate({
    resolveWith: { id: 'cli-1', nome: 'STALE_GET', canal: 'telefone' },
  });
  bad.afterSaveBump();
  await open2.completeGet();
  assert.notDeepEqual(
    bad.getDraft(),
    { nome: 'salvo', canal: 'whatsapp' },
    'mutação epoch detectada: GET tardio passou a aplicar (cobertura real)',
  );
});

test('#424 seam: mutação concorrente (segundo save) invalida GET da abertura anterior — effect real', async () => {
  const painel = read(painelPath);
  const harness = createRealHydrateHarness(painel);
  const first = await harness.openHydrate({
    resolveWith: { id: 'cli-1', nome: 'from-first-open', canal: 'x' },
  });
  harness.afterSaveBump();
  const second = await harness.openHydrate({
    resolveWith: { id: 'cli-1', nome: 'from-second-open', canal: 'y' },
  });
  harness.afterSaveBump();
  await first.completeGet();
  await second.completeGet();
  assert.deepEqual(harness.getDraft(), { nome: 'salvo', canal: 'whatsapp' });
});

test('#424 seam: rejeição escalar (Promise.reject) preserva diálogo e rascunho — handleSalvarContato real', async () => {
  const form = read(formPath);
  const run = createRealFormSaveRunner(form);
  const previousDraftName = 'Rascunho Operador';
  const out = await run({
    onChange: () => Promise.reject(new Error('escalar conflict')),
    novoContato: { nome: previousDraftName, tipo: 'E-mail', valor: 'a@b.c', principal: true },
  });
  assert.equal(out.dialogAberto, true);
  assert.equal(out.formNome, previousDraftName);
  assert.equal(out.salvando, false);
  assert.equal(out.closed, false);
  assert.equal(out.reset, false);
});

test('#424 seam: result.skipped legado NÃO fecha/reseta — handleSalvarContato real', async () => {
  const form = read(formPath);
  const run = createRealFormSaveRunner(form);
  const out = await run({
    onChange: async () => ({ skipped: true, message: 'legado skipped', lista: [] }),
    novoContato: { nome: 'Manter', tipo: 'Telefone', valor: '11999999999', principal: false },
  });
  assert.equal(out.dialogAberto, true, 'skipped não fecha diálogo');
  assert.equal(out.formNome, 'Manter');
  assert.equal(out.salvando, false);
  assert.equal(out.reset, false);

  // Mutação: desabilitar guard skipped → formulário fecha/reseta
  const mutated = mutateDisableSkippedGuard(form);
  const runBad = createRealFormSaveRunner(mutated);
  const bad = await runBad({
    onChange: async () => ({ skipped: true, message: 'legado skipped', lista: [] }),
    novoContato: { nome: 'Manter', tipo: 'Telefone', valor: '11999999999', principal: false },
  });
  assert.equal(bad.dialogAberto, false, 'mutação skipped detectada: diálogo fechou');
  assert.equal(bad.reset, true, 'mutação skipped detectada: form resetou');
});

test('#424 seam: resolveAuditEmpresaId — group_id de carimbo NÃO vira empresa_id (AST real)', async () => {
  const src = read(ctxPath);
  const fnSrc = extractResolveAuditEmpresaIdSource(src);
  const sandbox = {
    contextoCanonico: { scopeType: 'grupo', empresaId: null },
    filtroEmpresa: null,
  };
  vm.runInNewContext(`${compile(fnSrc)}; this.resolveAuditEmpresaId = resolveAuditEmpresaId;`, sandbox);

  const stampedGroupOnly = { group_id: 'G-GRP', contatos: [] };
  const before = { group_id: 'G-GRP', empresa_id: 'E-KEEP' };
  assert.equal(
    sandbox.resolveAuditEmpresaId(stampedGroupOnly, before, 'group_id'),
    'E-KEEP',
    'preserva empresa_id do before; não usa group_id',
  );
  assert.equal(
    sandbox.resolveAuditEmpresaId({ group_id: 'G-GRP', empresa_id: 'E-NEW' }, before, 'group_id'),
    'E-NEW',
  );
  sandbox.contextoCanonico = { scopeType: 'empresa', empresaId: 'E-CTX' };
  assert.equal(
    sandbox.resolveAuditEmpresaId({ group_id: 'G-ONLY' }, null, 'group_id'),
    'E-CTX',
  );
  sandbox.contextoCanonico = { scopeType: 'grupo', empresaId: null };
  sandbox.filtroEmpresa = 'E-FILTRO';
  assert.equal(
    sandbox.resolveAuditEmpresaId({ group_id: 'G-ONLY' }, null, 'group_id'),
    'E-FILTRO',
  );
  sandbox.filtroEmpresa = 'todas';
  assert.equal(
    sandbox.resolveAuditEmpresaId({ group_id: 'G-ONLY' }, null, 'group_id'),
    null,
    'sem empresa explícita → null (fail-closed), nunca group_id',
  );
});

test('#424 fonte tip: epoch bump + reject + resolveAuditEmpresaId presentes (contrato AST)', async () => {
  const painel = read(painelPath);
  const form = read(formPath);
  const ctx = read(ctxPath);
  extractHydrateEffectSource(painel);
  extractPersistContatosSource(painel);
  extractHandleSalvarContatoSource(form);
  extractResolveAuditEmpresaIdSource(ctx);
  assert.match(painel, /contatosHydrateEpochRef\.current \+= 1/);
  assert.match(painel, /return Promise\.reject\(error\)/);
  assert.match(form, /result\.skipped/);
  assert.match(ctx, /resolveAuditEmpresaId/);
  assert.equal(typeof ts.createSourceFile, 'function');
});
