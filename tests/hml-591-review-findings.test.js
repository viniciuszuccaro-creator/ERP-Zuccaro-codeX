/**
 * Achados revisão 6694327032 / Codex sobre tip 3fc45c320 — contraprovas do delta #591.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fetchCadastrosAllCounts,
  isValidCountValue,
} from '../src/components/cadastros/hooks/cadastrosAllCountsCore.js';
import { canFallbackConfigToLocalEntity } from '../src/components/lib/configPersistPolicy.js';

const clientTs = readFileSync('server/src/db/client.ts', 'utf8');
const authSession = readFileSync('server/src/services/authSessionService.ts', 'utf8');
const fornecedor = readFileSync('server/src/services/fornecedorService.ts', 'utf8');
const base44 = readFileSync('src/api/base44Client.js', 'utf8');
const entityCounts = readFileSync('src/components/lib/useEntityCounts.jsx', 'utf8');
const badge = readFileSync('src/components/cadastros/CountBadgeSimplificado.jsx', 'utf8');

test('port f51376fa: URL Auth idêntica compartilha pool; socket NULL não compara address', () => {
  assert.match(clientTs, /sharedAuthPool/);
  assert.match(clientTs, /authDatabaseUrl === config\.databaseUrl/);
  assert.match(clientTs, /!sharedAuthPool && \(!row\.address/);
  assert.match(clientTs, /authDb && authDb !== db/);
});

test('port 2f588154: Grupo não exige role admin — só empresaId null + permissão', () => {
  assert.match(authSession, /if \(profile\.empresaId !== null\) return false;/);
  assert.doesNotMatch(authSession, /profile\.role !== 'admin'/);
});

test('port 9b5de2bc: Fornecedor congela ctx antes de await', () => {
  assert.match(fornecedor, /async importar\(ctx[\s\S]*?ctx = Object\.freeze\(\{ \.\.\.ctx \}\)/);
  assert.match(fornecedor, /async get\(ctx[\s\S]*?ctx = Object\.freeze\(\{ \.\.\.ctx \}\)/);
  assert.match(fornecedor, /async softDelete\(ctx[\s\S]*?ctx = Object\.freeze\(\{ \.\.\.ctx \}\)/);
});

test('HTTP: upsertConfig não despacha para localBase44', () => {
  assert.match(base44, /UPSERT_CONFIG_HTTP_UNAVAILABLE/);
  assert.match(base44, /if \(name === 'upsertConfig'\)/);
  assert.equal(canFallbackConfigToLocalEntity({ httpMode: true, localOnly: false }), false);
  assert.equal(canFallbackConfigToLocalEntity({ httpMode: false, localOnly: true }), true);
});

test('useEntityCounts: parcial marca unavailable e total null', () => {
  assert.match(entityCounts, /countsUnavailable: Boolean\(isError\) \|\| \(!isLoading && normalized\.length > 0 && !complete\)/);
  assert.match(entityCounts, /if \(!complete\) return null;/);
});

test('CountBadge: chave ausente / missing → — ≠ 0', () => {
  assert.match(badge, /state === 'unavailable' \? \([\s\S]*?—/);
  assert.match(badge, /missingSet\.has\(e\)/);
  assert.match(badge, /data-count-state=\{state\}/);
});

test('fatia counts:{} não pula isolamento — consulta entidades ausentes', async () => {
  const calls = [];
  const invoke = async (name, body) => {
    assert.equal(name, 'countEntities');
    calls.push(body);
    const entities = body.entities || [];
    if (entities.length > 1) {
      // Fatia “sucesso” vazia — regressão Codex.
      return { data: { counts: {} } };
    }
    const entityName = entities[0].entityName;
    if (entityName === 'Produto') return { data: { counts: { Produto: 5 } } };
    throw new Error(`${entityName} 500`);
  };
  await assert.rejects(
    () => fetchCadastrosAllCounts({
      invoke,
      empresaId: '00000000-0000-4000-8000-000000000001',
      groupId: '00000000-0000-4000-8000-000000000099',
      entities: ['Produto', 'Marca'],
    }),
    (err) => err?.code === 'READ_COUNT_PARTIAL'
      && err.partialCounts?.Produto === 5
      && Array.isArray(err.missing)
      && err.missing.includes('Marca'),
  );
  assert.ok(calls.some((c) => Array.isArray(c.entities) && c.entities.length === 1 && c.entities[0].entityName === 'Produto'));
  assert.ok(calls.some((c) => Array.isArray(c.entities) && c.entities.length === 1 && c.entities[0].entityName === 'Marca'));
  assert.equal(isValidCountValue(0), true);
  assert.equal(isValidCountValue(null), false);
});
