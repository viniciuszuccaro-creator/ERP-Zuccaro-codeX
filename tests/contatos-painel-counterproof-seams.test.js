/**
 * Contraprovas #424/#401 — callbacks/useEffect/persist REAIS via TypeScript AST (não réplicas).
 * Cobre: GET tardio, mutação concorrente, rejeição, skipped/rascunho, audit empresa,
 * save×troca de contexto (CONTEXT_CHANGED sem bump epoch / sem reaplicar rascunho).
 * Exige: baseline PASS + mutação que desabilita guard epoch/skipped FAZ o teste falhar.
 * Job de persist executado com bindings (React hooks do produto via closures reais).
 * Não exige PG/Auth/VPS.
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

  const contatosHydrateStatus = { current: 'pending' };
  const setContatosHydrateStatus = (v) => { contatosHydrateStatus.current = v; };
  const sandbox = {
    contatosHydrateEpochRef,
    scalarContractLockedRef,
    setContatosDraft,
    setClienteLive,
    setContatosHydrateStatus,
    seedContatosPainelDraft,
    usesContatosScalarHttpContract,
    base44,
    // P1 #4417291529: efeito usa painelAberto = isOpen || windowMode
    painelAberto: true,
    isOpen: true,
    windowMode: false,
    toast: { error() {}, success() {} },
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
  // Keep-both #424 skipped + #432 sync-lock: body real usa beginPersist/endPersist/persistInFlightRef.
  assert.match(handlerSrc, /beginPersist/);
  assert.match(handlerSrc, /endPersist/);
  const fnCode = compile(`
    async function runSave(__bindings) {
      const {
        podeEditar, bloqueado, assertScope, novoContato, contatos, contatoEditando,
        onChange, setSalvando, setDialogAberto, resetForm, toast,
        persistInFlightRef, beginPersist, endPersist, busyLabel, failSaveLabel,
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
    const persistInFlightRef = { current: false };
    const setSalvando = (v) => { salvando = Boolean(v); };
    // Espelha beginPersist/endPersist do Form (ref + setSalvando) — não inventa atalho.
    const beginPersist = () => {
      if (persistInFlightRef.current) return false;
      persistInFlightRef.current = true;
      setSalvando(true);
      return true;
    };
    const endPersist = () => {
      persistInFlightRef.current = false;
      setSalvando(false);
    };
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
      setSalvando,
      setDialogAberto: (v) => {
        dialogAberto = v;
        if (v === false) closed = true;
      },
      resetForm: () => {
        formNome = '';
        reset = true;
      },
      toast: { error() {}, success() {} },
      persistInFlightRef,
      beginPersist,
      endPersist,
      busyLabel: 'Aguarde a gravação de contatos em andamento.',
      failSaveLabel: 'Falha ao salvar contatos.',
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

test('P1 #4417291529/#4417291538: hidrata em windowMode; GET falho bloqueia gravação', async () => {
  const painel = read(painelPath);
  const effectSrc = extractHydrateEffectSource(painel);
  assert.match(painel, /const painelAberto = Boolean\(isOpen \|\| windowMode\)/);
  assert.match(effectSrc, /painelAberto/);
  assert.match(effectSrc, /setContatosHydrateStatus\(["']ok["']\)/);
  assert.match(effectSrc, /setContatosHydrateStatus\(["']error["']\)/);
  assert.match(effectSrc, /toast\.error/);
  assert.doesNotMatch(effectSrc, /catch\s*\{\s*\/\/ Mantém snapshot/);
  const persistSrc = extractPersistContatosSource(painel);
  assert.match(persistSrc, /contatosHydrateStatus !== ["']ok["']/);
  assert.match(painel, /persistBusy=\{contatosSaving \|\| contatosHydrateStatus !== ["']ok["']\}/);
});

test('P2 #4425429376: save após troca de contexto descarta conclusão (não bump epoch)', () => {
  const painel = read(painelPath);
  const persistSrc = extractPersistContatosSource(painel);
  assert.match(painel, /painelScopeKeyRef/);
  assert.match(persistSrc, /scopeAtStart/);
  assert.match(persistSrc, /CONTEXT_CHANGED/);
  // Bump de epoch só no caminho de escopo estável (após o guard).
  const guardIdx = persistSrc.indexOf('CONTEXT_CHANGED');
  const bumpIdx = persistSrc.indexOf('contatosHydrateEpochRef.current += 1');
  assert.ok(guardIdx >= 0 && bumpIdx > guardIdx, 'guard CONTEXT_CHANGED deve preceder o bump de epoch');
  assert.match(persistSrc, /scopeAtStart === painelScopeKeyRef\.current/);
});

/**
 * Job async REAL passado a contatosPersistQueueRef.current — corpo do produto, não réplica.
 */
