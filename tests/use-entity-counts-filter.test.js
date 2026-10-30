import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('useEntityCounts alinha contagem ao filtro multiempresa do Visualizador', async () => {
  const hook = await readFile(new URL('../src/components/lib/useEntityCounts.jsx', import.meta.url), 'utf8');
  const filter = await readFile(new URL('../src/components/lib/cadastroCountFilter.js', import.meta.url), 'utf8');
  // Hook reutiliza filtro canônico (Codex P1 — sem segunda implementação)
  assert.match(hook, /cadastroCountFilter\.js/);
  assert.match(hook, /buildContextFilter/);
  assert.match(filter, /buildMultiempresaReadFilter/);
  assert.match(filter, /COUNT_SHARED_ENTITIES\.has\(entityName\)/);
  assert.match(filter, /empresaIdsDoGrupo/);
  assert.match(filter, /tenantMaster/);
  assert.match(filter, /alinhado ao Visualizador/i);
});

test('base44Client rota countEntities batch pelo bridge HTTP piloto', async () => {
  const source = await readFile(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
  assert.match(source, /countEntitiesTouchesHttpPilot/);
  assert.match(source, /runHttpPilotAwareCountEntities/);
  assert.match(source, /badge "Clientes: 0"/);
});
