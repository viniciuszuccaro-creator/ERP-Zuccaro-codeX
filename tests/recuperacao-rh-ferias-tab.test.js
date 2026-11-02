/**
 * Recuperação RH Férias: stub decorativo → FeriasTab canônico (Form + contexto).
 * Classificação: funcionalidade recuperada (não registros).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('RH Férias monta FeriasTab (não stub "em desenvolvimento")', () => {
  const rh = read('src/pages/RH.jsx');
  assert.match(rh, /lazy\(\(\)\s*=>\s*import\(["']\.\.\/components\/rh\/FeriasTab["']\)\)/);
  assert.match(rh, /component:\s*FeriasTab/);
  assert.match(rh, /windowMode:\s*true/);
  assert.doesNotMatch(rh, /Gestão de Férias \(em desenvolvimento\)/);
});

test('FeriasTab: multiempresa + RBAC fail-closed + reutiliza FeriasForm', () => {
  const tab = read('src/components/rh/FeriasTab.jsx');
  assert.match(tab, /from ["']@\/components\/rh\/FeriasForm["']/);
  assert.match(tab, /createInContext\(["']Ferias["']/);
  assert.match(tab, /updateInContext\(["']Ferias["']/);
  assert.match(tab, /filterInContext\(["']Ferias["']/);
  assert.match(tab, /queryKey:\s*\[["']ferias-tab["'],\s*scopeKey\]/);
  assert.match(tab, /canApprove\(["']RH["']/);
  assert.match(tab, /data-permission=["']RH\.Férias\.aprovar["']/);
  assert.match(tab, /from-sky-50 to-sky-100/);
  assert.match(tab, /Sem contexto de grupo/);
  assert.doesNotMatch(tab, /count\s*\+\s*1/);
});

test('FeriasForm: windowMode sky chrome preservado', () => {
  const form = read('src/components/rh/FeriasForm.jsx');
  assert.match(form, /from-sky-50 to-sky-100/);
  assert.match(form, /windowMode/);
});

test('Auditoria contextual mapeia Ferias → módulo RH', () => {
  const ctx = read('src/components/lib/useContextoVisual.jsx');
  assert.match(ctx, /Ferias:\s*['"]RH['"]/);
});
