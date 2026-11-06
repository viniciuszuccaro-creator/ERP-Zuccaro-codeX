import fs from 'node:fs';
import assert from 'node:assert/strict';

/**
 * Remainder do escopo InContext de PainelGovernanca (#584):
 * restaura corpo pré-InContext para consumer-window stage60.
 * Delta InContext coberto por tests/governanca-painel-scope.test.js.
 *
 * Congelado a partir de tip #401 `cursor/composicao-397-342-prep-392b`.
 */
const BASELINE = fs.readFileSync(
  new URL('./fixtures/painelGovernanca.baseline.jsx', import.meta.url),
  'utf8',
);

export function painelGovernancaScopeRemainder(file, text) {
  if (file !== 'src/components/governanca/PainelGovernanca.jsx') return text;
  assert.ok(
    text.includes("filterInContext('GovernancaEmpresa'")
      || text.includes('PAINEL_GOVERNANCA_'),
    'PainelGovernanca scope remainder expects InContext surface',
  );
  // Preserva counterproof stage60: exatamente um hunk JSDoc no fonte atual.
  const jsdocHunk = '/** @param {{empresaId?: string, grupoId?: string}} props */\nexport default function PainelGovernanca';
  assert.equal(
    text.split(jsdocHunk).length - 1,
    1,
    'PainelGovernanca scope remainder expects exactly one stage60 JSDoc hunk',
  );
  const baseline = BASELINE.replace(/\r?\n/g, '\n');
  return text.includes('\r\n') ? baseline.replace(/\n/g, '\r\n') : baseline;
}
