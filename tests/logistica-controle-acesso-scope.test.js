import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveControleAcessoLogisticaKpiState,
  isControleAcessoLogisticaScopeCurrent,
  buildControleAcessoLogisticaQueryKey,
  buildPermissoesLogistica,
} from '../src/components/logistica/controleAcessoLogisticaScope.js';

test('ControleAcessoLogistica usa getInContext sem auth.me / Perfil filter unscoped', () => {
  const src = readFileSync('src/components/logistica/ControleAcessoLogistica.jsx', 'utf8');
  assert.match(src, /getInContext\(\s*'PerfilAcesso'/);
  assert.match(src, /CONTROLE_ACESSO_LOGISTICA_STALE_SCOPE/);
  assert.match(src, /fail-closed ≠ liberar/);
  assert.doesNotMatch(src, /base44\.auth\.me\(/);
  assert.doesNotMatch(src, /entities\.PerfilAcesso\.filter\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
  assert.doesNotMatch(src, /podeVisualizarRotas:\s*permissoes\.roteirizar\?\.includes\('visualizar'\) \|\| true/);
});

test('KPI fail-closed e flags', () => {
  assert.equal(resolveControleAcessoLogisticaKpiState({
    hasUser: true, contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveControleAcessoLogisticaKpiState({
    hasUser: true, contextoValido: false, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(isControleAcessoLogisticaScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.deepEqual(
    buildControleAcessoLogisticaQueryKey({
      groupId: 'g', empresaId: 'e', actorId: 'a', sessionKey: 's', perfilId: 'p1',
    }),
    ['perfilAcesso', 'g', 'e', 'a', 's', 'p1'],
  );
  const denied = buildPermissoesLogistica(
    { permissoes: { logistica: { criarRomaneio: true, roteirizar: ['visualizar'] } } },
    { role: 'user' },
    'loading',
  );
  assert.equal(denied.podeCriarRomaneio, false);
  assert.equal(denied.podeVisualizarRotas, false);
  const admin = buildPermissoesLogistica(null, { role: 'admin' }, 'unavailable');
  assert.equal(admin.podeCriarRomaneio, true);
  assert.equal(admin.podeVisualizarRotas, true);
  const ready = buildPermissoesLogistica(
    { permissoes: { logistica: { criarRomaneio: true, roteirizar: ['visualizar'] } } },
    { role: 'user' },
    'ready',
  );
  assert.equal(ready.podeCriarRomaneio, true);
  assert.equal(ready.podeVisualizarRotas, true);
  assert.equal(ready.podeRoteirizar, false);
});
