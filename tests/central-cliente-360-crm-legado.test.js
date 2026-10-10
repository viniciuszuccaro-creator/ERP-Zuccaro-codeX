import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  CRM_CANONICAL_HTTP_PENDING,
  filterOportunidadesDoCliente,
  resumirOportunidadeCrm,
  shouldUseCrmLegadoAdapter,
} from '../src/components/comercial/centralCliente360CrmLegado.js';

test('shouldUseCrmLegadoAdapter só quando HTTP CRM está skipped pendente', () => {
  assert.equal(shouldUseCrmLegadoAdapter({ status: 'skipped', code: CRM_CANONICAL_HTTP_PENDING }), true);
  assert.equal(shouldUseCrmLegadoAdapter({ status: 'ok', data: [] }), false);
  assert.equal(shouldUseCrmLegadoAdapter({ status: 'forbidden' }), false);
  assert.equal(shouldUseCrmLegadoAdapter(null), false);
});

test('filterOportunidadesDoCliente isola cliente sem misturar outro id', () => {
  const rows = [
    { id: 'o1', cliente_id: 'c-a', titulo: 'A' },
    { id: 'o2', cliente_id: 'c-b', titulo: 'B' },
    { id: 'o3', clienteId: 'c-a', titulo: 'A2' },
  ];
  assert.deepEqual(filterOportunidadesDoCliente(rows, 'c-a').map((r) => r.id), ['o1', 'o3']);
  assert.deepEqual(filterOportunidadesDoCliente(rows, 'c-x'), []);
});

test('resumirOportunidadeCrm preserva id técnico e etapa', () => {
  const r = resumirOportunidadeCrm({
    id: 'opp-1',
    titulo: 'Obra X',
    etapa_funil: 'Proposta',
    valor_estimado: 1500,
    codigo_oportunidade: 'OP-9',
  });
  assert.equal(r.id, 'opp-1');
  assert.equal(r.etapa, 'Proposta');
  assert.equal(r.valor, 1500);
  assert.equal(r.codigo, 'OP-9');
});

test('CentralCliente360Panel usa adaptador legado sem criar CRM HTTP paralelo', async () => {
  const panel = await readFile(new URL('../src/components/comercial/CentralCliente360Panel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /shouldUseCrmLegadoAdapter/);
  assert.match(panel, /CrmLegadoAdapterBlock/);
  assert.match(panel, /data-crm-source="legado"/);
  assert.match(panel, /central360-crm-abrir/);
  assert.doesNotMatch(panel, /OportunidadeService|crm\/v1|createTable.*Oportunidade/);
});
