import assert from 'node:assert/strict';
import fs from 'node:fs';

const STAGE44 = fs.readFileSync(
  new URL('../fixtures/monitoramento-canais-realtime-stage44.jsx', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

const AUTHORIZED_COMPOSED = fs.readFileSync(
  new URL('../fixtures/monitoramento-canais-realtime-authorized-composed.jsx', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

/**
 * Versão vulnerável (pré-P1 6684093828): valida só marcadores/fórmula e devolve
 * STAGE44, descartando o restante do source — esconde append/alteração fora do escopo.
 * Mantida apenas para contraprova; não usar em produção de contratos.
 */
export function monitoramentoCanaisScopeRemainderVulnerable(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  assert.match(normalized, /CANAIS_PEDIDOS_STALE_SCOPE/, 'composed Monitoramento tip marker');
  assert.match(normalized, /buildFechamentoQueryKey/, 'composed Monitoramento tip marker');
  assert.match(normalized, /resolveFechamentoKpiState/, 'composed Monitoramento tip marker');
  const boundary = 'agora.getTime() - ultimaAtualizacao.getTime()';
  assert.equal(
    normalized.split(boundary).length - 1,
    1,
    `Exact stage45 boundary count: MonitoramentoCanaisRealtime: ${boundary}`,
  );
  return STAGE44;
}

/**
 * #401 composição #545 + P1 6684093828: só converte para STAGE44 quando a fonte
 * inteira coincide com o tip composto autorizado. Qualquer append, omissão,
 * repetição ou instrução extra fora desse blob é rejeitada — não se descarta
 * o restante do source silenciosamente.
 */
export function monitoramentoCanaisScopeRemainder(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  assert.equal(
    normalized,
    AUTHORIZED_COMPOSED,
    'Monitoramento source must equal authorized composed tip exactly (no outside edits)',
  );
  return STAGE44;
}
