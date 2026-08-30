import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPerfilCardInfo,
  buildPerfilDeleteBlock,
  perfilNoEscopo,
} from '../src/components/sistema/central-perfis-acesso/rbacScopeUtils.js';

test('perfilNoEscopo rejects an unscoped profile', () => {
  assert.equal(perfilNoEscopo({
    perfil: { id: 'perfil-1' },
    contexto: 'grupo',
    grupoAtivoId: 'grupo-cpa',
  }), false);
});

test('perfilNoEscopo accepts the active group and linked company', () => {
  assert.equal(perfilNoEscopo({
    perfil: { group_id: 'grupo-cpa' },
    contexto: 'grupo',
    grupoAtivoId: 'grupo-cpa',
  }), true);

  assert.equal(perfilNoEscopo({
    perfil: { empresas_vinculadas: ['empresa-3z'] },
    contexto: 'empresa',
    grupoAtivoId: 'grupo-cpa',
    empresaAtivaId: 'empresa-3z',
  }), true);
});

test('profile deletion is blocked without context or permission', () => {
  assert.equal(buildPerfilDeleteBlock({
    contexto: 'empresa',
    contextoValido: false,
    podeExcluirPerfil: true,
    perfilId: 'perfil-1',
  }).dadosNovos.motivo, 'contexto_obrigatorio');

  assert.equal(buildPerfilDeleteBlock({
    contexto: 'empresa',
    contextoValido: true,
    podeExcluirPerfil: false,
    perfilId: 'perfil-1',
  }).dadosNovos.motivo, 'permissao_negada');
});

test('profile card keeps permission and linked-user totals consistent', () => {
  const card = buildPerfilCardInfo({
    perfil: {
      id: 'perfil-1',
      nome_perfil: 'Operador',
      permissoes: { Comercial: { Pedidos: ['visualizar', 'editar'] } },
    },
    usuarios: [
      { id: 'u1', perfil_acesso_id: 'perfil-1' },
      { id: 'u2', perfil_acesso_id: 'perfil-2' },
    ],
  });

  assert.equal(card.permissoesTotal, 2);
  assert.equal(card.usuariosVinculadosTotal, 1);
  assert.equal(card.nome, 'Operador');
});
