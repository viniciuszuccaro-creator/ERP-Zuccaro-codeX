/**
 * #397 — Cliente fluxo diário: reopen HTTP reconhece updated_at (não só updated_date).
 * Comportamento da identidade no form existente; sem ComercialV2.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/** Espelha a expressão canônica dos forms (contraprova: se o fonte divergir, o match falha). */
function clienteRecordIdentity(cliente, grupoAtual, empresaAtual, contexto) {
  return JSON.stringify([
    cliente?.id ?? null,
    cliente?.updated_at ?? cliente?.updated_date ?? null,
    grupoAtual?.id ?? null,
    empresaAtual?.id ?? null,
    contexto,
  ]);
}

test('ClienteFormCompleto: refresh HTTP com updated_at muda identidade (reabre limpo)', async () => {
  const src = await readFile(new URL('../src/components/comercial/ClienteFormCompleto.jsx', import.meta.url), 'utf8');
  assert.match(src, /useCadastroRecordState/);
  assert.match(
    src,
    /cliente\?\.updated_at\s*\?\?\s*cliente\?\.updated_date/,
  );
  // Contraprova do defeito: identidade só updated_date colidiria entre refresh HTTP.
  assert.doesNotMatch(
    src,
    /useCadastroRecordState\([\s\S]*?JSON\.stringify\(\[\s*cliente\?\.id \?\? null, cliente\?\.updated_date \?\? null/,
  );

  const scope = { id: 'g1' };
  const empresa = { id: 'e1' };
  const before = clienteRecordIdentity(
    { id: 'c1', nome: 'Alpha', updated_date: '2026-01-01T00:00:00Z' },
    scope,
    empresa,
    'empresa',
  );
  const afterHttp = clienteRecordIdentity(
    {
      id: 'c1',
      nome: 'Alpha HTTP',
      updated_date: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-15T12:00:00Z',
    },
    scope,
    empresa,
    'empresa',
  );
  const sameDateOnly = clienteRecordIdentity(
    {
      id: 'c1',
      nome: 'Alpha HTTP',
      updated_date: '2026-01-01T00:00:00Z',
    },
    scope,
    empresa,
    'empresa',
  );

  assert.notEqual(before, afterHttp, 'updated_at deve invalidar identidade');
  assert.equal(before, sameDateOnly, 'sem updated_at, updated_date legado ainda reabre');
  assert.match(afterHttp, /2026-02-15T12:00:00Z/);
});

test('ClienteForm: recordIdentity usa updated_at ?? updated_date e rejeita só updated_date', async () => {
  const src = await readFile(new URL('../src/components/comercial/ClienteForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /recordIdentity = JSON\.stringify\(\[cliente\?\.id/);
  assert.match(src, /cliente\?\.updated_at\s*\?\?\s*cliente\?\.updated_date/);
  assert.doesNotMatch(
    src,
    /recordIdentity = JSON\.stringify\(\[cliente\?\.id \?\? null, cliente\?\.updated_date \?\? null/,
  );

  const a = clienteRecordIdentity(
    { id: 'c1', updated_date: '2026-01-01T00:00:00Z' },
    { id: 'g1' },
    { id: 'e1' },
    'empresa',
  );
  const b = clienteRecordIdentity(
    { id: 'c1', updated_date: '2026-01-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' },
    { id: 'g1' },
    { id: 'e1' },
    'empresa',
  );
  assert.notEqual(a, b);
});
