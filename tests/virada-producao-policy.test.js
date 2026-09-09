import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyBackupOnCreate,
  applyBackupOnUpdate,
  assertBackupExpire,
  assertBackupRestore,
  assertChecklistVirada,
  assertJanelaMigracao,
  buildBackupEntitySnapshot,
  buildBackupResumo,
  hashBackupResumo,
  hasBackupSnapshot,
  isBackupErpValido,
  resolveConfigBackupInScope,
  stampViradaChecklistOnWrite,
  VIRADA_CHECKLIST,
} from '../src/components/lib/viradaProducaoPolicy.js';

test('backup do ERP reserva numero estavel, hash e snapshot restauravel', () => {
  const stores = { Cliente: [{ id: 1, group_id: 'g1' }, { id: 2, group_id: 'g1' }], Pedido: [{ id: 3, group_id: 'g1' }] };
  const snapshotDados = buildBackupEntitySnapshot(stores, { groupId: 'g1' });
  const resumo = buildBackupResumo(snapshotDados.entities);
  const created = applyBackupOnCreate({
    record: { group_id: 'g1', status: 'Concluido', numero_backup: `BKP-${Date.now()}` },
    records: [],
    resumo,
    snapshotDados,
  });
  assert.equal(created.numero_backup, 'BKP-000001');
  assert.equal(created.hash_integridade, hashBackupResumo(resumo));
  assert.equal(created.quantidade_total_registros, 3);
  assert.equal(hasBackupSnapshot(created), true);
  assert.equal(created.validacao_integridade.pode_restaurar, true);
  assert.equal(isBackupErpValido(created), true);
});

test('snapshot exclui registro sem grupo/empresa no escopo', () => {
  const snapshot = buildBackupEntitySnapshot({
    Cliente: [
      { id: 'ok', group_id: 'g1' },
      { id: 'sem-grupo' },
      { id: 'outro', group_id: 'g2' },
    ],
  }, { groupId: 'g1' });
  assert.deepEqual(snapshot.entities.Cliente.map((row) => row.id), ['ok']);
});

test('backup sem grupo e recusado', () => {
  assert.throws(() => applyBackupOnCreate({ record: { status: 'Concluido' }, resumo: buildBackupResumo({}) }), /Grupo obrigatorio/);
});

test('restore exige snapshot e respeita escopo', () => {
  assert.throws(() => assertBackupRestore({ backup: { id: '1', group_id: 'g1', status: 'Concluido' } }), /invalido|snapshot/i);
  const snapshotDados = buildBackupEntitySnapshot({ Cliente: [{ id: 'c1', group_id: 'g1' }] }, { groupId: 'g1' });
  const backup = applyBackupOnCreate({
    record: { id: 'bk1', group_id: 'g1', status: 'Concluido' },
    records: [],
    resumo: buildBackupResumo(snapshotDados.entities),
    snapshotDados,
  });
  const entities = assertBackupRestore({ backup, groupId: 'g1' });
  assert.equal(entities.Cliente[0].id, 'c1');
  assert.throws(() => assertBackupRestore({ backup, groupId: 'outro' }), /grupo/);
  assert.throws(() => assertBackupRestore({ backup, groupId: 'g1', empresaId: 'e1' }), /empresa/);
});

test('update preserva snapshot e expire e controlado', () => {
  const snapshotDados = buildBackupEntitySnapshot({}, { groupId: 'g1' });
  const before = applyBackupOnCreate({
    record: { id: 'bk1', group_id: 'g1', status: 'Concluido' },
    records: [],
    resumo: buildBackupResumo(snapshotDados.entities),
    snapshotDados,
  });
  const updated = applyBackupOnUpdate({ before, patch: { restauracoes: [{ ok: true }], status: 'Concluido' } });
  assert.equal(updated.hash_integridade, before.hash_integridade);
  assert.deepEqual(updated.snapshot_dados, before.snapshot_dados);
  assert.throws(() => assertBackupExpire({ ...before, status: 'Expirado' }), /ja expirado/);
  const expired = applyBackupOnUpdate({ before, patch: { status: 'Expirado' } });
  assert.equal(expired.status, 'Expirado');
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

test('checklist da virada exige backup valido, assinatura e itens confirmados', () => {
  assert.throws(() => assertChecklistVirada({ backups: [], configBackup: {} }), /backup valido/);
  const snapshotDados = buildBackupEntitySnapshot({}, { groupId: 'g1' });
  const backups = [applyBackupOnCreate({
    record: {
      group_id: 'g1',
      status: 'Concluido',
      numero_backup: 'BKP-000002',
    },
    records: [],
    resumo: buildBackupResumo(snapshotDados.entities),
    snapshotDados,
  })];
  assert.throws(
    () => assertChecklistVirada({ backups, configBackup: { backup_legado_confirmado: true } }),
    /janela/,
  );
  const checklist = Object.fromEntries(VIRADA_CHECKLIST.map((campo) => [campo, true]));
  assert.throws(() => assertChecklistVirada({ backups, configBackup: checklist }), /assinado|responsavel/);
  const assinado = stampViradaChecklistOnWrite({
    record: checklist,
    user: { email: 'qa@local' },
  });
  assert.equal(assinado.virada_confirmado_por, 'qa@local');
  assert.equal(assertChecklistVirada({ backups, configBackup: assinado }).permitido, true);
  assert.equal(resolveConfigBackupInScope([{ group_id: 'g1', id: 'cfg1' }, { group_id: 'g2', id: 'cfg2' }], { groupId: 'g1' })?.id, 'cfg1');
  assert.equal(resolveConfigBackupInScope([{ id: 'sem' }], { groupId: 'g1' }), null);
});

test('backup existente deixa de simular restore e a central congela a janela', async () => {
  const tela = await readFile(new URL('../src/components/sistema/ConfiguracaoBackup.jsx', import.meta.url), 'utf8');
  const historico = await readFile(new URL('../src/components/sistema/HistoricoBackups.jsx', import.meta.url), 'utf8');
  const center = await readFile(new URL('../src/components/sistema/ConfigCenter.jsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  const auto = await readFile(new URL('../base44/functions/autoBackup/entry.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(tela, /Date\.now\(\)/);
  assert.doesNotMatch(tela, /Math\.random/);
  assert.match(tela, /origem_backup: 'erp_novo'/);
  assert.match(tela, /stampViradaChecklistOnWrite/);
  assert.match(tela, /resolveConfigBackupInScope/);
  assert.match(tela, /filterInContext\('ConfiguracaoBackup'/);
  assert.doesNotMatch(tela, /configs\[0\]/);
  assert.match(tela, /Boolean\(grupoAtivoId\)/);
  assert.match(center, /janela_migracao_congelada/);
  assert.doesNotMatch(historico, /Restauracao simulada|Simular restauracao|Simular restaura/);
  assert.match(historico, /BackupAutomatico\.restore/);
  assert.match(historico, /canRestaurar/);
  assert.match(client, /async restore\(/);
  assert.match(client, /buildBackupEntitySnapshot/);
  assert.match(client, /resolveConfigBackupInScope/);
  assert.match(client, /stampViradaChecklistOnWrite/);
  assert.match(client, /BackupAutomatico: \{ module: 'Sistema', section: 'Backup' \}/);
  assert.match(auto, /group_id obrigatorio/);
  assert.doesNotMatch(auto, /catch \(_\) \{\}/);
});
