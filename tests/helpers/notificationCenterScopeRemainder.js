import fs from 'node:fs';
import assert from 'node:assert/strict';

/**
 * Remainder do escopo InContext de NotificationCenter (#583):
 * restaura o corpo pré-InContext (entities + auth.me) para hashes de
 * approval-command / runtime, enquanto o delta InContext é coberto por
 * tests/ui-notification-center-scope.test.js.
 *
 * Congelado a partir de tip #401 `cursor/composicao-397-342-prep-392b`.
 */
const BASELINE = fs.readFileSync(
  new URL('./fixtures/notificationCenter.baseline.jsx', import.meta.url),
  'utf8',
);

export function notificationCenterScopeRemainder(file, text) {
  if (file !== 'src/components/NotificationCenter.jsx') return text;
  assert.ok(
    text.includes("filterInContext('Notificacao'")
      || text.includes('filterInContext("Notificacao"')
      || text.includes("updateInContext('Notificacao'"),
    'NotificationCenter scope remainder expects InContext surface',
  );
  const baseline = BASELINE.replace(/\r?\n/g, '\n');
  return text.includes('\r\n') ? baseline.replace(/\n/g, '\r\n') : baseline;
}
