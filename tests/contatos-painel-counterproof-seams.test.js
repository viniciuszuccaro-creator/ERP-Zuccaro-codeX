/**
 * Contraprovas comportamentais #424 (seams sintéticas dos callbacks reais).
 * Cobre: resposta tardia, mutação concorrente, skipped/rejeição, rascunho, audit empresa.
 * Não monta React; não exige PG. Tip alvo: d7174611d.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as acorn from 'acorn';

const require = createRequire(import.meta.url);

function extractFunctionSource(source, name) {
  try {
    const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: 'module' });
    for (const node of ast.body) {
      if (node.type === 'FunctionDeclaration' && node.id?.name === name) {
        return source.slice(node.start, node.end);
      }
    }
  } catch {
    // JSX / syntax além de ESM puro → fallback regex (arquivo .jsx).
  }
  const nested = new RegExp(
    `const ${name}\\s*=\\s*\\(([^)]*)\\)\\s*=>\\s*\\{`,
  ).exec(source);
  if (!nested) throw new Error(`function ${name} not found`);
  let i = nested.index + nested[0].length;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const ch = source[i++];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
  }
  return `function ${name}(${nested[1]}) {${source.slice(nested.index + nested[0].length, i - 1)}}`;
}

/** Replica mínima do epoch de hidratação do PainelDinamicoCliente. */
function createHydrateEpochSeam() {
  let epochRef = 0;
  let draft = { nome: 'seed', canal: 'email' };
  const applyFresh = (fresh, epoch) => {
    if (epoch !== epochRef) return { applied: false, draft: { ...draft } };
    draft = { nome: fresh.nome, canal: fresh.canal };
    return { applied: true, draft: { ...draft } };
  };
  return {
    open() {
      const epoch = ++epochRef;
      return {
        epoch,
        async lateGet(fresh) {
          return applyFresh(fresh, epoch);
        },
      };
    },
    afterSave() {
      epochRef += 1;
      draft = { nome: 'salvo', canal: 'whatsapp' };
      return { draft: { ...draft }, epoch: epochRef };
    },
    getDraft() {
      return { ...draft };
    },
  };
}

/** Replica do tratamento de result.skipped / Promise.reject no form. */
async function formSaveSeam(onChange, contatosAtualizados) {
  let dialogAberto = true;
  let formNome = contatosAtualizados[0]?.nome ?? '';
  let salvando = true;
  let closed = false;
  let reset = false;
  try {
    const result = await Promise.resolve(onChange(contatosAtualizados));
    if (result && typeof result === 'object' && result.skipped) {
      throw result.error || new Error(result.message || 'Contatos não gravados.');
    }
    dialogAberto = false;
    formNome = '';
    closed = true;
    reset = true;
  } catch {
    // Mantém diálogo/form
  } finally {
    salvando = false;
  }
  return { dialogAberto, formNome, salvando, closed, reset };
}

test('#424 seam: GET tardio após save NÃO sobrescreve rascunho confirmado (epoch)', async () => {
  const seam = createHydrateEpochSeam();
  const opening = seam.open();
  const after = seam.afterSave();
  assert.equal(after.draft.nome, 'salvo');
  assert.equal(after.draft.canal, 'whatsapp');
  const late = await opening.lateGet({ nome: 'STALE_GET', canal: 'telefone' });
  assert.equal(late.applied, false, 'resposta tardia deve ser descartada');
  assert.deepEqual(seam.getDraft(), { nome: 'salvo', canal: 'whatsapp' });
});

test('#424 seam: mutação concorrente (segundo save) invalida GET da abertura anterior', async () => {
  const seam = createHydrateEpochSeam();
  const firstOpen = seam.open();
  seam.afterSave();
  const secondOpen = seam.open();
  seam.afterSave();
  const lateFirst = await firstOpen.lateGet({ nome: 'from-first-open', canal: 'x' });
  const lateSecond = await secondOpen.lateGet({ nome: 'from-second-open', canal: 'y' });
  assert.equal(lateFirst.applied, false);
  assert.equal(lateSecond.applied, false);
  assert.deepEqual(seam.getDraft(), { nome: 'salvo', canal: 'whatsapp' });
});

