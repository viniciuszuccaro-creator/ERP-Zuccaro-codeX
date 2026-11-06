import fs from 'node:fs';
import assert from 'node:assert/strict';

/**
 * Remainder do escopo InContext de SegurancaDashboard (#587):
 * restaura corpo pré-InContext para stage48 cadastro-query-payload.
 * Delta coberto por tests/admin-seguranca-dashboard-scope.test.js.
 *
 * Congelado a partir de tip #401 `cursor/composicao-397-342-prep-392b`.
 */
const BASELINE = fs.readFileSync(
  new URL('./fixtures/segurancaDashboard.baseline.jsx', import.meta.url),
  'utf8',
);

export function segurancaDashboardScopeRemainder(file, text) {
  if (file !== 'src/components/administracao-sistema/seguranca-governanca/SegurancaDashboard.jsx') {
    return text;
  }
  assert.ok(
    text.includes('SEGURANCA_DASHBOARD_STALE_SCOPE')
      || text.includes('filterInContext("User"'),
    'SegurancaDashboard scope remainder expects InContext surface',
  );
  // Counterproof: hunk stage48 ainda precisa existir no fonte atual (ou marcador).
  assert.ok(
    text.includes('DashboardSeguranca'),
    'SegurancaDashboard scope remainder expects DashboardSeguranca surface',
  );
  const baseline = BASELINE.replace(/\r?\n/g, '\n');
  return text.includes('\r\n') ? baseline.replace(/\n/g, '\r\n') : baseline;
}
