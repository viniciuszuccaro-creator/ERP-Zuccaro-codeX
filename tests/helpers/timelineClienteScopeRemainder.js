import fs from 'node:fs';
import assert from 'node:assert/strict';

/**
 * Remainder do escopo InContext de TimelineCliente (#582):
 * restaura o corpo pré-InContext (entities) para date-arithmetic-stage21,
 * mantendo o operand getTime canônico. Delta InContext coberto por
 * tests/cliente-timeline-scope.test.js.
 *
 * Congelado a partir de tip #401 `cursor/composicao-397-342-prep-392b`.
 */
const BASELINE = fs.readFileSync(
  new URL('./fixtures/timelineCliente.baseline.jsx', import.meta.url),
  'utf8',
);

export function timelineClienteScopeRemainder(file, text) {
  if (file !== 'src/components/cliente/TimelineCliente.jsx') return text;
  assert.ok(
    text.includes("filterInContext('HistoricoCliente'")
      || text.includes('createInContext'),
    'TimelineCliente scope remainder expects InContext surface',
  );
  const baseline = BASELINE.replace(/\r?\n/g, '\n');
  return text.includes('\r\n') ? baseline.replace(/\n/g, '\r\n') : baseline;
}