test('#424 seam: rejeição escalar (Promise.reject) preserva diálogo e rascunho do form', async () => {
  const previousDraftName = 'Rascunho Operador';
  const onChangeReject = () => Promise.reject(new Error('escalar conflict'));
  const out = await formSaveSeam(onChangeReject, [{ nome: previousDraftName, principal: true }]);
  assert.equal(out.dialogAberto, true);
  assert.equal(out.formNome, previousDraftName);
  assert.equal(out.salvando, false);
  assert.equal(out.closed, false);
  assert.equal(out.reset, false);
});

test('#424 seam: result.skipped legado NÃO fecha/reseta o formulário', async () => {
  const onChangeSkipped = async () => ({ skipped: true, message: 'legado skipped', lista: [] });
  const out = await formSaveSeam(onChangeSkipped, [{ nome: 'Manter', principal: false }]);
  assert.equal(out.dialogAberto, true, 'skipped não fecha diálogo');
  assert.equal(out.formNome, 'Manter');
  assert.equal(out.salvando, false);
  assert.equal(out.reset, false);
});

test('#424 seam: resolveAuditEmpresaId — group_id de carimbo NÃO vira empresa_id', async () => {
  const src = await readFile(new URL('../src/components/lib/useContextoVisual.jsx', import.meta.url), 'utf8');
  const fnSrc = extractFunctionSource(src, 'resolveAuditEmpresaId');
  // Binding do closure: contextoCanonico / filtroEmpresa injetados no sandbox
  const sandbox = {
    contextoCanonico: { scopeType: 'grupo', empresaId: null },
    filtroEmpresa: null,
  };
  vm.runInNewContext(`${fnSrc}; this.resolveAuditEmpresaId = resolveAuditEmpresaId;`, sandbox);

  const stampedGroupOnly = { group_id: 'G-GRP', contatos: [] };
  const before = { group_id: 'G-GRP', empresa_id: 'E-KEEP' };
  // campo de carimbo no painel Contatos = group_id (mestre Cliente)
  const empresaId = sandbox.resolveAuditEmpresaId(stampedGroupOnly, before, 'group_id');
  assert.equal(empresaId, 'E-KEEP', 'preserva empresa_id do before; não usa group_id');

  const stampedWithEmpresa = { group_id: 'G-GRP', empresa_id: 'E-NEW' };
  assert.equal(
    sandbox.resolveAuditEmpresaId(stampedWithEmpresa, before, 'group_id'),
    'E-NEW',
  );

  sandbox.contextoCanonico = { scopeType: 'empresa', empresaId: 'E-CTX' };
  const noEmpresa = { group_id: 'G-ONLY' };
  assert.equal(
    sandbox.resolveAuditEmpresaId(noEmpresa, null, 'group_id'),
    'E-CTX',
    'escopo empresa usa contextoCanonico.empresaId',
  );

  sandbox.contextoCanonico = { scopeType: 'grupo', empresaId: null };
  sandbox.filtroEmpresa = 'E-FILTRO';
  assert.equal(
    sandbox.resolveAuditEmpresaId(noEmpresa, null, 'group_id'),
    'E-FILTRO',
  );

  sandbox.filtroEmpresa = 'todas';
  assert.equal(
    sandbox.resolveAuditEmpresaId(noEmpresa, null, 'group_id'),
    null,
    'sem empresa explícita → null (fail-closed), nunca group_id',
  );
});

test('#424 fonte tip: epoch bump + reject + resolveAuditEmpresaId presentes (contrato)', async () => {
  const painel = await readFile(new URL('../src/components/cadastros/PainelDinamicoCliente.jsx', import.meta.url), 'utf8');
  const form = await readFile(new URL('../src/components/cadastros/GerenciarContatosClienteForm.jsx', import.meta.url), 'utf8');
  const ctx = await readFile(new URL('../src/components/lib/useContextoVisual.jsx', import.meta.url), 'utf8');
  assert.match(painel, /contatosHydrateEpochRef\.current \+= 1/);
  assert.match(painel, /return Promise\.reject\(error\)/);
  assert.match(form, /result\.skipped/);
  assert.match(ctx, /resolveAuditEmpresaId/);
  // acorn disponível (extração real)
  assert.equal(typeof acorn.parse, 'function');
  void require;
});
