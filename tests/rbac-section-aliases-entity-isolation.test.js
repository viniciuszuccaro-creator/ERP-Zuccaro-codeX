import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Security MEDIUM: SECTION_ALIASES entidade→seção não pode DFS-herdar grant de irmãos.
 * Pin: resolução prefer filho da entidade; sem filho → ownOnly (sem DFS).
 */
test('usePermissions: entity→section alias is ownOnly (no sibling DFS fail-open)', () => {
  const src = readFileSync('src/components/lib/usePermissions.jsx', 'utf8');
  assert.match(src, /ownOnly/);
  assert.match(src, /nodeHasOwnAction/);
  assert.match(src, /Sem nó da entidade: só grants do próprio nó seção/);
  assert.match(src, /Preferir filho com o nome da entidade sob a seção owner/);
  assert.match(src, /resolved\.ownOnly\s*\?\s*nodeHasOwnAction/);
  // Bugbot: ownOnly NÃO inspeciona Object.values (arrays filhos = irmãos).
  assert.match(src, /const nodeHasOwnAction = \(node, desired\) => actionMatches\(node, desired\);/);
  assert.doesNotMatch(src, /nodeHasOwnAction[\s\S]*Object\.values\(node\)\.some/);
  // Não reintroduzir getNodeByPath que retorna só o cursor sem ownOnly no hasPermission vivo.
  assert.doesNotMatch(src, /let cursor = getNodeByPath\(modNode, path\);\s*if \(cursor == null\) return false;\s*return nodeHasAction\(cursor/);
});

test('Gerenciar: catalogBlocksMutations só loading/failed/denied (unknown não bloqueia pin RBAC)', () => {
  const src = readFileSync('src/components/cadastros/GerenciarEnderecosClienteForm.jsx', 'utf8');
  assert.match(src, /catalogBlocksMutations = loadStatus === "loading"\s*\|\| loadStatus === "failed"\s*\|\| loadStatus === "denied"/);
  assert.doesNotMatch(src, /disabled=\{bloqueado \|\| !podeEditar \|\| !countKnown\}/);
  assert.match(src, /disabled=\{bloqueado \|\| !podeEditar \|\| catalogBlocksMutations\}/);
});
