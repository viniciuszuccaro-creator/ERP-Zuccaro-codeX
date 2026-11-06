/**
 * Recuperação: MapaRoteirizacaoIA e ConfigFinanceiroLogistica
 * existiam como lazy import órfão no hub Expedição.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const expedicao = readFileSync('src/pages/Expedicao.jsx', 'utf8');

test('recuperação: MapaRoteirizacaoIA no launchpad Expedição', () => {
  assert.match(expedicao, /const MapaRoteirizacaoIA = React\.lazy/);
  assert.match(expedicao, /component:\s*MapaRoteirizacaoIA/);
  assert.match(expedicao, /Mapa Roteirização IA/);
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
