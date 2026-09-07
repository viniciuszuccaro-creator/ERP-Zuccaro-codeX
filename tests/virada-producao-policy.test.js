import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyBackupOnCreate,
  assertChecklistVirada,
  assertJanelaMigracao,
  buildBackupResumo,
  hashBackupResumo,
  isBackupErpValido,
  VIRADA_CHECKLIST,
} from '../src/components/lib/viradaProducaoPolicy.js';

test('backup do ERP reserva numero estavel e hash do resumo', () => {
  const resumo = buildBackupResumo({ Cliente: [{ id: 1 }, { id: 2 }], Pedido: [{ id: 3 }] });
  const created = applyBackupOnCreate({
    record: { group_id: 'g1', status: 'Concluido', numero_backup: `BKP-${Date.now()}` },
    records: [],
    resumo,
  });
  assert.equal(created.numero_backup, 'BKP-000001');
  assert.equal(created.hash_integridade, hashBackupResumo(resumo));
  assert.equal(created.quantidade_total_registros, 3);
  assert.equal(isBackupErpValido(created), true);
});

test('backup sem grupo e recusado', () => {
  assert.throws(() => applyBackupOnCreate({ record: { status: 'Concluido' }, resumo: buildBackupResumo({}) }), /Grupo obrigatorio/);
});

test('janela congelada bloqueia migracao confirmada', () => {
  assert.throws(
    () => assertJanelaMigracao({
      configBackup: { janela_migracao_congelada: true },
      migracaoConfirmada: true,
    }),
    /congelada/,
  );
  assert.equal(assertJanelaMigracao({ migracaoConfirmada: true }), true);
});

test('checklist da virada exige backup valido e itens confirmados', () => {
  assert.throws(() => assertChecklistVirada({ backups: [], configBackup: {} }), /backup valido/);
  const backups = [{
    group_id: 'g1',
    status: 'Concluido',
    numero_backup: 'BKP-000002',
    hash_integridade: 'fnv1a:1',
    quantidade_total_registros: 0,
  }];
  assert.throws(
    () => assertChecklistVirada({ backups, configBackup: { backup_legado_confirmado: true } }),
    /janela/,
  );
  const checklist = Object.fromEntries(VIRADA_CHECKLIST.map((campo) => [campo, true]));
  assert.equal(assertChecklistVirada({ backups, configBackup: checklist }).permitido, true);
});

test('backup existente deixa de simular relogio e a central congela a janela', async () => {
  const tela = await readFile(new URL('../src/components/sistema/ConfiguracaoBackup.jsx', import.meta.url), 'utf8');
  const center = await readFile(new URL('../src/components/sistema/ConfigCenter.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(tela, /Date\.now\(\)/);
  assert.doesNotMatch(tela, /Math\.random/);
  assert.match(tela, /origem_backup: 'erp_novo'/);
  assert.match(center, /janela_migracao_congelada/);
});
