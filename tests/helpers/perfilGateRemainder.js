import assert from 'node:assert/strict';

function restore(source, changes) {
  let result = source.replace(/\r\n/g, '\n');
  for (const [before, after, count = 1] of changes) {
    assert.equal(result.split(before).length - 1, count, 'Only exact approved profile gate hunks may be discounted');
    result = result.split(before).join(after);
  }
  return result;
}

export function perfilViewerRemainder(source) {
  // V24 callback Product forms now use its existing writer. Restore precisely
  // this proven ownership delta for historical whole-viewer equivalence checks;
  // produto-completo-ecommerce.test.js exercises the actual writer and audit.
  return restore(source, [
    ['  "ProdutoFormV22_Completo",\n', '  "ProdutoFormV22_Completo","ProdutoFormCompleto","ProdutoForm",\n'],
    ['  getCadastroEntityPermissionKey,\n', ''],
    ['  const permCheckers = { hasPermission, canCreate, canEdit, canDelete, isLoading: permissionsLoading };', '  const permCheckers = { hasPermission, canCreate, canEdit, canDelete };'],
    ['  const cadastroPerm = function(action) { return getCadastroEntityPermissionKey(ENTITY, action); };', '  const permSection = isTenantMasterEntity(ENTITY) ? "Organizacional" : ENTITY;\n  const cadastroPerm = function(action) { return "Cadastros." + permSection + "." + action; };'],
    ["permissao: cadastroPerm('criar')", 'permissao: `Cadastros.${ENTITY}.criar`', 2],
    ["permissao: cadastroPerm('editar')", 'permissao: `Cadastros.${ENTITY}.editar`', 2],
    ["permissao: cadastroPerm('excluir')", 'permissao: `Cadastros.${ENTITY}.excluir`', 3],
  ]);
}

export function perfilPolicyRemainder(source) {
  return restore(source, [
    [`export function getCadastroEntityPermissionKey(entityName, action) {
  if (entityName === 'PerfilAcesso') return \`Sistema.Controle de Acesso.\${action}\`;
  const section = isTenantMasterEntity(entityName) ? 'Organizacional' : entityName;
  return \`Cadastros.\${section}.\${action}\`;
}

`, ''],
    [`
  // PerfilAcesso belongs to the same owner as the existing local backend and form.
  if (entity === 'PerfilAcesso') {
    if (checkers.isLoading) return false;
    if (act === 'visualizar') return Boolean(hasPermission && hasPermission('Sistema', 'Controle de Acesso', 'visualizar'));
    if (act === 'criar') return Boolean(canCreate && canCreate('Sistema', 'Controle de Acesso'));
    if (act === 'editar') return Boolean(canEdit && canEdit('Sistema', 'Controle de Acesso'));
    if (act === 'excluir') return Boolean(canDelete && canDelete('Sistema', 'Controle de Acesso'));
    return false;
  }
`, ''],
  ]);
}
