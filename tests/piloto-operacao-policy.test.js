import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { BACKUP_COUNT_ENTITIES, buildBackupEntitySnapshot, VIRADA_CHECKLIST } from '../src/components/lib/viradaProducaoPolicy.js';
import {
  applyModoOperacaoOnWrite,
  applyPilotoCenariosOnWrite,
  applyUsuarioPilotoOnWrite,
  assertOperacaoPiloto,
  assertViradaProducao,
  CENARIOS_PILOTO,
  evaluateHomologacaoPiloto,
  PAPEIS_PILOTO,
  papeisPilotoCobertos,
  PILOTO_CENARIOS_CHAVE,
} from '../src/components/lib/pilotoOperacaoPolicy.js';

const usersCompletos = PAPEIS_PILOTO.map((papel, index) => ({
  id: `u${index}`,
  usuario_piloto: true,
  papel_piloto: papel,
  ativo: true,
}));

const cenariosOk = CENARIOS_PILOTO.map((id) => ({ id, ok: true }));
const snapshotPiloto = buildBackupEntitySnapshot(
  Object.fromEntries(BACKUP_COUNT_ENTITIES.map((name) => [name, []])),
  { groupId: 'g1' },
);
const backupOk = [{
  group_id: 'g1',
  status: 'Concluido',
  numero_backup: 'BKP-000001',
  hash_integridade: 'fnv1a:abc',
  quantidade_total_registros: 4,
  snapshot_dados: snapshotPiloto,
}];
const checklistOk = Object.fromEntries(VIRADA_CHECKLIST.map((campo) => [campo, true]));
const viradaPronta = {
  users: usersCompletos,
  cenariosExecutados: cenariosOk,
  backups: backupOk,
  configBackup: checklistOk,
  configs: [{ chave: 'janela_migracao_congelada', ativa: true, valor: 'congelada' }],
};

test('operacao critica no piloto exige usuario piloto', () => {
  assert.throws(
    () => assertOperacaoPiloto({ user: { role: 'admin' }, acao: 'emitir_nfe_producao' }),
    /usuario piloto/,
  );
  const ok = assertOperacaoPiloto({
    user: { usuario_piloto: true, papel_piloto: 'faturamento', ativo: true },
    acao: 'emitir_nfe_producao',
  });
  assert.equal(ok.papel, 'faturamento');
});

test('admin sem papel piloto nao conta na cobertura', () => {
  assert.deepEqual(papeisPilotoCobertos([{ role: 'admin', usuario_piloto: true }]), []);
  assert.equal(papeisPilotoCobertos(usersCompletos).length, 6);
});

test('virada para producao exige papeis, cenarios e zero P0', () => {
  assert.throws(() => assertViradaProducao({ users: usersCompletos.slice(0, 3), cenariosExecutados: cenariosOk }), /6 papeis/);
  assert.throws(() => assertViradaProducao({ users: usersCompletos, cenariosExecutados: [] }), /cenarios/);
  assert.throws(
    () => assertViradaProducao({
      users: usersCompletos,
      cenariosExecutados: cenariosOk,
      incidentesCriticosAbertos: [{ severidade: 'P0', aberto: true }],
    }),
    /erro critico/,
  );
  assert.equal(assertViradaProducao(viradaPronta).modo, 'producao');
});

test('configuracao nao vira producao sozinha', () => {
  assert.throws(
    () => applyModoOperacaoOnWrite({ record: { chave: 'modo_operacao', valor: 'producao' }, users: [] }),
    /6 papeis/,
  );
  const kept = applyModoOperacaoOnWrite({ record: { chave: 'modo_operacao', valor: 'piloto' }, users: [] });
  assert.equal(kept.valor, 'piloto');
});

test('usuario piloto sem papel e recusado', () => {
  assert.throws(
    () => applyUsuarioPilotoOnWrite({ usuario_piloto: true }),
    /Papel piloto/,
  );
  const stamped = applyUsuarioPilotoOnWrite({ usuario_piloto: true, papel_piloto: 'vendedor' });
  assert.equal(stamped.papel_piloto, 'vendedor');
});

test('cenarios piloto so aceitam allowlist e homologacao exige papeis+cenarios', () => {
  assert.throws(
    () => applyPilotoCenariosOnWrite({
      record: { chave: PILOTO_CENARIOS_CHAVE, valor_json: [{ id: 'cenario_inventado', ok: true }] },
    }),
    /invalido/,
  );
  const saved = applyPilotoCenariosOnWrite({
    record: {
      chave: PILOTO_CENARIOS_CHAVE,
      valor_json: CENARIOS_PILOTO.map((id) => ({ id, ok: true })),
    },
    user: { email: 'qa@local' },
  });
  assert.equal(saved.valor, '10/10');
  assert.equal(saved.valor_json.length, 10);
  const incompleto = evaluateHomologacaoPiloto({ users: usersCompletos, cenariosExecutados: [] });
  assert.equal(incompleto.ok, false);
  const completo = evaluateHomologacaoPiloto({ users: usersCompletos, cenariosExecutados: cenariosOk });
  assert.equal(completo.ok, true);
});

test('telas existentes designam piloto, registram cenarios e NF exige papel', async () => {
  const gestao = await readFile(new URL('../src/components/sistema/GestaoUsuariosAvancada.jsx', import.meta.url), 'utf8');
  const status = await readFile(new URL('../src/components/sistema/StatusControleAcesso.jsx', import.meta.url), 'utf8');
  const tab = await readFile(new URL('../src/components/comercial/NotasFiscaisTab.jsx', import.meta.url), 'utf8');
  const actions = await readFile(new URL('../base44/functions/nfeActions/entry.ts', import.meta.url), 'utf8');
  const client = await readFile(new URL('../src/api/localBase44Client.js', import.meta.url), 'utf8');
  assert.match(gestao, /usuario_piloto/);
  assert.match(status, /PILOTO_CENARIOS_CHAVE/);
  assert.match(status, /upsertConfig/);
  assert.match(status, /CENARIOS_PILOTO\.map/);
  assert.match(tab, /usuarioPiloto: isUsuarioPiloto\(user\)/);
  assert.match(actions, /papel_piloto/);
  assert.match(actions, /usuario piloto designado/);
  assert.match(client, /applyPilotoCenariosOnWrite/);
  assert.doesNotMatch(client, /role === 'admin' && record\.usuario_piloto == null/);
});
