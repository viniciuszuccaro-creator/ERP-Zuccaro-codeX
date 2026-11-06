import assert from 'node:assert/strict';
import fs from 'node:fs';

const STAGE44 = fs.readFileSync(
  new URL('../fixtures/monitoramento-canais-realtime-stage44.jsx', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

/**
 * #401 composição #545: MonitoramentoCanaisRealtime ganhou filterInContext + cache
 * multi-ator. Remainders congelados (stage44 / date-arithmetic) revertem só o delta
 * autorizado para o hash histórico — comportamento scoped permanece nos testes #545.
 */
export function monitoramentoCanaisScopeRemainder(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  assert.match(normalized, /CANAIS_PEDIDOS_STALE_SCOPE/, 'composed Monitoramento tip marker');
  assert.match(normalized, /buildFechamentoQueryKey/, 'composed Monitoramento tip marker');
  assert.match(normalized, /resolveFechamentoKpiState/, 'composed Monitoramento tip marker');
  return STAGE44;
}
