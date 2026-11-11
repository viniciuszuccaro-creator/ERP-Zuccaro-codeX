/**
 * #591 — Relatórios Representantes/Personalizado: triggers fail-closed sob loading.
 * Recuperação vs erp-integra: abas já existem; grant exato ≠ módulo amplo.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/Relatorios.jsx', 'utf8');
const hook = readFileSync('src/components/relatorios/useSecureReport.js', 'utf8');

test('hasReportGrant: grant exato (comentário + implementação fail-closed)', () => {
  assert.match(hook, /Report grants are exact: broad module\/admin fallbacks do not grant sensitive reports/);
  assert.match(hook, /export function hasReportGrant\(profile,moduleName,section,action\)/);
  assert.match(hook, /if \(!profile \|\| profile\.ativo === false\) return false/);
  assert.match(hook, /permissionNodeAllows\(node,action\)/);
});

test('Relatorios.jsx: abas Representantes/Personalizado fail-closed sob permissionsLoading', () => {
  assert.match(page, /!permissionsLoading && hasReportGrant\(perfilAcesso,'Comercial','Representantes','visualizar'\)/);
  assert.match(page, /!permissionsLoading && hasReportGrant\(perfilAcesso,'Relatorios','Personalizado','visualizar'\)/);
  assert.match(page, /data-permission="Comercial\.Representantes\.visualizar"/);
  assert.match(page, /data-permission="Relatorios\.Personalizado\.visualizar"/);
  assert.match(page, /DashboardRepresentantes/);
  assert.match(page, /RelatorioPersonalizado/);
});