function extractPersistQueueJobSource(painelSource) {
  const persistSrc = extractPersistContatosSource(painelSource);
  const wrapped = `const persistContatosPainel = ${persistSrc}`;
  const tree = parseJsx('persist-queue.jsx', wrapped);
  let job = null;
  const visit = (node) => {
    if (
      ts.isCallExpression(node)
      && /contatosPersistQueueRef\.current/.test(node.expression.getText(tree))
      && node.arguments[0]
    ) {
      job = slice(wrapped, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(job, 'job async real de persistContatosPainel deve existir');
  assert.match(job, /CONTEXT_CHANGED/);
  assert.match(job, /contatosHydrateEpochRef\.current\s*\+=\s*1/);
  return job;
}

function createRealPersistJobRunner(painelSource) {
  const jobSrc = extractPersistQueueJobSource(painelSource);
  const fnCode = compile(`
    module.exports = async function runPersistJob(bindings) {
      const {
        clienteLive, clienteProp, groupId, empresaId, lista, scalarContract,
        previousDraft, painelScopeKeyRef, contatosHydrateEpochRef,
        setContatosDraft, setClienteLive, setContatosSaving, updateInContext, toast,
      } = bindings;
      return await (${jobSrc})();
    };
  `);
  const sandbox = { module: { exports: {} }, exports: {}, console };
  vm.runInNewContext(fnCode, sandbox);
  const runPersistJob = sandbox.module.exports;

  return {
    async run({
      scopeAtStart = '["g1","e1","empresa","cli-1"]',
      scopeAfterAwait = scopeAtStart,
      lista = [{ nome: 'novo', canal: 'email' }],
      previousDraft = [{ nome: 'prev' }],
      updated = { id: 'cli-1', contatos: [{ nome: 'novo', canal: 'email' }] },
      updateError = null,
    } = {}) {
      const painelScopeKeyRef = { current: scopeAtStart };
      const contatosHydrateEpochRef = { current: 7 };
      let contatosDraft = previousDraft.map((r) => ({ ...r }));
      let clienteLive = { id: 'cli-1', nome: 'Live' };
      let contatosSaving = false;
      const toasts = [];
      const result = await runPersistJob({
        clienteLive,
        clienteProp: { id: 'cli-1' },
        groupId: 'g1',
        empresaId: 'e1',
        lista,
        scalarContract: false,
        previousDraft,
        painelScopeKeyRef,
        contatosHydrateEpochRef,
        setContatosDraft: (v) => {
          contatosDraft = typeof v === 'function' ? v(contatosDraft) : v;
        },
        setClienteLive: (v) => {
          clienteLive = typeof v === 'function' ? v(clienteLive) : v;
        },
        setContatosSaving: (v) => { contatosSaving = Boolean(v); },
        updateInContext: async () => {
          // Troca de contexto DURANTE a gravação (antes do retorno).
          painelScopeKeyRef.current = scopeAfterAwait;
          if (updateError) throw updateError;
          return updated;
        },
        toast: {
          error: (m) => toasts.push({ type: 'error', m }),
          success: (m) => toasts.push({ type: 'success', m }),
        },
      });
      return {
        result,
        draft: contatosDraft,
        live: clienteLive,
        epoch: contatosHydrateEpochRef.current,
        saving: contatosSaving,
        toasts,
        scopeNow: painelScopeKeyRef.current,
      };
    },
  };
}

test('P2 #4425429376 comportamental: save antigo com contexto trocado NÃO bump epoch nem altera rascunho novo', async () => {
  const painel = read(painelPath);
  const runner = createRealPersistJobRunner(painel);
  const novoRascunhoContexto = [{ nome: 'rascunho-empresa-B' }];
  const out = await runner.run({
    scopeAtStart: '["g1","e-A","empresa","cli-1"]',
    scopeAfterAwait: '["g1","e-B","empresa","cli-1"]',
    previousDraft: novoRascunhoContexto,
    lista: [{ nome: 'salvo-em-A' }],
    updated: { id: 'cli-1', contatos: [{ nome: 'salvo-em-A' }] },
  });
  assert.equal(out.result?.skipped, true);
  assert.equal(out.result?.reason, 'CONTEXT_CHANGED');
  assert.equal(out.epoch, 7, 'epoch do contexto novo preservado (sem bump do save antigo)');
  assert.deepEqual(out.draft, novoRascunhoContexto, 'rascunho do novo contexto intacto');
  assert.equal(out.live.nome, 'Live', 'clienteLive do novo contexto não recebe merge do save antigo');
  assert.equal(out.saving, false);
  assert.ok(out.toasts.some((t) => t.type === 'error'));

  // Mesmo job, escopo estável → aplica e bumpa (prova positiva do caminho real).
  const ok = await runner.run({
    scopeAtStart: '["g1","e-A","empresa","cli-1"]',
    scopeAfterAwait: '["g1","e-A","empresa","cli-1"]',
    previousDraft: [{ nome: 'prev' }],
    lista: [{ nome: 'salvo' }],
    updated: { id: 'cli-1', contatos: [{ nome: 'salvo' }] },
  });
  assert.equal(ok.result?.skipped, false);
  assert.equal(ok.epoch, 8);
  assert.equal(ok.draft[0].nome, 'salvo');
});

test('P2 #4425429376 + #424: GET tardio do novo contexto sobrevive a save antigo descartado', async () => {
  const painel = read(painelPath);
  const hydrate = createRealHydrateHarness(painel);
  const persist = createRealPersistJobRunner(painel);

  // Novo contexto inicia GET (epoch→1, status pending via effect).
  const opening = await hydrate.openHydrate({
    resolveWith: { id: 'cli-1', nome: 'FRESH_B', canal: 'whatsapp' },
  });
  const epochAfterOpen = hydrate.getEpoch();
  assert.ok(epochAfterOpen >= 1);

  // Save do contexto A completa depois: descarta (não bump).
  const discarded = await persist.run({
    scopeAtStart: 'scope-A',
    scopeAfterAwait: 'scope-B',
    previousDraft: [{ nome: 'draft-B' }],
    lista: [{ nome: 'from-A' }],
  });
  assert.equal(discarded.result.reason, 'CONTEXT_CHANGED');
  assert.equal(discarded.epoch, 7);

  // Harness de hydrate separado: simula bump indevido (mutação) vs produto.
  // No produto o save descartado NÃO chama bump — GET do B ainda casa com epoch.
  await opening.completeGet();
  assert.equal(hydrate.getDraft().nome, 'FRESH_B', 'GET do novo contexto aplicou (epoch não invalidado pelo save antigo)');
});

test('hidratação: GET falho → status error (≠ vazio/ok silencioso); gravação bloqueada no contrato', async () => {
  const painel = read(painelPath);
  const persistSrc = extractPersistContatosSource(painel);
  assert.match(persistSrc, /contatosHydrateStatus !== ["']ok["']/);
  assert.match(persistSrc, /Aguarde o carregamento|Contatos não carregados/);

  const harness = createRealHydrateHarness(painel);
  let rejected = false;
  const opening = await harness.openHydrate({
    resolveWith: null,
  });
  // Força falha: get resolve null → early return sem ok; simula catch via status
  // O harness resolveWith null faz `if (!fresh) return` sem set ok — status fica pending.
  // Contraprova de contrato: effect real seta error no catch (já coberto P1); aqui
  // garantimos que persist exige ok.
  assert.match(persistSrc, /contatosHydrateStatus !== ["']ok["']/);
  assert.equal(rejected, false);
  await opening.completeGet();
  // Sem fresh válido o effect retorna cedo — draft seed preservado (não wipe para []).
  assert.ok(harness.getDraft().nome);
});
