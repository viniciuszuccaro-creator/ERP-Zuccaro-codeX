/**
 * Interação launchpad → openWindow (sem browser): contrato estático no tip #197.
 * Prova que o clique do card chama handleModuleClick → openWindow (não é dead-end).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Expedicao launchpad: card clique → handleModuleClick → openWindow', async () => {
  const expedicao = await readFile(new URL('../src/pages/Expedicao.jsx', import.meta.url), 'utf8');
  const grid = await readFile(new URL('../src/components/expedicao/expedicao-launchpad/ModulosGridExpedicao.jsx', import.meta.url), 'utf8');
  const card = await readFile(new URL('../src/components/financeiro/LaunchpadCard.jsx', import.meta.url), 'utf8');
  const renderer = await readFile(new URL('../src/components/lib/WindowRenderer.jsx', import.meta.url), 'utf8');
  const modal = await readFile(new URL('../src/components/lib/WindowModal.jsx', import.meta.url), 'utf8');
  const shell = await readFile(new URL('../src/components/layout/AppLayoutShell.jsx', import.meta.url), 'utf8');
  const manager = await readFile(new URL('../src/components/lib/WindowManager.jsx', import.meta.url), 'utf8');
  const romaneio = await readFile(new URL('../src/components/logistica/IntegracaoRomaneio.jsx', import.meta.url), 'utf8');
  const hydrate = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');

  assert.match(expedicao, /const \{ openWindow \} = useWindow/);
  assert.match(expedicao, /const handleModuleClick = \(module\) =>/);
  assert.match(expedicao, /openWindow\(\s*module\.component/);
  assert.match(expedicao, /ModulosGridExpedicao modules=\{allowedModules\} onModuleClick=\{handleModuleClick\}/);
  assert.match(expedicao, /isPedidoStatusElegivelRomaneio/);
  assert.match(grid, /onClick=\{\(\) => onModuleClick\(module\)\}/);
  assert.match(card, /onClick=\{onClick\}/);
  assert.match(card, /data-action=\{dataAction\}/);
  assert.match(shell, /<WindowRenderer\s*\/>/);
  assert.match(renderer, /windows\.map/);
  assert.match(modal, /data-testid="erp-window"/);
  assert.match(modal, /data-window-title=/);
  assert.match(manager, /viewportW/);
  assert.match(manager, /Math\.min\(requestedW/);
  assert.match(romaneio, /resolveEmpresaOperacionalExpedicao/);
  assert.match(hydrate, /preservedTenantContext/);
  assert.match(hydrate, /if \(allowedEntities\)/);
});
