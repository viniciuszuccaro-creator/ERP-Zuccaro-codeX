/**
 * Recuperação: MapaRoteirizacaoIA e ConfigFinanceiroLogistica
 * existiam como lazy import órfão no hub Expedição.
 * #591: persistência canônica HTTP (criarRomaneio) sem fallback local silencioso.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const expedicao = read('src/pages/Expedicao.jsx');
const mapaIa = read('src/components/logistica/MapaRoteirizacaoIA.jsx');

test('recuperação: MapaRoteirizacaoIA no launchpad Expedição', () => {
  assert.match(expedicao, /const MapaRoteirizacaoIA = React\.lazy/);
  assert.match(expedicao, /component:\s*MapaRoteirizacaoIA/);
  assert.match(expedicao, /Mapa Roteirização IA/);
});

test('MapaRoteirizacaoIA: persistência HTTP fail-closed + local canônico', () => {
  assert.match(mapaIa, /isHttpExpedicaoMode/);
  assert.match(mapaIa, /httpApiClient\.expedicao\.criarRomaneio/);
  assert.match(mapaIa, /persistirRotaRomaneio/);
  assert.match(mapaIa, /buildRotaRecord/);
  assert.match(mapaIa, /planEntregasFromPedidosParaRomaneio/);
  assert.match(mapaIa, /entregas_ausentes_http/);
  assert.match(mapaIa, /sem fallback local/);
  assert.match(mapaIa, /data-action="MapaRoteirizacaoIA\.persistir"/);
  assert.match(mapaIa, /data-permission="Expedicao\.Romaneios\.criar"/);
  assert.match(mapaIa, /persistLockRef/);
  // HTTP path must not silently create Entrega via createInContext
  const httpBlock = mapaIa.slice(
    mapaIa.indexOf('if (isHttpExpedicaoMode)'),
    mapaIa.indexOf('// Modo local:'),
  );
  assert.doesNotMatch(httpBlock, /createInContext\("Entrega"/);
  assert.doesNotMatch(httpBlock, /createInContext\("Rota"/);
  assert.match(httpBlock, /criarRomaneio/);
  assert.match(httpBlock, /invalidateQueries\(\{ queryKey: \["romaneios"\] \}\)/);
  // POST criarRomaneio ≠ roteirização completa: reabertura/vínculo via owners
  // IntegracaoRomaneio / listagem romaneios — não estado in-memory do mapa.
  assert.match(mapaIa, /IntegracaoRomaneio/);
});

test('recuperação: ConfigFinanceiroLogistica no launchpad Expedição', () => {
  assert.match(expedicao, /const ConfigFinanceiroLogistica = React\.lazy/);
  assert.match(expedicao, /component:\s*ConfigFinanceiroLogistica/);
  assert.match(expedicao, /Config Financeiro Logística/);
  assert.match(expedicao, /sectionKey:\s*'Financeiro Logistica'/);
});

test('recuperação: Separação clássica permanece (keep both)', () => {
  assert.match(expedicao, /component:\s*SeparacaoConferenciaIA/);
  assert.match(expedicao, /component:\s*SeparacaoConferencia[^I]/);
});
