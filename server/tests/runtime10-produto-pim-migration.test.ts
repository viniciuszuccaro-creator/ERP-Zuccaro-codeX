import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../migrations/018_produto_pim_dam_outbox.sql', import.meta.url), 'utf8');

test('migration 018 amplia Produto canonico e preserva invariantes PIM', () => {
  assert.match(source, /ALTER TABLE produtos[\s\S]*descricao_tecnica[\s\S]*workflow_status/);
  assert.match(source, /multiplo_venda > 0/);
  assert.match(source, /quantidade_minima_venda >= 0/);
  assert.match(source, /RASCUNHO.*EM_REVISAO.*APROVADO.*PUBLICADO.*INATIVO/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS produto_variantes/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS produto_equivalentes/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS produto_midias/);
  assert.match(source, /CHECK \(produto_id <> produto_equivalente_id\)/);
  assert.match(source, /sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
});

test('migration 018 aplica tenant RLS FORCE e endurece outbox existente', () => {
  assert.match(source, /assert_produto_pim_tenant_integrity/);
  assert.match(source, /TENANT_FK_MISMATCH/);
  assert.equal((source.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length, 3);
  assert.equal((source.match(/FORCE ROW LEVEL SECURITY/g) ?? []).length, 3);
  assert.match(source, /ALTER TABLE integration_events[\s\S]*schema_version[\s\S]*payload_checksum/);
  assert.match(source, /attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts/);
});
