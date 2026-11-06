import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveUsuariosTabKpiState,
  isUsuariosTabScopeCurrent,
  buildUsuariosTabUsersQueryKey,
  usuarioNoEscopoUsuariosTab,
  registroNoEscopoUsuariosTab,
} from '../src/components/administracao-sistema/gestao-acessos/usuariosTabScope.js';

test('UsuariosTab usa filterInContext sem User/Perfil list unscoped / default []', () => {
  const src = readFileSync('src/components/administracao-sistema/gestao-acessos/UsuariosTab.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'User'/);
  assert.match(src, /filterInContext\(\s*"PerfilAcesso"/);
  assert.match(src, /filterInContext\(\s*"Empresa"/);
  assert.match(src, /USUARIOS_TAB_STALE_SCOPE/);
  assert.match(src, /lista vazia ≠ ready/);
  assert.doesNotMatch(src, /entities\.User\.list\(/);
  assert.doesNotMatch(src, /entities\.PerfilAcesso\.list\(/);
  assert.doesNotMatch(src, /base44\.auth\.me\(/);
  assert.doesNotMatch(src, /data:\s*usuarios\s*=\s*\[\]/);
  assert.doesNotMatch(src, /localStorage\.getItem\(["']group_atual_id["']\)/);
});

test('KPI fail-closed e filtro de escopo', () => {
  assert.equal(resolveUsuariosTabKpiState({
    contextoValido: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveUsuariosTabKpiState({
    contextoValido: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(isUsuariosTabScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.deepEqual(
    buildUsuariosTabUsersQueryKey({ groupId: 'g', empresaId: 'e', actorId: 'a', sessionKey: 's' }),
    ['usuarios-gestao', 'g', 'e', 'a', 's'],
  );
  assert.equal(usuarioNoEscopoUsuariosTab(
    { id: '1', empresa_id: 'e1' },
    { contexto: 'empresa', empresaAtivaId: 'e1', grupoAtivoId: 'g' },
  ), true);
  assert.equal(registroNoEscopoUsuariosTab(
    { id: 'p', group_id: 'g' },
    { contexto: 'grupo', grupoAtivoId: 'g', empresasDoGrupo: [{ id: 'e1' }] },
  ), true);
  assert.equal(registroNoEscopoUsuariosTab(
    { id: 'p2' },
    { contexto: 'grupo', grupoAtivoId: 'g', empresasDoGrupo: [{ id: 'e1' }] },
  ), false);
});
