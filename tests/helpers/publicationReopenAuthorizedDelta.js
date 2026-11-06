import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

/**
 * P1 #353 — delta autorizado do caso reopen na publication baseline.
 *
 * O tip frágil usava `assert.notEqual` + `continue` e aceitava remover assertion
 * do caso reabertura após apenas recalcular `beforeSha256`. Aqui o delta é fixo:
 * conteúdo atual autorizado ↔ histórico 90f0a315; beforeSha histórico preservado.
 */

export const PUBLICATION_BASE = 'e36231b3a7e546aa9fd2529abb8d5edb61d8189c';
export const REOPEN_CONSOLIDACAO_PATH = 'tests/cursor-cadastros-reopen-consolidacao.test.js';
export const REOPEN_HISTORICAL_COMMIT = '90f0a315eb3d2b59e0c2bfcab7077abc27bc3613';

/** beforeSha256 histórico (após substituir base→HEAD no source 90f0a315). */
export const REOPEN_HISTORICAL_BEFORE_SHA =
  'a8edd3fafe08e3afd60dcb9ea26c8e812abf27fe1384a9f63d07c3e65f6bae6f';

/**
 * Hash do source ATUAL autorizado após o mesmo pipeline de restauração
 * (remainder vazio + base→HEAD). Qualquer mutação interna/omissão diverge.
 */
export const REOPEN_AUTHORIZED_CURRENT_SHA =
  'd1d399f797b0ffe487fec70fa9fe3b13dd3078bac6dbf43f5ec2054a392756c5';

/** Ocorrências de PUBLICATION_BASE no source atual autorizado. */
export const REOPEN_AUTHORIZED_REFERENCES = 2;

/** Entrada exata permitida no manifesto vs histórico 90f0a315 (só references mudou). */
export const REOPEN_AUTHORIZED_MANIFEST_ENTRY = Object.freeze({
  path: REOPEN_CONSOLIDACAO_PATH,
  beforeSha256: REOPEN_HISTORICAL_BEFORE_SHA,
  references: REOPEN_AUTHORIZED_REFERENCES,
});

export function normalizePublicationSource(source) {
  return String(source ?? '').replace(/\r\n/g, '\n');
}

export function publicationRestoredHash(source) {
  const restored = normalizePublicationSource(source)
    .replaceAll(`${PUBLICATION_BASE}:`, 'HEAD:')
    .replaceAll(JSON.stringify(PUBLICATION_BASE), "'HEAD'");
  return crypto.createHash('sha256').update(restored).digest('hex');
}

export function loadHistoricalReopenConsolidacao() {
  return normalizePublicationSource(execFileSync(
    'git',
    ['show', `${REOPEN_HISTORICAL_COMMIT}:${REOPEN_CONSOLIDACAO_PATH}`],
    { encoding: 'utf8' },
  ));
}

/**
 * Aceita somente o source atual autorizado e devolve o histórico byte-idêntico.
 * Rejeita mutação interna, omissão do delta e adulteração do conteúdo pinado.
 */
export function restoreAuthorizedReopenConsolidacao(source) {
  const normalized = normalizePublicationSource(source);
  const currentHash = publicationRestoredHash(normalized);
  assert.equal(
    currentHash,
    REOPEN_AUTHORIZED_CURRENT_SHA,
    'Only the exact authorized reopen consolidacao source may be normalized',
  );
  const historical = loadHistoricalReopenConsolidacao();
  assert.notEqual(
    normalized,
    historical,
    'Authorized reopen delta must be present (omission rejected)',
  );
  assert.equal(
    publicationRestoredHash(historical),
    REOPEN_HISTORICAL_BEFORE_SHA,
    'Historical reopen baseline must remain byte-identical',
  );
  return historical;
}
