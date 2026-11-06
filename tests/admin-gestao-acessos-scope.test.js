import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveGestaoAcessosKpiState,
  isGestaoAcessosScopeCurrent,
  buildGestaoAcessosUsersQueryKey,
  countUsuariosSemPerfilGestaoAcessos,
  usuarioNoEscopoGestaoAcessos,
} from '../src/components/administracao-sistema/gestao-acessos/gestaoAcessosIndexScope.js';

test('GestaoAcessosIndex usa filterInContext sem User/Perfil list unscoped / KPI 0', () => {
  const src = readFileSync('src/components/administracao-sistema/gestao-acessos/GestaoAcessosIndex.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'User'/);
  assert.match(src, /filterInContext\(\s*'PerfilAcesso'/);
  assert.match(src, /filterInContext\(\s*'Empresa'/);
  assert.match(src, /GESTAO_ACESSOS_STALE_SCOPE/);
  assert.match(src, /KPI 0 ≠ ready/);
  assert.doesNotMatch(src, /entities\.User\.list\(/);
  assert.doesNotMatch(src, /entities\.PerfilAcesso\.list\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
  assert.doesNotMatch(src, /data:\s*usuarios\s*=\s*\[\]/);
  assert.doesNotMatch(src, /data:\s*perfis\s*=\s*\[\]/);
});

test('KPI fail-closed e contagens', () => {
  assert.equal(resolveGestaoAcessosKpiState({
    canView: true, contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveGestaoAcessosKpiState({
    canView: true, contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(isGestaoAcessosScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.deepEqual(
    buildGestaoAcessosUsersQueryKey({ groupId: 'g', empresaId: 'e', actorId: 'a', sessionKey: 's' }),
    ['usuarios', 'g', 'e', 'a', 's'],
  );
  assert.equal(countUsuariosSemPerfilGestaoAcessos([
    { id: 1, role: 'user' },
    { id: 2, role: 'user', perfil_acesso_id: 'p' },
    { id: 3, role: 'admin' },
  ]), 1);
  assert.equal(usuarioNoEscopoGestaoAcessos(
    { id: '1', empresa_id: 'e1' },
    { contexto: 'empresa', empresaAtivaId: 'e1', grupoAtivoId: 'g' },
  ).inclui, true);
});
