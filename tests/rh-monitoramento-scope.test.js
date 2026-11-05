import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('MonitoramentoRHInteligente lista via filterInContext com contexto', () => {
  const src = readFileSync('src/components/rh/MonitoramentoRHInteligente.jsx', 'utf8');
  assert.match(src, /useContextoVisual/);
  assert.match(src, /filterInContext\("MonitoramentoRH"/);
  assert.match(src, /filterInContext\("Colaborador"/);
  assert.match(src, /queryKey:\s*\["monitoramento-rh",\s*groupId,\s*empresaAtual\?\.id\]/);
  assert.match(src, /queryKey:\s*\["colaboradores-monitoramento-rh",\s*groupId,\s*empresaAtual\?\.id\]/);
  assert.match(src, /enabled:\s*contextoValido/);
  assert.doesNotMatch(src, /base44\.entities\.MonitoramentoRH\.list\(/);
  assert.doesNotMatch(src, /base44\.entities\.Colaborador\.list\(/);
  assert.match(src, /isErrorMonitoramentos|isErrorColaboradores/);
  assert.match(src, /erro de carga ≠ zero|erro ≠ zero|erro ≠ lista vazia/);
});
