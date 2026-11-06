/**
 * Parecer 6691042172 — upsertConfig: falha HTTP/remota ≠ gravação local silenciosa.
 * Modo local explícito permanece com fallback entity suportado.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canFallbackConfigToLocalEntity } from '../src/components/lib/configPersistPolicy.js';

test('HTTP mode: não permite fallback entity após falha de upsertConfig', () => {
  assert.equal(canFallbackConfigToLocalEntity({ localOnly: false, httpMode: true }), false);
  assert.equal(canFallbackConfigToLocalEntity({ localOnly: true, httpMode: true }), false);
});

test('remote mode: não permite fallback entity (não fingir persistência remota)', () => {
  assert.equal(canFallbackConfigToLocalEntity({ localOnly: false, httpMode: false }), false);
});

test('local explícito: fallback entity permanece permitido', () => {
  assert.equal(canFallbackConfigToLocalEntity({ localOnly: true, httpMode: false }), true);
});

test('useToggleConfig propaga falha fora do modo local (sem catch silencioso genérico)', () => {
  const src = readFileSync('src/components/lib/useToggleConfig.jsx', 'utf8');
  assert.match(src, /canFallbackConfigToLocalEntity/);
  assert.match(src, /UPSERT_CONFIG_RESPONSE_INVALID/);
  assert.match(src, /não transformar falha HTTP/);
  assert.doesNotMatch(
    src,
    /Fallback direto abaixo mantém o toggle funcional quando a função estiver indisponível/,
  );
});
