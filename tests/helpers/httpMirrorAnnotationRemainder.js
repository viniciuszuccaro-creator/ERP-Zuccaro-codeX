import assert from 'node:assert/strict';

export const httpGroupScopeHunks = [
  ['rest?: LocalRecord, extraGroupOr?: LocalRecord[]', 'rest?: LocalRecord'],
  ["    extraGroupOr: entityName === 'GrupoEmpresarial' && groupId && groupId === ctxGroupId ? [{ id: groupId }] : [],\n", ''],
];

// Only the proven self-group filter delta is peeled; all other runtime stays frozen.
export function httpGroupScopeRemainder(source) {
  for (const [current, previous] of httpGroupScopeHunks) {
    assert.equal(source.split(current).length, 2, 'Exactly one approved self-group scope hunk');
    source = source.replace(current, previous);
  }
  return source;
}

export const mirrorInputBefore = ' * @param {{ groupId: string, empresaId?: string | null }} input';
export const mirrorInputAfter = ` * @param {{ groupId?: string, empresaId?: string | null, groupName?: string | null,
 * empresas?: Array<{id: string, group_id?: string, razao_social?: string, nome_fantasia?: string | null, cnpj?: string | null, status?: string}>,
 * perfilAcessoId?: string | null, permissoes?: Record<string, unknown> | null,
 * perfilNome?: string | null }} input`;

export function httpMirrorAnnotationRemainder(source) {
  assert.equal(source.split(mirrorInputAfter).length, 2, 'Exactly one complete mirror input annotation');
  return httpGroupScopeRemainder(source).replace(mirrorInputAfter, mirrorInputBefore);
}
