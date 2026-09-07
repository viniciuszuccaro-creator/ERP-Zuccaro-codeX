import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  applyModoOperacaoOnWrite,
  applyUsuarioPilotoOnWrite,
  assertOperacaoPiloto,
  assertViradaProducao,
  CENARIOS_PILOTO,
  PAPEIS_PILOTO,
  papeisPilotoCobertos,
} from '../src/components/lib/pilotoOperacaoPolicy.js';

const usersCompletos = PAPEIS_PILOTO.map((papel, index) => ({
  id: `u${index}`,
  usuario_piloto: true,
  papel_piloto: papel,
  ativo: true,
}));

const cenariosOk = CENARIOS_PILOTO.map((id) => ({ id, ok: true }));

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
  assert.equal(assertViradaProducao({ users: usersCompletos, cenariosExecutados: cenariosOk }).modo, 'producao');
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

test('telas existentes designam piloto e NF producao revalida', async () => {
  const gestao = await readFile(new URL('../src/components/sistema/GestaoUsuariosAvancada.jsx', import.meta.url), 'utf8');
  const tab = await readFile(new URL('../src/components/comercial/NotasFiscaisTab.jsx', import.meta.url), 'utf8');
  const actions = await readFile(new URL('../base44/functions/nfeActions/entry.ts', import.meta.url), 'utf8');
  assert.match(gestao, /usuario_piloto/);
  assert.match(tab, /usuarioPiloto: isUsuarioPiloto\(user\)/);
  assert.match(actions, /usuario piloto designado/);
});
