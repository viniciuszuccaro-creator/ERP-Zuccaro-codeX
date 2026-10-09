import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('useEntityCounts alinha contagem ao filtro multiempresa do Visualizador', async () => {
  const source = await readFile(new URL('../src/components/lib/useEntityCounts.jsx', import.meta.url), 'utf8');
  assert.match(source, /buildMultiempresaReadFilter/);
  assert.match(source, /SHARED\.has\(entityName\)/);
  assert.match(source, /empresaIdsDoGrupo/);
  assert.match(source, /tenantMaster/);
});

test('base44Client rota countEntities batch pelo bridge HTTP piloto', async () => {
  const source = await readFile(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
  assert.match(source, /countEntitiesTouchesHttpPilot/);
  assert.match(source, /runHttpPilotAwareCountEntities/);
  assert.match(source, /badge "Clientes: 0"/);
});
